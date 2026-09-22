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
  throw new Error("Off-host DR reboot evidence: " + message);
}

function parseArgs(argv) {
  const phaseAt = argv.indexOf("--phase");
  const receiptAt = argv.indexOf("--acceptance-receipt");
  const canaryAt = argv.indexOf("--canary-state");
  const phase = phaseAt >= 0 ? argv[phaseAt + 1] : "";
  const acceptanceReceipt = receiptAt >= 0 ? argv[receiptAt + 1] : "";
  const canaryState = canaryAt >= 0 ? argv[canaryAt + 1] : "";
  if (!["baseline", "post"].includes(phase) || !acceptanceReceipt || !canaryState) {
    fail(
      "use --phase baseline|post --acceptance-receipt <recovery-acceptance.json> --canary-state <semantic-canary.json>",
    );
  }
  return {
    phase,
    acceptanceReceipt: resolve(acceptanceReceipt),
    canaryState: resolve(canaryState),
  };
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
    if (options.allowFailure) return null;
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

function assertMode600(path, label) {
  if (!existsSync(path)) fail(`${label} is missing`);
  const info = lstatSync(path);
  if (!info.isFile() || info.isSymbolicLink()) {
    fail(`${label} must be a regular non-symlink file`);
  }
  if ((info.mode & 0o777) !== 0o600) {
    fail(`${label} must be mode 600`);
  }
}

function readOpsCredentials(path) {
  const values = {};
  for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
    const at = raw.indexOf("=");
    if (at > 0) values[raw.slice(0, at)] = raw.slice(at + 1);
  }
  if (!values.username || !values.password) fail("operator credential file is incomplete");
  return values;
}

function fingerprint(container, path) {
  if (!container) return { present: false };
  if (
    run("docker", ["exec", container, "sh", "-lc", "test -f " + JSON.stringify(path)], {
      allowFailure: true,
    }) === null
  ) {
    return { present: false };
  }
  return {
    present: true,
    sizeBytes: Number(
      run("docker", ["exec", container, "sh", "-lc", "stat -c %s " + JSON.stringify(path)]),
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

async function httpStatus(base, path) {
  try {
    const response = await fetch(new URL(path, base), {
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    });
    return response.status;
  } catch {
    return 0;
  }
}

function same(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function main() {
  if (typeof process.getuid === "function" && process.getuid() !== 0) {
    fail("run as root");
  }

  const { phase, acceptanceReceipt, canaryState } = parseArgs(process.argv.slice(2));
  assertMode600(acceptanceReceipt, "acceptance receipt");
  assertMode600(canaryState, "semantic canary state");
  const acceptance = JSON.parse(readFileSync(acceptanceReceipt, "utf8"));
  if (
    acceptance.schemaVersion !== 1 ||
    acceptance.preRebootAccepted !== true ||
    acceptance.retrievedFromIndependentTarget !== true ||
    acceptance.semanticCanaryAccepted !== true ||
    typeof acceptance.semanticCanaryStateFilename !== "string" ||
    !/^[0-9a-f]{64}$/.test(acceptance.semanticCanarySha256 ?? "") ||
    !SHA_RE.test(acceptance.sourceSha ?? "") ||
    !TAG_RE.test(acceptance.sourceTag ?? "") ||
    !PROJECT_RE.test(acceptance.composeProject ?? "")
  ) {
    fail("acceptance receipt is invalid");
  }

  const deployEnvArg = process.env.ECORIONE_DEPLOY_ENV?.trim() || "deploy/staging.env";
  const deployEnv = resolve(ROOT, deployEnvArg);
  const overlayArg = process.env.ECORIONE_COMPOSE_OVERLAY?.trim() || "";
  const overlay = overlayArg ? resolve(ROOT, overlayArg) : null;
  const edgeNetwork = process.env.ECORIONE_EDGE_NETWORK?.trim() || "";
  const acceptanceMode = process.env.ECORIONE_DR_ACCEPTANCE_MODE?.trim() || "public";
  if (!["public", "loopback"].includes(acceptanceMode)) {
    fail("ECORIONE_DR_ACCEPTANCE_MODE must be public or loopback");
  }
  const acceptanceBaseUrl =
    acceptanceMode === "loopback"
      ? process.env.ECORIONE_DR_LOOPBACK_BASE_URL?.trim() || "http://127.0.0.1:18080"
      : process.env.ECORIONE_PUBLIC_BASE_URL?.trim() || "";
  const expectedMcpResource = process.env.ECORIONE_DR_EXPECTED_MCP_RESOURCE?.trim() || "";
  const opsFileRaw = process.env.ECORIONE_OPS_CREDENTIAL_FILE?.trim() || "";
  const opsFile = resolve(opsFileRaw);

  if (!acceptanceBaseUrl) {
    fail(
      acceptanceMode === "loopback"
        ? "ECORIONE_DR_LOOPBACK_BASE_URL is required"
        : "ECORIONE_PUBLIC_BASE_URL is required",
    );
  }
  if (acceptanceMode !== acceptance.edgeMode) {
    fail("DR acceptance mode does not match the acceptance receipt");
  }
  if (acceptanceMode === "loopback") {
    if (overlayArg !== "deploy/compose.dr-recovery.yml") {
      fail("loopback DR reboot evidence requires deploy/compose.dr-recovery.yml");
    }
    if (edgeNetwork) {
      fail("loopback DR reboot evidence must not use ECORIONE_EDGE_NETWORK");
    }
    if (!expectedMcpResource) {
      fail("ECORIONE_DR_EXPECTED_MCP_RESOURCE is required in loopback mode");
    }
  }
  if (!opsFileRaw) fail("ECORIONE_OPS_CREDENTIAL_FILE is required");
  if (acceptance.semanticCanaryStateFilename !== canaryState.split(/[\\/]/u).at(-1)) {
    fail("semantic canary filename does not match acceptance receipt");
  }
  const canarySha256 = run("sha256sum", [canaryState], {
    label: "semantic canary checksum",
  }).split(/\s+/u)[0];
  if (canarySha256 !== acceptance.semanticCanarySha256) {
    fail("semantic canary checksum does not match acceptance receipt");
  }
  assertMode600(deployEnv, "deployment env");
  assertMode600(opsFile, "operator credential file");
  if (overlay !== null && (!existsSync(overlay) || lstatSync(overlay).isSymbolicLink())) {
    fail("Compose overlay is missing or unsafe");
  }

  const composeArgs = [
    "compose",
    "-p",
    acceptance.composeProject,
    "--env-file",
    deployEnv,
    "-f",
    resolve(ROOT, "deploy/compose.yml"),
  ];
  if (overlay !== null) composeArgs.push("-f", overlay);

  async function snapshot() {
    run("docker", ["info", "--format", "{{.ServerVersion}}"], { label: "Docker daemon" });
    run("docker", [...composeArgs, "config", "--quiet"], { label: "compose config" });

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
    const volumes = lines(
      run("docker", [
        "volume",
        "ls",
        "--filter",
        `label=com.docker.compose.project=${acceptance.composeProject}`,
        "--format",
        "{{.Name}}",
      ]),
    );

    const aiContainer = run("docker", [...composeArgs, "ps", "-q", "ai"], {
      label: "AI container lookup",
    });
    if (!aiContainer) fail("AI container is missing");
    const aiImage = run("docker", ["inspect", "--format", "{{.Config.Image}}", aiContainer], {
      label: "AI image identity",
    });

    const connectContainer = run("docker", [...composeArgs, "ps", "-q", "connect"], {
      label: "Connect container lookup",
    });

    return {
      capturedAt: new Date().toISOString(),
      bootId: readFileSync("/proc/sys/kernel/random/boot_id", "utf8").trim(),
      headSha: run("git", ["rev-parse", "HEAD"], { label: "git HEAD" }),
      cleanTrackedWorktree:
        run("git", ["status", "--porcelain", "--untracked-files=no"], {
          label: "git status",
        }) === "",
      configured,
      running,
      volumes,
      aiImage,
      connect: {
        runtimeSettings: fingerprint(
          connectContainer,
          "/app/data/connect-runtime-settings.json",
        ),
        vaultCiphertext: fingerprint(
          connectContainer,
          "/app/data/connect-credentials.vault.json",
        ),
        spendBudget: fingerprint(connectContainer, "/app/data/connect-spend-budget.json"),
      },
      publicBoundary: {
        home: await httpStatus(acceptanceBaseUrl, "/"),
        ops: await httpStatus(acceptanceBaseUrl, "/ops"),
      },
    };
  }

  function assertHealthy(state) {
    if (state.headSha !== acceptance.sourceSha)
      fail("HEAD does not match recovered source SHA");
    if (!state.cleanTrackedWorktree) fail("tracked recovery checkout is dirty");
    if (state.aiImage !== `ecorione:${acceptance.sourceTag}`) {
      fail("AI image tag changed from recovered source tag");
    }
    if (!same(state.configured, state.running)) {
      fail("not all configured recovery services are running");
    }
    const expectedVolumes = acceptance.restoredVolumeCount;
    if (!Number.isInteger(expectedVolumes) || state.volumes.length < expectedVolumes) {
      fail("recovered project volume inventory is incomplete");
    }
    if (!(state.publicBoundary.home >= 200 && state.publicBoundary.home < 400)) {
      fail("public home is unhealthy");
    }
    if (state.publicBoundary.ops !== 401) fail("protected /ops boundary is unhealthy");
  }

  const current = await snapshot();
  assertHealthy(current);

  const semanticCanary = run(
    process.execPath,
    ["scripts/staging-offhost-dr-canary.mjs", "--phase", "post", "--state", canaryState],
    {
      env: {
        ...process.env,
        ECORIONE_COMPOSE_PROJECT: acceptance.composeProject,
      },
      label:
        phase === "baseline"
          ? "pre-reboot semantic owner-data DR canary"
          : "post-reboot semantic owner-data DR canary",
    },
  );
  if (semanticCanary) console.log(semanticCanary);

  const stateRoot = resolve(
    process.env.ECORIONE_DR_RECOVERY_STATE_ROOT || "/var/lib/ecorione-dr",
  );
  mkdirSync(stateRoot, { recursive: true, mode: 0o700 });
  const rebootStatePath = resolve(stateRoot, "recovery-reboot-state.json");

  if (phase === "baseline") {
    const baseline = {
      schemaVersion: 1,
      phase: "baseline",
      sourceSha: acceptance.sourceSha,
      sourceTag: acceptance.sourceTag,
      composeProject: acceptance.composeProject,
      ...current,
      claimBoundary:
        "Pre-reboot replacement-host recovery baseline only; changed boot ID and post-reboot acceptance are still required.",
    };
    writeFileSync(rebootStatePath, `${JSON.stringify(baseline, null, 2)}\n`, {
      mode: 0o600,
    });
    chmodSync(rebootStatePath, 0o600);
    console.log(JSON.stringify({ rebootStatePath, bootId: current.bootId }, null, 2));
    console.log(
      "PASS ECORIONE DR replacement-host reboot baseline; perform an operator-controlled full reboot before --phase post",
    );
    return;
  }

  assertMode600(rebootStatePath, "DR reboot baseline");
  const baseline = JSON.parse(readFileSync(rebootStatePath, "utf8"));
  if (
    baseline.schemaVersion !== 1 ||
    baseline.phase !== "baseline" ||
    baseline.sourceSha !== acceptance.sourceSha ||
    baseline.sourceTag !== acceptance.sourceTag
  ) {
    fail("DR reboot baseline is invalid");
  }
  if (baseline.bootId === current.bootId) {
    fail("Linux boot_id did not change; no full replacement-host reboot is proven");
  }
  if (baseline.headSha !== current.headSha) fail("source SHA changed across reboot");
  if (baseline.aiImage !== current.aiImage)
    fail("recovered application image changed across reboot");
  if (!same(baseline.volumes, current.volumes))
    fail("project volume inventory changed across reboot");
  if (!same(baseline.connect, current.connect)) {
    fail("Connect durable-file fingerprints changed across reboot");
  }

  const smoke =
    acceptanceMode === "loopback"
      ? run(process.execPath, ["scripts/staging-offhost-dr-local-smoke.mjs"], {
          env: {
            ...process.env,
            ECORIONE_DR_LOOPBACK_BASE_URL: acceptanceBaseUrl,
            ECORIONE_DR_EXPECTED_MCP_RESOURCE: expectedMcpResource,
          },
          label: "post-reboot replacement-host loopback smoke",
        })
      : run(process.execPath, ["scripts/production-public-smoke.mjs"], {
          env: { ...process.env, ECORIONE_PUBLIC_BASE_URL: acceptanceBaseUrl },
          label: "post-reboot public smoke",
        });
  if (smoke) console.log(smoke);

  const opsCredentials = readOpsCredentials(opsFile);
  const ops = run(process.execPath, ["scripts/production-ops-snapshot.mjs"], {
    env: {
      ...process.env,
      ECORIONE_PUBLIC_BASE_URL: acceptanceBaseUrl,
      ECORIONE_PUBLIC_SMOKE_ALLOW_HTTP: acceptanceMode === "loopback" ? "1" : "0",
      ECORIONE_OPS_USER: opsCredentials.username,
      ECORIONE_OPS_PASSWORD: opsCredentials.password,
    },
    label: "post-reboot authenticated Operations",
  });
  if (ops) console.log(ops);

  const hostEvidenceEnv = {
    ...process.env,
    ECORIONE_DEPLOY_ENV: deployEnvArg,
    ECORIONE_COMPOSE_PROJECT: acceptance.composeProject,
    ECORIONE_EXPECTED_SHA: acceptance.sourceSha,
  };
  if (overlayArg) hostEvidenceEnv.ECORIONE_COMPOSE_OVERLAY = overlayArg;
  else delete hostEvidenceEnv.ECORIONE_COMPOSE_OVERLAY;
  if (edgeNetwork) hostEvidenceEnv.ECORIONE_EDGE_NETWORK = edgeNetwork;

  const hostEvidence = run(process.execPath, ["scripts/staging-host-evidence.mjs"], {
    env: hostEvidenceEnv,
    label: "post-reboot sanitized exact-host evidence",
  });
  if (hostEvidence) console.log(hostEvidence);

  const verifiedAt = new Date().toISOString();
  const result = {
    schemaVersion: 1,
    phase: "post-verified",
    verifiedAt,
    sourceSha: acceptance.sourceSha,
    sourceTag: acceptance.sourceTag,
    composeProject: acceptance.composeProject,
    baselineBootId: baseline.bootId,
    postBootId: current.bootId,
    serviceCount: current.running.length,
    projectVolumeCount: current.volumes.length,
    connectFingerprintsPreserved: true,
    projectVolumesPreserved: true,
    edgeMode: acceptanceMode,
    acceptanceBoundary: current.publicBoundary,
    retrievedFromIndependentTarget: true,
    claimBoundary:
      acceptanceMode === "loopback"
        ? "Replacement-host reboot persistence, exact source/image identity, project volumes, Connect durable fingerprints, loopback policy-boundary smoke, Ops and host evidence verified after independent off-host retrieval; public DNS/TLS remains separate."
        : "Replacement-host reboot persistence, exact source/image identity, project volumes, Connect durable fingerprints, public smoke, Ops and host evidence verified after independent off-host retrieval.",
  };
  writeFileSync(rebootStatePath, `${JSON.stringify(result, null, 2)}\n`, {
    mode: 0o600,
  });
  chmodSync(rebootStatePath, 0o600);

  const updatedAcceptance = {
    ...acceptance,
    rebootPersistenceAccepted: true,
    postRebootAcceptedAt: verifiedAt,
    baselineBootId: baseline.bootId,
    postBootId: current.bootId,
    semanticCanaryVerifiedAfterReboot: true,
    totalHostLossRecoveryCandidate: true,
    claimBoundary:
      "Independent off-host retrieval, clean-host data restore, exact application recovery and changed-boot-id persistence verified; sanitized closure evidence is still required before project-level CLOSED/PASS.",
  };
  writeFileSync(acceptanceReceipt, `${JSON.stringify(updatedAcceptance, null, 2)}\n`, {
    mode: 0o600,
  });
  chmodSync(acceptanceReceipt, 0o600);

  console.log(JSON.stringify(result, null, 2));
  console.log("PASS ECORIONE off-host DR replacement-host reboot persistence evidence");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
