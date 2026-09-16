#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_OUT_ROOT = resolve(ROOT, ".ecorione/desktop-release");
const DESKTOP_SOURCE = resolve(ROOT, "desktop");
const DOCKERFILE = resolve(ROOT, "Dockerfile");
const DESKTOP_IMAGE_TAG = "ecorione:desktop";

export function normalizeSpawnOutput(value) {
  return typeof value === "string" ? value.trim() : "";
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? ROOT,
    env: options.env ?? process.env,
    encoding: "utf8",
    stdio: options.stdio ?? "pipe",
  });
  if (result.error) throw result.error;
  const stdout = normalizeSpawnOutput(result.stdout);
  const stderr = normalizeSpawnOutput(result.stderr);
  if (result.status !== 0) {
    const detail = [stdout, stderr].filter(Boolean).join("\n");
    throw new Error(`${command} ${args.join(" ")} gagal${detail ? `:\n${detail}` : "."}`);
  }
  return stdout;
}

export function normalizeVersion(value) {
  const version = String(value ?? "").trim();
  if (!/^[0-9A-Za-z][0-9A-Za-z._-]{0,63}$/.test(version)) {
    throw new Error(
      "Desktop bundle version harus 1-64 karakter: huruf, angka, titik, underscore, atau dash.",
    );
  }
  return version;
}

export function sha256File(path) {
  const hash = createHash("sha256");
  hash.update(readFileSync(path));
  return hash.digest("hex");
}

export function listFilesRecursive(root) {
  const files = [];
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else if (entry.isFile()) files.push(absolute);
    }
  };
  walk(root);
  return files.sort((a, b) => relative(root, a).localeCompare(relative(root, b)));
}

export function checksumManifest(bundleRoot, excluded = new Set(["SHA256SUMS"])) {
  return listFilesRecursive(bundleRoot)
    .map((absolute) => relative(bundleRoot, absolute).replaceAll("\\", "/"))
    .filter((path) => !excluded.has(path))
    .map((path) => `${sha256File(resolve(bundleRoot, path))}  ${path}`)
    .join("\n");
}

export function buildBundleLayout({ version, outRoot = DEFAULT_OUT_ROOT }) {
  const normalized = normalizeVersion(version);
  const bundleName = `ECORIONE-${normalized}-windows-x64`;
  return {
    version: normalized,
    bundleName,
    bundleRoot: resolve(outRoot, bundleName),
    runtimeDir: resolve(outRoot, bundleName, "runtime"),
    imageTar: resolve(outRoot, bundleName, "runtime", "ecorione-image.tar"),
    imageTag: DESKTOP_IMAGE_TAG,
  };
}

function packageVersion() {
  const pkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8"));
  return normalizeVersion(pkg.version);
}

export function chooseSourceRevision(gitHead, githubSha) {
  const checkedOut = normalizeSpawnOutput(gitHead);
  if (checkedOut) return checkedOut;
  const workflowSha = normalizeSpawnOutput(githubSha);
  if (workflowSha) return workflowSha;
  return "unknown";
}

function sourceRevision() {
  let gitHead = "";
  try {
    gitHead = run("git", ["rev-parse", "HEAD"]);
  } catch {
    // Fall through to workflow metadata only when the checkout itself cannot be inspected.
  }
  return chooseSourceRevision(gitHead, process.env.GITHUB_SHA);
}

function assertReleaseInputs() {
  for (const path of [DESKTOP_SOURCE, DOCKERFILE]) {
    if (!existsSync(path)) throw new Error(`Release input tidak ditemukan: ${path}`);
  }
}

export function stageDesktopSurface(bundleRoot) {
  cpSync(DESKTOP_SOURCE, bundleRoot, {
    recursive: true,
    filter: (source) => {
      const rel = relative(DESKTOP_SOURCE, source).replaceAll("\\", "/");
      return rel !== "installer.iss" && rel !== "runtime" && !rel.startsWith("runtime/");
    },
  });
  cpSync(resolve(ROOT, "LICENSE"), resolve(bundleRoot, "LICENSE"));
}

export function writeReleaseMetadata(layout, revision) {
  const metadata = {
    schemaVersion: 1,
    product: "ECORIONE",
    version: layout.version,
    platform: "windows-x64",
    runtime: "docker-desktop",
    image: layout.imageTag,
    sourceRevision: revision,
    createdAt: new Date().toISOString(),
  };
  writeFileSync(
    resolve(layout.bundleRoot, "RELEASE-MANIFEST.json"),
    `${JSON.stringify(metadata, null, 2)}\n`,
  );
  const sums = checksumManifest(layout.bundleRoot);
  writeFileSync(resolve(layout.bundleRoot, "SHA256SUMS"), `${sums}\n`);
  return metadata;
}

function parseArgs(argv) {
  let version = packageVersion();
  let outRoot = DEFAULT_OUT_ROOT;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--version") {
      version = normalizeVersion(argv[++index]);
    } else if (arg === "--out") {
      const value = argv[++index];
      if (!value) throw new Error("--out membutuhkan path.");
      outRoot = resolve(ROOT, value);
    } else {
      throw new Error(`Argumen desktop bundle tidak dikenal: ${arg}`);
    }
  }
  return { version, outRoot };
}

export function buildDesktopBundle({ version, outRoot = DEFAULT_OUT_ROOT } = {}) {
  assertReleaseInputs();
  const layout = buildBundleLayout({ version: version ?? packageVersion(), outRoot });
  rmSync(layout.bundleRoot, { recursive: true, force: true });
  mkdirSync(layout.runtimeDir, { recursive: true });
  stageDesktopSurface(layout.bundleRoot);

  console.log(`• Building ${layout.imageTag} ...`);
  run("docker", ["build", "--pull", "--tag", layout.imageTag, "--file", DOCKERFILE, "."], {
    stdio: "inherit",
  });
  console.log("• Exporting runtime image ...");
  run("docker", ["save", "--output", layout.imageTar, layout.imageTag], { stdio: "inherit" });

  if (!existsSync(layout.imageTar) || statSync(layout.imageTar).size === 0) {
    throw new Error("Runtime image tar tidak dibuat atau kosong.");
  }
  const metadata = writeReleaseMetadata(layout, sourceRevision());
  console.log(`✓ Desktop bundle ready: ${layout.bundleRoot}`);
  console.log(`  Image: ${metadata.image}`);
  console.log("  Verify: SHA256SUMS");
  return layout;
}

const invokedPath = process.argv[1] === undefined ? "" : resolve(process.argv[1]);
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    buildDesktopBundle(parseArgs(process.argv.slice(2)));
  } catch (error) {
    console.error(
      `ECORIONE desktop bundle error: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}
