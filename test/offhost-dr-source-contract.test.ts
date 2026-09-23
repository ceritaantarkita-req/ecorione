import { spawnSync } from "node:child_process";
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
    expect(exportScript).toContain('"$BUNDLE" "$METADATA" "$EXPORT_MANIFEST" "$CANARY_STATE"');
    expect(exportScript).toContain("staging-offhost-dr-source-readiness.sh --check");
    expect(exportScript).toContain("staging-offhost-dr-target-readiness.sh --check");
    expect(exportScript.indexOf("staging-offhost-dr-source-readiness.sh --check")).toBeLessThan(
      exportScript.indexOf("Creating semantic owner-data canary"),
    );
    expect(exportScript.indexOf("staging-offhost-dr-target-readiness.sh --check")).toBeLessThan(
      exportScript.indexOf("Creating semantic owner-data canary"),
    );
    expect(exportScript.indexOf("Creating semantic owner-data canary")).toBeLessThan(
      exportScript.indexOf("staging-pcs09-backup.sh --apply"),
    );
    expect(exportScript).toContain("transfer_verified=1");
    expect(exportScript).not.toContain("docker volume prune");
  });

  it("requires independent retrieval evidence before guarded project-volume restore", () => {
    const fetch = source("scripts/staging-offhost-dr-fetch.sh");
    const restore = source("scripts/staging-offhost-dr-restore.mjs");

    expect(fetch).toContain("retrieval_verified=1");
    expect(fetch).toContain("<loss-marker.json>");
    expect(fetch).toContain("Loss marker must be mode 600");
    expect(fetch).toContain("loss_marker_sha256=");
    expect(fetch).toContain("loss_marker_drill_id=");
    expect(fetch).toContain("retrieval_started_at=");
    expect(fetch).toContain("loss_declared_at=");
    expect(fetch).toContain("StrictHostKeyChecking=yes");
    expect(fetch).toContain("Retrieved bundle checksum mismatch");
    expect(fetch).toContain("Failed to fetch recovery artifact");
    expect(fetch).toContain('if ! scp "${SSH_OPTS[@]}"');
    expect(fetch).toContain('"${TARGET}:${REMOTE_DIR}/${name}"');
    expect(fetch).not.toContain("TARGET:$remote_q");
    expect(fetch.indexOf("LOSS_MARKER_INFO")).toBeLessThan(
      fetch.indexOf('MANIFEST_PATH="$(fetch_one "$MANIFEST_NAME")"'),
    );
    expect(fetch).not.toContain("ssh-keyscan");

    expect(restore).toContain("ECORIONE_DR_RESTORE_ACK");
    expect(restore).toContain("--retrieval-receipt");
    expect(restore).toContain("retrieval.retrieval_verified");
    expect(restore).toContain("retrieval.loss_marker_sha256");
    expect(restore).toContain("retrieval.loss_marker_drill_id");
    expect(restore).toContain("retrieval.retrieval_started_at");
    expect(restore).toContain("Invalid marker-bound retrieval chronology");
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

  it("keeps checkpoint-3 shell entrypoints syntactically valid on Bash hosts", () => {
    if (process.platform === "win32") return;

    for (const path of [
      "scripts/staging-offhost-dr-replacement-preflight.sh",
      "scripts/staging-offhost-dr-start.sh",
      "scripts/staging-offhost-dr-source-readiness.sh",
      "scripts/staging-offhost-dr-target-readiness.sh",
      "scripts/staging-offhost-dr-target-audit.sh",
      "scripts/staging-offhost-dr-fetch.sh",
    ]) {
      const result = spawnSync("bash", ["-n", resolve(ROOT, path)], {
        encoding: "utf8",
      });
      expect(result.status, `${path}: ${result.stderr || result.stdout}`).toBe(0);
    }
  });

  it("renders the recovery Compose overlay as loopback-only in Docker Compose", () => {
    if (process.env.ECORIONE_PHASE3_DOCKER_ACCEPTANCE !== "1") return;

    const env = {
      ...process.env,
      ECORIONE_INTERNAL_TOKEN: "dr-render-internal-token-long-enough",
      ECORIONE_SYNC_OWNER_TOKEN: "dr-render-sync-owner-token-long-enough",
      TEMPORAL_POSTGRES_PASSWORD: "dr-render-temporal-password",
      ECORIONE_DOMAIN: "recovery.invalid",
      ECORIONE_OPS_PASSWORD_HASH: "dr-render-hash",
      ECORIONE_MCP_OAUTH_ISSUER: "https://auth.example.test/",
      ECORIONE_MCP_RESOURCE: "https://ecorione.example.test/mcp",
      ECORIONE_MCP_JWKS_URL: "https://auth.example.test/jwks.json",
      ECORIONE_MCP_HANDLE_KEY: "dr-render-handle-key-long-enough",
      ECORIONE_MCP_ALLOWED_ORIGINS: "https://chatgpt.com",
      ECORIONE_DR_LOOPBACK_PORT: "18080",
      ECORIONE_IMAGE_TAG: "staging-0123456789ab",
    };

    const result = spawnSync(
      "docker",
      [
        "compose",
        "-p",
        "ecorione-staging",
        "-f",
        resolve(ROOT, "deploy/compose.yml"),
        "-f",
        resolve(ROOT, "deploy/compose.dr-recovery.yml"),
        "config",
        "--format",
        "json",
      ],
      {
        cwd: ROOT,
        env,
        encoding: "utf8",
      },
    );

    expect(result.status, result.stderr || result.stdout).toBe(0);
    const config = JSON.parse(result.stdout) as {
      services?: {
        caddy?: {
          ports?: Array<{
            target?: number;
            published?: string | number;
            host_ip?: string;
          }>;
          networks?: string[] | Record<string, unknown>;
        };
      };
    };
    const caddy = config.services?.caddy;
    expect(caddy?.ports).toEqual([
      {
        mode: "ingress",
        target: 8080,
        published: "18080",
        protocol: "tcp",
        host_ip: "127.0.0.1",
      },
    ]);
    const networks = Array.isArray(caddy?.networks)
      ? caddy.networks
      : Object.keys(caddy?.networks ?? {});
    expect(networks).toEqual(["internal"]);
    expect(result.stdout).not.toContain('"published":"80"');
    expect(result.stdout).not.toContain('"published":"443"');
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
    expect(overlay).not.toContain("external: true");
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

    expect(acceptance).toContain("ECORIONE_DR_ACCEPTANCE_MODE");
    expect(acceptance).toContain('["public", "loopback"]');
    expect(acceptance).toContain("staging-offhost-dr-local-smoke.mjs");
    expect(acceptance).toContain("loopback DR acceptance must not use ECORIONE_EDGE_NETWORK");

    expect(reboot).toContain("staging-offhost-dr-local-smoke.mjs");
    expect(reboot).toContain("loopback DR reboot evidence must not use ECORIONE_EDGE_NETWORK");
    expect(acceptance).toContain("acceptanceBaseOrigin");
    expect(acceptance).toContain("expectedMcpResource");
    expect(reboot).toContain("DR acceptance base origin does not match the acceptance receipt");
    expect(reboot).toContain("DR expected MCP resource does not match the acceptance receipt");
  });

  it("keeps runtime DR readiness checks read-only and capacity-bound", () => {
    const sourceReadiness = source("scripts/staging-offhost-dr-source-readiness.sh");
    const targetReadiness = source("scripts/staging-offhost-dr-target-readiness.sh");

    expect(sourceReadiness).toContain("/var/lib/ecorione-staging/deploy-state.env");
    expect(sourceReadiness).toContain("staging-pcs09-inventory.mjs --strict");
    expect(sourceReadiness).toContain("Git HEAD does not match release receipt");
    expect(sourceReadiness).toContain("AI image tag does not match release receipt");
    expect(sourceReadiness).toContain("target_min_free_kib=");
    expect(sourceReadiness).toContain("ECORIONE_DR_PUBLIC_KEY");
    expect(sourceReadiness).toContain("source host must receive public key only");
    expect(sourceReadiness).toContain("DR public key must be RSA >= 3072 bits");
    expect(sourceReadiness).toContain("dr_public_key_ready=1");
    expect(sourceReadiness).toContain(
      "IMPORTANT: no backup/export/remote transfer was created",
    );
    expect(sourceReadiness).not.toContain("staging-pcs09-backup.sh --apply");
    expect(sourceReadiness).not.toContain("staging-offhost-dr-export.sh --apply");
    expect(sourceReadiness).not.toContain("docker volume create");
    expect(sourceReadiness).not.toContain("docker compose stop");

    expect(targetReadiness).toContain("ECORIONE_DR_FAILURE_DOMAIN_ACK");
    expect(targetReadiness).toContain("StrictHostKeyChecking=yes");
    expect(targetReadiness).toContain("ClearAllForwardings=yes");
    expect(targetReadiness).toContain("ECORIONE_DR_TARGET_MIN_FREE_KIB");
    expect(targetReadiness).toContain("test -w");
    expect(targetReadiness).toContain(
      "IMPORTANT: this check performs no upload, mkdir, rename, or deletion",
    );
    expect(targetReadiness).not.toContain("ssh-keyscan");
    expect(targetReadiness).not.toContain('scp "${SSH_OPTS[@]}"');
    expect(targetReadiness).not.toContain("mkdir -");
    expect(targetReadiness).not.toContain("install -d");
    expect(targetReadiness).not.toContain("rm -");
    expect(targetReadiness).not.toContain("mv -");
  });

  it("audits retained off-host generations without remote mutation", () => {
    const audit = source("scripts/staging-offhost-dr-target-audit.sh");
    const evidence = source("scripts/staging-offhost-dr-closure-evidence.mjs");

    expect(audit).toContain("ECORIONE_DR_RETENTION_MIN_GENERATIONS");
    expect(audit).toContain("StrictHostKeyChecking=yes");
    expect(audit).toContain("ClearAllForwardings=yes");
    expect(audit).toContain("  -n\n  -F /dev/null");
    expect(audit).toContain("transfer_intent");
    expect(audit).toContain("sha256sum");
    expect(audit).toContain('[[ "$manifest_mode" == "600" ]]');
    expect(audit).toContain("retention_ready=");
    expect(audit).toContain("complete_generations=");
    expect(audit).toContain("incomplete_generations=");
    expect(audit).toContain("no remote generation was created, renamed, or deleted");
    expect(audit).not.toContain("ssh-keyscan");
    expect(audit).not.toContain('scp "${SSH_OPTS[@]}"');
    expect(audit).not.toContain("mkdir -");
    expect(audit).not.toContain("rm -");
    expect(audit).not.toContain("mv -");

    expect(evidence).toContain("conservativeRpoSeconds");
    expect(evidence).toContain("finalRecoveryRtoSeconds");
    expect(evidence).toContain('args["loss-marker"]');
    expect(evidence).toContain("ecorione-offhost-dr-loss-marker");
    expect(evidence).toContain("expectedExportManifestFilename");
    expect(evidence).toContain("lossMarkerSha256");
    expect(evidence).toContain("totalHostLossRecoveryCandidate");
    expect(evidence).toContain("changedBootIdProven");
    expect(evidence).toContain("refusing to overwrite closure evidence output");
    expect(evidence).not.toContain('args["loss-declared-at"]');
    expect(evidence).not.toContain("ECORIONE_OPS_PASSWORD");
    expect(evidence).not.toContain("privateKey");
  });

  it("binds the DR recovery clock to an immutable selected-generation loss marker", () => {
    const lossMarker = source("scripts/staging-offhost-dr-loss-marker.mjs");
    const fetch = source("scripts/staging-offhost-dr-fetch.sh");
    const restore = source("scripts/staging-offhost-dr-restore.mjs");
    const acceptance = source("scripts/staging-offhost-dr-acceptance.mjs");
    const evidence = source("scripts/staging-offhost-dr-closure-evidence.mjs");

    expect(lossMarker).toContain("randomUUID");
    expect(lossMarker).toContain("ecorione-offhost-dr-loss-marker");
    expect(lossMarker).toContain("recovery-host-system-utc");
    expect(lossMarker).toContain("expectedExportManifestFilename");
    expect(lossMarker).toContain('flag: "wx"');
    expect(lossMarker).toContain("mode: 0o600");
    expect(lossMarker).toContain("refusing to overwrite existing loss marker");
    expect(lossMarker).not.toContain("loss-declared-at");

    expect(fetch).toContain("loss_marker_filename=");
    expect(fetch).toContain("loss_marker_sha256=");
    expect(fetch).toContain("loss_marker_drill_id=");
    expect(fetch).toContain("retrieval_started_at=");
    expect(restore).toContain("lossMarkerSha256: retrieval.loss_marker_sha256");
    expect(restore).toContain("lossMarkerDrillId: retrieval.loss_marker_drill_id");
    expect(acceptance).toContain("lossMarkerSha256: restore.lossMarkerSha256");
    expect(acceptance).toContain("lossMarkerDrillId: restore.lossMarkerDrillId");
    expect(acceptance).toContain(
      "restore receipt marker-bound retrieval chronology is invalid",
    );

    expect(evidence).toContain('"loss-marker"');
    expect(evidence).toContain("lossMarker.expectedExportManifestFilename");
    expect(evidence).toContain("loss marker selected export manifest does not match");
    expect(evidence).toContain("retrieval.loss_marker_sha256");
    expect(evidence).toContain("retrieval.retrieval_started_at");
    expect(evidence).toContain("retrievalStartDelaySeconds");
    expect(evidence).toContain("lossMarker.declaredAt");
    expect(evidence).toContain("lossMarkerSha256");
  });

  it("gates recovered application identity and changed-boot-id persistence", () => {
    const start = source("scripts/staging-offhost-dr-start.sh");
    const acceptance = source("scripts/staging-offhost-dr-acceptance.mjs");
    const reboot = source("scripts/staging-offhost-dr-reboot-evidence.mjs");

    expect(start).toContain("retrievedFromIndependentTarget");
    expect(start).toContain("Git HEAD does not match recovered source SHA");
    expect(start).toContain("Compose project containers already exist");
    expect(start).toContain("ECORIONE_IMAGE_TAG");
    expect(start).toContain("build ai");
    expect(start).toContain('docker image inspect "ecorione:${SOURCE_TAG}"');
    expect(start).toContain("up -d --no-build");
    expect(start).not.toContain("up -d --build");
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
    expect(reboot).toContain("acceptance.lossMarkerSha256");
    expect(reboot).toContain("acceptance.lossMarkerDrillId");
    expect(reboot).toContain("acceptance receipt marker-bound retrieval chronology is invalid");
    expect(reboot).toContain("totalHostLossRecoveryCandidate: true");
  });
});
