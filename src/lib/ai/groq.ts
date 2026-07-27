/**
 * Groq access with automatic failover across a pool of API keys.
 *
 * Two things go wrong often enough to design around. A key hits its rate limit
 * — handled by moving to the next key and benching the throttled one. And a
 * model gets decommissioned, which Groq reports as a 4xx that has nothing to do
 * with the key — handled by falling through a list of candidate models rather
 * than blaming and benching a perfectly good key.
 */

import { createGroq } from "@ai-sdk/groq";
import {
  streamText,
  type ModelMessage,
  type TextStreamPart,
  type ToolSet,
} from "ai";
import {
  classifyError,
  hasKeys,
  leaseKeys,
  reportFailure,
  reportSuccess,
  retryAfterMs,
  statusOf,
} from "./keyPool";

/**
 * Candidate models, tried in order. The first is used unless GROQ_MODEL says
 * otherwise; the rest are there so a decommissioned model degrades instead of
 * taking the feature down.
 */
export const MODEL_CANDIDATES = [
  "llama-3.3-70b-versatile",
  "openai/gpt-oss-120b",
  "moonshotai/kimi-k2-instruct",
  "qwen/qwen3-32b",
  "llama-3.1-8b-instant",
] as const;

export function modelChain(): string[] {
  const preferred = process.env.GROQ_MODEL?.trim();
  const rest = MODEL_CANDIDATES.filter((m) => m !== preferred);
  return preferred ? [preferred, ...rest] : [...MODEL_CANDIDATES];
}

/** True when the failure is about the model, not the credential. */
function isModelProblem(status: number | undefined, error: unknown): boolean {
  if (status === 404) return true;
  const message = (
    error instanceof Error ? error.message : String(error)
  ).toLowerCase();
  return (
    message.includes("decommission") ||
    message.includes("model_not_found") ||
    message.includes("does not exist") ||
    (message.includes("model") && message.includes("not found"))
  );
}

type Part = TextStreamPart<ToolSet>;

export interface GroqStreamOptions {
  system: string;
  messages: ModelMessage[];
  temperature?: number;
  maxOutputTokens?: number;
}

export interface GroqStreamResult {
  stream: ReadableStream<Part>;
  model: string;
  keyLabel: string;
  attempts: number;
}

/**
 * Start a stream, proving it works before handing it back.
 *
 * `streamText` is lazy and reports transport failures as an error part rather
 * than by throwing, so a naive call would return a Response that only fails
 * once the client is already reading it — far too late to try another key. We
 * therefore pull from the stream until either real output arrives (commit) or
 * an error part does (fail over), then replay what we consumed.
 */
export async function streamWithFailover(
  options: GroqStreamOptions,
): Promise<GroqStreamResult> {
  // hasKeys() rather than leaseKeys(): leasing advances the round-robin
  // cursor, and a mere existence check must not consume a rotation slot.
  if (!hasKeys()) throw new Error("No Groq API keys configured");

  const models = modelChain();
  const failures: string[] = [];
  let attempts = 0;

  for (const model of models) {
    let modelIsDead = false;
    let modelIsRateLimited = false;

    // Leased per model: Groq meters tokens per model, so a key that is spent
    // on one model is still eligible for the next one down the chain.
    const leases = leaseKeys(model);
    if (leases.length === 0) {
      failures.push(`${model}: no eligible keys`);
      continue;
    }

    for (const lease of leases) {
      attempts += 1;
      const groq = createGroq({
        apiKey: lease.key,
        // Overridable so the pool can be pointed at a proxy or a test double.
        ...(process.env.GROQ_BASE_URL
          ? { baseURL: process.env.GROQ_BASE_URL }
          : {}),
      });

      try {
        const result = streamText({
          model: groq(model),
          system: options.system,
          messages: options.messages,
          temperature: options.temperature ?? 0.7,
          maxOutputTokens: options.maxOutputTokens ?? 1200,
          // The pool retries by moving to a different key, which is strictly
          // better than the SDK backing off and hitting the same throttled one.
          maxRetries: 0,
        });

        const { buffered, reader } = await primeStream(result.fullStream);
        reportSuccess(lease.key, model);

        return {
          stream: replay(buffered, reader),
          model,
          keyLabel: lease.label,
          attempts,
        };
      } catch (error) {
        const status = statusOf(error);
        const detail = error instanceof Error ? error.message : String(error);

        if (isModelProblem(status, error)) {
          // Not this key's fault — abandon the model, keep the key.
          failures.push(`${model}: unavailable`);
          modelIsDead = true;
          break;
        }

        const kind = classifyError(status, error);
        if (kind === "rate-limit") modelIsRateLimited = true;
        reportFailure(lease.key, kind, retryAfterMs(error), detail, model);
        failures.push(`${lease.label} on ${model}: ${kind}`);

        // An auth failure means this key is bad everywhere; a rate limit means
        // try the next key. Both simply continue the loop.
      }
    }

    // Every key failed for this model. Whether to try the next one depends on
    // why: a dead model or a spent per-model quota both say "different model,
    // same keys" — Groq meters tokens per model, and several keys on one
    // account share that meter. Anything else (auth, network) will fail
    // identically on the next model, so stop.
    if (!modelIsDead && !modelIsRateLimited) break;
  }

  throw new Error(
    `All Groq attempts failed (${attempts}). ${failures.join("; ")}`,
  );
}

/** Number of non-content parts we will buffer before giving up on priming. */
const PRIME_LIMIT = 24;

/**
 * Read until the stream proves itself. Throws the underlying error if the
 * request failed, so the caller can fail over to another key.
 */
async function primeStream(fullStream: ReadableStream<Part>) {
  const reader = fullStream.getReader();
  const buffered: Part[] = [];

  for (let i = 0; i < PRIME_LIMIT; i += 1) {
    const { done, value } = await reader.read();
    if (done) break;

    if (value.type === "error") {
      await reader.cancel().catch(() => {});
      throw value.error;
    }

    buffered.push(value);

    // Any of these mean the provider accepted the request and is producing.
    if (
      value.type === "text-delta" ||
      value.type === "text-start" ||
      value.type === "reasoning-delta" ||
      value.type === "tool-call"
    ) {
      break;
    }
  }

  return { buffered, reader };
}

/** Re-emit the primed parts, then forward the rest of the stream untouched. */
function replay(
  buffered: Part[],
  reader: ReadableStreamDefaultReader<Part>,
): ReadableStream<Part> {
  return new ReadableStream<Part>({
    async pull(controller) {
      if (buffered.length > 0) {
        controller.enqueue(buffered.shift()!);
        return;
      }
      try {
        const { done, value } = await reader.read();
        if (done) controller.close();
        else controller.enqueue(value);
      } catch (error) {
        controller.error(error);
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}
