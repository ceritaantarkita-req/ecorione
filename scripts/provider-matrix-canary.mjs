#!/usr/bin/env node

const connectUrl = process.env.ECORIONE_CONNECT_URL ?? "http://127.0.0.1:17023";
const token = process.env.ECORIONE_INTERNAL_TOKEN;
if (!token) {
  console.error("provider-matrix-canary: ECORIONE_INTERNAL_TOKEN is required");
  process.exit(2);
}

const requested = (process.env.ECORIONE_PROVIDER_VALIDATION_SET ?? "anthropic,openrouter,openai")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const allowed = new Set(["anthropic", "openrouter", "openai"]);
for (const provider of requested) {
  if (!allowed.has(provider)) {
    console.error(`provider-matrix-canary: unsupported provider ${provider}`);
    process.exit(2);
  }
}

const expectedSubstring = process.env.ECORIONE_CANARY_EXPECT ?? "ECORIONE_CANARY_OK";
const maxLatencyMs = Number(process.env.ECORIONE_CANARY_MAX_LATENCY_MS ?? "20000");
const minOutputChars = Number(process.env.ECORIONE_CANARY_MIN_OUTPUT_CHARS ?? "10");
const prompt = process.env.ECORIONE_CANARY_PROMPT ?? `Reply exactly ${expectedSubstring}`;
const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };

async function jsonRequest(path, init = {}) {
  const response = await fetch(`${connectUrl}${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(Math.max(5000, maxLatencyMs + 5000)),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`${path} HTTP ${String(response.status)} ${JSON.stringify(body)}`);
  }
  return body;
}

const original = await jsonRequest("/v1/settings/runtime");
if (!original || typeof original !== "object" || !original.settings) {
  throw new Error("runtime settings response is invalid");
}

const credentialState = await jsonRequest("/v1/settings/credentials");
if (!credentialState || typeof credentialState !== "object" || credentialState.available !== true) {
  throw new Error("Connect credential vault is not available");
}

const credentials = Array.isArray(credentialState.credentials) ? credentialState.credentials : [];
const credentialProviders = new Set(
  credentials
    .map((entry) => (entry && typeof entry === "object" ? entry.provider : null))
    .filter((value) => typeof value === "string"),
);

let failed = false;
try {
  for (const provider of requested) {
    if (!credentialProviders.has(provider)) {
      console.error(`FAIL provider=${provider} — credential missing from Connect Vault`);
      failed = true;
      continue;
    }

    await jsonRequest("/v1/settings/runtime", {
      method: "PUT",
      body: JSON.stringify({ hostedProvider: provider, hostedCallsEnabled: true }),
    });

    try {
      const result = await jsonRequest("/v1/ops/provider-canary", {
        method: "POST",
        body: JSON.stringify({
          target: "hosted",
          prompt,
          expectedSubstring,
          minOutputChars,
          maxLatencyMs,
        }),
      });
      if (!result || typeof result !== "object" || result.pass !== true) {
        console.error(`FAIL provider=${provider} — quality floor failed ${JSON.stringify(result)}`);
        failed = true;
        continue;
      }
      console.log(
        `PASS provider=${provider} model=${String(result.model)} latencyMs=${Number(result.latencyMs).toFixed(1)}`,
      );
    } catch (error) {
      console.error(`FAIL provider=${provider} — ${error instanceof Error ? error.message : String(error)}`);
      failed = true;
    }
  }
} finally {
  await jsonRequest("/v1/settings/runtime", {
    method: "PUT",
    body: JSON.stringify(original.settings),
  });
  console.log("provider-matrix-canary: restored original runtime settings");
}

if (failed) process.exit(1);
console.log("PASS provider-matrix-canary");
