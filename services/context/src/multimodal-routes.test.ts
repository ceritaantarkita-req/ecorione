import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type { ContextDatabase } from "./db.js";
import { buildContextServer } from "./http.js";
import { registerMultimodalRoutes } from "./multimodal-routes.js";
import type { ContextRepository } from "./repository.js";
import { makeRepo } from "./test-helpers.js";

let db: ContextDatabase;
let repo: ContextRepository;
let app: FastifyInstance;

const payload = {
  operationId: "op_multiderivation001",
  sourceArtifactId: "art_source001",
  episodeId: "epi_source001",
  task: "ocr",
  result: {
    routeUsed: "local",
    adapter: "ocr-local-v1",
    provider: "local",
    model: "ocr-model-20260910",
    language: "id",
    text: "Nomor invoice 123",
    segments: [
      {
        text: "Nomor invoice 123",
        page: 1,
        boundingBox: { x: 0.1, y: 0.2, width: 0.5, height: 0.1 },
        confidence: 0.97,
        language: "id",
      },
    ],
    actualUsd: 0,
    naiveUsd: 0,
  },
  scope: "personal",
  sensitivity: "INTERNAL",
  syncClass: "LOCAL_ONLY",
  trust: "LOCAL_AGENT",
  createdAt: "2026-09-10T00:00:00.000Z",
} as const;

beforeEach(() => {
  ({ db, repo } = makeRepo());
  app = buildContextServer(repo, undefined);
  registerMultimodalRoutes(app, repo);
});

afterEach(async () => {
  await app.close();
  db.close();
});

describe("Context multimodal derivations", () => {
  it("persists OCR page/bbox/confidence metadata and reads it back", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/v1/multimodal/derivations",
      payload,
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().result.segments[0]).toMatchObject({ page: 1, confidence: 0.97 });

    const read = await app.inject({
      method: "GET",
      url: `/v1/multimodal/derivations/${payload.operationId}`,
    });
    expect(read.statusCode).toBe(200);
    expect(read.json().sourceArtifactId).toBe(payload.sourceArtifactId);
    expect(read.json().result.segments[0].boundingBox).toEqual({
      x: 0.1,
      y: 0.2,
      width: 0.5,
      height: 0.1,
    });
  });

  it("is idempotent for the same operation payload and conflicts on mutation", async () => {
    const first = await app.inject({
      method: "POST",
      url: "/v1/multimodal/derivations",
      payload,
    });
    const retry = await app.inject({
      method: "POST",
      url: "/v1/multimodal/derivations",
      payload,
    });
    expect(first.statusCode).toBe(201);
    expect(retry.statusCode).toBe(200);

    const conflict = await app.inject({
      method: "POST",
      url: "/v1/multimodal/derivations",
      payload: { ...payload, result: { ...payload.result, text: "changed" } },
    });
    expect(conflict.statusCode).toBe(409);
  });
});
