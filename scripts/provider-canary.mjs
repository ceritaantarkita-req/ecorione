#!/usr/bin/env node

const connectUrl = process.env.ECORIONE_CONNECT_URL ?? "http://127.0.0.1:17023";
const token = process.env.ECORIONE_INTERNAL_TOKEN;
if (token === undefined || token.length === 0) {
  console.error("provider-canary: ECORIONE_INTERNAL_TOKEN wajib diisi.");
  process.exit(2);
}
const target = process.env.ECORIONE_CANARY_TARGET ?? "local";
if (target !== "local" && target !== "hosted") {
  console.error("provider-canary: ECORIONE_CANARY_TARGET harus local atau hosted.");
  process.exit(2);
}
const maxLatencyMs = Number(process.env.ECORIONE_CANARY_MAX_LATENCY_MS ?? "15000");
const minOutputChars = Number(process.env.ECORIONE_CANARY_MIN_OUTPUT_CHARS ?? "10");
const expectedSubstring = process.env.ECORIONE_CANARY_EXPECT ?? "ECORIONE_CANARY_OK";
const prompt = process.env.ECORIONE_CANARY_PROMPT ?? `Reply exactly ${expectedSubstring}`;

try {
  const response = await fetch(`${connectUrl}/v1/ops/provider-canary`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ target, prompt, expectedSubstring, minOutputChars, maxLatencyMs }),
    signal: AbortSignal.timeout(Math.max(5_000, maxLatencyMs + 5_000)),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    console.error(`provider-canary: HTTP ${String(response.status)}`, body);
    process.exit(1);
  }
  if (body === null || typeof body !== "object" || body.pass !== true) {
    console.error("provider-canary: quality floor gagal", body);
    process.exit(1);
  }
  console.log(
    `provider-canary: PASS target=${target} provider=${String(body.provider)} model=${String(body.model)} latencyMs=${Number(body.latencyMs).toFixed(1)}`,
  );
} catch (error) {
  console.error("provider-canary: gagal", error instanceof Error ? error.message : String(error));
  process.exit(1);
}
