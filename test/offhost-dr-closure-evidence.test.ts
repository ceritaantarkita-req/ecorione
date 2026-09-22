import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "..");
const SCRIPT = resolve(ROOT, "scripts/staging-offhost-dr-closure-evidence.mjs");

function write600(path: string, value: string) {
  writeFileSync(path, value, { mode: 0o600 });
  chmodSync(path, 0o600);
}

function envFile(values: Record<string, string>) {
  return Object.entries(values)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n")
    .concat("\n");
}

function lossMarker(manifestName: string, declaredAt: string) {
  return `${JSON.stringify(
    {
      schemaVersion: 1,
      kind: "ecorione-offhost-dr-loss-marker",
      drillId: "11111111-2222-4333-8444-555555555555",
      declaredAt,
      expectedExportManifestFilename: manifestName,
      clockSource: "recovery-host-system-utc",
      claimBoundary: "test fixture",
    },
    null,
    2,
  )}\n`;
}

describe("off-host DR closure timing evidence", () => {
  it("computes conservative RPO and staged RTO from final recovery receipts", () => {
    const dir = mkdtempSync(join(tmpdir(), "ecorione-dr-evidence-"));
    try {
      const manifestPath = join(dir, "ecorione-dr-20260922T000500Z-aaaaaaaaaaaa.receipt.env");
      const canaryPath = join(dir, "ecorione-dr-20260922T000500Z-aaaaaaaaaaaa.canary.json");
      const retrievalPath = join(
        dir,
        "ecorione-dr-20260922T000500Z-aaaaaaaaaaaa.retrieval.env",
      );
      const restorePath = join(dir, "restore.json");
      const acceptancePath = join(dir, "acceptance.json");
      const lossMarkerPath = join(dir, "loss-marker.json");
      const outputPath = join(dir, "closure.json");

      const canary = {
        schemaVersion: 1,
        phase: "baseline-ready",
        createdAt: "2026-09-22T00:00:00Z",
        marker: "dr-test",
      };
      const canaryRaw = `${JSON.stringify(canary, null, 2)}\n`;
      const canarySha = createHash("sha256").update(canaryRaw).digest("hex");
      const bundleSha = "b".repeat(64);
      const metadataSha = "c".repeat(64);
      const sourceSha = "a".repeat(40);
      const sourceTag = `staging-${sourceSha.slice(0, 12)}`;
      const stem = "ecorione-dr-20260922T000500Z-aaaaaaaaaaaa";

      write600(canaryPath, canaryRaw);
      write600(
        manifestPath,
        envFile({
          schema_version: "1",
          created_at: "2026-09-22T00:05:00Z",
          source_sha: sourceSha,
          source_tag: sourceTag,
          backup_run_id: "pcs09-test",
          bundle_filename: `${stem}.ecdr`,
          metadata_filename: `${stem}.json`,
          bundle_sha256: bundleSha,
          metadata_sha256: metadataSha,
          canary_filename: `${stem}.canary.json`,
          canary_sha256: canarySha,
          failure_domain_ack: "1",
          transfer_intent: "1",
        }),
      );
      write600(
        retrievalPath,
        envFile({
          schema_version: "1",
          retrieved_at: "2026-09-22T01:10:00Z",
          export_manifest_filename: `${stem}.receipt.env`,
          bundle_filename: `${stem}.ecdr`,
          metadata_filename: `${stem}.json`,
          canary_filename: `${stem}.canary.json`,
          bundle_sha256: bundleSha,
          metadata_sha256: metadataSha,
          canary_sha256: canarySha,
          failure_domain_ack: "1",
          retrieval_verified: "1",
        }),
      );
      write600(
        restorePath,
        `${JSON.stringify(
          {
            schemaVersion: 1,
            recoveryStartedAt: "2026-09-22T01:15:00Z",
            dataReadyAt: "2026-09-22T01:30:00Z",
            sourceSha,
            sourceTag,
            composeProject: "ecorione-staging",
            bundleFilename: `${stem}.ecdr`,
            retrievalReceiptFilename: `${stem}.retrieval.env`,
            retrievedFromIndependentTarget: true,
            semanticCanaryStateFilename: `${stem}.canary.json`,
            semanticCanarySha256: canarySha,
            restoredVolumes: [
              {
                name: "ecorione-staging_context_data",
                logicalName: "context_data",
                treeSha256: "d".repeat(64),
                fileCount: 3,
              },
            ],
          },
          null,
          2,
        )}\n`,
      );
      write600(
        acceptancePath,
        `${JSON.stringify(
          {
            schemaVersion: 1,
            acceptedAt: "2026-09-22T01:45:00Z",
            recoveryStartedAt: "2026-09-22T01:15:00Z",
            dataReadyAt: "2026-09-22T01:30:00Z",
            sourceSha,
            sourceTag,
            composeProject: "ecorione-staging",
            serviceCount: 15,
            restoredVolumeCount: 1,
            retrievedFromIndependentTarget: true,
            retrievalReceiptFilename: `${stem}.retrieval.env`,
            semanticCanaryStateFilename: `${stem}.canary.json`,
            semanticCanarySha256: canarySha,
            semanticCanaryAccepted: true,
            preRebootAccepted: true,
            rebootPersistenceAccepted: true,
            postRebootAcceptedAt: "2026-09-22T02:00:00Z",
            baselineBootId: "11111111-1111-1111-1111-111111111111",
            postBootId: "22222222-2222-2222-2222-222222222222",
            semanticCanaryVerifiedAfterReboot: true,
            totalHostLossRecoveryCandidate: true,
          },
          null,
          2,
        )}\n`,
      );

      write600(lossMarkerPath, lossMarker(`${stem}.receipt.env`, "2026-09-22T01:00:00Z"));

      const result = spawnSync(
        process.execPath,
        [
          SCRIPT,
          "--export-manifest",
          manifestPath,
          "--canary-state",
          canaryPath,
          "--retrieval-receipt",
          retrievalPath,
          "--restore-receipt",
          restorePath,
          "--acceptance-receipt",
          acceptancePath,
          "--loss-marker",
          lossMarkerPath,
          "--output",
          outputPath,
        ],
        { cwd: ROOT, encoding: "utf8" },
      );

      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain(
        "PASS ECORIONE off-host DR sanitized closure timing evidence",
      );

      const evidence = JSON.parse(readFileSync(outputPath, "utf8"));
      expect(evidence.sourceSha).toBe(sourceSha);
      expect(evidence.drill).toMatchObject({
        drillId: "11111111-2222-4333-8444-555555555555",
        lossMarkerFilename: "loss-marker.json",
        clockSource: "recovery-host-system-utc",
      });
      expect(evidence.drill.lossMarkerSha256).toMatch(/^[0-9a-f]{64}$/);
      expect(evidence.measuredSeconds).toEqual({
        conservativeRpoSeconds: 3600,
        exportAgeAtLossSeconds: 3300,
        retrievalReadyRtoSeconds: 600,
        dataReadyRtoSeconds: 1800,
        applicationReadyRtoSeconds: 2700,
        finalRecoveryRtoSeconds: 3600,
      });
      expect(evidence.recovery.changedBootIdProven).toBe(true);
      expect(evidence.recovery.totalHostLossRecoveryCandidate).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects a declared loss that predates the successful export generation", () => {
    const dir = mkdtempSync(join(tmpdir(), "ecorione-dr-evidence-order-"));
    try {
      const manifestPath = join(dir, "ecorione-dr-test.receipt.env");
      const canaryPath = join(dir, "ecorione-dr-test.canary.json");
      const retrievalPath = join(dir, "ecorione-dr-test.retrieval.env");
      const restorePath = join(dir, "restore.json");
      const acceptancePath = join(dir, "acceptance.json");
      const lossMarkerPath = join(dir, "loss-marker.json");
      const outputPath = join(dir, "closure.json");
      const canaryRaw = `${JSON.stringify(
        {
          schemaVersion: 1,
          phase: "baseline-ready",
          createdAt: "2026-09-22T00:00:00Z",
        },
        null,
        2,
      )}\n`;
      const canarySha = createHash("sha256").update(canaryRaw).digest("hex");
      const sourceSha = "a".repeat(40);
      const sourceTag = `staging-${sourceSha.slice(0, 12)}`;

      write600(canaryPath, canaryRaw);
      write600(
        manifestPath,
        envFile({
          schema_version: "1",
          created_at: "2026-09-22T00:05:00Z",
          source_sha: sourceSha,
          source_tag: sourceTag,
          bundle_filename: "ecorione-dr-test.ecdr",
          metadata_filename: "ecorione-dr-test.json",
          bundle_sha256: "b".repeat(64),
          metadata_sha256: "c".repeat(64),
          canary_filename: "ecorione-dr-test.canary.json",
          canary_sha256: canarySha,
          failure_domain_ack: "1",
          transfer_intent: "1",
        }),
      );
      write600(
        retrievalPath,
        envFile({
          schema_version: "1",
          retrieved_at: "2026-09-22T01:10:00Z",
          export_manifest_filename: "ecorione-dr-test.receipt.env",
          bundle_filename: "ecorione-dr-test.ecdr",
          metadata_filename: "ecorione-dr-test.json",
          canary_filename: "ecorione-dr-test.canary.json",
          bundle_sha256: "b".repeat(64),
          metadata_sha256: "c".repeat(64),
          canary_sha256: canarySha,
          failure_domain_ack: "1",
          retrieval_verified: "1",
        }),
      );
      write600(
        restorePath,
        `${JSON.stringify(
          {
            schemaVersion: 1,
            recoveryStartedAt: "2026-09-22T01:15:00Z",
            dataReadyAt: "2026-09-22T01:30:00Z",
            sourceSha,
            sourceTag,
            composeProject: "ecorione-staging",
            bundleFilename: "ecorione-dr-test.ecdr",
            retrievalReceiptFilename: "ecorione-dr-test.retrieval.env",
            retrievedFromIndependentTarget: true,
            semanticCanaryStateFilename: "ecorione-dr-test.canary.json",
            semanticCanarySha256: canarySha,
            restoredVolumes: [
              { name: "x", logicalName: "x", treeSha256: "d".repeat(64), fileCount: 1 },
            ],
          },
          null,
          2,
        )}\n`,
      );
      write600(
        acceptancePath,
        `${JSON.stringify(
          {
            schemaVersion: 1,
            acceptedAt: "2026-09-22T01:45:00Z",
            recoveryStartedAt: "2026-09-22T01:15:00Z",
            dataReadyAt: "2026-09-22T01:30:00Z",
            sourceSha,
            sourceTag,
            composeProject: "ecorione-staging",
            serviceCount: 15,
            restoredVolumeCount: 1,
            retrievedFromIndependentTarget: true,
            retrievalReceiptFilename: "ecorione-dr-test.retrieval.env",
            semanticCanaryStateFilename: "ecorione-dr-test.canary.json",
            semanticCanarySha256: canarySha,
            semanticCanaryAccepted: true,
            preRebootAccepted: true,
            rebootPersistenceAccepted: true,
            postRebootAcceptedAt: "2026-09-22T02:00:00Z",
            baselineBootId: "11111111-1111-1111-1111-111111111111",
            postBootId: "22222222-2222-2222-2222-222222222222",
            semanticCanaryVerifiedAfterReboot: true,
            totalHostLossRecoveryCandidate: true,
          },
          null,
          2,
        )}\n`,
      );

      write600(
        lossMarkerPath,
        lossMarker("ecorione-dr-test.receipt.env", "2026-09-21T23:59:00Z"),
      );

      const result = spawnSync(
        process.execPath,
        [
          SCRIPT,
          "--export-manifest",
          manifestPath,
          "--canary-state",
          canaryPath,
          "--retrieval-receipt",
          retrievalPath,
          "--restore-receipt",
          restorePath,
          "--acceptance-receipt",
          acceptancePath,
          "--loss-marker",
          lossMarkerPath,
          "--output",
          outputPath,
        ],
        { cwd: ROOT, encoding: "utf8" },
      );

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain(
        "loss_declared_at must not predate successful export generation",
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
