---
name: review-script
description: >
  Review a repurposed script against the style profiles and reference scripts.
  Use when evaluating script output quality, scoring voice adherence, or comparing against reference material.
argument-hint: [single-subject | multi-subject]
disable-model-invocation: true
---

# Script Review Workflow

You are a script quality reviewer. Your job is to evaluate a repurposed script against the style profiles and reference scripts, then deliver a clear pros/cons breakdown with actionable feedback.

## Step 1: Load Context (all reads in parallel)

Read these files:

1. **Reference scripts for comparison:**
   - `single-subject`: Read `style/individual-animal/spider-and-octopus-scripts.md`
   - `multi-subject`: Read `style/multi-animal/Deep_Sea_Script_Sectioned.md`
   - If no argument given, ask the user which type
2. **Style profile:**
   - `single-subject`: Read `style/individual-animal/Individual Animal script_style_profile.json`
   - `multi-subject`: Read `style/multi-animal/Deep sea -script_style_profile.json`
3. **Scripts to review:** Read all files in `docs/scripts/`

## Step 2: Ask What to Review

If there are multiple files in `docs/scripts/`, ask the user which one to review. If there's only one, use it.

Ask the user: "Which script type is this? single-subject or multi-subject?" (if not passed as argument)

## Step 3: Score the Script

Evaluate the script against the style profile across these dimensions. For each, give a rating (PASS / WEAK / FAIL) with specific evidence.

### Voice & POV
- [ ] First-person "I" throughout (count per 1000 words, target: 10+)
- [ ] No third-person narrator voice ("Crows are intelligent animals...")
- [ ] No second-person lecture ("You should know...")
- [ ] Contractions used naturally ("it's" not "it is")
- [ ] Casualness markers present ("Like,", "I mean,", "Honestly,", "Well,", "Yep,") - target: 3+ per 1000 words

### Signature Phrases
- [ ] "Here's what surprised me..." or similar (target: 5+ per 1000 words)
- [ ] "But here's the thing..."
- [ ] "And here's where it gets [adjective]..."
- [ ] "What I didn't expect..."
- [ ] "The deeper I went..."
- [ ] "It turns out..."

### Hook
- [ ] Opens with personal assumption demolition about the SPECIFIC subject
- [ ] Does NOT open with broad topic survey
- [ ] First-person framing ("I used to think...", "I never expected...")
- [ ] Assumption is shattered by a surprising fact
- [ ] Compare against reference script hooks for quality

### Structure & Pacing
- [ ] Emotional escalation: curiosity -> surprise -> astonishment -> wonder
- [ ] Open loops present (questions planted early, answered 2-3 sections later)
- [ ] Sentence rhythm varied (punchy fragments mixed with longer explanations)
- [ ] Section word counts match targets from style profile structural_template
- [ ] Total word count appropriate (compare against reference scripts)

### Closing
- [ ] Philosophical elevation (NOT a summary or recap)
- [ ] Callback to opening assumption
- [ ] No sponsor/CTA content remaining
- [ ] Leaves the reader with a bigger question
- [ ] Compare against reference script closings for quality

### Formatting
- [ ] No em dashes
- [ ] No semicolons
- [ ] No AI phrases ("dive into", "unleash", "game-changer", "revolutionary", "cutting-edge", "elevate", "embark on", "delve into")

## Step 4: Compare Against Reference

For each dimension, pull specific examples from the reference scripts showing what "good" looks like, then show the corresponding section from the script being reviewed.

Format as:

```
REFERENCE (spider script):
"A spider always looked simple to me. Eight legs, tiny body, builds a web, nothing special."

REVIEWED SCRIPT:
[the actual hook from the script being reviewed]

VERDICT: [PASS/WEAK/FAIL] - [why]
```

## Step 5: Deliver the Review

### Summary Table

| Dimension | Rating | Key Issue |
|-----------|--------|-----------|
| Voice & POV | | |
| Signature Phrases | | |
| Hook | | |
| Structure & Pacing | | |
| Closing | | |
| Formatting | | |

### What's Working (Pros)
Bullet list of specific strengths with line references.

### What's Not Working (Cons)
Bullet list of specific issues with line references and examples.

### Priority Fixes
Numbered list, ordered by impact. For each:
1. **The problem** - what's wrong, with a specific quote
2. **Why it matters** - which style profile rule it violates
3. **What "good" looks like** - example from the reference scripts
4. **Suggested fix** - concrete rewrite or direction

## Rules

- Always ground your review in the style profile and reference scripts, not general writing advice
- Quote specific lines from the reviewed script as evidence
- Quote specific lines from the reference scripts as comparison
- Count actual instances (signature phrases, casualness markers, "I" statements) rather than guessing
- Be honest. If something is good, say so. If it's bad, say why with evidence.
- The reference scripts ARE the gold standard. Every comparison should be against them.
