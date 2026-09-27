import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("ECX recipient execution foundation source contract", () => {
  it("keeps runtime execution inside Hub -> Connect with explicit agent authority", () => {
    const exchange = source("services/hub/src/exchange-http.ts");
    expect(exchange).toContain('"/v1/exchange/execute"');
    expect(exchange).toContain('subject: { kind: "agent", id: input.packet.recipient }');
    expect(exchange).toContain("CapabilityAuthorizationRequestSchema.parse");
    expect(exchange).toContain("${options.connectUrl}/v1/complete");
  });

  it("derives hosted hydration eligibility from the durable recipient binding", () => {
    const exchange = source("services/hub/src/exchange-http.ts");
    expect(exchange).toContain('hostedEligible: binding.target === "hosted"');
    const db = source("services/hub/src/db.ts");
    expect(db).toContain("CREATE TABLE IF NOT EXISTS ecx_agent_bindings");
  });

  it("preserves the Batch 1 ownership boundary as Batch 2 adds bounded execution receipts", () => {
    const db = source("services/hub/src/db.ts");
    expect(db).toContain("CREATE TABLE IF NOT EXISTS ecx_agent_bindings");
    expect(db).toContain("CREATE TABLE IF NOT EXISTS ecx_execution_receipts");
    expect(db).not.toContain("ecx_execution_events");

    const exchange = source("services/hub/src/exchange-http.ts");
    expect(exchange).toContain("agent.execution.started");
    const start = exchange.indexOf("const executeRecipient = async");
    const end = exchange.indexOf('app.post("/v1/exchange/execute"', start);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const primitive = exchange.slice(start, end);
    expect(primitive).not.toContain("Promise.allSettled");
    expect(primitive).not.toContain("fanouts.");
    expect(exchange).not.toContain("/v1/exchange/aggregate");
  });
});
