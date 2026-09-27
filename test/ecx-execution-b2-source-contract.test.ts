import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("ECX execution Batch 2 source contract", () => {
  it("keeps the receipt as a bounded dispatch guard rather than a second history store", () => {
    const db = source("services/hub/src/db.ts");
    expect(db).toContain("CREATE TABLE IF NOT EXISTS ecx_execution_receipts");
    expect(db).toContain(
      "state TEXT NOT NULL CHECK(state IN ('STARTED','SUCCEEDED','FAILED','UNCERTAIN'))",
    );
    expect(db).not.toContain("ecx_execution_events");
  });

  it("claims dispatch before Connect and blocks automatic retry after uncertainty", () => {
    const exchange = source("services/hub/src/exchange-http.ts");
    const claim = exchange.indexOf("executions.claimDispatch");
    const connect = exchange.indexOf("${options.connectUrl}/v1/complete");
    expect(claim).toBeGreaterThan(0);
    expect(connect).toBeGreaterThan(claim);
    expect(exchange).toContain("ECX_EXECUTION_UNCERTAIN");
    expect(exchange).toContain("ECX_EXECUTION_FAILED");
  });

  it("records only bounded lifecycle metadata in Historical Ledger", () => {
    const history = source("packages/shared-schema/src/history.ts");
    expect(history).toContain('"agent.execution.started"');
    expect(history).toContain('"agent.execution.succeeded"');
    expect(history).toContain('"agent.execution.failed"');
    expect(history).toContain('"agent.execution.uncertain"');
    const exchange = source("services/hub/src/exchange-http.ts");
    expect(exchange).not.toContain("reply: response.completion.reply");
  });

  it("keeps the Batch 2 execution primitive single-recipient while later batches compose above it", () => {
    const exchange = source("services/hub/src/exchange-http.ts");
    expect(exchange).toContain("const executeRecipient = async");
    expect(exchange).toContain("executions.claimDispatch");
    expect(exchange).not.toContain("Promise.all(input.packets");
    expect(exchange).not.toContain("/v1/exchange/aggregate");
    expect(exchange).not.toContain("agent.result.merge");
  });
});
