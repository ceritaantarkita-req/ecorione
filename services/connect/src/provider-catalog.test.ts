import { describe, expect, it } from "vitest";
import { HOSTED_PROVIDER_IDS } from "./provider-types.js";
import {
  AI_PROVIDER_IDS,
  CREDENTIAL_PROVIDER_IDS,
  PROVIDER_CATALOG,
  credentialPurposeForProvider,
} from "./provider-catalog.js";

describe("provider catalog", () => {
  it("mempunyai satu entry untuk setiap credential provider", () => {
    expect(PROVIDER_CATALOG.map((entry) => entry.id)).toEqual(CREDENTIAL_PROVIDER_IDS);
    expect(new Set(PROVIDER_CATALOG.map((entry) => entry.id)).size).toBe(
      PROVIDER_CATALOG.length,
    );
  });

  it("hanya provider hosted existing yang boleh dinyatakan routing/test ready", () => {
    const routingReady = PROVIDER_CATALOG.filter((entry) => entry.routingReady).map(
      (entry) => entry.id,
    );
    const testReady = PROVIDER_CATALOG.filter((entry) => entry.connectionTestReady).map(
      (entry) => entry.id,
    );
    const expectedHosted = [...HOSTED_PROVIDER_IDS].sort();
    expect([...routingReady].sort()).toEqual(expectedHosted);
    expect([...testReady].sort()).toEqual(expectedHosted);

    for (const provider of AI_PROVIDER_IDS) {
      const entry = PROVIDER_CATALOG.find((candidate) => candidate.id === provider);
      expect(entry?.credentialReady).toBe(true);
      expect(entry?.credentialPurpose).toBe("messages");
    }
  });

  it("NVIDIA tersedia sebagai hosted routing provider dengan satu model verified", () => {
    const nvidia = PROVIDER_CATALOG.find((entry) => entry.id === "nvidia");
    expect(nvidia).toMatchObject({
      displayName: "NVIDIA / NIM",
      category: "ai",
      credentialPurpose: "messages",
      credentialReady: true,
      routingReady: true,
      connectionTestReady: true,
    });
    expect(nvidia?.hostedModels.map((model) => model.id)).toEqual(["z-ai/glm-5.3"]);
  });

  it("MCP dan webhook tetap integration credentials dan bukan AI routing providers", () => {
    const mcp = PROVIDER_CATALOG.find((entry) => entry.id === "mcp");
    expect(mcp).toMatchObject({
      category: "integration",
      credentialPurpose: "tokens",
      routingReady: false,
      connectionTestReady: false,
    });
    const webhook = PROVIDER_CATALOG.find((entry) => entry.id === "webhook");
    expect(webhook).toMatchObject({
      category: "integration",
      credentialPurpose: "tokens",
      routingReady: false,
      connectionTestReady: false,
    });
    expect(credentialPurposeForProvider("mcp")).toBe("tokens");
    expect(credentialPurposeForProvider("webhook")).toBe("tokens");
    expect(credentialPurposeForProvider("openai")).toBe("messages");
  });
});
