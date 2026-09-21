#!/usr/bin/env node
import { createHash, randomUUID } from "node:crypto";

function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required inside the ECORIONE runtime container`);
  return value;
}

function authHeaders(token, json = false) {
  const headers = { authorization: `Bearer ${token}` };
  if (json) headers["content-type"] = "application/json";
  return headers;
}

async function jsonRequest(url, { token, method = "GET", body } = {}) {
  const response = await fetch(url, {
    method,
    headers: token ? authHeaders(token, body !== undefined) : undefined,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const payload = await response.json().catch(() => null);
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
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`GET ${url} HTTP ${String(response.status)}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function readStdin() {
  let text = "";
  for await (const chunk of process.stdin) text += chunk;
  return text;
}

function id(prefix) {
  return `${prefix}_dr_${randomUUID().replaceAll("-", "").slice(0, 20)}`;
}

const phaseAt = process.argv.indexOf("--phase");
const phase = phaseAt >= 0 ? process.argv[phaseAt + 1] : "";
if (phase !== "baseline" && phase !== "post") {
  throw new Error("use --phase baseline or --phase post");
}

const token = requireEnv("ECORIONE_INTERNAL_TOKEN");
const hubUrl = requireEnv("ECORIONE_HUB_URL").replace(/\/$/u, "");
const contextUrl = requireEnv("ECORIONE_CONTEXT_URL").replace(/\/$/u, "");
const artifactUrl = requireEnv("ECORIONE_ARTIFACT_URL").replace(/\/$/u, "");

if (phase === "baseline") {
  const marker = `dr-${randomUUID().replaceAll("-", "")}`;
  const sessionId = id("sess");
  const eventId = id("evt");
  const createdAt = new Date().toISOString();
  const ledgerPayload = { kind: "offhost-dr-recovery-canary", marker };

  const session = await jsonRequest(`${hubUrl}/v1/history/sessions`, {
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

  const append = await jsonRequest(`${hubUrl}/v1/history/sessions/${sessionId}/events`, {
    token,
    method: "POST",
    body: {
      expectedSeq: 0,
      event: {
        id: eventId,
        recordedAt: createdAt,
        eventType: "user.message",
        actor: "ops:offhost-dr-canary",
        operationId: null,
        parentEventId: null,
        payload: ledgerPayload,
      },
    },
  });

  const ledgerRange = await jsonRequest(
    `${hubUrl}/v1/history/sessions/${sessionId}/events?scope=personal&maxSensitivity=INTERNAL&hostedEligible=0&afterSeq=-1&limit=10`,
    { token },
  );
  const ledgerEvent = ledgerRange?.events?.find((event) => event.id === eventId);
  if (!ledgerEvent) throw new Error("DR canary Ledger event is not readable after append");
  await jsonRequest(`${hubUrl}/v1/history/verify`, { token });

  const episodeText = `ECORIONE off-host DR recovery canary ${marker}`;
  const episode = await jsonRequest(`${contextUrl}/v1/episodes`, {
    token,
    method: "POST",
    body: {
      ts: createdAt,
      rawText: episodeText,
      provenance: { sourceApp: "ops:offhost-dr-canary", sessionId },
      scope: "personal",
      sensitivity: "INTERNAL",
      syncClass: "LOCAL_ONLY",
      trust: "USER",
    },
  });
  const episodeRead = await jsonRequest(`${contextUrl}/v1/episodes/${episode.id}`, {
    token,
  });
  if (episodeRead.rawText !== episodeText) {
    throw new Error("DR canary Context content mismatch before backup");
  }

  const artifactBytes = Buffer.from(`ECORIONE_OFFHOST_DR_CANARY\nmarker=${marker}\n`, "utf8");
  const artifactSha256 = sha256Hex(artifactBytes);
  const artifactUpload = await jsonRequest(`${artifactUrl}/v1/artifacts`, {
    token,
    method: "POST",
    body: {
      contentBase64: artifactBytes.toString("base64"),
      mimeType: "text/plain",
      description: "off-host DR recovery canary",
      scope: "personal",
      sensitivity: "INTERNAL",
      syncClass: "LOCAL_ONLY",
    },
  });
  const artifactId = artifactUpload?.pointer?.id;
  if (typeof artifactId !== "string") {
    throw new Error("DR canary Artifact upload did not return pointer.id");
  }
  const artifactRead = await bytesRequest(
    `${artifactUrl}/v1/artifacts/${artifactId}/content?scope=personal&maxSensitivity=INTERNAL&hostedEligible=0`,
    token,
  );
  if (sha256Hex(artifactRead) !== artifactSha256) {
    throw new Error("DR canary Artifact digest mismatch before backup");
  }

  const state = {
    schemaVersion: 1,
    phase: "baseline-ready",
    createdAt,
    marker,
    ledger: {
      sessionId,
      eventId,
      eventHash: ledgerEvent.hash,
      headHash: session.headHash ?? append?.event?.hash ?? ledgerEvent.hash,
      payload: ledgerPayload,
    },
    context: {
      episodeId: episode.id,
      rawText: episodeText,
      sha256: sha256Hex(Buffer.from(episodeText, "utf8")),
    },
    artifact: {
      artifactId,
      sizeBytes: artifactBytes.byteLength,
      sha256: artifactSha256,
    },
  };
  process.stdout.write(`${JSON.stringify(state)}\n`);
} else {
  const raw = await readStdin();
  const state = JSON.parse(raw);
  if (state?.schemaVersion !== 1 || state?.phase !== "baseline-ready") {
    throw new Error("Unsupported DR canary state");
  }

  const session = await jsonRequest(
    `${hubUrl}/v1/history/sessions/${state.ledger.sessionId}?scope=personal&maxSensitivity=INTERNAL&hostedEligible=0`,
    { token },
  );
  const ledgerRange = await jsonRequest(
    `${hubUrl}/v1/history/sessions/${state.ledger.sessionId}/events?scope=personal&maxSensitivity=INTERNAL&hostedEligible=0&afterSeq=-1&limit=10`,
    { token },
  );
  const ledgerEvent = ledgerRange?.events?.find((event) => event.id === state.ledger.eventId);
  if (!ledgerEvent) throw new Error("Recovered DR canary Ledger event is missing");
  if (ledgerEvent.hash !== state.ledger.eventHash) {
    throw new Error("Recovered DR canary Ledger event hash changed");
  }
  if (JSON.stringify(ledgerEvent.payload) !== JSON.stringify(state.ledger.payload)) {
    throw new Error("Recovered DR canary Ledger payload changed");
  }
  if (session.headHash !== state.ledger.headHash) {
    throw new Error("Recovered DR canary Ledger head hash changed");
  }
  await jsonRequest(`${hubUrl}/v1/history/verify`, { token });

  const episode = await jsonRequest(
    `${contextUrl}/v1/episodes/${state.context.episodeId}`,
    { token },
  );
  if (episode.rawText !== state.context.rawText) {
    throw new Error("Recovered DR canary Context content changed");
  }
  if (sha256Hex(Buffer.from(episode.rawText, "utf8")) !== state.context.sha256) {
    throw new Error("Recovered DR canary Context digest changed");
  }

  const artifact = await bytesRequest(
    `${artifactUrl}/v1/artifacts/${state.artifact.artifactId}/content?scope=personal&maxSensitivity=INTERNAL&hostedEligible=0`,
    token,
  );
  if (artifact.byteLength !== state.artifact.sizeBytes) {
    throw new Error("Recovered DR canary Artifact size changed");
  }
  if (sha256Hex(artifact) !== state.artifact.sha256) {
    throw new Error("Recovered DR canary Artifact digest changed");
  }

  process.stdout.write(
    `${JSON.stringify({
      schemaVersion: 1,
      phase: "post-verified",
      verifiedAt: new Date().toISOString(),
      marker: state.marker,
      ledger: {
        sessionId: state.ledger.sessionId,
        eventId: state.ledger.eventId,
        eventHash: state.ledger.eventHash,
        headHash: state.ledger.headHash,
      },
      context: {
        episodeId: state.context.episodeId,
        sha256: state.context.sha256,
      },
      artifact: {
        artifactId: state.artifact.artifactId,
        sizeBytes: state.artifact.sizeBytes,
        sha256: state.artifact.sha256,
      },
    })}\n`,
  );
}
