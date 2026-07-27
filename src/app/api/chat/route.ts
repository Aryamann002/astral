import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { localAstrologer } from "@/lib/astro/localAstrologer";
import { hasKeys } from "@/lib/ai/keyPool";
import { streamWithFailover } from "@/lib/ai/groq";

export const maxDuration = 60;

const SYSTEM = `You are the astrologer inside Astral, an app that computes real natal charts from ephemeris data.

You are given the querent's complete chart as factual context. Treat it as ground truth and never invent a placement, degree, house or aspect that is not in the data. If someone asks about something the chart data does not cover, say so plainly.

How to write:
- Talk like a thoughtful person who knows the craft, not a horoscope column. No "dear seeker", no cosmic filler, no exclamation marks.
- Ground every claim in a specific placement or aspect, and name it: "your Moon in the 12th", "Saturn square your Sun". The specificity is the whole value.
- Two or three short paragraphs is usually right. Answer the question that was asked.
- Astrology describes patterns and tendencies. Say "this tends to" rather than "this will". Do not make predictions about health, death, pregnancy, legal outcomes or finances, and if asked, redirect to what the chart actually describes — temperament and timing.
- If the birth time is unknown, do not lean on houses or the Ascendant, and say why.
- Disagreement is allowed. If someone asks you to confirm something the chart does not support, tell them what the chart shows instead.`;

interface ChatBody {
  messages: UIMessage[];
  chartContext?: string;
}

/**
 * Header values must be Latin-1. Anything outside it throws when the Response
 * is constructed — which would discard a reply the model had already produced,
 * purely to report a diagnostic about it.
 */
function headerSafe(value: string) {
  return value.replace(/[^\x20-\x7E]/g, "?").slice(0, 200);
}

/**
 * Provider order: the Groq key pool first, then Vercel AI Gateway if one is
 * configured, then a deterministic local reader. Each step only runs when the
 * one before it is unavailable or has failed outright, so the endpoint always
 * returns something readable.
 */
export async function POST(request: Request) {
  const { messages, chartContext } = (await request.json()) as ChatBody;

  const system = chartContext
    ? `${SYSTEM}\n\n--- THE QUERENT'S CHART ---\n${chartContext}`
    : `${SYSTEM}\n\nNo chart has been provided; ask the querent for their birth date, time and place before reading anything.`;

  const modelMessages = await convertToModelMessages(messages);

  if (hasKeys()) {
    try {
      const { stream, model, keyLabel, attempts } = await streamWithFailover({
        system,
        messages: modelMessages,
      });

      return createUIMessageStreamResponse({
        stream: toUIMessageStream({ stream }),
        headers: {
          "x-astral-provider": "groq",
          "x-astral-model": headerSafe(model),
          "x-astral-key": headerSafe(keyLabel),
          "x-astral-attempts": String(attempts),
        },
      });
    } catch (error) {
      console.error("[astral] Groq pool exhausted:", error);
      // Fall through to the gateway, then to the local reader.
    }
  }

  if (process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN) {
    try {
      const result = streamText({
        model: process.env.ASTRAL_MODEL ?? "anthropic/claude-sonnet-4.5",
        system,
        messages: modelMessages,
        temperature: 0.7,
      });
      return result.toUIMessageStreamResponse({
        headers: { "x-astral-provider": "gateway" },
      });
    } catch (error) {
      console.error("[astral] Gateway failed:", error);
    }
  }

  return offlineResponse(messages, chartContext);
}

/**
 * Deterministic reading assembled from the chart itself. Not as fluent as a
 * model, but it is grounded in the same data and means the app is never dead.
 */
function offlineResponse(messages: UIMessage[], chartContext?: string) {
  const last = [...messages].reverse().find((m) => m.role === "user");
  const question = (last?.parts ?? [])
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join(" ");

  const answer = localAstrologer(question, chartContext ?? "");

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const id = "offline-0";
      writer.write({ type: "text-start", id });
      // Chunked so it arrives the same way a model response would.
      for (const token of answer.match(/\S+\s*/g) ?? [answer]) {
        writer.write({ type: "text-delta", id, delta: token });
        await new Promise((resolve) => setTimeout(resolve, 12));
      }
      writer.write({ type: "text-end", id });
    },
  });

  return createUIMessageStreamResponse({
    stream,
    headers: { "x-astral-provider": "offline" },
  });
}
