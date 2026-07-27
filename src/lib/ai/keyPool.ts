/**
 * A rotating pool of Groq API keys.
 *
 * Groq rate-limits per key, so several keys behave like one larger budget as
 * long as something spreads the load and steps around a key that has just been
 * throttled. This module owns that: it hands out keys round-robin, benches a
 * key when Groq says it is over quota, and remembers how long to bench it for.
 *
 * State is module-level, so it survives for the life of a warm server
 * instance. That is deliberately best-effort — if the instance is recycled the
 * pool simply starts even again, which costs at most one wasted attempt.
 */

export type KeyFailure = "rate-limit" | "auth" | "server" | "network";

interface KeyState {
  key: string;
  /** Position in the configured list, used for stable labelling. */
  index: number;
  /** Epoch ms before which this key should not be used for anything. */
  cooldownUntil: number;
  /**
   * Rate limits are scoped to a model, so a key exhausted on one model is
   * still perfectly good on another. Keyed by model id.
   */
  modelCooldowns: Map<string, number>;
  consecutiveFailures: number;
  successes: number;
  failures: number;
  lastError?: string;
  /** Auth failures are effectively permanent; stop advertising the key. */
  disabled: boolean;
}

/** How long a key sits out after each failure kind, in ms. */
const COOLDOWN: Record<KeyFailure, number> = {
  "rate-limit": 60_000,
  server: 15_000,
  network: 10_000,
  auth: 24 * 60 * 60 * 1000,
};

let pool: KeyState[] | null = null;
let cursor = 0;

/**
 * Reads keys from the environment.
 *
 * Accepts, in order of convenience:
 *   GROQ_API_KEYS   comma- or whitespace-separated list
 *   GROQ_API_KEY    a single key
 *   GROQ_API_KEY_1, GROQ_API_KEY_2, …  numbered keys
 *
 * Duplicates are collapsed so an accidental repeat does not get double the
 * share of traffic.
 */
export function readKeysFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const found: string[] = [];

  const list = env.GROQ_API_KEYS?.trim();
  if (list) found.push(...list.split(/[\s,]+/));

  if (env.GROQ_API_KEY?.trim()) found.push(env.GROQ_API_KEY.trim());

  for (const [name, value] of Object.entries(env)) {
    if (/^GROQ_API_KEY_\d+$/.test(name) && value?.trim())
      found.push(value.trim());
  }

  const seen = new Set<string>();
  return found
    .map((k) => k.trim())
    .filter((k) => k.length > 0 && !seen.has(k) && seen.add(k));
}

function ensurePool(): KeyState[] {
  if (pool) return pool;
  pool = readKeysFromEnv().map((key, index) => ({
    key,
    index,
    cooldownUntil: 0,
    modelCooldowns: new Map<string, number>(),
    consecutiveFailures: 0,
    successes: 0,
    failures: 0,
    disabled: false,
  }));
  return pool;
}

/** Drop cached state — used by tests and after an env change. */
export function resetPool() {
  pool = null;
  cursor = 0;
}

export function hasKeys() {
  return ensurePool().length > 0;
}

export function keyCount() {
  return ensurePool().length;
}

/**
 * `gsk_...a1b2` — enough to tell keys apart in a log without leaking one.
 *
 * ASCII only, deliberately: this label goes out in an HTTP response header,
 * and header values must be Latin-1. A Unicode ellipsis here throws when the
 * Response is constructed.
 */
export function maskKey(key: string) {
  if (key.length <= 8) return "...";
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

export interface Lease {
  key: string;
  label: string;
  index: number;
}

/**
 * Hand out every currently usable key, best first, as an ordered attempt list.
 *
 * Returning the whole ordered list rather than one key lets the caller fail
 * over without coming back for another lease mid-flight. Keys on cooldown are
 * excluded unless *every* key is cooling, in which case the one that frees up
 * soonest is offered — a throttled attempt beats refusing to answer.
 *
 * Pass a model to also skip keys whose quota for that specific model is spent;
 * they stay eligible for every other model.
 */
export function leaseKeys(model?: string): Lease[] {
  const keys = ensurePool().filter((k) => !k.disabled);
  if (keys.length === 0) return [];

  const now = Date.now();
  const freeAt = (k: KeyState) =>
    Math.max(k.cooldownUntil, (model && k.modelCooldowns.get(model)) || 0);
  const available = keys.filter((k) => freeAt(k) <= now);

  if (available.length === 0) {
    const soonest = keys.reduce((a, b) => (freeAt(b) < freeAt(a) ? b : a));
    return [
      { key: soonest.key, label: maskKey(soonest.key), index: soonest.index },
    ];
  }

  // Round-robin: start at the cursor so consecutive requests spread out.
  const start = cursor % available.length;
  cursor = (cursor + 1) % Math.max(available.length, 1);

  const ordered = [...available.slice(start), ...available.slice(0, start)];
  return ordered.map((k) => ({
    key: k.key,
    label: maskKey(k.key),
    index: k.index,
  }));
}

export function reportSuccess(key: string, model?: string) {
  const state = ensurePool().find((k) => k.key === key);
  if (!state) return;
  state.consecutiveFailures = 0;
  state.cooldownUntil = 0;
  if (model) state.modelCooldowns.delete(model);
  state.successes += 1;
  state.lastError = undefined;
}

export function reportFailure(
  key: string,
  kind: KeyFailure,
  retryAfterMs?: number,
  message?: string,
  model?: string,
) {
  const state = ensurePool().find((k) => k.key === key);
  if (!state) return;

  state.consecutiveFailures += 1;
  state.failures += 1;
  state.lastError = message?.slice(0, 200);

  if (kind === "auth") {
    state.disabled = true;
    state.cooldownUntil = Date.now() + COOLDOWN.auth;
    return;
  }

  // Honour Groq's own retry hint when it gives one; otherwise back off a
  // little further each time this key fails in a row.
  const base =
    retryAfterMs ?? COOLDOWN[kind] * Math.min(state.consecutiveFailures, 5);
  const until = Date.now() + base;

  // Groq meters tokens per model, so a spent quota says nothing about this
  // key's usefulness elsewhere — bench it for that model only.
  if (kind === "rate-limit" && model) state.modelCooldowns.set(model, until);
  else state.cooldownUntil = until;
}

/**
 * Classify a failed Groq call. Groq returns 429 both for "too many requests"
 * and for a spent daily allowance; the retry hint tells them apart in
 * practice, and either way the answer is to move to another key.
 */
export function classifyError(
  status: number | undefined,
  error: unknown,
): KeyFailure {
  if (status === 429) return "rate-limit";
  if (status === 401 || status === 403) return "auth";
  if (status !== undefined && status >= 500) return "server";
  if (status !== undefined && status >= 400) return "server";

  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : String(error).toLowerCase();
  if (
    message.includes("rate limit") ||
    message.includes("quota") ||
    message.includes("429")
  ) {
    return "rate-limit";
  }
  if (
    message.includes("unauthorized") ||
    message.includes("api key") ||
    message.includes("401")
  ) {
    return "auth";
  }
  return "network";
}

/** Pull a status code off whatever shape the SDK threw. */
export function statusOf(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const candidate = error as {
    statusCode?: number;
    status?: number;
    response?: { status?: number };
  };
  return candidate.statusCode ?? candidate.status ?? candidate.response?.status;
}

/** Seconds in a `retry-after` header, or Groq's `try again in 1.5s` message. */
export function retryAfterMs(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;

  const headers = (error as { responseHeaders?: Record<string, string> })
    .responseHeaders;
  const header = headers?.["retry-after"] ?? headers?.["Retry-After"];
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds)) return seconds * 1000;
  }

  const message = error instanceof Error ? error.message : "";
  const match = message.match(/try again in ([\d.]+)\s*(ms|s|m)/i);
  if (match) {
    const value = Number(match[1]);
    const unit = match[2].toLowerCase();
    if (Number.isFinite(value)) {
      return unit === "ms"
        ? value
        : unit === "m"
          ? value * 60_000
          : value * 1000;
    }
  }
  return undefined;
}

export interface KeyStatus {
  label: string;
  index: number;
  available: boolean;
  cooldownSeconds: number;
  /** Models whose quota this key has spent, with seconds until they reset. */
  modelsExhausted: { model: string; seconds: number }[];
  successes: number;
  failures: number;
  disabled: boolean;
  lastError?: string;
}

/** Masked snapshot for the diagnostics endpoint. */
export function poolStatus(): KeyStatus[] {
  const now = Date.now();
  return ensurePool().map((k) => ({
    label: maskKey(k.key),
    index: k.index,
    available: !k.disabled && k.cooldownUntil <= now,
    cooldownSeconds: Math.max(0, Math.ceil((k.cooldownUntil - now) / 1000)),
    modelsExhausted: [...k.modelCooldowns.entries()]
      .filter(([, until]) => until > now)
      .map(([model, until]) => ({
        model,
        seconds: Math.ceil((until - now) / 1000),
      })),
    successes: k.successes,
    failures: k.failures,
    disabled: k.disabled,
    lastError: k.lastError,
  }));
}
