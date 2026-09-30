import { spawn } from "node:child_process";

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const commands = [
  "pnpm --filter @ecorione/rnd run dev",
  "pnpm --filter @ecorione/context run dev",
  "pnpm --filter @ecorione/connect run dev",
  "pnpm --filter @ecorione/hub run dev",
  "pnpm --filter @ecorione/ai run dev",
];

function run(args) {
  if (process.platform === "win32") {
    const quote = (value) => `"${value.replaceAll('"', '\\"')}"`;
    return spawn(`${pnpm} ${args.map(quote).join(" ")}`, {
      stdio: "inherit",
      env: process.env,
      shell: true,
    });
  }
  return spawn(pnpm, args, { stdio: "inherit", env: process.env });
}

const build = run(["run", "build:runtime-deps"]);
const buildExit = await new Promise((resolve, reject) => {
  build.once("error", reject);
  build.once("exit", (code) => resolve(code ?? 1));
});
if (buildExit !== 0) process.exit(buildExit);

const dev = run([
  "exec",
  "concurrently",
  "-n",
  "rnd,context,connect,hub,ai",
  "-c",
  "yellow,cyan,magenta,green,blue",
  ...commands,
]);
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => dev.kill(signal));
}
const devExit = await new Promise((resolve, reject) => {
  dev.once("error", reject);
  dev.once("exit", (code) => resolve(code ?? 1));
});
process.exitCode = devExit;