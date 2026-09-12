import { describe, expect, it } from "vitest";
import {
  UI_SURFACES,
  validateRuntimeSnapshot,
  validateSurfaceHtml,
} from "../scripts/local-ux-product-evidence.mjs";

describe("local UX/product evidence guards", () => {
  it("mewajibkan lima surface utama Ai", () => {
    expect(UI_SURFACES.map(([name]) => name)).toEqual([
      "ai",
      "space",
      "flow",
      "ops",
      "settings",
    ]);
  });

  it("fail closed jika hosted calls masih efektif aktif", () => {
    expect(() =>
      validateRuntimeSnapshot({
        revision: 1,
        settings: {
          localRuntime: "openai-compatible",
          localModelTag: "local-model",
          hostedCallsEnabled: true,
        },
      }),
    ).toThrow(/Hosted calls harus efektif OFF/);
  });

  it("menerima runtime local-only yang aman", () => {
    expect(
      validateRuntimeSnapshot({
        revision: 2,
        settings: {
          localRuntime: "openai-compatible",
          localModelTag: "local-model",
          hostedCallsEnabled: false,
        },
      }),
    ).toEqual({
      hostedCallsEnabled: false,
      localRuntime: "openai-compatible",
      localModelTag: "local-model",
    });
  });

  it("mewajibkan marker halaman dan menolak framework error marker", () => {
    expect(() =>
      validateSurfaceHtml("ai", "<h1>ecorione — Ai</h1>", "ecorione — Ai"),
    ).not.toThrow();
    expect(() =>
      validateSurfaceHtml("ops", "Application error", "Runtime health & telemetry"),
    ).toThrow();
  });
});
