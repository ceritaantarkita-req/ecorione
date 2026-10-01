import { spawn, spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { connect } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const TEMPORAL_DEV_DB_PATH = resolve(ROOT, "data", "temporal-dev.db");
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

const services = [
  ["rnd", "pnpm --filter @ecorione/rnd run dev"],
  ["context", "pnpm --filter @ecorione/context run dev"],
  ["connect", "pnpm --filter @ecorione/connect run dev"],
  ["hub", "pnpm --filter @ecorione/hub run dev"],
  ["artifact", "pnpm --filter @ecorione/artifact run dev"],
  ["space", "pnpm --filter @ecorione/space run dev"],
  ["flow", "pnpm --filter @ecorione/flow run dev"],
  ["flow-worker", "pnpm --filter @ecorione/flow run dev:worker"],
  ["ai", "pnpm --filter @ecorione/ai run dev"],
];

function run(args) {
  if (process.platform === "win32") {
    const quote = (value) => JSON.stringify(value);
    return spawn(`${pnpm} ${args.map(quote).join(" ")}`, {
      cwd: ROOT,
      stdio: "inherit",
      env: process.env,
      shell: true,
    });
  }
  return spawn(pnpm, args, { cwd: ROOT, stdio: "inherit", env: process.env });
}

function portReachable(port) {
  return new Promise((resolvePromise) => {
    const socket = connect({ host: "127.0.0.1", port });
    const done = (value) => {
      socket.destroy();
      resolvePromise(value);
    };
    socket.setTimeout(500);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

async function waitForPort(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await portReachable(port)) return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error(`Port ${String(port)} tidak ready dalam ${String(timeoutMs)}ms.`);
}

function temporalCliAvailable() {
  const result = spawnSync("temporal", ["--version"], {
    cwd: ROOT,
    env: process.env,
    stdio: "ignore",
    windowsHide: true,
  });
  return result.status === 0;
}

async function ensureTemporal() {
  if (await portReachable(7233)) {
    console.log("✓ Temporal sudah reachable di 127.0.0.1:7233");
    return null;
  }
  if (!temporalCliAvailable()) {
    throw new Error(
      "Temporal belum aktif dan Temporal CLI tidak ditemukan. Jalankan `pnpm engine:start` untuk petunjuk instalasi.",
    );
  }

  mkdirSync(dirname(TEMPORAL_DEV_DB_PATH), { recursive: true });
  console.log("• Menyalakan Temporal dev-server untuk Flow…");
  const child = spawn(
    "temporal",
    [
      "server",
      "start-dev",
      "--port",
      "7233",
      "--db-filename",
      TEMPORAL_DEV_DB_PATH,
      "--headless",
    ],
    { cwd: ROOT, env: process.env, stdio: "ignore", windowsHide: true },
  );
  try {
    await waitForPort(7233, 30_000);
  } catch (error) {
    child.kill("SIGTERM");
    throw error;
  }
  console.log("✓ Temporal ready di 127.0.0.1:7233");
  return child;
}

const build = run(["run", "build:runtime-deps"]);
const buildExit = await new Promise((resolvePromise, reject) => {
  build.once("error", reject);
  build.once("exit", (code) => resolvePromise(code ?? 1));
});
if (buildExit !== 0) process.exit(buildExit);

const temporal = await ensureTemporal();
const dev = run([
  "exec",
  "concurrently",
  "-n",
  services.map(([name]) => name).join(","),
  "-c",
  "yellow,cyan,magenta,green,white,blue,red,red,blue",
  ...services.map(([, command]) => command),
]);

function stop(signal) {
  dev.kill(signal);
  if (temporal !== null) temporal.kill(signal);
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => stop(signal));
}

const devExit = await new Promise((resolvePromise, reject) => {
  dev.once("error", reject);
  dev.once("exit", (code) => resolvePromise(code ?? 1));
});
if (temporal !== null) temporal.kill("SIGTERM");
process.exitCode = devExit;
