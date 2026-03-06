---
name: gemini-prompting
description: >
  Gemini 3 Flash prompting guide for transcript rescripting and hooks generation.
  Use when modifying repurpose service, prompts, chunking logic, hooks generation,
  or any Gemini API integration code in src/lib/repurpose/.
user-invocable: true
disable-model-invocation: false
---

# Gemini 3 Flash Prompting Guide

This skill contains prompting best practices and configuration rules for the Gemini 3 Flash model used in the transcript rescripting pipeline.

## Critical Rules

### Temperature MUST be 1.0

Google's official docs explicitly warn:
> "We strongly recommend keeping temperature at default 1.0. Setting it lower may cause looping or degraded performance, particularly in complex tasks."

This is a significant change from Gemini 2.5. Never set temperature below 1.0 for Gemini 3 Flash. This applies to both `repurposeChunk()` and `generateHooks()` in `src/lib/repurpose/service.ts`.

### Output Token Limit is 64K, Not 8K

Gemini 3 Flash supports **65,536 output tokens (~49,000 words)**. Previous docs referenced an 8,192 limit from Gemini 2.0 Flash — that is outdated. This means:
- Most YouTube transcripts (5,000-30,000 words) can be rescripted in a single request
- Chunking is only needed for extremely long transcripts
- Only chunk when the estimated **output** would exceed ~40,000 words (safety margin against the 49K word limit)

### Thinking Tokens are Separate

Thinking/reasoning tokens do NOT count against `maxOutputTokens`. They are tracked separately in `thoughts_token_count`.

### Structured Output for Hooks

Always use native `responseJsonSchema` with `responseMimeType: "application/json"` for hooks generation instead of parsing JSON from plain text responses. This guarantees valid JSON output without fragile regex/parse fallbacks.

### Few-Shot Examples are Required

From official docs:
> "We recommend to always include few-shot examples in your prompts. Prompts without few-shot examples are likely to be less effective."

Include 2-5 input/output pairs showing raw transcript -> repurposed style. Use positive patterns only (show desired output, not anti-patterns).

### Gemini 3 is Different From 2.5

> "Gemini 3 is a reasoning model, which changes how you should prompt."

Key behavioral differences:
- **Defaults to concise output** — you MUST explicitly request detail for long rescripts (e.g., "Write a comprehensive, detailed response")
- **Over-analyzes verbose prompts** — simplify elaborate techniques from older models
- **Prefers direct instructions** — less is more; let few-shot examples carry weight
- If you used chain-of-thought prompting, use `thinkingLevel: high` with simplified prompts instead

## Prompt Structure (Official Recommended Order)

1. Role / persona (system instruction)
2. Task description
3. Context / background information
4. Examples (few-shot)
5. Input to process
6. Output format specification
7. **Constraints at END** (Gemini 3 specific: `[Context] -> [Main task] -> [Constraints at end]`)

For long inputs like transcripts, put the query/instructions AFTER the content.

## Thinking / Reasoning Configuration

Gemini 3 uses `thinkingLevel`, NOT `thinkingBudget` (legacy, discouraged):

| Level | Best For |
|-------|----------|
| `minimal` | Simple tasks, high throughput |
| `low` | Chat, simple Q&A |
| `medium` | Moderate complexity |
| `high` | Complex creative tasks, rescripting (default for 3 Flash) |

Rules:
- Cannot mix `thinking_level` and `thinking_budget` in the same request (error)
- Thinking cannot be fully disabled — even `minimal` requires thought signatures
- OpenRouter maps `reasoning_effort` -> `thinking_level` automatically

## XML Delimiters

Use XML-style tags to separate prompt sections and prevent the model from confusing input vs. instruction text:

```
<previous_output>...</previous_output>
<transcript_to_repurpose>...</transcript_to_repurpose>
<instructions>...</instructions>
```

> "Don't mix XML and Markdown — choose one format for consistency."

## System Instructions Best Practices

- Define the role clearly at the top
- Place hard constraints (what NOT to do) in system instructions, not user prompts
- System instructions persist across the session — don't repeat them per chunk
- Add few-shot examples to the system prompt (in `src/lib/repurpose/prompts.ts`)
- For conversational/expressive output, assign a specific persona with clear style attributes
- If tone is wrong, **rephrase instructions** rather than adding more constraints

## Context Caching

The system prompt + few-shot examples + style guide are identical across every request (~1,700 tokens, exceeds 1,024 minimum for Flash). Cache these via Gemini's explicit caching API for cost savings. Default TTL: 1 hour. Not available on free tier.

## Deprecation Notices

- `gemini-3-pro-preview` deprecated, shuts down **March 9, 2026** -> migrate to `gemini-3.1-pro-preview`
- `gemini-2.0-flash` and `gemini-2.0-flash-lite` deprecated, shut down **June 1, 2026**
- `thinking_budget` is legacy; use `thinking_level` instead
- No deprecation notices for `gemini-3-flash-preview`

## Priority Checklist When Modifying Repurpose Code

1. Verify temperature is 1.0 (never lower for Gemini 3)
2. Verify few-shot examples exist in system prompt
3. Use `responseJsonSchema` for any JSON output (hooks)
4. Check if chunking is necessary (only when output > ~40,000 words)
5. Explicitly request detailed/comprehensive output for long rescripts
6. Use `thinkingLevel` not `thinkingBudget`
7. Keep prompts concise — Gemini 3 over-analyzes verbose techniques
8. Put constraints at the END of prompts
9. Consider context caching for repeated system prompts

For full generation config reference, see [reference.md](reference.md).
For prompt patterns and templates, see [examples.md](examples.md).
