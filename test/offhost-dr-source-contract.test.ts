import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "..");

function source(path: string) {
  return readFileSync(resolve(ROOT, path), "utf8");
}

describe("off-host DR source contract", () => {
  it("creates an authenticated encrypted bundle from a verified PCS-09 backup", () => {
    const bundle = source("scripts/staging-offhost-dr-bundle.mjs");

    expect(bundle).toContain("aes-256-gcm");
    expect(bundle).toContain("rsa-oaep-sha256");
    expect(bundle).toContain("RSA_PKCS1_OAEP_PADDING");
    expect(bundle).toContain("modulusLength");
    expect(bundle).toContain("< 3072");
    expect(bundle).toContain("SHA256SUMS");
    expect(bundle).toContain("await sha256File(archivePath)");
    expect(bundle).toContain("SHA-256 mismatch");
    expect(bundle).toContain("cipher.setAAD(aad)");
    expect(bundle).toContain("Private DR key is intentionally not used on the source host");
    expect(bundle).not.toContain("createPrivateKey");
    expect(bundle).not.toContain("privateDecrypt");
  });

  it("verifies encryption and can restore every archive into isolated Docker volumes", () => {
    const verify = source("scripts/staging-offhost-dr-verify.mjs");

    expect(verify).toContain("privateDecrypt");
    expect(verify).toContain("decipher.setAuthTag(tag)");
    expect(verify).toContain("Unsafe tar entry detected");
    expect(verify).toContain("--verify-docker");
    expect(verify).toContain("ecorione-dr-verify-");
    expect(verify).toContain("fingerprintVolume");
    expect(verify).toContain("Docker restore content mismatch");
    expect(verify).toContain('"volume", "rm", "-f"');
    expect(verify).not.toContain("docker volume prune");
    expect(verify).not.toContain("docker system prune");
  });

  it("copies only encrypted artifacts to an acknowledged independent SSH failure domain", () => {
    const transfer = source("scripts/staging-offhost-dr-transfer.sh");

    expect(transfer).toContain("ECORIONE_DR_FAILURE_DOMAIN_ACK");
    expect(transfer).toContain("StrictHostKeyChecking=yes");
    expect(transfer).toContain("IdentitiesOnly=yes");
    expect(transfer).toContain("ClearAllForwardings=yes");
    expect(transfer).toContain("sha256sum");
    expect(transfer).toContain(".part-$$");
    expect(transfer).toContain("Private DR decryption key is intentionally not transferred");
    expect(transfer).not.toContain("ssh-keyscan");
    expect(transfer).not.toContain("eval ");
  });
  it("orchestrates a fresh current-revision backup before off-host export", () => {
    const exportScript = source("scripts/staging-offhost-dr-export.sh");

    expect(exportScript).toContain("staging-pcs09-backup.sh --apply");
    expect(exportScript).toContain("Fresh backup SHA does not match");
    expect(exportScript).toContain("staging-offhost-dr-bundle.mjs");
    expect(exportScript).toContain("export_manifest_filename");
    expect(exportScript).toContain("staging-offhost-dr-transfer.sh --apply");
    expect(exportScript).toContain("transfer_verified=1");
    expect(exportScript).not.toContain("docker volume prune");
  });

  it("requires independent retrieval evidence before guarded project-volume restore", () => {
    const fetch = source("scripts/staging-offhost-dr-fetch.sh");
    const restore = source("scripts/staging-offhost-dr-restore.mjs");

    expect(fetch).toContain("retrieval_verified=1");
    expect(fetch).toContain("StrictHostKeyChecking=yes");
    expect(fetch).toContain("Retrieved bundle checksum mismatch");
    expect(fetch).not.toContain("ssh-keyscan");

    expect(restore).toContain("ECORIONE_DR_RESTORE_ACK");
    expect(restore).toContain("--retrieval-receipt");
    expect(restore).toContain("retrieval.retrieval_verified");
    expect(restore).toContain("Compose project containers already exist");
    expect(restore).toContain("target volume already exists");
    expect(restore).toContain("com.docker.compose.project");
    expect(restore).toContain("Restored project-volume content mismatch");
    expect(restore).toContain('["volume", "rm", "-f", volume]');
    expect(restore).not.toContain("docker volume prune");
    expect(restore).not.toContain("docker system prune");
  });

  it("gates recovered application identity and changed-boot-id persistence", () => {
    const start = source("scripts/staging-offhost-dr-start.sh");
    const acceptance = source("scripts/staging-offhost-dr-acceptance.mjs");
    const reboot = source("scripts/staging-offhost-dr-reboot-evidence.mjs");

    expect(start).toContain("retrievedFromIndependentTarget");
    expect(start).toContain("Git HEAD does not match recovered source SHA");
    expect(start).toContain("Compose project containers already exist");
    expect(start).toContain("ECORIONE_IMAGE_TAG");
    expect(start).toContain("down >/dev/null 2>&1 || true");
    expect(start).not.toContain("down -v");

    expect(acceptance).toContain("retrievedFromIndependentTarget !== true");
    expect(acceptance).toContain("Git HEAD does not match restored source SHA");
    expect(acceptance).toContain("AI image tag does not match restored source tag");
    expect(acceptance).toContain("production-public-smoke.mjs");
    expect(acceptance).toContain("production-ops-snapshot.mjs");
    expect(acceptance).toContain("staging-host-evidence.mjs");
    expect(acceptance).toContain("deploy-state.env");

    expect(reboot).toContain("/proc/sys/kernel/random/boot_id");
    expect(reboot).toContain("Linux boot_id did not change");
    expect(reboot).toContain("Connect durable-file fingerprints changed across reboot");
    expect(reboot).toContain("production-public-smoke.mjs");
    expect(reboot).toContain("production-ops-snapshot.mjs");
    expect(reboot).toContain("staging-host-evidence.mjs");
    expect(reboot).toContain("totalHostLossRecoveryCandidate: true");
  });

});
