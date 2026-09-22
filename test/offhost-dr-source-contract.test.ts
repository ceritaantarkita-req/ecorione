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
    expect(transfer).toContain(".part-$");
    expect(transfer).toContain("test ! -e $final_q");
    expect(transfer).toContain("rm -f $part_q");
    expect(transfer).not.toContain("mv -f");
    expect(transfer.indexOf('transfer_one "$CANARY" "$CANARY_NAME"')).toBeLessThan(
      transfer.indexOf('transfer_one "$MANIFEST" "$MANIFEST_NAME"'),
    );
    expect(transfer).toContain("generation commit marker");
    expect(transfer).toContain("Private DR decryption key is intentionally not transferred");
    expect(transfer).not.toContain("ssh-keyscan");
    expect(transfer).not.toContain("eval ");
  });
  it("orchestrates a fresh current-revision backup before off-host export", () => {
    const exportScript = source("scripts/staging-offhost-dr-export.sh");

    expect(exportScript).toContain("staging-pcs09-backup.sh --apply");
    expect(exportScript).toContain("Fresh backup SHA does not match");
    expect(exportScript).toContain("staging-offhost-dr-bundle.mjs");
    expect(exportScript).toContain('-$$.json"');
    expect(exportScript).toContain('rm -f "$CANARY_TMP"');
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
    expect(restore).toContain("retrieval receipt must be mode 600");
    expect(restore).toContain("Object.create(null)");
    expect(restore).toContain("Compose project containers already exist");
    expect(restore).toContain("target volume already exists");
    expect(restore).toContain("com.docker.compose.project");
    expect(restore).toContain("Restored project-volume content mismatch");
    expect(restore).toContain('["volume", "rm", "-f", volume]');
    expect(restore).not.toContain("docker volume prune");
    expect(restore).not.toContain("docker system prune");
  });

  it("uses owner APIs for a semantic DR canary and carries it through retrieval", () => {
    const inner = source("scripts/staging-offhost-dr-canary-inner.mjs");
    const wrapper = source("scripts/staging-offhost-dr-canary.mjs");
    const exportScript = source("scripts/staging-offhost-dr-export.sh");
    const fetch = source("scripts/staging-offhost-dr-fetch.sh");
    const restore = source("scripts/staging-offhost-dr-restore.mjs");

    expect(inner).toContain("/v1/history/sessions");
    expect(inner).toContain("/v1/history/verify");
    expect(inner).toContain("/v1/episodes");
    expect(inner).toContain("/v1/artifacts");
    expect(inner).toContain("LOCAL_ONLY");
    expect(inner).toContain("offhost-dr-recovery-canary");
    expect(inner).not.toContain("sqlite");
    expect(wrapper).toContain("com.docker.compose.service=hub");
    expect(wrapper).toContain("staging-offhost-dr-canary-inner.mjs");
    expect(exportScript).toContain("--phase baseline");
    expect(exportScript).toContain("canary_filename=");
    expect(exportScript).toContain("canary_sha256=");
    expect(fetch).toContain("canary_filename");
    expect(fetch).toContain("Retrieved semantic canary checksum mismatch");
    expect(restore).toContain("--canary-state");
    expect(restore).toContain("semanticCanarySha256");
  });

  it("keeps replacement-host DR on a standalone loopback-only edge", () => {
    const overlay = source("deploy/compose.dr-recovery.yml");
    const preflight = source("scripts/staging-offhost-dr-replacement-preflight.sh");
    const localSmoke = source("scripts/staging-offhost-dr-local-smoke.mjs");
    const start = source("scripts/staging-offhost-dr-start.sh");
    const acceptance = source("scripts/staging-offhost-dr-acceptance.mjs");
    const reboot = source("scripts/staging-offhost-dr-reboot-evidence.mjs");

    expect(overlay).toContain("127.0.0.1:");
    expect(overlay).toContain("!override");
    expect(overlay).toContain("Caddyfile.sumopod");
    expect(overlay).not.toContain("traefik");
    expect(overlay).not.toContain("inmydraft-demos_web");
    expect(overlay).not.toContain('"80:80"');
    expect(overlay).not.toContain('"443:443"');

    expect(preflight).toContain("replacement host is not clean");
    expect(preflight).toContain("Compose project containers already exist");
    expect(preflight).toContain("Compose project volumes already exist");
    expect(preflight).toContain("must not inherit ECORIONE_EDGE_NETWORK");
    expect(preflight).toContain("production-preflight.sh");
    expect(preflight).toContain('export ECORIONE_DEPLOY_ENV="$DEPLOY_ENV"');
    expect(preflight).toContain("config --format json");
    expect(preflight).toContain("127.0.0.1:");
    expect(preflight).not.toContain("docker volume prune");
    expect(preflight).not.toContain("docker system prune");

    expect(localSmoke).toContain("DR loopback base must stay on loopback");
    expect(localSmoke).toContain("ECORIONE_DR_EXPECTED_MCP_RESOURCE");
    expect(localSmoke).toContain("recovered MCP resource identity changed");
    expect(localSmoke).toContain("/ops");
    expect(localSmoke).toContain("memory:read");

    expect(start).toContain("ECORIONE_DR_STANDALONE_RECOVERY");
    expect(start).toContain("deploy/compose.dr-recovery.yml");
    expect(start).toContain("must not use ECORIONE_EDGE_NETWORK");

    expect(acceptance).toContain('ECORIONE_DR_ACCEPTANCE_MODE');
    expect(acceptance).toContain('["public", "loopback"]');
    expect(acceptance).toContain("staging-offhost-dr-local-smoke.mjs");
    expect(acceptance).toContain("loopback DR acceptance must not use ECORIONE_EDGE_NETWORK");

    expect(reboot).toContain("staging-offhost-dr-local-smoke.mjs");
    expect(reboot).toContain("loopback DR reboot evidence must not use ECORIONE_EDGE_NETWORK");
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
    expect(acceptance).toContain("staging-offhost-dr-canary.mjs");
    expect(acceptance).toContain("semanticCanaryAccepted: true");
    expect(acceptance).toContain("production-public-smoke.mjs");
    expect(acceptance).toContain("production-ops-snapshot.mjs");
    expect(acceptance).toContain("staging-host-evidence.mjs");
    expect(acceptance).toContain("ECORIONE_COMPOSE_OVERLAY = overlayRaw");
    expect(acceptance).toContain("deploy-state.env");

    expect(reboot).toContain("/proc/sys/kernel/random/boot_id");
    expect(reboot).toContain("Linux boot_id did not change");
    expect(reboot).toContain("Connect durable-file fingerprints changed across reboot");
    expect(reboot).toContain("staging-offhost-dr-canary.mjs");
    expect(reboot).toContain("semanticCanaryVerifiedAfterReboot: true");
    expect(reboot).toContain("production-public-smoke.mjs");
    expect(reboot).toContain("production-ops-snapshot.mjs");
    expect(reboot).toContain("staging-host-evidence.mjs");
    expect(reboot).toContain("totalHostLossRecoveryCandidate: true");
  });
});
