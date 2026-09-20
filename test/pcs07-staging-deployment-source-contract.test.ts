import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("PCS-07 SumoPod staging deployment contract", () => {
  const gitignore = readFileSync(".gitignore", "utf8");
  const preflight = readFileSync("scripts/production-preflight.sh", "utf8");
  const hostAudit = readFileSync("scripts/host-security-audit.sh", "utf8");
  const install = readFileSync("scripts/self-host-install.sh", "utf8");
  const upgrade = readFileSync("scripts/self-host-upgrade.sh", "utf8");
  const rollback = readFileSync("scripts/self-host-rollback.sh", "utf8");
  const hostEvidence = readFileSync("scripts/staging-host-evidence.mjs", "utf8");
  const sumopodOverlay = readFileSync("deploy/compose.sumopod.yml", "utf8");
  const sumopodCaddy = readFileSync("deploy/Caddyfile.sumopod", "utf8");
  const productionEnvExample = readFileSync("deploy/production.env.example", "utf8");
  const packageJson = readFileSync("package.json", "utf8");

  it("keeps deployment env files out of Git", () => {
    expect(gitignore).toContain("deploy/*.env");
    expect(gitignore).not.toContain("!deploy/production.env");
    expect(gitignore).not.toContain("!deploy/staging.env");
  });

  it("supports an isolated staging env while preserving the historical production env fallback", () => {
    for (const script of [preflight, hostAudit, install, upgrade, rollback]) {
      expect(script).toContain("ECORIONE_DEPLOY_ENV");
      expect(script).toContain("ECORIONE_PRODUCTION_ENV");
      expect(script).toContain("deploy/production.env");
    }
    expect(install).toContain("ECORIONE_DEPLOY_ENV_TEMPLATE");
    expect(install).toContain("deploy/production.env.example");
  });

  it("supports an isolated Compose project for staging lifecycle commands", () => {
    for (const script of [preflight, install, upgrade, rollback]) {
      expect(script).toContain("ECORIONE_COMPOSE_PROJECT");
      expect(script).toContain('COMPOSE_ARGS=(-p "$COMPOSE_PROJECT"');
      expect(script).toContain('docker compose "${COMPOSE_ARGS[@]}"');
    }
  });

  it("keeps staging lifecycle on the reviewed base topology plus an explicit reviewed overlay", () => {
    for (const script of [preflight, install, upgrade, rollback]) {
      expect(script).toContain("deploy/compose.yml");
      expect(script).toContain("ECORIONE_COMPOSE_OVERLAY");
      expect(script).toContain('COMPOSE_ARGS+=(-f "$COMPOSE_OVERLAY")');
    }
    expect(install).not.toContain("docker.sock");
    expect(upgrade).not.toContain("docker.sock");
    expect(rollback).not.toContain("docker.sock");
  });

  it("adapts SumoPod staging to the existing Traefik edge", () => {
    expect(sumopodOverlay).toContain("ports: !reset []");
    expect(sumopodOverlay).toContain("ECORIONE_EDGE_NETWORK");
    expect(sumopodOverlay).toContain("external: true");
    expect(sumopodOverlay).toContain('traefik.enable: "true"');
    expect(sumopodOverlay).toContain('loadbalancer.server.port: "8080"');
    expect(sumopodOverlay).not.toContain("/var/run/docker.sock");
    expect(sumopodCaddy).toContain(":8080");
    expect(sumopodCaddy).toContain("reverse_proxy ai:3000");
    expect(sumopodCaddy).toContain("reverse_proxy sync:17011");
    expect(sumopodCaddy).toContain("basic_auth");
  });

  it("keeps bcrypt-style operator hashes literal in Compose env files", () => {
    expect(productionEnvExample).toContain(
      "ECORIONE_OPS_PASSWORD_HASH=\'CHANGE_ME_CADDY_PASSWORD_HASH\'",
    );
  });

  it("fails closed on unsafe mutable deployment env files", () => {
    for (const script of [install, upgrade, rollback]) {
      expect(script).toContain("must not be a symlink");
      expect(script).toContain("must be mode 600");
    }
  });

  it("collects only sanitized host/runtime evidence", () => {
    expect(packageJson).toContain(
      '"staging:host-evidence": "node scripts/staging-host-evidence.mjs"',
    );
    expect(hostEvidence).toContain("ECORIONE_EXPECTED_SHA");
    expect(hostEvidence).toContain("ECORIONE_DEPLOY_ENV is required");
    expect(hostEvidence).toContain("ECORIONE_COMPOSE_PROJECT is required");
    expect(hostEvidence).toContain("ECORIONE_COMPOSE_OVERLAY");
    expect(hostEvidence).toContain("ECORIONE_EDGE_NETWORK");
    expect(hostEvidence).toContain("40-character reviewed Git commit");
    expect(hostEvidence).not.toContain("ECORIONE_PRODUCTION_ENV");
    expect(hostEvidence).toContain("cleanWorktree");
    expect(hostEvidence).toContain("configuredServices");
    expect(hostEvidence).toContain("runningServices");
    expect(hostEvidence).toContain("projectVolumes");
    expect(hostEvidence).toContain("no IP address, env value, credential, token");
    expect(hostEvidence).not.toContain("ECORIONE_INTERNAL_TOKEN");
    expect(hostEvidence).not.toContain("ECORIONE_CONNECT_VAULT_MASTER_KEY");
    expect(hostEvidence).not.toContain("ECORIONE_OPS_PASSWORD");
  });

  it("fails host evidence when staging is incomplete", () => {
    expect(hostEvidence).toContain("nonRunningServices.length > 0");
    expect(hostEvidence).toContain("projectVolumes.length === 0");
    expect(hostEvidence).toContain("HEAD does not match ECORIONE_EXPECTED_SHA");
  });

  it("keeps apply mutation explicit", () => {
    expect(install).toContain('"--apply"');
    expect(upgrade).toContain('"--apply"');
    expect(rollback).toContain('"--apply"');
  });
});
