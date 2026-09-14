#!/usr/bin/env node

import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { connect } from "node:net";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const LOCAL_TEMPORAL_COMPOSE = resolve(ROOT, "deploy/local-temporal.yml");
const REQUIRED_SERVICES = [
  ["RnD", "http://127.0.0.1:17021/healthz"],
  ["Context", "http://127.0.0.1:17022/healthz"],
  ["Connect", "http://127.0.0.1:17023/healthz"],
  ["Hub", "http://127.0.0.1:17024/healthz"],
  ["Artifact", "http://127.0.0.1:17025/healthz"],
  ["Sandbox", "http://127.0.0.1:17026/healthz"],
  ["Space", "http://127.0.0.1:17027/healthz"],
  ["Flow", "http://127.0.0.1:17028/healthz"],
];

export function parseSimpleEnv(text) {
  const result = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index <= 0) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

export function upsertEnvValue(text, key, value) {
  const lines = text.split(/\r?\n/);
  const prefix = `${key}=`;
  const index = lines.findIndex((line) => line.trimStart().startsWith(prefix));
  if (index >= 0) lines[index] = `${key}=${value}`;
  else lines.push(`${key}=${value}`);
  return lines.join("\n");
}

export function ensureLocalEnv(root = ROOT) {
  const envPath = resolve(root, ".env");
  const examplePath = resolve(root, ".env.example");
  let created = false;

  if (!existsSync(envPath)) {
    if (!existsSync(examplePath)) throw new Error(".env.example tidak ditemukan.");
    copyFileSync(examplePath, envPath);
    created = true;
  }

  let text = readFileSync(envPath, "utf8");
  let values = parseSimpleEnv(text);
  const generated = [];

  if (!values.ECORIONE_INTERNAL_TOKEN) {
    const value = randomBytes(32).toString("base64url");
    text = upsertEnvValue(text, "ECORIONE_INTERNAL_TOKEN", value);
    generated.push("ECORIONE_INTERNAL_TOKEN");
  }
  values = parseSimpleEnv(text);

  if (!values.ECORIONE_CONNECT_VAULT_MASTER_KEY) {
    const value = randomBytes(32).toString("base64url");
    text = upsertEnvValue(text, "ECORIONE_CONNECT_VAULT_MASTER_KEY", value);
    generated.push("ECORIONE_CONNECT_VAULT_MASTER_KEY");
  }

  if (created || generated.length > 0)
    writeFileSync(envPath, text, { encoding: "utf8", mode: 0o600 });
  return { envPath, created, generated, values: parseSimpleEnv(text) };
}

export function isPortReachable(port, host = "127.0.0.1", timeoutMs = 750) {
  return new Promise((resolvePromise) => {
    const socket = connect({ port, host });
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

async function waitForPort(port, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isPortReachable(port)) return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }
  throw new Error(
    `${label} belum ready setelah ${String(Math.round(timeoutMs / 1000))} detik.`,
  );
}

function commandName(name) {
  return process.platform === "win32" && name === "pnpm" ? "pnpm.cmd" : name;
}

export function waitForSpawnedChild(child) {
  return new Promise((resolvePromise) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolvePromise(result);
    };
    child.once("error", (error) => finish({ error }));
    child.once("exit", (code, signal) => finish({ code, signal }));
  });
}

export async function stopSpawnedChild(child, timeoutMs = 5_000) {
  if (child.exitCode !== null || child.signalCode !== null) return;

  const exited = new Promise((resolvePromise) => {
    child.once("exit", () => resolvePromise(true));
  });
  try {
    child.kill("SIGTERM");
  } catch {
    return;
  }

  if (timeoutMs > 0) {
    await Promise.race([
      exited,
      new Promise((resolvePromise) => setTimeout(resolvePromise, timeoutMs)),
    ]);
  }
  if (child.exitCode !== null || child.signalCode !== null) return;

  try {
    child.kill("SIGKILL");
  } catch {
    return;
  }
  if (timeoutMs > 0) {
    await Promise.race([
      exited,
      new Promise((resolvePromise) => setTimeout(resolvePromise, Math.min(timeoutMs, 1_000))),
    ]);
  }
}

function runChecked(command, args, options = {}) {
  const result = spawnSync(commandName(command), args, {
    cwd: ROOT,
    env: options.env ?? process.env,
    encoding: "utf8",
    stdio: options.stdio ?? "pipe",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`${command} ${args.join(" ")} gagal${detail ? `:\n${detail}` : "."}`);
  }
  return result.stdout.trim();
}

function dockerAvailable() {
  try {
    runChecked("docker", ["version", "--format", "{{.Server.Version}}"]);
    return true;
  } catch {
    return false;
  }
}

async function ensureTemporal(env) {
  if (await isPortReachable(7233)) {
    console.log("✓ Temporal sudah reachable di 127.0.0.1:7233");
    return;
  }
  if (!dockerAvailable()) {
    throw new Error(
      "Temporal belum aktif dan Docker tidak tersedia. Jalankan Docker Desktop lalu ulangi `pnpm engine:start`.",
    );
  }
  console.log("• Menyalakan Temporal lokal…");
  runChecked("docker", ["compose", "-f", LOCAL_TEMPORAL_COMPOSE, "up", "-d"], { env });
  await waitForPort(7233, 60_000, "Temporal");
  console.log("✓ Temporal ready");
}

async function fetchHealth(url, token) {
  try {
    const headers = token ? { authorization: `Bearer ${token}` } : undefined;
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(1_500) });
    return response.ok;
  } catch {
    return false;
  }
}

export async function probeLocalRuntime(connectBaseUrl, token, timeoutMs = 20_000) {
  const baseUrl = connectBaseUrl.replace(/\/+$/, "");
  const headers = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;

  try {
    const response = await fetch(`${baseUrl}/v1/ops/provider-canary`, {
      method: "POST",
      headers,
      body: JSON.stringify({ target: "local" }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await response.text();
    let payload = {};
    try {
      payload = text.length === 0 ? {} : JSON.parse(text);
    } catch {
      return {
        reachable: true,
        pass: false,
        errorCode: `HTTP_${String(response.status)}_INVALID_JSON`,
      };
    }

    if (!response.ok) {
      return {
        reachable: true,
        pass: false,
        errorCode: payload?.error?.type ?? `HTTP_${String(response.status)}`,
      };
    }

    return {
      reachable: true,
      pass: payload?.pass === true,
      model: typeof payload?.model === "string" ? payload.model : undefined,
      responseModel:
        typeof payload?.responseModel === "string" ? payload.responseModel : undefined,
      latencyMs: typeof payload?.latencyMs === "number" ? payload.latencyMs : undefined,
    };
  } catch (error) {
    return {
      reachable: false,
      pass: false,
      errorCode: error instanceof Error ? error.name : "UNREACHABLE",
    };
  }
}

async function waitForRequiredServices(token, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let pending = REQUIRED_SERVICES.map(([name]) => name);

  while (Date.now() < deadline) {
    const checks = await Promise.all(
      REQUIRED_SERVICES.map(async ([name, url]) => ({
        name,
        ready: await fetchHealth(url, token),
      })),
    );
    pending = checks.filter((check) => !check.ready).map((check) => check.name);
    if (pending.length === 0) return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 750));
  }

  throw new Error(
    `Service Phase 4 belum ready setelah ${String(Math.round(timeoutMs / 1000))} detik: ${pending.join(", ")}.`,
  );
}

async function doctor() {
  const envPath = resolve(ROOT, ".env");
  const fileEnv = existsSync(envPath) ? parseSimpleEnv(readFileSync(envPath, "utf8")) : {};
  const env = { ...fileEnv, ...process.env };
  let criticalFailure = false;

  console.log("ECORIONE doctor\n");
  const nodeMajor = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);
  console.log(
    `${nodeMajor >= 22 ? "✓" : "✗"} Node ${process.versions.node}${nodeMajor >= 22 ? "" : " (butuh >=22)"}`,
  );
  if (nodeMajor < 22) criticalFailure = true;

  try {
    const pnpm = runChecked("pnpm", ["--version"]);
    console.log(`✓ pnpm ${pnpm}`);
  } catch {
    console.log("✗ pnpm tidak tersedia");
    criticalFailure = true;
  }

  const hasEnv = existsSync(envPath);
  const hasDocker = dockerAvailable();
  console.log(
    `${hasEnv ? "✓" : "!"} .env ${hasEnv ? "tersedia" : "belum dibuat (engine:start akan membuatnya)"}`,
  );
  console.log(`${hasDocker ? "✓" : "!"} Docker ${hasDocker ? "reachable" : "tidak reachable"}`);
  console.log(`${(await isPortReachable(7233)) ? "✓" : "!"} Temporal 127.0.0.1:7233`);

  const token = env.ECORIONE_INTERNAL_TOKEN ?? "";
  for (const [name, url] of REQUIRED_SERVICES) {
    console.log(`${(await fetchHealth(url, token)) ? "✓" : "·"} ${name}`);
  }
  console.log(`${(await isPortReachable(3000)) ? "✓" : "·"} Ai http://127.0.0.1:3000`);

  const connectBaseUrl = env.ECORIONE_CONNECT_URL ?? "http://127.0.0.1:17023";
  const localProbe = await probeLocalRuntime(connectBaseUrl, token);
  if (localProbe.pass) {
    const model = localProbe.responseModel ?? localProbe.model ?? "configured model";
    const latency =
      localProbe.latencyMs === undefined ? "" : ` · ${localProbe.latencyMs.toFixed(1)}ms`;
    console.log(`✓ Local AI runtime ${model}${latency}`);
  } else if (localProbe.reachable) {
    console.log(`! Local AI runtime test gagal (${localProbe.errorCode ?? "quality failure"})`);
  } else {
    console.log(
      `· Local AI runtime belum dapat diuji (${localProbe.errorCode ?? "unreachable"})`,
    );
  }

  if (criticalFailure) process.exitCode = 1;
}

function openBrowser(url) {
  if (process.env.ECORIONE_ENGINE_NO_OPEN === "1") return;
  try {
    if (process.platform === "win32") {
      spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref();
    } else if (process.platform === "darwin") {
      spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
    } else {
      spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
    }
  } catch {
    // Browser opening is best-effort; engine readiness is independent.
  }
}

async function start() {
  if (await isPortReachable(3000)) {
    throw new Error(
      "Port 3000 sudah dipakai. Jika ECORIONE sudah berjalan, buka http://127.0.0.1:3000; jika bukan, hentikan proses yang memakai port tersebut.",
    );
  }

  const local = ensureLocalEnv();
  if (local.created) console.log("✓ .env dibuat dari .env.example");
  for (const key of local.generated)
    console.log(`✓ ${key} dibuat otomatis untuk local-only runtime`);
  const env = { ...local.values, ...process.env };

  await ensureTemporal(env);
  console.log("• Menyalakan full Phase 4 stack…");

  const child = spawn(commandName("pnpm"), ["run", "dev:phase4"], {
    cwd: ROOT,
    env,
    stdio: "inherit",
  });
  const lifecycle = waitForSpawnedChild(child);
  const token = env.ECORIONE_INTERNAL_TOKEN ?? "";
  const readiness = Promise.all([
    waitForPort(3000, 90_000, "Ai"),
    waitForRequiredServices(token, 90_000),
  ]).then(() => ({ ready: true }));

  let first;
  try {
    first = await Promise.race([readiness, lifecycle]);
  } catch (error) {
    await stopSpawnedChild(child);
    throw error;
  }

  if ("ready" in first) {
    console.log("\n✓ ECORIONE ready: http://127.0.0.1:3000");
    console.log("  Tekan Ctrl+C untuk menghentikan proses development stack.\n");
    openBrowser("http://127.0.0.1:3000");
    const finished = await lifecycle;
    if ("error" in finished) {
      throw new Error(
        `Phase 4 stack mengalami process error: ${finished.error instanceof Error ? finished.error.message : String(finished.error)}.`,
      );
    }
    if (finished.code !== 0 && finished.code !== null) process.exitCode = finished.code;
    return;
  }

  if ("error" in first) {
    throw new Error(
      `Tidak bisa menjalankan Phase 4 stack: ${first.error instanceof Error ? first.error.message : String(first.error)}.`,
    );
  }
  throw new Error(
    `Phase 4 stack berhenti sebelum seluruh service ready${first.code === null ? ` (${first.signal ?? "signal"})` : ` (exit ${String(first.code)})`}.`,
  );
}

function stopTemporal() {
  if (!dockerAvailable()) throw new Error("Docker tidak reachable.");
  runChecked("docker", ["compose", "-f", LOCAL_TEMPORAL_COMPOSE, "down"]);
  console.log("✓ ECORIONE local Temporal stopped.");
}

async function main() {
  const command = process.argv[2] ?? "doctor";
  if (command === "start") return start();
  if (command === "doctor") return doctor();
  if (command === "stop-temporal") return stopTemporal();
  throw new Error(
    `Command tidak dikenal: ${command}. Gunakan start, doctor, atau stop-temporal.`,
  );
}

const invokedPath = process.argv[1] === undefined ? "" : resolve(process.argv[1]);
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    await main();
  } catch (error) {
    console.error(
      `\nECORIONE engine error: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}
