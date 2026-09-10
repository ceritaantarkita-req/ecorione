#!/usr/bin/env node

const token = process.env.ECORIONE_INTERNAL_TOKEN;
if (!token) {
  console.error("production-data-evidence: ECORIONE_INTERNAL_TOKEN is required");
  process.exit(2);
}

const hubUrl = process.env.ECORIONE_HUB_URL ?? "http://127.0.0.1:17024";
const connectUrl = process.env.ECORIONE_CONNECT_URL ?? "http://127.0.0.1:17023";
const minHistoryEvents = Number(process.env.ECORIONE_EVIDENCE_MIN_HISTORY_EVENTS ?? "1");
const minEcxPackets = Number(process.env.ECORIONE_EVIDENCE_MIN_ECX_PACKETS ?? "1");
const minModelCalls = Number(process.env.ECORIONE_EVIDENCE_MIN_MODEL_CALLS ?? "1");

async function getJson(base, path) {
  const response = await fetch(`${base}${path}`, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10000),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(`${path} HTTP ${String(response.status)} ${JSON.stringify(body)}`);
  return body;
}

function counterValue(snapshot, name) {
  if (!snapshot || typeof snapshot !== "object" || !Array.isArray(snapshot.counters)) return 0;
  return snapshot.counters
    .filter((counter) => counter && typeof counter === "object" && counter.name === name)
    .reduce((sum, counter) => sum + Number(counter.value ?? 0), 0);
}

const history = await getJson(hubUrl, "/v1/history/verify");
const hubOps = await getJson(hubUrl, "/v1/ops/observability");
const connectOps = await getJson(connectUrl, "/v1/ops/observability");

const historySessions = Number(history?.sessions ?? 0);
const historyEvents = Number(history?.events ?? 0);
const ecxPlans = counterValue(hubOps, "ecorione_ecx_plans_total");
const ecxPackets = counterValue(hubOps, "ecorione_ecx_packets_total");
const ecxPacketBytes = counterValue(hubOps, "ecorione_ecx_packet_bytes_total");
const ecxHydrations = counterValue(hubOps, "ecorione_ecx_hydrations_total");
const ecxHydratedItems = counterValue(hubOps, "ecorione_ecx_hydrated_items_total");
const ecxHydrationBytes = counterValue(hubOps, "ecorione_ecx_hydration_bytes_total");
const modelCalls = counterValue(connectOps, "ecorione_model_calls_total");
const inputTokens = counterValue(connectOps, "ecorione_model_input_tokens_total");
const outputTokens = counterValue(connectOps, "ecorione_model_output_tokens_total");
const cacheReadTokens = counterValue(connectOps, "ecorione_model_cache_read_tokens_total");
const cacheWriteTokens = counterValue(connectOps, "ecorione_model_cache_write_tokens_total");
const actualCostUsd = counterValue(connectOps, "ecorione_model_cost_usd_total");

const evidence = {
  historicalLedger: { sessions: historySessions, events: historyEvents },
  ecx: {
    plans: ecxPlans,
    packets: ecxPackets,
    packetBytes: ecxPacketBytes,
    hydrations: ecxHydrations,
    hydratedItems: ecxHydratedItems,
    hydrationBytes: ecxHydrationBytes,
  },
  providerTraffic: {
    modelCalls,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheWriteTokens,
    actualCostUsd,
  },
  claimBoundary:
    "Traffic evidence only. This script does not establish ECX or optimizer savings; comparative real-provider/task telemetry is still required for a savings claim.",
};

console.log(JSON.stringify(evidence, null, 2));

const failures = [];
if (historyEvents < minHistoryEvents)
  failures.push(`history events ${historyEvents} < ${minHistoryEvents}`);
if (ecxPackets < minEcxPackets) failures.push(`ECX packets ${ecxPackets} < ${minEcxPackets}`);
if (modelCalls < minModelCalls) failures.push(`model calls ${modelCalls} < ${minModelCalls}`);
if (failures.length > 0) {
  console.error(`FAIL production-data-evidence: ${failures.join("; ")}`);
  process.exit(1);
}

console.log(
  "PASS production-data-evidence: real traffic exists across Historical Ledger, ECX, and provider telemetry boundaries",
);
