import { createHash } from "node:crypto";
import {
  MultimodalDerivationSchema,
  MultimodalDerivationWriteSchema,
  OperationIdSchema,
  type MultimodalDerivation,
} from "@ecorione/shared-schema";
import { ConflictError, NotFoundError, parseOrBadRequest } from "@ecorione/shared-server";
import type { FastifyInstance } from "fastify";
import type { ContextRepository } from "./repository.js";

interface DerivationRow {
  operation_id: string;
  fingerprint: string;
  payload_json: string;
}

function fingerprint(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function registerMultimodalRoutes(app: FastifyInstance, repo: ContextRepository): void {
  const db = repo.db.raw;
  db.exec(`
    CREATE TABLE IF NOT EXISTS multimodal_derivations (
      operation_id TEXT PRIMARY KEY,
      fingerprint TEXT NOT NULL,
      source_artifact_id TEXT NOT NULL,
      episode_id TEXT NOT NULL,
      task TEXT NOT NULL CHECK(task IN ('ocr','vision','transcribe')),
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_multimodal_derivations_source
      ON multimodal_derivations(source_artifact_id, created_at);
  `);

  app.post("/v1/multimodal/derivations", async (req, reply) => {
    const body = parseOrBadRequest(MultimodalDerivationWriteSchema, req.body);
    const payloadJson = JSON.stringify(body);
    const digest = fingerprint(body);
    const existing = db
      .prepare(
        "SELECT operation_id,fingerprint,payload_json FROM multimodal_derivations WHERE operation_id=?",
      )
      .get(body.operationId) as DerivationRow | undefined;
    if (existing !== undefined) {
      if (existing.fingerprint !== digest) {
        throw new ConflictError(
          `Derivasi multimodal ${body.operationId} sudah ada dengan payload berbeda.`,
        );
      }
      return MultimodalDerivationSchema.parse(JSON.parse(existing.payload_json) as unknown);
    }
    db.prepare(
      `INSERT INTO multimodal_derivations(
        operation_id,fingerprint,source_artifact_id,episode_id,task,payload_json,created_at
      ) VALUES(?,?,?,?,?,?,?)`,
    ).run(
      body.operationId,
      digest,
      body.sourceArtifactId,
      body.episodeId,
      body.task,
      payloadJson,
      body.createdAt,
    );
    return reply.code(201).send(body);
  });

  app.get<{ Params: { operationId: string } }>(
    "/v1/multimodal/derivations/:operationId",
    async (req) => {
      const operationId = parseOrBadRequest(OperationIdSchema, req.params.operationId);
      const row = db
        .prepare(
          "SELECT operation_id,fingerprint,payload_json FROM multimodal_derivations WHERE operation_id=?",
        )
        .get(operationId) as DerivationRow | undefined;
      if (row === undefined)
        throw new NotFoundError(`Derivasi multimodal tidak ditemukan: ${operationId}.`);
      return MultimodalDerivationSchema.parse(
        JSON.parse(row.payload_json) as MultimodalDerivation,
      );
    },
  );
}
