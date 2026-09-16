#!/usr/bin/env node

import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { connect } from "node:net";
import { dirname, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";

const DEFAULT_AI_PORT = 17020;
const AI_FALLBACK_PORTS = Object.freeze(
  Array.from({ length: 11 }, (_, index) => 17029 + index),
);
const RESERVED_PORTS = new Set(Array.from({ length: 8 }, (_, index) => 17021 + index));
const OWNER_SERVICES = Object.freeze([
  ["rnd", 17021],
  ["context", 17022],
  ["connect", 17023],
  ["hub", 17024],
  ["artifact", 17025],
  ["sandbox", 17026],
  ["space", 17027],
  ["flow", 17028],
]);

function parseArgs(argv) {
  const mode = argv[0] ?? "doctor";
  const values = {};
  for (let index = 1; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key?.startsWith("--")) throw new Error(`Argumen tidak dikenal: ${String(key)}`);
    const value = argv[++index];
    if (value === undefined) throw new Error(`${key} membutuhkan nilai.`);
    values[key.slice(2)] = value;
  }
  return { mode, values };
}

function parseEnvFile(path) {
  const result = {};
  if (!path || !existsSync(path)) return result;
  for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const split = line.indexOf("=");
    if (split <= 0) continue;
    result[line.slice(0, split).trim()] = line.slice(split + 1).trim();
  }
  return result;
}

function secret() {
  return randomBytes(32).toString("base64url");
}

function ensureEnvFile(path) {
  mkdirSync(dirname(path), { recursive: true });
  const current = parseEnvFile(path);
  const merged = {
    ECORIONE_AI_PORT: String(DEFAULT_AI_PORT),
    ECORIONE_INTERNAL_TOKEN: secret(),
    ECORIONE_CONNECT_VAULT_MASTER_KEY: secret(),
    ECORIONE_HOSTED_PROVIDER: "anthropic",
    ECORIONE_LOCAL_BASE_URL: "http://127.0.0.1:11434/v1",
    ECORIONE_LOCAL_MODEL: "qwen3:8b-instruct-q4_K_M",
    ECORIONE_COST_KILL_SWITCH: "1",
    ECORIONE_SPEND_DAILY_USD: "1",
    ECORIONE_SPEND_MONTHLY_USD: "10",
    ...current,
  };
  const lines = Object.entries(merged).map(([key, value]) => `${key}=${value}`);
  writeFileSync(path, `${lines.join("\r\n")}\r\n`, { encoding: "utf8", mode: 0o600 });
  return merged;
}

function statePath(dataRoot) {
  return resolve(dataRoot, "runtime", "native-state.json");
}

function readState(dataRoot) {
  const path = statePath(dataRoot);
  if (!existsSync(path)) return null;
  try {
    const value = JSON.parse(readFileSync(path, "utf8"));
    return value?.schemaVersion === 1 ? value : null;
  } catch {
    return null;
  }
}

function writeState(dataRoot, value) {
  const path = statePath(dataRoot);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
}

function clearState(dataRoot) {
  rmSync(statePath(dataRoot), { force: true });
}

function processAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function portReachable(port, timeoutMs = 600) {
  return new Promise((resolvePromise) => {
    const socket = connect({ host: "127.0.0.1", port });
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolvePromise(value);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

async function httpReady(url, marker = null) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1_500) });
    if (response.status < 200 || response.status >= 500) return false;
    if (marker === null) return true;
    const text = await response.text();
    return marker.test(text);
  } catch {
    return false;
  }
}

async function waitUntil(check, label, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }
  throw new Error(`${label} belum ready setelah ${Math.round(timeoutMs / 1000)} detik.`);
}

async function selectAiPort(preferred) {
  const value = Number(preferred || DEFAULT_AI_PORT);
  if (!Number.isInteger(value) || value < 1 || value > 65535 || RESERVED_PORTS.has(value)) {
    throw new Error(`ECORIONE_AI_PORT tidak valid: ${String(preferred)}.`);
  }
  const candidates = [value, DEFAULT_AI_PORT, ...AI_FALLBACK_PORTS].filter(
    (port, index, list) => !RESERVED_PORTS.has(port) && list.indexOf(port) === index,
  );
  for (const port of candidates) {
    if (!(await portReachable(port))) return port;
  }
  throw new Error(
    "Tidak ada Ai port kosong pada preferred port maupun fallback 17020, 17029-17039.",
  );
}

function runtimeEnv(config, dataRoot, aiPort) {
  const data = (name) => resolve(dataRoot, "data", name);
  return {
    ...process.env,
    ...config,
    HOST: "127.0.0.1",
    ECORIONE_ALLOW_REMOTE_BIND: "0",
    ECORIONE_AI_PORT: String(aiPort),
    ECORIONE_RND_URL: "http://127.0.0.1:17021",
    ECORIONE_CONTEXT_URL: "http://127.0.0.1:17022",
    ECORIONE_CONNECT_URL: "http://127.0.0.1:17023",
    ECORIONE_HUB_URL: "http://127.0.0.1:17024",
    ECORIONE_ARTIFACT_URL: "http://127.0.0.1:17025",
    ECORIONE_SANDBOX_URL: "http://127.0.0.1:17026",
    ECORIONE_SPACE_URL: "http://127.0.0.1:17027",
    ECORIONE_FLOW_URL: "http://127.0.0.1:17028",
    ECORIONE_TEMPORAL_ADDRESS: "127.0.0.1:7233",
    ECORIONE_TEMPORAL_NAMESPACE: "default",
    ECORIONE_RND_DB_PATH: resolve(data("rnd"), "rnd.db"),
    ECORIONE_RND_DATASET_ROOT: resolve(data("rnd"), "datasets"),
    ECORIONE_DB_PATH: resolve(data("context"), "context.db"),
    ECORIONE_CONNECT_VAULT_PATH: resolve(data("connect"), "connect-credentials.vault.json"),
    ECORIONE_CONNECT_SETTINGS_PATH: resolve(data("connect"), "connect-runtime-settings.json"),
    ECORIONE_SPEND_BUDGET_PATH: resolve(data("connect"), "connect-spend-budget.json"),
    ECORIONE_MCP_OUTBOUND_REGISTRY_PATH: resolve(data("connect"), "connect-mcp-registry.json"),
    ECORIONE_MCP_OUTBOUND_INVOCATION_PATH: resolve(
      data("connect"),
      "connect-mcp-invocations.json",
    ),
    ECORIONE_HUB_DB_PATH: resolve(data("hub"), "hub.db"),
    ECORIONE_ARTIFACT_DIR: resolve(data("artifact"), "artifacts"),
    ECORIONE_SANDBOX_WORKSPACE_ROOT: resolve(data("sandbox"), "workspaces"),
    ECORIONE_SANDBOX_RECEIPT_DIR: resolve(data("sandbox"), "receipts"),
    ECORIONE_FLOW_DB_PATH: resolve(data("flow"), "flow.sqlite"),
    ECORIONE_SPACE_DB_PATH: resolve(data("space"), "space.db"),
  };
}

function findFile(paths, label) {
  const found = paths.find((path) => existsSync(path));
  if (!found) throw new Error(`${label} tidak ditemukan dalam runtime bundle.`);
  return found;
}

async function startMode(values) {
  const appRoot = resolve(values["app-root"] ?? ".");
  const dataRoot = resolve(values["data-root"] ?? ".ecorione-native");
  const nodeExe = resolve(values["node-exe"] ?? process.execPath);
  const temporalExe = resolve(values["temporal-exe"] ?? "temporal.exe");
  const envFile = resolve(values["env-file"] ?? resolve(dataRoot, "desktop.env"));
  const existing = readState(dataRoot);
  if (existing && processAlive(existing.supervisorPid)) {
    throw new Error(
      `ECORIONE native runtime sudah berjalan dengan PID ${existing.supervisorPid}.`,
    );
  }
  clearState(dataRoot);
  mkdirSync(resolve(dataRoot, "logs"), { recursive: true });
  for (const name of [
    "rnd",
    "context",
    "connect",
    "hub",
    "artifact",
    "sandbox",
    "flow",
    "space",
  ]) {
    mkdirSync(resolve(dataRoot, "data", name), { recursive: true });
  }

  const config = ensureEnvFile(envFile);
  const aiPort = await selectAiPort(config.ECORIONE_AI_PORT);
  const env = runtimeEnv(config, dataRoot, aiPort);
  const children = [];
  let shuttingDown = false;

  const spawnChild = (name, command, args, cwd = appRoot) => {
    const child = spawn(command, args, {
      cwd,
      env,
      windowsHide: true,
      stdio: "inherit",
    });
    children.push({ name, child });
    child.once("exit", (code, signal) => {
      if (shuttingDown) return;
      console.error(`[ECORIONE] ${name} exited unexpectedly (${String(code ?? signal)}).`);
      void shutdown(1);
    });
    return child;
  };

  const shutdown = async (exitCode = 0) => {
    if (shuttingDown) return;
    shuttingDown = true;
    for (const { child } of [...children].reverse()) {
      if (child.exitCode !== null || child.signalCode !== null) continue;
      try {
        if (process.platform === "win32" && Number.isInteger(child.pid)) {
          spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
            stdio: "ignore",
            windowsHide: true,
          });
        } else {
          child.kill("SIGTERM");
        }
      } catch {
        // Best-effort shutdown; process tree owner exits immediately afterwards.
      }
    }
    clearState(dataRoot);
    process.exitCode = exitCode;
  };

  process.once("SIGINT", () => void shutdown(0));
  process.once("SIGTERM", () => void shutdown(0));

  if (!(await portReachable(7233))) {
    spawnChild("Temporal", temporalExe, [
      "server",
      "start-dev",
      "--ip",
      "127.0.0.1",
      "--port",
      "7233",
      "--db-filename",
      resolve(dataRoot, "data", "temporal.db"),
      "--ui-port",
      "8233",
    ]);
    await waitUntil(() => portReachable(7233), "Temporal", 60_000);
  }

  const serviceEntry = (name, file = "main.js") =>
    resolve(appRoot, "services", name, "dist", file);
  const servicePlan = [
    ["RnD", "rnd", 17021],
    ["Connect", "connect", 17023],
    ["Context", "context", 17022],
    ["Hub", "hub", 17024],
    ["Artifact", "artifact", 17025],
    ["Sandbox", "sandbox", 17026],
    ["Flow", "flow", 17028],
    ["Space", "space", 17027],
  ];
  for (const [label, name, port] of servicePlan) {
    const entry = serviceEntry(name);
    if (!existsSync(entry)) throw new Error(`${label} runtime entry tidak ditemukan: ${entry}`);
    spawnChild(label, nodeExe, [entry]);
    await waitUntil(() => httpReady(`http://127.0.0.1:${port}/healthz`), label);
  }

  const workerEntry = serviceEntry("flow", "worker-main.js");
  if (!existsSync(workerEntry))
    throw new Error(`Flow worker runtime entry tidak ditemukan: ${workerEntry}`);
  spawnChild("Flow worker", nodeExe, [workerEntry]);

  const nextBin = findFile(
    [
      resolve(appRoot, "node_modules", "next", "dist", "bin", "next"),
      resolve(appRoot, "apps", "ai", "node_modules", "next", "dist", "bin", "next"),
    ],
    "Next.js runtime",
  );
  spawnChild(
    "Ai",
    nodeExe,
    [nextBin, "start", "-H", "127.0.0.1", "-p", String(aiPort)],
    resolve(appRoot, "apps", "ai"),
  );
  await waitUntil(
    () => httpReady(`http://127.0.0.1:${aiPort}/`, /ecorione\s*[—-]\s*Ai/i),
    "Ai",
    120_000,
  );

  const state = {
    schemaVersion: 1,
    runtime: "native-windows",
    supervisorPid: process.pid,
    aiPort,
    aiUrl: `http://127.0.0.1:${aiPort}`,
    startedAt: new Date().toISOString(),
    temporalExternal: !children.some(({ name }) => name === "Temporal"),
    childPids: Object.fromEntries(children.map(({ name, child }) => [name, child.pid ?? null])),
  };
  writeState(dataRoot, state);
  console.log(`ECORIONE_NATIVE_READY ${state.aiUrl}`);

  await new Promise(() => {});
}

async function doctorMode(values) {
  const dataRoot = resolve(values["data-root"] ?? ".ecorione-native");
  const state = readState(dataRoot);
  console.log("ECORIONE Native Desktop Doctor");
  console.log("[OK] Docker dependency: none");
  if (!state || !processAlive(state.supervisorPid)) {
    console.log("[INFO] Runtime stopped");
    return;
  }
  let healthy = true;
  if (!(await portReachable(7233))) {
    console.log("[FAIL] Temporal unreachable");
    healthy = false;
  } else {
    console.log("[OK] Temporal reachable");
  }
  for (const [name, port] of OWNER_SERVICES) {
    if (await httpReady(`http://127.0.0.1:${port}/healthz`))
      console.log(`[OK] ${name} reachable`);
    else {
      console.log(`[FAIL] ${name} unreachable`);
      healthy = false;
    }
  }
  if (await httpReady(state.aiUrl, /ecorione\s*[—-]\s*Ai/i))
    console.log(`[OK] Ai reachable: ${state.aiUrl}`);
  else {
    console.log(`[FAIL] Ai unreachable: ${state.aiUrl}`);
    healthy = false;
  }
  if (!healthy) process.exitCode = 1;
}

async function stopMode(values) {
  const dataRoot = resolve(values["data-root"] ?? ".ecorione-native");
  const state = readState(dataRoot);
  if (!state || !processAlive(state.supervisorPid)) {
    clearState(dataRoot);
    console.log("ECORIONE native runtime already stopped.");
    return;
  }
  if (process.platform === "win32") {
    const result = spawnSync("taskkill", ["/PID", String(state.supervisorPid), "/T", "/F"], {
      encoding: "utf8",
      windowsHide: true,
    });
    if (result.error) throw result.error;
    if (result.status !== 0 && processAlive(state.supervisorPid)) {
      throw new Error(
        `Gagal menghentikan ECORIONE process tree (taskkill ${String(result.status)}).`,
      );
    }
  } else {
    process.kill(state.supervisorPid, "SIGTERM");
  }
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline && processAlive(state.supervisorPid)) {
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  clearState(dataRoot);
  console.log("ECORIONE native runtime stopped.");
}

const { mode, values } = parseArgs(process.argv.slice(2));
try {
  if (mode === "start") await startMode(values);
  else if (mode === "doctor") await doctorMode(values);
  else if (mode === "stop") await stopMode(values);
  else throw new Error(`Mode tidak dikenal: ${mode}`);
} catch (error) {
  console.error(
    `ECORIONE native supervisor error: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
}
