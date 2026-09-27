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

  it("does not add batch-2 idempotency/provenance or multi-recipient execution", () => {
    const db = source("services/hub/src/db.ts");
    expect(db).not.toContain("ecx_execution_receipts");
    const exchange = source("services/hub/src/exchange-http.ts");
    expect(exchange).not.toContain("agent.execution.started");
    expect(exchange).not.toContain("Promise.all(input.packets");
  });
});
