import {
  FlowDecisionRequestSchema,
  FlowIdSchema,
  FlowStartRequestSchema,
  FlowStartResponseSchema,
  FlowWorkflowInputSchema,
  assertId,
  makeId,
  type FlowApprovalSignal,
} from "@ecorione/shared-schema";
import { createServer, httpJson, parseOrBadRequest } from "@ecorione/shared-server";
import type { FastifyInstance } from "fastify";
import type { FlowTemporalClient } from "./temporal-client.js";

export interface BuildFlowServerOptions {
  readonly hubUrl: string;
  readonly token?: string | undefined;
  readonly logger?: boolean | undefined;
}

export function buildFlowServer(
  temporal: FlowTemporalClient,
  options: BuildFlowServerOptions,
): FastifyInstance {
  const app = createServer({ name: "flow", token: options.token, logger: options.logger });

  app.post("/v1/flows", async (req, reply) => {
    const body = parseOrBadRequest(FlowStartRequestSchema, req.body);
    const flowId = makeId("workflow");
    const operationId = makeId("operation");
    const input = FlowWorkflowInputSchema.parse({ ...body, flowId, operationId });
    await temporal.start(input);
    return reply.code(202).send(
      FlowStartResponseSchema.parse({
        flowId,
        operationId,
        temporalWorkflowId: flowId,
      }),
    );
  });

  app.get<{ Params: { id: string } }>("/v1/flows/:id", async (req) => {
    const flowId = parseOrBadRequest(FlowIdSchema, req.params.id);
    const description = await temporal.describe(flowId);
    return { flowId, status: description.status };
  });

  app.post<{ Params: { id: string } }>("/v1/flows/:id/decision", async (req) => {
    const flowId = parseOrBadRequest(FlowIdSchema, req.params.id);
    const body = parseOrBadRequest(FlowDecisionRequestSchema, req.body);
    const operationId = await temporal.operationId(flowId);
    const hubBody: { decision: "APPROVE" | "REJECT"; note?: string } = {
      decision: body.decision,
    };
    if (body.note !== null) hubBody.note = body.note;
    await httpJson(`${options.hubUrl}/v1/approvals/${operationId}/decide`, {
      method: "POST",
      token: options.token,
      body: hubBody,
    });
    const signal: FlowApprovalSignal = { decision: body.decision, note: body.note };
    await temporal.signal(assertId("workflow", flowId), signal);
    return { flowId, operationId, decision: body.decision };
  });

  return app;
}
