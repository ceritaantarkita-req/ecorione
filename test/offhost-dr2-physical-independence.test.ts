import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "..");
const SCRIPT = resolve(
  ROOT,
  "scripts/staging-dr2-physical-independence-preflight.mjs",
);
const TEMP_DIRS: string[] = [];

function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), "ecorione-dr2-"));
  TEMP_DIRS.push(dir);
  return dir;
}

function evidence(
  role: "backup-target" | "replacement-host",
  failureDomain: string,
  machineIdSha256: string,
  systemUuidSha256: string | null,
  virtualization = "kvm",
) {
  return {
    schemaVersion: 1,
    kind: "ecorione-dr2-host-evidence",
    role,
    failureDomain,
    capturedAt: new Date().toISOString(),
    hostIdentity: {
      machineIdSha256,
      systemUuidSha256,
      virtualization,
      osId: "ubuntu",
      kernelRelease: "test",
      architecture: "x86_64",
    },
    claimBoundary: "fixture",
  };
}

function writeEvidence(path: string, value: unknown) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, {
    mode: 0o600,
  });
  chmodSync(path, 0o600);
}

function runPreflight(
  backup: string,
  replacement: string,
  output: string,
  ack = "1",
) {
  return spawnSync(
    process.execPath,
    [
      SCRIPT,
      "--backup-target",
      backup,
      "--replacement-host",
      replacement,
      "--output",
      output,
    ],
    {
      cwd: ROOT,
      encoding: "utf8",
      env: {
        ...process.env,
        ECORIONE_DR_PHYSICAL_INDEPENDENCE_ACK: ack,
      },
    },
  );
}

afterEach(() => {
  for (const dir of TEMP_DIRS.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("DR-2 physical independence preflight", () => {
  it("accepts distinct operator-attested failure domains and sanitized host identities", () => {
    if (process.platform !== "linux") return;

    const dir = tempDir();
    const backup = join(dir, "backup.json");
    const replacement = join(dir, "replacement.json");
    const output = join(dir, "preflight.json");

    writeEvidence(
      backup,
      evidence(
        "backup-target",
        "external-target-a",
        "a".repeat(64),
        "b".repeat(64),
      ),
    );
    writeEvidence(
      replacement,
      evidence(
        "replacement-host",
        "recovery-host-b",
        "c".repeat(64),
        "d".repeat(64),
      ),
    );

    const result = runPreflight(backup, replacement, output);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "PASS ECORIONE DR-2 physical-independence preflight",
    );

    const receipt = JSON.parse(readFileSync(output, "utf8"));
    expect(receipt.preflightPassed).toBe(true);
    expect(receipt.checks.operatorPhysicalIndependenceAttested).toBe(true);
    expect(receipt.checks.distinctFailureDomainLabels).toBe(true);
    expect(receipt.checks.distinctMachineIdFingerprints).toBe(true);
    expect(receipt.checks.distinctSystemUuidFingerprints).toBe(true);
    expect(statSync(output).mode & 0o777).toBe(0o600);
  });

  it("rejects matching machine identity even when labels differ", () => {
    if (process.platform !== "linux") return;

    const dir = tempDir();
    const backup = join(dir, "backup.json");
    const replacement = join(dir, "replacement.json");
    const output = join(dir, "preflight.json");

    writeEvidence(
      backup,
      evidence(
        "backup-target",
        "external-target-a",
        "a".repeat(64),
        "b".repeat(64),
      ),
    );
    writeEvidence(
      replacement,
      evidence(
        "replacement-host",
        "recovery-host-b",
        "a".repeat(64),
        "d".repeat(64),
      ),
    );

    const result = runPreflight(backup, replacement, output);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("same machine-id fingerprint");
  });

  it("rejects reused failure-domain labels", () => {
    if (process.platform !== "linux") return;

    const dir = tempDir();
    const backup = join(dir, "backup.json");
    const replacement = join(dir, "replacement.json");
    const output = join(dir, "preflight.json");

    writeEvidence(
      backup,
      evidence(
        "backup-target",
        "same-domain",
        "a".repeat(64),
        "b".repeat(64),
      ),
    );
    writeEvidence(
      replacement,
      evidence(
        "replacement-host",
        "same-domain",
        "c".repeat(64),
        "d".repeat(64),
      ),
    );

    const result = runPreflight(backup, replacement, output);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("same failure-domain label");
  });

  it("requires explicit physical-independence attestation", () => {
    if (process.platform !== "linux") return;

    const dir = tempDir();
    const backup = join(dir, "backup.json");
    const replacement = join(dir, "replacement.json");
    const output = join(dir, "preflight.json");

    writeEvidence(
      backup,
      evidence(
        "backup-target",
        "external-target-a",
        "a".repeat(64),
        "b".repeat(64),
      ),
    );
    writeEvidence(
      replacement,
      evidence(
        "replacement-host",
        "recovery-host-b",
        "c".repeat(64),
        "d".repeat(64),
      ),
    );

    const result = runPreflight(backup, replacement, output, "0");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "ECORIONE_DR_PHYSICAL_INDEPENDENCE_ACK=1",
    );
  });

  it("requires system UUID fingerprints when both hosts are WSL", () => {
    if (process.platform !== "linux") return;

    const dir = tempDir();
    const backup = join(dir, "backup.json");
    const replacement = join(dir, "replacement.json");
    const output = join(dir, "preflight.json");

    writeEvidence(
      backup,
      evidence(
        "backup-target",
        "external-target-a",
        "a".repeat(64),
        null,
        "wsl",
      ),
    );
    writeEvidence(
      replacement,
      evidence(
        "replacement-host",
        "recovery-host-b",
        "c".repeat(64),
        "d".repeat(64),
        "wsl",
      ),
    );

    const result = runPreflight(backup, replacement, output);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "two WSL hosts require distinct system UUID fingerprints",
    );
  });

  it("refuses to overwrite an existing preflight receipt", () => {
    if (process.platform !== "linux") return;

    const dir = tempDir();
    const backup = join(dir, "backup.json");
    const replacement = join(dir, "replacement.json");
    const output = join(dir, "preflight.json");

    writeEvidence(
      backup,
      evidence(
        "backup-target",
        "external-target-a",
        "a".repeat(64),
        "b".repeat(64),
      ),
    );
    writeEvidence(
      replacement,
      evidence(
        "replacement-host",
        "recovery-host-b",
        "c".repeat(64),
        "d".repeat(64),
      ),
    );
    writeFileSync(output, "{}\n", { mode: 0o600 });

    const result = runPreflight(backup, replacement, output);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "refusing to overwrite existing preflight output",
    );
  });
});
