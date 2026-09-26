import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("PCS-05 Flow runtime closure source contract", () => {
  const workflow = readFileSync("services/flow/src/workflows.ts", "utf8");
  const flowHttp = readFileSync("services/flow/src/http.ts", "utf8");
  const flowUi = [
    readFileSync("apps/ai/app/flow/page.tsx", "utf8"),
    readFileSync("apps/ai/app/flow/FlowPageSections.tsx", "utf8"),
  ].join("\n");

  it("registers graph query handlers before the first awaited lifecycle activity", () => {
    const queryHandler = workflow.indexOf("setHandler(graphRunStateQuery, state)");
    const startedTrace = workflow.indexOf('name: "flow.graph.run.started"');
    expect(queryHandler).toBeGreaterThan(0);
    expect(startedTrace).toBeGreaterThan(queryHandler);
  });

  it("preflights exact node authority before Temporal graph start", () => {
    const preflight = flowHttp.indexOf("await authorizeGraphPlanBeforeStart");
    const temporalStart = flowHttp.indexOf("await graphTemporal.startGraph");
    expect(preflight).toBeGreaterThan(0);
    expect(temporalStart).toBeGreaterThan(preflight);
    expect(flowHttp).toContain('"FLOW_NODE_AUTHORITY_DENIED"');
  });

  it("keeps missing standing authority behind explicit Hub approval", () => {
    expect(flowHttp).toContain("/v1/authority/grants");
    expect(flowHttp).toContain("AUTHORITY_APPROVAL_REQUIRED");
    expect(flowHttp).toContain("/v1/approvals/");
    expect(flowHttp).not.toContain("autoGrant");
  });

  it("makes authority readiness explicit in Flow UI before Run", () => {
    expect(flowUi).toContain("Prepare authority");
    expect(flowUi).toContain("Execution authority ready");
    expect(flowUi).toContain("Approval required");
    expect(flowUi).toContain('decideAuthority(requirement, "APPROVE")');
    expect(flowUi).toContain("authority.ready !== true");
  });
});
