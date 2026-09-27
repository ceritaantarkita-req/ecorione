import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(new URL("../" + path, import.meta.url), "utf8");
}

describe("ECX execution Batch 5 source contract", () => {
  it("retains Connect token/cost evidence in the bounded ECX completion contract", () => {
    const schema = source("packages/shared-schema/src/ecx.ts");
    expect(schema).toContain("EcxExecutionTokenUsageSchema");
    expect(schema).toContain("EcxExecutionCostSchema");
    expect(schema).toContain("EcxRoundTripTelemetrySchema");
    expect(schema).toContain("accountedModelCalls");
    expect(schema).toContain("refOmittedCount");
  });

  it("measures plan, hydration, recipient execution, and complete round-trip latency", () => {
    const exchange = source("services/hub/src/exchange-http.ts");
    expect(exchange).toContain("ecorione_ecx_plan_duration_ms");
    expect(exchange).toContain("ecorione_ecx_hydration_duration_ms");
    expect(exchange).toContain("ecorione_ecx_execution_duration_ms");
    expect(exchange).toContain("ecorione_ecx_round_trip_duration_ms");
    expect(exchange).toContain("ecorione_ecx_parent_continuation_duration_ms");
  });

  it("records outcome/replay/reference evidence without creating durable telemetry storage", () => {
    const exchange = source("services/hub/src/exchange-http.ts");
    const db = source("services/hub/src/db.ts");
    expect(exchange).toContain("ecorione_ecx_execution_outcomes_total");
    expect(exchange).toContain("ecorione_ecx_round_trip_outcomes_total");
    expect(exchange).toContain("ecorione_ecx_reference_denial_events_total");
    expect(exchange).toContain("ecorione_ecx_execution_replays_total");
    expect(exchange).toContain("ecorione_ecx_round_trip_replays_total");
    expect(db).not.toContain("ecx_telemetry");
    expect(db).not.toContain("ecx_observability");
  });

  it("preserves the closed single-recipient boundary", () => {
    const exchange = source("services/hub/src/exchange-http.ts");
    expect(exchange).not.toContain("/v1/exchange/aggregate");
    expect(exchange).not.toContain("Promise.all(input.packets");
    expect(exchange).not.toContain("agent.result.merge");
    expect(exchange).not.toContain("a2a");
  });
});
