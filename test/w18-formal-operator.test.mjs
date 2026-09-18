import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertFormalAuthorizationUnused,
  assertFormalBudgetReadiness,
  buildFormalRuntimeEnv,
  computeFormalDailyCeiling,
  consumeFormalAuthorization,
  formalAuthorizationMarkerPath,
  W18_FORMAL_AUTHORIZED_MAX_USD,
} from "../scripts/w18-formal-operator.mjs";

function spend(overrides = {}) {
  return {
    day: "2026-09-18",
    month: "2026-09",
    dailyCommittedUsd: 0.160104,
    monthlyCommittedUsd: 0.160104,
    unsettledReservations: 1,
    dailyUsd: 1,
    monthlyUsd: 10,
    dailyHeadroomUsd: 0.839896,
    monthlyHeadroomUsd: 9.839896,
    effectiveHeadroomUsd: 0.839896,
    ...overrides,
  };
}

describe("W18 formal operator wrapper", () => {
  it("derives the current UTC-day ceiling from committed + authorization", () => {
    expect(computeFormalDailyCeiling(0.160104)).toBe(0.410104);
  });

  it("refuses a cap above the current explicit authorization", () => {
    expect(() => computeFormalDailyCeiling(0.1, 0.251)).toThrow(/otorisasi saat ini/);
  });

  it("requires monthly headroom for the full formal allowance", () => {
    expect(() => assertFormalBudgetReadiness(spend({ monthlyHeadroomUsd: 0.249 }))).toThrow(
      /monthly headroom/,
    );
  });

  it("refuses execution when completed 20-call PASS evidence already exists", () => {
    const root = mkdtempSync(join(tmpdir(), "ecorione-w18-completed-"));
    try {
      const evidenceDir = join(root, ".ecorione", "evidence");
      mkdirSync(evidenceDir, { recursive: true });
      writeFileSync(
        join(evidenceDir, "w18-hosted-economics-2026-09-18T02-15-34-405Z.summary.json"),
        JSON.stringify({
          closureEligible: true,
          evidence: {
            aggregate: {
              pass: true,
              measuredModelCalls: 20,
              actualRunSpendUsd: 0.091596,
            },
          },
        }),
      );

      expect(() => assertFormalAuthorizationUnused(root)).toThrow(/PASS evidence sudah ada/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("consumes the single-attempt authorization atomically before dispatch", () => {
    const root = mkdtempSync(join(tmpdir(), "ecorione-w18-marker-"));
    try {
      const consumed = consumeFormalAuthorization({
        root,
        repository: {
          branch: "main",
          head: "abc123",
          originMain: "abc123",
          clean: true,
        },
        spendBefore: spend({ dailyCommittedUsd: 0, monthlyCommittedUsd: 0.160104 }),
        now: new Date("2026-09-18T02:18:00.000Z"),
      });

      expect(consumed.authorizationId).toMatch(/single-attempt/);
      expect(existsSync(formalAuthorizationMarkerPath(root))).toBe(true);
      expect(() =>
        consumeFormalAuthorization({
          root,
          repository: { branch: "main", head: "abc123", originMain: "abc123", clean: true },
          spendBefore: spend(),
          now: new Date("2026-09-18T02:19:00.000Z"),
        }),
      ).toThrow(/sudah dikonsumsi/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("builds ephemeral fail-closed formal runtime overrides without mutating input", () => {
    const base = {
      ECORIONE_INTERNAL_TOKEN: "test-token",
      ECORIONE_COST_KILL_SWITCH: "1",
      ECORIONE_SPEND_DAILY_USD: "1",
      ECORIONE_SPEND_MONTHLY_USD: "10",
    };
    const next = buildFormalRuntimeEnv(base, spend());
    expect(base.ECORIONE_COST_KILL_SWITCH).toBe("1");
    expect(next).toMatchObject({
      ECORIONE_COST_KILL_SWITCH: "0",
      ECORIONE_OPENROUTER_PROVIDER_ONLY: "anthropic",
      ECORIONE_SPEND_DAILY_USD: "0.410104",
      ECORIONE_W18_ALLOW_SPEND: "YES",
      ECORIONE_W18_MAX_SPEND_USD: W18_FORMAL_AUTHORIZED_MAX_USD.toFixed(2),
      ECORIONE_ENGINE_NO_OPEN: "1",
    });
  });
});
