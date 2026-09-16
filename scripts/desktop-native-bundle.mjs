#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_OUT_ROOT = resolve(ROOT, ".ecorione/native-release");
const DESKTOP_SOURCE = resolve(ROOT, "desktop");
const RUNTIME_SKIP_TOP = new Set([
  ".git",
  ".github",
  ".ecorione",
  "coverage",
  "data",
  "docs",
  "node_modules",
  "test",
  "traces",
]);
const RUNTIME_SKIP_ANY = new Set(["node_modules", "coverage", ".vitest"]);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? ROOT,
    env: options.env ?? process.env,
    encoding: "utf8",
    stdio: options.stdio ?? "pipe",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr]
      .filter((value) => typeof value === "string" && value.trim())
      .join("\n")
      .trim();
    throw new Error(`${command} ${args.join(" ")} gagal${detail ? `:\n${detail}` : "."}`);
  }
  return typeof result.stdout === "string" ? result.stdout.trim() : "";
}

export function normalizeVersion(value) {
  const version = String(value ?? "").trim();
  if (!/^[0-9A-Za-z][0-9A-Za-z._-]{0,63}$/.test(version)) {
    throw new Error("Native desktop version tidak valid.");
  }
  return version;
}

function packageVersion() {
  return normalizeVersion(JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8")).version);
}

function sourceRevision() {
  try {
    return run("git", ["rev-parse", "HEAD"]);
  } catch {
    return process.env.GITHUB_SHA ?? "unknown";
  }
}

export function nativeBundleLayout({ version, outRoot = DEFAULT_OUT_ROOT }) {
  const normalized = normalizeVersion(version);
  const bundleName = `ECORIONE-${normalized}-windows-x64`;
  const bundleRoot = resolve(outRoot, bundleName);
  return {
    version: normalized,
    bundleName,
    bundleRoot,
    runtimeRoot: resolve(bundleRoot, "runtime"),
    appRoot: resolve(bundleRoot, "runtime", "app"),
    nodeExe: resolve(bundleRoot, "runtime", "node", "node.exe"),
    temporalExe: resolve(bundleRoot, "runtime", "temporal", "temporal.exe"),
  };
}

function sha256File(path) {
  const hash = createHash("sha256");
  hash.update(readFileSync(path));
  return hash.digest("hex");
}

function listFiles(root) {
  const result = [];
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else if (entry.isFile()) result.push(absolute);
    }
  };
  walk(root);
  return result.sort((a, b) => relative(root, a).localeCompare(relative(root, b)));
}

function checksumManifest(root) {
  return listFiles(root)
    .map((absolute) => relative(root, absolute).replaceAll("\\", "/"))
    .filter((path) => path !== "SHA256SUMS")
    .map((path) => `${sha256File(resolve(root, path))}  ${path}`)
    .join("\n");
}

function stageDesktopSurface(bundleRoot) {
  for (const name of [
    "Start-ECORIONE.cmd",
    "Doctor-ECORIONE.cmd",
    "Stop-ECORIONE.cmd",
    "ecorione.ps1",
  ]) {
    const source = resolve(DESKTOP_SOURCE, name);
    if (!existsSync(source)) throw new Error(`Desktop launcher tidak ditemukan: ${source}`);
    copyFileSync(source, resolve(bundleRoot, name));
  }
  copyFileSync(resolve(ROOT, "LICENSE"), resolve(bundleRoot, "LICENSE"));
}

function shouldCopyRuntimeSource(source) {
  const rel = relative(ROOT, source).replaceAll("\\", "/");
  if (!rel || rel === ".") return true;
  const parts = rel.split("/");
  if (parts.length === 1 && RUNTIME_SKIP_TOP.has(parts[0])) return false;
  if (parts.some((part) => RUNTIME_SKIP_ANY.has(part))) return false;
  if (parts[0] === "desktop") return false;
  if (rel.endsWith(".tsbuildinfo")) return false;
  return true;
}

function stageRuntimeApp(appRoot) {
  cpSync(ROOT, appRoot, {
    recursive: true,
    filter: shouldCopyRuntimeSource,
  });
}

function parseArgs(argv) {
  let version = packageVersion();
  let outRoot = DEFAULT_OUT_ROOT;
  let temporalExe = process.env.ECORIONE_TEMPORAL_EXE ?? "";
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--version") version = normalizeVersion(argv[++index]);
    else if (arg === "--out") outRoot = resolve(ROOT, argv[++index]);
    else if (arg === "--temporal-exe") temporalExe = resolve(argv[++index]);
    else throw new Error(`Argumen native bundle tidak dikenal: ${String(arg)}`);
  }
  if (!temporalExe) throw new Error("--temporal-exe wajib menunjuk temporal.exe pinned.");
  return { version, outRoot, temporalExe };
}

export function buildNativeDesktopBundle({ version, outRoot = DEFAULT_OUT_ROOT, temporalExe }) {
  if (process.platform !== "win32") {
    throw new Error("Native Windows bundle harus dibangun pada Windows agar native Node modules cocok.");
  }
  if (!temporalExe || !existsSync(temporalExe)) {
    throw new Error(`Temporal CLI tidak ditemukan: ${String(temporalExe)}`);
  }

  const layout = nativeBundleLayout({ version: version ?? packageVersion(), outRoot });
  rmSync(layout.bundleRoot, { recursive: true, force: true });
  mkdirSync(layout.appRoot, { recursive: true });
  mkdirSync(dirname(layout.nodeExe), { recursive: true });
  mkdirSync(dirname(layout.temporalExe), { recursive: true });

  console.log("• Building production workspace ...");
  run("pnpm", ["run", "build"], { stdio: "inherit" });

  console.log("• Staging native runtime application ...");
  stageDesktopSurface(layout.bundleRoot);
  stageRuntimeApp(layout.appRoot);

  console.log("• Installing production dependencies into portable runtime ...");
  run(
    "pnpm",
    [
      "install",
      "--prod",
      "--frozen-lockfile",
      "--config.node-linker=hoisted",
      "--config.package-import-method=copy",
      "--config.inject-workspace-packages=true",
    ],
    { cwd: layout.appRoot, stdio: "inherit" },
  );

  const nextRuntime = resolve(layout.appRoot, "node_modules", "next", "dist", "bin", "next");
  const sqliteRuntime = resolve(layout.appRoot, "node_modules", "better-sqlite3");
  if (!existsSync(nextRuntime)) throw new Error("Next.js production runtime tidak ditemukan setelah pnpm install --prod.");
  if (!existsSync(sqliteRuntime)) throw new Error("better-sqlite3 production runtime tidak ditemukan setelah pnpm install --prod.");

  copyFileSync(process.execPath, layout.nodeExe);
  copyFileSync(temporalExe, layout.temporalExe);
  if (statSync(layout.nodeExe).size === 0 || statSync(layout.temporalExe).size === 0) {
    throw new Error("Bundled Node/Temporal executable kosong.");
  }

  const temporalVersion = run(layout.temporalExe, ["--version"]);
  const metadata = {
    schemaVersion: 2,
    product: "ECORIONE",
    version: layout.version,
    platform: "windows-x64",
    runtime: "native-windows",
    dockerRequired: false,
    sourceRevision: sourceRevision(),
    nodeVersion: process.version,
    temporalVersion,
    createdAt: new Date().toISOString(),
  };
  writeFileSync(
    resolve(layout.bundleRoot, "RELEASE-MANIFEST.json"),
    `${JSON.stringify(metadata, null, 2)}\n`,
    "utf8",
  );
  writeFileSync(resolve(layout.bundleRoot, "SHA256SUMS"), `${checksumManifest(layout.bundleRoot)}\n`, "utf8");

  console.log(`✓ Native Windows bundle ready: ${layout.bundleRoot}`);
  console.log(`  Source: ${metadata.sourceRevision}`);
  console.log(`  Node: ${metadata.nodeVersion}`);
  console.log(`  Temporal: ${metadata.temporalVersion}`);
  console.log("  Docker required: no");
  return layout;
}

const invoked = process.argv[1] ? resolve(process.argv[1]) : "";
if (invoked === fileURLToPath(import.meta.url)) {
  try {
    buildNativeDesktopBundle(parseArgs(process.argv.slice(2)));
  } catch (error) {
    console.error(`ECORIONE native bundle error: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
