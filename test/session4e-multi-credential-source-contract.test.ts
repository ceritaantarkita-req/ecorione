import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Session 4E multi-credential provider foundation source contract", () => {
  const vault = readFileSync("services/connect/src/credential-vault.ts", "utf8");
  const control = readFileSync("services/connect/src/control-http.ts", "utf8");
  const complete = readFileSync("services/connect/src/complete.ts", "utf8");
  const onboarding = readFileSync("apps/ai/app/useAiProviderOnboarding.ts", "utf8");

  it("keeps multiple AI Connections under one encrypted provider scope", () => {
    expect(vault).toContain("connectionId");
    expect(vault).toContain("label");
    expect(vault).toContain("enabled");
    expect(vault).toContain("priority");
    expect(vault).toContain("version: 2");
    expect(vault).toContain("version === 1");
    expect(vault).toContain("candidates(");
    expect(vault).toContain("connectionAad");
  });

  it("exposes non-secret per-connection control routes while keeping legacy provider routes", () => {
    expect(control).toContain("/v1/settings/credentials/:provider/connections");
    expect(control).toContain(
      "/v1/settings/credentials/:provider/connections/:connectionId",
    );
    expect(control).toContain("/v1/settings/credentials/:provider");
    expect(control).not.toContain("return body.secret");
  });

  it("fails over only on bounded credential/network availability errors", () => {
    expect(complete).toContain('error.kind === "invalid-credential"');
    expect(complete).toContain('error.kind === "unreachable"');
    expect(complete).toContain("!(error instanceof ProviderResponseError)");
    expect(complete).toContain("credentialConnectionId");
    expect(complete).toContain("signal?.aborted !== true");
  });

  it("adds another key instead of replacing the provider credential", () => {
    expect(onboarding).toContain(
      "/api/settings/settings/credentials/${encodeURIComponent(providerId)}/connections",
    );
    expect(onboarding).toContain('method: "POST"');
    expect(onboarding).not.toContain(
      'selected === undefined || selected.connected || !selected.connectReady',
    );
  });
});
