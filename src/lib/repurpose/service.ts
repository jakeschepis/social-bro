/**
 * Main repurposing service — orchestrates style-aware transcript repurposing.
 *
 * Two-phase flow: analyze transcript structure → repurpose with section awareness.
 * Falls back to word-count chunking if analysis fails.
 */

import { createChatCompletion } from '@/lib/openrouter';
import { prisma } from '@/lib/db';
import {
  buildRepurposeSystemPrompt,
  buildRepurposeUserPrompt,
  buildRepurposeChunkPrompt,
  buildHooksSystemPrompt,
  buildHooksUserPrompt,
  HOOKS_RESPONSE_FORMAT,
} from './prompts';
import {
  chunkTranscript,
  extractContextBridge,
  extractOriginalHook,
  chunkBySection,
  TARGET_CHUNK_WORDS,
  countWords,
} from './chunker';
import {
  analyzeTranscriptStructure,
  mapSectionsToTranscript,
  type TranscriptAnalysis,
  type MappedSection,
} from './analyzer';
import type { ScriptType } from '@/types';

const VALID_SCRIPT_TYPES: ScriptType[] = ['single-subject', 'multi-subject'];

// ---------------------------------------------------------------------------
// Post-processing: fix contractions and em dashes that the model keeps generating
// ---------------------------------------------------------------------------

// Safe contractions — these never produce false positives
const CONTRACTION_REPLACEMENTS: [RegExp, string][] = [
  [/\bI am\b/g, "I'm"],
  [/\bI will\b/g, "I'll"],
  [/\bI would\b/g, "I'd"],
  [/\bit is\b/gi, "it's"],
  [/\bthat is\b/gi, "that's"],
  [/\bwhat is\b/gi, "what's"],
  [/\bhere is\b/gi, "here's"],
  [/\bthere is\b/gi, "there's"],
  [/\bwho is\b/gi, "who's"],
  [/\bis not\b/gi, "isn't"],
  [/\bare not\b/gi, "aren't"],
  [/\bwas not\b/gi, "wasn't"],
  [/\bwere not\b/gi, "weren't"],
  [/\bdo not\b/gi, "don't"],
  [/\bdoes not\b/gi, "doesn't"],
  [/\bdid not\b/gi, "didn't"],
  [/\bhas not\b/gi, "hasn't"],
  [/\bhave not\b/gi, "haven't"],
  [/\bhad not\b/gi, "hadn't"],
  [/\bwill not\b/gi, "won't"],
  [/\bwould not\b/gi, "wouldn't"],
  [/\bcould not\b/gi, "couldn't"],
  [/\bshould not\b/gi, "shouldn't"],
  [/\bcan not\b/gi, "can't"],
  [/\bcannot\b/gi, "can't"],
  [/\blet us\b/gi, "let's"],
  [/\bthey are\b/gi, "they're"],
  [/\bwe are\b/gi, "we're"],
  [/\byou are\b/gi, "you're"],
];

// "have/has/had" only contract when used as AUXILIARIES (before past participles),
// NOT when possessive ("have foresight"), or before "to" ("have to go").
// Match: "I have been", "they have done", "it has become"
// Skip:  "I have to", "they have foresight", "I had to ask"
const AUXILIARY_HAVE_REPLACEMENTS: [RegExp, string][] = [
  [/\bI have (?!to\b|a\b|an\b|the\b|my\b|no\b|some\b|any\b|this\b|that\b|it\b)/g, "I've "],
  [/\bI had (?!to\b|a\b|an\b|the\b|my\b|no\b|some\b|any\b|this\b|that\b|it\b)/g, "I'd "],
  [
    /\bthey have (?!to\b|a\b|an\b|the\b|their\b|no\b|some\b|any\b|this\b|that\b|it\b)/gi,
    "they've ",
  ],
  [/\bwe have (?!to\b|a\b|an\b|the\b|our\b|no\b|some\b|any\b|this\b|that\b|it\b)/gi, "we've "],
  [/\byou have (?!to\b|a\b|an\b|the\b|your\b|no\b|some\b|any\b|this\b|that\b|it\b)/gi, "you've "],
  [/\bit has (?!to\b|a\b|an\b|the\b|its\b|no\b|some\b|any\b|this\b|that\b)/gi, "it's "],
  [/\bthat has (?!to\b|a\b|an\b|the\b|its\b|no\b|some\b|any\b|this\b|that\b)/gi, "that's "],
  [/\bwho has (?!to\b|a\b|an\b|the\b|no\b|some\b|any\b|this\b|that\b)/gi, "who's "],
];

export function postProcessScript(text: string): string {
  let result = text;

  // Replace em dashes with commas
  result = result.replace(/\u2014/g, ',');

  // Apply safe contraction replacements
  for (const [pattern, replacement] of CONTRACTION_REPLACEMENTS) {
    result = result.replace(pattern, (match) => {
      if (match[0] === match[0].toUpperCase()) {
        return replacement[0].toUpperCase() + replacement.slice(1);
      }
      return replacement;
    });
  }

  // Apply context-aware auxiliary "have/has/had" contractions
  for (const [pattern, replacement] of AUXILIARY_HAVE_REPLACEMENTS) {
    result = result.replace(pattern, (match) => {
      if (match[0] === match[0].toUpperCase()) {
        return replacement[0].toUpperCase() + replacement.slice(1);
      }
      return replacement;
    });
  }

  return result;
}

export function validateScriptType(value: unknown): ScriptType {
  if (typeof value === 'string' && VALID_SCRIPT_TYPES.includes(value as ScriptType)) {
    return value as ScriptType;
  }
  return 'single-subject';
}

export interface RepurposeResult {
  repurposedScript: string;
  hooks: string[];
  chunksProcessed: number;
}

export type ProgressStep =
  | 'extracting'
  | 'analyzing_structure'
  | 'processing'
  | 'processing_chunk'
  | 'generating_hooks'
  | 'finalizing';

export interface ProgressUpdate {
  step: ProgressStep;
  message: string;
  current?: number;
  total?: number;
}

export type ProgressCallback = (update: ProgressUpdate) => void | Promise<void>;

/**
 * Get user's selected model
 */
async function getUserModel(userId: string): Promise<string> {
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
  });

  if (!settings?.selectedModelId) {
    throw new Error('No LLM model selected. Please select a model in Settings.');
  }

  return settings.selectedModelId;
}

/**
 * Generate 3 hook sections from the original opening
 */
export async function generateHooks(
  userId: string,
  model: string,
  originalHook: string,
  scriptType: ScriptType,
  subject?: string
): Promise<string[]> {
  const response = await createChatCompletion({
    userId,
    model,
    messages: [
      { role: 'system', content: buildHooksSystemPrompt(scriptType) },
      { role: 'user', content: buildHooksUserPrompt(originalHook, scriptType, subject) },
    ],
    response_format: HOOKS_RESPONSE_FORMAT,
  });

  const content = response.choices[0]?.message?.content || '{"hooks":[]}';

  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed.hooks)) {
      return parsed.hooks.slice(0, 3);
    }
    return [];
  } catch {
    console.error('Failed to parse hooks JSON, attempting text extraction');
    const lines = content.split('\n').filter((line: string) => line.trim().length > 10);
    return lines.slice(0, 3).map((line: string) => line.replace(/^[\d.\-*]+\s*/, '').trim());
  }
}

/**
 * Repurpose via single-pass (transcript fits in one request)
 */
async function repurposeSinglePass(
  userId: string,
  model: string,
  transcript: string,
  scriptType: ScriptType,
  sections: MappedSection[]
): Promise<string> {
  const analysisInfo = sections.map((s) => ({
    type: s.type,
    title: s.title,
    estimatedWordCount: s.estimatedWordCount,
    summary: s.summary,
  }));

  const response = await createChatCompletion({
    userId,
    model,
    messages: [
      { role: 'system', content: buildRepurposeSystemPrompt(scriptType) },
      {
        role: 'user',
        content: buildRepurposeUserPrompt(scriptType, analysisInfo, transcript),
      },
    ],
    reasoning: { effort: 'high' },
  });

  const result = response.choices[0]?.message?.content || '';
  if (!result) console.warn('LLM returned empty content for chunk');
  return result;
}

/**
 * Repurpose via chunked processing (section-aware)
 */
async function repurposeChunked(
  userId: string,
  model: string,
  sections: MappedSection[],
  scriptType: ScriptType,
  onProgress?: ProgressCallback
): Promise<string> {
  const sectionChunks = chunkBySection(sections);
  const systemPrompt = buildRepurposeSystemPrompt(scriptType);
  const repurposedParts: string[] = [];
  let previousOutput: string | null = null;

  let sectionIdx = 0;
  for (let chunkIdx = 0; chunkIdx < sectionChunks.length; chunkIdx++) {
    const chunk = sectionChunks[chunkIdx];

    for (const section of chunk) {
      await onProgress?.({
        step: 'processing_chunk',
        message: `Repurposing: ${section.title}`,
        current: sectionIdx + 1,
        total: sections.length,
      });

      const userPrompt = buildRepurposeChunkPrompt(scriptType, section, {
        previousOutput: previousOutput ? extractContextBridge(previousOutput) : undefined,
        sectionIndex: sectionIdx,
        totalSections: sections.length,
      });

      const response = await createChatCompletion({
        userId,
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        reasoning: { effort: 'high' },
      });

      const result = response.choices[0]?.message?.content || '';
      if (!result) console.warn('LLM returned empty content for chunk');
      repurposedParts.push(result);
      previousOutput = result;
      sectionIdx++;
    }
  }

  return repurposedParts.join('\n\n');
}

/**
 * Fallback: repurpose using old word-count chunking (no analysis)
 */
async function repurposeFallback(
  userId: string,
  model: string,
  transcript: string,
  scriptType: ScriptType,
  onProgress?: ProgressCallback
): Promise<string> {
  const chunks = chunkTranscript(transcript);
  const systemPrompt = buildRepurposeSystemPrompt(scriptType);
  const repurposedParts: string[] = [];
  let previousContext: string | null = null;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    await onProgress?.({
      step: 'processing_chunk',
      message: 'Repurposing content',
      current: i + 1,
      total: chunks.length,
    });

    let userPrompt: string;
    if (chunk.isFirst) {
      userPrompt = `<transcript>\n${chunk.content}\n</transcript>\n\nThis is the START of the script. Repurpose it following the style profile. Return ONLY the repurposed text.`;
    } else {
      userPrompt = `<previous_output>\n${previousContext || ''}\n</previous_output>\n\n<transcript>\n${chunk.content}\n</transcript>\n\nContinue naturally from where the previous section ended. Repurpose this section following the style profile. Return ONLY the repurposed text.`;
    }

    const response = await createChatCompletion({
      userId,
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      reasoning: { effort: 'high' },
    });

    const result = response.choices[0]?.message?.content || '';
    if (!result) console.warn('LLM returned empty content for chunk');
    repurposedParts.push(result);

    if (!chunk.isLast) {
      previousContext = extractContextBridge(result);
    }
  }

  return repurposedParts.join('\n\n');
}

/**
 * Main function to repurpose a transcript
 */
export async function repurposeTranscript(
  userId: string,
  transcript: string,
  scriptType: ScriptType = 'single-subject',
  onProgress?: ProgressCallback
): Promise<RepurposeResult> {
  const model = await getUserModel(userId);
  const totalWords = countWords(transcript);

  // Phase 1: Analyze transcript structure
  let analysis: TranscriptAnalysis | null = null;
  let mappedSections: MappedSection[] | null = null;

  try {
    await onProgress?.({
      step: 'analyzing_structure',
      message: 'Analyzing transcript structure',
    });

    analysis = await analyzeTranscriptStructure(userId, model, transcript, scriptType);
    mappedSections = mapSectionsToTranscript(analysis, transcript);
  } catch (error) {
    console.error('Analysis phase failed, falling back to word-count chunking:', error);
    await onProgress?.({
      step: 'analyzing_structure',
      message: 'Analysis failed, using fallback',
    });
  }

  // Extract hook and subject for parallel generation
  let originalHook: string;
  let subject: string | undefined;
  if (mappedSections && mappedSections.length > 0) {
    const hookSection = mappedSections.find((s) => s.type === 'hook');
    originalHook = hookSection?.content || extractOriginalHook(transcript);
    subject = mappedSections
      .map((s) => s.title)
      .join(' ')
      .slice(0, 200);
  } else {
    originalHook = extractOriginalHook(transcript);
  }

  // Start hooks generation in parallel (catch to prevent unhandled rejection)
  const hooksPromise = generateHooks(userId, model, originalHook, scriptType, subject).catch(
    (error: Error) => {
      console.error('Hooks generation failed:', error);
      return [] as string[];
    }
  );

  // Phase 2: Repurpose
  let repurposedScript: string;
  let chunksProcessed: number;

  if (mappedSections && mappedSections.length > 0) {
    if (totalWords <= TARGET_CHUNK_WORDS) {
      // Single-pass
      await onProgress?.({ step: 'processing', message: 'Repurposing transcript' });
      repurposedScript = await repurposeSinglePass(
        userId,
        model,
        transcript,
        scriptType,
        mappedSections
      );
      chunksProcessed = 1;
    } else {
      // Chunked with section awareness
      repurposedScript = await repurposeChunked(
        userId,
        model,
        mappedSections,
        scriptType,
        onProgress
      );
      chunksProcessed = mappedSections.length;
    }
  } else {
    // Fallback: word-count chunking
    repurposedScript = await repurposeFallback(userId, model, transcript, scriptType, onProgress);
    chunksProcessed = Math.ceil(totalWords / TARGET_CHUNK_WORDS);
  }

  const hooks = await hooksPromise;

  if (hooks.length > 0) {
    await onProgress?.({ step: 'generating_hooks', message: 'Generated engagement hooks' });
  }

  await onProgress?.({ step: 'finalizing', message: 'Finalizing script' });

  // Post-process: fix contractions and em dashes
  repurposedScript = postProcessScript(repurposedScript);
  const processedHooks = hooks.map(postProcessScript);

  return { repurposedScript, hooks: processedHooks, chunksProcessed };
}

/**
 * Repurpose a script by ID
 */
export async function repurposeScriptById(
  userId: string,
  scriptId: string
): Promise<RepurposeResult> {
  const script = await prisma.script.findUnique({
    where: { id: scriptId },
  });

  if (!script) {
    throw new Error('Script not found');
  }

  if (script.userId !== userId) {
    throw new Error('Unauthorized');
  }

  const scriptType = validateScriptType(script.scriptType);
  const result = await repurposeTranscript(userId, script.script, scriptType);

  await prisma.script.update({
    where: { id: scriptId },
    data: {
      repurposedScript: result.repurposedScript,
      hooks: result.hooks,
      status: 'in_progress',
      scriptType,
    },
  });

  return result;
}
