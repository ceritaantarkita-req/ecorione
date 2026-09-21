#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, statfsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
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
const strict = process.argv.slice(2).includes("--strict");

function die(message) {
  throw new Error("PCS-09 staging inventory: " + message);
}

function run(name, args, allowFailure = false) {
  const result = spawnSync(name, args, {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.error) {
    if (allowFailure) return null;
    throw result.error;
  }
  if (result.status !== 0) {
    if (allowFailure) return null;
    die(name + " failed with exit " + String(result.status));
  }
  return String(result.stdout || "").trim();
}

function lines(value) {
  if (!value) return [];
  return value.split(/\r?\n/u).map((item) => item.trim()).filter(Boolean).sort();
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

function sshEffective(text) {
  const map = {};
  for (const raw of String(text || "").split(/\r?\n/u)) {
    const parts = raw.trim().split(/\s+/u);
    const key = parts.shift();
    if (key) map[key] = parts.join(" ");
  }
  return {
    permitRootLogin: map.permitrootlogin || null,
    passwordAuthentication: map.passwordauthentication || null,
    kbdInteractiveAuthentication: map.kbdinteractiveauthentication || null,
    pubkeyAuthentication: map.pubkeyauthentication || null,
  };
}

function connectFingerprint(container, path) {
  if (!container) return { present: false };
  const present = run(
    "docker",
    ["exec", container, "sh", "-lc", "test -f " + JSON.stringify(path)],
    true,
  );
  if (present === null) return { present: false };
  const size = run("docker", [
    "exec",
    container,
    "sh",
    "-lc",
    "stat -c %s " + JSON.stringify(path),
  ]);
  const sha = run("docker", [
    "exec",
    container,
    "sh",
    "-lc",
    "sha256sum " + JSON.stringify(path) + " | awk '{print $1}'",
  ]);
  return { present: true, sizeBytes: Number(size), sha256: sha };
}

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

async function main() {
  const envPath = resolve(ROOT, DEPLOY_ENV);
  if (!existsSync(envPath)) die("deployment env is missing");
  const envStat = lstatSync(envPath);
  if (envStat.isSymbolicLink()) die("deployment env must not be a symlink");
  const envMode = envStat.mode & 0o777;
  if (envMode !== 0o600) die("deployment env must be mode 600");
  if (readFileSync(envPath, "utf8").includes("CHANGE_ME")) die("deployment env contains CHANGE_ME");

  const overlayPath = resolve(ROOT, OVERLAY);
  if (!existsSync(overlayPath) || lstatSync(overlayPath).isSymbolicLink()) {
    die("compose overlay is missing or unsafe");
  }

  run("docker", ["network", "inspect", EDGE_NETWORK]);
  run("docker", composeArgs().concat(["config", "--quiet"]));

  const headSha = run("git", ["rev-parse", "HEAD"]);
  const cleanWorktree = run("git", ["status", "--porcelain"]) === "";
  const configured = lines(
    run("docker", composeArgs().concat(["config", "--services"])),
  );
  const running = lines(
    run("docker", composeArgs().concat(["ps", "--status", "running", "--services"])),
  );
  const nonRunning = configured.filter((name) => !running.includes(name));

  const containerNames = lines(
    run("docker", [
      "ps",
      "--filter",
      "label=com.docker.compose.project=" + PROJECT,
      "--format",
      "{{.Names}}",
    ]),
  );

  const containers = containerNames.map((name) => ({
    name,
    image: run("docker", ["inspect", "--format", "{{.Config.Image}}", name]),
    restartPolicy: run("docker", ["inspect", "--format", "{{.HostConfig.RestartPolicy.Name}}", name]),
    publishedPorts: lines(run("docker", ["port", name], true) || ""),
  }));

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

  const dockerEnabled = run("systemctl", ["is-enabled", "docker"], true) === "enabled";
  const ufw = run("sudo", ["-n", "ufw", "status", "verbose"], true) || "";
  const ufwActive = /^Status:\s+active$/mu.test(ufw);
  const sshdRaw =
    run("sudo", ["-n", "sshd", "-T"], true) ||
    run("sshd", ["-T"], true) ||
    "";
  const sshd = sshEffective(sshdRaw);
  const unattendedUpgradesEnabled =
    run("systemctl", ["is-enabled", "unattended-upgrades.service"], true) === "enabled";

  const disk = statfsSync(ROOT, { bigint: true });
  const availableDiskGiB = Number(Number(disk.bavail * disk.bsize) / 1024 ** 3);
  const memText = readFileSync("/proc/meminfo", "utf8");
  const memMatch = memText.match(/^MemAvailable:\s+(\d+)\s+kB$/mu);
  const availableMemoryMiB = memMatch ? Number(memMatch[1]) / 1024 : 0;

  const connectContainer =
    containerNames.find((name) => name === PROJECT + "-connect-1") ||
    containerNames.find((name) => name.includes("-connect-")) ||
    null;

  const connect = {
    runtimeSettings: connectFingerprint(connectContainer, "/app/data/connect-runtime-settings.json"),
    vaultCiphertext: connectFingerprint(connectContainer, "/app/data/connect-credentials.vault.json"),
    spendBudget: connectFingerprint(connectContainer, "/app/data/connect-spend-budget.json"),
  };

  const home = await status("/");
  const ops = await status("/ops");
  const blockers = [];
  const warnings = [];

  if (EXPECTED_SHA && headSha !== EXPECTED_SHA)
    blockers.push("HEAD does not match expected SHA");
  if (!cleanWorktree) blockers.push("tracked worktree is dirty");
  if (nonRunning.length) blockers.push("one or more configured services are not running");
  if (configured.length !== containerNames.length)
    blockers.push("container count differs from configured services");
  if (containers.some((item) => item.restartPolicy !== "unless-stopped")) {
    blockers.push("one or more containers do not use restart=unless-stopped");
  }
  if (containers.some((item) => item.publishedPorts.length > 0)) {
    blockers.push("one or more ECORIONE staging containers publish host ports");
  }
  if (!dockerEnabled) blockers.push("Docker is not enabled at boot");
  if (!ufwActive) blockers.push("UFW is not active");
  if (sshd.passwordAuthentication !== "no")
    blockers.push("SSH password authentication is not disabled");
  if (
    !["no", "prohibit-password", "without-password"].includes(sshd.permitRootLogin || "")
  ) {
    blockers.push("SSH root login is not restricted");
  }
  if (sshd.kbdInteractiveAuthentication !== "no") {
    blockers.push("SSH keyboard-interactive authentication is not disabled");
  }
  if (sshd.pubkeyAuthentication !== "yes")
    blockers.push("SSH public-key authentication is not enabled");
  if (availableDiskGiB < 10) blockers.push("available disk is below 10 GiB");
  if (availableMemoryMiB < 512) blockers.push("available memory is below 512 MiB");
  if (!(home >= 200 && home < 400)) blockers.push("public home is not 2xx/3xx");
  if (ops !== 401) blockers.push("unauthenticated /ops is not 401");
  if (!unattendedUpgradesEnabled) warnings.push("unattended-upgrades is not enabled");
  if (!connect.runtimeSettings.present) warnings.push("Connect runtime settings file is absent");
  if (!connect.vaultCiphertext.present) warnings.push("Connect Vault ciphertext file is absent");

  const result = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    boundary: "PCS-09 SumoPod staging hardening inventory",
    source: { headSha, expectedSha: EXPECTED_SHA || null, cleanWorktree },
    deployment: {
      envPath: DEPLOY_ENV,
      envMode: envMode.toString(8),
      project: PROJECT,
      overlay: OVERLAY,
      edgeNetwork: EDGE_NETWORK,
      configuredServices: configured,
      runningServices: running,
      nonRunningServices: nonRunning,
      volumes,
    },
    runtime: { dockerEnabledAtBoot: dockerEnabled, containers },
    host: {
      availableDiskGiB: Number(availableDiskGiB.toFixed(2)),
      availableMemoryMiB: Number(availableMemoryMiB.toFixed(1)),
      ufwActive,
      sshd,
      unattendedUpgradesEnabled,
    },
    connectDurability: connect,
    publicBoundary: { home, ops },
    blockers,
    warnings,
    closureReady: blockers.length === 0,
    redactionBoundary:
      "No env values, credential plaintext, Vault plaintext, private keys, provider responses, prompts, user data, or database content are collected.",
  };

  console.log(JSON.stringify(result, null, 2));
  if (strict && blockers.length > 0) {
    console.error("FAIL PCS-09 staging inventory: " + String(blockers.length) + " blocker(s)");
    process.exitCode = 2;
    return;
  }
  console.log(
    blockers.length === 0
      ? "PASS PCS-09 staging inventory"
      : "PCS-09 baseline captured with hardening blockers",
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
