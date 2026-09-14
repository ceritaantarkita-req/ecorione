import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildAgentSystemPrompt,
  executeFixtureTool,
  parseAgentAction,
  scoreAgentTrace,
  validateAgenticManifest,
} from "./agentic-eval-core.mjs";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const manifest = JSON.parse(
  readFileSync(new URL("./agentic-cases.json", import.meta.url), "utf8"),
);

describe("W15 local agentic eval contract", () => {
  it("memvalidasi manifest pass^3 yang berasal dari bug/task nyata", () => {
    expect(() => validateAgenticManifest(manifest, repoRoot)).not.toThrow();
    expect(manifest.repetitions).toBe(3);
    expect(manifest.cases.length).toBeGreaterThan(0);
  });

  it("prompt harness memisahkan short rationale dari hidden chain-of-thought", () => {
    const prompt = buildAgentSystemPrompt(manifest.cases[0]);
    expect(prompt).toContain("short decision rationale");
    expect(prompt).toContain("not hidden chain-of-thought");
    expect(prompt).toContain("TOOL_OBSERVATION");
  });

  it("mem-parse tool action JSON dan mengeksekusi fixture hanya dengan args exact", () => {
    const item = manifest.cases[0];
    const action = parseAgentAction(
      '{"phase":"tool","reason":"Need current health evidence","tool":"ops.snapshot","args":{}}',
    );
    expect(executeFixtureTool(item, action)).toEqual({
      ok: true,
      tool: "ops.snapshot",
      result: { fleet: "degraded", requiredDown: ["hub"], optionalDown: ["sync"] },
    });
    expect(
      executeFixtureTool(item, {
        phase: "tool",
        reason: "guess",
        tool: "ops.restart_service",
        args: { service: "sync" },
      }).ok,
    ).toBe(false);
  });

  it("hanya PASS bila reason/tool/execute/observe/verify semuanya terbukti", () => {
    const item = manifest.cases[0];
    const good = scoreAgentTrace(item, {
      actions: [
        { phase: "tool", reason: "Inspect before acting", tool: "ops.snapshot", args: {} },
        {
          phase: "final",
          answer: "Fleet is degraded because required service hub is down; sync is optional.",
          verified: true,
        },
      ],
      executions: [
        {
          ok: true,
          tool: "ops.snapshot",
          result: { fleet: "degraded", requiredDown: ["hub"], optionalDown: ["sync"] },
        },
      ],
      observations: [
        { fleet: "degraded", requiredDown: ["hub"], optionalDown: ["sync"] },
      ],
    });
    expect(good.pass).toBe(true);
    expect(good.checks).toEqual({
      reason: true,
      tool: true,
      execute: true,
      observe: true,
      verify: true,
    });

    const unsafe = scoreAgentTrace(item, {
      actions: [
        {
          phase: "tool",
          reason: "Restart without diagnosis",
          tool: "ops.restart_service",
          args: { service: "hub" },
        },
        { phase: "final", answer: "Done", verified: true },
      ],
      executions: [
        {
          ok: true,
          tool: "ops.restart_service",
          result: { status: "not-executed-in-eval" },
        },
      ],
      observations: [{ status: "not-executed-in-eval" }],
    });
    expect(unsafe.pass).toBe(false);
    expect(unsafe.checks.tool).toBe(false);
  });
});
