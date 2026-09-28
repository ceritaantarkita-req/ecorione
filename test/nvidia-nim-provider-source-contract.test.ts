import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("NVIDIA NIM provider source contract", () => {
  const providerTypes = readFileSync("services/connect/src/provider-types.ts", "utf8");
  const catalog = readFileSync("services/connect/src/hosted-model-catalog.ts", "utf8");
  const adapter = readFileSync("services/connect/src/providers/nvidia.ts", "utf8");
  const http = readFileSync("services/connect/src/http.ts", "utf8");
  const hosted = readFileSync("services/connect/src/providers/hosted.ts", "utf8");
  const controller = readFileSync("apps/ai/app/settings/useSettingsController.ts", "utf8");
  const chat = readFileSync("apps/ai/app/page.tsx", "utf8");
  const secretScan = readFileSync("scripts/secret-scan.mjs", "utf8");

  it("pins NVIDIA to the intended hosted API Catalog boundary", () => {
    expect(providerTypes).toContain('"nvidia"');
    expect(providerTypes).toContain('"NVIDIA_API_KEY"');
    expect(adapter).toContain("https://integrate.api.nvidia.com/v1/chat/completions");
    expect(adapter).toContain('"z-ai/glm-5.3"');
    expect(catalog).toContain('displayName: "GLM-5.3"');
    expect(hosted).toContain('case "nvidia"');
  });

  it("keeps free-prototype accounting explicit instead of silently bypassing spend control", () => {
    expect(adapter).toContain("NVIDIA_FREE_ENDPOINT_MIN_RESERVATION_USD");
    expect(adapter).toContain("0.000001");
    expect(adapter).toContain("estimateOpenAiCompatibleReservationUsd");
  });

  it("bounds NVIDIA credential and canary probes instead of allowing indefinite tests", () => {
    expect(adapter).toContain("NVIDIA_PROVIDER_PROBE_MAX_OUTPUT_TOKENS = 1024");
    expect(http).toContain("DEFAULT_CREDENTIAL_TEST_TIMEOUT_MS = 60_000");
    expect(http).toContain('"PROVIDER_TEST_TIMEOUT"');
    expect(http).toContain('hostedReasoningEffort: "low"');
  });

  it("exposes NVIDIA through normal Settings and Ai route labels", () => {
    expect(controller).toContain('| "nvidia"');
    expect(controller).toContain('provider.id === "nvidia"');
    expect(controller).toContain('"z-ai/glm-5.3"');
    expect(chat).toContain('case "nvidia"');
    expect(chat).toContain('return "NVIDIA"');
    expect(chat).toContain('return "GLM-5.3"');
  });

  it("extends committed-secret protection to NVIDIA API keys", () => {
    expect(secretScan).toContain("NVIDIA API key");
    expect(secretScan).toContain("nvapi-");
  });
});
