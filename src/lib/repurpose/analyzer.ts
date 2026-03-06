/**
 * Transcript structure analysis — identifies sections before repurposing.
 */

import { createChatCompletion } from '@/lib/openrouter';
import { buildAnalysisPrompt, ANALYSIS_RESPONSE_FORMAT } from './prompts';
import type { ScriptType } from '@/types';

export interface AnalyzedSection {
  type: 'hook' | 'intro' | 'body_section' | 'outro';
  title: string;
  startText: string;
  endText: string;
  estimatedWordCount: number;
  summary: string;
}

export interface TranscriptAnalysis {
  sections: AnalyzedSection[];
  totalWordCount: number;
  scriptTypeDetected: ScriptType;
}

export interface MappedSection extends AnalyzedSection {
  content: string;
  wordCount: number;
}

/**
 * Analyze transcript structure using LLM
 */
export async function analyzeTranscriptStructure(
  userId: string,
  model: string,
  transcript: string,
  scriptType: ScriptType
): Promise<TranscriptAnalysis> {
  const response = await createChatCompletion({
    userId,
    model,
    messages: [
      {
        role: 'system',
        content:
          'You are a transcript analyst. Your job is to identify the structural sections of a video transcript. Be precise with the startText and endText markers — copy them verbatim from the transcript.',
      },
      { role: 'user', content: buildAnalysisPrompt(transcript, scriptType) },
    ],
    response_format: ANALYSIS_RESPONSE_FORMAT,
    reasoning: { effort: 'medium' },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('Analysis returned empty response');
  }

  let parsed: TranscriptAnalysis;
  try {
    parsed = JSON.parse(content) as TranscriptAnalysis;
  } catch {
    throw new Error('Analysis returned invalid JSON');
  }

  if (!parsed.sections || !Array.isArray(parsed.sections) || parsed.sections.length === 0) {
    throw new Error('Analysis returned no sections');
  }

  return parsed;
}

/**
 * Map analyzed section markers back to actual transcript content.
 *
 * Strategy:
 * 1. Try exact substring match for startText
 * 2. Fall back to case-insensitive match
 * 3. Fall back to partial word match
 * 4. Last resort: proportional split by estimated word counts
 */
export function mapSectionsToTranscript(
  analysis: TranscriptAnalysis,
  transcript: string
): MappedSection[] {
  const sections = analysis.sections;
  const positions: { start: number; end: number }[] = [];

  // Find start positions for each section
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    let startPos: number;

    if (i === 0) {
      startPos = 0;
    } else {
      // Search from the previous section's start position (end isn't calculated yet)
      const searchFrom = positions[i - 1]?.start || 0;
      const exactIdx = transcript.indexOf(section.startText, searchFrom);

      if (exactIdx !== -1) {
        startPos = exactIdx;
      } else {
        // Try case-insensitive
        const lowerTranscript = transcript.toLowerCase();
        const lowerStart = section.startText.toLowerCase();
        const caseIdx = lowerTranscript.indexOf(lowerStart, searchFrom);

        if (caseIdx !== -1) {
          startPos = caseIdx;
        } else {
          // Try matching first few words (more tolerant of LLM approximation)
          const firstWords = section.startText.split(/\s+/).slice(0, 5).join(' ');
          const partialIdx = transcript.indexOf(firstWords, searchFrom);

          if (partialIdx !== -1) {
            startPos = partialIdx;
          } else {
            // Proportional fallback
            startPos = -1;
          }
        }
      }
    }

    positions.push({ start: startPos, end: -1 });
  }

  // If any positions are -1, use proportional split
  const hasUnresolved = positions.some((p) => p.start === -1);
  if (hasUnresolved) {
    return proportionalSplit(sections, transcript);
  }

  // Calculate end positions (each section ends where the next begins)
  for (let i = 0; i < positions.length; i++) {
    if (i < positions.length - 1) {
      positions[i].end = positions[i + 1].start;
    } else {
      positions[i].end = transcript.length;
    }
  }

  return sections.map((section, i) => {
    const content = transcript.slice(positions[i].start, positions[i].end).trim();
    return {
      ...section,
      content,
      wordCount: content.split(/\s+/).filter(Boolean).length,
    };
  });
}

function proportionalSplit(sections: AnalyzedSection[], transcript: string): MappedSection[] {
  const words = transcript.split(/\s+/).filter(Boolean);
  const totalEstimated = sections.reduce((sum, s) => sum + s.estimatedWordCount, 0);
  const results: MappedSection[] = [];
  let wordOffset = 0;

  // Guard against division by zero
  if (totalEstimated === 0) {
    const perSection = Math.ceil(words.length / sections.length);
    for (const section of sections) {
      const sectionWords = words.slice(wordOffset, wordOffset + perSection);
      results.push({
        ...section,
        content: sectionWords.join(' '),
        wordCount: sectionWords.length,
      });
      wordOffset += perSection;
    }
    return results;
  }

  for (const section of sections) {
    const proportion = section.estimatedWordCount / totalEstimated;
    const wordCount = Math.round(proportion * words.length);
    const sectionWords = words.slice(wordOffset, wordOffset + wordCount);
    const content = sectionWords.join(' ');

    results.push({
      ...section,
      content,
      wordCount: sectionWords.length,
    });

    wordOffset += wordCount;
  }

  // Ensure last section gets remaining words
  if (wordOffset < words.length && results.length > 0) {
    const last = results[results.length - 1];
    const remaining = words.slice(wordOffset).join(' ');
    last.content += ' ' + remaining;
    last.wordCount += words.length - wordOffset;
  }

  return results;
}
