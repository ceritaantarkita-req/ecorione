import { afterEach, describe, expect, it, vi } from "vitest";
import { createServer } from "@ecorione/shared-server";
import type { FastifyInstance } from "fastify";
import { openHubDatabase, type HubDatabase } from "./db.js";
import { buildHubServer } from "./http.js";
import { registerHubMultimodal } from "./multimodal-bootstrap.js";

const apps: FastifyInstance[] = [];
const dbs: HubDatabase[] = [];

afterEach(async () => {
  for (const app of apps.splice(0)) await app.close();
  for (const db of dbs.splice(0)) db.close();
});

async function listen(app: FastifyInstance): Promise<string> {
  apps.push(app);
  await app.listen({ port: 0, host: "127.0.0.1" });
  const address = app.server.address();
  if (address === null || typeof address === "string") throw new Error("test address gagal");
  return `http://127.0.0.1:${String(address.port)}`;
}

async function buildHarness(input: {
  syncClass?: "LOCAL_ONLY" | "CLOUD_ALLOWED";
  connectHandler?: (body: Record<string, unknown>) => unknown;
}) {
  const sourceBytes = Buffer.from("image-bytes");
  let derivation: Record<string, unknown> | null = null;
  const context = createServer({ name: "context-test" });
  context.get<{ Params: { id: string } }>("/v1/artifacts/:id/authorize", async (req) => ({
    id: req.params.id,
    path: "/cas/source",
    description: "source",
    mimeType: "image/png",
    sizeBytes: sourceBytes.byteLength,
    scope: "personal",
    sensitivity: "INTERNAL",
    syncClass: input.syncClass ?? "LOCAL_ONLY",
  }));
  context.post("/v1/episodes", async () => ({ id: "epi_multimodal001" }));
  context.post("/v1/multimodal/derivations", async (req, reply) => {
    derivation = req.body as Record<string, unknown>;
    return reply.code(201).send(req.body);
  });
  const contextUrl = await listen(context);

  const artifact = createServer({ name: "artifact-test", bodyLimit: 1024 * 1024 });
  artifact.get<{ Params: { id: string } }>("/v1/artifacts/:id/content", async (_req, reply) =>
    reply.type("image/png").send(sourceBytes),
  );
  artifact.post("/v1/artifacts", async (req, reply) => {
    const body = req.body as Record<string, unknown>;
    return reply.code(201).send({
      deduplicated: false,
      pointer: {
        id: "art_speech001",
        path: "/cas/speech",
        description: body.description,
        mimeType: body.mimeType,
        sizeBytes: Buffer.from(String(body.contentBase64), "base64").byteLength,
        scope: body.scope,
        sensitivity: body.sensitivity,
        syncClass: body.syncClass,
      },
    });
  });
  const artifactUrl = await listen(artifact);

  const connectCalls = vi.fn();
  const connect = createServer({ name: "connect-test" });
  connect.post("/v1/multimodal/infer", async (req) => {
    const body = req.body as Record<string, unknown>;
    connectCalls(body);
    if (input.connectHandler !== undefined) return input.connectHandler(body);
    return {
      routeUsed: "local",
      adapter: "test-local-v1",
      provider: "local",
      model: "test-model-20260910",
      language: "id",
      text: "teks invoice",
      segments: [
        {
          text: "teks invoice",
          page: 1,
          boundingBox: { x: 0.1, y: 0.2, width: 0.5, height: 0.1 },
          confidence: 0.96,
          language: "id",
        },
      ],
      actualUsd: 0,
      naiveUsd: 0,
    };
  });
  const connectUrl = await listen(connect);

  const db = openHubDatabase();
  dbs.push(db);
  const hub = buildHubServer(db, {
    contextUrl,
    connectUrl,
    rndUrl: "http://127.0.0.1:1",
    artifactUrl,
  });
  registerHubMultimodal(hub, db, { contextUrl, connectUrl, artifactUrl });
  apps.push(hub);
  return { hub, db, connectCalls, getDerivation: () => derivation };
}

describe("Hub native multimodal pipeline", () => {
  it("runs image OCR locally, persists Context metadata, lifecycle, and Ledger provenance", async () => {
    const { hub, db, connectCalls, getDerivation } = await buildHarness({});
    const response = await hub.inject({
      method: "POST",
      url: "/v1/multimodal/analyze",
      payload: {
        operationId: "op_multimodalhub001",
        sessionId: "sess_multimodal001",
        artifactId: "art_source001",
        scope: "personal",
        maxSensitivity: "INTERNAL",
        task: "ocr",
        route: { preferred: "local", allowHostedFallback: false },
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      state: "READY",
      sourceArtifactId: "art_source001",
      contextEpisodeId: "epi_multimodal001",
      result: { routeUsed: "local", language: "id" },
    });
    expect(response.json().result.segments[0]).toMatchObject({ page: 1, confidence: 0.96 });
    expect(connectCalls).toHaveBeenCalledTimes(1);
    expect(getDerivation()).toMatchObject({
      sourceArtifactId: "art_source001",
      task: "ocr",
      result: { segments: [{ page: 1, confidence: 0.96 }] },
    });

    const status = await hub.inject({
      method: "GET",
      url: "/v1/multimodal/op_multimodalhub001",
    });
    expect(status.json()).toMatchObject({ state: "READY", routeUsed: "local" });

    const row = db.raw
      .prepare("SELECT event_type,payload_json FROM history_events WHERE operation_id=?")
      .get("op_multimodalhub001") as { event_type: string; payload_json: string };
    expect(row.event_type).toBe("artifact.extracted");
    expect(JSON.parse(row.payload_json)).toMatchObject({
      sourceArtifactId: "art_source001",
      segmentCount: 1,
      routeUsed: "local",
    });

    const retry = await hub.inject({
      method: "POST",
      url: "/v1/multimodal/analyze",
      payload: {
        operationId: "op_multimodalhub001",
        sessionId: "sess_multimodal001",
        artifactId: "art_source001",
        scope: "personal",
        maxSensitivity: "INTERNAL",
        task: "ocr",
        route: { preferred: "local", allowHostedFallback: false },
      },
    });
    expect(retry.statusCode).toBe(200);
    expect(connectCalls).toHaveBeenCalledTimes(1);
  });

  it("rejects hosted fallback for LOCAL_ONLY before sending bytes to Connect", async () => {
    const { hub, connectCalls } = await buildHarness({ syncClass: "LOCAL_ONLY" });
    const response = await hub.inject({
      method: "POST",
      url: "/v1/multimodal/analyze",
      payload: {
        operationId: "op_multimodalhub002",
        sessionId: "sess_multimodal002",
        artifactId: "art_source002",
        scope: "personal",
        maxSensitivity: "INTERNAL",
        task: "vision",
        route: { preferred: "local", allowHostedFallback: true },
      },
    });
    expect(response.statusCode).toBe(403);
    expect(connectCalls).not.toHaveBeenCalled();
  });

  it("routes TTS through Connect and writes generated audio back to Artifact", async () => {
    const { hub, db } = await buildHarness({
      connectHandler: (body) => {
        expect(body.task).toBe("synthesize");
        return {
          routeUsed: "local",
          adapter: "tts-local-v1",
          provider: "local",
          model: "tts-model-20260910",
          language: "en",
          text: String(body.text),
          segments: [],
          audioBase64: Buffer.from("wav-bytes").toString("base64"),
          audioMimeType: "audio/wav",
          actualUsd: 0,
          naiveUsd: 0,
        };
      },
    });
    const response = await hub.inject({
      method: "POST",
      url: "/v1/multimodal/synthesize",
      payload: {
        operationId: "op_multimodaltts001",
        sessionId: "sess_multimodaltts001",
        scope: "personal",
        sensitivity: "INTERNAL",
        syncClass: "LOCAL_ONLY",
        text: "hello",
        language: "en",
        route: { preferred: "local", allowHostedFallback: false },
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      state: "READY",
      outputArtifact: { id: "art_speech001", mimeType: "audio/wav" },
      result: { routeUsed: "local", language: "en" },
    });
    expect(response.json().result.audioBase64).toBeUndefined();

    const row = db.raw
      .prepare("SELECT event_type,payload_json FROM history_events WHERE operation_id=?")
      .get("op_multimodaltts001") as { event_type: string; payload_json: string };
    expect(row.event_type).toBe("artifact.synthesized");
    expect(JSON.parse(row.payload_json)).toMatchObject({ outputArtifactId: "art_speech001" });
  });
});
