import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "..");
const COMPOSE = resolve(ROOT, "deploy/desktop-compose.yml");
const TEMPLATE = resolve(ROOT, "deploy/desktop.env.example");
const LAUNCHER = resolve(ROOT, "scripts/windows/ecorione-launcher.ps1");
const tempRoots = [];

afterEach(() => {
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (root) rmSync(root, { recursive: true, force: true });
  }
});

function tempEnv() {
  const root = mkdtempSync(join(tmpdir(), "ecorione-desktop-launcher-"));
  tempRoots.push(root);
  const envFile = join(root, "desktop.env");
  writeFileSync(
    envFile,
    [
      "ECORIONE_IMAGE=ecorione:test",
      "ECORIONE_INTERNAL_TOKEN=test-internal-token-not-a-real-secret",
      "ECORIONE_CONNECT_VAULT_MASTER_KEY=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      "TEMPORAL_POSTGRES_PASSWORD=test-temporal-password",
      "ECORIONE_LOCAL_RUNTIME=openai-compatible",
      "ECORIONE_LOCAL_BASE_URL=http://host.docker.internal:11434/v1",
      "ECORIONE_LOCAL_MODEL=qwen3:8b-instruct-q4_K_M",
      "ECORIONE_HOSTED_PROVIDER=anthropic",
      "ECORIONE_COST_KILL_SWITCH=1",
      "ECORIONE_AI_PORT=3099",
      "",
    ].join("\n"),
  );
  return envFile;
}

describe("ECORIONE desktop launcher contract", () => {
  it("keeps repository desktop defaults free of generated secret values", () => {
    const template = readFileSync(TEMPLATE, "utf8");
    expect(template).not.toContain("ECORIONE_INTERNAL_TOKEN=");
    expect(template).not.toContain("ECORIONE_CONNECT_VAULT_MASTER_KEY=");
    expect(template).not.toContain("TEMPORAL_POSTGRES_PASSWORD=");
    expect(template).toContain("ECORIONE_COST_KILL_SWITCH=1");
  });

  it("renders desktop compose with Docker Compose using generated local secrets", () => {
    const envFile = tempEnv();
    const result = spawnSync(
      "docker",
      ["compose", "--env-file", envFile, "-f", COMPOSE, "config"],
      { cwd: ROOT, encoding: "utf8" },
    );

    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("name: ecorione-desktop");
    expect(result.stdout).toContain("127.0.0.1:3099");
    expect(result.stdout).toContain("ecorione:test");
  });

  it("publishes only the browser UI port and preserves persistent volumes", () => {
    const compose = readFileSync(COMPOSE, "utf8");
    expect(compose.match(/ports:/g)).toHaveLength(1);
    expect(compose).toContain('"127.0.0.1:${ECORIONE_AI_PORT:-3000}:3000"');
    for (const volume of [
      "temporal_db",
      "rnd_data",
      "context_data",
      "connect_data",
      "hub_data",
      "artifact_data",
      "sandbox_data",
      "flow_data",
      "space_data",
    ]) {
      expect(compose).toContain(`${volume}:`);
    }
  });

  it("launcher exposes bounded lifecycle actions without deleting persistent volumes", () => {
    const launcher = readFileSync(LAUNCHER, "utf8");
    expect(launcher).toContain('[ValidateSet("start", "doctor", "status", "stop")]');
    expect(launcher).toContain('Invoke-Compose @("up", "-d", "--remove-orphans")');
    expect(launcher).toContain('Invoke-Compose @("down", "--remove-orphans")');
    expect(launcher).not.toContain("down -v");
    expect(launcher).not.toContain("docker volume rm");
    expect(launcher).toContain("release\\ecorione-image.tar");
  });
});
