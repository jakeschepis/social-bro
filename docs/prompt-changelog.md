# Prompt Engineering Changelog

Tracking what works, what doesn't, and what changes are made to the repurpose prompts.

---

## 2026-03-05 — v3.1 Changes (hooks prompt + contractions + casualness)

### Problem

v3 repurpose output was a significant improvement (first-person voice, assumption demolition hook, philosophical closing all landed). However, the **hooks generation prompt** was never updated with v3 voice rules. Generated hooks showed:

| Issue | Example |
|-------|---------|
| Second-person lecture | "You have likely been taught...", "Your perception is about to face total destruction" |
| No first-person voice | Zero "I" statements in any hook |
| Aggressive/sensational tone | "Prepare to abandon everything you believed" |
| No contractions | "It is" everywhere instead of "It's" |
| No casualness markers | Zero instances of "Like,", "Well,", "Yep," |

The contraction and casualness issues also appeared in the main repurposed script output.

### Root Cause Analysis

**Problem 1: Hooks system prompt had no voice rules**

`buildHooksSystemPrompt()` contained only formatting rules (word count, no em dashes, no AI phrases) and a generic "match the style profile's hook technique." No first-person enforcement, no anti-patterns against second-person lecture, no contraction guidance.

**Gemini best practice violated:** "Be direct and specific — no vague instructions." Telling the model to "match the style profile" is vague. The model needs explicit voice rules at the top of the system prompt.

**Problem 2: Hooks few-shot examples inconsistent**

The single-subject hook example was good (first-person: "I used to walk past spiders...") but there was only one example. The multi-subject example was NOT first-person ("The ocean floor drops away into darkness..."). With only one positive example and one contradicting example, the model had no clear pattern to follow.

**Gemini best practice violated:** "Keep consistent formatting across all examples." Mixed first/third-person examples send conflicting signals.

**Problem 3: Hooks user prompt task instruction didn't mention voice**

The final instruction was: "Create 3 alternative hook sections that could replace this opening. Each should capture the same energy and topic while taking a different angle."

No mention of first-person, no mention of contractions, no mention of assumption demolition. Since Gemini optimizes for the last instruction, the model optimized for "different angle" with no voice constraints.

**Gemini best practice violated:** "Put your query/question at the end of the prompt." The last instruction must include the most important constraints.

**Problem 4: No contraction rule anywhere**

Neither the repurpose prompt nor the hooks prompt had an explicit rule about contractions. The model defaults to formal "It is" constructions in written output. For a spoken script, this sounds stilted. Needs explicit instruction to use "It's", "I've", "didn't", etc.

**Problem 5: Casualness marker density too vague**

Voice rule #5 said "Use casual conversational markers naturally" but gave no density target and only listed 3 markers. Model treated this as optional.

### Changes Made (v3.1)

| File | Change |
|------|--------|
| `prompts.ts` — `buildHooksSystemPrompt()` | Added VOICE RULES section (7 rules): first-person, assumption demolition, contractions, casual markers, sentence rhythm, signature phrases |
| `prompts.ts` — `buildHooksSystemPrompt()` | Added VOICE ANTI-PATTERNS section: no second-person lecture, no confrontational "you", no aggressive/sensational closers, no trailer voiceover tone |
| `prompts.ts` — `buildHooksSystemPrompt()` | Added second single-subject few-shot example (different angle: open with specific moment of surprise) |
| `prompts.ts` — `buildHooksSystemPrompt()` | Fixed multi-subject example to use first-person voice ("I used to think we'd mapped...") |
| `prompts.ts` — `buildHooksSystemPrompt()` | Added description attributes to all hook examples |
| `prompts.ts` — `buildHooksUserPrompt()` | Rewrote task instruction (end of prompt) with explicit first-person requirements, contractions, casual markers, signature phrases |
| `prompts.ts` — repurpose system prompt | Added CRITICAL RULE #6: contractions rule ("NEVER write 'It is' where 'It's' sounds more natural. This is a spoken script, not an essay.") |
| `prompts.ts` — repurpose system prompt | Strengthened voice rule #5: added density target (3+ per 1000 words) and expanded marker list ("I mean,", "Honestly,") |

### Gemini Prompting Principles Applied

1. **Direct voice rules at top of hooks system prompt** — not buried in a JSON blob or implied by "match the style profile"
2. **Consistent few-shot examples** — all examples now show first-person hooks, consistent formatting
3. **Task instruction at end of user prompt includes all critical constraints** — first-person, contractions, casual markers
4. **Positive patterns over negative** — few-shot examples show desired output; anti-patterns section added separately
5. **System prompt holds hard constraints** — voice anti-patterns in system prompt so they persist and don't need repeating

### Metrics to Re-evaluate

Run crow transcript through v3.1 and check hooks specifically:
1. All 3 hooks written in first person (yes/no)
2. No second-person lecture voice (yes/no)
3. Contractions used naturally — "It's" not "It is" (count)
4. Casualness markers present (count per hook)
5. Each hook uses assumption demolition pattern (yes/no)
6. Signature phrases present in hooks (count)
7. No aggressive/sensational language (yes/no)

Also re-check main script for:
8. Contractions ("It's" vs "It is" ratio)
9. Casualness marker density (target: 3+ per 1000 words)

---

## 2026-03-06 — v4 Changes (Gemini 3 prompt restructure)

### Research Findings Applied

Three research agents surveyed official Google Gemini documentation. Key findings that drove changes:

1. **"Gemini 3 responds best to direct, clear instructions and may over-analyze verbose or overly complex prompt engineering techniques."** — Our system prompt had grown to 10 voice rules + 6 anti-patterns + 8 critical rules. Too verbose.

2. **Recommended structure: `[Context] → [Main task] → [Constraints at end]`** — Our constraints were scattered throughout system and user prompts.

3. **"By default, Gemini 3 is less verbose and prefers providing direct, efficient answers."** — Explains the 1300-word output when we needed 2000+. Must explicitly request detailed, comprehensive output.

4. **Output limit is 65,536 tokens (64K), not 8,192** — Our chunking threshold of 6,000 words was based on outdated Gemini 2.0 limits.

5. **"Using examples to show the model a pattern to follow is more effective than rules"** — We should lean on few-shot examples and reduce rule count.

6. **"Don't mix XML or Markdown, choose one format for consistency"** — Switched fully to XML tags.

### Changes Made (v4)

**System prompt — Simplified from ~50 lines to ~20 lines:**

| Before | After |
|--------|-------|
| 10 VOICE RULES | Single `<voice>` block with 7 concise bullet points |
| 6 VOICE ANTI-PATTERNS | Removed — anti-patterns merged into positive voice rules |
| 8 CRITICAL RULES | Single `<constraints>` block with 5 bullet points |
| Rules scattered across sections | Clean XML structure: role → `<voice>` → `<style_profile>` → examples → `<constraints>` |

**User prompt — Removed redundancy:**

| Before | After |
|--------|-------|
| SUBJECT block + TARGET LENGTH block + task paragraph + 7 KEY REQUIREMENTS | Subject + task (1 sentence) + open loops instruction + word count constraint |
| ~15 lines of instructions | ~5 lines — no repetition of system prompt rules |

**Hooks system prompt — Same simplification:**

| Before | After |
|--------|-------|
| 7 VOICE RULES + 5 ANTI-PATTERNS + 4 FORMATTING RULES | `<voice>` block (6 bullets) + `<constraints>` block (4 bullets) |

**Chunk prompt — Concise section guidance:**

| Before | After |
|--------|-------|
| Long paragraph per section type with repeated voice instructions | Short single-sentence guidance per section type, no redundant voice rules |

**Chunking threshold:**

| Before | After | Reason |
|--------|-------|--------|
| `TARGET_CHUNK_WORDS = 6,000` | `TARGET_CHUNK_WORDS = 40,000` | Gemini 3 Flash output limit is 64K tokens (~48K words). Only chunk for extremely long transcripts. |

### Gemini 3 Principles Applied

1. **Concise prompts** — Reduced system prompt from ~50 lines to ~20. Direct and clear.
2. **XML consistency** — All sections wrapped in XML tags (`<voice>`, `<style_profile>`, `<constraints>`). No mixing with markdown.
3. **`[Context] → [Task] → [Constraints at end]`** — System prompt: role → voice → profile → examples → constraints. User prompt: data → task → word count.
4. **No redundancy** — User prompt references system prompt rules, doesn't repeat them.
5. **Examples carry the weight** — 3 few-shot examples remain unchanged; they demonstrate the pattern more effectively than rules.
6. **Explicit verbosity request** — "Be comprehensive and detailed — this is a full documentary script, not a summary."

### Metrics to Verify

1. Output still follows first-person voice (not regressed by simplification)
2. Hook still uses assumption demolition about the correct subject
3. Closing still has philosophical elevation
4. Output length hits ~2000 words (verbosity instruction working)
5. Signature phrases still present at good density
6. Most transcripts now process as single-pass (no chunking)

---

## 2026-03-06 — v3.3 Changes (contractions + em dash post-processing)

### Problem

Contractions have been the most persistent issue across every prompt iteration. The model keeps generating "It is", "I am", "That is", "There is" instead of "It's", "I'm", "That's", "There's". This makes the script sound stiff and formal for spoken content. Em dashes also keep appearing despite CRITICAL RULE #3.

Multiple prompt-level attempts have failed to fix this:
- v3: Added "Use contractions naturally" to voice rules
- v3.1: Added explicit CRITICAL RULE #6 with "NEVER write 'It is' where 'It's' sounds more natural"
- v3.1: Added contraction rules to hooks prompt

The model's formal register is too strong for prompt-only fixes on low-level formatting.

### Approach: Two-pronged (following Gemini guide)

**Prong 1: Strengthen few-shot examples (Gemini guide: "examples are more effective than rules")**

Updated the body section few-shot example so the INPUT deliberately contains formal constructions ("It is distributed", "It is capable", "That is unlike") and the OUTPUT shows them as contractions ("It's", "That's"). This shows the model the specific transformation pattern rather than just telling it.

**Prong 2: Deterministic post-processing safety net**

Added `postProcessScript()` in `service.ts` that runs after all LLM output. Handles:
- **38 contraction patterns**: "I am"→"I'm", "it is"→"it's", "that is"→"that's", "is not"→"isn't", "do not"→"don't", "they are"→"they're", etc.
- **Em dash removal**: replaces `\u2014` with commas
- **Case preservation**: if the original starts uppercase, the contraction does too ("It is"→"It's", "it is"→"it's")

Applied to both the repurposed script and all 3 hooks before returning the final result.

### Why post-processing is the right call here

Per the Gemini guide: "Do not assume implicit requirements — state everything explicitly." We've stated contractions explicitly in rules, examples, and anti-patterns across 3 versions. The model still generates formal constructions. This is a known LLM behavior — formal register is deeply ingrained in training data and resists prompt-level override for low-level formatting details. Post-processing is deterministic, fast, and catches 100% of cases.

### Changes Made (v3.3)

| File | Change |
|------|--------|
| `service.ts` | Added `CONTRACTION_REPLACEMENTS` — 38 regex patterns covering all common English contractions |
| `service.ts` | Added `postProcessScript()` — applies contractions + em dash fix with case preservation |
| `service.ts` | Applied post-processing to `repurposedScript` and all `hooks` before final return |
| `prompts.ts` | Updated body section few-shot example: input now has formal "It is"/"That is" constructions, output shows them as contractions |

### Metrics to Verify

After v3.3:
1. Zero instances of "It is" where "It's" would be natural (post-processing guarantees this)
2. Zero em dashes in output (post-processing guarantees this)
3. Contractions sound natural in context (manual check — verify no false positives like proper nouns)

---

## 2026-03-05 — v3.2 Changes (subject bleed-through fix)

### Problem

The repurposed crow script opened with a hook about invertebrates/cephalopods ("alien intelligence living right beneath the surface that changes color to express thoughts") before pivoting to crows. All 3 generated hooks were also about cephalopods instead of crows.

### Root Cause: Few-shot example content bleeding into output

The few-shot examples in the system prompt used **crow-specific content** (Example 1: "A crow never struck me as anything special", Example 3: "When I started researching crows..."). When the model received a crow transcript to repurpose, it couldn't separate "copy this style" from "don't repeat this content." To avoid looking like it was copying the examples, it reached for a different animal (octopus/cephalopods) as the hook subject.

**Gemini best practice violated:** Few-shot examples should demonstrate the **pattern**, not provide content that overlaps with the actual input. When example content matches input content, the model conflates style with substance.

### Secondary cause: No explicit subject grounding

The user prompt provided a section map and transcript but never explicitly stated "this transcript is about crows." The model inferred the subject but wasn't anchored to it, making it easy to drift when the few-shot examples created content confusion.

### Changes Made (v3.2)

| File | Change |
|------|--------|
| `prompts.ts` — few-shot examples | Replaced all crow-specific examples with spider and octopus examples from the reference scripts. Examples now demonstrate the style pattern without overlapping any specific transcript's content. |
| `prompts.ts` — `buildRepurposeUserPrompt()` | Added explicit `SUBJECT:` line extracted from section titles. "This transcript is about [subject]. Your hook, every section, and your closing must be about THIS subject." |
| `prompts.ts` — `buildRepurposeUserPrompt()` | Strengthened HOOK requirement: "If the transcript is about crows, your assumption must be about crows. Do NOT introduce a different animal." |
| `prompts.ts` — `buildHooksUserPrompt()` | Added "The hooks must be about the SAME subject as the original" and "do not introduce different animals or topics" |
| `prompts.ts` — `buildHooksUserPrompt()` | Strengthened each-hook requirements: "about the SPECIFIC subject in the original hook (not the broader category)" |

### Principle

Few-shot examples should use **different content** from the expected input to cleanly separate style demonstration from content generation. Spider/octopus examples teach the voice; the model applies that voice to whatever transcript it receives (crows, sharks, jellyfish, etc.) without content contamination.

---

## 2026-03-05 — Initial Audit

### Test Script
- **Subject:** Crow intelligence (single-subject)
- **Source:** YouTube transcript (~3,500 words)
- **Model:** Via OpenRouter (Gemini)

### Output Assessment vs Style Guide

| Dimension | Rating | Issue |
|-----------|--------|-------|
| Information quality | PASS | Good facts, escalation, studies cited |
| Hook style | **FAIL** | No "assumption demolition", no personal framing, no "I thought X was simple..." |
| Narrative voice (POV) | **FAIL** | Third-person throughout. Guide requires first-person experiential journey |
| Signature phrases | **FAIL** | Almost zero: no "Here's what surprised me", "But here's the thing", "The deeper I went" |
| Sentence rhythm | WEAK | Too uniform. Missing punchy fragments, impact statements, short/long alternation |
| Casualness markers | **FAIL** | No "Like,", "Yep,", "Well," — reads too formal |
| Mystery mechanics | WEAK | Questions asked but answered immediately, no open loops held across sections |
| Closing | **FAIL** | Ends with sponsor plug. No philosophical elevation, no callback to opening |
| Structural template | WEAK | No clear section breaks matching hook/intro/body/outro word counts |

### Root Cause Analysis

**Problem 1: System prompt buries voice instructions inside a massive JSON blob**

The style profile is ~200 lines of JSON dumped into the system prompt. The model sees it but doesn't prioritize the voice/POV instructions because they're nested deep inside structured data with equal weight given to every field. The most critical style elements (first-person voice, signature phrases, hook technique) get lost in noise.

**Gemini best practice violated:** "Be direct and specific — no vague instructions." A JSON blob is the opposite of direct. The model needs explicit, top-level instructions about voice, not buried JSON properties.

**Problem 2: Few-shot examples don't demonstrate the voice transformation**

Current examples show:
- Input: raw transcript paragraph
- Output: slightly cleaner version of the same paragraph

They demonstrate paraphrasing, not the full voice transformation. The examples don't show:
- Third-person input becoming first-person output
- Flat narration becoming "Here's what surprised me..." personal discovery
- Missing signature phrases being injected
- Missing casualness markers being added

**Gemini best practice violated:** "Using examples to show the model a pattern to follow is more effective than using examples to show an anti-pattern to avoid." Our examples show a mild paraphrase pattern, not the dramatic voice transformation we actually want.

**Problem 3: User prompt says "maintain each section's purpose and approximate word count" — nothing about voice**

The repurpose user prompt's final instruction is: "Repurpose this entire transcript following the style profile and structural template. Maintain each section's purpose and approximate word count."

This tells the model to preserve structure and length. It says nothing about transforming the voice. The task instruction (which Gemini docs say should be LAST and most prominent) is focused on the wrong thing.

**Gemini best practice violated:** "Put your query/question at the end of the prompt." The final instruction anchors what the model optimizes for. Ours anchors on structure, not style.

**Problem 4: No explicit "DO" list for the voice**

The system prompt has a CRITICAL RULES section, but it's all negative constraints: don't use em dashes, don't use semicolons, don't use AI phrases. There's no positive "DO" list telling the model the specific voice moves it MUST make.

**Gemini best practice violated:** "Use positive patterns only — show what you want, not what to avoid."

---

## 2026-03-05 — v2 Implementation (completed)

Implemented all planned v2 changes from initial audit:
- Extracted voice rules from JSON blob to top-level system instructions
- Added few-shot examples (2 per script type) showing voice transformation
- Rewrote final task instruction to anchor on "first-person discovery narrative"
- Trimmed JSON profile via `trimProfileForPrompt()` to reduce noise
- Added VOICE ANTI-PATTERNS section

**Result:** Partial improvement. Model follows some voice rules but still fails on hook structure, emotional escalation, closing, and open loops. See v3 below.

---

## 2026-03-05 — v3 Changes (style adherence fixes)

### Test Results (v2 prompt, crow intelligence transcript)

The crow transcript was repurposed and evaluated against the Individual Animal style profile. Despite v2 improvements, the output still failed on:

| Dimension | v2 Rating | Issue |
|-----------|-----------|-------|
| Hook style | **FAIL** | Opened with broad animal intelligence survey instead of personal assumption about crows |
| First-person voice | WEAK | Some "I" usage but still reads like third-person documentary in many sections |
| Emotional escalation | **FAIL** | Same register throughout, no build from curiosity to astonishment to wonder |
| Open loops | **FAIL** | Questions asked and answered immediately, no tension held across sections |
| Closing | **FAIL** | Ended with sponsor plug instead of philosophical elevation |
| Sentence rhythm | WEAK | Still too uniform, not enough punchy fragments |
| Signature phrase density | WEAK | Present but sparse |

### Root Cause Analysis (v3)

**Problem 1: Reasoning effort too low**

`service.ts` uses `reasoning: { effort: 'low' }` for both single-pass and chunked repurposing. Voice transformation is a cognitively complex task — it requires analyzing the original structure and actively reshaping it, not just paraphrasing. Low reasoning causes the model to take the path of least resistance (follow original structure closely).

**Fix:** Raised to `reasoning: { effort: 'high' }`. Voice transformation requires deep reasoning about structure, tone, and narrative arc — the model needs maximum thinking budget to properly reshape third-person exposition into first-person discovery.

**Problem 2: No few-shot example of hook transformation**

The v2 examples show paragraph-level voice changes but not the most critical transformation: converting a broad topic survey opening into assumption-demolition hook. The model sees the original hook's structure and follows it.

**Fix:** Added a third few-shot example specifically showing `broad survey opening → personal assumption demolition`. Also added an example showing `sponsor/ad section → philosophical elevation`.

**Problem 3: Voice rules too vague on key mechanics**

"Plant questions early" doesn't explain HOW. "End with philosophical elevation" doesn't address sponsor sections. "Write in first person" doesn't address the specific transformation FROM third person.

**Fixes applied:**
- Voice rule #1: Added "If the original uses 'we' or third-person narration, TRANSFORM it into 'I'"
- Voice rule #3: Added density target "at least one every 200-300 words"
- Voice rule #6: Expanded with "Do NOT survey the broader topic category first"
- Voice rule #7: Replaced vague "create open loops" with concrete mechanic and example
- Voice rule #8: NEW — explicit emotional escalation instruction across the full script
- Voice rule #9: NEW — callback to opening assumption in closing
- Voice rule #10: NEW — explicit sponsor/CTA replacement instruction
- Anti-pattern: Added "NEVER maintain the same emotional register throughout"
- Anti-pattern: Added "NEVER list facts without personal reaction" with concrete example

**Problem 4: Chunk prompts have no section-type awareness**

When processing in chunks, every section gets the same generic instruction. The hook section needs different emphasis than the closing section.

**Fix:** Added `getSectionVoiceGuidance()` helper that provides section-type-specific voice direction:
- Hook: enforces assumption demolition, prohibits broad surveys
- Intro: enforces open loop planting and transitional revelation
- Body (early): "growing curiosity and surprise" framing
- Body (late): "genuine astonishment" escalation language
- Outro: enforces philosophical elevation, sponsor replacement, callback to opening

**Problem 5: User prompt task instruction not specific enough**

The final task instruction (which Gemini optimizes for) was a single paragraph. Restructured into a KEY REQUIREMENTS checklist that explicitly addresses each failure mode: hook, voice, rhythm, open loops, escalation, closing.

### Changes Made (v3)

| File | Change |
|------|--------|
| `src/lib/repurpose/prompts.ts` | Expanded VOICE RULES from 8 to 10 items with concrete mechanics |
| `src/lib/repurpose/prompts.ts` | Added 2 new VOICE ANTI-PATTERNS (emotional register, fact listing) |
| `src/lib/repurpose/prompts.ts` | Added 3rd few-shot example: sponsor section → philosophical elevation |
| `src/lib/repurpose/prompts.ts` | Rewrote 1st few-shot example: broad survey hook → personal assumption hook |
| `src/lib/repurpose/prompts.ts` | Added descriptions to each few-shot example for clarity |
| `src/lib/repurpose/prompts.ts` | Restructured user prompt task instruction into KEY REQUIREMENTS checklist |
| `src/lib/repurpose/prompts.ts` | Added `getSectionVoiceGuidance()` for section-type-specific chunk prompts |
| `src/lib/repurpose/service.ts` | Changed reasoning effort from `'low'` to `'high'` (single-pass + chunked) |

### Metrics to Re-evaluate

Run the same crow transcript through v3 and check:
1. First-person "I" count (target: 10+ per 1000 words)
2. Signature phrase count (target: 5+ per 1000 words)
3. Casualness marker count (target: 3+ per 1000 words)
4. Hook follows assumption-demolition pattern (yes/no)
5. Hook opens with specific subject, NOT broad topic survey (yes/no)
6. Closing has philosophical elevation without recap (yes/no)
7. Sponsor content replaced with philosophical reflection (yes/no)
8. Open loops present (questions planted early, answered later) (count)
9. Emotional escalation detectable across sections (yes/no)

---

## Historical: Planned Changes (v2, now implemented)

### Change 1: Extract critical voice rules from JSON into top-level system instructions

Instead of relying on the model to parse voice rules from a 200-line JSON blob, add explicit voice rules at the top of the system prompt:

```
VOICE RULES (non-negotiable):
1. Write in FIRST PERSON — "I discovered", "What surprised me", "I didn't expect"
2. You are a curious investigator sharing your research journey, NOT a narrator
3. Use these signature phrases naturally throughout:
   - "Here's what surprised me..."
   - "But here's the thing..."
   - "And here's where it gets [adjective]..."
   - "What I didn't expect..."
   - "The deeper I went..."
   - "It turns out..."
4. Mix sentence lengths: short punchy impact lines between longer explanations
5. Use casual conversational markers: "Like,", "Yep,", "Well,"
6. Open with assumption demolition: "I thought X was simple... then I discovered..."
7. Plant questions early, answer them 2-3 sections later (open loops)
```

**Why:** Direct instructions at the top of the system prompt get more weight than nested JSON properties. The JSON profile stays for reference, but the critical voice elements are promoted to explicit rules.

### Change 2: Rewrite few-shot examples to show voice transformation

Replace current examples (mild paraphrasing) with examples that demonstrate the actual transformation we want:

```
<input>
In the animal kingdom intelligence has evolved in many different ways.
We often think of primates at the top of the list. Orcas are also
intelligent with their language skills. But one of the smartest animals
is unexpected — a bird called the crow.
</input>
<output>
I always assumed intelligence belonged to the usual suspects. Primates
using tools. Orcas coordinating hunts. Dogs reading human emotions.
But the deeper I looked into animal cognition, the more one creature
kept showing up in places it shouldn't. Not a mammal. Not even close.
A bird. And here's where it gets strange — this bird might be smarter
than most primates.
</output>
```

**Why:** The model needs to see the before/after of third-person-to-first-person, flat-to-punchy, no-markers-to-signature-phrases. Show, don't tell.

### Change 3: Rewrite the final task instruction to anchor on voice

Change from:
```
Repurpose this entire transcript following the style profile and
structural template. Maintain each section's purpose and approximate
word count. Return ONLY the repurposed script text.
```

To:
```
Repurpose this transcript into a first-person discovery narrative.
You are sharing your research journey with the viewer. Transform flat
narration into personal revelation. Use the signature phrases,
conversational markers, and sentence rhythm from the style profile.
Maintain each section's purpose and approximate word count. Return
ONLY the repurposed script text.
```

**Why:** The last instruction is what Gemini optimizes for. "First-person discovery narrative" anchors the correct output.

### Change 4: Trim the JSON profile to reduce noise

The full JSON profile is ~200 lines. Many fields describe abstract concepts ("mystery_mechanics.paradox_presentation") that the model interprets inconsistently. Consider:
- Keep: tone_of_voice, hook_style, sentence_style, rhetorical_devices, structural_template
- Remove or condense: philosophical_elevation, cinematic_qualities, credibility_building, viewer_transformation (these are abstract meta-descriptions that don't translate to concrete writing moves)

**Why:** Gemini docs say "Do not use overly complex single prompts." A shorter, more focused profile reduces noise and lets the critical voice rules dominate.

### Change 5: Add a "DO NOT" voice section

```
VOICE ANTI-PATTERNS (never do these):
- Never write in third-person narrator voice ("Crows are intelligent animals...")
- Never write like a textbook or Wikipedia article
- Never list facts without personal reaction or framing
- Never use passive academic constructions ("It has been observed that...")
```

**Why:** The model needs both positive and negative voice guidance. Current negatives are about punctuation (em dashes, semicolons). These new negatives are about voice.

---

## Metrics to Track

For each test run, evaluate:
1. First-person "I" count (target: 10+ per 1000 words)
2. Signature phrase count (target: 5+ per 1000 words)
3. Casualness marker count (target: 3+ per 1000 words)
4. Hook follows assumption-demolition pattern (yes/no)
5. Closing has philosophical elevation without recap (yes/no)
6. Open loops present (questions planted early, answered later) (count)
