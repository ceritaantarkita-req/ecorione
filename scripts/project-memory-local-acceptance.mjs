/** Opt-in real local acceptance; isolated DBs/services, synthetic facts, no hosted calls.
 * Run: node --import tsx scripts/project-memory-local-acceptance.mjs qwen3.5:9b hermes3:latest
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { createWriteStream, mkdtempSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { openContextDatabase } from "../services/context/src/db.ts";
import { ContextRepository } from "../services/context/src/repository.ts";
import { openHubDatabase } from "../services/hub/src/db.ts";
import { buildHubServer } from "../services/hub/src/http.ts";
import { ProjectRegistry } from "../services/hub/src/project-registry.ts";
import { openRndDatabase } from "../services/rnd/src/db.ts";
import { buildRndServer } from "../services/rnd/src/http.ts";
import { buildConnectServer } from "../services/connect/src/http.ts";

const [model, secondModel] = process.argv.slice(2);
assert(model, "Supply an installed local model; no download or hosted fallback.");
const directory = mkdtempSync(join("data", "memory-acceptance-"));
const contextPath = join(directory, "context.db");
const hubDb = openHubDatabase(join(directory, "hub.db"));
const rndDb = openRndDatabase(join(directory, "rnd.db"));
const rndApp = buildRndServer(rndDb);
let contextDb;
let contextProcess;
let contextLog;
let connectApp;
let hubApp;
let contextUrl;
let connectUrl;
let hubUrl;
let injectFailure = false;
const markers = ["AURORA-518", "Dimas", "28 Desember 2026"];
const observations = [];
// A settled verdict must belong to this chat, never an earlier request.
const expectedAttemptSequence = new Map();
const now = () => new Date().toISOString();
const projects = new ProjectRegistry(hubDb);
const projectInput = {
  workspaceId: "ws_personal",
  description: "",
  instruction: "",
  memoryPolicy: "GLOBAL_PLUS_PROJECT",
  autonomyCeiling: "L3",
};
const project = projects.create(
  { ...projectInput, name: "Synthetic memory acceptance" },
  now(),
);
const sibling = projects.create({ ...projectInput, name: "Synthetic sibling" }, now());

async function listen(app, port = 0) {
  await app.listen({ port, host: "127.0.0.1" });
  return `http://127.0.0.1:${app.server.address().port}`;
}
async function json(url, body) {
  const response = await fetch(url, {
    ...(body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
    signal: AbortSignal.timeout(65_000),
  });
  const result = await response.json();
  if (!response.ok) {
    writeFileSync(join(directory, "failure.json"), JSON.stringify(result, null, 2));
    record("HTTP_FAILURE", {
      status: response.status,
      type: result.error?.type,
      timeout: /timeout|aborted|deadline/i.test(result.error?.message ?? ""),
    });
  }
  assert(response.ok, `HTTP ${response.status} from isolated ${new URL(url).pathname}`);
  return result;
}
async function openConnect(tag, port = 0) {
  connectApp = buildConnectServer({
    localRuntime: "ollama",
    localBaseUrl: "http://127.0.0.1:11434",
    localModelTag: tag,
    hostedCallsEnabled: false,
  });
  connectApp.addHook("preHandler", async (request, reply) => {
    if (request.url !== "/v1/complete") return;
    assert.equal(request.body.target, "local");
    observations.push({
      markers: markers.filter((m) => request.body.dynamicText.includes(m)),
      message: request.body.userMessage,
    });
    if (injectFailure && request.body.prefix.systemPrompt.startsWith("Kamu pengekstrak")) {
      injectFailure = false;
      return reply.send({ reply: "invalid JSON" });
    }
  });
  connectUrl = await listen(connectApp, port);
}
async function openContext(port = 0) {
  if (port === 0) {
    const probe = createServer();
    await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
    port = probe.address().port;
    await new Promise((resolve) => probe.close(resolve));
  }
  contextUrl = `http://127.0.0.1:${port}`;
  contextProcess = spawn(
    process.execPath,
    ["--import", "tsx", "services/context/src/main.ts"],
    {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        ECORIONE_CONTEXT_PORT: String(port),
        ECORIONE_DB_PATH: resolve(contextPath),
        ECORIONE_CONNECT_URL: connectUrl,
        ECORIONE_INTERNAL_TOKEN: "",
      },
    },
  );
  contextLog = createWriteStream(join(directory, `context-${contextProcess.pid}.log`));
  contextProcess.stdout.pipe(contextLog);
  contextProcess.stderr.pipe(contextLog);
  const deadline = Date.now() + 30_000;
  let ready = false;
  while (Date.now() < deadline && contextProcess.exitCode === null) {
    try {
      const response = await fetch(`${contextUrl}/healthz`, {
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {
      /* Child is still starting. */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert(ready, "Isolated Context child did not start");
  contextDb = openContextDatabase({ path: contextPath, readonly: true });
  return new ContextRepository(contextDb);
}
async function stopContext() {
  contextDb?.close();
  contextDb = undefined;
  if (contextProcess?.exitCode === null) {
    const exited = once(contextProcess, "exit");
    contextProcess.kill();
    await exited;
  }
  contextLog?.end();
}
async function openHub() {
  hubApp = buildHubServer(hubDb, { contextUrl, connectUrl, rndUrl });
  hubUrl = await listen(hubApp);
}
async function settled(projectId) {
  const since = expectedAttemptSequence.get(projectId);
  assert(Number.isSafeInteger(since), "Missing baseline for a new Project chat");
  const deadline = Date.now() + 65_000;
  let last = null;
  while (Date.now() < deadline) {
    const status = await json(`${contextUrl}/v1/memory/status?projectId=${projectId}`);
    last = status;
    if (
      status.lastFinishedAttemptSequence > since &&
      !status.processing &&
      !status.queued
    ) {
      record("ATTEMPT_FINISHED", {
        projectId,
        sequence: status.lastFinishedAttemptSequence,
        lastAttempt: status.lastAttempt,
        pendingEpisodes: status.pendingEpisodes,
        extractionMs: status.lastExtractionDurationMs,
        promptBytes: status.lastExtractionPromptBytes,
      });
      return status;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  record("ATTEMPT_TIMEOUT", {
    projectId,
    baselineSequence: since,
    lastSeenSequence: last?.lastFinishedAttemptSequence ?? null,
    processing: last?.processing ?? null,
    queued: last?.queued ?? null,
  });
  throw new Error("New consolidation attempt did not finish within 65s");
}
async function chat(message, projectId = project.id, cloudShare = false) {
  const before = await json(`${contextUrl}/v1/memory/status?projectId=${projectId}`);
  expectedAttemptSequence.set(projectId, before.lastFinishedAttemptSequence);
  const result = await json(`${hubUrl}/v1/chat`, {
    message,
    projectId,
    sessionId: `sess_${randomUUID().replaceAll("-", "")}`,
    target: "local",
    cloudShare,
  });
  assert.equal(result.memoryUsed.episodicSummaries.length, 0);
  return {
    ...result,
    inputMarkers: observations.findLast((o) => o.message === message)?.markers ?? [],
  };
}
function record(id, result) {
  console.log(JSON.stringify({ id, ...result }));
}
function recall(id, result, expected) {
  const passed = expected.every((m) => result.reply.includes(m));
  assert(
    expected.every((m) => result.inputMarkers.includes(m)),
    `${id}: missing actual model input`,
  );
  record(id, {
    status: passed ? "PASS" : "FAIL",
    recalledFacts: result.memoryUsed.recalledFacts.length,
    inputMarkers: result.inputMarkers,
    answerMarkers: markers.filter((m) => result.reply.toLowerCase().includes(m.toLowerCase())),
    model: result.cost.model,
  });
  assert(passed, `${id}: real local answer missing expected facts`);
}
const rndUrl = await listen(rndApp);
try {
  const tags = await json("http://127.0.0.1:11434/api/tags");
  for (const tag of [model, secondModel].filter(Boolean)) {
    const installed = tags.models.find((m) => m.name === tag);
    assert(installed, "Requested model must already be installed");
    record("MODEL", { model: tag, digest: installed.digest });
  }
  await openConnect(model);
  let repo = await openContext();
  await openHub();
  await chat(
    `Ingat fakta eksperimen ini: kode ${markers[0]}, penanggung jawab ${markers[1]}, target penyelesaian ${markers[2]}.`,
  );
  const status = await settled(project.id);
  const facts = repo.listFacts({ projectId: project.id, includeGlobal: false });
  record("M01_DIAGNOSTIC", {
    status,
    found: markers.map((m) => facts.some((f) => f.text.includes(m))),
  });
  assert.equal(facts.length, 3, "Three independent claims must produce three facts");
  assert(markers.every((m) => facts.some((f) => f.object === m)));
  for (const fact of facts)
    for (const sourceId of fact.sourceEpisodeIds) {
      const source = repo.getEpisode(sourceId);
      assert.equal(source.trust, "USER");
      assert.equal(source.projectId, project.id);
      assert.equal(fact.syncClass, "LOCAL_ONLY");
    }
  assert.equal(status.pendingEpisodes, 0);
  record("M01", { status: "PASS", facts: facts.length });
  recall(
    "M02/M04/M05",
    await chat("Apa kode eksperimen, penanggung jawab, dan target penyelesaiannya?"),
    markers,
  );
  await settled(project.id);
  recall(
    "M03",
    await chat("Siapa yang memimpin percobaan itu dan kapan harus rampung?"),
    markers.slice(1),
  );
  await settled(project.id);
  const isolated = await chat(
    "Siapa yang memimpin percobaan itu dan kapan harus rampung?",
    sibling.id,
  );
  assert.equal(isolated.memoryUsed.recalledFacts.length, 0);
  assert.equal(isolated.inputMarkers.length, 0);
  assert(!markers.some((m) => isolated.reply.includes(m)));
  record("M07", { status: "PASS", recalledFacts: 0 });
  await settled(sibling.id);
  const hosted = await json(`${contextUrl}/v1/retrieve`, {
    query: "Siapa memimpin percobaan?",
    projectId: project.id,
    scopes: ["personal"],
    now: now(),
    hostedEligibleOnly: true,
    projectFallback: true,
  });
  assert.equal(hosted.hits.length, 0);
  record("M08", {
    status: "PASS",
    boundary: "real Context hosted-eligible retrieval; no hosted model called",
  });
  const port = Number(new URL(contextUrl).port);
  const oldPid = contextProcess.pid;
  await stopContext();
  repo = await openContext(port);
  assert.notEqual(contextProcess.pid, oldPid);
  recall(
    "M09",
    await chat("Apa kode eksperimen, penanggung jawab, dan target penyelesaiannya?"),
    markers,
  );
  await settled(project.id);
  injectFailure = true;
  await chat("Catatan uji: warna sampul laporan adalah ungu.");
  const failed = await settled(project.id);
  assert(failed.pendingEpisodes > 0);
  assert(failed.lastFailureCodes.includes("INVALID_JSON"));
  const retried = await json(`${contextUrl}/v1/consolidate/run`, {
    projectId: project.id,
    now: now(),
  });
  record("M10_DIAGNOSTIC", {
    failureCodes: retried.errors,
    pendingEpisodes: repo.projectMemoryCounts(project.id).pendingEpisodes,
  });
  assert.equal(retried.errors.length, 0);
  assert.equal(repo.projectMemoryCounts(project.id).pendingEpisodes, 0);
  record("M10", {
    status: "PASS",
    boundary: "injected invalid JSON followed by real local extraction",
  });
  if (secondModel) {
    const connectPort = connectApp.server.address().port;
    await hubApp.close();
    await connectApp.close();
    await openConnect(secondModel, connectPort);
    await openHub();
    recall(
      "M06",
      await chat("Apa kode eksperimen, penanggung jawab, dan target penyelesaiannya?"),
      markers,
    );
    await settled(project.id);
    recall(
      "M06_PARAPHRASE",
      await chat("Siapa yang memimpin percobaan itu dan kapan harus rampung?"),
      markers.slice(1),
    );
    await settled(project.id);
  } else record("M06", { status: "PENDING", reason: "second installed model not supplied" });
  const localFacts = repo.listFacts({ projectId: project.id, includeGlobal: false });
  const shared = await chat(
    "Kode demo publik Project ini adalah LENTERA-207. Jawab OK saja.",
    project.id,
    true,
  );
  assert.equal(shared.inputMarkers.length, 0, "Cloud Allowed must exclude Local Only input");
  const sharedStatus = await settled(project.id);
  assert.equal(sharedStatus.pendingEpisodes, 0);
  assert.equal(sharedStatus.lastFailureCodes.length, 0);
  const eligible = await json(`${contextUrl}/v1/retrieve`, {
    query: "Apa kode demo publik?",
    projectId: project.id,
    scopes: ["personal"],
    now: now(),
    hostedEligibleOnly: true,
    projectFallback: true,
  });
  assert(eligible.hits.some((hit) => hit.fact.object === "LENTERA-207"));
  assert(eligible.hits.every((hit) => hit.fact.syncClass === "CLOUD_ALLOWED"));
  for (const fact of localFacts) assert.deepEqual(repo.getFact(fact.id), fact);
  record("M11", { status: "PASS", boundary: "per-message consent; no hosted dispatch" });
} finally {
  await hubApp?.close();
  await stopContext();
  await connectApp?.close();
  await rndApp.close();
  hubDb.close();
  rndDb.close();
  console.log(`Private synthetic evidence retained in ${directory}`);
}
