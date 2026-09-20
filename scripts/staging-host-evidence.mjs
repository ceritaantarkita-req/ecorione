#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, statfsSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const deployEnv = process.env.ECORIONE_DEPLOY_ENV?.trim();
const composeProject = process.env.ECORIONE_COMPOSE_PROJECT?.trim();
const composeOverlay = process.env.ECORIONE_COMPOSE_OVERLAY?.trim() || null;
const edgeNetwork = process.env.ECORIONE_EDGE_NETWORK?.trim() || null;
const expectedSha = process.env.ECORIONE_EXPECTED_SHA?.trim();
const outputPath = process.env.ECORIONE_STAGING_EVIDENCE_OUT?.trim() || null;

if (!deployEnv) {
  throw new Error("ECORIONE_DEPLOY_ENV is required for staging evidence.");
}
if (!composeProject) {
  throw new Error("ECORIONE_COMPOSE_PROJECT is required for staging evidence.");
}
if (!/^[a-z0-9][a-z0-9_-]*$/.test(composeProject)) {
  throw new Error("ECORIONE_COMPOSE_PROJECT has an invalid Compose project name.");
}
if (!expectedSha || !/^[0-9a-f]{40}$/.test(expectedSha)) {
  throw new Error("ECORIONE_EXPECTED_SHA must be the exact 40-character reviewed Git commit.");
}

const envPath = resolve(ROOT, deployEnv);
const overlayPath = composeOverlay === null ? null : resolve(ROOT, composeOverlay);

function command(commandName, args, options = {}) {
  const result = spawnSync(commandName, args, {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.error !== undefined || result.status !== 0) {
    if (options.allowFailure === true) return null;
    throw new Error(
      `${options.label ?? commandName} failed; inspect the host directly before continuing.`,
    );
  }
  return result.stdout.trim();
}

function splitLines(value) {
  if (value === null || value.length === 0) return [];
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .sort();
}

function relativeDeploymentPath(path) {
  const value = relative(ROOT, path);
  if (value.startsWith("..")) return "<outside-repository>";
  return value.replaceAll("\\", "/");
}

if (overlayPath !== null) {
  if (!existsSync(overlayPath)) {
    throw new Error("Selected Compose overlay is missing.");
  }
  const overlayStat = lstatSync(overlayPath);
  if (overlayStat.isSymbolicLink()) {
    throw new Error("Selected Compose overlay must not be a symlink.");
  }
  if (relative(ROOT, overlayPath).startsWith("..")) {
    throw new Error("Selected Compose overlay must stay inside the reviewed repository.");
  }
}

if (!existsSync(envPath)) {
  throw new Error(
    "Selected deployment env is missing. Prepare the host-only env before evidence capture.",
  );
}

const envStat = lstatSync(envPath);
if (envStat.isSymbolicLink()) {
  throw new Error("Selected deployment env must not be a symlink.");
}
const envMode = envStat.mode & 0o777;
if (envMode !== 0o600) {
  throw new Error(
    `Selected deployment env must be mode 600; current mode is ${envMode.toString(8)}.`,
  );
}
if (readFileSync(envPath, "utf8").includes("CHANGE_ME")) {
  throw new Error("Selected deployment env still contains CHANGE_ME placeholders.");
}

const headSha = command("git", ["rev-parse", "HEAD"], { label: "git rev-parse HEAD" });
const branch =
  command("git", ["symbolic-ref", "--short", "-q", "HEAD"], {
    allowFailure: true,
    label: "git branch",
  }) ?? "DETACHED";
const worktreeStatus = command("git", ["status", "--porcelain"], {
  label: "git status",
});
const cleanWorktree = worktreeStatus.length === 0;

if (!cleanWorktree) {
  throw new Error(
    "Git worktree is not clean; staging evidence must use reviewed source without host edits.",
  );
}
if (headSha !== expectedSha) {
  throw new Error(
    "HEAD does not match ECORIONE_EXPECTED_SHA; refusing to label this host as reviewed staging.",
  );
}

const composeArgs = [
  "compose",
  "-p",
  composeProject,
  "--env-file",
  envPath,
  "-f",
  "deploy/compose.yml",
];
if (overlayPath !== null) {
  composeArgs.push("-f", overlayPath);
}
if (edgeNetwork !== null) {
  command("docker", ["network", "inspect", edgeNetwork], {
    label: "Docker edge network inventory",
  });
}

command("docker", [...composeArgs, "config", "--quiet"], {
  label: "docker compose config",
});

const configuredServices = splitLines(
  command("docker", [...composeArgs, "config", "--services"], {
    label: "docker compose config services",
  }),
);
const runningServices = splitLines(
  command("docker", [...composeArgs, "ps", "--services", "--status", "running"], {
    label: "docker compose running services",
  }),
);
const nonRunningServices = configuredServices.filter(
  (service) => !runningServices.includes(service),
);

const allVolumes = splitLines(
  command("docker", ["volume", "ls", "--format", "{{.Name}}"], {
    label: "docker volume inventory",
  }),
);
const projectVolumes = allVolumes.filter((name) => name.startsWith(`${composeProject}_`));

const osRelease = existsSync("/etc/os-release") ? readFileSync("/etc/os-release", "utf8") : "";
const prettyName =
  osRelease
    .split(/\r?\n/)
    .find((line) => line.startsWith("PRETTY_NAME="))
    ?.slice("PRETTY_NAME=".length)
    .replace(/^"|"$/g, "") ?? "unknown";

const disk = statfsSync(ROOT, { bigint: true });
const availableBytes = disk.bavail * disk.bsize;
const availableGiB = Number(availableBytes) / 1024 ** 3;

const evidence = {
  generatedAt: new Date().toISOString(),
  boundary: "PCS-07 SumoPod remote staging host evidence",
  source: {
    headSha,
    expectedSha,
    expectedShaMatched: headSha === expectedSha,
    branch,
    cleanWorktree,
  },
  host: {
    os: prettyName,
    kernel: command("uname", ["-sr"], { label: "kernel inventory" }),
    architecture: command("uname", ["-m"], { label: "architecture inventory" }),
    availableDiskGiB: Number(availableGiB.toFixed(2)),
  },
  runtime: {
    dockerServerVersion: command("docker", ["version", "--format", "{{.Server.Version}}"], {
      label: "Docker server version",
    }),
    dockerComposeVersion: command("docker", ["compose", "version", "--short"], {
      label: "Docker Compose version",
    }),
    composeProject,
    composeOverlay: overlayPath === null ? null : relativeDeploymentPath(overlayPath),
    edgeNetwork,
    configuredServices,
    runningServices,
    nonRunningServices,
    projectVolumes,
  },
  deploymentEnv: {
    path: relativeDeploymentPath(envPath),
    mode: envMode.toString(8),
    symlink: false,
    placeholdersPresent: false,
  },
  redactionBoundary:
    "Sanitized metadata only: no IP address, env value, credential, token, private key, Vault content, provider response, prompt, user data, or database content is collected.",
  claimBoundary:
    "This inventory does not prove HTTPS/public-edge security, provider quality, persistence across restart, backup/restore, off-host DR, or durable observability.",
};

const serialized = `${JSON.stringify(evidence, null, 2)}\n`;
process.stdout.write(serialized);

if (outputPath !== null) {
  writeFileSync(resolve(ROOT, outputPath), serialized, {
    encoding: "utf8",
    mode: 0o600,
  });
  console.log("staging-host-evidence: wrote sanitized mode-0600 evidence file");
}

if (nonRunningServices.length > 0) {
  console.error(
    `FAIL staging-host-evidence: non-running staging services: ${nonRunningServices.join(", ")}`,
  );
  process.exit(1);
}
if (projectVolumes.length === 0) {
  console.error("FAIL staging-host-evidence: no Compose project volumes were found");
  process.exit(1);
}

console.log("PASS staging-host-evidence");
