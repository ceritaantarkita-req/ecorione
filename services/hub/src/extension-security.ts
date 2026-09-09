import { createHash } from "node:crypto";
import {
  digestFromArtifactId,
  ExtensionManifestSchema,
  type ExtensionManifest,
} from "@ecorione/shared-schema";

export type ExtensionFindingSeverity = "BLOCK" | "INFO";
export interface ExtensionSecurityFinding {
  readonly severity: ExtensionFindingSeverity;
  readonly code: string;
  readonly message: string;
}
export interface ExtensionSecurityReport {
  readonly allowed: boolean;
  readonly manifest: ExtensionManifest;
  readonly manifestSha256: string;
  readonly findings: readonly ExtensionSecurityFinding[];
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, item]) => [key, canonical(item)]),
    );
  }
  return value;
}

export function extensionManifestDigest(manifest: ExtensionManifest): string {
  return createHash("sha256").update(JSON.stringify(canonical(manifest))).digest("hex");
}

function hasCapability(manifest: ExtensionManifest, id: string): boolean {
  return manifest.capabilities.some((capability) => capability.id === id);
}

function hasPermission(
  manifest: ExtensionManifest,
  id: string,
  actionClass?: ExtensionManifest["permissions"][number]["actionClass"],
): boolean {
  return manifest.permissions.some(
    (permission) =>
      permission.id === id && (actionClass === undefined || permission.actionClass === actionClass),
  );
}

export function validateExtensionManifest(input: unknown): ExtensionSecurityReport {
  const manifest = ExtensionManifestSchema.parse(input);
  const findings: ExtensionSecurityFinding[] = [];
  const bundleDigest = manifest.source.bundleSha256;
  const packageDigest = digestFromArtifactId(manifest.packageArtifactId);

  if (packageDigest !== bundleDigest) {
    findings.push({
      severity: "BLOCK",
      code: "PACKAGE_DIGEST_MISMATCH",
      message: "packageArtifactId tidak sesuai dengan bundleSha256 source yang dipin.",
    });
  }

  if (manifest.source.type === "artifact" && manifest.source.artifactId !== manifest.packageArtifactId) {
    findings.push({
      severity: "BLOCK",
      code: "ARTIFACT_SOURCE_MISMATCH",
      message: "Source artifact harus identik dengan packageArtifactId.",
    });
  }

  if (manifest.execution.kind === "mcp" && !hasCapability(manifest, "mcp.client")) {
    findings.push({
      severity: "BLOCK",
      code: "MCP_CAPABILITY_UNDECLARED",
      message: "Runtime MCP wajib mendeklarasikan capability mcp.client.",
    });
  }

  if (manifest.execution.kind === "sandbox") {
    if (manifest.execution.artifactId !== manifest.packageArtifactId) {
      findings.push({
        severity: "BLOCK",
        code: "SANDBOX_ARTIFACT_MISMATCH",
        message: "Executable Sandbox harus menunjuk Artifact CAS bundle yang tervalidasi.",
      });
    }
    if (!hasCapability(manifest, "sandbox.execute")) {
      findings.push({
        severity: "BLOCK",
        code: "SANDBOX_CAPABILITY_UNDECLARED",
        message: "Runtime Sandbox wajib mendeklarasikan capability sandbox.execute.",
      });
    }
    if (!hasPermission(manifest, "sandbox.execute", "EXECUTE")) {
      findings.push({
        severity: "BLOCK",
        code: "SANDBOX_PERMISSION_UNDECLARED",
        message: "Runtime Sandbox wajib mendeklarasikan permission sandbox.execute/EXECUTE.",
      });
    }
  }

  if (
    manifest.secretRequirements.length > 0 &&
    !manifest.permissions.some((permission) => permission.actionClass === "CREDENTIAL_ACCESS")
  ) {
    findings.push({
      severity: "BLOCK",
      code: "SECRET_PERMISSION_UNDECLARED",
      message: "Extension yang membutuhkan secret wajib mendeklarasikan CREDENTIAL_ACCESS.",
    });
  }

  findings.push({
    severity: "INFO",
    code: "SOURCE_PIN_VERIFIED",
    message: "Manifest memakai immutable source identity + SHA-256; executable host runtime tidak tersedia.",
  });

  return {
    allowed: !findings.some((finding) => finding.severity === "BLOCK"),
    manifest,
    manifestSha256: extensionManifestDigest(manifest),
    findings,
  };
}
