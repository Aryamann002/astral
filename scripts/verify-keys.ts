/**
 * Key-pool behaviour: env parsing, round-robin spread, cooldown and failover.
 * Run with `npm run verify:keys`.
 */

import {
  classifyError,
  hasKeys,
  keyCount,
  leaseKeys,
  maskKey,
  poolStatus,
  readKeysFromEnv,
  reportFailure,
  reportSuccess,
  resetPool,
  retryAfterMs,
  statusOf,
} from "../src/lib/ai/keyPool";
import { modelChain } from "../src/lib/ai/groq";

let failures = 0;
function ok(label: string, condition: boolean, detail = "") {
  if (!condition) failures += 1;
  console.log(
    `${condition ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`,
  );
}

const KEY = (n: number) =>
  `gsk_${String(n).repeat(4)}TESTKEY${String(n).repeat(4)}`;

function withEnv(env: Record<string, string | undefined>, fn: () => void) {
  const saved: Record<string, string | undefined> = {};
  for (const name of Object.keys(process.env)) {
    if (name.startsWith("GROQ_")) {
      saved[name] = process.env[name];
      delete process.env[name];
    }
  }
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  resetPool();
  try {
    fn();
  } finally {
    for (const name of Object.keys(process.env)) {
      if (name.startsWith("GROQ_")) delete process.env[name];
    }
    Object.assign(process.env, saved);
    resetPool();
  }
}

console.log("\n— Environment parsing —");

withEnv({ GROQ_API_KEY: KEY(1) }, () => {
  ok("single GROQ_API_KEY", keyCount() === 1, `${keyCount()}`);
});

withEnv({ GROQ_API_KEYS: `${KEY(1)},${KEY(2)},${KEY(3)}` }, () => {
  ok("comma-separated GROQ_API_KEYS", keyCount() === 3, `${keyCount()}`);
});

withEnv({ GROQ_API_KEYS: `${KEY(1)}  ${KEY(2)}\n${KEY(3)}` }, () => {
  ok("whitespace-separated GROQ_API_KEYS", keyCount() === 3, `${keyCount()}`);
});

withEnv(
  { GROQ_API_KEY_1: KEY(1), GROQ_API_KEY_2: KEY(2), GROQ_API_KEY_7: KEY(7) },
  () => {
    ok("numbered GROQ_API_KEY_n", keyCount() === 3, `${keyCount()}`);
  },
);

withEnv(
  {
    GROQ_API_KEY: KEY(1),
    GROQ_API_KEYS: `${KEY(1)},${KEY(2)}`,
    GROQ_API_KEY_1: KEY(2),
  },
  () => {
    ok(
      "duplicates collapse across all three forms",
      keyCount() === 2,
      `${keyCount()}`,
    );
  },
);

withEnv({}, () => {
  ok("no keys means no pool", !hasKeys() && keyCount() === 0);
  ok("empty pool leases nothing", leaseKeys().length === 0);
});

withEnv({ GROQ_API_KEYS: `  ,, ${KEY(1)} , ` }, () => {
  ok("blank entries ignored", keyCount() === 1, `${keyCount()}`);
});

console.log("\n— Masking —");
ok(
  "mask keeps only the ends",
  maskKey("gsk_abcdefghijklmnop") === "gsk_...mnop",
  maskKey("gsk_abcdefghijklmnop"),
);
ok("short strings fully masked", maskKey("abc") === "...");
// The label goes out in an HTTP header, and header values must be Latin-1.
ok(
  "mask is ASCII-safe for HTTP headers",
  /^[\x20-\x7E]*$/.test(maskKey("gsk_abcdefghijklmnop")) &&
    /^[\x20-\x7E]*$/.test(maskKey("abc")),
);
ok(
  "masked status never contains a full key",
  (() => {
    let clean = true;
    withEnv({ GROQ_API_KEYS: `${KEY(1)},${KEY(2)}` }, () => {
      clean = poolStatus().every((s) => !s.label.includes("TESTKEY"));
    });
    return clean;
  })(),
);

console.log("\n— Round-robin —");
withEnv({ GROQ_API_KEYS: `${KEY(1)},${KEY(2)},${KEY(3)}` }, () => {
  const firstPicks = Array.from({ length: 9 }, () => leaseKeys()[0].index);
  const distinct = new Set(firstPicks);
  ok(
    "rotates across all keys",
    distinct.size === 3,
    `saw ${[...distinct].join(",")}`,
  );

  const counts = new Map<number, number>();
  for (const i of firstPicks) counts.set(i, (counts.get(i) ?? 0) + 1);
  ok(
    "spread is even over 9 leases",
    [...counts.values()].every((c) => c === 3),
    JSON.stringify([...counts]),
  );

  ok("a lease offers every key as failover", leaseKeys().length === 3);
});

console.log("\n— Cooldown and failover —");
withEnv({ GROQ_API_KEYS: `${KEY(1)},${KEY(2)},${KEY(3)}` }, () => {
  const all = leaseKeys();
  reportFailure(all[0].key, "rate-limit", 60_000, "rate limit reached");

  const after = leaseKeys();
  ok(
    "rate-limited key leaves rotation",
    !after.some((l) => l.key === all[0].key),
    `${after.length} left`,
  );
  ok("other keys still available", after.length === 2);

  const status = poolStatus().find((s) => s.index === all[0].index)!;
  ok(
    "cooldown is reported in seconds",
    status.cooldownSeconds > 50,
    `${status.cooldownSeconds}s`,
  );
  ok("cooled key marked unavailable", !status.available);

  reportSuccess(all[0].key);
  ok("success clears the cooldown", leaseKeys().length === 3);
});

withEnv({ GROQ_API_KEYS: `${KEY(1)},${KEY(2)}` }, () => {
  const all = leaseKeys();
  reportFailure(all[0].key, "auth", undefined, "invalid api key");
  const status = poolStatus().find((s) => s.index === all[0].index)!;
  ok("auth failure disables the key", status.disabled);
  ok(
    "disabled key is excluded",
    leaseKeys().every((l) => l.key !== all[0].key),
  );

  reportSuccess(all[0].key);
  ok(
    "a disabled key is not revived by a stray success",
    poolStatus()[all[0].index].disabled,
  );
});

withEnv({ GROQ_API_KEYS: `${KEY(1)},${KEY(2)}` }, () => {
  const all = leaseKeys();
  for (const lease of all)
    reportFailure(lease.key, "rate-limit", 30_000, "throttled");
  const leases = leaseKeys();
  ok(
    "every key cooling still yields one attempt",
    leases.length === 1,
    `${leases.length}`,
  );
});

withEnv({ GROQ_API_KEYS: `${KEY(1)}` }, () => {
  const [lease] = leaseKeys();
  reportFailure(lease.key, "server", undefined, "500");
  const first = poolStatus()[0].cooldownSeconds;
  reportFailure(lease.key, "server", undefined, "500");
  const second = poolStatus()[0].cooldownSeconds;
  ok(
    "repeated failures back off further",
    second > first,
    `${first}s → ${second}s`,
  );
});

console.log("\n— Per-model quotas —");
// Groq meters tokens per model, and keys on one account share that meter, so
// a spent quota must not take the key out of service for other models.
withEnv({ GROQ_API_KEYS: `${KEY(1)},${KEY(2)}` }, () => {
  const all = leaseKeys("model-a");
  for (const lease of all)
    reportFailure(lease.key, "rate-limit", 60_000, "TPD reached", "model-a");

  ok("model-a is exhausted on every key", leaseKeys("model-a").length === 1);
  ok(
    "model-b is untouched",
    leaseKeys("model-b").length === 2,
    `${leaseKeys("model-b").length}`,
  );
  ok(
    "global availability is unaffected",
    poolStatus().every((s) => s.available),
  );

  const status = poolStatus()[0];
  ok(
    "status reports the exhausted model",
    status.modelsExhausted.length === 1 &&
      status.modelsExhausted[0].model === "model-a",
    JSON.stringify(status.modelsExhausted),
  );
  ok("and when it resets", status.modelsExhausted[0].seconds > 50);

  reportSuccess(all[0].key, "model-a");
  ok(
    "a success on that model clears it",
    poolStatus()[0].modelsExhausted.length === 0,
  );
});

withEnv({ GROQ_API_KEYS: `${KEY(1)}` }, () => {
  const [lease] = leaseKeys("model-a");
  reportFailure(lease.key, "network", undefined, "socket hang up", "model-a");
  ok(
    "non-rate-limit failures still bench the key globally",
    !poolStatus()[0].available,
  );
  ok(
    "and are not recorded as a model quota",
    poolStatus()[0].modelsExhausted.length === 0,
  );
});

console.log("\n— Error classification —");
ok("429 is a rate limit", classifyError(429, new Error("x")) === "rate-limit");
ok("401 is an auth failure", classifyError(401, new Error("x")) === "auth");
ok("403 is an auth failure", classifyError(403, new Error("x")) === "auth");
ok("503 is a server failure", classifyError(503, new Error("x")) === "server");
ok(
  "rate limit detected from message alone",
  classifyError(undefined, new Error("Rate limit reached for model")) ===
    "rate-limit",
);
ok(
  "auth detected from message alone",
  classifyError(undefined, new Error("Invalid API Key provided")) === "auth",
);
ok(
  "unknown failures are network",
  classifyError(undefined, new Error("socket hang up")) === "network",
);

console.log("\n— Retry hints —");
ok(
  "reads retry-after header",
  retryAfterMs({ responseHeaders: { "retry-after": "42" } }) === 42_000,
  String(retryAfterMs({ responseHeaders: { "retry-after": "42" } })),
);
ok(
  "parses 'try again in 1.5s'",
  retryAfterMs(new Error("Rate limit reached. Please try again in 1.5s")) ===
    1500,
  String(
    retryAfterMs(new Error("Rate limit reached. Please try again in 1.5s")),
  ),
);
ok(
  "parses 'try again in 800ms'",
  retryAfterMs(new Error("try again in 800ms")) === 800,
  String(retryAfterMs(new Error("try again in 800ms"))),
);
ok(
  "parses minutes",
  retryAfterMs(new Error("try again in 2m")) === 120_000,
  String(retryAfterMs(new Error("try again in 2m"))),
);
ok("no hint returns undefined", retryAfterMs(new Error("boom")) === undefined);

console.log("\n— Status extraction —");
ok("statusCode field", statusOf({ statusCode: 429 }) === 429);
ok("status field", statusOf({ status: 401 }) === 401);
ok("nested response.status", statusOf({ response: { status: 503 } }) === 503);
ok("plain error has no status", statusOf(new Error("x")) === undefined);

console.log("\n— Model chain —");
withEnv({}, () => {
  ok("default chain is non-empty", modelChain().length >= 3, modelChain()[0]);
});
withEnv({ GROQ_MODEL: "openai/gpt-oss-120b" }, () => {
  const chain = modelChain();
  ok(
    "preferred model leads the chain",
    chain[0] === "openai/gpt-oss-120b",
    chain[0],
  );
  ok(
    "preferred model is not duplicated",
    chain.filter((m) => m === chain[0]).length === 1,
  );
});
withEnv({ GROQ_MODEL: "some/custom-model" }, () => {
  const chain = modelChain();
  ok(
    "custom model leads, defaults remain as fallback",
    chain[0] === "some/custom-model" && chain.length > 1,
  );
});

console.log("\n— readKeysFromEnv is pure —");
ok(
  "reads from an injected env",
  readKeysFromEnv({
    GROQ_API_KEYS: `${KEY(1)},${KEY(2)}`,
  } as unknown as NodeJS.ProcessEnv).length === 2,
);

console.log(
  `\n${failures === 0 ? "✓ all checks passed" : `✗ ${failures} check(s) failed`}\n`,
);
process.exit(failures === 0 ? 0 : 1);
