#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const STATE_PATH = resolve(
  process.env.ECORIONE_PCS09_RESTART_STATE ||
    ".ecorione/evidence/pcs09-vps-restart-state.json",
);
const DEPLOY_ENV = process.env.ECORIONE_DEPLOY_ENV?.trim() || "deploy/staging.env";
const PROJECT = process.env.ECORIONE_COMPOSE_PROJECT?.trim() || "ecorione-staging";
const OVERLAY =
  process.env.ECORIONE_COMPOSE_OVERLAY?.trim() || "deploy/compose.sumopod.yml";
const EDGE_NETWORK =
  process.env.ECORIONE_EDGE_NETWORK?.trim() ||
  "inmydraft-demos_web"; // naming-gate:allow — existing SumoPod network
const PUBLIC_BASE_URL =
  process.env.ECORIONE_PUBLIC_BASE_URL?.trim() ||
  "https://ecorione.inmydraft.com"; // naming-gate:allow — existing staging hostname
const EXPECTED_SHA = process.env.ECORIONE_EXPECTED_SHA?.trim() || "";
const OPS_FILE =
  process.env.ECORIONE_OPS_CREDENTIAL_FILE?.trim() ||
  "/home/ubuntu/ecorione-staging-ops.txt";

function die(message) {
  throw new Error("PCS-09 VPS restart evidence: " + message);
}

function run(name, args, options = {}) {
  const result = spawnSync(name, args, {
    cwd: ROOT,
    encoding: "utf8",
    env: options.env || process.env,
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.error) {
    if (options.allowFailure) return null;
    throw result.error;
  }
  if (result.status !== 0) {
    if (options.allowFailure) return null;
    die((options.label || name) + " failed with exit " + String(result.status));
  }
  return String(result.stdout || "").trim();
}

function lines(value) {
  if (!value) return [];
  return value.split(/\r?\n/u).map((item) => item.trim()).filter(Boolean).sort();
}

function parseArgs(argv) {
  const index = argv.indexOf("--phase");
  const phase = index >= 0 ? argv[index + 1] : "";
  if (phase !== "baseline" && phase !== "post") {
    die("use --phase baseline or --phase post");
  }
  return phase;
}

function composeArgs() {
  return [
    "compose",
    "-p",
    PROJECT,
    "--env-file",
    DEPLOY_ENV,
    "-f",
    "deploy/compose.yml",
    "-f",
    OVERLAY,
  ];
}

function receipt() {
  const path = "/var/lib/ecorione-staging/deploy-state.env";
  if (!existsSync(path)) die("release receipt is missing");
  const values = {};
  for (const raw of readFileSync(path, "utf8").split(/\r?\n/u)) {
    const index = raw.indexOf("=");
    if (index > 0) values[raw.slice(0, index)] = raw.slice(index + 1);
  }
  return values;
}

function fingerprint(container, path) {
  if (!container) return { present: false };
  if (
    run(
      "docker",
      ["exec", container, "sh", "-lc", "test -f " + JSON.stringify(path)],
      { allowFailure: true },
    ) === null
  ) {
    return { present: false };
  }
  return {
    present: true,
    sizeBytes: Number(
      run("docker", [
        "exec",
        container,
        "sh",
        "-lc",
        "stat -c %s " + JSON.stringify(path),
      ]),
    ),
    sha256: run("docker", [
      "exec",
      container,
      "sh",
      "-lc",
      "sha256sum " + JSON.stringify(path) + " | awk '{print $1}'",
    ]),
  };
}

async function publicBoundary() {
  async function status(path) {
    try {
      const response = await fetch(new URL(path, PUBLIC_BASE_URL), {
        redirect: "manual",
        signal: AbortSignal.timeout(15000),
      });
      return response.status;
    } catch {
      return 0;
    }
  }
  const home = await status("/");
  const ops = await status("/ops");
  return { home, ops };
}

async function snapshot() {
  run("docker", composeArgs().concat(["config", "--quiet"]));
  const configured = lines(
    run("docker", composeArgs().concat(["config", "--services"])),
  );
  const running = lines(
    run("docker", composeArgs().concat(["ps", "--status", "running", "--services"])),
  );
  const names = lines(
    run("docker", [
      "ps",
      "--filter",
      "label=com.docker.compose.project=" + PROJECT,
      "--format",
      "{{.Names}}",
    ]),
  );
  const connectContainer =
    names.find((name) => name === PROJECT + "-connect-1") ||
    names.find((name) => name.includes("-connect-")) ||
    null;
  const volumes = lines(
    run("docker", [
      "volume",
      "ls",
      "--filter",
      "label=com.docker.compose.project=" + PROJECT,
      "--format",
      "{{.Name}}",
    ]),
  );
  const containers = names.map((name) => ({
    name,
    image: run("docker", ["inspect", "--format", "{{.Config.Image}}", name]),
    restartPolicy: run("docker", ["inspect", "--format", "{{.HostConfig.RestartPolicy.Name}}", name]),
    startedAt: run("docker", ["inspect", "--format", "{{.State.StartedAt}}", name]),
  }));
  return {
    capturedAt: new Date().toISOString(),
    bootId: readFileSync("/proc/sys/kernel/random/boot_id", "utf8").trim(),
    dockerActive:
      run("systemctl", ["is-active", "docker"], { allowFailure: true }) === "active",
    headSha: run("git", ["rev-parse", "HEAD"]),
    cleanWorktree: run("git", ["status", "--porcelain"]) === "",
    receipt: receipt(),
    configuredServices: configured,
    runningServices: running,
    volumes,
    containers,
    connect: {
      runtimeSettings: fingerprint(connectContainer, "/app/data/connect-runtime-settings.json"),
      vaultCiphertext: fingerprint(connectContainer, "/app/data/connect-credentials.vault.json"),
      spendBudget: fingerprint(connectContainer, "/app/data/connect-spend-budget.json"),
    },
    publicBoundary: await publicBoundary(),
  };
}

function assertHealthy(state) {
  if (!state.dockerActive) die("Docker service is not active");
  if (state.headSha !== EXPECTED_SHA) die("HEAD does not match expected SHA");
  if (!state.cleanWorktree) die("tracked worktree is dirty");
  if (state.receipt.current_sha !== EXPECTED_SHA) die("release receipt current_sha mismatch");
  if (state.configuredServices.length !== state.runningServices.length)
    die("not all configured services are running");
  if (state.containers.some((item) => item.restartPolicy !== "unless-stopped"))
    die("restart policy mismatch");
  if (!(state.publicBoundary.home >= 200 && state.publicBoundary.home < 400))
    die("public home is unhealthy");
  if (state.publicBoundary.ops !== 401) die("protected /ops is unhealthy");
}

function readOpsCredentials() {
  const values = {};
  for (const raw of readFileSync(OPS_FILE, "utf8").split(/\r?\n/u)) {
    const index = raw.indexOf("=");
    if (index > 0) values[raw.slice(0, index)] = raw.slice(index + 1);
  }
  if (!values.username || !values.password) die("operator credential file is incomplete");
  return values;
}

function postValidation() {
  const smoke = run(process.execPath, ["scripts/production-public-smoke.mjs"], {
    env: { ...process.env, ECORIONE_PUBLIC_BASE_URL: PUBLIC_BASE_URL },
  });
  if (smoke) console.log(smoke);

  const opsCredentials = readOpsCredentials();
  const ops = run(process.execPath, ["scripts/production-ops-snapshot.mjs"], {
    env: {
      ...process.env,
      ECORIONE_PUBLIC_BASE_URL: PUBLIC_BASE_URL,
      ECORIONE_OPS_USER: opsCredentials.username,
      ECORIONE_OPS_PASSWORD: opsCredentials.password,
    },
  });
  if (ops) console.log(ops);

  const evidence = run(process.execPath, ["scripts/staging-host-evidence.mjs"], {
    env: {
      ...process.env,
      ECORIONE_DEPLOY_ENV: DEPLOY_ENV,
      ECORIONE_COMPOSE_PROJECT: PROJECT,
      ECORIONE_COMPOSE_OVERLAY: OVERLAY,
      ECORIONE_EDGE_NETWORK: EDGE_NETWORK,
      ECORIONE_EXPECTED_SHA: EXPECTED_SHA,
    },
  });
  if (evidence) console.log(evidence);
}

function same(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function main() {
  const phase = parseArgs(process.argv.slice(2));
  if (!/^[0-9a-f]{40}$/u.test(EXPECTED_SHA))
    die("ECORIONE_EXPECTED_SHA must be exact 40-char SHA");

  const current = await snapshot();
  assertHealthy(current);

  if (phase === "baseline") {
    mkdirSync(dirname(STATE_PATH), { recursive: true, mode: 0o700 });
    writeFileSync(
      STATE_PATH,
      JSON.stringify({ schemaVersion: 1, phase, ...current }, null, 2) + "\n",
      { mode: 0o600 },
    );
    chmodSync(STATE_PATH, 0o600);
    console.log(
      JSON.stringify(
        {
          statePath: STATE_PATH,
          bootId: current.bootId,
          headSha: current.headSha,
          currentTag: current.receipt.current_tag,
          serviceCount: current.runningServices.length,
          connect: current.connect,
        },
        null,
        2,
      ),
    );
    console.log(
      "PASS PCS-09 reboot baseline captured; an operator-approved full VPS reboot is required before post verification",
    );
    return;
  }

  if (!existsSync(STATE_PATH)) die("restart baseline state is missing");
  const baseline = JSON.parse(readFileSync(STATE_PATH, "utf8"));
  if (baseline.phase !== "baseline") die("restart baseline phase is invalid");
  if (baseline.bootId === current.bootId)
    die("Linux boot_id did not change; no real VPS reboot is proven");
  if (baseline.headSha !== current.headSha) die("source SHA changed across reboot");
  if (baseline.receipt.current_sha !== current.receipt.current_sha)
    die("release SHA changed across reboot");
  if (baseline.receipt.current_tag !== current.receipt.current_tag)
    die("release image tag changed across reboot");
  if (!same(baseline.volumes, current.volumes))
    die("Docker volume inventory changed across reboot");
  if (!same(baseline.connect, current.connect))
    die("Connect durable-file fingerprints changed across reboot");

  postValidation();

  const result = {
    schemaVersion: 1,
    phase: "post-verified",
    verifiedAt: new Date().toISOString(),
    baselineBootId: baseline.bootId,
    postBootId: current.bootId,
    headSha: current.headSha,
    currentTag: current.receipt.current_tag,
    serviceCount: current.runningServices.length,
    volumesPreserved: true,
    connectFingerprintsPreserved: true,
    connect: current.connect,
    publicBoundary: current.publicBoundary,
    claimBoundary:
      "Controlled VPS reboot persistence only; this does not prove backup/restore, off-host DR, or total host-loss recovery.",
  };
  writeFileSync(STATE_PATH, JSON.stringify(result, null, 2) + "\n", { mode: 0o600 });
  chmodSync(STATE_PATH, 0o600);
  console.log(JSON.stringify(result, null, 2));
  console.log("PASS PCS-09 VPS reboot persistence evidence");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
