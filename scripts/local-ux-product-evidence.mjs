#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

export const OWNER_HEALTH = [
  ["rnd", "http://127.0.0.1:17021/healthz"],
  ["context", "http://127.0.0.1:17022/healthz"],
  ["connect", "http://127.0.0.1:17023/healthz"],
  ["hub", "http://127.0.0.1:17024/healthz"],
  ["artifact", "http://127.0.0.1:17025/healthz"],
  ["sandbox", "http://127.0.0.1:17026/healthz"],
  ["space", "http://127.0.0.1:17027/healthz"],
  ["flow", "http://127.0.0.1:17028/healthz"],
];

export const UI_SURFACES = [
  ["ai", "http://127.0.0.1:3000/", "ecorione — Ai"],
  ["space", "http://127.0.0.1:3000/space", "Space"],
  ["flow", "http://127.0.0.1:3000/flow", "ecorione — Flow"],
  ["ops", "http://127.0.0.1:3000/ops", "Runtime health & telemetry"],
  ["settings", "http://127.0.0.1:3000/settings", "Control Center"],
];

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function git(args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
}

async function request(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      ...options,
    });
    const text = await response.text();
    return { status: response.status, text };
  } finally {
    clearTimeout(timeout);
  }
}

function parseJson(text, label) {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label} tidak mengembalikan JSON valid.`);
  }
}

export function validateRuntimeSnapshot(payload) {
  if (payload === null || typeof payload !== "object") {
    throw new Error("Runtime settings response bukan object.");
  }
  const settings = payload.settings;
  if (settings === null || typeof settings !== "object") {
    throw new Error("Runtime settings payload tidak memiliki settings object.");
  }
  if (settings.hostedCallsEnabled !== false) {
    throw new Error(
      "Hosted calls harus efektif OFF selama UX checkpoint dengan ECORIONE_COST_KILL_SWITCH=1.",
    );
  }
  return {
    hostedCallsEnabled: false,
    localRuntime: settings.localRuntime ?? null,
    localModelTag: settings.localModelTag ?? null,
  };
}

export function validateSurfaceHtml(name, html, marker) {
  if (!html.includes(marker)) {
    throw new Error(`${name} tidak memuat marker UI yang diharapkan: ${marker}`);
  }
  if (/__next_error__|nextjs-container-errors|Application error/i.test(html)) {
    throw new Error(`${name} memuat marker error framework.`);
  }
}

export async function inventory() {
  const head = git(["rev-parse", "HEAD"]);
  const originMain = git(["rev-parse", "origin/main"]);
  const trackedStatus = git(["status", "--porcelain", "--untracked-files=no"]);
  if (head !== originMain) {
    throw new Error(`HEAD (${head}) tidak sama dengan origin/main (${originMain}).`);
  }
  if (trackedStatus.length > 0) {
    throw new Error("Tracked working tree tidak clean.");
  }
  if (process.env.ECORIONE_COST_KILL_SWITCH !== "1") {
    throw new Error("ECORIONE_COST_KILL_SWITCH harus bernilai 1 untuk checkpoint ini.");
  }

  const owners = [];
  for (const [name, url] of OWNER_HEALTH) {
    const result = await request(url);
    if (result.status !== 200) throw new Error(`${name} health gagal HTTP ${result.status}.`);
    const body = parseJson(result.text, `${name} health`);
    if (body?.status !== "ok" || body?.service !== name) {
      throw new Error(`${name} health tidak melaporkan status=ok dan service=${name}.`);
    }
    owners.push({ name, status: result.status, ok: true });
  }

  const surfaces = [];
  for (const [name, url, marker] of UI_SURFACES) {
    const result = await request(url);
    if (result.status !== 200) throw new Error(`${name} surface gagal HTTP ${result.status}.`);
    validateSurfaceHtml(name, result.text, marker);
    surfaces.push({ name, status: result.status, marker });
  }

  const runtimeResponse = await request("http://127.0.0.1:3000/api/settings/settings/runtime");
  if (runtimeResponse.status !== 200) {
    throw new Error(`Ai settings proxy gagal HTTP ${runtimeResponse.status}.`);
  }
  const runtime = validateRuntimeSnapshot(parseJson(runtimeResponse.text, "runtime settings"));

  const opsResponse = await request("http://127.0.0.1:3000/api/ops");
  if (opsResponse.status !== 200)
    throw new Error(`Ai ops proxy gagal HTTP ${opsResponse.status}.`);
  const ops = parseJson(opsResponse.text, "ops");
  if (ops?.healthy !== true) throw new Error("Ops aggregator tidak melaporkan healthy=true.");

  const spaceResponse = await request(
    "http://127.0.0.1:3000/api/space/pages?workspaceId=ws_personal",
  );
  if (spaceResponse.status !== 200) {
    throw new Error(`Ai Space proxy gagal HTTP ${spaceResponse.status}.`);
  }
  const space = parseJson(spaceResponse.text, "space pages");
  if (!Array.isArray(space?.pages))
    throw new Error("Space pages response tidak memiliki pages array.");

  const flowResponse = await request("http://127.0.0.1:3000/api/flow/nodes");
  if (flowResponse.status !== 200) {
    throw new Error(`Ai Flow proxy gagal HTTP ${flowResponse.status}.`);
  }
  const flow = parseJson(flowResponse.text, "flow nodes");
  if (!Array.isArray(flow?.nodes))
    throw new Error("Flow nodes response tidak memiliki nodes array.");

  return {
    schemaVersion: 1,
    phase: "inventory",
    repo: { head, originMain, trackedClean: true },
    costKillSwitch: "1",
    owners,
    surfaces,
    runtime,
    opsHealthy: true,
    spacePageCount: space.pages.length,
    flowNodeDefinitionCount: flow.nodes.length,
  };
}

async function main() {
  console.log("=== LOCAL UX / PRODUCT VALIDATION INVENTORY ===");
  const result = await inventory();
  console.log(JSON.stringify(result, null, 2));
  console.log(
    "PASS UX/product inventory: synchronized repo, local-only routing and core Ai surfaces are ready",
  );
}

const isDirect =
  process.argv[1] !== undefined &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isDirect) {
  main().catch((error) => {
    console.error(
      `FAIL UX/product inventory: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  });
}
