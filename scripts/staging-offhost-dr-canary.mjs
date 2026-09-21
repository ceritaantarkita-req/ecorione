#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const INNER = "/app/scripts/staging-offhost-dr-canary-inner.mjs";
const PROJECT_RE = /^[a-z0-9][a-z0-9_-]*$/;

function fail(message) {
  throw new Error("Off-host DR semantic canary: " + message);
}

function parseArgs(argv) {
  const phaseAt = argv.indexOf("--phase");
  const stateAt = argv.indexOf("--state");
  const phase = phaseAt >= 0 ? argv[phaseAt + 1] : "";
  const state = stateAt >= 0 ? argv[stateAt + 1] : "";
  if (!["baseline", "post"].includes(phase) || !state) {
    fail("use --phase baseline|post --state <mode-0600 canary state>");
  }
  return { phase, state: resolve(state) };
}

function run(name, args, options = {}) {
  const result = spawnSync(name, args, {
    cwd: ROOT,
    encoding: "utf8",
    input: options.input,
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `${options.label ?? name} failed (${String(result.status)}): ${String(
        result.stderr || result.stdout || "",
      ).trim()}`,
    );
  }
  return String(result.stdout || "").trim();
}

function assertMode600(path) {
  if (!existsSync(path)) fail("canary state is missing");
  const info = lstatSync(path);
  if (!info.isFile() || info.isSymbolicLink()) {
    fail("canary state must be a regular non-symlink file");
  }
  if ((info.mode & 0o777) !== 0o600) {
    fail("canary state must be mode 600");
  }
}

const { phase, state } = parseArgs(process.argv.slice(2));
const project = process.env.ECORIONE_COMPOSE_PROJECT?.trim() || "ecorione-staging";
if (!PROJECT_RE.test(project)) fail("invalid Compose project");

const hubContainer = run(
  "docker",
  [
    "ps",
    "--filter",
    `label=com.docker.compose.project=${project}`,
    "--filter",
    "label=com.docker.compose.service=hub",
    "--format",
    "{{.ID}}",
  ],
  { label: "Hub container lookup" },
);
if (!hubContainer || hubContainer.includes("\n")) {
  fail("exactly one running Hub container is required");
}

if (phase === "baseline") {
  if (existsSync(state)) fail("refusing to overwrite existing canary state");
  mkdirSync(dirname(state), { recursive: true, mode: 0o700 });
  const output = run(
    "docker",
    ["exec", "-i", hubContainer, "node", INNER, "--phase", "baseline"],
    { label: "DR semantic canary baseline" },
  );
  const parsed = JSON.parse(output);
  if (parsed?.schemaVersion !== 1 || parsed?.phase !== "baseline-ready") {
    fail("invalid semantic canary baseline output");
  }
  writeFileSync(state, `${JSON.stringify(parsed, null, 2)}\n`, {
    mode: 0o600,
    flag: "wx",
  });
  chmodSync(state, 0o600);
  console.log("PASS ECORIONE off-host DR semantic canary baseline");
  console.log(`canary_state=${state}`);
  console.log(`ledger_session_id=${parsed.ledger.sessionId}`);
  console.log(`context_episode_id=${parsed.context.episodeId}`);
  console.log(`artifact_id=${parsed.artifact.artifactId}`);
} else {
  assertMode600(state);
  const raw = readFileSync(state, "utf8");
  const output = run(
    "docker",
    ["exec", "-i", hubContainer, "node", INNER, "--phase", "post"],
    { input: raw, label: "DR semantic canary post verification" },
  );
  const parsed = JSON.parse(output);
  if (parsed?.schemaVersion !== 1 || parsed?.phase !== "post-verified") {
    fail("invalid semantic canary post output");
  }
  console.log("PASS ECORIONE off-host DR semantic canary post verification");
  console.log(`canary_state=${state}`);
  console.log(`verified_at=${parsed.verifiedAt}`);
  console.log(`ledger_event_hash=${parsed.ledger.eventHash}`);
  console.log(`context_sha256=${parsed.context.sha256}`);
  console.log(`artifact_sha256=${parsed.artifact.sha256}`);
}
