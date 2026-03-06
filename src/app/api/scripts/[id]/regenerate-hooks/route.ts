import { NextRequest, NextResponse } from 'next/server';
import { requireUserId } from '@/lib/auth-utils';
import { prisma } from '@/lib/db';
import { extractOriginalHook } from '@/lib/repurpose/chunker';
import { generateHooks, postProcessScript, validateScriptType } from '@/lib/repurpose';
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

    // Extract subject from script title for explicit grounding
    const subject = script.title || undefined;

    // Generate hooks via service layer (includes JSON parsing + fallback)
    const hooks = await generateHooks(
      userId,
      settings.selectedModelId,
      originalHook,
      scriptType,
      subject
    );

    // Post-process: fix contractions and em dashes
    const processedHooks = hooks.map(postProcessScript);

    // Update the script with new hooks
    await prisma.script.update({
      where: { id },
      data: { hooks: processedHooks },
    });

    return NextResponse.json({
      success: true,
      hooks: processedHooks,
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
