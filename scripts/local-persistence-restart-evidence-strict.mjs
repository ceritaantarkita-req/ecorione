#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  main as runEvidenceHarness,
  parseArgs,
} from "./local-persistence-restart-evidence.mjs";

function fail(message) {
  throw new Error(`Strict persistence evidence gate: ${message}`);
}

export function assertBaselineEvidenceState(state, approval, session) {
  if (state?.phase !== "baseline-ready") fail(`state phase ${String(state?.phase)} != baseline-ready`);
  if (state?.flow?.statusBefore !== "RUNNING") {
    fail(`baseline Flow status ${String(state?.flow?.statusBefore)} != RUNNING`);
  }
  if (approval?.status !== "PENDING") {
    fail(`baseline approval status ${String(approval?.status)} != PENDING`);
  }
  if (approval?.operationId !== state?.flow?.approvalOperationId) {
    fail("baseline approval operation identity does not match recorded state");
  }
  if (typeof state?.ledger?.headHash !== "string" || state.ledger.headHash.length === 0) {
    fail("baseline Ledger headHash is missing");
  }
  if (session?.headHash !== state.ledger.headHash) {
    fail("baseline Ledger session headHash does not match recorded headHash");
  }
  if (session?.nextSeq !== 1) {
    fail(`baseline Ledger nextSeq ${String(session?.nextSeq)} != 1`);
  }
  if (state?.ledger?.eventHash !== state.ledger.headHash) {
    fail("single-event baseline Ledger eventHash does not equal session headHash");
  }
}

export function assertPostEvidenceState(state, approval) {
  if (state?.phase !== "post-verified") fail(`state phase ${String(state?.phase)} != post-verified`);
  if (state?.post?.flow?.status !== "RUNNING") {
    fail(`post Flow status ${String(state?.post?.flow?.status)} != RUNNING`);
  }
  if (approval?.status !== "PENDING") {
    fail(`post approval status ${String(approval?.status)} != PENDING`);
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
    fail(`post Ledger nextSeq ${String(state?.post?.ledger?.nextSeq)} != 1`);
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
    fail(`state phase ${String(state?.phase)} != cleanup-complete`);
  }
  if (!state?.cleanup?.finalStatus || state.cleanup.finalStatus === "RUNNING") {
    fail(`cleanup final Flow status ${String(state?.cleanup?.finalStatus)} is not terminal`);
  }
}

async function loadState(statePath) {
  return JSON.parse(await readFile(resolve(statePath), "utf8"));
}

async function getJson(url, token) {
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10_000),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`GET ${url} HTTP ${String(response.status)} ${JSON.stringify(payload)}`);
  }
  return payload;
}

async function readApproval(state, token) {
  return getJson(
    `${state.urls.hub}/v1/approvals/by-idempotency-key?idempotencyKey=${encodeURIComponent(state.flow.approvalKey)}`,
    token,
  );
}

async function readLedgerSession(state, token) {
  return getJson(
    `${state.urls.hub}/v1/history/sessions/${state.ledger.sessionId}?scope=personal&maxSensitivity=INTERNAL&hostedEligible=0`,
    token,
  );
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  await runEvidenceHarness(argv);
  if (options.help || options.phase === "inventory") return;

  const token = process.env.ECORIONE_INTERNAL_TOKEN;
  if (!token) fail("ECORIONE_INTERNAL_TOKEN is required");
  const state = await loadState(options.statePath);

  if (options.phase === "baseline") {
    const [approval, session] = await Promise.all([
      readApproval(state, token),
      readLedgerSession(state, token),
    ]);
    assertBaselineEvidenceState(state, approval, session);
    console.log(
      "PASS strict persistence baseline: Flow is RUNNING, approval is PENDING, and Ledger head identity is exact",
    );
    return;
  }

  if (options.phase === "post") {
    const approval = await readApproval(state, token);
    assertPostEvidenceState(state, approval);
    console.log(
      "PASS strict persistence post: Ledger head, Context, Artifact, Flow and pending approval identities are unchanged",
    );
    return;
  }

  if (options.phase === "cleanup") {
    assertCleanupEvidenceState(state);
    console.log("PASS strict persistence cleanup: dedicated Flow probe reached a terminal state");
  }
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  main().catch((error) => {
    console.error(
      `persistence-restart-evidence-strict: failed ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  });
}
