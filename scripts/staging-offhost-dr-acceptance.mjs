#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SHA_RE = /^[0-9a-f]{40}$/;
const TAG_RE = /^staging-[0-9a-f]{12}$/;
const PROJECT_RE = /^[a-z0-9][a-z0-9_-]*$/;

function fail(message) {
  throw new Error("Off-host DR recovery acceptance: " + message);
}

function parseArgs(argv) {
  const index = argv.indexOf("--restore-receipt");
  const path = index >= 0 ? argv[index + 1] : "";
  if (!path) {
    fail("use --restore-receipt <mode-0600 restore receipt>");
  }
  return resolve(path);
}

function run(name, args, options = {}) {
  const result = spawnSync(name, args, {
    cwd: ROOT,
    encoding: "utf8",
    env: options.env ?? process.env,
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `${options.label ?? name} failed (${String(result.status)}): ${String(
        result.stderr || result.stdout || "",
      ).trim()}`,
    );
  }
  return String(result.stdout || "").trim();
}

function lines(value) {
  if (!value) return [];
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .sort();
}

function readOpsCredentials(path) {
  const values = {};
  for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
    const at = raw.indexOf("=");
    if (at > 0) values[raw.slice(0, at)] = raw.slice(at + 1);
  }
  if (!values.username || !values.password) {
    fail("operator credential file is incomplete");
  }
  return values;
}

function assertRegularMode600(path, label) {
  if (!existsSync(path)) fail(`${label} is missing`);
  const info = lstatSync(path);
  if (!info.isFile() || info.isSymbolicLink()) {
    fail(`${label} must be a regular non-symlink file`);
  }
  if ((info.mode & 0o777) !== 0o600) {
    fail(`${label} must be mode 600`);
  }
}

async function main() {
  if (typeof process.getuid === "function" && process.getuid() !== 0) {
    fail("run as root");
  }

  const receiptPath = parseArgs(process.argv.slice(2));
  assertRegularMode600(receiptPath, "restore receipt");
  const restore = JSON.parse(readFileSync(receiptPath, "utf8"));
  if (
    restore.schemaVersion !== 1 ||
    !SHA_RE.test(restore.sourceSha ?? "") ||
    !TAG_RE.test(restore.sourceTag ?? "") ||
    !PROJECT_RE.test(restore.composeProject ?? "") ||
    restore.retrievedFromIndependentTarget !== true ||
    !Array.isArray(restore.restoredVolumes) ||
    restore.restoredVolumes.length === 0
  ) {
    fail("restore receipt is invalid");
  }

  const deployEnvArg = process.env.ECORIONE_DEPLOY_ENV?.trim() || "deploy/staging.env";
  const deployEnv = resolve(ROOT, deployEnvArg);
  const overlayRaw = process.env.ECORIONE_COMPOSE_OVERLAY?.trim() || "";
  const overlay = overlayRaw ? resolve(ROOT, overlayRaw) : null;
  const edgeNetwork = process.env.ECORIONE_EDGE_NETWORK?.trim() || "";
  const publicBaseUrl = process.env.ECORIONE_PUBLIC_BASE_URL?.trim() || "";
  const opsFile = resolve(process.env.ECORIONE_OPS_CREDENTIAL_FILE?.trim() || "");
  const expectedProject =
    process.env.ECORIONE_COMPOSE_PROJECT?.trim() || restore.composeProject;

  if (expectedProject !== restore.composeProject) {
    fail("configured Compose project does not match restore receipt");
  }
  if (!publicBaseUrl) {
    fail("ECORIONE_PUBLIC_BASE_URL is required");
  }
  if (!process.env.ECORIONE_OPS_CREDENTIAL_FILE?.trim()) {
    fail("ECORIONE_OPS_CREDENTIAL_FILE is required");
  }
  assertRegularMode600(deployEnv, "deployment env");
  assertRegularMode600(opsFile, "operator credential file");
  if (overlay !== null) {
    if (!existsSync(overlay) || lstatSync(overlay).isSymbolicLink()) {
      fail("Compose overlay is missing or unsafe");
    }
  }

  const headSha = run("git", ["rev-parse", "HEAD"], { label: "git HEAD" });
  const trackedStatus = run("git", ["status", "--porcelain", "--untracked-files=no"], {
    label: "git status",
  });
  if (headSha !== restore.sourceSha) {
    fail("Git HEAD does not match restored source SHA");
  }
  if (trackedStatus) {
    fail("tracked recovery checkout is dirty");
  }

  const composeArgs = [
    "compose",
    "-p",
    restore.composeProject,
    "--env-file",
    deployEnv,
    "-f",
    resolve(ROOT, "deploy/compose.yml"),
  ];
  if (overlay !== null) composeArgs.push("-f", overlay);

  if (edgeNetwork) {
    run("docker", ["network", "inspect", edgeNetwork], {
      label: "edge network inventory",
    });
  }

  run("docker", [...composeArgs, "config", "--quiet"], {
    label: "compose config",
  });
  const configured = lines(
    run("docker", [...composeArgs, "config", "--services"], {
      label: "configured services",
    }),
  );
  const running = lines(
    run("docker", [...composeArgs, "ps", "--status", "running", "--services"], {
      label: "running services",
    }),
  );
  if (JSON.stringify(configured) !== JSON.stringify(running)) {
    fail("not all configured recovery services are running");
  }

  for (const item of restore.restoredVolumes) {
    if (!item || typeof item.name !== "string") fail("restore receipt volume is invalid");
    run("docker", ["volume", "inspect", item.name], {
      label: `restored volume inventory ${item.name}`,
    });
  }

  const aiContainer = run("docker", [...composeArgs, "ps", "-q", "ai"], {
    label: "AI container lookup",
  });
  if (!aiContainer) fail("AI container is missing");
  const aiImage = run("docker", ["inspect", "--format", "{{.Config.Image}}", aiContainer], {
    label: "AI image identity",
  });
  if (aiImage !== `ecorione:${restore.sourceTag}`) {
    fail("AI image tag does not match restored source tag");
  }

  const smoke = run(process.execPath, ["scripts/production-public-smoke.mjs"], {
    env: { ...process.env, ECORIONE_PUBLIC_BASE_URL: publicBaseUrl },
    label: "public smoke",
  });
  if (smoke) console.log(smoke);

  const opsCredentials = readOpsCredentials(opsFile);
  const ops = run(process.execPath, ["scripts/production-ops-snapshot.mjs"], {
    env: {
      ...process.env,
      ECORIONE_PUBLIC_BASE_URL: publicBaseUrl,
      ECORIONE_OPS_USER: opsCredentials.username,
      ECORIONE_OPS_PASSWORD: opsCredentials.password,
    },
    label: "authenticated Operations",
  });
  if (ops) console.log(ops);

  const hostEvidenceEnv = {
    ...process.env,
    ECORIONE_DEPLOY_ENV: deployEnvArg,
    ECORIONE_COMPOSE_PROJECT: restore.composeProject,
    ECORIONE_EXPECTED_SHA: restore.sourceSha,
  };
  if (overlay !== null) {
    hostEvidenceEnv.ECORIONE_COMPOSE_OVERLAY = resolve(overlay).slice(ROOT.length + 1);
  } else {
    delete hostEvidenceEnv.ECORIONE_COMPOSE_OVERLAY;
  }
  if (edgeNetwork) hostEvidenceEnv.ECORIONE_EDGE_NETWORK = edgeNetwork;

  const hostEvidence = run(process.execPath, ["scripts/staging-host-evidence.mjs"], {
    env: hostEvidenceEnv,
    label: "sanitized exact-host evidence",
  });
  if (hostEvidence) console.log(hostEvidence);

  const stateDir = "/var/lib/ecorione-staging";
  const deployStatePath = resolve(stateDir, "deploy-state.env");
  mkdirSync(stateDir, { recursive: true, mode: 0o755 });
  const deployedAt = new Date().toISOString();
  writeFileSync(
    deployStatePath,
    [
      `current_sha=${restore.sourceSha}`,
      `current_tag=${restore.sourceTag}`,
      `previous_sha=${restore.sourceSha}`,
      `previous_tag=${restore.sourceTag}`,
      `deployed_at=${deployedAt}`,
      "recovery_source=off-host-dr",
      "",
    ].join("\n"),
    { mode: 0o600 },
  );
  chmodSync(deployStatePath, 0o600);

  const stateRoot = resolve(
    process.env.ECORIONE_DR_RECOVERY_STATE_ROOT || "/var/lib/ecorione-dr",
  );
  mkdirSync(stateRoot, { recursive: true, mode: 0o700 });
  const acceptancePath = resolve(stateRoot, "recovery-acceptance.json");
  const acceptance = {
    schemaVersion: 1,
    acceptedAt: deployedAt,
    recoveryStartedAt: restore.recoveryStartedAt ?? null,
    dataReadyAt: restore.dataReadyAt ?? null,
    sourceSha: restore.sourceSha,
    sourceTag: restore.sourceTag,
    composeProject: restore.composeProject,
    serviceCount: running.length,
    restoredVolumeCount: restore.restoredVolumes.length,
    retrievedFromIndependentTarget: true,
    retrievalReceiptFilename: restore.retrievalReceiptFilename ?? null,
    aiImage,
    publicBaseOrigin: new URL(publicBaseUrl).origin,
    preRebootAccepted: true,
    rebootPersistenceAccepted: false,
    claimBoundary:
      "Application recovery accepted before reboot; total-host-loss closure still requires a changed-boot-id persistence proof.",
  };
  writeFileSync(acceptancePath, `${JSON.stringify(acceptance, null, 2)}\n`, {
    mode: 0o600,
  });
  chmodSync(acceptancePath, 0o600);

  console.log("PASS ECORIONE off-host DR application recovery acceptance before reboot");
  console.log(`acceptance_receipt=${acceptancePath}`);
  console.log(`source_sha=${restore.sourceSha}`);
  console.log(`source_tag=${restore.sourceTag}`);
  console.log(
    "NEXT: capture DR reboot baseline, perform an operator-controlled replacement-host reboot, then run DR post-reboot evidence.",
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
