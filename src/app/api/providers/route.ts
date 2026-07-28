import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { keyCount, poolStatus } from "@/lib/ai/keyPool";
import { modelChain } from "@/lib/ai/groq";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const RATE_LIMIT = { name: "providers", limit: 30, windowMs: 60_000 };

function matches(supplied: string, expected: string) {
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on a length mismatch, and the lengths themselves
  // are not the secret, so compare them first.
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Diagnostics for the key pool: which keys are live, which are cooling off and
 * why.
 *
 * This is operator-only. Even masked, the payload tells an outsider how many
 * credentials back the app, four real characters of each, how close each is to
 * exhaustion, and — through `lastError` — whatever the upstream provider last
 * said went wrong. That is a map of exactly when and how to exhaust the pool,
 * so in production it is sealed behind a bearer token.
 *
 * With no token configured it answers 404 rather than 401: an endpoint that
 * refuses you has still told you it is there.
 */
export async function GET(request: Request) {
  const limit = rateLimit(request, RATE_LIMIT);
  if (!limit.ok) return tooManyRequests(limit);

  const notFound = NextResponse.json(
    { error: "Not found" },
    { status: 404, headers: { "Cache-Control": "no-store" } },
  );

  // Open on a developer's own machine; guarded everywhere else.
  if (process.env.NODE_ENV === "production") {
    const token = process.env.ASTRAL_DIAGNOSTICS_TOKEN?.trim();
    if (!token) return notFound;

    const header = request.headers.get("authorization") ?? "";
    const supplied = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (!supplied || !matches(supplied, token)) return notFound;
  }

  const keys = poolStatus();

  return NextResponse.json(
    {
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
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
