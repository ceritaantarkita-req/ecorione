#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildAgentSystemPrompt,
  executeFixtureTool,
  parseAgentAction,
  scoreAgentTrace,
  validateAgenticManifest,
} from "../evals/agentic-eval-core.mjs";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const manifestPath = resolve(repoRoot, "evals/agentic-cases.json");
const manifest = validateAgenticManifest(
  JSON.parse(readFileSync(manifestPath, "utf8")),
  repoRoot,
);

const args = new Set(process.argv.slice(2));
const inventoryOnly = args.has("--inventory");
const allowUnverifiedIdentity = args.has("--allow-unverified-identity");
const baseUrl = (
  process.env.ECORIONE_LOCAL_BASE_URL ?? "http://127.0.0.1:11434/v1"
).replace(/\/$/u, "");
const modelTag = process.env.ECORIONE_LOCAL_MODEL ?? "qwen3:8b-instruct-q4_K_M";
const declaredDigest = process.env.ECORIONE_LOCAL_MODEL_DIGEST?.trim() || null;

function normalizeDigest(value) {
  if (typeof value !== "string") return null;
  return value.trim().toLowerCase().replace(/^sha256:/u, "");
}

async function fetchJson(url, init = {}) {
  const signal = AbortSignal.timeout(10_000);
  const response = await fetch(url, { ...init, signal });
  const text = await response.text();
  let body = null;
  try {
    body = text.length === 0 ? null : JSON.parse(text);
  } catch {
    body = null;
  }
  return { ok: response.ok, status: response.status, body, text };
}

async function inspectIdentity() {
  let modelsReachable = false;
  let listed = false;
  try {
    const models = await fetchJson(`${baseUrl}/models`);
    modelsReachable = models.ok;
    const data = Array.isArray(models.body?.data) ? models.body.data : [];
    listed = data.some((item) => item?.id === modelTag || item?.name === modelTag);
  } catch {
    modelsReachable = false;
  }

  const nativeBase = baseUrl.endsWith("/v1") ? baseUrl.slice(0, -3) : null;
  let resolvedDigest = null;
  if (nativeBase !== null) {
    try {
      const tags = await fetchJson(`${nativeBase}/api/tags`);
      const models = Array.isArray(tags.body?.models) ? tags.body.models : [];
      const match = models.find(
        (item) => item?.name === modelTag || item?.model === modelTag,
      );
      resolvedDigest = typeof match?.digest === "string" ? match.digest : null;
    } catch {
      resolvedDigest = null;
    }
  }

  const declared = normalizeDigest(declaredDigest);
  const resolved = normalizeDigest(resolvedDigest);
  const verified = declared !== null && resolved !== null && declared === resolved;
  return {
    baseUrl,
    modelTag,
    modelsReachable,
    listed,
    declaredDigestPresent: declared !== null,
    resolvedDigestPresent: resolved !== null,
    identityVerified: verified,
    identityStatus: verified
      ? "verified"
      : resolved !== null
        ? "resolved-unverified"
        : declared !== null
          ? "declared-unverified"
          : "unverified",
  };
}

async function callModel(messages) {
  const started = performance.now();
  const response = await fetchJson(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: modelTag,
      temperature: 0,
      messages,
    }),
  });
  const latencyMs = performance.now() - started;
  if (!response.ok) {
    throw new Error(
      `local model HTTP ${String(response.status)}: ${response.text.slice(0, 400)}`,
    );
  }
  const content = response.body?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.length === 0) {
    throw new Error("local model tidak mengembalikan choices[0].message.content");
  }
  return {
    content,
    responseModel: response.body?.model ?? modelTag,
    latencyMs,
    inputTokens: response.body?.usage?.prompt_tokens ?? 0,
    outputTokens: response.body?.usage?.completion_tokens ?? 0,
  };
}

async function runOnce(item, repetition) {
  const messages = [
    { role: "system", content: buildAgentSystemPrompt(item) },
    { role: "user", content: item.prompt },
  ];
  const trace = { actions: [], executions: [], observations: [] };
  const calls = [];
  let failure = null;

  for (let step = 0; step < manifest.maxSteps; step += 1) {
    let call;
    let action;
    try {
      call = await callModel(messages);
      action = parseAgentAction(call.content);
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
      break;
    }
    calls.push({
      responseModel: call.responseModel,
      latencyMs: call.latencyMs,
      inputTokens: call.inputTokens,
      outputTokens: call.outputTokens,
    });
    trace.actions.push(action);

    if (action.phase === "final") break;

    const execution = executeFixtureTool(item, action);
    trace.executions.push(execution);
    if (!execution.ok) {
      failure = execution.error;
      break;
    }
    trace.observations.push(execution.result);
    messages.push({ role: "assistant", content: call.content });
    messages.push({
      role: "user",
      content: `TOOL_OBSERVATION ${JSON.stringify({
        tool: execution.tool,
        result: execution.result,
      })}`,
    });
  }

  const score = scoreAgentTrace(item, trace);
  if (failure !== null) score.pass = false;
  return {
    caseId: item.id,
    repetition,
    pass: score.pass,
    checks: score.checks,
    selectedTools: score.selectedTools,
    executedTools: score.executedTools,
    finalAnswer: score.finalAnswer,
    failure,
    calls,
  };
}

async function main() {
  const inventory = await inspectIdentity();
  console.log(JSON.stringify({ phase: "inventory", ...inventory }, null, 2));
  if (inventoryOnly) {
    process.exitCode = inventory.modelsReachable ? 0 : 1;
    return;
  }
  if (!inventory.modelsReachable) {
    throw new Error(`local model runtime tidak reachable di ${baseUrl}`);
  }
  if (!inventory.identityVerified && !allowUnverifiedIdentity) {
    throw new Error(
      "Identitas model lokal belum verified. Set ECORIONE_LOCAL_MODEL_DIGEST ke digest runtime yang benar, atau gunakan --allow-unverified-identity hanya untuk exploratory run yang tidak boleh menutup W15.",
    );
  }

  const records = [];
  for (const item of manifest.cases) {
    for (let repetition = 1; repetition <= manifest.repetitions; repetition += 1) {
      const result = await runOnce(item, repetition);
      records.push(result);
      console.log(
        `${item.id} run ${String(repetition)}/${String(manifest.repetitions)}: ${result.pass ? "PASS" : "FAIL"}`,
      );
    }
  }

  const caseSummaries = manifest.cases.map((item) => {
    const runs = records.filter((record) => record.caseId === item.id);
    return {
      caseId: item.id,
      pass3: runs.length === manifest.repetitions && runs.every((run) => run.pass),
      passedRuns: runs.filter((run) => run.pass).length,
      totalRuns: runs.length,
      avgLatencyMs:
        runs.reduce(
          (sum, run) =>
            sum + run.calls.reduce((callSum, call) => callSum + call.latencyMs, 0),
          0,
        ) / Math.max(1, runs.length),
      avgOutputTokens:
        runs.reduce(
          (sum, run) =>
            sum + run.calls.reduce((callSum, call) => callSum + call.outputTokens, 0),
          0,
        ) / Math.max(1, runs.length),
    };
  });
  const allPass3 = caseSummaries.every((item) => item.pass3);
  const closureEligible = allPass3 && inventory.identityVerified;
  const evidence = {
    schemaVersion: 1,
    suite: manifest.suite,
    recordedAt: new Date().toISOString(),
    claimBoundary: manifest.claimBoundary,
    inventory,
    allPass3,
    closureEligible,
    caseSummaries,
    records,
  };
  const traceDir = resolve(repoRoot, "traces");
  mkdirSync(traceDir, { recursive: true });
  const fileName = `w15-agentic-eval-${evidence.recordedAt.replace(/[:.]/gu, "-")}.json`;
  const outputPath = resolve(traceDir, fileName);
  writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ allPass3, closureEligible, outputPath, caseSummaries }, null, 2));
  process.exitCode = closureEligible || allowUnverifiedIdentity ? (allPass3 ? 0 : 1) : 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
