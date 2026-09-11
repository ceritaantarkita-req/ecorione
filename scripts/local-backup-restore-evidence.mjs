import { spawn, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  chmodSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { connect as netConnect } from "node:net";
import { basename, join, resolve } from "node:path";
import {
  OWNER_WORKERS,
  backupIds,
  parseWorkerJson,
  requiredBackupGaps,
  resolveEvidencePath,
  safeRunId,
} from "./local-backup-restore-evidence-lib.mjs";

const REPO_ROOT = resolve(import.meta.dirname, "..");
const STATE_PATH = join(REPO_ROOT, ".ecorione/evidence/local-backup-restore-state.json");
const PERSISTENCE_STATE_PATH = join(
  REPO_ROOT,
  ".ecorione/evidence/local-persistence-restart-state.json",
);
const TEMPORAL_CONTAINER = "ecorione-temporal";
const TEMPORAL_DB_CONTAINER = "ecorione-temporal-db";
const TEMPORAL_VOLUME = "ecorione_temporal_db";
const TEMPORAL_IMAGE = "temporalio/auto-setup:1.29.7";
const POSTGRES_IMAGE = "postgres:17.6-alpine";
const INTERNAL_TOKEN = process.env.ECORIONE_INTERNAL_TOKEN ?? "";

const ACTIVE_URLS = {
  rnd: process.env.ECORIONE_RND_URL ?? "http://127.0.0.1:17021",
  context: process.env.ECORIONE_CONTEXT_URL ?? "http://127.0.0.1:17022",
  connect: process.env.ECORIONE_CONNECT_URL ?? "http://127.0.0.1:17023",
  hub: process.env.ECORIONE_HUB_URL ?? "http://127.0.0.1:17024",
  artifact: process.env.ECORIONE_ARTIFACT_URL ?? "http://127.0.0.1:17025",
  sandbox: process.env.ECORIONE_SANDBOX_URL ?? "http://127.0.0.1:17026",
  space: process.env.ECORIONE_SPACE_URL ?? "http://127.0.0.1:17027",
  flow: process.env.ECORIONE_FLOW_URL ?? "http://127.0.0.1:17028",
};

const ISOLATED_PORTS = {
  sync: 18011,
  rnd: 18021,
  context: 18022,
  connect: 18023,
  hub: 18024,
  artifact: 18025,
  sandbox: 18026,
  space: 18027,
  flow: 18028,
};

function parseArgs(argv) {
  let phase = "run";
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--phase") {
      phase = argv[index + 1] ?? "";
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${value}`);
    }
  }
  if (phase !== "inventory" && phase !== "run") {
    throw new Error(`phase tidak didukung: ${phase}`);
  }
  return { phase };
}

function command(commandName, args, options = {}) {
  const result = spawnSync(commandName, args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    env: options.env ?? process.env,
    maxBuffer: options.maxBuffer ?? 20 * 1024 * 1024,
  });
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0) {
    const stderr = String(result.stderr ?? "").slice(-6000);
    const stdout = String(result.stdout ?? "").slice(-6000);
    throw new Error(
      `${commandName} ${args.join(" ")} gagal (${String(result.status)}):\n${stdout}\n${stderr}`,
    );
  }
  return String(result.stdout ?? "");
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function writePrivateJson(path, value) {
  mkdirSync(resolve(path, ".."), { recursive: true, mode: 0o700 });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  chmodSync(path, 0o600);
}

async function getResponse(url, { bytes = false } = {}) {
  const headers = INTERNAL_TOKEN === "" ? {} : { Authorization: `Bearer ${INTERNAL_TOKEN}` };
  const response = await fetch(url, { headers });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GET ${url} HTTP ${response.status}: ${body.slice(0, 1000)}`);
  }
  if (bytes) return Buffer.from(await response.arrayBuffer());
  return response.json();
}

async function healthSnapshot(urls) {
  const result = {};
  for (const [name, baseUrl] of Object.entries(urls)) {
    try {
      const response = await fetch(`${baseUrl}/healthz`);
      result[name] = {
        ok: response.ok,
        status: response.status,
        body: response.ok ? await response.json() : await response.text(),
      };
    } catch (error) {
      result[name] = {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
  return result;
}

function gitSnapshot() {
  const head = command("git", ["rev-parse", "HEAD"]).trim();
  const originMain = command("git", ["rev-parse", "origin/main"]).trim();
  const trackedStatus = command("git", ["status", "--short"]).trim();
  return {
    head,
    originMain,
    trackedClean: trackedStatus === "",
    trackedStatus,
    synced: head === originMain,
  };
}

function dockerContainer(name) {
  const output = command("docker", [
    "inspect",
    "--format",
    "{{.Name}}|{{.Config.Image}}|{{.State.Status}}",
    name,
  ]).trim();
  const [rawName, image, state] = output.split("|");
  return { name: rawName?.replace(/^\//u, ""), image, state };
}

function volumeExists(name) {
  const output = command("docker", ["volume", "ls", "--format", "{{.Name}}"]).split(/\r?\n/u);
  return output.includes(name);
}

function isolatedPortsFree() {
  const listeners = command("ss", ["-ltn"]);
  const busy = [];
  for (const [name, port] of Object.entries(ISOLATED_PORTS)) {
    if (new RegExp(`:${String(port)}\\b`, "u").test(listeners)) busy.push({ name, port });
  }
  return { ok: busy.length === 0, busy };
}

function readPersistenceState() {
  if (!existsSync(PERSISTENCE_STATE_PATH)) return null;
  return JSON.parse(readFileSync(PERSISTENCE_STATE_PATH, "utf8"));
}

async function inventory() {
  const repo = gitSnapshot();
  const health = await healthSnapshot(ACTIVE_URLS);
  let temporal = null;
  let temporalDb = null;
  let dockerError = null;
  try {
    temporal = dockerContainer(TEMPORAL_CONTAINER);
    temporalDb = dockerContainer(TEMPORAL_DB_CONTAINER);
  } catch (error) {
    dockerError = error instanceof Error ? error.message : String(error);
  }
  const ports = isolatedPortsFree();
  const persistence = readPersistenceState();
  const result = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    repo,
    activeHealth: health,
    docker: {
      temporal,
      temporalDb,
      temporalVolume: volumeExists(TEMPORAL_VOLUME),
      error: dockerError,
    },
    isolatedPorts: ports,
    persistenceEvidence: persistence
      ? {
          phase: persistence.phase,
          baselineRevision: persistence.baselineRevision,
          flowId: persistence.flow?.flowId ?? null,
          sessionId: persistence.ledger?.sessionId ?? null,
          episodeId: persistence.context?.episodeId ?? null,
          artifactId: persistence.artifact?.artifactId ?? null,
        }
      : null,
  };

  const unhealthy = Object.entries(health)
    .filter(([, value]) => !value.ok)
    .map(([name]) => name);
  const dockerOkay =
    temporal?.image === TEMPORAL_IMAGE &&
    temporal?.state === "running" &&
    temporalDb?.image === POSTGRES_IMAGE &&
    temporalDb?.state === "running" &&
    result.docker.temporalVolume;
  const persistenceOkay =
    persistence !== null &&
    persistence.phase === "cleanup-complete" &&
    typeof persistence.flow?.flowId === "string";

  console.log(JSON.stringify(result, null, 2));
  if (!repo.synced || !repo.trackedClean) {
    throw new Error("backup/restore inventory gagal: repo belum synchronized/clean");
  }
  if (unhealthy.length > 0) {
    throw new Error(`backup/restore inventory gagal: owner health unavailable: ${unhealthy.join(", ")}`);
  }
  if (!dockerOkay) {
    throw new Error("backup/restore inventory gagal: exact Temporal/PostgreSQL boundary tidak ready");
  }
  if (!ports.ok) {
    throw new Error(`backup/restore inventory gagal: isolated ports busy: ${JSON.stringify(ports.busy)}`);
  }
  if (!persistenceOkay) {
    throw new Error("backup/restore inventory gagal: closed persistence evidence state tidak tersedia");
  }
  if (INTERNAL_TOKEN === "") {
    throw new Error("backup/restore inventory gagal: ECORIONE_INTERNAL_TOKEN tidak tersedia");
  }
  console.log("PASS backup/restore inventory: repo, owners, isolated ports and Temporal boundary are ready");
  return { result, persistence };
}

async function captureSemanticBaseline(persistence) {
  const ledger = await getResponse(
    `${ACTIVE_URLS.hub}/v1/history/sessions/${persistence.ledger.sessionId}?scope=personal&maxSensitivity=INTERNAL&hostedEligible=0`,
  );
  const context = await getResponse(
    `${ACTIVE_URLS.context}/v1/episodes/${persistence.context.episodeId}`,
  );
  const artifactBytes = await getResponse(
    `${ACTIVE_URLS.artifact}/v1/artifacts/${persistence.artifact.artifactId}/content?scope=personal&maxSensitivity=INTERNAL&hostedEligible=0`,
    { bytes: true },
  );
  const artifactSha256 = createHash("sha256").update(artifactBytes).digest("hex");
  const flow = await getResponse(`${ACTIVE_URLS.flow}/v1/flows/${persistence.flow.flowId}`);
  const approval = await getResponse(
    `${ACTIVE_URLS.hub}/v1/approvals/by-idempotency-key?idempotencyKey=${encodeURIComponent(
      persistence.flow.approvalKey,
    )}`,
  );

  if (ledger.headHash !== persistence.ledger.headHash) {
    throw new Error("live Ledger headHash tidak sama dengan closed persistence evidence");
  }
  if (context.id !== persistence.context.episodeId) {
    throw new Error("live Context episode identity berubah");
  }
  if (artifactSha256 !== persistence.artifact.sha256) {
    throw new Error("live Artifact digest tidak sama dengan closed persistence evidence");
  }
  if (flow.flowId !== persistence.flow.flowId) {
    throw new Error("live Flow identity berubah");
  }

  return {
    ledger: {
      id: ledger.id,
      nextSeq: ledger.nextSeq,
      headHash: ledger.headHash,
    },
    context: {
      id: context.id,
      rawText: context.rawText,
    },
    artifact: {
      id: persistence.artifact.artifactId,
      sha256: artifactSha256,
      sizeBytes: artifactBytes.length,
    },
    flow: {
      flowId: flow.flowId,
      status: flow.status,
    },
    approval: {
      operationId: approval.operationId,
      status: approval.status,
    },
  };
}

function runOwnerWorker(owner, action, backupRoot, timestamp, restoreRoot = null, ids = null) {
  const worker = OWNER_WORKERS[owner];
  if (worker === undefined) throw new Error(`owner worker tidak ditemukan: ${owner}`);
  const args = ["exec", "tsx", worker, action, backupRoot, timestamp];
  if (action === "restore") {
    if (restoreRoot === null || ids === null) throw new Error(`restore args incomplete: ${owner}`);
    args.push(restoreRoot, JSON.stringify(ids));
  }
  const stdout = command("pnpm", args, { maxBuffer: 30 * 1024 * 1024 });
  return parseWorkerJson(stdout, owner);
}

function backupTemporalDatabases(runRoot) {
  const temporalRoot = resolveEvidencePath(REPO_ROOT, join(runRoot, "temporal"));
  mkdirSync(temporalRoot, { recursive: true, mode: 0o700 });
  const postgresUser = command("docker", ["exec", TEMPORAL_DB_CONTAINER, "printenv", "POSTGRES_USER"])
    .trim();
  if (postgresUser === "") throw new Error("Temporal PostgreSQL POSTGRES_USER kosong");
  const databases = command("docker", [
    "exec",
    TEMPORAL_DB_CONTAINER,
    "psql",
    "-U",
    postgresUser,
    "-d",
    "postgres",
    "-Atqc",
    "SELECT datname FROM pg_database WHERE datname IN ('temporal','temporal_visibility') ORDER BY datname",
  ])
    .trim()
    .split(/\r?\n/u)
    .filter(Boolean);
  for (const expected of ["temporal", "temporal_visibility"]) {
    if (!databases.includes(expected)) throw new Error(`Temporal database tidak ditemukan: ${expected}`);
  }

  const dumps = {};
  for (const database of ["temporal", "temporal_visibility"]) {
    const path = join(temporalRoot, `${database}.dump`);
    const fd = openSync(path, "w", 0o600);
    try {
      const result = spawnSync(
        "docker",
        ["exec", TEMPORAL_DB_CONTAINER, "pg_dump", "-U", postgresUser, "-Fc", database],
        { cwd: REPO_ROOT, stdio: ["ignore", fd, "pipe"] },
      );
      if (result.error !== undefined) throw result.error;
      if (result.status !== 0) {
        throw new Error(
          `pg_dump ${database} gagal: ${Buffer.from(result.stderr ?? "").toString("utf8").slice(-4000)}`,
        );
      }
    } finally {
      closeSync(fd);
    }
    chmodSync(path, 0o600);
    const stat = statSync(path);
    if (stat.size === 0) throw new Error(`Temporal dump kosong: ${database}`);
    dumps[database] = {
      file: path,
      sizeBytes: stat.size,
      sha256: sha256File(path),
    };
  }
  return { postgresUser, databases, dumps };
}

async function waitForPostgres(container, user, timeoutMs = 45_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = spawnSync("docker", ["exec", container, "pg_isready", "-U", user], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });
    if (result.status === 0) return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 750));
  }
  throw new Error(`isolated PostgreSQL tidak ready: ${container}`);
}

async function waitForTcp(port, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const connected = await new Promise((resolvePromise) => {
      const socket = netConnect({ host: "127.0.0.1", port });
      const finish = (value) => {
        socket.destroy();
        resolvePromise(value);
      };
      socket.once("connect", () => finish(true));
      socket.once("error", () => finish(false));
      socket.setTimeout(1000, () => finish(false));
    });
    if (connected) return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 750));
  }
  throw new Error(`TCP 127.0.0.1:${String(port)} tidak ready`);
}

function dockerTry(args) {
  spawnSync("docker", args, { cwd: REPO_ROOT, encoding: "utf8" });
}

async function restoreTemporalIsolated(runId, temporalBackup) {
  const suffix = safeRunId(runId).replaceAll(/[^a-z0-9]/giu, "").slice(-12).toLowerCase();
  const network = `ecorione-br-net-${suffix}`;
  const postgres = `ecorione-br-db-${suffix}`;
  const temporal = `ecorione-br-temporal-${suffix}`;
  const password = randomUUID().replaceAll("-", "");
  const user = temporalBackup.postgresUser;
  const resources = { network, postgres, temporal };

  try {
    command("docker", ["network", "create", network]);
    command("docker", [
      "run",
      "-d",
      "--name",
      postgres,
      "--network",
      network,
      "-e",
      `POSTGRES_USER=${user}`,
      "-e",
      `POSTGRES_PASSWORD=${password}`,
      "-e",
      "POSTGRES_DB=postgres",
      POSTGRES_IMAGE,
    ]);
    await waitForPostgres(postgres, user);

    for (const database of ["temporal", "temporal_visibility"]) {
      command("docker", ["exec", postgres, "createdb", "-U", user, database]);
      command("docker", [
        "cp",
        temporalBackup.dumps[database].file,
        `${postgres}:/tmp/${database}.dump`,
      ]);
      command("docker", [
        "exec",
        postgres,
        "pg_restore",
        "-U",
        user,
        "--no-owner",
        "--no-privileges",
        "-d",
        database,
        `/tmp/${database}.dump`,
      ]);
    }

    const tableCounts = {};
    for (const database of ["temporal", "temporal_visibility"]) {
      const count = Number(
        command("docker", [
          "exec",
          postgres,
          "psql",
          "-U",
          user,
          "-d",
          database,
          "-Atqc",
          "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'",
        ]).trim(),
      );
      if (!Number.isFinite(count) || count <= 0) {
        throw new Error(`isolated ${database} restore tidak memiliki public tables`);
      }
      tableCounts[database] = count;
    }

    command("docker", [
      "run",
      "-d",
      "--name",
      temporal,
      "--network",
      network,
      "-p",
      "127.0.0.1::7233",
      "-e",
      "DB=postgres12",
      "-e",
      "DB_PORT=5432",
      "-e",
      `POSTGRES_USER=${user}`,
      "-e",
      `POSTGRES_PWD=${password}`,
      "-e",
      `POSTGRES_SEEDS=${postgres}`,
      TEMPORAL_IMAGE,
    ]);

    let port = null;
    const portDeadline = Date.now() + 30_000;
    while (Date.now() < portDeadline) {
      const output = spawnSync("docker", ["port", temporal, "7233/tcp"], {
        cwd: REPO_ROOT,
        encoding: "utf8",
      });
      if (output.status === 0 && String(output.stdout).trim() !== "") {
        const match = String(output.stdout).trim().match(/:(\d+)$/u);
        if (match) {
          port = Number(match[1]);
          break;
        }
      }
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
    }
    if (port === null) throw new Error("isolated Temporal host port tidak ditemukan");
    await waitForTcp(port);
    return {
      resources,
      address: `127.0.0.1:${String(port)}`,
      tableCounts,
    };
  } catch (error) {
    dockerTry(["rm", "-f", temporal]);
    dockerTry(["rm", "-f", postgres]);
    dockerTry(["network", "rm", network]);
    throw error;
  }
}

function isolatedEnv(restoreRoot, temporalAddress, connectRestore) {
  const connectStateRoot = resolve(restoreRoot, "connect/state");
  const restoredConnect = connectRestore?.target ?? {};
  return {
    ...process.env,
    ECORIONE_ALLOW_REMOTE_BIND: "0",
    ECORIONE_COST_KILL_SWITCH: "1",
    ECORIONE_RND_PORT: String(ISOLATED_PORTS.rnd),
    ECORIONE_CONTEXT_PORT: String(ISOLATED_PORTS.context),
    ECORIONE_CONNECT_PORT: String(ISOLATED_PORTS.connect),
    ECORIONE_HUB_PORT: String(ISOLATED_PORTS.hub),
    ECORIONE_ARTIFACT_PORT: String(ISOLATED_PORTS.artifact),
    ECORIONE_SANDBOX_PORT: String(ISOLATED_PORTS.sandbox),
    ECORIONE_SPACE_PORT: String(ISOLATED_PORTS.space),
    ECORIONE_FLOW_PORT: String(ISOLATED_PORTS.flow),
    ECORIONE_SYNC_PORT: String(ISOLATED_PORTS.sync),
    ECORIONE_RND_URL: `http://127.0.0.1:${String(ISOLATED_PORTS.rnd)}`,
    ECORIONE_CONTEXT_URL: `http://127.0.0.1:${String(ISOLATED_PORTS.context)}`,
    ECORIONE_CONNECT_URL: `http://127.0.0.1:${String(ISOLATED_PORTS.connect)}`,
    ECORIONE_HUB_URL: `http://127.0.0.1:${String(ISOLATED_PORTS.hub)}`,
    ECORIONE_ARTIFACT_URL: `http://127.0.0.1:${String(ISOLATED_PORTS.artifact)}`,
    ECORIONE_SANDBOX_URL: `http://127.0.0.1:${String(ISOLATED_PORTS.sandbox)}`,
    ECORIONE_SPACE_URL: `http://127.0.0.1:${String(ISOLATED_PORTS.space)}`,
    ECORIONE_FLOW_URL: `http://127.0.0.1:${String(ISOLATED_PORTS.flow)}`,
    ECORIONE_SYNC_URL: `http://127.0.0.1:${String(ISOLATED_PORTS.sync)}`,
    ECORIONE_DB_PATH: resolve(restoreRoot, "context/context.db"),
    ECORIONE_HUB_DB_PATH: resolve(restoreRoot, "hub/hub.db"),
    ECORIONE_RND_DB_PATH: resolve(restoreRoot, "rnd/rnd.db"),
    ECORIONE_RND_DATASET_ROOT: resolve(restoreRoot, "rnd/datasets"),
    ECORIONE_SYNC_DB_PATH: resolve(restoreRoot, "sync/sync.db"),
    ECORIONE_SPACE_DB_PATH: resolve(restoreRoot, "space/space.db"),
    ECORIONE_FLOW_DB_PATH: resolve(restoreRoot, "flow/flow.sqlite"),
    ECORIONE_ARTIFACT_DIR: resolve(restoreRoot, "artifact/artifacts"),
    ECORIONE_SANDBOX_WORKSPACE_ROOT: resolve(restoreRoot, "sandbox/workspaces"),
    ECORIONE_SANDBOX_RECEIPT_DIR: resolve(restoreRoot, "sandbox/receipts"),
    ECORIONE_CONNECT_VAULT_PATH:
      restoredConnect.credentialVaultPath ?? resolve(restoreRoot, "connect/vault/credentials.vault.json"),
    ECORIONE_CONNECT_SETTINGS_PATH:
      restoredConnect.runtimeSettingsPath ?? resolve(connectStateRoot, "connect-runtime-settings.json"),
    ECORIONE_SPEND_BUDGET_PATH:
      restoredConnect.spendBudgetPath ?? resolve(connectStateRoot, "connect-spend-budget.json"),
    ECORIONE_MCP_OUTBOUND_REGISTRY_PATH:
      restoredConnect.mcpRegistryPath ?? resolve(connectStateRoot, "connect-mcp-registry.json"),
    ECORIONE_MCP_OUTBOUND_INVOCATION_PATH:
      restoredConnect.mcpInvocationPath ?? resolve(connectStateRoot, "connect-mcp-invocations.json"),
    ECORIONE_TEMPORAL_ADDRESS: temporalAddress,
    ECORIONE_TEMPORAL_NAMESPACE: process.env.ECORIONE_TEMPORAL_NAMESPACE ?? "default",
    ECORIONE_SYNC_OWNER_TOKEN:
      process.env.ECORIONE_SYNC_OWNER_TOKEN ?? `backup-evidence-${randomUUID()}`,
    ECORIONE_MCP_URL: `http://127.0.0.1:18010`,
  };
}

function startIsolatedService(name, sourcePath, env) {
  const child = spawn("pnpm", ["exec", "tsx", sourcePath], {
    cwd: REPO_ROOT,
    env,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let logs = "";
  const append = (chunk) => {
    logs = `${logs}${String(chunk)}`.slice(-20_000);
  };
  child.stdout?.on("data", append);
  child.stderr?.on("data", append);
  return { name, child, logs: () => logs };
}

async function waitForHealth(processInfo, url, timeoutMs = 45_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (processInfo.child.exitCode !== null) {
      throw new Error(
        `${processInfo.name} isolated exited ${String(processInfo.child.exitCode)}:\n${processInfo.logs()}`,
      );
    }
    try {
      const response = await fetch(`${url}/healthz`);
      if (response.ok) return response.json();
    } catch {
      // retry until deadline
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }
  throw new Error(`${processInfo.name} isolated health timeout:\n${processInfo.logs()}`);
}

async function stopIsolatedServices(processes) {
  for (const processInfo of [...processes].reverse()) {
    if (processInfo.child.pid === undefined || processInfo.child.exitCode !== null) continue;
    try {
      process.kill(-processInfo.child.pid, "SIGTERM");
    } catch {
      // already stopped
    }
  }
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 750));
  for (const processInfo of [...processes].reverse()) {
    if (processInfo.child.pid === undefined || processInfo.child.exitCode !== null) continue;
    try {
      process.kill(-processInfo.child.pid, "SIGKILL");
    } catch {
      // already stopped
    }
  }
}

async function verifyIsolatedOwners(restoreRoot, temporalRestore, restores, persistence, baseline) {
  const env = isolatedEnv(restoreRoot, temporalRestore.address, restores.connect);
  const processes = [];
  const health = {};
  const definitions = [
    ["rnd", "services/rnd/src/main.ts", ISOLATED_PORTS.rnd],
    ["context", "services/context/src/main.ts", ISOLATED_PORTS.context],
    ["connect", "services/connect/src/main.ts", ISOLATED_PORTS.connect],
    ["hub", "services/hub/src/main.ts", ISOLATED_PORTS.hub],
    ["artifact", "services/artifact/src/main.ts", ISOLATED_PORTS.artifact],
    ["sandbox", "services/sandbox/src/main.ts", ISOLATED_PORTS.sandbox],
    ["flow", "services/flow/src/main.ts", ISOLATED_PORTS.flow],
    ["space", "services/space/src/main.ts", ISOLATED_PORTS.space],
  ];
  if (restores.sync?.status === "restored") {
    definitions.push(["sync", "services/sync/src/main.ts", ISOLATED_PORTS.sync]);
  }

  try {
    for (const [name, sourcePath, port] of definitions) {
      const processInfo = startIsolatedService(name, sourcePath, env);
      processes.push(processInfo);
      health[name] = await waitForHealth(processInfo, `http://127.0.0.1:${String(port)}`);
    }

    const isolatedUrls = {
      context: `http://127.0.0.1:${String(ISOLATED_PORTS.context)}`,
      hub: `http://127.0.0.1:${String(ISOLATED_PORTS.hub)}`,
      artifact: `http://127.0.0.1:${String(ISOLATED_PORTS.artifact)}`,
      flow: `http://127.0.0.1:${String(ISOLATED_PORTS.flow)}`,
    };
    const ledger = await getResponse(
      `${isolatedUrls.hub}/v1/history/sessions/${persistence.ledger.sessionId}?scope=personal&maxSensitivity=INTERNAL&hostedEligible=0`,
    );
    const context = await getResponse(
      `${isolatedUrls.context}/v1/episodes/${persistence.context.episodeId}`,
    );
    const artifactBytes = await getResponse(
      `${isolatedUrls.artifact}/v1/artifacts/${persistence.artifact.artifactId}/content?scope=personal&maxSensitivity=INTERNAL&hostedEligible=0`,
      { bytes: true },
    );
    const artifactSha256 = createHash("sha256").update(artifactBytes).digest("hex");
    const flow = await getResponse(`${isolatedUrls.flow}/v1/flows/${persistence.flow.flowId}`);
    const approval = await getResponse(
      `${isolatedUrls.hub}/v1/approvals/by-idempotency-key?idempotencyKey=${encodeURIComponent(
        persistence.flow.approvalKey,
      )}`,
    );

    if (ledger.headHash !== baseline.ledger.headHash || ledger.nextSeq !== baseline.ledger.nextSeq) {
      throw new Error("isolated Hub Ledger tidak sama dengan source baseline");
    }
    if (context.id !== baseline.context.id || context.rawText !== baseline.context.rawText) {
      throw new Error("isolated Context episode tidak sama dengan source baseline");
    }
    if (artifactSha256 !== baseline.artifact.sha256) {
      throw new Error("isolated Artifact bytes digest tidak sama dengan source baseline");
    }
    if (flow.flowId !== baseline.flow.flowId || flow.status !== baseline.flow.status) {
      throw new Error("isolated restored Temporal/Flow identity atau status tidak sama");
    }
    if (
      approval.operationId !== baseline.approval.operationId ||
      approval.status !== baseline.approval.status
    ) {
      throw new Error("isolated Hub approval identity/status tidak sama");
    }

    return {
      health,
      semantic: {
        ledger: { id: ledger.id, nextSeq: ledger.nextSeq, headHash: ledger.headHash },
        context: { id: context.id, rawText: context.rawText },
        artifact: {
          id: persistence.artifact.artifactId,
          sha256: artifactSha256,
          sizeBytes: artifactBytes.length,
        },
        flow: { flowId: flow.flowId, status: flow.status },
        approval: { operationId: approval.operationId, status: approval.status },
      },
    };
  } finally {
    await stopIsolatedServices(processes);
  }
}

function cleanupTemporalIsolated(temporalRestore) {
  if (temporalRestore === null) return;
  dockerTry(["rm", "-f", temporalRestore.resources.temporal]);
  dockerTry(["rm", "-f", temporalRestore.resources.postgres]);
  dockerTry(["network", "rm", temporalRestore.resources.network]);
}

async function runEvidence() {
  const { persistence } = await inventory();
  const createdAt = new Date().toISOString();
  const runId = safeRunId(
    `backup-${createdAt.replaceAll(/[-:.TZ]/gu, "").slice(0, 14)}-${randomUUID().slice(0, 8)}`,
  );
  const runRoot = resolveEvidencePath(
    REPO_ROOT,
    join(REPO_ROOT, ".ecorione/evidence/local-backup-restore", runId),
  );
  const backupRoot = resolveEvidencePath(REPO_ROOT, join(runRoot, "backups"));
  const restoreRoot = resolveEvidencePath(REPO_ROOT, join(runRoot, "restored"));
  mkdirSync(backupRoot, { recursive: true, mode: 0o700 });
  mkdirSync(restoreRoot, { recursive: true, mode: 0o700 });

  const baseline = await captureSemanticBaseline(persistence);
  const backups = {};
  for (const owner of Object.keys(OWNER_WORKERS)) {
    backups[owner] = runOwnerWorker(owner, "backup", backupRoot, createdAt);
  }
  const gaps = requiredBackupGaps(backups);
  if (gaps.length > 0) {
    throw new Error(`required owner backup missing: ${gaps.join(", ")}`);
  }
  const temporalBackup = backupTemporalDatabases(runRoot);

  const backupState = {
    schemaVersion: 1,
    phase: "backup-ready",
    createdAt,
    baselineRevision: command("git", ["rev-parse", "HEAD"]).trim(),
    runId,
    runRoot,
    backupRoot,
    restoreRoot,
    baseline,
    backups,
    temporalBackup,
  };
  writePrivateJson(STATE_PATH, backupState);

  const restoredAt = new Date().toISOString();
  const restores = {};
  for (const owner of Object.keys(OWNER_WORKERS)) {
    restores[owner] = runOwnerWorker(
      owner,
      "restore",
      backupRoot,
      restoredAt,
      restoreRoot,
      backupIds(owner, backups[owner]),
    );
  }

  let temporalRestore = null;
  try {
    temporalRestore = await restoreTemporalIsolated(runId, temporalBackup);
    const isolated = await verifyIsolatedOwners(
      restoreRoot,
      temporalRestore,
      restores,
      persistence,
      baseline,
    );
    const finalState = {
      ...backupState,
      phase: "restore-verified",
      restoredAt,
      restores,
      temporalRestore: {
        address: temporalRestore.address,
        tableCounts: temporalRestore.tableCounts,
        resourcesCleaned: true,
      },
      isolated,
      limitations: [
        "local backup artifacts and restored copies remain on the same laptop/failure domain",
        "Connect vault backup is ciphertext-only; master key remains out-of-band",
        "owners with no durable state file at backup time are reported as missing rather than seeded",
        "this drill does not prove off-host disaster recovery, hard power-loss/fsync semantics, or arbitrary corruption recovery",
      ],
    };
    writePrivateJson(STATE_PATH, finalState);
    console.log(
      JSON.stringify(
        {
          phase: finalState.phase,
          revision: finalState.baselineRevision,
          runId,
          requiredOwnerBackups: Object.fromEntries(
            Object.entries(backups).map(([owner, result]) => [owner, result.status]),
          ),
          temporal: {
            dumpDatabases: temporalBackup.databases,
            tableCounts: temporalRestore.tableCounts,
          },
          semantic: isolated.semantic,
          evidenceState: STATE_PATH,
        },
        null,
        2,
      ),
    );
    console.log(
      "PASS strict local backup/restore: owner backups verified, isolated restores started through owner services, and restored Temporal workflow state matched source",
    );
  } finally {
    cleanupTemporalIsolated(temporalRestore);
  }
}

try {
  const { phase } = parseArgs(process.argv.slice(2));
  if (phase === "inventory") await inventory();
  else await runEvidence();
} catch (error) {
  console.error(
    `local-backup-restore-evidence: failed ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
}
