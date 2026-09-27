import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(new URL("../" + path, import.meta.url), "utf8");
}

describe("ECX execution Batch 7 source contract", () => {
  it("bounds fan-out to coherent delta plans with two through eight recipients", () => {
    const schema = source("packages/shared-schema/src/ecx.ts");
    expect(schema).toContain("EcxFanoutRoundTripRequestSchema");
    expect(schema).toContain("z.array(EcxPacketSchema).min(2).max(8)");
    expect(schema).toContain("Batch 7 fan-out hanya menerima responseMode delta");
    expect(schema).toContain("Semua packet fan-out harus berasal dari satu coherent ECX plan");
  });

  it("composes above the Batch 2 recipient primitive instead of cloning execution ownership", () => {
    const exchange = source("services/hub/src/exchange-http.ts");
    const fanout = exchange.indexOf('app.post("/v1/exchange/fanout-round-trip"');
    expect(fanout).toBeGreaterThan(0);
    const route = exchange.slice(fanout);
    expect(route).toContain("Promise.allSettled");
    expect(route).toContain("executeRecipient(fanoutChildInput(input, packet))");
    expect(route).toContain("fanouts.claimContinuation");
    expect(route).not.toContain("executions.claimDispatch");
  });

  it("uses one durable fan-out receipt and one parent continuation", () => {
    const db = source("services/hub/src/db.ts");
    const store = source("services/hub/src/ecx-fanout-store.ts");
    const exchange = source("services/hub/src/exchange-http.ts");
    expect(db).toContain("CREATE TABLE IF NOT EXISTS ecx_fanout_receipts");
    expect(store).toContain("Fan-out parent continuation dispatch outcome pending.");
    expect(exchange).toContain("fanouts.begin({");
    expect(exchange).toContain("fanouts.claimContinuation");
    expect(exchange).toContain("synthesize all delegated deltas into one final answer");
  });

  it("reuses Batch 4 returned-result and hosted-parent isolation boundaries for every child", () => {
    const exchange = source("services/hub/src/exchange-http.ts");
    const fanout = exchange.indexOf('app.post("/v1/exchange/fanout-round-trip"');
    const route = exchange.slice(fanout);
    expect(route).toContain("validatedReturnedResult(childInput, child)");
    expect(route).toContain(
      "assertHostedParentResultIsolation(childInput, child, parent.target, ledger, options)",
    );
    expect(route).toContain("authorizeResultReceive(authority, firstChildInput, continuationId)");
  });

  it("bounds and hashes the aggregate before parent dispatch", () => {
    const schema = source("packages/shared-schema/src/ecx.ts");
    const exchange = source("services/hub/src/exchange-http.ts");
    expect(schema).toContain("ECX_FANOUT_AGGREGATE_MAX_BYTES = 131_072");
    expect(exchange).toContain("ECX_FANOUT_AGGREGATE_TOO_LARGE");
    expect(exchange).toContain("resultSetSha256");
    const evidence = exchange.indexOf("aggregateEvidence = fanoutAggregateEvidence");
    const claim = exchange.indexOf("fanouts.claimContinuation");
    expect(evidence).toBeGreaterThan(0);
    expect(claim).toBeGreaterThan(evidence);
  });

  it("keeps aggregate Ledger provenance bounded and does not create a new merge event type", () => {
    const history = source("packages/shared-schema/src/history.ts");
    const exchange = source("services/hub/src/exchange-http.ts");
    expect(history).not.toContain('"agent.result.merge"');
    expect(exchange).toContain('"agent.result.returned"');
    expect(exchange).toContain("aggregateEvidence: evidence");
    expect(exchange).not.toContain("reply: result.reply");
  });

  it("does not open A2A, Flow orchestration, or UI ownership", () => {
    const exchange = source("services/hub/src/exchange-http.ts");
    const schema = source("packages/shared-schema/src/ecx.ts");
    expect(exchange).not.toContain("/v1/a2a");
    expect(exchange).not.toContain("temporal");
    expect(schema).not.toContain("fanoutUi");
  });
});
