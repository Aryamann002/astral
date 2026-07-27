/**
 * Integration test for Groq failover, run against a local stand-in for the
 * Groq API. Verifies that a throttled key is skipped, a dead model is stepped
 * over without blaming the key, and that the primed chunks are replayed intact
 * so no output is lost at the seam.
 *
 * Run with `npm run verify:failover`.
 */

import { createServer, type Server } from "node:http";
import { toUIMessageStream, type TextStreamPart, type ToolSet } from "ai";

let failures = 0;
function ok(label: string, condition: boolean, detail = "") {
  if (!condition) failures += 1;
  console.log(
    `${condition ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`,
  );
}

const KEY_A = "gsk_AAAA000000000000AAAA";
const KEY_B = "gsk_BBBB111111111111BBBB";
const KEY_C = "gsk_CCCC222222222222CCCC";

/** What the fake Groq should do for a given key+model, set per scenario. */
type Behaviour =
  | { kind: "ok"; text: string }
  | { kind: "rateLimit" }
  | { kind: "auth" }
  | { kind: "modelGone" }
  | { kind: "server" };

let behaviour: (key: string, model: string) => Behaviour = () => ({
  kind: "ok",
  text: "hello",
});
const calls: { key: string; model: string }[] = [];

function sseChunk(payload: unknown) {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

function startMockGroq(): Promise<{ server: Server; url: string }> {
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const key = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
      const model =
        (JSON.parse(body || "{}") as { model?: string }).model ?? "";
      calls.push({ key, model });

      const action = behaviour(key, model);

      if (action.kind === "rateLimit") {
        res.writeHead(429, {
          "content-type": "application/json",
          "retry-after": "37",
        });
        return res.end(
          JSON.stringify({
            error: {
              message: "Rate limit reached. Please try again in 1.2s",
              type: "rate_limit",
            },
          }),
        );
      }
      if (action.kind === "auth") {
        res.writeHead(401, { "content-type": "application/json" });
        return res.end(
          JSON.stringify({ error: { message: "Invalid API Key" } }),
        );
      }
      if (action.kind === "modelGone") {
        res.writeHead(404, { "content-type": "application/json" });
        return res.end(
          JSON.stringify({
            error: {
              message: `The model \`${model}\` has been decommissioned`,
              code: "model_not_found",
            },
          }),
        );
      }
      if (action.kind === "server") {
        res.writeHead(503, { "content-type": "application/json" });
        return res.end(
          JSON.stringify({ error: { message: "upstream unavailable" } }),
        );
      }

      res.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
      });
      const id = "chatcmpl-test";
      res.write(
        sseChunk({
          id,
          object: "chat.completion.chunk",
          model,
          choices: [
            { index: 0, delta: { role: "assistant" }, finish_reason: null },
          ],
        }),
      );
      // One word per chunk, so a dropped chunk at the prime/replay seam shows up.
      for (const word of action.text.split(" ")) {
        res.write(
          sseChunk({
            id,
            object: "chat.completion.chunk",
            model,
            choices: [
              { index: 0, delta: { content: `${word} ` }, finish_reason: null },
            ],
          }),
        );
      }
      res.write(
        sseChunk({
          id,
          object: "chat.completion.chunk",
          model,
          choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
      );
      res.write("data: [DONE]\n\n");
      res.end();
    });
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolve({ server, url: `http://127.0.0.1:${port}/openai/v1` });
    });
  });
}

async function collect(stream: ReadableStream<TextStreamPart<ToolSet>>) {
  const reader = toUIMessageStream({ stream }).getReader();
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value.type === "text-delta") text += value.delta;
  }
  return text;
}

const { server, url } = await startMockGroq();
process.env.GROQ_BASE_URL = url;

// Every failure below is deliberate, and the AI SDK logs each one. Keep the
// report readable by dropping only those lines.
const realConsoleError = console.error;
console.error = (...args: unknown[]) => {
  const first = String(args[0] ?? "");
  if (first.includes("AI_APICallError") || first.includes("APICallError"))
    return;
  realConsoleError(...args);
};

// Imported after GROQ_BASE_URL is set so the pool reads a clean environment.
const { streamWithFailover } = await import("../src/lib/ai/groq");
const { poolStatus, resetPool, keyCount } =
  await import("../src/lib/ai/keyPool");

function scenario(env: Record<string, string>, howToRespond: typeof behaviour) {
  for (const name of Object.keys(process.env)) {
    if (name.startsWith("GROQ_API_KEY") || name === "GROQ_MODEL")
      delete process.env[name];
  }
  Object.assign(process.env, env);
  behaviour = howToRespond;
  calls.length = 0;
  resetPool();
}

const ask = () =>
  streamWithFailover({
    system: "You are a test.",
    messages: [{ role: "user", content: "hello" }],
  });

try {
  console.log("\n— Happy path —");
  scenario({ GROQ_API_KEYS: [KEY_A, KEY_B].join(",") }, () => ({
    kind: "ok",
    text: "The Moon is in Capricorn today",
  }));
  ok("pool sees both keys", keyCount() === 2, `${keyCount()}`);
  {
    const result = await ask();
    const text = await collect(result.stream);
    ok(
      "full text survives prime and replay",
      text.trim() === "The Moon is in Capricorn today",
      JSON.stringify(text),
    );
    ok(
      "succeeded on the first attempt",
      result.attempts === 1,
      `${result.attempts}`,
    );
    ok(
      "reports which key was used",
      result.keyLabel.startsWith("gsk_"),
      result.keyLabel,
    );
  }

  console.log("\n— Rate-limited key fails over —");
  scenario({ GROQ_API_KEYS: [KEY_A, KEY_B].join(",") }, (key) =>
    key === KEY_A
      ? { kind: "rateLimit" }
      : { kind: "ok", text: "second key answered" },
  );
  {
    const result = await ask();
    const text = await collect(result.stream);
    ok(
      "failed over to a working key",
      text.trim() === "second key answered",
      JSON.stringify(text),
    );
    ok("took two attempts", result.attempts === 2, `${result.attempts}`);
    // Benched for that model only — the key is still fine on other models.
    ok(
      "throttled key was benched for the model",
      poolStatus()[0].modelsExhausted.length === 1,
      JSON.stringify(poolStatus()[0].modelsExhausted),
    );
    ok(
      "and honoured the retry-after header",
      poolStatus()[0].modelsExhausted[0]?.seconds > 30,
      `${poolStatus()[0].modelsExhausted[0]?.seconds}s`,
    );
    ok("working key stayed available", poolStatus()[1].available);
  }

  console.log("\n— Invalid key is disabled, not retried —");
  scenario({ GROQ_API_KEYS: [KEY_A, KEY_B].join(",") }, (key) =>
    key === KEY_A ? { kind: "auth" } : { kind: "ok", text: "good key" },
  );
  {
    const result = await ask();
    await collect(result.stream);
    ok("bad key disabled", poolStatus()[0].disabled);

    calls.length = 0;
    const second = await ask();
    await collect(second.stream);
    ok(
      "disabled key not tried again",
      !calls.some((c) => c.key === KEY_A),
      JSON.stringify(calls.map((c) => c.key.slice(0, 8))),
    );
    ok(
      "second request succeeds directly",
      second.attempts === 1,
      `${second.attempts}`,
    );
  }

  console.log("\n— Decommissioned model steps to the next model —");
  scenario(
    { GROQ_API_KEYS: KEY_A, GROQ_MODEL: "retired-model" },
    (_key, model) =>
      model === "retired-model"
        ? { kind: "modelGone" }
        : { kind: "ok", text: "fallback model" },
  );
  {
    const result = await ask();
    const text = await collect(result.stream);
    ok(
      "answered from a fallback model",
      text.trim() === "fallback model",
      JSON.stringify(text),
    );
    ok(
      "model changed, not the key",
      result.model !== "retired-model",
      result.model,
    );
    ok(
      "key not penalised for a dead model",
      poolStatus()[0].available && !poolStatus()[0].disabled,
    );
  }

  console.log("\n— Per-model quota exhausted across every key —");
  // The real case: several keys on one Groq account share a per-model token
  // budget. When it runs out the answer is a different model, not a different
  // key — and the keys must stay usable for that next model.
  scenario(
    {
      GROQ_API_KEYS: [KEY_A, KEY_B, KEY_C].join(","),
      GROQ_MODEL: "busy-model",
    },
    (_key, model) =>
      model === "busy-model"
        ? { kind: "rateLimit" }
        : { kind: "ok", text: "answered on the next model" },
  );
  {
    const result = await ask();
    const text = await collect(result.stream);
    ok(
      "moves to the next model when the quota is spent",
      text.trim() === "answered on the next model",
      JSON.stringify(text),
    );
    ok("model changed", result.model !== "busy-model", result.model);
    ok(
      "tried every key before giving up on the model",
      new Set(calls.filter((c) => c.model === "busy-model").map((c) => c.key))
        .size === 3,
    );
    ok(
      "keys stay globally available",
      poolStatus().every((s) => s.available && !s.disabled),
    );
    ok(
      "only the busy model is benched",
      poolStatus().every(
        (s) =>
          s.modelsExhausted.length === 1 &&
          s.modelsExhausted[0].model === "busy-model",
      ),
      JSON.stringify(poolStatus()[0].modelsExhausted),
    );
  }

  console.log("\n— Diagnostics are HTTP-header safe —");
  {
    // A non-Latin-1 character here throws when the Response is built, which
    // would discard a reply the model had already produced.
    const result = await ask();
    await collect(result.stream);
    let built = true;
    try {
      new Response("ok", {
        headers: {
          "x-astral-key": result.keyLabel,
          "x-astral-model": result.model,
        },
      });
    } catch {
      built = false;
    }
    ok("key label and model survive a real Response", built, result.keyLabel);
  }

  console.log("\n— All keys exhausted —");
  scenario({ GROQ_API_KEYS: [KEY_A, KEY_B, KEY_C].join(",") }, () => ({
    kind: "rateLimit",
  }));
  {
    let threw = false;
    let message = "";
    try {
      await ask();
    } catch (error) {
      threw = true;
      message = error instanceof Error ? error.message : String(error);
    }
    ok("throws once every key is spent", threw);
    ok(
      "error names the attempts",
      /All Groq attempts failed/.test(message),
      message.slice(0, 90),
    );
    ok(
      "tried every key",
      new Set(calls.map((c) => c.key)).size === 3,
      `${new Set(calls.map((c) => c.key)).size}`,
    );
    ok("error message leaks no full key", !message.includes(KEY_A), "masked");
  }

  console.log("\n— Server errors fail over too —");
  scenario({ GROQ_API_KEYS: [KEY_A, KEY_B].join(",") }, (key) =>
    key === KEY_A ? { kind: "server" } : { kind: "ok", text: "recovered" },
  );
  {
    const result = await ask();
    const text = await collect(result.stream);
    ok(
      "recovers from a 503",
      text.trim() === "recovered",
      JSON.stringify(text),
    );
  }

  console.log("\n— Load spreads across keys —");
  scenario({ GROQ_API_KEYS: [KEY_A, KEY_B, KEY_C].join(",") }, () => ({
    kind: "ok",
    text: "ok",
  }));
  {
    for (let i = 0; i < 6; i += 1) {
      const result = await ask();
      await collect(result.stream);
    }
    const used = new Map<string, number>();
    for (const c of calls) used.set(c.key, (used.get(c.key) ?? 0) + 1);
    ok("all three keys carried traffic", used.size === 3, `${used.size} keys`);
    ok(
      "each key took an equal share",
      [...used.values()].every((n) => n === 2),
      JSON.stringify([...used.values()]),
    );
  }
} finally {
  server.close();
}

console.log(
  `\n${failures === 0 ? "✓ all checks passed" : `✗ ${failures} check(s) failed`}\n`,
);
process.exit(failures === 0 ? 0 : 1);
