import { describe, expect, it } from "vitest";
import {
  acceptancePlan,
  evaluateRunningDoctor,
} from "../scripts/windows-engine-acceptance.mjs";

describe("W09/W10 Windows engine acceptance harness", () => {
  it("locks the required startup and doctor acceptance phases", () => {
    const plan = acceptancePlan();

    expect(plan.map((entry) => entry.id)).toEqual([
      "W09-A",
      "W10-A",
      "W09-B",
      "W10-B",
      "W09-C",
      "W09-D",
      "W10-C",
    ]);
    expect(plan.some((entry) => entry.name.includes("cold one-command startup"))).toBe(true);
    expect(plan.some((entry) => entry.name.includes("duplicate-start guard"))).toBe(true);
    expect(plan.some((entry) => entry.name.includes("process-tree cleanup"))).toBe(true);
  });

  it("requires Temporal, Ai, and every Phase 4 owner in a healthy runtime doctor", () => {
    const output = [
      "ECORIONE doctor",
      "✓ Node 22.20.0",
      "✓ pnpm 10.28.0",
      "✓ Temporal 127.0.0.1:7233",
      "✓ RnD",
      "✓ Context",
      "✓ Connect",
      "✓ Hub",
      "✓ Artifact",
      "✓ Sandbox",
      "✓ Space",
      "✓ Flow",
      "✓ Ai http://127.0.0.1:3000",
      "✓ Local AI runtime qwen3.5:9b · identity pinned local:test",
    ].join("\n");

    expect(evaluateRunningDoctor(output)).toEqual({
      pass: true,
      missing: [],
      localRuntime: "PASS",
    });
  });

  it("fails the runtime doctor contract when one required owner is missing", () => {
    const output = [
      "✓ Temporal 127.0.0.1:7233",
      "✓ RnD",
      "✓ Context",
      "✓ Connect",
      "✓ Hub",
      "✓ Artifact",
      "✓ Sandbox",
      "✓ Space",
      "✓ Ai http://127.0.0.1:3000",
      "· Local AI runtime belum dapat diuji (unreachable)",
    ].join("\n");

    expect(evaluateRunningDoctor(output)).toEqual({
      pass: false,
      missing: ["✓ Flow"],
      localRuntime: "UNAVAILABLE",
    });
  });

  it("keeps local-model availability separate from the core engine readiness gate", () => {
    const output = [
      "✓ Temporal 127.0.0.1:7233",
      "✓ RnD",
      "✓ Context",
      "✓ Connect",
      "✓ Hub",
      "✓ Artifact",
      "✓ Sandbox",
      "✓ Space",
      "✓ Flow",
      "✓ Ai http://127.0.0.1:3000",
      "! Local AI runtime test gagal (PROVIDER_UNREACHABLE)",
    ].join("\n");

    expect(evaluateRunningDoctor(output)).toEqual({
      pass: true,
      missing: [],
      localRuntime: "DEGRADED",
    });
  });
});
