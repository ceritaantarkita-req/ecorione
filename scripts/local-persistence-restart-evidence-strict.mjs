#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { main as runEvidenceHarness } from "./local-persistence-restart-evidence.mjs";
import { parseArgs } from "./local-persistence-restart-evidence.mjs";

function fail(message) {
  throw new Error(`Strict persistence evidence gate: ${message}`);
}

export function assertBaselineEvidenceState(state, approval, session) {
  if (state?.phase !== "baseline-ready") {
    fail("state phase is not baseline-ready");
  }
  if (state?.flow?.statusBefore !== "RUNNING") {
    fail("baseline Flow status is not RUNNING");
  }
  if (approval?.status !== "PENDING") {
    fail("baseline approval status is not PENDING");
  }
  if (approval?.operationId !== state?.flow?.approvalOperationId) {
    fail("baseline approval operation identity changed");
  }

  const headHash = state?.ledger?.headHash;
  if (typeof headHash !== "string" || headHash.length === 0) {
    fail("baseline Ledger headHash is missing");
  }
  if (session?.headHash !== headHash) {
    fail("baseline Ledger session headHash changed");
  }
  if (session?.nextSeq !== 1) {
    fail("baseline Ledger nextSeq is not 1");
  }
  if (state?.ledger?.eventHash !== headHash) {
    fail("baseline Ledger eventHash does not equal headHash");
  }
}

export function assertPostEvidenceState(state, approval) {
  if (state?.phase !== "post-verified") {
    fail("state phase is not post-verified");
  }
  if (state?.post?.flow?.status !== "RUNNING") {
    fail("post Flow status is not RUNNING");
  }
  if (approval?.status !== "PENDING") {
    fail("post approval status is not PENDING");
  }
  if (approval?.operationId !== state?.flow?.approvalOperationId) {
    fail("post approval operation identity changed");
  }
  if (state?.post?.ledger?.eventHash !== state?.ledger?.eventHash) {
    fail("post Ledger eventHash changed");
  }
  if (state?.post?.ledger?.headHash !== state?.ledger?.headHash) {
    fail("post Ledger headHash changed");
  }
  if (state?.post?.ledger?.nextSeq !== 1) {
    fail("post Ledger nextSeq is not 1");
  }
  if (state?.post?.context?.episodeId !== state?.context?.episodeId) {
    fail("post Context episode identity changed");
  }
  if (state?.post?.context?.sha256 !== state?.context?.sha256) {
    fail("post Context episode digest changed");
  }
  if (state?.post?.artifact?.artifactId !== state?.artifact?.artifactId) {
    fail("post Artifact identity changed");
  }
  if (state?.post?.artifact?.sha256 !== state?.artifact?.sha256) {
    fail("post Artifact digest changed");
  }
  if (state?.post?.flow?.flowId !== state?.flow?.flowId) {
    fail("post Flow identity changed");
  }
}

export function assertCleanupEvidenceState(state) {
  if (state?.phase !== "cleanup-complete") {
    fail("state phase is not cleanup-complete");
  }
  if (!state?.cleanup?.finalStatus) {
    fail("cleanup final Flow status is missing");
  }
  if (state.cleanup.finalStatus === "RUNNING") {
    fail("cleanup final Flow status is not terminal");
  }
}

async function loadState(statePath) {
  const raw = await readFile(resolve(statePath), "utf8");
  return JSON.parse(raw);
}

async function getJson(url, token) {
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10_000),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const status = String(response.status);
    const body = JSON.stringify(payload);
    throw new Error(`GET ${String(url)} HTTP ${status} ${body}`);
  }
  return payload;
}

async function readApproval(state, token) {
  const url = new URL("/v1/approvals/by-idempotency-key", state.urls.hub);
  url.searchParams.set("idempotencyKey", state.flow.approvalKey);
  return getJson(url, token);
}

async function readLedgerSession(state, token) {
  const sessionId = state.ledger.sessionId;
  const url = new URL(`/v1/history/sessions/${sessionId}`, state.urls.hub);
  url.searchParams.set("scope", "personal");
  url.searchParams.set("maxSensitivity", "INTERNAL");
  url.searchParams.set("hostedEligible", "0");
  return getJson(url, token);
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  await runEvidenceHarness(argv);
  if (options.help || options.phase === "inventory") {
    return;
  }

  const token = process.env.ECORIONE_INTERNAL_TOKEN;
  if (!token) {
    fail("ECORIONE_INTERNAL_TOKEN is required");
  }
  const state = await loadState(options.statePath);

  if (options.phase === "baseline") {
    const approvalPromise = readApproval(state, token);
    const sessionPromise = readLedgerSession(state, token);
    const [approval, session] = await Promise.all([approvalPromise, sessionPromise]);
    assertBaselineEvidenceState(state, approval, session);
    console.log("PASS strict persistence baseline");
    return;
  }

  if (options.phase === "post") {
    const approval = await readApproval(state, token);
    assertPostEvidenceState(state, approval);
    console.log("PASS strict persistence post");
    return;
  }

  if (options.phase === "cleanup") {
    assertCleanupEvidenceState(state);
    console.log("PASS strict persistence cleanup");
  }
}

const scriptPath = process.argv[1];
const isMain = scriptPath && import.meta.url === pathToFileURL(resolve(scriptPath)).href;

if (isMain) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`persistence-restart-evidence-strict: failed ${message}`);
    process.exitCode = 1;
  });
}
