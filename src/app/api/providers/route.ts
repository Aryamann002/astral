import { NextResponse } from "next/server";
import { keyCount, poolStatus } from "@/lib/ai/keyPool";
import { modelChain } from "@/lib/ai/groq";

export const dynamic = "force-dynamic";

/**
 * Diagnostics for the key pool: which keys are live, which are cooling off and
 * why. Keys are masked to first and last four characters — enough to identify
 * one in the Groq console without exposing it.
 */
export async function GET() {
  const keys = poolStatus();

  return NextResponse.json({
    groq: {
      configured: keyCount() > 0,
      keyCount: keyCount(),
      available: keys.filter((k) => k.available).length,
      models: modelChain(),
      keys,
    },
    gateway: {
      configured: Boolean(
        process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN,
      ),
      model: process.env.ASTRAL_MODEL ?? "anthropic/claude-sonnet-4.5",
    },
    // Always available, so the chat endpoint can never fail outright.
    offlineFallback: true,
  });
}
