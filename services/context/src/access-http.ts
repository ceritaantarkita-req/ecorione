import {
  MemoryFactIdSchema,
  ScopeSchema,
  SensitivitySchema,
  maySendToHosted,
  sensitivityRank,
} from "@ecorione/shared-schema";
import { NotFoundError, parseOrBadRequest } from "@ecorione/shared-server";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ContextRepository } from "./repository.js";

const BoolQuery = z
  .enum(["0", "1"])
  .optional()
  .transform((value) => value === "1");
const FactGrantQuerySchema = z.object({
  scope: ScopeSchema,
  maxSensitivity: SensitivitySchema.default("RESTRICTED"),
  hostedEligible: BoolQuery,
});

export function registerAccessRoutes(app: FastifyInstance, repo: ContextRepository): void {
  app.get<{ Params: { id: string } }>("/v1/access/facts/:id", async (req) => {
    const id = parseOrBadRequest(MemoryFactIdSchema, req.params.id);
    const grant = parseOrBadRequest(FactGrantQuerySchema, req.query);
    const fact = repo.getFact(id);
    if (
      fact === null ||
      fact.scope !== grant.scope ||
      sensitivityRank(fact.sensitivity) > sensitivityRank(grant.maxSensitivity) ||
      (grant.hostedEligible && !maySendToHosted(fact.syncClass))
    ) {
      throw new NotFoundError("Fakta tidak tersedia untuk grant ini.");
    }
    return fact;
  });
}
