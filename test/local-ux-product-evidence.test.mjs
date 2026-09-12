import { describe, expect, it } from "vitest";
import {
  NAV_ROUTES,
  UI_SURFACES,
  UX_WORKSPACE_ID,
  validateFlowSnapshot,
  validateMcpSettingsSnapshot,
  validateNavigationHtml,
  validateOpsSnapshot,
  validateRuntimeSnapshot,
  validateSpaceSnapshot,
  validateSurfaceHtml,
} from "../scripts/local-ux-product-evidence.mjs";

describe("local UX/product evidence guards", () => {
  it("mewajibkan lima surface utama Ai dan workspace lokal kanonik", () => {
    expect(NAV_ROUTES.map(([label]) => label)).toEqual([
      "Ai",
      "Space",
      "Flow",
      "Operations",
      "Settings",
    ]);
    expect(UI_SURFACES.map(([name]) => name)).toEqual([
      "ai",
      "space",
      "flow",
      "ops",
      "settings",
    ]);
    expect(UX_WORKSPACE_ID).toBe("ws_personal");
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
      mutableModelAlias: false,
    });
  });

  it("mencatat alias model mutable tanpa mengubahnya menjadi failure UX", () => {
    expect(
      validateRuntimeSnapshot({
        settings: {
          localRuntime: "openai-compatible",
          localModelTag: "gemma4:latest",
          hostedCallsEnabled: false,
        },
      }).mutableModelAlias,
    ).toBe(true);
  });

  it("mewajibkan global navigation dan contract proxy utama", () => {
    const navHtml = NAV_ROUTES.map(([label, href]) => `<a href="${href}">${label}</a>`).join(
      "",
    );
    expect(() => validateNavigationHtml(navHtml)).not.toThrow();
    expect(() => validateNavigationHtml('<a href="/">Ai</a>')).toThrow(/Global navigation/);

    expect(() => validateOpsSnapshot({ healthy: true, services: [] })).not.toThrow();
    expect(() => validateOpsSnapshot({ healthy: false, services: [] })).toThrow(/healthy=true/);
    expect(() => validateMcpSettingsSnapshot({ servers: [] })).not.toThrow();
    expect(() => validateMcpSettingsSnapshot({})).toThrow(/servers array/);
    expect(() => validateSpaceSnapshot({ pages: [] })).not.toThrow();
    expect(() => validateSpaceSnapshot({})).toThrow(/pages array/);
    expect(() => validateFlowSnapshot({ nodes: [] })).not.toThrow();
    expect(() => validateFlowSnapshot({})).toThrow(/nodes array/);
  });

  it("mewajibkan marker halaman, menerima entity SSR, dan menolak framework error marker", () => {
    expect(() =>
      validateSurfaceHtml("ai", "<h1>ecorione — Ai</h1>", "ecorione — Ai"),
    ).not.toThrow();
    expect(() =>
      validateSurfaceHtml(
        "ops",
        "<h1>Runtime health &amp; telemetry</h1>",
        "Runtime health & telemetry",
      ),
    ).not.toThrow();
    expect(() =>
      validateSurfaceHtml("ops", "Application error", "Runtime health & telemetry"),
    ).toThrow();
  });
});
