/**
 * Best-effort per-IP rate limiting.
 *
 * State is module-level, so a limit is per warm server instance rather than
 * global. That is deliberate: it needs no external store, costs nothing to
 * run, and its failure mode is a limit that turns out more generous than
 * advertised when traffic is spread across instances.
 *
 * The job here is to stop one client hammering the upstream geocoder from this
 * app's address. It is not a defence against a distributed flood; that belongs
 * at the edge, in the Vercel WAF.
 */

interface Window {
  count: number;
  /** Epoch ms at which this window rolls over. */
  resetAt: number;
}

/**
 * Ceiling on tracked clients. Without it the limiter is itself a memory
 * exhaustion vector: one request per forged address is all it would take.
 */
const MAX_TRACKED = 10_000;

const windows = new Map<string, Window>();

/**
 * The originating client address.
 *
 * The left-most `x-forwarded-for` entry is the real client only because
 * Vercel's edge rewrites the header on the way in. Behind any other proxy — or
 * none — it is attacker-controlled, and the limiter degrades to advisory.
 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  if (first) return first;
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

function sweepExpired(now: number) {
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

export interface RateLimitOptions {
  /** Namespace, so two routes do not draw down one shared budget. */
  name: string;
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  ok: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
}

export function rateLimit(
  request: Request,
  options: RateLimitOptions,
): RateLimitResult {
  const now = Date.now();
  const key = `${options.name}:${clientIp(request)}`;
  const allowed = (): RateLimitResult => ({
    ok: true,
    limit: options.limit,
    remaining: options.limit,
    retryAfterSeconds: 0,
  });

  let window = windows.get(key);

  if (!window || window.resetAt <= now) {
    if (windows.size >= MAX_TRACKED) sweepExpired(now);
    // Still full once the expired entries are gone, so every tracked window is
    // live. Refuse to grow the map: established clients keep their limits and
    // new ones go unmetered, which beats taking the process down.
    if (windows.size >= MAX_TRACKED) return allowed();

    window = { count: 0, resetAt: now + options.windowMs };
    windows.set(key, window);
  }

  window.count += 1;

  return {
    ok: window.count <= options.limit,
    limit: options.limit,
    remaining: Math.max(0, options.limit - window.count),
    retryAfterSeconds: Math.max(1, Math.ceil((window.resetAt - now) / 1000)),
  };
}

/** Standard advisory headers, so a well-behaved client can pace itself. */
export function rateLimitHeaders(
  result: RateLimitResult,
): Record<string, string> {
  return {
    "RateLimit-Limit": String(result.limit),
    "RateLimit-Remaining": String(result.remaining),
    "RateLimit-Reset": String(result.retryAfterSeconds),
  };
}

/** The 429 to return when {@link rateLimit} says no. */
export function tooManyRequests(result: RateLimitResult): Response {
  return Response.json(
    { error: "Too many requests. Try again shortly." },
    {
      status: 429,
      headers: {
        ...rateLimitHeaders(result),
        "Retry-After": String(result.retryAfterSeconds),
        "Cache-Control": "no-store",
      },
    },
  );
}

/** Drop all tracked windows. For tests. */
export function resetRateLimits() {
  windows.clear();
}
