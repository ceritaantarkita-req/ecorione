import { OperationIdSchema, TimestampSchema } from "@ecorione/shared-schema";
import {
  BadRequestError,
  ConflictError,
  HttpError,
  NotFoundError,
  parseOrBadRequest,
} from "@ecorione/shared-server";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  MAINTENANCE_ACTIONS,
  MaintenanceConflictError,
  MaintenanceError,
  MaintenanceIntegrityError,
  MaintenanceSnapshotError,
  type ContextMaintenanceEngine,
  type MaintenanceAction,
  type MaintenancePlan,
} from "./maintenance.js";

const MaintenanceActionSchema = z.enum(MAINTENANCE_ACTIONS);
const PlanBodySchema = z.object({
  operationId: OperationIdSchema,
  actions: z.array(MaintenanceActionSchema).min(1),
  now: TimestampSchema,
});
const ExecuteBodySchema = z.object({ plan: z.unknown() });
const RollbackBodySchema = z.object({
  operationId: OperationIdSchema,
  sourceReceiptId: z.string().min(1).max(128),
  now: TimestampSchema,
});
const ReceiptParamsSchema = z.object({ id: z.string().min(1).max(128) });
const ReceiptQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

function parsePlan(value: unknown): MaintenancePlan {
  if (typeof value !== "object" || value === null) {
    throw new BadRequestError("Maintenance plan harus object.");
  }
  const plan = value as Partial<MaintenancePlan>;
  if (
    plan.schema !== "ecorione.context-maintenance/v1" ||
    typeof plan.operationId !== "string" ||
    typeof plan.generatedAt !== "string" ||
    !Array.isArray(plan.actions) ||
    typeof plan.sourceDigest !== "string" ||
    typeof plan.projectionDigest !== "string" ||
    typeof plan.planDigest !== "string" ||
    typeof plan.migration !== "object" ||
    plan.migration === null ||
    typeof plan.findings !== "object" ||
    plan.findings === null ||
    typeof plan.diff !== "object" ||
    plan.diff === null
  ) {
    throw new BadRequestError("Maintenance plan tidak cocok contract v1.");
  }
  const actions = z
    .array(MaintenanceActionSchema)
    .min(1)
    .parse(plan.actions) as MaintenanceAction[];
  const operationId = OperationIdSchema.parse(plan.operationId);
  const generatedAt = TimestampSchema.parse(plan.generatedAt);
  return { ...plan, operationId, generatedAt, actions } as MaintenancePlan;
}

function mapMaintenanceError(error: unknown): unknown {
  if (error instanceof MaintenanceConflictError) return new ConflictError(error.message);
  if (error instanceof MaintenanceIntegrityError) {
    return new HttpError(500, "CONTEXT_INTEGRITY_ERROR", error.message);
  }
  if (error instanceof MaintenanceSnapshotError || error instanceof MaintenanceError) {
    return new BadRequestError(error.message);
  }
  return error;
}

export function registerMaintenanceRoutes(
  app: FastifyInstance,
  maintenance: ContextMaintenanceEngine,
): void {
  app.post("/v1/maintenance/plan", async (req) => {
    const body = parseOrBadRequest(PlanBodySchema, req.body);
    try {
      return maintenance.plan({
        operationId: body.operationId,
        actions: body.actions,
        now: body.now,
      });
    } catch (error) {
      throw mapMaintenanceError(error);
    }
  });

  app.post("/v1/maintenance/execute", async (req) => {
    const body = parseOrBadRequest(ExecuteBodySchema, req.body);
    try {
      return await maintenance.execute(parsePlan(body.plan));
    } catch (error) {
      throw mapMaintenanceError(error);
    }
  });

  app.post("/v1/maintenance/rollback", async (req) => {
    const body = parseOrBadRequest(RollbackBodySchema, req.body);
    try {
      return await maintenance.rollback(body);
    } catch (error) {
      throw mapMaintenanceError(error);
    }
  });

  app.get("/v1/maintenance/verify", async () => {
    try {
      return maintenance.verify();
    } catch (error) {
      throw mapMaintenanceError(error);
    }
  });

  app.get("/v1/maintenance/receipts", async (req) => {
    const query = parseOrBadRequest(ReceiptQuerySchema, req.query);
    return { receipts: maintenance.listReceipts(query.limit) };
  });

  app.get<{ Params: { id: string } }>("/v1/maintenance/receipts/:id", async (req) => {
    const params = parseOrBadRequest(ReceiptParamsSchema, req.params);
    const receipt = maintenance.getReceipt(params.id);
    if (receipt === null) throw new NotFoundError("Maintenance receipt tidak ditemukan.");
    return receipt;
  });
}
