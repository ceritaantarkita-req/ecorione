import { describe, expect, it } from "vitest";
import { recordCall, tokenUsage } from "./cost.js";

describe("provider-reported cost override", () => {
  const base = {
    model: "claude-sonnet-4-5-20250929" as const,
    usage: tokenUsage({ inputTokens: 100, outputTokens: 20 }),
    routeReason: "default-hosted",
    policyVersion: "3",
    optimizerOverheadMs: 0,
  } as const;

  it("authoritative provider billed cost menggantikan token-price estimate", () => {
    const record = recordCall({ ...base, actualUsdOverride: 0.0042 });
    expect(record.actualUsd).toBe(0.0042);
  });

  it("override invalid ditolak", () => {
    expect(() => recordCall({ ...base, actualUsdOverride: -1 })).toThrow();
    expect(() => recordCall({ ...base, actualUsdOverride: Number.NaN })).toThrow();
  });
});
