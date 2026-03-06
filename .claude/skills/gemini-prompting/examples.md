# Prompt Patterns & Templates

## Few-Shot Example Format

Include 2-5 pairs in the system prompt. Use consistent labels and positive patterns only.

```
EXAMPLE INPUT:
"So today we're gonna be talking about the three biggest mistakes people make when they're trying to build muscle."

EXAMPLE OUTPUT:
"Three mistakes are quietly killing your muscle gains, and most people have no idea they're making them."
```

```
EXAMPLE INPUT:
"And the reason why that matters is because if you don't get enough sleep, your body can't recover properly."

EXAMPLE OUTPUT:
"Without enough sleep, your body never fully recovers -- and everything else you're doing in the gym starts to fall apart."
```

Key rules for few-shot examples:
- 2-5 examples is optimal (too many causes overfitting)
- Keep formatting consistent across all examples
- Use examples from actual reference scripts (style guide)
- Show desired patterns only, never anti-patterns
- Always accompany examples with clear instructions (without them, "models might pick up on unintended patterns")

## XML Delimiter Pattern

Use XML tags to clearly separate sections. **Do not mix XML and Markdown** — choose one format and be consistent.

Recommended tags: `<role>`, `<constraints>`, `<context>`, `<task>`, `<instructions>`, `<examples>`

```
<context>
This is a continuation from the previous section.
</context>

<previous_output>
{previousContext}
</previous_output>

<transcript_to_repurpose>
{chunk}
</transcript_to_repurpose>

<instructions>
Rewrite the transcript section above...
</instructions>
```

## Completion Input Framing

Provide the beginning of the desired output to anchor tone and format:

```
Original: "So today we're gonna walk you through the top three mistakes..."
Start your rewrite here: "Three mistakes are silently..."
```

More reliable than open-ended instructions alone for controlling style.

## Entity Input Framing

Explicitly label source text as a named entity, separate from instructions:

```
<original_transcript>
{chunk}
</original_transcript>

<task>
Rewrite the transcript above in different words while preserving the original meaning and structure.
</task>
```

Prevents the model from blending transcript content with instruction text.

## Prefix Pairs for Few-Shot

Use consistent labels across all input/output pairs:

```
Input: "So basically what happens is..."
Rewritten: "Here's what actually occurs..."

Input: "And the reason why that matters is..."
Rewritten: "That matters because..."
```

## Prompt Chaining (Complex Rescripts)

For long transcripts where single-pass rescripting causes style drift, decompose into two steps:

1. **Extract key points** from the transcript
2. **Rewrite from those points** in the target style

This maintains consistent tone across longer content.

## Explicit Verbosity for Long Output

Gemini 3 defaults to concise responses. For rescripting, you MUST explicitly request detail:

```
<instructions>
Write a comprehensive, detailed rewrite of the transcript above.
Maintain the full depth and nuance of the original content.
The response should be at least {wordCount} words.
</instructions>
```

Place quantitative constraints (word count, length requirements) at the END of the prompt — this is a Gemini 3 specific best practice.

## Structured Output for Hooks (JSON Schema)

Instead of asking for JSON in plain text and parsing with regex:

```typescript
// Use native structured output
generationConfig: {
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

This guarantees valid JSON — no parsing fallbacks needed.

## What to Avoid in Prompts

- Do not use temperature below 1.0 (causes looping on Gemini 3)
- Do not use verbose or overly complex prompt engineering techniques (Gemini 3 over-analyzes them)
- Do not rely on the model for factual accuracy (only style/rewriting)
- Do not use inconsistent formatting across few-shot examples
- Do not use negative-only examples (show desired pattern, not just forbidden ones)
- Do not mix XML and Markdown delimiters in the same prompt
- Do not bury constraints mid-prompt — put at top (system) or end
- Do not assume implicit requirements — state everything explicitly
- Do not repeat system instructions in each chunk prompt (they persist across the session)
- Do not use emotional appeals or flattery in prompts
