import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  NAV_ROUTES,
  UI_SURFACES,
  UX_WORKSPACE_ID,
  hydrateInventoryToken,
  validateFlowSnapshot,
  validateMcpSettingsSnapshot,
  validateNavigationHtml,
  validateOpsSnapshot,
  validateRuntimeSnapshot,
  validateSpaceSnapshot,
  validateSurfaceHtml,
} from "../scripts/local-ux-product-evidence.mjs";

const DIGEST = `sha256:${"d".repeat(64)}`;

describe("local UX/product evidence guards", () => {
  it("mewajibkan surface utama termasuk Projects dan Work serta workspace lokal kanonik", () => {
    expect(NAV_ROUTES.map(([label]) => label)).toEqual([
      "Ai",
      "Projects",
      "Work",
      "Brain",
      "Space",
      "Flow",
      "Operations",
      "Settings",
    ]);
    expect(UI_SURFACES.map(([name]) => name)).toEqual([
      "ai",
      "projects",
      "work",
      "brain",
      "space",
      "flow",
      "ops",
      "settings",
    ]);
    expect(UX_WORKSPACE_ID).toBe("ws_personal");
  });

  it("mengambil internal token dari root .env tanpa menimpa shell yang sudah terisi", () => {
    const root = mkdtempSync(join(tmpdir(), "ecorione-ux-env-"));
    try {
      writeFileSync(
        join(root, ".env"),
        "ECORIONE_INTERNAL_TOKEN=from-file\nECORIONE_COST_KILL_SWITCH=0\n",
      );

      const emptyEnv = {};
      expect(hydrateInventoryToken(emptyEnv, root)).toBe(true);
      expect(emptyEnv.ECORIONE_INTERNAL_TOKEN).toBe("from-file");
      expect(emptyEnv.ECORIONE_COST_KILL_SWITCH).toBeUndefined();

      const explicitEnv = { ECORIONE_INTERNAL_TOKEN: "from-shell" };
      expect(hydrateInventoryToken(explicitEnv, root)).toBe(false);
      expect(explicitEnv.ECORIONE_INTERNAL_TOKEN).toBe("from-shell");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("tidak menganggap token tersedia jika .env hilang atau kosong", () => {
    const root = mkdtempSync(join(tmpdir(), "ecorione-ux-env-empty-"));
    try {
      const env = {};
      expect(hydrateInventoryToken(env, root)).toBe(false);
      writeFileSync(join(root, ".env"), "ECORIONE_INTERNAL_TOKEN=\n");
      expect(hydrateInventoryToken(env, root)).toBe(false);
      expect(env.ECORIONE_INTERNAL_TOKEN).toBeUndefined();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fail closed jika hosted calls masih efektif aktif", () => {
    expect(() =>
      validateRuntimeSnapshot({
        revision: 1,
        settings: {
          localRuntime: "openai-compatible",
          localModelTag: "local-model",
          localModelDigest: DIGEST,
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
          localModelDigest: DIGEST,
          hostedCallsEnabled: false,
        },
      }),
    ).toEqual({
      hostedCallsEnabled: false,
      localRuntime: "openai-compatible",
      localModelTag: "local-model",
      localModelDigest: DIGEST,
      modelIdentity: `local:openai-compatible:local-model@${DIGEST}`,
      mutableModelAlias: false,
    });
  });

  it("menolak durable evidence jika digest model lokal belum dipin", () => {
    expect(() =>
      validateRuntimeSnapshot({
        settings: {
          localRuntime: "openai-compatible",
          localModelTag: "local-model",
          hostedCallsEnabled: false,
        },
      }),
    ).toThrow(/localModelDigest/);
  });

  it("mencatat alias model mutable tanpa mengubahnya menjadi failure UX", () => {
    expect(
      validateRuntimeSnapshot({
        settings: {
          localRuntime: "openai-compatible",
          localModelTag: "gemma4:latest",
          localModelDigest: DIGEST,
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
