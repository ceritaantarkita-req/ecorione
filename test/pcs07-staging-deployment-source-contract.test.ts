import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("PCS-07 SumoPod staging deployment contract", () => {
  const gitignore = readFileSync(".gitignore", "utf8");
  const preflight = readFileSync("scripts/production-preflight.sh", "utf8");
  const hostAudit = readFileSync("scripts/host-security-audit.sh", "utf8");
  const install = readFileSync("scripts/self-host-install.sh", "utf8");
  const upgrade = readFileSync("scripts/self-host-upgrade.sh", "utf8");
  const rollback = readFileSync("scripts/self-host-rollback.sh", "utf8");

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
      expect(script).toContain('ECORIONE_COMPOSE_PROJECT');
      expect(script).toContain('COMPOSE_ARGS=(-p "$COMPOSE_PROJECT"');
      expect(script).toContain('docker compose "${COMPOSE_ARGS[@]}"');
    }
  });

  it("keeps staging lifecycle on the reviewed self-host compose topology", () => {
    for (const script of [preflight, install, upgrade, rollback]) {
      expect(script).toContain("deploy/compose.yml");
    }
    expect(install).not.toContain("docker.sock");
    expect(upgrade).not.toContain("docker.sock");
    expect(rollback).not.toContain("docker.sock");
  });

  it("keeps apply mutation explicit", () => {
    expect(install).toContain('"--apply"');
    expect(upgrade).toContain('"--apply"');
    expect(rollback).toContain('"--apply"');
  });
});
