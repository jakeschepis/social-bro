import { NextRequest, NextResponse } from 'next/server';
import { requireUserId } from '@/lib/auth-utils';
import { prisma } from '@/lib/db';
import { createChatCompletion } from '@/lib/openrouter';
import {
  buildHooksSystemPrompt,
  buildHooksUserPrompt,
  HOOKS_RESPONSE_FORMAT,
} from '@/lib/repurpose/prompts';
import { extractOriginalHook } from '@/lib/repurpose/chunker';
import { validateScriptType } from '@/lib/repurpose';
import { isApiError } from '@/lib/errors';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST - Regenerate hooks for a script
export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    const { id } = await params;

    // Rate limit expensive operations
    const rateLimit = checkRateLimit(`hooks:${userId}`, RATE_LIMITS.expensive);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }

    // Get the script
    const script = await prisma.script.findUnique({
      where: { id },
    });

    if (!script) {
      return NextResponse.json({ error: 'Script not found' }, { status: 404 });
    }

    if (script.userId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's selected model
    const settings = await prisma.userSettings.findUnique({
      where: { userId },
    });

    if (!settings?.selectedModelId) {
      return NextResponse.json(
        { error: 'No LLM model selected. Please select a model in Settings.' },
        { status: 400 }
      );
    }

    const scriptType = validateScriptType(script.scriptType);

    // Extract hook from repurposed script if available, otherwise fall back to original
    const originalHook = script.repurposedScript
      ? extractOriginalHook(script.repurposedScript)
      : extractOriginalHook(script.script);

    // Generate new hooks using style-aware prompts
    const response = await createChatCompletion({
      userId,
      model: settings.selectedModelId,
      messages: [
        { role: 'system', content: buildHooksSystemPrompt(scriptType) },
        { role: 'user', content: buildHooksUserPrompt(originalHook, scriptType) },
      ],
      response_format: HOOKS_RESPONSE_FORMAT,
    });

    const content = response.choices[0]?.message?.content || '{"hooks":[]}';

    let hooks: string[] = [];
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed.hooks)) {
        hooks = parsed.hooks.slice(0, 3);
      }
    } catch {
      const lines = content.split('\n').filter((line) => line.trim().length > 10);
      hooks = lines.slice(0, 3).map((line) => line.replace(/^[\d.\-*]+\s*/, '').trim());
    }

    // Update the script with new hooks
    await prisma.script.update({
      where: { id },
      data: { hooks },
    });

    return NextResponse.json({
      success: true,
      hooks,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (error.message.includes('No LLM model selected')) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }
    if (isApiError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Error regenerating hooks:', error);
    return NextResponse.json({ error: 'Failed to regenerate hooks' }, { status: 500 });
  }
}
