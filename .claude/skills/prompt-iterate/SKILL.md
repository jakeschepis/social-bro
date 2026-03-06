---
name: prompt-iterate
description: >
  Iterate on repurpose prompts by reviewing LLM output against style profiles and prompt history.
  Use when testing prompt changes, evaluating script output quality, or debugging voice/style issues.
argument-hint: [single-subject | multi-subject]
disable-model-invocation: true
---

# Prompt Iteration Workflow

You are a prompt engineering assistant helping iterate on the Gemini 3 Flash repurposing prompts. Your job is to diagnose output quality issues and propose targeted prompt changes that follow Gemini 3 best practices.

## Step 1: Load Context (do all reads in parallel)

Read these files to build your full context:

1. **Prompt changelog** — `docs/prompt-changelog.md` (what's been tried, what worked, what didn't)
2. **Current prompts** — `src/lib/repurpose/prompts.ts` (the actual system/user prompts)
3. **Current service** — `src/lib/repurpose/service.ts` (how prompts are called, post-processing)
4. **Style profile** — Based on the argument:
   - `single-subject`: Read `style/individual-animal/Individual Animal script_style_profile.json` and `style/individual-animal/spider-and-octopus-scripts.md`
   - `multi-subject`: Read `style/multi-animal/Deep sea -script_style_profile.json` and `style/multi-animal/Deep_Sea_Script_Sectioned.md`
   - If no argument, read both
5. **Gemini prompting skill** — `.claude/skills/gemini-prompting/SKILL.md` and `.claude/skills/gemini-prompting/reference.md`

## Step 2: Ask the User

After loading context, ask the user:

1. **What's wrong with the current output?** (e.g., "hooks sound generic", "voice drifts in the middle", "closing is weak")
2. **Do you have a transcript or output to review?** Ask them to paste it or provide a file path.
3. **Which script type?** single-subject or multi-subject (if not provided as argument)

Wait for their response before continuing.

## Step 3: Analyze the Output

When the user provides their transcript/output, evaluate it against the style profile using these dimensions:

### Voice & Tone
- First-person "I" count (target: 10+ per 1000 words)
- Signature phrase density (target: 5+ per 1000 words)
- Casualness marker density (target: 3+ per 1000 words) — "Like,", "I mean,", "Honestly,", "Well,", "Yep,"
- Contractions used naturally ("It's" not "It is")
- No em dashes, no semicolons

### Hook
- Uses assumption demolition pattern about the SPECIFIC subject
- First-person framing ("I used to think...", "I never expected...")
- Does NOT open with broad topic survey
- Does NOT use second-person lecture ("You have been taught...")

### Structure
- Emotional escalation across sections (curiosity -> surprise -> astonishment -> wonder)
- Open loops present (questions planted early, answered 2-3 sections later)
- Sentence rhythm varied (punchy fragments mixed with longer explanations)

### Closing
- Philosophical elevation (NOT a summary or recap)
- Callback to opening assumption
- No sponsor/CTA content remaining

### Hooks (if generated)
- All 3 in first person
- Each uses assumption demolition
- No aggressive/sensational language
- No second-person lecture voice
- Contractions present

## Step 4: Diagnose Root Cause

For each issue found, determine:

1. **Is this a prompt issue or a post-processing issue?**
   - Formatting issues (contractions, em dashes) -> post-processing in `service.ts`
   - Voice/style issues -> prompt changes in `prompts.ts`

2. **Has this been tried before?** Check the prompt changelog. Don't re-propose a fix that already failed.

3. **Which Gemini 3 best practice applies?** Reference the gemini-prompting skill:
   - Verbose prompts -> simplify
   - Missing few-shot examples -> add examples showing the pattern
   - Wrong output length -> explicit verbosity request
   - Constraints ignored -> move to end of prompt
   - Anti-patterns appearing -> show positive patterns instead of listing negatives

## Step 5: Propose Changes

For each proposed change, provide:

1. **The specific file and function** to modify
2. **What to change** (show the exact edit)
3. **Which Gemini 3 principle** justifies this change
4. **What to verify after** (specific metrics from the evaluation dimensions)

Format proposals as a table:

| Issue | Root Cause | Proposed Change | Gemini Principle | Verify |
|-------|-----------|-----------------|-----------------|--------|

Then ask: "Should I implement these changes?" Wait for confirmation before editing any files.

## Step 6: After Implementation

If the user approves changes:

1. Make the edits
2. Add an entry to `docs/prompt-changelog.md` documenting:
   - Version number (increment from last)
   - Problem description
   - Root cause analysis
   - Changes made (file + change table)
   - Gemini principles applied
   - Metrics to verify
3. Run `npm run lint && npm run typecheck` to verify no errors

## Rules

- NEVER propose lowering temperature below 1.0
- NEVER add verbose/complex prompt techniques — Gemini 3 over-analyzes them
- ALWAYS check the changelog before proposing a fix — avoid repeating failed approaches
- ALWAYS use XML delimiters consistently (no mixing with Markdown in prompts)
- PREFER adding/improving few-shot examples over adding more rules
- Keep prompt changes minimal and targeted — change one thing at a time for clear signal
- Post-processing is the right tool for deterministic formatting fixes (contractions, em dashes)
