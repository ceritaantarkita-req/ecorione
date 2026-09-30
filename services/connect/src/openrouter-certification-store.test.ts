import { mkdtempSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FileOpenRouterCertificationStore } from "./openrouter-certification-store.js";

describe("FileOpenRouterCertificationStore", () => {
  it("persists non-secret bounded validation evidence by model id", () => {
    const path = join(mkdtempSync(join(tmpdir(), "ecorione-openrouter-cert-")), "records.json");
    const store = new FileOpenRouterCertificationStore(path);
    store.record({
      modelId: "qwen/qwen3.8-27b",
      certifiedAt: "2026-09-29T00:00:00.000Z",
      catalogFetchedAt: "2026-09-29T00:00:00.000Z",
      responseModel: "qwen/qwen3.8-27b",
      routingProvider: "example-provider",
      latencyMs: 123.4,
      billedCostUsd: 0.0001,
      promptPricePerToken: "0.0000000449",
      completionPricePerToken: "0.0000044",
    });
    expect(store.get("qwen/qwen3.8-27b")).toMatchObject({ billedCostUsd: 0.0001 });
    expect(store.get("deepseek/deepseek-v4-pro")).toBeUndefined();
    if (process.platform !== "win32") expect(statSync(path).mode & 0o777).toBe(0o600);
  });
});