import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(new URL("../" + path, import.meta.url), "utf8");
}

describe("ECX execution Batch 3 source contract", () => {
  it("keeps round-trip state as a bounded receipt rather than a second event store", () => {
    const db = source("services/hub/src/db.ts");
    expect(db).toContain("CREATE TABLE IF NOT EXISTS ecx_round_trip_receipts");
    expect(db).not.toContain("ecx_round_trip_events");
  });

  it("reuses the Batch 2 execution primitive before composing parent handback", () => {
    const exchange = source("services/hub/src/exchange-http.ts");
    expect(exchange).toContain('"/v1/exchange/round-trip"');
    expect(exchange).toContain("const executeRecipient = async");
    const child = exchange.indexOf("const child = await executeRecipient(input)");
    const receipt = exchange.indexOf("roundTrips.begin({");
    expect(child).toBeGreaterThan(0);
    expect(receipt).toBeGreaterThan(child);
  });

  it("gives delta and full distinct runtime semantics", () => {
    const exchange = source("services/hub/src/exchange-http.ts");
    expect(exchange).toContain('input.packet.responseMode === "full"');
    expect(exchange).toContain("parentContinued: false");
    expect(exchange).toContain('finalSource: "recipient"');
    expect(exchange).toContain("roundTrips.claimContinuation");
    expect(exchange).toContain("parentContinued: true");
    expect(exchange).toContain('finalSource: "sender"');
  });

  it("keeps returned result content out of bounded Ledger provenance", () => {
    const exchange = source("services/hub/src/exchange-http.ts");
    expect(exchange).toContain("replySha256");
    expect(exchange).toContain("replyBytes");
    expect(exchange).not.toContain("payload: { childReply:");
  });

  it("does not open fan-out, aggregation, A2A, UI, or retention scope", () => {
    const exchange = source("services/hub/src/exchange-http.ts");
    expect(exchange).not.toContain("Promise.all(input.packets");
    expect(exchange).not.toContain("/v1/exchange/aggregate");
    expect(exchange).not.toContain("agent.result.merge");
    expect(exchange).not.toContain("a2a");
  });
});
