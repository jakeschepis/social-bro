/**
 * Prompt factory functions for style-aware transcript repurposing.
 *
 * Follows Gemini best practices:
 * - System prompt = role + style profile JSON + few-shot examples
 * - User prompt = structural template + transcript (XML delimited) + task (LAST)
 * - XML delimiters separate input from instructions
 * - No redundant instructions between system and user prompts
 */

import { getStyleProfile } from './style-profiles';
import type { ScriptType } from '@/types';
import type { AnalyzedSection, MappedSection } from './analyzer';

// ---------------------------------------------------------------------------
// Profile trimming helper — keeps only actionable fields for the LLM prompt
// ---------------------------------------------------------------------------

function trimProfileForPrompt(profile: ReturnType<typeof getStyleProfile>): string {
  const sp = profile.script_style_profile as Record<string, unknown>;
  const trimmed = {
    overview: sp.overview,
    tone_of_voice: sp.tone_of_voice,
    hook_style: sp.hook_style,
    narrative_structure: {
      overall_pattern: (sp.narrative_structure as Record<string, unknown>)?.overall_pattern,
      opening: (sp.narrative_structure as Record<string, unknown>)?.opening,
      key_beats: (sp.narrative_structure as Record<string, unknown>)?.key_beats,
    },
    sentence_style: sp.sentence_style,
    rhetorical_devices: {
      signature_phrases: (sp.rhetorical_devices as Record<string, unknown>)?.signature_phrases,
      primary_tools: (sp.rhetorical_devices as Record<string, unknown>)?.primary_tools,
    },
    structural_template: sp.structural_template,
  };
  return JSON.stringify(trimmed, null, 2);
}

// ---------------------------------------------------------------------------
// Shared voice rules — used by both repurpose and hooks prompts
// ---------------------------------------------------------------------------

const SHARED_VOICE_RULES = `- First person throughout. Transform any "we" or third-person narration into "I".
- Signature phrases every 200-300 words: "Here's what surprised me...", "But here's the thing...", "And here's where it gets [adjective]...", "What I didn't expect...", "The deeper I went...", "It turns out..."
- Rotate through ALL signature phrases. No single phrase more than twice per script.
- Casual markers: "Like,", "Yep,", "Well,", "I mean,", "Honestly,"
- Sentence rhythm: short punchy fragments ("That changed everything.") between longer explanations.
- Use contractions naturally ("it's", "didn't", "that's"). This is spoken script, not an essay.`;

// ---------------------------------------------------------------------------
// Few-shot examples sourced from reference scripts
// ---------------------------------------------------------------------------

const SINGLE_SUBJECT_EXAMPLES = `<examples>
<example description="Hook: transform a broad topic survey into personal assumption demolition about the SPECIFIC subject">
<input>
Spiders are found on every continent except Antarctica. They are one of the most diverse groups of arachnids with over 45000 known species. Most people think of spiders as simple web builders but they are actually complex predators with sophisticated hunting strategies and remarkable biological adaptations.
</input>
<output>
A spider always looked simple to me. Eight legs, tiny body, builds a web. Nothing special. I never gave them a second thought. But once I actually started digging into how a spider works, everything changed. I didn't expect to find a creature this overengineered, this efficient, and this bizarre. Like, there are species that can literally fly, drifting through the air on strands of silk like tiny parachutes. The deeper I went, the more shocked I became at how much I never knew.
</output>
</example>
<example description="Body section: transform formal third-person into conversational first-person with contractions and casual markers">
<input>
The octopus nervous system follows an entirely different blueprint from vertebrates. An octopus possesses hundreds of millions of neurons comparable to a dog. But roughly two thirds of them exist outside the brain. It is distributed throughout the eight arms organized into clusters called ganglia. Each arm contains a localized processing center. It is capable of executing complex behaviors independently. That is unlike anything in the vertebrate world.
</input>
<output>
Here's what I didn't expect. An octopus has hundreds of millions of neurons, about as many as a dog. But two thirds of them aren't in its brain. They're spread across its eight arms. I mean, each arm has its own processing center, its own local intelligence. Like, researchers have shown that a severed arm will keep exploring on its own, recoiling from things it doesn't like, reaching toward things it does. No input from the brain at all. It's genuinely autonomous. Honestly, that's not delegation. That's a fundamentally different model of what a mind can be.
</output>
</example>
<example description="Context-setting: transform a textbook background passage into first-person discovery framing">
<input>
The social intelligence hypothesis is widely accepted in cognitive science. It proposes that complex social environments drive the evolution of larger brains. Primates, dolphins, and wolves all live in large social groups with intricate dominance hierarchies. They must track alliances, rivalries, and social debts. This constant social computation requires significant neural resources.
</input>
<output>
When I first looked into this, every source pointed me toward the same idea. It's called the social intelligence hypothesis. Basically, the theory says that living in complex social groups is what forces brains to get bigger. Yep, chimps, dolphins, wolves. They all live in these massive political webs, constantly tracking who's allied with who, who owes what. And honestly, it makes sense on paper. I kept reading about how all that social math supposedly demands serious brain power. But here's where it gets interesting. That theory doesn't explain what I was looking at.
</output>
</example>
<example description="Closing: transform a sponsor plug into philosophical elevation">
<input>
I love exploring these topics because nature never stops surprising me. The natural world is full of mysteries waiting to be uncovered. If you want to learn more about science check out brilliant. Brilliant is an amazing interactive platform for learning.
</input>
<output>
Honestly, when I started this, I thought I was learning about one animal. But what I actually found was something bigger. A creature that arrived at intelligence through an entirely different blueprint than ours, built from scratch on a separate branch of the evolutionary tree. And yet it reached the same destination. Well, that raises a question I can't stop thinking about. If intelligence can emerge this independently, from architectures this different, then maybe what we call "smart" isn't one thing at all. Maybe it's just what happens when the world gets complicated enough to demand it.
</output>
</example>
</examples>`;

const MULTI_SUBJECT_EXAMPLES = `<examples>
<example>
<input>
Beneath the surface of our oceans lies a world we were never meant to see. A realm where light dies and life takes on forms that shouldn't be possible. We've sent rovers to Mars. We've mapped distant galaxies. But the deep sea, we've explored less than 5% of it.
</input>
<output>
I used to think we'd explored most of our planet. We've sent robots to Mars, photographed black holes, mapped galaxies millions of light-years away. Then I learned something that stopped me cold. The deep ocean, the one right beneath us, is over 95% unexplored. And what we've found in that tiny sliver we have reached? It breaks every rule biology is supposed to follow.
</output>
</example>
<example>
<input>
At the surface the ocean is bright and full of life. Sunlight fuels plankton blooms which feed fish which feed entire food chains. But drop below 200 meters and that light begins to fade. We are now entering the twilight zone. Here the sun's rays are too weak for photosynthesis. Life here has to find other ways to survive.
</input>
<output>
The surface ocean makes sense to me. Sunlight drives everything. Plankton blooms feed fish, fish feed bigger fish, and the whole chain runs on solar energy. It's neat. It's logical. But drop below 200 meters and that logic falls apart. This is the twilight zone. Down here, the sun is too weak to grow anything. And yet somehow, life is everywhere. What I found out about how these creatures survive genuinely unsettled me.
</output>
</example>
</examples>`;

// ---------------------------------------------------------------------------
// Repurpose prompts
// ---------------------------------------------------------------------------

export function buildRepurposeSystemPrompt(scriptType: ScriptType): string {
  const profile = getStyleProfile(scriptType);
  const examples =
    scriptType === 'single-subject' ? SINGLE_SUBJECT_EXAMPLES : MULTI_SUBJECT_EXAMPLES;

  return `You are a scriptwriter who transforms transcripts into first-person discovery narratives. You write as a curious investigator sharing your research journey: "I discovered", "What surprised me", "The deeper I went."

<voice>
${SHARED_VOICE_RULES}
- Hook: Name the subject in your FIRST sentence. YOUR dismissive assumption about THIS specific subject, shattered by a surprising fact. Never open with other animals or a broad topic survey.
- Emotional escalation: curiosity early, astonishment middle, philosophical wonder at the end.
- Closing: philosophical elevation connecting the subject to universal questions. Callback to opening assumption. Never recap. Replace any sponsor/ad sections.
</voice>

<style_profile>
${trimProfileForPrompt(profile)}
</style_profile>

${examples}

<constraints>
- Be comprehensive and detailed. This is a full documentary script, not a summary.
- Keep ALL names, species names, and specific references exactly as they appear.
- Never use em dashes (\u2014), semicolons (;), or AI phrases like "dive into", "unleash", "game-changer", "revolutionary", "cutting-edge", "elevate", "embark on", "delve into".
- Return ONLY the repurposed script text.
</constraints>`;
}

export function buildAnalysisPrompt(transcript: string, scriptType: ScriptType): string {
  const typeGuidance =
    scriptType === 'single-subject'
      ? 'This is a single-subject deep-dive script. Expect sections that progressively explore one topic in depth: a hook that introduces the subject, an intro that sets up the investigation, body sections that each reveal a new facet or layer of the same subject, and an outro that synthesizes the findings.'
      : 'This is a multi-subject thematic script. Expect sections that cover multiple distinct subjects or creatures united by a common theme: a hook that introduces the overarching theme, body sections that each focus on a different subject or example, and an outro that ties the subjects together.';

  return `<transcript>
${transcript}
</transcript>

Script type: ${scriptType}
${typeGuidance}

Analyze the structure of this transcript and identify its sections. For each section, provide:
- type: one of "hook", "intro", "body_section", "outro"
- title: a brief descriptive title for the section
- startText: the first 10-15 words of the section, verbatim from the transcript
- endText: the last 10-15 words of the section, verbatim from the transcript
- estimatedWordCount: approximate word count for this section
- summary: a one-sentence summary of what the section covers

Identify natural section boundaries based on topic shifts, transitions, and structural markers in the content.`;
}

export const ANALYSIS_RESPONSE_FORMAT = {
  type: 'json_schema' as const,
  json_schema: {
    name: 'transcript_analysis',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        sections: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['hook', 'intro', 'body_section', 'outro'],
              },
              title: { type: 'string' },
              startText: { type: 'string' },
              endText: { type: 'string' },
              estimatedWordCount: { type: 'number' },
              summary: { type: 'string' },
            },
            required: ['type', 'title', 'startText', 'endText', 'estimatedWordCount', 'summary'],
            additionalProperties: false,
          },
        },
        totalWordCount: { type: 'number' },
        scriptTypeDetected: {
          type: 'string',
          enum: ['single-subject', 'multi-subject'],
        },
      },
      required: ['sections', 'totalWordCount', 'scriptTypeDetected'],
      additionalProperties: false,
    },
  },
};

export function buildRepurposeUserPrompt(
  scriptType: ScriptType,
  sections: Pick<AnalyzedSection, 'type' | 'title' | 'estimatedWordCount' | 'summary'>[],
  transcript: string
): string {
  const profile = getStyleProfile(scriptType);
  const structuralTemplate =
    'structural_template' in profile.script_style_profile
      ? JSON.stringify(
          (profile.script_style_profile as Record<string, unknown>).structural_template,
          null,
          2
        )
      : null;

  const sectionSummary = sections
    .map((s, i) => `${i + 1}. [${s.type}] ${s.title} (~${s.estimatedWordCount} words)`)
    .join('\n');

  // Extract the primary subject from section titles for explicit grounding
  const subjectHint = sections
    .map((s) => s.title)
    .join(' ')
    .slice(0, 200);

  // Calculate target word count from section estimates (minimum 2000)
  const targetWordCount = Math.max(
    2000,
    sections.reduce((sum, s) => sum + s.estimatedWordCount, 0)
  );

  return `${structuralTemplate ? `<structural_template>\n${structuralTemplate}\n</structural_template>\n\n` : ''}<section_map>
${sectionSummary}
</section_map>

<transcript>
${transcript}
</transcript>

This transcript is about "${subjectHint}". Repurpose it into a first-person discovery narrative about THIS subject only. Do not introduce other animals or topics not in the original.

Plant open loops: raise a question early that you answer 2-3 sections later.

Write approximately ${targetWordCount} words total. Match each section's word count from the section map. Do NOT compress or shorten. Every section must be fully developed.`;
}

function getSectionVoiceGuidance(
  sectionType: string,
  sectionIndex: number,
  totalSections: number,
  hasPrevious: boolean
): string {
  const continuity = hasPrevious
    ? 'Continue naturally from the previous section. '
    : 'This is the START of the script. ';

  const sectionGuide: Record<string, string> = {
    hook: 'HOOK: Open with YOUR dismissive assumption about this specific subject, shatter it with a surprising fact. ',
    intro:
      'INTRO: Personal framing on context/history. Plant an open loop question answered later. ',
    outro:
      'CLOSING: Philosophical elevation. Callback to opening assumption. Replace any sponsor content. Never recap. ',
  };

  let guidance = sectionGuide[sectionType] || '';
  if (!guidance && (sectionType === 'body_section' || !sectionType)) {
    const position = sectionIndex / totalSections;
    guidance =
      position < 0.5 ? 'Build curiosity and surprise. ' : 'Escalate toward genuine astonishment. ';
  }
  if (sectionIndex === totalSections - 1 && sectionType !== 'outro') {
    guidance = sectionGuide['outro'];
  }

  return continuity + guidance;
}

export function buildRepurposeChunkPrompt(
  scriptType: ScriptType,
  section: MappedSection,
  context: { previousOutput?: string; sectionIndex: number; totalSections: number }
): string {
  const contextBlock = context.previousOutput
    ? `<previous_output>
${context.previousOutput}
</previous_output>

`
    : '';

  return `${contextBlock}<section_info>
Section ${context.sectionIndex + 1} of ${context.totalSections}
Type: ${section.type}
Title: ${section.title}
Target word count: ~${section.estimatedWordCount} words (do NOT write less than this)
</section_info>

<transcript>
${section.content}
</transcript>

${getSectionVoiceGuidance(section.type, context.sectionIndex, context.totalSections, !!context.previousOutput)}Return ONLY the repurposed text.`;
}

// ---------------------------------------------------------------------------
// Hooks prompts
// ---------------------------------------------------------------------------

export function buildHooksSystemPrompt(scriptType: ScriptType): string {
  const profile = getStyleProfile(scriptType);
  const hookStyle =
    'hook_style' in profile.script_style_profile
      ? JSON.stringify(
          (profile.script_style_profile as Record<string, unknown>).hook_style,
          null,
          2
        )
      : '';

  const examples =
    scriptType === 'single-subject'
      ? `<examples>
<example description="First-person assumption demolition with personal framing">
<original_hook>
A spider always looked simple to me. Eight legs, tiny body, builds a web, nothing special. But once I actually started digging into how a spider works, everything changed. I didn't expect to find a creature this overengineered, this efficient, and this bizarre.
</original_hook>
<alternative_hook>
I used to walk past spiders without a second thought. Tiny things spinning webs in corners. Completely unremarkable. Then I made the mistake of actually researching what goes on inside one of these creatures. What I found was an animal so absurdly over-built, so quietly extreme, that it rewired how I think about evolution itself. There are spiders that can sail across oceans on threads of silk. Others that see in ultraviolet, or pump their own blood to power hydraulic legs. And that's just where this story begins.
</alternative_hook>
</example>
<example description="Different angle: open with a specific moment of personal surprise">
<original_hook>
A spider always looked simple to me. Eight legs, tiny body, builds a web, nothing special. But once I actually started digging into how a spider works, everything changed. I didn't expect to find a creature this overengineered, this efficient, and this bizarre.
</original_hook>
<alternative_hook>
I came across a fact about spiders that I genuinely couldn't believe. Some of them fly. Not with wings. They release threads of silk into the air and ride electrical currents across entire oceans. That's when I realized I had no idea what a spider actually was. I'd been picturing a simple little web-builder my whole life. But the deeper I looked, the more I found a creature that doesn't just survive. It engineers. It calculates. It's been doing this for 400 million years, longer than trees have existed. And I'd been stepping over them without a second thought.
</alternative_hook>
</example>
</examples>`
      : `<examples>
<example description="First-person discovery framing">
<original_hook>
Beneath the surface of our oceans lies a world we were never meant to see. A realm where light dies and life takes on forms that shouldn't be possible.
</original_hook>
<alternative_hook>
I used to think we'd mapped most of what's down there. We've sent robots to Mars, photographed black holes, built telescopes that can see the edge of the observable universe. Then I learned that the deep ocean, the one directly beneath us, is over 95% unexplored. And the little we've found in that sliver? It breaks every rule I thought biology was supposed to follow. That's when I realized we've been looking in the wrong direction this entire time.
</alternative_hook>
</example>
</examples>`;

  const hookWordRange =
    profile.script_style_profile.structural_template.section_1_hook.word_count_target;

  return `You write video hooks as a first-person curious investigator. You admit YOUR prior ignorance about the subject, then share your surprise. You never lecture the viewer.

<hook_style>
${hookStyle}
</hook_style>

<voice>
${SHARED_VOICE_RULES}
- Assumption demolition: YOUR dismissive assumption about the specific subject, shattered by a surprising fact.
- Use 1-2 signature phrases per hook, not more. Let the surprising facts carry the weight.
- Never use second-person lecture ("You have likely been taught..."), aggressive closers, or trailer voiceover tone.
</voice>

${examples}

<constraints>
- Each hook: ${hookWordRange}, fully developed.
- Keep species names, statistics, and references from the original.
- Never use em dashes (\u2014), semicolons (;), or AI phrases ("dive into", "unleash", "game-changer").
- Use contractions naturally ("it's", "didn't", "that's").
</constraints>`;
}

export function buildHooksUserPrompt(
  originalHook: string,
  scriptType: ScriptType,
  subject?: string
): string {
  const profile = getStyleProfile(scriptType);
  const hookWordTarget =
    profile.script_style_profile.structural_template.section_1_hook.word_count_target;

  const subjectLine = subject ? `\nSUBJECT: ${subject}\n` : '';

  return `<original_hook>
${originalHook}
</original_hook>
${subjectLine}
Create 3 alternative hook sections (${hookWordTarget} each) that could replace this opening. The hooks must be about ${subject || 'the SAME subject as the original'}. Do not introduce different animals or topics.

Each hook MUST:
- Be written in FIRST PERSON: "I" not "you". You are sharing YOUR assumption being shattered.
- Open with your personal dismissive assumption about the SPECIFIC subject in the original hook (not the broader category)
- Shatter that assumption with a surprising fact about THAT SAME subject
- Use contractions naturally ("It's", "I've", "didn't")
- Use casual markers ("Like,", "Well,") and signature phrases ("Here's what surprised me...")
- Take a different angle from the other hooks while keeping the same topic and energy`;
}

export const HOOKS_RESPONSE_FORMAT = {
  type: 'json_schema' as const,
  json_schema: {
    name: 'hooks_response',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        hooks: {
          type: 'array',
          items: { type: 'string' },
          minItems: 3,
          maxItems: 3,
        },
      },
      required: ['hooks'],
      additionalProperties: false,
    },
  },
};
