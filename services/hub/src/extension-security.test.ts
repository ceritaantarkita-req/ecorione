import { describe, expect, it } from "vitest";
import { validateExtensionManifest } from "./extension-security.js";

const digest = "a".repeat(64);
const artifactId = `art_${digest}`;

function baseManifest(): Record<string, unknown> {
  return {
    apiVersion: "ecorione.extension/v1",
    id: "example.extension",
    name: "Example Extension",
    version: "1.0.0",
    description: "Fixture extension.",
    source: {
      type: "github",
      repository: "example/extension",
      commitSha: "b".repeat(40),
      bundleSha256: digest,
    },
    packageArtifactId: artifactId,
    execution: { kind: "none" },
    capabilities: [],
    permissions: [],
    secretRequirements: [],
  };
}

describe("validateExtensionManifest", () => {
  it("allows immutable non-executable extension metadata", () => {
    const report = validateExtensionManifest(baseManifest());
    expect(report.allowed).toBe(true);
    expect(report.manifestSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(report.findings.some((finding) => finding.code === "SOURCE_PIN_VERIFIED")).toBe(true);
  });

  it("blocks package digest mismatch", () => {
    const value = baseManifest();
    value.packageArtifactId = `art_${"c".repeat(64)}`;
    const report = validateExtensionManifest(value);
    expect(report.allowed).toBe(false);
    expect(report.findings.map((finding) => finding.code)).toContain("PACKAGE_DIGEST_MISMATCH");
  });

  it("blocks MCP runtime without explicit mcp.client capability", () => {
    const value = baseManifest();
    value.execution = { kind: "mcp", serverId: "remote" };
    const report = validateExtensionManifest(value);
    expect(report.allowed).toBe(false);
    expect(report.findings.map((finding) => finding.code)).toContain("MCP_CAPABILITY_UNDECLARED");
  });

  it("allows MCP runtime only after explicit capability declaration", () => {
    const value = baseManifest();
    value.execution = { kind: "mcp", serverId: "remote" };
    value.capabilities = [{ id: "mcp.client", description: "Use configured outbound MCP." }];
    expect(validateExtensionManifest(value).allowed).toBe(true);
  });

  it("blocks Sandbox runtime unless Artifact, capability, and EXECUTE permission match", () => {
    const value = baseManifest();
    value.execution = { kind: "sandbox", artifactId, runtime: "node", entrypoint: "index.js" };
    const report = validateExtensionManifest(value);
    expect(report.allowed).toBe(false);
    expect(report.findings.map((finding) => finding.code)).toEqual(
      expect.arrayContaining(["SANDBOX_CAPABILITY_UNDECLARED", "SANDBOX_PERMISSION_UNDECLARED"]),
    );

    value.capabilities = [{ id: "sandbox.execute", description: "Execute inside Sandbox." }];
    value.permissions = [
      { id: "sandbox.execute", actionClass: "EXECUTE", reason: "Execute extension bundle." },
    ];
    expect(validateExtensionManifest(value).allowed).toBe(true);
  });

  it("blocks secret requirements without CREDENTIAL_ACCESS declaration", () => {
    const value = baseManifest();
    value.secretRequirements = [{ name: "api-key", purpose: "Authenticate upstream." }];
    const report = validateExtensionManifest(value);
    expect(report.allowed).toBe(false);
    expect(report.findings.map((finding) => finding.code)).toContain("SECRET_PERMISSION_UNDECLARED");
  });
});
