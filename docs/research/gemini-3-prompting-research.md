# Gemini 3 Flash — Prompting Research (March 2026)

Compiled from official Google documentation (ai.google.dev, cloud.google.com/vertex-ai).
Applied to transcript rescripting and hooks generation pipeline.

---

## 1. Model Specifications

### Current Model Lineup

| Model | Model ID | Input Tokens | Output Tokens | Default Thinking | Price (in/out per 1M) |
|-------|----------|-------------|---------------|-----------------|----------------------|
| **Gemini 3 Flash** | `gemini-3-flash-preview` | 1,048,576 (1M) | 65,536 (64K) | `high` | $0.50 / $3.00 |
| **Gemini 3.1 Flash-Lite** | `gemini-3.1-flash-lite-preview` | 1,048,576 (1M) | 65,536 (64K) | `minimal` | $0.25 / $1.50 |
| **Gemini 3.1 Flash Image** | `gemini-3.1-flash-image-preview` | 131,072 (128K) | 32,768 (32K) | — | $0.25 in |
| **Gemini 3.1 Pro** | `gemini-3.1-pro-preview` | 1,048,576 (1M) | 65,536 (64K) | `high` | $2.00 / $12.00 |

**Important:** There is no standalone `gemini-3.1-flash-preview`. The 3.1 Flash line has Flash-Lite (cost-optimized, high-volume) and Flash Image (image generation). The main Flash model remains `gemini-3-flash-preview`.

**For our use case (creative rescripting):** Use `gemini-3-flash-preview`. Flash-Lite is optimized for translation, transcription, and data extraction — not creative rewriting. Its `minimal` default thinking would regress our style transformation quality.

### Output Token Limit: 64K, Not 8K

Previous docs referenced an 8,192 output limit from Gemini 2.0 Flash. **Gemini 3 Flash supports 65,536 output tokens (~49,000 words).** This means:
- Most YouTube transcripts (5,000–30,000 words) can be rescripted in a single request
- Chunking is only needed for extremely long transcripts (50,000+ words)
- Our current chunking threshold of 6,000 words is overly conservative

### Knowledge Cutoff

All 3.x models: **January 2025**.

### Input Modalities

Text, code, images (up to 3,000/prompt), audio (~8.4 hrs), video (~45 min with audio), PDFs (up to 3,000 pages/file).

---

## 2. Temperature — MUST Be 1.0

From official docs:

> "We strongly recommend keeping temperature at default 1.0. Setting it lower may cause looping or degraded performance, particularly in complex tasks."

This is a **significant change from Gemini 2.5** where lower temperatures were common. For Gemini 3, the model's reasoning is optimized for temperature 1.0. Deviating can cause infinite reasoning loops.

**Migration guidance:** Remove explicit temperature parameters and rely on the default.

---

## 3. Thinking / Reasoning Configuration

### Gemini 3 Uses `thinkingLevel`, Not `thinkingBudget`

| Level | Description | Best For |
|-------|-------------|----------|
| `minimal` | Minimum reasoning, lowest latency | Simple tasks, high throughput |
| `low` | Light reasoning | Chat, simple Q&A |
| `medium` | Balanced | Moderate complexity |
| `high` | Maximum reasoning depth (default for 3 Flash) | Complex creative tasks, rescripting |

**Rules:**
- Cannot mix `thinking_level` and `thinking_budget` in the same request (error)
- `thinking_budget` accepted for backwards compatibility but discouraged
- Thinking cannot be fully disabled — even `minimal` requires thought signatures
- Thinking tokens are **separate from output tokens** — they don't count against `maxOutputTokens`
- OpenRouter maps `reasoning_effort` → `thinking_level` automatically

### Thought Signatures

Gemini 3 returns encrypted reasoning representations. For multi-turn conversations, these must be passed back to maintain reasoning context. Official SDKs handle this automatically.

---

## 4. Prompt Engineering Best Practices

### 4.1 Gemini 3 Is Different From 2.5

> "Gemini 3 is a reasoning model, which changes how you should prompt."

> "By default, Gemini 3 is less verbose and prefers providing direct, efficient answers."

> "Be concise in your input prompts. Gemini 3 responds best to direct, clear instructions and may over-analyze verbose or overly complex prompt engineering techniques used for older models."

**Key migration changes:**
- Simplify prompts — elaborate techniques from older models should be removed
- If you used chain-of-thought prompting, try `thinking_level: high` with simplified prompts instead
- For longer output, you must **explicitly request detail** — Gemini 3 defaults to concise

### 4.2 System Instructions

> "Place essential behavioral constraints, role definitions (persona), and output format requirements in the System Instruction or at the very beginning of the user prompt."

System instructions go in `system_instruction` parameter and persist across all turns:
- Role/persona definition
- Behavioral constraints (tone rules, what to avoid)
- Output formatting rules
- Few-shot examples

The user prompt should contain:
- The specific task
- Input data / source material
- Turn-specific context

### 4.3 Prompt Structure — Official Recommended Order

From Vertex AI documentation:

1. **Objective** — What the model should achieve
2. **System instructions** — Technical/environmental directives
3. **Persona/Role** — Who the model is acting as
4. **Constraints** — Restrictions and guardrails
5. **Context** — Background information
6. **Tone** — Response style specification
7. **Few-shot examples** — Input/output demonstrations
8. **Response format** — Desired output structure
9. **Recap** — Reinforce key constraints (optional)
10. **Input data / question** — The actual content to process

**For long inputs (transcripts):** Supply all context first, place instructions at the very end.

**Gemini 3 specific structure:** `[Context] -> [Main task] -> [Negative/formatting/quantitative constraints at end]`

### 4.4 Few-Shot Examples

> "We recommend to always include few-shot examples in your prompts. Prompts without few-shot examples are likely to be less effective."

**How many:** 2–5 examples. Start with 2–3 and iterate. Too many causes overfitting.

**Formatting:**
> "Ensure a consistent format across all examples, especially paying attention to XML tags, white spaces, newlines, and example splitters."

**Positive patterns only:**
> "Using examples to show the model a pattern to follow is more effective than using examples to show the model an anti-pattern to avoid."

**Prefixes:**
> "Adding prefixes to the examples provides labels that the model can use when generating the output."

Use labeled pairs (`Input:` / `Output:`) consistently across all examples.

**Critical rule:** Always accompany few-shot examples with clear instructions. Without them, "models might pick up on unintended patterns or relationships."

### 4.5 Output Length Control

**API-level:**
- `maxOutputTokens` — Hard cap (up to 65,536 for Gemini 3 Flash)
- `stopSequences` — Strings that halt generation

**Prompt-level for longer output (critical for rescripting):**
- Gemini 3 defaults to concise. You MUST explicitly request detail.
- Use instructions like "Write a comprehensive, detailed response"
- Place quantitative constraints at the end: "The response should be at least 2000 words"
- Use completion-based framing: provide a partial output to establish length expectations

**Prompt-level for shorter output:**
- "Summarize in one sentence"
- "Respond in exactly 3 bullet points"
- "IMPORTANT: Respond only with the following structure. Do not explain your answer."

### 4.6 Style and Tone Control

> "The model is designed to treat the persona it is assigned seriously."

- Assign a specific persona with clear style attributes
- Define vocabulary level, voice characteristics, formality
- For conversational/expressive output: "Explain this as a friendly, talkative assistant"
- Avoid corporate jargon, ensure authentic human voice
- If tone is wrong, **rephrase instructions** rather than adding more constraints

### 4.7 Rewriting Techniques

**Completion input framing:** Provide partial output to anchor tone and format. More reliable than instructions alone.

**Entity input framing:** Separate source text from instructions with clear delimiters:
```xml
<original_transcript>
{source text}
</original_transcript>

<task>
Rewrite the transcript above...
</task>
```

**Grounding for factual preservation:**
> "Treat the provided context as the absolute limit of truth; any facts or details not directly mentioned must be considered completely unsupported."

### 4.8 XML Delimiters

> "Employ clear delimiters to separate different parts of your prompt. XML-style tags or Markdown headings are effective, and you should choose one format and use it consistently within a single prompt."

> "Don't mix XML or Markdown, choose one format for consistency."

Recommended tags: `<role>`, `<constraints>`, `<context>`, `<task>`, `<instructions>`, `<examples>`

### 4.9 What to Avoid

1. **Verbose prompts** — Gemini 3 "may over-analyze verbose or overly complex prompt engineering techniques"
2. **Anti-pattern examples** — Show desired output, not what to avoid
3. **Emotional appeals, flattery** — Remove manipulation from prompts
4. **Conflicting/redundant constraints** — Leads to unpredictable behavior
5. **Temperature below 1.0** — Causes looping on Gemini 3
6. **Mixing delimiter formats** — Don't combine XML and Markdown
7. **Constraints mid-prompt** — Put at top (system) or end, not buried in middle
8. **Too many cognitive actions** — Break complex multi-step tasks into separate prompts
9. **Inconsistent few-shot formatting** — Leads to unpredictable output formats
10. **Assuming factual accuracy** — Only use model for style/rewriting

---

## 5. Structured Output

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `responseMimeType` | `string` | Set to `"application/json"` for JSON output |
| `responseJsonSchema` | `object` | Standard JSON Schema (preferred, newer) |
| `responseSchema` | `Schema` | Gemini-native schema (older approach) |

### Supported Schema Features

Types: `string`, `number`, `integer`, `boolean`, `object`, `array`, `null`

Constraints: `enum`, `minimum`, `maximum`, `minItems`, `maxItems`, `required`, `additionalProperties`

Descriptors: `title`, `description` (use `description` to guide model per property)

Nullable: `{"type": ["string", "null"]}`

### Limitations

- Very large or deeply nested schemas are rejected
- Unsupported JSON Schema properties are silently ignored
- Works with tools (Search, URL Context, Code Execution, Function Calling) on Gemini 3

---

## 6. Context Caching

### Explicit vs Implicit

| Type | Setup | Guarantee |
|------|-------|-----------|
| Implicit | None (automatic since May 2025) | No guarantee of hits |
| Explicit | Manual via API | Guaranteed savings (~90% reduction) |

### Minimum Tokens

| Model | Minimum |
|-------|---------|
| Gemini 3 Flash | 1,024 |
| Gemini 3.1 Pro | 4,096 |

### TTL

Default: 1 hour. Configurable in seconds. Can be updated after creation.

### Our Caching Candidate

System prompt + few-shot examples + style profile are identical across every request (~1,700 tokens). This exceeds the 1,024 minimum for Flash. Cache once, reuse across all repurpose jobs.

**Not available on free tier.**

---

## 7. Long Context

### The Key Finding

> "Rather than chunking documents, the recommended paradigm is providing all relevant information upfront due to Gemini's robust in-context learning capabilities."

Gemini 3 Flash has a 1M token input window. Most YouTube transcripts fit in a single request.

### When to Chunk

- When **output** exceeds 65,536 tokens (~49,000 words) — unlikely for video transcripts
- When precise per-section control is needed
- When searching for multiple discrete pieces of information (accuracy drops for multi-needle retrieval)

### Best Practices

- Place query at the end, after all supporting material
- Use context caching for repeated queries against the same content
- Single-needle retrieval: up to 99% accuracy
- Multi-needle: submit separate requests for each lookup

---

## 8. Token Estimation

```
1 token ~ 4 characters ~ 0.75 words
100 tokens ~ 60-80 English words
30-min podcast transcript ~ 7,500 words ~ 10,000 tokens
```

### Usage Metadata (Response)

- `prompt_token_count` — input tokens
- `candidates_token_count` — output tokens
- `total_token_count` — combined
- `cached_content_token_count` — cached portion
- `thoughts_token_count` — reasoning tokens (separate from output)

---

## 9. Deprecation Notices

- `gemini-3-pro-preview` deprecated, shuts down **March 9, 2026** → migrate to `gemini-3.1-pro-preview`
- `gemini-2.0-flash` and `gemini-2.0-flash-lite` deprecated, shut down **June 1, 2026**
- `thinking_budget` is legacy; use `thinking_level` instead
- No deprecation notices for `gemini-3-flash-preview`

---

## 10. Applied Recommendations for This Codebase

### Immediate Actions

1. **Update chunking threshold** — Output limit is 64K tokens, not 8K. Current 6,000-word threshold is too conservative. Can safely process transcripts up to ~40,000 words in a single request.

2. **Simplify the system prompt** — Gemini 3 docs warn against verbose/complex prompts. Our system prompt has grown to ~2,000 tokens with 10 voice rules, 6 anti-patterns, 8 critical rules, 3 few-shot examples, and a trimmed style profile. Consider consolidating.

3. **Move quantitative constraints to end** — Gemini 3 recommends: `[Context] -> [Main task] -> [Constraints at end]`. Our word count and formatting rules should be at the end of the user prompt, not in the system prompt.

4. **Explicitly request verbosity** — Gemini 3 defaults to concise. For 2000+ word scripts, we need stronger length instructions. "Write a comprehensive, detailed response" in addition to word count targets.

5. **Consider context caching** — System prompt + examples + style profile are identical across requests. Caching would save ~90% on those tokens.

### Potential Simplification

The Gemini 3 docs say "may over-analyze verbose or overly complex prompt engineering techniques." Our prompt has grown across v2-v3.3. Potential simplification:
- Merge VOICE RULES and VOICE ANTI-PATTERNS into a single concise section
- Reduce from 10 rules to 5-6 most impactful ones
- Let few-shot examples carry more weight (the docs say examples > rules)
- Remove redundant instructions between system and user prompts

---

## Sources

- [Gemini API Models](https://ai.google.dev/gemini-api/docs/models)
- [Gemini 3 Developer Guide](https://ai.google.dev/gemini-api/docs/gemini-3)
- [Prompt Design Strategies](https://ai.google.dev/gemini-api/docs/prompting-strategies)
- [System Instructions](https://ai.google.dev/gemini-api/docs/system-instructions)
- [Structured Output](https://ai.google.dev/gemini-api/docs/structured-output)
- [Context Caching](https://ai.google.dev/gemini-api/docs/caching)
- [Long Context](https://ai.google.dev/gemini-api/docs/long-context)
- [Thinking / Reasoning](https://ai.google.dev/gemini-api/docs/thinking)
- [Tokens](https://ai.google.dev/gemini-api/docs/tokens)
- [Gemini 3 Prompting Guide (Vertex AI)](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/start/gemini-3-prompting-guide)
- [Prompt Structure (Vertex AI)](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/prompts/structure-prompts)
- [Gemini API Pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Gemini API Changelog](https://ai.google.dev/gemini-api/docs/changelog)
