#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { scoreReply } from "./comparative-evidence.mjs";

function finiteNonNegative(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function completionEvidence(completion, leg, target) {
  const failures = [];
  if (completion === null || typeof completion !== "object") {
    return {
      leg,
      target,
      provider: null,
      modelIdentity: null,
      modelIdentityPinned: false,
      usage: null,
      actualCostUsd: null,
      budgetSettlement: null,
      failures: [`${leg} completion missing`],
    };
  }
  if (completion.modelIdentityPinned !== true) {
    failures.push(`${leg} model identity is not pinned`);
  }
  const usage = completion.usage;
  if (
    usage === null ||
    typeof usage !== "object" ||
    !finiteNonNegative(usage.inputTokens) ||
    !finiteNonNegative(usage.outputTokens) ||
    !finiteNonNegative(usage.cacheReadTokens) ||
    !finiteNonNegative(usage.cacheWriteTokens)
  ) {
    failures.push(`${leg} usage telemetry missing or invalid`);
  }
  const cost = completion.cost;
  if (
    cost === null ||
    typeof cost !== "object" ||
    !finiteNonNegative(cost.actualUsd)
  ) {
    failures.push(`${leg} actual cost telemetry missing or invalid`);
  }
  const settlement =
    completion.budget !== undefined && completion.budget !== null
      ? completion.budget.settlement
      : null;
  if (settlement !== null && settlement !== "settled") {
    failures.push(`${leg} hosted budget settlement is not settled`);
  }
  return {
    leg,
    target,
    provider: typeof completion.provider === "string" ? completion.provider : null,
    modelIdentity:
      typeof completion.modelIdentity === "string" ? completion.modelIdentity : null,
    modelIdentityPinned: completion.modelIdentityPinned === true,
    usage:
      failures.some((failure) => failure.includes("usage telemetry"))
        ? null
        : {
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            cacheReadTokens: usage.cacheReadTokens,
            cacheWriteTokens: usage.cacheWriteTokens,
          },
    actualCostUsd:
      cost !== null && typeof cost === "object" && finiteNonNegative(cost.actualUsd)
        ? cost.actualUsd
        : null,
    budgetSettlement: settlement,
    failures,
  };
}

export function evaluateRoundTripCase(input) {
  const response = input?.response;
  const expected = input?.expected;
  const failures = [];
  if (response === null || typeof response !== "object") {
    return {
      id: String(input?.id ?? "unknown"),
      pass: false,
      failures: ["round-trip response missing"],
      quality: { score: 0, matched: 0, total: 0, parsed: null },
      economics: {
        modelCalls: 0,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        actualCostUsd: 0,
      },
      transport: { hydratedBytes: 0, returnedBytes: 0 },
      durationMs: null,
      completions: [],
    };
  }

  if (response.state !== "SUCCEEDED") failures.push("round-trip state is not SUCCEEDED");
  if (response.replayed === true) failures.push("measured evidence must not be a replay");
  if (response.responseMode !== "full" && response.responseMode !== "delta") {
    failures.push("responseMode is invalid");
  }

  const quality = scoreReply(String(response?.handback?.finalReply ?? ""), expected ?? {});
  if (quality.score < 1) failures.push(`final quality score ${quality.score} < 1`);

  const completions = [
    completionEvidence(response?.child?.completion, "child", response?.child?.target ?? null),
  ];
  if (response.responseMode === "delta") {
    completions.push(
      completionEvidence(
        response?.handback?.parentCompletion,
        "parent",
        response?.handback?.parentTarget ?? null,
      ),
    );
  } else if (response?.handback?.parentCompletion !== null) {
    failures.push("full response unexpectedly contains parent completion");
  }

  for (const completion of completions) failures.push(...completion.failures);

  const modelCalls = completions.length;
  const expectedCalls = response.responseMode === "delta" ? 2 : 1;
  if (modelCalls !== expectedCalls) {
    failures.push(`model call evidence ${modelCalls} != expected ${expectedCalls}`);
  }

  const economics = completions.reduce(
    (total, completion) => ({
      modelCalls: total.modelCalls + 1,
      inputTokens: total.inputTokens + Number(completion.usage?.inputTokens ?? 0),
      outputTokens: total.outputTokens + Number(completion.usage?.outputTokens ?? 0),
      cacheReadTokens:
        total.cacheReadTokens + Number(completion.usage?.cacheReadTokens ?? 0),
      cacheWriteTokens:
        total.cacheWriteTokens + Number(completion.usage?.cacheWriteTokens ?? 0),
      actualCostUsd: total.actualCostUsd + Number(completion.actualCostUsd ?? 0),
    }),
    {
      modelCalls: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      actualCostUsd: 0,
    },
  );

  const hydratedBytes = Number(response?.child?.hydratedBytes ?? 0);
  const returnedBytes = Number(response?.returnedResult?.evidence?.replyBytes ?? 0);
  if (!finiteNonNegative(hydratedBytes)) failures.push("hydrated byte evidence invalid");
  if (!finiteNonNegative(returnedBytes)) failures.push("returned byte evidence invalid");

  const durationMs =
    input.durationMs === undefined || input.durationMs === null
      ? null
      : Number(input.durationMs);
  if (durationMs !== null && !finiteNonNegative(durationMs)) {
    failures.push("durationMs must be finite and nonnegative when supplied");
  }

  return {
    id: String(input?.id ?? "unknown"),
    pass: failures.length === 0,
    failures,
    responseMode: response.responseMode,
    quality,
    economics,
    transport: {
      hydratedBytes: finiteNonNegative(hydratedBytes) ? hydratedBytes : 0,
      returnedBytes: finiteNonNegative(returnedBytes) ? returnedBytes : 0,
    },
    durationMs: durationMs !== null && finiteNonNegative(durationMs) ? durationMs : null,
    completions,
  };
}

export function evaluateRoundTripEvidence(cases) {
  if (!Array.isArray(cases) || cases.length === 0) {
    throw new Error("Batch 5 evidence requires at least one case");
  }
  const evaluated = cases.map(evaluateRoundTripCase);
  const totals = evaluated.reduce(
    (total, item) => ({
      modelCalls: total.modelCalls + item.economics.modelCalls,
      inputTokens: total.inputTokens + item.economics.inputTokens,
      outputTokens: total.outputTokens + item.economics.outputTokens,
      cacheReadTokens: total.cacheReadTokens + item.economics.cacheReadTokens,
      cacheWriteTokens: total.cacheWriteTokens + item.economics.cacheWriteTokens,
      actualCostUsd: total.actualCostUsd + item.economics.actualCostUsd,
      hydratedBytes: total.hydratedBytes + item.transport.hydratedBytes,
      returnedBytes: total.returnedBytes + item.transport.returnedBytes,
    }),
    {
      modelCalls: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      actualCostUsd: 0,
      hydratedBytes: 0,
      returnedBytes: 0,
    },
  );
  const qualityPasses = evaluated.filter((item) => item.quality.score === 1).length;
  return {
    format: "ecorione.ecx-round-trip-b5-evidence/v1",
    pass: evaluated.every((item) => item.pass),
    caseCount: evaluated.length,
    quality: {
      exactPasses: qualityPasses,
      exactPassRate: qualityPasses / evaluated.length,
    },
    economics: {
      ...totals,
      source: "Connect completion usage/cost telemetry preserved by Hub",
    },
    cases: evaluated,
    claimBoundary:
      "Bounded measured evidence only. Actual cost/token totals are reported as observed; this report does not establish universal quality, latency, production savings, or a counterfactual savings claim.",
  };
}

function main() {
  const path = process.argv[2];
  if (!path) {
    console.error("Usage: node scripts/ecx-round-trip-b5-evidence.mjs <evidence.json>");
    process.exitCode = 2;
    return;
  }
  const parsed = JSON.parse(readFileSync(resolve(path), "utf8"));
  const result = evaluateRoundTripEvidence(parsed?.cases);
  console.log(JSON.stringify(result, null, 2));
  if (!result.pass) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
