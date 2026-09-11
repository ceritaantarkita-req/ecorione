#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import {
  assertObservabilityReport,
  counterDelta,
  spansForRun,
  summarizeNumbers,
  summarizeProcessResources,
} from "./local-observability-evidence-lib.mjs";

const REPO_ROOT = resolve(import.meta.dirname, "..");
const STATE_PATH = join(REPO_ROOT, ".ecorione/evidence/local-observability-state.json");
const PERSISTENCE_STATE_PATH = join(
  REPO_ROOT,
  ".ecorione/evidence/local-persistence-restart-state.json",
);
const INTERNAL_TOKEN = process.env.ECORIONE_INTERNAL_TOKEN ?? "";
const REQUIRED_SERVICES = [
  "rnd",
  "context",
  "connect",
  "hub",
  "artifact",
  "sandbox",
  "space",
  "flow",
];
const ACTIVE_URLS = {
  rnd: process.env.ECORIONE_RND_URL ?? "http://127.0.0.1:17021",
  context: process.env.ECORIONE_CONTEXT_URL ?? "http://127.0.0.1:17022",
  connect: process.env.ECORIONE_CONNECT_URL ?? "http://127.0.0.1:17023",
  hub: process.env.ECORIONE_HUB_URL ?? "http://127.0.0.1:17024",
  artifact: process.env.ECORIONE_ARTIFACT_URL ?? "http://127.0.0.1:17025",
  sandbox: process.env.ECORIONE_SANDBOX_URL ?? "http://127.0.0.1:17026",
  space: process.env.ECORIONE_SPACE_URL ?? "http://127.0.0.1:17027",
  flow: process.env.ECORIONE_FLOW_URL ?? "http://127.0.0.1:17028",
};

function parseArgs(argv) {
  let phase = "run";
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--phase") {
      phase = argv[index + 1] ?? "";
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${value}`);
    }
  }
  if (phase !== "inventory" && phase !== "run") {
    throw new Error(`phase tidak didukung: ${phase}`);
  }
  return { phase };
}

function boundedInteger(name, fallback, minimum, maximum) {
  const value = Number(process.env[name] ?? String(fallback));
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} harus integer ${String(minimum)}..${String(maximum)}`);
  }
  return value;
}

function sampleConfig() {
  return {
    ownerReads: boundedInteger("ECORIONE_OBS_OWNER_READ_SAMPLES", 8, 3, 40),
    ecx: boundedInteger("ECORIONE_OBS_ECX_SAMPLES", 5, 3, 20),
    model: boundedInteger("ECORIONE_OBS_MODEL_SAMPLES", 5, 3, 12),
    modelMaxLatencyMs: boundedInteger(
      "ECORIONE_OBS_MODEL_MAX_LATENCY_MS",
      60_000,
      1_000,
      120_000,
    ),
  };
}

function command(commandName, args) {
  const result = spawnSync(commandName, args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `${commandName} ${args.join(" ")} gagal (${String(result.status)}): ${String(result.stderr ?? "").slice(-4000)}`,
    );
  }
  return String(result.stdout ?? "");
}

function gitSnapshot() {
  const head = command("git", ["rev-parse", "HEAD"]).trim();
  const originMain = command("git", ["rev-parse", "origin/main"]).trim();
  const trackedStatus = command("git", ["status", "--short"]).trim();
  return {
    head,
    originMain,
    trackedClean: trackedStatus === "",
    trackedStatus,
    synced: head === originMain,
  };
}

function writePrivateJson(path, value) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  chmodSync(path, 0o600);
}

function readPersistenceState() {
  if (!existsSync(PERSISTENCE_STATE_PATH)) return null;
  return JSON.parse(readFileSync(PERSISTENCE_STATE_PATH, "utf8"));
}

function authHeaders(requestId, json = false) {
  const headers = {};
  if (INTERNAL_TOKEN !== "") headers.authorization = `Bearer ${INTERNAL_TOKEN}`;
  if (requestId !== undefined) headers["x-request-id"] = requestId;
  if (json) headers["content-type"] = "application/json";
  return headers;
}

async function timedRequest(
  url,
  { method = "GET", requestId, body, bytes = false, timeoutMs = 15_000 } = {},
) {
  const started = performance.now();
  try {
    const response = await fetch(url, {
      method,
      headers: authHeaders(requestId, body !== undefined),
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    let payload;
    if (bytes && response.ok) {
      payload = Buffer.from(await response.arrayBuffer());
    } else {
      const text = await response.text();
      try {
        payload = text === "" ? null : JSON.parse(text);
      } catch {
        payload = text.slice(0, 2_000);
      }
    }
    return {
      ok: response.ok,
      status: response.status,
      durationMs: Math.max(0, performance.now() - started),
      requestId: requestId ?? null,
      traceId: response.headers.get("x-ecorione-trace-id"),
      payload,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      durationMs: Math.max(0, performance.now() - started),
      requestId: requestId ?? null,
      traceId: null,
      payload: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function requireJson(url, options = {}) {
  const result = await timedRequest(url, options);
  if (!result.ok) {
    throw new Error(
      `${options.method ?? "GET"} ${url} gagal status=${String(result.status)} body=${JSON.stringify(result.payload)}`,
    );
  }
  return result;
}

async function healthSnapshot() {
  const entries = await Promise.all(
    Object.entries(ACTIVE_URLS).map(async ([name, baseUrl]) => {
      try {
        const response = await fetch(`${baseUrl}/healthz`, {
          signal: AbortSignal.timeout(2_500),
        });
        return [
          name,
          {
            ok: response.ok,
            status: response.status,
            body: response.ok ? await response.json() : await response.text(),
          },
        ];
      } catch (error) {
        return [
          name,
          { ok: false, error: error instanceof Error ? error.message : String(error) },
        ];
      }
    }),
  );
  return Object.fromEntries(entries);
}

async function captureOps() {
  const entries = await Promise.all(
    Object.entries(ACTIVE_URLS).map(async ([name, baseUrl]) => {
      const result = await requireJson(`${baseUrl}/v1/ops/observability`, {
        timeoutMs: 5_000,
      });
      return [name, result.payload];
    }),
  );
  return Object.fromEntries(entries);
}

function processSnapshotValid(snapshot) {
  const item = snapshot?.process;
  if (item === undefined) return false;
  return [
    item.pid,
    item.uptimeSeconds,
    item.rssBytes,
    item.heapUsedBytes,
    item.heapTotalBytes,
    item.externalBytes,
    item.arrayBuffersBytes,
    item.cpuUserMicros,
    item.cpuSystemMicros,
  ].every(Number.isFinite);
}

async function inventory({ print = true } = {}) {
  const repo = gitSnapshot();
  const health = await healthSnapshot();
  let ops = {};
  let opsError = null;
  try {
    ops = await captureOps();
  } catch (error) {
    opsError = error instanceof Error ? error.message : String(error);
  }
  let runtime = null;
  let runtimeError = null;
  try {
    runtime = (
      await requireJson(`${ACTIVE_URLS.connect}/v1/settings/runtime`, { timeoutMs: 5_000 })
    ).payload;
  } catch (error) {
    runtimeError = error instanceof Error ? error.message : String(error);
  }
  const persistence = readPersistenceState();
  const metricInventory = {};
  const processResources = {};
  for (const [service, snapshot] of Object.entries(ops)) {
    metricInventory[service] = {
      counters: [...new Set((snapshot?.counters ?? []).map((item) => item.name))].sort(),
      histograms: [...new Set((snapshot?.histograms ?? []).map((item) => item.name))].sort(),
    };
    processResources[service] = snapshot?.process ?? null;
  }
  const result = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    repo,
    costKillSwitch: process.env.ECORIONE_COST_KILL_SWITCH ?? null,
    activeHealth: health,
    opsAvailable: opsError === null,
    opsError,
    metricInventory,
    processResources,
    runtime: runtime
      ? {
          revision: runtime.revision,
          localRuntime: runtime.settings?.localRuntime ?? null,
          localModelTag: runtime.settings?.localModelTag ?? null,
          hostedCallsEnabled: runtime.settings?.hostedCallsEnabled ?? null,
        }
      : null,
    runtimeError,
    persistenceEvidence: persistence
      ? {
          phase: persistence.phase,
          baselineRevision: persistence.baselineRevision,
          flowId: persistence.flow?.flowId ?? null,
          sessionId: persistence.ledger?.sessionId ?? null,
          episodeId: persistence.context?.episodeId ?? null,
          artifactId: persistence.artifact?.artifactId ?? null,
        }
      : null,
  };

  if (print) console.log(JSON.stringify(result, null, 2));
  if (!repo.synced || !repo.trackedClean) {
    throw new Error("observability inventory gagal: repo belum synchronized/clean");
  }
  if (INTERNAL_TOKEN === "") {
    throw new Error("observability inventory gagal: ECORIONE_INTERNAL_TOKEN tidak tersedia");
  }
  if (result.costKillSwitch !== "1") {
    throw new Error("observability inventory gagal: ECORIONE_COST_KILL_SWITCH harus 1");
  }
  const unhealthy = Object.entries(health)
    .filter(([, value]) => !value.ok)
    .map(([name]) => name);
  if (unhealthy.length > 0) {
    throw new Error(`observability inventory gagal: owner unhealthy: ${unhealthy.join(", ")}`);
  }
  if (opsError !== null) {
    throw new Error(`observability inventory gagal: /v1/ops/observability: ${opsError}`);
  }
  const missingResources = REQUIRED_SERVICES.filter(
    (service) => !processSnapshotValid(ops[service]),
  );
  if (missingResources.length > 0) {
    throw new Error(
      `observability inventory gagal: process resource snapshot belum tersedia: ${missingResources.join(", ")}`,
    );
  }
  if (
    runtime === null ||
    typeof runtime.settings?.localRuntime !== "string" ||
    typeof runtime.settings?.localModelTag !== "string"
  ) {
    throw new Error(
      "observability inventory gagal: local runtime/model identity tidak tersedia",
    );
  }
  if (
    persistence === null ||
    persistence.phase !== "cleanup-complete" ||
    typeof persistence.ledger?.sessionId !== "string" ||
    typeof persistence.context?.episodeId !== "string" ||
    typeof persistence.artifact?.artifactId !== "string" ||
    typeof persistence.flow?.flowId !== "string"
  ) {
    throw new Error(
      "observability inventory gagal: closed persistence evidence tidak tersedia",
    );
  }
  if (print) {
    console.log(
      "PASS observability inventory: repo, owner ops, process resources, local model identity and persistence probes are ready",
    );
  }
  return { result, ops, runtime, persistence };
}

function semanticOwnerSample(result, expected, kind) {
  if (!result.ok) return { ok: false, status: result.status, durationMs: result.durationMs };
  if (kind === "hub") {
    const ok =
      result.payload?.id === expected.ledger.sessionId &&
      result.payload?.headHash === expected.ledger.headHash;
    return {
      ok,
      status: result.status,
      durationMs: result.durationMs,
      requestId: result.requestId,
      traceId: result.traceId,
      id: result.payload?.id ?? null,
      headHash: result.payload?.headHash ?? null,
    };
  }
  if (kind === "context") {
    const ok = result.payload?.id === expected.context.episodeId;
    return {
      ok,
      status: result.status,
      durationMs: result.durationMs,
      requestId: result.requestId,
      traceId: result.traceId,
      id: result.payload?.id ?? null,
    };
  }
  if (kind === "flow") {
    const ok =
      result.payload?.flowId === expected.flow.flowId && result.payload?.status !== "RUNNING";
    return {
      ok,
      status: result.status,
      durationMs: result.durationMs,
      requestId: result.requestId,
      traceId: result.traceId,
      flowId: result.payload?.flowId ?? null,
      flowStatus: result.payload?.status ?? null,
    };
  }
  throw new Error(`semantic owner kind tidak didukung: ${kind}`);
}

async function ownerReadWorkload(runId, config, persistence) {
  const lanes = { hub: [], context: [], artifact: [], flow: [] };
  for (let index = 0; index < config.ownerReads; index += 1) {
    const hub = await timedRequest(
      `${ACTIVE_URLS.hub}/v1/history/sessions/${persistence.ledger.sessionId}?scope=personal&maxSensitivity=INTERNAL&hostedEligible=0`,
      { requestId: `${runId}-owner-hub-${String(index)}` },
    );
    lanes.hub.push(semanticOwnerSample(hub, persistence, "hub"));

    const context = await timedRequest(
      `${ACTIVE_URLS.context}/v1/episodes/${persistence.context.episodeId}`,
      { requestId: `${runId}-owner-context-${String(index)}` },
    );
    lanes.context.push(semanticOwnerSample(context, persistence, "context"));

    const artifact = await timedRequest(
      `${ACTIVE_URLS.artifact}/v1/artifacts/${persistence.artifact.artifactId}/content?scope=personal&maxSensitivity=INTERNAL&hostedEligible=0`,
      {
        requestId: `${runId}-owner-artifact-${String(index)}`,
        bytes: true,
      },
    );
    const bytes = Buffer.isBuffer(artifact.payload) ? artifact.payload : Buffer.alloc(0);
    const digest = createHash("sha256").update(bytes).digest("hex");
    lanes.artifact.push({
      ok: artifact.ok && digest === persistence.artifact.sha256,
      status: artifact.status,
      durationMs: artifact.durationMs,
      requestId: artifact.requestId,
      traceId: artifact.traceId,
      sizeBytes: bytes.byteLength,
      sha256: digest,
    });

    const flow = await timedRequest(`${ACTIVE_URLS.flow}/v1/flows/${persistence.flow.flowId}`, {
      requestId: `${runId}-owner-flow-${String(index)}`,
    });
    lanes.flow.push(semanticOwnerSample(flow, persistence, "flow"));
  }
  return lanes;
}

function operationId(runId, index) {
  return `op_${runId.replaceAll(/[^a-z0-9_-]/giu, "").toLowerCase()}_${String(index)}`;
}

async function ecxWorkload(runId, config, persistence) {
  const samples = [];
  for (let index = 0; index < config.ecx; index += 1) {
    const planRequestId = `${runId}-ecx-plan-${String(index)}`;
    const hydrateRequestId = `${runId}-ecx-hydrate-${String(index)}`;
    const plan = await timedRequest(`${ACTIVE_URLS.hub}/v1/exchange/plan`, {
      method: "POST",
      requestId: planRequestId,
      body: {
        operationId: operationId(runId, index),
        requestedAt: new Date().toISOString(),
        sender: "agent:observability",
        intent: "local-observability",
        task: "Read known closed persistence pointers for a bounded local observability sample.",
        need: ["history", "artifact"],
        refs: [
          {
            kind: "history",
            sessionId: persistence.ledger.sessionId,
            afterSeq: -1,
            throughSeq: 0,
          },
          { kind: "artifact", artifactId: persistence.artifact.artifactId },
        ],
        budget: { maxHydratedBytes: 16_384 },
        responseMode: "delta",
        candidates: [
          {
            agentId: "agent:observability-probe",
            capabilities: ["history", "artifact"],
            estimatedCost: 0,
          },
        ],
        maxRecipients: 1,
      },
    });
    const packet = plan.payload?.packets?.[0];
    if (!plan.ok || packet === undefined) {
      samples.push({
        ok: false,
        planStatus: plan.status,
        planDurationMs: plan.durationMs,
        hydrateStatus: 0,
        hydrateDurationMs: 0,
        planRequestId,
        hydrateRequestId,
      });
      continue;
    }
    const hydrate = await timedRequest(`${ACTIVE_URLS.hub}/v1/exchange/hydrate`, {
      method: "POST",
      requestId: hydrateRequestId,
      body: {
        packet,
        refIndexes: [0, 1],
        scope: "personal",
        maxSensitivity: "INTERNAL",
        hostedEligible: false,
      },
    });
    const artifactItem = hydrate.payload?.items?.find((item) => item?.ref?.kind === "artifact");
    const artifactBytes =
      typeof artifactItem?.contentBase64 === "string"
        ? Buffer.from(artifactItem.contentBase64, "base64")
        : Buffer.alloc(0);
    const artifactDigest = createHash("sha256").update(artifactBytes).digest("hex");
    samples.push({
      ok:
        plan.ok &&
        hydrate.ok &&
        hydrate.payload?.items?.length === 2 &&
        artifactDigest === persistence.artifact.sha256,
      planStatus: plan.status,
      planDurationMs: plan.durationMs,
      planTraceId: plan.traceId,
      planRequestId,
      hydrateStatus: hydrate.status,
      hydrateDurationMs: hydrate.durationMs,
      hydrateTraceId: hydrate.traceId,
      hydrateRequestId,
      hydratedBytes: Number(hydrate.payload?.hydratedBytes ?? 0),
      artifactSha256: artifactDigest,
    });
  }
  return samples;
}

async function canarySample(requestId, prompt, maxLatencyMs) {
  const expectedSubstring = "ECORIONE_CANARY_OK";
  const response = await timedRequest(`${ACTIVE_URLS.connect}/v1/ops/provider-canary`, {
    method: "POST",
    requestId,
    timeoutMs: maxLatencyMs + 10_000,
    body: {
      target: "local",
      prompt,
      expectedSubstring,
      minOutputChars: expectedSubstring.length,
      maxLatencyMs,
    },
  });
  const body = response.payload ?? {};
  return {
    ok: response.ok,
    status: response.status,
    requestId,
    traceId: response.traceId,
    clientDurationMs: response.durationMs,
    pass: body.pass === true,
    target: body.target ?? null,
    provider: body.provider ?? null,
    model: body.model ?? null,
    responseModel: body.responseModel ?? null,
    pricingModel: body.pricingModel ?? null,
    cacheHit: body.cacheHit ?? null,
    providerLatencyMs: Number(body.latencyMs ?? 0),
    outputChars: Number(body.outputChars ?? 0),
    usage: body.usage ?? null,
    cost: body.cost ?? null,
  };
}

async function modelWorkload(runId, config) {
  const samples = [];
  for (let index = 0; index < config.model; index += 1) {
    const prompt = `Local observability sample ${runId}-${String(index)}. Reply exactly ECORIONE_CANARY_OK`;
    samples.push(
      await canarySample(`${runId}-model-${String(index)}`, prompt, config.modelMaxLatencyMs),
    );
  }
  return samples;
}

function idsFor(samples) {
  return new Set(samples.map((sample) => sample.requestId).filter(Boolean));
}

function spanDurations(spans, requestIds, service, route) {
  return spans
    .filter(
      (span) =>
        requestIds.has(span.requestId) &&
        span.service === service &&
        (route === undefined || span.route === route),
    )
    .map((span) => Number(span.durationMs));
}

function summarizeOwnerReads(ownerReads, spans) {
  const routes = {
    hub: "/v1/history/sessions/:id",
    context: "/v1/episodes/:id",
    artifact: "/v1/artifacts/:id/content",
    flow: "/v1/flows/:id",
  };
  return Object.fromEntries(
    Object.entries(ownerReads).map(([service, samples]) => {
      const ids = idsFor(samples);
      return [
        service,
        {
          clientMs: summarizeNumbers(samples.map((sample) => sample.durationMs)),
          serverMs: summarizeNumbers(spanDurations(spans, ids, service, routes[service])),
        },
      ];
    }),
  );
}

function summarizeEcx(ecx, spans) {
  const planIds = new Set(ecx.map((sample) => sample.planRequestId));
  const hydrateIds = new Set(ecx.map((sample) => sample.hydrateRequestId));
  return {
    planClientMs: summarizeNumbers(ecx.map((sample) => sample.planDurationMs)),
    planServerMs: summarizeNumbers(spanDurations(spans, planIds, "hub", "/v1/exchange/plan")),
    hydrateClientMs: summarizeNumbers(ecx.map((sample) => sample.hydrateDurationMs)),
    hydrateServerMs: summarizeNumbers(
      spanDurations(spans, hydrateIds, "hub", "/v1/exchange/hydrate"),
    ),
    artifactServerMs: summarizeNumbers(
      spanDurations(spans, hydrateIds, "artifact", "/v1/artifacts/:id/content"),
    ),
  };
}

function summarizeModel(model, spans) {
  const ids = idsFor(model);
  const client = model.map((sample) => sample.clientDurationMs);
  const provider = model.map((sample) => sample.providerLatencyMs);
  const overhead = model.map((sample) =>
    Math.max(0, sample.clientDurationMs - sample.providerLatencyMs),
  );
  return {
    clientMs: summarizeNumbers(client),
    providerMs: summarizeNumbers(provider),
    clientMinusProviderMs: summarizeNumbers(overhead),
    connectServerMs: summarizeNumbers(
      spanDurations(spans, ids, "connect", "/v1/ops/provider-canary"),
    ),
    provider: [...new Set(model.map((sample) => sample.provider))],
    model: [...new Set(model.map((sample) => sample.model))],
    responseModel: [...new Set(model.map((sample) => sample.responseModel))],
    pricingModel: [...new Set(model.map((sample) => sample.pricingModel))],
    cacheHits: model.filter((sample) => sample.cacheHit === true).length,
    cacheMisses: model.filter((sample) => sample.cacheHit === false).length,
    inputTokens: model.reduce(
      (total, sample) => total + Number(sample.usage?.inputTokens ?? 0),
      0,
    ),
    outputTokens: model.reduce(
      (total, sample) => total + Number(sample.usage?.outputTokens ?? 0),
      0,
    ),
    actualCostUsd: model.reduce(
      (total, sample) => total + Number(sample.cost?.actualUsd ?? 0),
      0,
    ),
  };
}

function traceCoverage(ecx, spans) {
  let complete = 0;
  for (const sample of ecx) {
    const services = new Set(
      spans
        .filter((span) => span.requestId === sample.hydrateRequestId)
        .map((span) => span.service),
    );
    if (services.has("hub") && services.has("artifact")) complete += 1;
  }
  return { ecxHydrationsWithArtifactSpan: complete, expected: ecx.length };
}

function workloadErrorCount(ownerReads, ecx, model) {
  const owners = Object.values(ownerReads).flat();
  return (
    owners.filter((sample) => !sample.ok).length +
    ecx.filter((sample) => !sample.ok).length +
    model.filter((sample) => !sample.ok || !sample.pass).length
  );
}

async function run() {
  const config = sampleConfig();
  const { result: inventoryResult, runtime, persistence } = await inventory({ print: true });
  const runId = `obs-${new Date()
    .toISOString()
    .replaceAll(/[-:.TZ]/gu, "")
    .slice(0, 14)}-${randomUUID().replaceAll("-", "").slice(0, 8)}`;
  const initialState = {
    schemaVersion: 1,
    phase: "running",
    runId,
    revision: inventoryResult.repo.head,
    startedAt: new Date().toISOString(),
    requiredServices: REQUIRED_SERVICES,
    sampleConfig: config,
    localModelIdentity: {
      runtime: runtime.settings.localRuntime,
      model: runtime.settings.localModelTag,
    },
  };
  writePrivateJson(STATE_PATH, initialState);

  try {
    const warmup = await canarySample(
      `${runId}-warmup`,
      `Warm up local runtime for ${runId}. Reply exactly ECORIONE_CANARY_OK`,
      config.modelMaxLatencyMs,
    );
    if (!warmup.ok || !warmup.pass || warmup.target !== "local") {
      throw new Error(`local model warm-up gagal: ${JSON.stringify(warmup)}`);
    }

    const beforeOps = await captureOps();
    const ownerReads = await ownerReadWorkload(runId, config, persistence);
    const ecx = await ecxWorkload(runId, config, persistence);
    const model = await modelWorkload(runId, config);
    const afterOps = await captureOps();
    const spans = spansForRun(afterOps, runId);

    const summary = {
      ownerReads: summarizeOwnerReads(ownerReads, spans),
      ecx: summarizeEcx(ecx, spans),
      model: summarizeModel(model, spans),
      workloadErrors: workloadErrorCount(ownerReads, ecx, model),
      traceCoverage: traceCoverage(ecx, spans),
      processResources: summarizeProcessResources(beforeOps, afterOps),
      metricDeltas: {
        modelCallsLocalMiss: counterDelta(
          beforeOps.connect,
          afterOps.connect,
          "ecorione_model_calls_total",
          { target: "local", cache: "miss" },
        ),
        modelCallsLocalHit: counterDelta(
          beforeOps.connect,
          afterOps.connect,
          "ecorione_model_calls_total",
          { target: "local", cache: "hit" },
        ),
        ecxPlans: counterDelta(beforeOps.hub, afterOps.hub, "ecorione_ecx_plans_total"),
        ecxHydrations: counterDelta(
          beforeOps.hub,
          afterOps.hub,
          "ecorione_ecx_hydrations_total",
        ),
      },
    };

    const report = {
      ...initialState,
      phase: "measured",
      completedAt: new Date().toISOString(),
      warmup,
      workloads: { ownerReads, ecx, model },
      beforeOps,
      afterOps,
      summary,
      evidenceState: STATE_PATH,
    };
    assertObservabilityReport(report);
    if (summary.metricDeltas.modelCallsLocalMiss < config.model) {
      throw new Error(
        "Connect metric delta tidak mencatat seluruh local cache-miss model calls",
      );
    }
    if (
      summary.metricDeltas.ecxPlans < config.ecx ||
      summary.metricDeltas.ecxHydrations < config.ecx
    ) {
      throw new Error("Hub ECX metric delta tidak mencatat seluruh measured samples");
    }
    writePrivateJson(STATE_PATH, report);

    const consoleSummary = {
      phase: report.phase,
      revision: report.revision,
      runId: report.runId,
      sampleConfig: report.sampleConfig,
      localModelIdentity: report.localModelIdentity,
      ownerReads: summary.ownerReads,
      ecx: summary.ecx,
      model: summary.model,
      workloadErrors: summary.workloadErrors,
      traceCoverage: summary.traceCoverage,
      processResources: summary.processResources,
      metricDeltas: summary.metricDeltas,
      evidenceState: STATE_PATH,
    };
    console.log(JSON.stringify(consoleSummary, null, 2));
    console.log(
      "PASS strict local observability: representative owner reads, ECX hydration, uncached local-model latency, trace propagation and process resource deltas were measured",
    );
  } catch (error) {
    const failed = {
      ...initialState,
      phase: "failed",
      failedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
      evidenceState: STATE_PATH,
    };
    writePrivateJson(STATE_PATH, failed);
    throw error;
  }
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.phase === "inventory") {
    await inventory({ print: true });
    return;
  }
  await run();
}

main().catch((error) => {
  console.error(
    "local-observability-evidence: failed",
    error instanceof Error ? error.message : String(error),
  );
  process.exitCode = 1;
});
