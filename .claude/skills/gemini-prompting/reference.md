# Gemini 3 Flash — Full Reference

## Model Lineup (March 2026)

| Model | Model ID | Input Tokens | Output Tokens | Default Thinking | Price (in/out per 1M) |
|-------|----------|-------------|---------------|-----------------|----------------------|
| **Gemini 3 Flash** | `gemini-3-flash-preview` | 1,048,576 (1M) | 65,536 (64K) | `high` | $0.50 / $3.00 |
| **Gemini 3.1 Flash-Lite** | `gemini-3.1-flash-lite-preview` | 1,048,576 (1M) | 65,536 (64K) | `minimal` | $0.25 / $1.50 |
| **Gemini 3.1 Flash Image** | `gemini-3.1-flash-image-preview` | 131,072 (128K) | 32,768 (32K) | — | $0.25 in |
| **Gemini 3.1 Pro** | `gemini-3.1-pro-preview` | 1,048,576 (1M) | 65,536 (64K) | `high` | $2.00 / $12.00 |

**Important:** There is no standalone `gemini-3.1-flash-preview`. The 3.1 Flash line has Flash-Lite (cost-optimized, high-volume) and Flash Image (image generation). The main Flash model remains `gemini-3-flash-preview`.

**For our use case (creative rescripting):** Use `gemini-3-flash-preview`. Flash-Lite is optimized for translation, transcription, and data extraction — not creative rewriting. Its `minimal` default thinking would regress style transformation quality.

### Knowledge Cutoff

All 3.x models: **January 2025**.

### Input Modalities

Text, code, images (up to 3,000/prompt), audio (~8.4 hrs), video (~45 min with audio), PDFs (up to 3,000 pages/file).

## Flash vs Pro

| Factor | Flash | Pro |
|--------|-------|-----|
| Speed | Faster | Slower |
| Cost | 4x cheaper | Higher |
| Complex reasoning | Good | Better |
| Creative rewriting | Sufficient | Marginal gain |
| Transcript rescripting | **Use Flash** | Overkill |

## Full GenerationConfig

```typescript
{
  temperature: 1.0,            // MUST be 1.0 for Gemini 3
  topP: 0.95,                  // nucleus sampling; controls diversity
  topK: 40,                    // limits vocabulary pool
  maxOutputTokens: 65536,      // 64K limit for Gemini 3 Flash
  stopSequences: [],           // tokens that halt generation
  candidateCount: 1,           // number of response variants
  responseMimeType: "text/plain", // or "application/json" for structured output
  responseJsonSchema: { ... }, // preferred param name (newer); "responseSchema" also works
  presencePenalty: 0.0,        // penalizes repeated topics
  frequencyPenalty: 0.0,       // penalizes repeated tokens (reduces word loops)
  seed: undefined,             // for reproducible outputs during testing

  // Gemini 3 only — controls reasoning depth vs speed/cost
  // Use thinkingLevel (NOT thinkingBudget which is legacy)
  thinkingConfig: {
    thinkingLevel: "high",     // "minimal" | "low" | "medium" | "high" (default for Flash)
  },
}
```

**Note:** Thinking tokens are separate from output tokens — they don't count against `maxOutputTokens`.

## Recommended Settings

### Rescripting (repurposeChunk)

```typescript
{
  temperature: 1.0,
  maxOutputTokens: 65536,       // 64K — full output capacity
  topP: 0.95,
  topK: 40,
  // thinkingLevel: "high" (default, no need to set explicitly)
}
```

### Hooks Generation (generateHooks)

```typescript
{
  temperature: 1.0,
  maxOutputTokens: 512,
  responseMimeType: "application/json",
  responseJsonSchema: {
    type: "array",
    items: {
      type: "string",
      description: "A single hook sentence, 1-2 sentences max",
    },
    minItems: 3,
    maxItems: 3,
  }
}
```

## Structured Output — JSON Schema Support

Supported JSON Schema features:
- Basic types: `string`, `number`, `integer`, `boolean`, `object`, `array`, `null`
- Constraints: `enum`, `minimum`, `maximum`, `minItems`, `maxItems`, `required`, `additionalProperties`
- Descriptors: `title`, `description` (use `description` to guide the model per property)
- Nullable: `{"type": ["string", "null"]}`

Use `responseJsonSchema` (preferred) over `responseSchema` (legacy).

**Limitations:** Very large or deeply nested schemas are rejected. Unsupported JSON Schema properties are silently ignored.

## Token Estimation

```
1 token ~ 4 characters ~ 0.75 words
100 tokens ~ 60-80 English words
30-min podcast transcript ~ 7,500 words ~ 10,000 tokens
65,536 output tokens ~ 49,000 words
```

### Usage Metadata (Response)

```typescript
response.usage_metadata = {
  prompt_token_count: 1200,
  candidates_token_count: 800,
  total_token_count: 2000,
  cached_content_token_count: 1724, // served from cache
  thoughts_token_count: 500,        // reasoning tokens (separate from output)
}
```

## Chunking Decision

```typescript
function estimateOutputWords(transcript: string): number {
  // Rescripting output is roughly 1:1 with input word count
  return transcript.split(/\s+/).length;
}

function needsChunking(transcript: string): boolean {
  const estimatedOutputWords = estimateOutputWords(transcript);
  // Gemini 3 Flash output limit: 65,536 tokens (~49,000 words)
  // Use 40,000 word threshold for safety margin
  return estimatedOutputWords > 40000;
}
```

## Long Context vs Chunking

From official docs:
> "Rather than chunking documents, the recommended paradigm is providing all relevant information upfront due to Gemini's robust in-context learning capabilities."

Gemini 3 Flash has a 1M token input window. Most YouTube transcripts fit in a single request.

Only chunk when:
- Estimated output would exceed ~40,000 words (safety margin against 65,536 token limit)
- You need precise per-section control
- Multi-needle retrieval is needed (accuracy drops; submit separate requests instead)

Chunking introduces: tone/style drift between chunks, continuity errors at boundaries, extra API calls/latency, extra cost.

## Context Caching

| Type | Setup | Guarantee |
|------|-------|-----------|
| Implicit | None (automatic since May 2025) | No guarantee of hits |
| Explicit | Manual via API | Guaranteed savings (~90% reduction) |

Cache candidates for this project (identical across all requests):
- System prompt (~200 tokens)
- Few-shot examples (~500 tokens)
- Style guide reference (~1,000 tokens)

| Model | Minimum Tokens |
|-------|---------------|
| Gemini 3 Flash | 1,024 |
| Gemini 3.1 Pro | 4,096 |

Default TTL: 1 hour. Configurable in seconds. Not available on free tier.

## Deprecation Notices

- `gemini-3-pro-preview` deprecated, shuts down **March 9, 2026** -> migrate to `gemini-3.1-pro-preview`
- `gemini-2.0-flash` and `gemini-2.0-flash-lite` deprecated, shut down **June 1, 2026**
- `thinking_budget` is legacy; use `thinking_level` instead
- No deprecation notices for `gemini-3-flash-preview`
