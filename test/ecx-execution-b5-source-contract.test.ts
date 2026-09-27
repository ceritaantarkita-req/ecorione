import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(new URL("../" + path, import.meta.url), "utf8");
}

describe("ECX execution Batch 5 source contract", () => {
  it("preserves Connect usage/cost evidence before Hub round-trip aggregation", () => {
    const schema = source("packages/shared-schema/src/ecx.ts");
    expect(schema).toContain("EcxCompletionUsageSchema");
    expect(schema).toContain("EcxCompletionCostSchema");
    expect(schema).toContain("EcxCompletionBudgetSchema");
  });

  it("records actual round-trip economics without deriving savings from transport bytes", () => {
    const exchange = source("services/hub/src/exchange-http.ts");
    expect(exchange).toContain("ecorione_ecx_round_trip_actual_cost_usd_total");
    expect(exchange).toContain("ecorione_ecx_round_trip_input_tokens_total");
    expect(exchange).toContain("ecorione_ecx_round_trip_duration_ms");
    expect(exchange).not.toContain("ecorione_ecx_round_trip_savings");
    expect(exchange).not.toContain("ecorione_ecx_round_trip_saved_usd");
  });

  it("does not double-count provider economics on replay", () => {
    const exchange = source("services/hub/src/exchange-http.ts");
    const replay = exchange.indexOf("ecorione_ecx_round_trip_replays_total");
    const success = exchange.indexOf("recordRoundTripSuccessTelemetry");
    expect(replay).toBeGreaterThan(0);
    expect(success).toBeGreaterThan(0);
    expect(exchange.slice(replay, replay + 900)).not.toContain(
      "recordRoundTripCompletionTelemetry",
    );
  });

  it("keeps Batch 5 evidence offline and explicitly bounded", () => {
    const evidence = source("scripts/ecx-round-trip-b5-evidence.mjs");
    expect(evidence).toContain("scoreReply");
    expect(evidence).toContain("Actual cost/token totals are reported as observed");
    expect(evidence).toContain("does not establish universal quality");
    expect(evidence).not.toContain("fetch(");
    expect(evidence).not.toContain("savedUsd");
    expect(evidence).not.toContain("savedPct");
  });

  it("does not open a new analytics DB, fan-out path, A2A, or ECX UI", () => {
    const exchange = source("services/hub/src/exchange-http.ts");
    const db = source("services/hub/src/db.ts");
    expect(db).not.toContain("ecx_round_trip_metrics");
    expect(exchange).not.toContain("/v1/exchange/aggregate");
    expect(exchange).not.toContain("agent.result.merge");
    expect(exchange.toLowerCase()).not.toContain("a2a");
  });
});
