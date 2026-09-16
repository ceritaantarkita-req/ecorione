#!/usr/bin/env node

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseSimpleEnv } from "./ecorione-engine.mjs";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const EXPECTED_TASK_COUNT = 5;
const EXPECTED_REPEATS = 5;
const EXPECTED_MODEL_CALLS = 100;
export const W17_EXPECTED_MODES = Object.freeze([
  "full-inline",
  "ecx-all",
  "ecx-selective-auto",
  "ecx-selective-oracle",
]);

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? ROOT,
    env: options.env ?? process.env,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
  });
  if (result.error !== undefined) throw result.error;
  return result;
}

function requireCommand(command, args, label, options = {}) {
  const result = runCommand(command, args, options);
  if (result.status !== 0) {
    const stderr = typeof result.stderr === "string" ? result.stderr.trim() : "";
    const stdout = typeof result.stdout === "string" ? result.stdout.trim() : "";
    throw new Error(`${label} gagal${stderr || stdout ? `: ${stderr || stdout}` : ""}`);
  }
  return result;
}

export function inspectRepositoryState(root = ROOT) {
  const branch = requireCommand("git", ["branch", "--show-current"], "git branch", {
    cwd: root,
  }).stdout.trim();
  const head = requireCommand("git", ["rev-parse", "HEAD"], "git rev-parse HEAD", {
    cwd: root,
  }).stdout.trim();
  const originMain = requireCommand(
    "git",
    ["rev-parse", "origin/main"],
    "git rev-parse origin/main",
    { cwd: root },
  ).stdout.trim();
  const status = requireCommand("git", ["status", "--porcelain"], "git status", {
    cwd: root,
  }).stdout.trim();
  return {
    branch,
    head,
    originMain,
    clean: status.length === 0,
  };
}

export function assertClosureRepositoryState(state) {
  const failures = [];
  if (state.branch !== "main") failures.push(`branch harus main, aktual ${state.branch || "(detached)"}`);
  if (!state.clean) failures.push("worktree harus clean");
  if (state.head !== state.originMain) failures.push("HEAD harus sama dengan origin/main");
  if (failures.length > 0) throw new Error(`W17 repository preflight gagal: ${failures.join("; ")}`);
}

function loadLocalEnvironment(root = ROOT) {
  const envPath = resolve(root, ".env");
  if (!existsSync(envPath)) {
    throw new Error("W17 membutuhkan .env lokal. Jalankan pnpm engine:start lebih dulu.");
  }
  const fileValues = parseSimpleEnv(readFileSync(envPath, "utf8"));
  const env = { ...fileValues, ...process.env };
  if (!env.ECORIONE_INTERNAL_TOKEN?.trim()) {
    throw new Error("ECORIONE_INTERNAL_TOKEN tidak tersedia di .env/process environment.");
  }
  return env;
}

async function assertHealthyService(name, baseUrl, token) {
  const url = new URL("/healthz", baseUrl).toString();
  let response;
  try {
    response = await fetch(url, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5_000),
    });
  } catch (error) {
    throw new Error(
      `${name} tidak reachable di ${url}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!response.ok) throw new Error(`${name} health gagal: HTTP ${String(response.status)} di ${url}`);
}

async function assertRuntimeServices(env) {
  const token = env.ECORIONE_INTERNAL_TOKEN;
  await assertHealthyService(
    "Connect",
    env.ECORIONE_CONNECT_URL ?? "http://127.0.0.1:17023",
    token,
  );
  await assertHealthyService("Hub", env.ECORIONE_HUB_URL ?? "http://127.0.0.1:17024", token);
  await assertHealthyService(
    "Artifact",
    env.ECORIONE_ARTIFACT_URL ?? "http://127.0.0.1:17025",
    token,
  );
}

function readInventory(env) {
  const result = requireCommand(
    process.execPath,
    [resolve(ROOT, "scripts/local-agentic-eval.mjs"), "--inventory"],
    "local model inventory",
    { env },
  );
  let inventory;
  try {
    inventory = JSON.parse(result.stdout.trim());
  } catch {
    throw new Error("local model inventory tidak menghasilkan JSON yang valid");
  }
  if (inventory.modelsReachable !== true) throw new Error("local model runtime tidak reachable");
  if (inventory.listed !== true) throw new Error("ECORIONE_LOCAL_MODEL tidak ditemukan di runtime");
  if (inventory.identityVerified !== true) {
    throw new Error(
      "immutable local-model identity belum verified; ECORIONE_LOCAL_MODEL_DIGEST harus cocok dengan runtime",
    );
  }
  return inventory;
}

function stableModelIdentity(taskResults) {
  const identities = new Set();
  for (const task of taskResults) {
    for (const runs of Object.values(task.runs ?? {})) {
      for (const run of Array.isArray(runs) ? runs : []) {
        identities.add(`${String(run.model ?? "")}|${String(run.responseModel ?? "")}`);
      }
    }
  }
  return identities;
}

export function validateW17Evidence(evidence) {
  const failures = [];
  if (evidence?.schemaVersion !== 2) failures.push("schemaVersion harus 2");
  if (evidence?.profile?.target !== "local") failures.push("profile.target harus local");
  if (evidence?.profile?.repeats !== EXPECTED_REPEATS) {
    failures.push(`profile.repeats harus ${String(EXPECTED_REPEATS)}`);
  }
  if (JSON.stringify(evidence?.profile?.modes) !== JSON.stringify(W17_EXPECTED_MODES)) {
    failures.push("profile.modes tidak cocok dengan four-lane W17");
  }
  if (evidence?.profile?.oracleIndexesSuppliedToAutoLane !== false) {
    failures.push("automatic lane tidak boleh menerima oracle indexes");
  }
  if (evidence?.aggregate?.taskCount !== EXPECTED_TASK_COUNT) {
    failures.push(`aggregate.taskCount harus ${String(EXPECTED_TASK_COUNT)}`);
  }
  if (evidence?.aggregate?.measuredModelCalls !== EXPECTED_MODEL_CALLS) {
    failures.push(`aggregate.measuredModelCalls harus ${String(EXPECTED_MODEL_CALLS)}`);
  }
  if (evidence?.aggregate?.passedTasks !== EXPECTED_TASK_COUNT) {
    failures.push(`aggregate.passedTasks harus ${String(EXPECTED_TASK_COUNT)}`);
  }
  if (!Array.isArray(evidence?.aggregate?.failedTasks) || evidence.aggregate.failedTasks.length !== 0) {
    failures.push("aggregate.failedTasks harus kosong");
  }

  const taskResults = Array.isArray(evidence?.taskResults) ? evidence.taskResults : [];
  if (taskResults.length !== EXPECTED_TASK_COUNT) {
    failures.push(`taskResults harus berisi ${String(EXPECTED_TASK_COUNT)} task`);
  }
  for (const task of taskResults) {
    if (task?.gates?.pass !== true) failures.push(`${String(task?.id)} gate tidak PASS`);
    if (task?.gates?.measurements?.selection?.recall !== 1) {
      failures.push(`${String(task?.id)} automatic selector recall harus 1`);
    }
    const selected = task?.ecx?.autoSelectedRefIndexes;
    if (!Array.isArray(selected) || selected.length === 0 || selected.length > 3) {
      failures.push(`${String(task?.id)} autoSelectedRefIndexes harus 1..3`);
    } else if (new Set(selected).size !== selected.length) {
      failures.push(`${String(task?.id)} autoSelectedRefIndexes tidak boleh duplikat`);
    }
    for (const mode of W17_EXPECTED_MODES) {
      const summary = task?.summaries?.[mode];
      if (!summary) {
        failures.push(`${String(task?.id)} summary ${mode} tidak ada`);
        continue;
      }
      if (summary.cacheHits !== 0) failures.push(`${String(task?.id)} ${mode} cacheHits harus 0`);
      if (summary.qualityScoreMedian !== 1) {
        failures.push(`${String(task?.id)} ${mode} median quality harus 1`);
      }
    }
  }

  const identities = stableModelIdentity(taskResults);
  if (identities.size !== 1) failures.push("model identity harus stabil di seluruh 100 measured calls");
  if (identities.has("|")) failures.push("model identity telemetry tidak boleh kosong");

  return {
    pass: failures.length === 0,
    failures,
    modelIdentity: identities.size === 1 ? [...identities][0] : null,
  };
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function parseArgs(argv) {
  const result = { output: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--output") {
      result.output = String(argv[index + 1] ?? "").trim();
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const repository = inspectRepositoryState(ROOT);
  assertClosureRepositoryState(repository);

  const env = loadLocalEnvironment(ROOT);
  await assertRuntimeServices(env);
  const inventory = readInventory(env);

  const recordedAt = new Date().toISOString();
  const defaultOutput = resolve(
    ROOT,
    ".ecorione/evidence",
    `w17-no-oracle-${recordedAt.replace(/[:.]/gu, "-")}.json`,
  );
  const outputPath = args.output ? resolve(ROOT, args.output) : defaultOutput;
  mkdirSync(dirname(outputPath), { recursive: true });
  if (existsSync(outputPath)) throw new Error(`output sudah ada: ${outputPath}`);

  console.log(
    JSON.stringify(
      {
        phase: "preflight",
        repository,
        services: "ready",
        localModel: {
          baseUrl: inventory.baseUrl,
          modelTag: inventory.modelTag,
          identityVerified: inventory.identityVerified,
        },
        runShape: {
          tasks: EXPECTED_TASK_COUNT,
          repeats: EXPECTED_REPEATS,
          lanes: W17_EXPECTED_MODES.length,
          measuredModelCalls: EXPECTED_MODEL_CALLS,
        },
        outputPath,
      },
      null,
      2,
    ),
  );

  const run = spawnSync(
    process.execPath,
    [
      resolve(ROOT, "scripts/comparative-evidence.mjs"),
      "--repeats",
      String(EXPECTED_REPEATS),
      "--output",
      outputPath,
    ],
    {
      cwd: ROOT,
      env,
      stdio: "inherit",
    },
  );
  if (run.error !== undefined) throw run.error;
  if (run.status !== 0) {
    throw new Error(`W17 comparative run gagal dengan exit code ${String(run.status)}`);
  }
  if (!existsSync(outputPath)) throw new Error("W17 comparative run tidak menghasilkan evidence file");

  const evidence = JSON.parse(readFileSync(outputPath, "utf8"));
  const validation = validateW17Evidence(evidence);
  if (!validation.pass) {
    throw new Error(`W17 evidence validation gagal: ${validation.failures.join("; ")}`);
  }

  const summaryPath = outputPath.replace(/\.json$/u, ".summary.json");
  const summary = {
    schemaVersion: 1,
    recordedAt,
    closureEligible: true,
    repository,
    localModel: {
      baseUrl: inventory.baseUrl,
      modelTag: inventory.modelTag,
      identityVerified: inventory.identityVerified,
      identityStatus: inventory.identityStatus,
    },
    evidence: {
      path: outputPath,
      sha256: sha256File(outputPath),
      bytes: readFileSync(outputPath).byteLength,
      modelIdentity: validation.modelIdentity,
      aggregate: evidence.aggregate,
    },
  };
  writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ ...summary, summaryPath }, null, 2));
}

const isDirect =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirect) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
