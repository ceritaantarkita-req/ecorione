#!/usr/bin/env node

import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";

const execFileAsync = promisify(execFile);

const DEFAULT_STATE = ".ecorione/evidence/local-persistence-restart-state.json";
const DEFAULT_URLS = {
  context: "http://127.0.0.1:17022",
  connect: "http://127.0.0.1:17023",
  hub: "http://127.0.0.1:17024",
  artifact: "http://127.0.0.1:17025",
  flow: "http://127.0.0.1:17028",
};
const REQUIRED_HEALTH = ["context", "connect", "hub", "artifact", "flow"];

export function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function parseArgs(argv) {
  const options = {
    phase: "inventory",
    statePath: DEFAULT_STATE,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--phase") {
      options.phase = argv[i + 1];
      i += 1;
    } else if (arg === "--state") {
      options.statePath = argv[i + 1];
      i += 1;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!new Set(["inventory", "baseline", "post", "cleanup"]).has(options.phase)) {
    throw new Error(`Unknown phase: ${String(options.phase)}`);
  }
  if (typeof options.statePath !== "string" || options.statePath.length === 0) {
    throw new Error("--state requires a non-empty path");
  }
  return options;
}

export function isEcorioneContainerRow(row) {
  const name = String(row?.Names ?? "");
  const labels = String(row?.Labels ?? "");
  return (
    /(^|[-_])ecorione($|[-_])/i.test(name) ||
    /(^|,)com\.docker\.compose\.project=ecorione(,|$)/i.test(labels)
  );
}

export function summarizeContainerRows(rows) {
  return rows.filter(isEcorioneContainerRow).map((row) => ({
    name: String(row.Names ?? ""),
    image: String(row.Image ?? ""),
    state: String(row.State ?? ""),
    status: String(row.Status ?? ""),
    labels: String(row.Labels ?? ""),
  }));
}

function help() {
  console.log(`Usage:
  pnpm evidence:persistence-restart --phase inventory
  pnpm evidence:persistence-restart --phase baseline
  pnpm evidence:persistence-restart --phase post
  pnpm evidence:persistence-restart --phase cleanup

Options:
  --state <path>  Local gitignored state/evidence file (default: ${DEFAULT_STATE})

The script never stops/restarts containers or processes. Inventory is read-only. Baseline creates
small dedicated LOCAL_ONLY probes through owner APIs. Post verifies the same identities after the
operator-controlled restart. Cleanup rejects the dedicated waiting Flow probe.`);
}

async function execRead(command, args, options = {}) {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      cwd: options.cwd,
      maxBuffer: 4 * 1024 * 1024,
      windowsHide: true,
    });
    return { ok: true, stdout: stdout.trim(), stderr: stderr.trim(), code: 0 };
  } catch (error) {
    return {
      ok: false,
      stdout: String(error?.stdout ?? "").trim(),
      stderr: String(error?.stderr ?? error?.message ?? "").trim(),
      code: Number(error?.code ?? 1),
    };
  }
}

function urlsFromEnv() {
  return {
    context: process.env.ECORIONE_CONTEXT_URL ?? DEFAULT_URLS.context,
    connect: process.env.ECORIONE_CONNECT_URL ?? DEFAULT_URLS.connect,
    hub: process.env.ECORIONE_HUB_URL ?? DEFAULT_URLS.hub,
    artifact: process.env.ECORIONE_ARTIFACT_URL ?? DEFAULT_URLS.artifact,
    flow: process.env.ECORIONE_FLOW_URL ?? DEFAULT_URLS.flow,
  };
}

function authHeaders(token, json = false) {
  const headers = { authorization: `Bearer ${token}` };
  if (json) headers["content-type"] = "application/json";
  return headers;
}

async function jsonRequest(url, { token, method = "GET", body, allow404 = false } = {}) {
  const response = await fetch(url, {
    method,
    headers: token ? authHeaders(token, body !== undefined) : undefined,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  const payload = await response.json().catch(() => null);
  if (allow404 && response.status === 404) return { status: 404, body: payload };
  if (!response.ok) {
    throw new Error(
      `${method} ${url} HTTP ${String(response.status)} ${JSON.stringify(payload)}`,
    );
  }
  return payload;
}

async function bytesRequest(url, token) {
  const response = await fetch(url, {
    headers: authHeaders(token),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`GET ${url} HTTP ${String(response.status)} ${text}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function repoInventory() {
  const root = await execRead("git", ["rev-parse", "--show-toplevel"]);
  if (!root.ok) throw new Error(`git root unavailable: ${root.stderr}`);
  const cwd = root.stdout;
  const [head, origin, status] = await Promise.all([
    execRead("git", ["rev-parse", "HEAD"], { cwd }),
    execRead("git", ["rev-parse", "origin/main"], { cwd }),
    execRead("git", ["status", "--porcelain", "--untracked-files=no"], { cwd }),
  ]);
  if (!head.ok || !origin.ok || !status.ok) throw new Error("git inventory failed");
  return {
    root: cwd,
    head: head.stdout,
    originMain: origin.stdout,
    trackedClean: status.stdout === "",
    trackedStatus: status.stdout,
    synced: head.stdout === origin.stdout,
  };
}

async function dockerInventory() {
  const result = await execRead("docker", ["ps", "-a", "--format", "{{json .}}"]);
  if (!result.ok) {
    return { available: false, error: result.stderr, ecorioneContainers: [] };
  }
  const rows = result.stdout
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return { Names: "", Image: "", State: "", Status: "", Labels: "", raw: line };
      }
    });
  return { available: true, ecorioneContainers: summarizeContainerRows(rows) };
}

async function listenerInventory() {
  const result = await execRead("ss", ["-ltnp"]);
  if (!result.ok) return { available: false, error: result.stderr, lines: [] };
  const ports = [17022, 17023, 17024, 17025, 17028, 7233, 3000];
  const lines = result.stdout
    .split("\n")
    .filter((line) => ports.some((port) => line.includes(`:${String(port)}`)));
  return { available: true, lines };
}

async function healthInventory(urls, token) {
  const result = {};
  for (const name of REQUIRED_HEALTH) {
    const url = `${urls[name]}/healthz`;
    try {
      result[name] = { ok: true, url, body: await jsonRequest(url, { token }) };
    } catch (error) {
      result[name] = {
        ok: false,
        url,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
  return result;
}

function dataPaths(repoRoot) {
  return {
    hubDb: process.env.ECORIONE_HUB_DB_PATH ?? resolve(repoRoot, "data/hub.db"),
    contextDb: process.env.ECORIONE_DB_PATH ?? resolve(repoRoot, "data/ecorione.db"),
    artifactDir: process.env.ECORIONE_ARTIFACT_DIR ?? resolve(repoRoot, "data/artifacts"),
    flowDb: process.env.ECORIONE_FLOW_DB_PATH ?? resolve(repoRoot, "data/flow.sqlite"),
    temporalAddress: process.env.ECORIONE_TEMPORAL_ADDRESS ?? "127.0.0.1:7233",
    temporalNamespace: process.env.ECORIONE_TEMPORAL_NAMESPACE ?? "default",
  };
}

async function runInventory(token) {
  const repo = await repoInventory();
  const urls = urlsFromEnv();
  const [docker, listeners, health] = await Promise.all([
    dockerInventory(),
    listenerInventory(),
    healthInventory(urls, token),
  ]);
  const evidence = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    repo,
    urls,
    dataPaths: dataPaths(repo.root),
    docker,
    listeners,
    health,
  };
  console.log(JSON.stringify(evidence, null, 2));
  const failures = [];
  if (!repo.synced) failures.push("HEAD != origin/main");
  if (!repo.trackedClean) failures.push("tracked Git tree is not clean");
  for (const name of REQUIRED_HEALTH)
    if (!health[name].ok) failures.push(`${name} health unavailable`);
  if (failures.length > 0) {
    console.error(`FAIL persistence inventory: ${failures.join("; ")}`);
    process.exitCode = 1;
    return evidence;
  }
  console.log(
    "PASS persistence inventory: repo is synchronized and required owner services are healthy",
  );
  return evidence;
}

function requireToken() {
  const token = process.env.ECORIONE_INTERNAL_TOKEN;
  if (!token) throw new Error("ECORIONE_INTERNAL_TOKEN is required");
  return token;
}

function id(prefix) {
  return `${prefix}_persist_${randomUUID().replaceAll("-", "").slice(0, 20)}`;
}

async function waitForApproval(hubUrl, token, approvalKey, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await jsonRequest(
      `${hubUrl}/v1/approvals/by-idempotency-key?idempotencyKey=${encodeURIComponent(approvalKey)}`,
      { token, allow404: true },
    );
    if (result?.status !== 404) return result;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error(`Flow approval did not appear within ${String(timeoutMs)}ms`);
}

async function baseline(token, statePath) {
  const repo = await repoInventory();
  if (!repo.synced) throw new Error("Refusing baseline: HEAD != origin/main");
  if (!repo.trackedClean) throw new Error("Refusing baseline: tracked Git tree is not clean");
  const urls = urlsFromEnv();
  const health = await healthInventory(urls, token);
  for (const name of REQUIRED_HEALTH) {
    if (!health[name].ok) throw new Error(`Refusing baseline: ${name} health unavailable`);
  }

  const marker = `persist-${randomUUID().replaceAll("-", "")}`;
  const sessionId = id("sess");
  const eventId = id("evt");
  const createdAt = new Date().toISOString();
  const ledgerPayload = { kind: "local-persistence-restart-probe", marker };

  const session = await jsonRequest(`${urls.hub}/v1/history/sessions`, {
    token,
    method: "POST",
    body: {
      sessionId,
      scope: "personal",
      sensitivity: "INTERNAL",
      syncClass: "LOCAL_ONLY",
      createdAt,
    },
  });
  const append = await jsonRequest(`${urls.hub}/v1/history/sessions/${sessionId}/events`, {
    token,
    method: "POST",
    body: {
      expectedSeq: 0,
      event: {
        id: eventId,
        recordedAt: createdAt,
        eventType: "user.message",
        actor: "ops:persistence-probe",
        operationId: null,
        parentEventId: null,
        payload: ledgerPayload,
      },
    },
  });
  const ledgerRange = await jsonRequest(
    `${urls.hub}/v1/history/sessions/${sessionId}/events?scope=personal&maxSensitivity=INTERNAL&hostedEligible=0&afterSeq=-1&limit=10`,
    { token },
  );
  const ledgerVerify = await jsonRequest(`${urls.hub}/v1/history/verify`, { token });
  const ledgerEvent = ledgerRange?.events?.find((event) => event.id === eventId);
  if (!ledgerEvent) throw new Error("Ledger probe event was not readable after append");

  const episodeText = `ECORIONE local persistence/restart probe ${marker}`;
  const episode = await jsonRequest(`${urls.context}/v1/episodes`, {
    token,
    method: "POST",
    body: {
      ts: createdAt,
      rawText: episodeText,
      provenance: { sourceApp: "ops:persistence-probe", sessionId },
      scope: "personal",
      sensitivity: "INTERNAL",
      syncClass: "LOCAL_ONLY",
      trust: "USER",
    },
  });
  const episodeRead = await jsonRequest(`${urls.context}/v1/episodes/${episode.id}`, { token });
  if (episodeRead.rawText !== episodeText)
    throw new Error("Context probe content mismatch before restart");

  const artifactBytes = Buffer.from(`ECORIONE_PERSISTENCE_PROBE\nmarker=${marker}\n`, "utf8");
  const artifactDigest = sha256Hex(artifactBytes);
  const artifactUpload = await jsonRequest(`${urls.artifact}/v1/artifacts`, {
    token,
    method: "POST",
    body: {
      contentBase64: artifactBytes.toString("base64"),
      mimeType: "text/plain",
      description: "local persistence restart probe",
      scope: "personal",
      sensitivity: "INTERNAL",
      syncClass: "LOCAL_ONLY",
    },
  });
  const artifactId = artifactUpload?.pointer?.id;
  if (typeof artifactId !== "string")
    throw new Error("Artifact upload did not return pointer.id");
  const artifactRead = await bytesRequest(
    `${urls.artifact}/v1/artifacts/${artifactId}/content?scope=personal&maxSensitivity=INTERNAL&hostedEligible=0`,
    token,
  );
  if (sha256Hex(artifactRead) !== artifactDigest)
    throw new Error("Artifact probe digest mismatch before restart");

  const flow = await jsonRequest(`${urls.flow}/v1/flows`, {
    token,
    method: "POST",
    body: {
      scope: "personal",
      sensitivity: "INTERNAL",
      inputText: `Persistence restart probe ${marker}`,
      delayMs: 0,
      approvalPrompt: `Persistence restart probe ${marker}; reject during cleanup after post-restart verification.`,
      aiTarget: "local",
      aiMessage: "Persistence probe should be rejected before AI execution.",
      execution: {
        tier: "tier0",
        workspace: repo.root,
        command: "pwd",
        wasmBase64: null,
        wasmExport: "run",
        wasmArgs: [],
      },
    },
  });
  const approvalKey = `${flow.flowId}:human-approval`;
  const approval = await waitForApproval(urls.hub, token, approvalKey);
  const flowStatus = await jsonRequest(`${urls.flow}/v1/flows/${flow.flowId}`, { token });

  const state = {
    schemaVersion: 1,
    phase: "baseline-ready",
    createdAt,
    baselineRevision: repo.head,
    marker,
    urls,
    dataPaths: dataPaths(repo.root),
    ledger: {
      sessionId,
      eventId,
      eventHash: ledgerEvent.hash,
      headHash: session.headHash ?? append?.event?.hash ?? ledgerEvent.hash,
      payload: ledgerPayload,
      verify: ledgerVerify,
    },
    context: {
      episodeId: episode.id,
      rawText: episodeText,
      sha256: sha256Hex(Buffer.from(episodeText, "utf8")),
    },
    artifact: {
      artifactId,
      sizeBytes: artifactBytes.byteLength,
      sha256: artifactDigest,
    },
    flow: {
      flowId: flow.flowId,
      operationId: flow.operationId,
      approvalKey,
      approvalOperationId: approval.operationId,
      statusBefore: flowStatus.status,
    },
  };
  await writeState(statePath, state);
  console.log(JSON.stringify(state, null, 2));
  console.log(
    `PASS persistence baseline: probes created; state saved mode-0600 at ${statePath}`,
  );
  return state;
}

async function loadState(statePath) {
  const raw = await readFile(statePath, "utf8");
  const state = JSON.parse(raw);
  if (state?.schemaVersion !== 1)
    throw new Error("Unsupported persistence evidence state schema");
  return state;
}

async function writeState(statePath, state) {
  const absolute = resolve(statePath);
  await mkdir(dirname(absolute), { recursive: true, mode: 0o700 });
  await writeFile(absolute, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
}

async function postVerify(token, statePath) {
  const state = await loadState(statePath);
  const repo = await repoInventory();
  if (repo.head !== state.baselineRevision)
    throw new Error(
      `Refusing post verification: HEAD ${repo.head} != baseline ${state.baselineRevision}`,
    );
  if (!repo.synced) throw new Error("Refusing post verification: HEAD != origin/main");
  if (!repo.trackedClean)
    throw new Error("Refusing post verification: tracked Git tree is not clean");

  const urls = state.urls;
  const health = await healthInventory(urls, token);
  for (const name of REQUIRED_HEALTH) {
    if (!health[name].ok) throw new Error(`Post verification: ${name} health unavailable`);
  }

  const session = await jsonRequest(
    `${urls.hub}/v1/history/sessions/${state.ledger.sessionId}?scope=personal&maxSensitivity=INTERNAL&hostedEligible=0`,
    { token },
  );
  const ledgerRange = await jsonRequest(
    `${urls.hub}/v1/history/sessions/${state.ledger.sessionId}/events?scope=personal&maxSensitivity=INTERNAL&hostedEligible=0&afterSeq=-1&limit=10`,
    { token },
  );
  const ledgerEvent = ledgerRange?.events?.find((event) => event.id === state.ledger.eventId);
  if (!ledgerEvent) throw new Error("Post verification: Ledger probe event missing");
  if (ledgerEvent.hash !== state.ledger.eventHash)
    throw new Error("Post verification: Ledger event hash changed");
  if (JSON.stringify(ledgerEvent.payload) !== JSON.stringify(state.ledger.payload))
    throw new Error("Post verification: Ledger payload changed");
  const ledgerVerify = await jsonRequest(`${urls.hub}/v1/history/verify`, { token });

  const episode = await jsonRequest(`${urls.context}/v1/episodes/${state.context.episodeId}`, {
    token,
  });
  if (episode.rawText !== state.context.rawText)
    throw new Error("Post verification: Context episode content changed");
  const episodeDigest = sha256Hex(Buffer.from(episode.rawText, "utf8"));
  if (episodeDigest !== state.context.sha256)
    throw new Error("Post verification: Context episode digest changed");

  const artifact = await bytesRequest(
    `${urls.artifact}/v1/artifacts/${state.artifact.artifactId}/content?scope=personal&maxSensitivity=INTERNAL&hostedEligible=0`,
    token,
  );
  const artifactDigest = sha256Hex(artifact);
  if (artifactDigest !== state.artifact.sha256)
    throw new Error("Post verification: Artifact digest changed");

  const flowStatus = await jsonRequest(`${urls.flow}/v1/flows/${state.flow.flowId}`, { token });
  if (flowStatus.status !== "RUNNING")
    throw new Error(`Post verification: Flow status ${String(flowStatus.status)} != RUNNING`);
  const approval = await jsonRequest(
    `${urls.hub}/v1/approvals/by-idempotency-key?idempotencyKey=${encodeURIComponent(state.flow.approvalKey)}`,
    { token },
  );
  if (approval.operationId !== state.flow.approvalOperationId)
    throw new Error("Post verification: Flow approval operation identity changed");

  const updated = {
    ...state,
    phase: "post-verified",
    postVerifiedAt: new Date().toISOString(),
    post: {
      revision: repo.head,
      ledger: {
        nextSeq: session.nextSeq,
        headHash: session.headHash,
        eventHash: ledgerEvent.hash,
        verify: ledgerVerify,
      },
      context: { episodeId: episode.id, sha256: episodeDigest },
      artifact: { artifactId: state.artifact.artifactId, sha256: artifactDigest },
      flow: {
        flowId: state.flow.flowId,
        status: flowStatus.status,
        approvalOperationId: approval.operationId,
      },
      health,
    },
  };
  await writeState(statePath, updated);
  console.log(JSON.stringify(updated.post, null, 2));
  console.log(
    "PASS persistence post: Ledger, Context, Artifact and pending Flow identities survived the tested restart boundary",
  );
  return updated;
}

async function cleanup(token, statePath) {
  const state = await loadState(statePath);
  const urls = state.urls;
  let status = await jsonRequest(`${urls.flow}/v1/flows/${state.flow.flowId}`, { token });
  if (status.status === "RUNNING") {
    await jsonRequest(`${urls.flow}/v1/flows/${state.flow.flowId}/decision`, {
      token,
      method: "POST",
      body: {
        decision: "REJECT",
        note: "Local persistence/restart evidence cleanup after successful post-restart verification.",
      },
    });
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      status = await jsonRequest(`${urls.flow}/v1/flows/${state.flow.flowId}`, { token });
      if (status.status !== "RUNNING") break;
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
    }
  }
  if (status.status === "RUNNING")
    throw new Error("Cleanup: Flow remained RUNNING after reject signal");
  const updated = {
    ...state,
    phase: "cleanup-complete",
    cleanupAt: new Date().toISOString(),
    cleanup: { flowId: state.flow.flowId, finalStatus: status.status },
  };
  await writeState(statePath, updated);
  console.log(JSON.stringify(updated.cleanup, null, 2));
  console.log("PASS persistence cleanup: dedicated Flow probe is no longer waiting");
  return updated;
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    help();
    return;
  }
  const token = requireToken();
  if (options.phase === "inventory") await runInventory(token);
  else if (options.phase === "baseline") await baseline(token, options.statePath);
  else if (options.phase === "post") await postVerify(token, options.statePath);
  else if (options.phase === "cleanup") await cleanup(token, options.statePath);
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  main().catch((error) => {
    console.error(
      `persistence-restart-evidence: failed ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  });
}
