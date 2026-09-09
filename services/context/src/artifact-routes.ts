/** Fase 3 Artifact metadata routes for Context. */
import {
  ArtifactPointerSchema,
  ScopeSchema,
  SensitivitySchema,
  SyncClassSchema,
  SENSITIVITY,
  sensitivityRank,
  type ArtifactPointer,
  type Sensitivity,
} from "@ecorione/shared-schema";
import { BadRequestError, NotFoundError, parseOrBadRequest } from "@ecorione/shared-server";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ContextRepository } from "./repository.js";

const RegisterArtifactBodySchema = ArtifactPointerSchema.extend({
  syncClass: SyncClassSchema.default("LOCAL_ONLY"),
});
const AuthorizeArtifactQuerySchema = z.object({
  scope: ScopeSchema,
  maxSensitivity: SensitivitySchema.default("RESTRICTED"),
  hostedEligible: z.enum(["0", "1"]).optional().transform((v) => v === "1"),
});
const ListBindingsQuerySchema = z.object({
  scope: ScopeSchema,
  maxSensitivity: SensitivitySchema.default("RESTRICTED"),
  hostedEligible: z.enum(["0", "1"]).optional().transform((v) => v === "1"),
});

interface BindingRow {
  id: string;
  path: string;
  description: string;
  mime_type: string;
  size_bytes: number;
  scope: string;
  sensitivity: Sensitivity;
  sync_class: string;
}

function rowToPointer(row: BindingRow): ArtifactPointer {
  return ArtifactPointerSchema.parse({
    id: row.id,
    path: row.path,
    description: row.description,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    scope: row.scope,
    sensitivity: row.sensitivity,
    syncClass: row.sync_class,
  });
}

function allowedSensitivity(max: Sensitivity): Sensitivity[] {
  return SENSITIVITY.filter((s) => sensitivityRank(s) <= sensitivityRank(max));
}

export function registerArtifactRoutes(app: FastifyInstance, repo: ContextRepository): void {
  const db = repo.db.raw;

  app.post("/v1/artifacts", async (req, reply) => {
    const pointer = parseOrBadRequest(RegisterArtifactBodySchema, req.body);
    const syncClass = pointer.syncClass ?? "LOCAL_ONLY";
    db.transaction(() => {
      db.prepare(
        `INSERT INTO artifact_bindings
          (id,path,description,mime_type,size_bytes,scope,sensitivity,sync_class)
         VALUES (@id,@path,@description,@mime_type,@size_bytes,@scope,@sensitivity,@sync_class)
         ON CONFLICT(id,scope,sensitivity,sync_class) DO UPDATE SET
           path=excluded.path,description=excluded.description,mime_type=excluded.mime_type,size_bytes=excluded.size_bytes`,
      ).run({
        id: pointer.id,
        path: pointer.path,
        description: pointer.description,
        mime_type: pointer.mimeType,
        size_bytes: pointer.sizeBytes,
        scope: pointer.scope,
        sensitivity: pointer.sensitivity,
        sync_class: syncClass,
      });

      const legacy = db.prepare("SELECT scope,sensitivity,sync_class FROM artifact_pointers WHERE id=?").get(pointer.id) as
        | { scope: string; sensitivity: string; sync_class: string }
        | undefined;
      if (
        legacy === undefined ||
        (legacy.scope === pointer.scope &&
          legacy.sensitivity === pointer.sensitivity &&
          legacy.sync_class === syncClass)
      ) {
        repo.putArtifactPointer({ ...pointer, syncClass });
      }
    })();
    return reply.code(201).send({ ...pointer, syncClass });
  });

  app.get<{ Params: { id: string } }>("/v1/artifacts/:id/authorize", async (req) => {
    const q = parseOrBadRequest(AuthorizeArtifactQuerySchema, req.query);
    const allowed = allowedSensitivity(q.maxSensitivity);
    if (allowed.length === 0) throw new BadRequestError("maxSensitivity tidak valid.");
    const hosted = q.hostedEligible ? " AND sync_class IN ('CLOUD_ALLOWED','PUBLIC')" : "";
    const placeholders = allowed.map(() => "?").join(",");
    const row = db
      .prepare(
        `SELECT * FROM artifact_bindings
         WHERE id=? AND scope=? AND sensitivity IN (${placeholders})${hosted}
         ORDER BY CASE sensitivity WHEN 'PUBLIC' THEN 0 WHEN 'INTERNAL' THEN 1 WHEN 'SENSITIVE' THEN 2 ELSE 3 END DESC
         LIMIT 1`,
      )
      .get(req.params.id, q.scope, ...allowed) as BindingRow | undefined;
    if (row === undefined) throw new NotFoundError("Artifact tidak tersedia untuk scope/sensitivity pemanggil.");
    return rowToPointer(row);
  });

  app.get("/v1/artifact-bindings", async (req) => {
    const q = parseOrBadRequest(ListBindingsQuerySchema, req.query);
    const allowed = allowedSensitivity(q.maxSensitivity);
    const hosted = q.hostedEligible ? " AND sync_class IN ('CLOUD_ALLOWED','PUBLIC')" : "";
    const placeholders = allowed.map(() => "?").join(",");
    const rows = db
      .prepare(
        `SELECT * FROM artifact_bindings WHERE scope=? AND sensitivity IN (${placeholders})${hosted}
         ORDER BY id ASC,sensitivity ASC,sync_class ASC`,
      )
      .all(q.scope, ...allowed) as BindingRow[];
    return { pointers: rows.map(rowToPointer) };
  });
}
