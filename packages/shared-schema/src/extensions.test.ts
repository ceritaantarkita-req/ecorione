import { describe, expect, it } from "vitest";
import { ExtensionManifestSchema } from "./extensions.js";

const digest = "a".repeat(64);
const artifactId = `art_${digest}`;

function manifest(): Record<string, unknown> {
  return {
    apiVersion: "ecorione.extension/v1",
    id: "example.extension",
    name: "Example Extension",
    version: "1.2.3",
    description: "Extension test fixture.",
    source: {
      type: "github",
      repository: "example/extension",
      commitSha: "b".repeat(40),
      bundleSha256: digest,
    },
    packageArtifactId: artifactId,
    execution: { kind: "none" },
    capabilities: [{ id: "example.read", description: "Read example data." }],
    permissions: [{ id: "example.read", actionClass: "READ", reason: "Read example data." }],
    secretRequirements: [],
  };
}

describe("ExtensionManifestSchema", () => {
  it("accepts an immutable pinned GitHub manifest", () => {
    const parsed = ExtensionManifestSchema.parse(manifest());
    expect(parsed.source.type).toBe("github");
    expect(parsed.execution.kind).toBe("none");
  });

  it("rejects unknown manifest fields", () => {
    expect(() => ExtensionManifestSchema.parse({ ...manifest(), hostCommand: "node index.js" })).toThrow();
  });

  it("rejects GitHub branches/tags instead of a full commit SHA", () => {
    const value = manifest();
    value.source = {
      type: "github",
      repository: "example/extension",
      commitSha: "main",
      bundleSha256: digest,
    };
    expect(() => ExtensionManifestSchema.parse(value)).toThrow();
  });

  it("rejects insecure release URLs and embedded credentials", () => {
    const insecure = manifest();
    insecure.source = {
      type: "release",
      url: "http://example.com/extension.tgz",
      version: "1.2.3",
      bundleSha256: digest,
    };
    expect(() => ExtensionManifestSchema.parse(insecure)).toThrow();

    const credentialed = manifest();
    credentialed.source = {
      type: "release",
      url: "https://user:secret@example.com/extension.tgz",
      version: "1.2.3",
      bundleSha256: digest,
    };
    expect(() => ExtensionManifestSchema.parse(credentialed)).toThrow();
  });

  it("rejects sandbox path traversal", () => {
    const value = manifest();
    value.execution = { kind: "sandbox", artifactId, runtime: "node", entrypoint: "../index.js" };
    expect(() => ExtensionManifestSchema.parse(value)).toThrow();
  });

  it("rejects duplicate capability, permission, and secret declarations", () => {
    const duplicateCapability = manifest();
    duplicateCapability.capabilities = [
      { id: "same.capability", description: "one" },
      { id: "same.capability", description: "two" },
    ];
    expect(() => ExtensionManifestSchema.parse(duplicateCapability)).toThrow(/Capability/);

    const duplicatePermission = manifest();
    duplicatePermission.permissions = [
      { id: "same.permission", actionClass: "READ", reason: "one" },
      { id: "same.permission", actionClass: "READ", reason: "two" },
    ];
    expect(() => ExtensionManifestSchema.parse(duplicatePermission)).toThrow(/Permission/);

    const duplicateSecret = manifest();
    duplicateSecret.secretRequirements = [
      { name: "api-key", purpose: "one" },
      { name: "api-key", purpose: "two" },
    ];
    expect(() => ExtensionManifestSchema.parse(duplicateSecret)).toThrow(/Secret requirement/);
  });
});
