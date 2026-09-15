#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isPortReachable, parseSimpleEnv } from "./ecorione-engine.mjs";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const ENV_PATH = resolve(ROOT, ".env");
const TRACE_ROOT = resolve(ROOT, "traces");
const REQUIRED_SERVICES = [
  ["RnD", 17021, "http://127.0.0.1:17021/healthz"],
  ["Context", 17022, "http://127.0.0.1:17022/healthz"],
  ["Connect", 17023, "http://127.0.0.1:17023/healthz"],
  ["Hub", 17024, "http://127.0.0.1:17024/healthz"],
  ["Artifact", 17025, "http://127.0.0.1:17025/healthz"],
  ["Sandbox", 17026, "http://127.0.0.1:17026/healthz"],
  ["Space", 17027, "http://127.0.0.1:17027/healthz"],
  ["Flow", 17028, "http://127.0.0.1:17028/healthz"],
];
const APP_PORTS = [3000, ...REQUIRED_SERVICES.map(([, port]) => port)];
const READY_MARKER = "✓ ECORIONE ready: http://127.0.0.1:3000";

export function acceptancePlan() {
  return [
    {
      id: "W09-A",
      name: "current-main preflight",
      pass: "Windows, clean tracked worktree, HEAD == origin/main, Node >=22, pnpm available",
    },
    {
      id: "W10-A",
      name: "doctor before startup",
      pass: "doctor completes and reports prerequisites plus stopped/degraded runtime state without secrets",
    },
    {
      id: "W09-B",
      name: "cold one-command startup",
      pass: "pnpm engine:start reaches Ai + all eight required Phase 4 owners",
    },
    {
      id: "W10-B",
      name: "doctor while running",
      pass: "Temporal, Ai, and all eight required owners report healthy",
    },
    {
      id: "W09-C",
      name: "duplicate-start guard",
      pass: "second pnpm engine:start fails closed on occupied port 3000 before mutating runtime",
    },
    {
      id: "W09-D",
      name: "Windows process-tree cleanup",
      pass: "acceptance-owned engine process tree stops and ECORIONE application ports are released",
    },
    {
      id: "W10-C",
      name: "doctor after shutdown",
      pass: "doctor remains usable and reports stopped runtime state",
    },
  ];
}

function commandName(name) {
  return process.platform === "win32" && name === "pnpm" ? "pnpm.cmd" : name;
}

function runSync(command, args, options = {}) {
  const result = spawnSync(commandName(command), args, {
    cwd: ROOT,
    env: options.env ?? process.env,
    encoding: "utf8",
    windowsHide: true,
    shell: process.platform === "win32" && command === "pnpm",
    timeout: options.timeoutMs ?? 60_000,
  });
  return {
    code: result.status,
    signal: result.signal,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    error: result.error?.message,
  };
}

function requireCommand(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error}`);
  if (result.code !== 0) {
    const detail = `${result.stdout}\n${result.stderr}`.trim();
    throw new Error(`${label} gagal (exit ${String(result.code)}): ${detail}`);
  }
  return result.stdout.trim();
}

function readLocalToken() {
  if (process.env.ECORIONE_INTERNAL_TOKEN) return process.env.ECORIONE_INTERNAL_TOKEN;
  if (!existsSync(ENV_PATH)) return "";
  return parseSimpleEnv(readFileSync(ENV_PATH, "utf8")).ECORIONE_INTERNAL_TOKEN ?? "";
}

function readLocalEnv() {
  if (!existsSync(ENV_PATH)) return {};
  return parseSimpleEnv(readFileSync(ENV_PATH, "utf8"));
}

async function fetchHealth(url, token) {
  try {
    const response = await fetch(url, {
      headers: token ? { authorization: `Bearer ${token}` } : undefined,
      signal: AbortSignal.timeout(1_500),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function portState(ports) {
  const entries = await Promise.all(
    ports.map(async (port) => [String(port), await isPortReachable(port)]),
  );
  return Object.fromEntries(entries);
}

function localRuntimeDisposition(output) {
  if (output.includes("✓ Local AI runtime")) return "PASS";
  if (output.includes("! Local AI runtime test gagal")) return "DEGRADED";
  if (output.includes("· Local AI runtime belum dapat diuji")) return "UNAVAILABLE";
  return "UNKNOWN";
}

export function evaluateRunningDoctor(output) {
  const requiredMarkers = [
    "✓ Temporal 127.0.0.1:7233",
    ...REQUIRED_SERVICES.map(([name]) => `✓ ${name}`),
    "✓ Ai http://127.0.0.1:3000",
  ];
  const missing = requiredMarkers.filter((marker) => !output.includes(marker));
  return {
    pass: missing.length === 0,
    missing,
    localRuntime: localRuntimeDisposition(output),
  };
}

function tail(text, maxLines = 80) {
  const lines = text.split(/\r?\n/);
  return lines.slice(Math.max(0, lines.length - maxLines)).join("\n");
}

function safeDoctorOutput(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => !/ECORIONE_INTERNAL_TOKEN|VAULT_MASTER_KEY/i.test(line))
    .join("\n")
    .trim();
}

function writeReport(report) {
  mkdirSync(TRACE_ROOT, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = resolve(TRACE_ROOT, `w09-w10-windows-acceptance-${stamp}.json`);
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return path;
}

async function waitForRuntime(childState, stdoutRef, timeoutMs = 150_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (childState.exited) {
      throw new Error(
        `engine:start berhenti sebelum ready (exit ${String(childState.code)}, signal ${String(childState.signal)}).`,
      );
    }

    const token = readLocalToken();
    const aiReady = await isPortReachable(3000);
    const health = await Promise.all(
      REQUIRED_SERVICES.map(async ([name, , url]) => ({
        name,
        ready: await fetchHealth(url, token),
      })),
    );
    const servicesReady = health.every((entry) => entry.ready);
    const markerReady = stdoutRef.value.includes(READY_MARKER);
    if (aiReady && servicesReady && markerReady) return health;

    await new Promise((resolvePromise) => setTimeout(resolvePromise, 750));
  }
  throw new Error("engine:start belum mencapai full readiness setelah 150 detik.");
}

async function waitForPortsClosed(ports, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const state = await portState(ports);
    if (Object.values(state).every((reachable) => reachable === false)) return state;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }
  return portState(ports);
}

function killWindowsTree(pid) {
  const result = spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], {
    cwd: ROOT,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && result.status !== 128) {
    throw new Error(`taskkill gagal (exit ${String(result.status)}): ${result.stderr ?? ""}`);
  }
}

function doctorCommand(env) {
  return runSync("pnpm", ["engine:doctor"], { env, timeoutMs: 90_000 });
}

async function runAcceptance() {
  if (process.platform !== "win32") {
    throw new Error(
      "Acceptance W09/W10 ini harus dijalankan pada Windows asli; gunakan --plan untuk inspeksi lintas platform.",
    );
  }

  const report = {
    schemaVersion: 1,
    startedAt: new Date().toISOString(),
    platform: process.platform,
    arch: process.arch,
    node: process.version,
    plan: acceptancePlan(),
    result: "RUNNING",
    phases: {},
  };
  let engineChild;
  let preexistingTemporal = false;

  try {
    console.log("=== W09/W10 Windows engine acceptance ===");
    console.log("Tidak ada secret yang akan dicetak.\n");

    requireCommand(
      runSync("git", ["fetch", "origin", "--prune"], { timeoutMs: 60_000 }),
      "git fetch",
    );
    const head = requireCommand(runSync("git", ["rev-parse", "HEAD"]), "git rev-parse HEAD");
    const originMain = requireCommand(
      runSync("git", ["rev-parse", "origin/main"]),
      "git rev-parse origin/main",
    );
    const trackedStatus = requireCommand(
      runSync("git", ["status", "--short", "--untracked-files=no"]),
      "git status",
    );
    if (head !== originMain) {
      throw new Error(`HEAD ${head} tidak sama dengan origin/main ${originMain}.`);
    }
    if (trackedStatus !== "") {
      throw new Error("Tracked worktree harus bersih sebelum acceptance.");
    }

    const nodeMajor = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);
    if (nodeMajor < 22) {
      throw new Error(`Node ${process.version} tidak memenuhi >=22.`);
    }
    const pnpmVersion = requireCommand(runSync("pnpm", ["--version"]), "pnpm --version");
    const temporalVersion = runSync("temporal", ["--version"]);
    const dockerVersion = runSync("docker", ["version", "--format", "{{.Server.Version}}"]);
    const localEnv = readLocalEnv();
    preexistingTemporal = await isPortReachable(7233);
    const useDocker =
      (process.env.ECORIONE_TEMPORAL_USE_DOCKER ?? localEnv.ECORIONE_TEMPORAL_USE_DOCKER) ===
      "1";
    const temporalCliReady = temporalVersion.code === 0;
    const dockerReady = dockerVersion.code === 0;
    const hasLaunchPath = preexistingTemporal || (useDocker ? dockerReady : temporalCliReady);
    if (!hasLaunchPath) {
      throw new Error(
        useDocker
          ? "Temporal belum reachable dan mode Docker dipilih, tetapi Docker tidak reachable."
          : "Temporal belum reachable dan Temporal CLI tidak tersedia. Install Temporal CLI atau pilih mode Docker secara eksplisit.",
      );
    }

    const beforePorts = await portState(APP_PORTS);
    const occupied = Object.entries(beforePorts)
      .filter(([, reachable]) => reachable)
      .map(([port]) => port);
    if (occupied.length > 0) {
      throw new Error(
        `ECORIONE harus berhenti sebelum acceptance. Port aplikasi masih terpakai: ${occupied.join(", ")}.`,
      );
    }

    report.phases.preflight = {
      pass: true,
      head,
      originMain,
      trackedClean: true,
      node: process.version,
      pnpm: pnpmVersion,
      envExistedBefore: existsSync(ENV_PATH),
      temporalPreexisting: preexistingTemporal,
      temporalCliAvailable: temporalCliReady,
      dockerReachable: dockerReady,
      temporalMode: preexistingTemporal
        ? "external/reused"
        : useDocker
          ? "docker"
          : "cli-dev-server",
    };
    console.log(`✓ W09-A preflight: ${head}`);

    const acceptanceEnv = {
      ...process.env,
      ECORIONE_COST_KILL_SWITCH: "1",
      ECORIONE_ENGINE_NO_OPEN: "1",
    };

    const preDoctor = doctorCommand(acceptanceEnv);
    if (preDoctor.error || preDoctor.code !== 0) {
      throw new Error(
        `Pre-start doctor gagal: ${preDoctor.error ?? `${preDoctor.stdout}\n${preDoctor.stderr}`}`,
      );
    }
    report.phases.preDoctor = {
      pass: true,
      output: safeDoctorOutput(preDoctor.stdout),
      localRuntime: localRuntimeDisposition(preDoctor.stdout),
    };
    console.log("✓ W10-A doctor pre-start selesai");

    const stdoutRef = { value: "" };
    const stderrRef = { value: "" };
    const childState = { exited: false, code: null, signal: null };
    engineChild = spawn(commandName("pnpm"), ["engine:start"], {
      cwd: ROOT,
      env: acceptanceEnv,
      windowsHide: true,
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    engineChild.stdout?.setEncoding("utf8");
    engineChild.stderr?.setEncoding("utf8");
    engineChild.stdout?.on("data", (chunk) => {
      stdoutRef.value += chunk;
      process.stdout.write(chunk);
    });
    engineChild.stderr?.on("data", (chunk) => {
      stderrRef.value += chunk;
      process.stderr.write(chunk);
    });
    engineChild.once("exit", (code, signal) => {
      childState.exited = true;
      childState.code = code;
      childState.signal = signal;
    });

    await waitForRuntime(childState, stdoutRef);
    report.phases.start = {
      pass: true,
      readyMarker: true,
      ports: await portState(APP_PORTS),
      logTail: tail(`${stdoutRef.value}\n${stderrRef.value}`),
    };
    console.log("\n✓ W09-B one-command cold start READY");

    const runningDoctor = doctorCommand(acceptanceEnv);
    if (runningDoctor.error || runningDoctor.code !== 0) {
      throw new Error(
        `Runtime doctor gagal: ${runningDoctor.error ?? `${runningDoctor.stdout}\n${runningDoctor.stderr}`}`,
      );
    }
    const doctorEvaluation = evaluateRunningDoctor(runningDoctor.stdout);
    if (!doctorEvaluation.pass) {
      throw new Error(
        `Runtime doctor kehilangan marker: ${doctorEvaluation.missing.join(", ")}.`,
      );
    }
    report.phases.runningDoctor = {
      pass: true,
      output: safeDoctorOutput(runningDoctor.stdout),
      localRuntime: doctorEvaluation.localRuntime,
    };
    console.log(`✓ W10-B doctor runtime healthy · Local AI ${doctorEvaluation.localRuntime}`);

    const duplicate = runSync("pnpm", ["engine:start"], {
      env: acceptanceEnv,
      timeoutMs: 30_000,
    });
    const duplicateText = `${duplicate.stdout}\n${duplicate.stderr}`;
    if (duplicate.code === 0 || !duplicateText.includes("Port 3000 sudah dipakai")) {
      throw new Error(
        `Duplicate-start guard tidak fail-closed seperti yang diharapkan. exit=${String(duplicate.code)} output=${tail(duplicateText, 30)}`,
      );
    }
    report.phases.duplicateStart = {
      pass: true,
      exitCode: duplicate.code,
      expectedMessageObserved: true,
    };
    console.log("✓ W09-C duplicate-start guard fail-closed");

    if (!Number.isInteger(engineChild.pid)) {
      throw new Error("PID engine acceptance tidak tersedia.");
    }
    killWindowsTree(engineChild.pid);
    const closedPorts = await waitForPortsClosed(APP_PORTS);
    const stillOpen = Object.entries(closedPorts)
      .filter(([, reachable]) => reachable)
      .map(([port]) => port);
    if (stillOpen.length > 0) {
      throw new Error(`Cleanup menyisakan port aplikasi: ${stillOpen.join(", ")}.`);
    }
    if (!preexistingTemporal) {
      const temporalClosed = await waitForPortsClosed([7233]);
      if (temporalClosed["7233"] !== false) {
        throw new Error(
          "Temporal dev-server yang dimiliki acceptance masih reachable setelah cleanup.",
        );
      }
    }
    engineChild = undefined;
    report.phases.cleanup = {
      pass: true,
      appPortsReleased: true,
      temporalDisposition: preexistingTemporal
        ? "preexisting-left-running"
        : "acceptance-owned-stopped",
    };
    console.log("✓ W09-D Windows process tree cleanup PASS");

    const postDoctor = doctorCommand(acceptanceEnv);
    if (postDoctor.error || postDoctor.code !== 0) {
      throw new Error(
        `Post-stop doctor gagal: ${postDoctor.error ?? `${postDoctor.stdout}\n${postDoctor.stderr}`}`,
      );
    }
    report.phases.postDoctor = {
      pass: true,
      output: safeDoctorOutput(postDoctor.stdout),
      localRuntime: localRuntimeDisposition(postDoctor.stdout),
    };
    console.log("✓ W10-C doctor post-stop selesai");

    report.result = "PASS";
    report.finishedAt = new Date().toISOString();
    const reportPath = writeReport(report);
    console.log("\nPASS W09/W10 Windows engine acceptance");
    console.log(`Sanitized report: ${reportPath}`);
  } catch (error) {
    report.result = "FAIL";
    report.error = error instanceof Error ? error.message : String(error);
    report.finishedAt = new Date().toISOString();
    if (engineChild && Number.isInteger(engineChild.pid)) {
      try {
        killWindowsTree(engineChild.pid);
      } catch (cleanupError) {
        report.cleanupError =
          cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
      }
    }
    const reportPath = writeReport(report);
    console.error(`\nFAIL W09/W10: ${report.error}`);
    console.error(`Sanitized report: ${reportPath}`);
    process.exitCode = 1;
  }
}

async function main() {
  if (process.argv.includes("--plan")) {
    console.log(JSON.stringify({ platformRequired: "win32", plan: acceptancePlan() }, null, 2));
    return;
  }
  await runAcceptance();
}

const invokedPath = process.argv[1] === undefined ? "" : resolve(process.argv[1]);
if (invokedPath === fileURLToPath(import.meta.url)) await main();
