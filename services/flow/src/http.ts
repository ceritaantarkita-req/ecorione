import {
  FlowDecisionRequestSchema,
  FlowGraphCreateRequestSchema,
  FlowGraphDecisionRequestSchema,
  FlowGraphDocumentSchema,
  FlowGraphHumanInputRequestSchema,
  FlowGraphIdSchema,
  FlowGraphRunRequestSchema,
  FlowGraphRunResponseSchema,
  FlowGraphUpdateRequestSchema,
  FlowIdSchema,
  FlowNodeIdSchema,
  FlowStartRequestSchema,
  FlowStartResponseSchema,
  FlowWorkflowInputSchema,
  WorkspaceIdSchema,
  assertId,
  makeId,
  type FlowApprovalSignal,
  type FlowGraphDocument,
  type OperationId,
  type Timestamp,
} from "@ecorione/shared-schema";
import {
  BadRequestError,
  ConflictError,
  HttpError,
  NotFoundError,
  createServer,
  httpJson,
  parseOrBadRequest,
} from "@ecorione/shared-server";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { nowIso } from "./clock.js";
import { openFlowDatabase } from "./db.js";
import {
  FlowGraphNotFoundError,
  FlowGraphRepository,
  FlowGraphVersionConflictError,
  FlowGraphWorkspaceConflictError,
} from "./graph-repository.js";
import {
  digestCanonical,
  listCoreNodeDefinitions,
  validateAndCompileFlowGraph,
} from "./node-registry.js";
import type { FlowGraphTemporalClient, FlowServerTemporalClient } from "./temporal-client.js";

export interface BuildFlowServerOptions {
  readonly hubUrl: string;
  readonly token?: string | undefined;
  readonly logger?: boolean | undefined;
  readonly graphRepository?: FlowGraphRepository | undefined;
}

const GraphListQuerySchema = z.object({ workspaceId: WorkspaceIdSchema.optional() });
const GraphVersionQuerySchema = z.object({
  version: z.coerce.number().int().min(1).optional(),
});
const GraphParamsSchema = z.object({ id: FlowGraphIdSchema });
const RunParamsSchema = z.object({ id: FlowIdSchema });
const NodeRunParamsSchema = z.object({ id: FlowIdSchema, nodeId: FlowNodeIdSchema });

function graphError(error: unknown): unknown {
  if (error instanceof FlowGraphNotFoundError) return new NotFoundError(error.message);
  if (
    error instanceof FlowGraphVersionConflictError ||
    error instanceof FlowGraphWorkspaceConflictError
  )
    return new ConflictError(error.message);
  return error;
}
function requireGraphTemporal(temporal: FlowServerTemporalClient): FlowGraphTemporalClient {
  if (
    temporal.startGraph === undefined ||
    temporal.signalGraphDecision === undefined ||
    temporal.signalGraphInput === undefined ||
    temporal.graphState === undefined
  ) {
    throw new HttpError(
      503,
      "FLOW_GRAPH_RUNTIME_UNAVAILABLE",
      "Temporal graph runtime tidak dikonfigurasi.",
    );
  }
  return temporal as FlowServerTemporalClient & FlowGraphTemporalClient;
}
function newGraphId(): string {
  return `fg_${makeId("workflow").slice("wf_".length)}`;
}
async function syncNodeDeclarations(
  options: BuildFlowServerOptions,
  workspaceId: string,
): Promise<void> {
  await httpJson(`${options.hubUrl}/v1/authority/nodes/sync`, {
    method: "POST",
    token: options.token,
    body: { workspaceId, definitions: listCoreNodeDefinitions() },
  });
}

export function buildFlowServer(
  temporal: FlowServerTemporalClient,
  options: BuildFlowServerOptions,
): FastifyInstance {
  const app = createServer({ name: "flow", token: options.token, logger: options.logger });
  const ownedDb = options.graphRepository === undefined ? openFlowDatabase(":memory:") : null;
  const graphs = options.graphRepository ?? new FlowGraphRepository(ownedDb!);
  if (ownedDb !== null) app.addHook("onClose", async () => ownedDb.close());

  app.post("/v1/flows", async (req, reply) => {
    const body = parseOrBadRequest(FlowStartRequestSchema, req.body);
    const flowId = makeId("workflow");
    const operationId = makeId("operation");
    const input = FlowWorkflowInputSchema.parse({ ...body, flowId, operationId });
    await temporal.start(input);
    return reply
      .code(202)
      .send(FlowStartResponseSchema.parse({ flowId, operationId, temporalWorkflowId: flowId }));
  });

  app.get<{ Params: { id: string } }>("/v1/flows/:id", async (req) => {
    const flowId = parseOrBadRequest(FlowIdSchema, req.params.id);
    const description = await temporal.describe(flowId);
    return { flowId, status: description.status };
  });

  app.post<{ Params: { id: string } }>("/v1/flows/:id/decision", async (req) => {
    const flowId = parseOrBadRequest(FlowIdSchema, req.params.id);
    const body = parseOrBadRequest(FlowDecisionRequestSchema, req.body);
    const approvalKey = `${flowId}:human-approval`;
    const approval = await httpJson<{ operationId: OperationId }>(
      `${options.hubUrl}/v1/approvals/by-idempotency-key?idempotencyKey=${encodeURIComponent(approvalKey)}`,
      { token: options.token },
    );
    const operationId = assertId("operation", approval.operationId);
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

  app.get("/v1/nodes", async () => ({ nodes: listCoreNodeDefinitions() }));

  app.get("/v1/graphs", async (req) => {
    const query = parseOrBadRequest(GraphListQuerySchema, req.query);
    return { graphs: graphs.list(query.workspaceId) };
  });

  app.post("/v1/graphs/validate", async (req) => {
    const graph = parseOrBadRequest(FlowGraphDocumentSchema, req.body);
    return validateAndCompileFlowGraph(graph, 1, digestCanonical(graph));
  });

  app.post("/v1/graphs", async (req, reply) => {
    const body = parseOrBadRequest(FlowGraphCreateRequestSchema, req.body);
    await syncNodeDeclarations(options, body.workspaceId);
    const graph = FlowGraphDocumentSchema.parse({ id: newGraphId(), ...body });
    try {
      return reply.code(201).send(graphs.create(graph, nowIso() as Timestamp));
    } catch (error) {
      throw graphError(error);
    }
  });

  app.get<{ Params: { id: string } }>("/v1/graphs/:id", async (req) => {
    const { id } = parseOrBadRequest(GraphParamsSchema, req.params);
    const query = parseOrBadRequest(GraphVersionQuerySchema, req.query);
    try {
      return graphs.get(id, query.version);
    } catch (error) {
      throw graphError(error);
    }
  });

  app.put<{ Params: { id: string } }>("/v1/graphs/:id", async (req) => {
    const { id } = parseOrBadRequest(GraphParamsSchema, req.params);
    const body = parseOrBadRequest(FlowGraphUpdateRequestSchema, req.body);
    await syncNodeDeclarations(options, body.workspaceId);
    const { expectedVersion, ...fields } = body;
    const graph: FlowGraphDocument = FlowGraphDocumentSchema.parse({ id, ...fields });
    try {
      return graphs.save(graph, expectedVersion, nowIso() as Timestamp);
    } catch (error) {
      throw graphError(error);
    }
  });

  app.get<{ Params: { id: string } }>("/v1/graphs/:id/versions", async (req) => {
    const { id } = parseOrBadRequest(GraphParamsSchema, req.params);
    try {
      return { versions: graphs.versions(id) };
    } catch (error) {
      throw graphError(error);
    }
  });

  app.post<{ Params: { id: string } }>("/v1/graphs/:id/runs", async (req, reply) => {
    const { id } = parseOrBadRequest(GraphParamsSchema, req.params);
    const body = parseOrBadRequest(FlowGraphRunRequestSchema, req.body);
    let graphVersion;
    try {
      graphVersion = graphs.get(id, body.version);
    } catch (error) {
      throw graphError(error);
    }
    if (!graphVersion.validation.valid || graphVersion.validation.plan === null)
      throw new BadRequestError("Graph version tidak valid dan tidak dapat dijalankan.");
    const graphTemporal = requireGraphTemporal(temporal);
    const runId = makeId("workflow");
    const operationId = makeId("operation");
    await graphTemporal.startGraph({
      runId,
      operationId,
      plan: graphVersion.validation.plan,
      input: body.input,
      depth: 0,
    });
    return reply.code(202).send(
      FlowGraphRunResponseSchema.parse({
        runId,
        graphId: id,
        graphVersion: graphVersion.version,
        temporalWorkflowId: runId,
        traceOperationId: operationId,
        planDigest: graphVersion.validation.plan.planDigest,
      }),
    );
  });

  app.get<{ Params: { id: string } }>("/v1/graph-runs/:id", async (req) => {
    const { id } = parseOrBadRequest(RunParamsSchema, req.params);
    const graphTemporal = requireGraphTemporal(temporal);
    const [description, state] = await Promise.all([
      temporal.describe(id),
      graphTemporal.graphState(id),
    ]);
    return { temporalStatus: description.status, ...state };
  });

  app.post<{ Params: { id: string; nodeId: string } }>(
    "/v1/graph-runs/:id/nodes/:nodeId/decision",
    async (req) => {
      const { id, nodeId } = parseOrBadRequest(NodeRunParamsSchema, req.params);
      const body = parseOrBadRequest(FlowGraphDecisionRequestSchema, req.body);
      const validKeys = new Set([`${id}:${nodeId}:policy`, `${id}:${nodeId}:approval`]);
      if (!validKeys.has(body.approvalKey))
        throw new BadRequestError("approvalKey tidak cocok dengan run/node yang dituju.");
      const approval = await httpJson<{ operationId: OperationId }>(
        `${options.hubUrl}/v1/approvals/by-idempotency-key?idempotencyKey=${encodeURIComponent(body.approvalKey)}`,
        { token: options.token },
      );
      const operationId = assertId("operation", approval.operationId);
      const hubBody: { decision: "APPROVE" | "REJECT"; note?: string } = {
        decision: body.decision,
      };
      if (body.note !== null) hubBody.note = body.note;
      await httpJson(`${options.hubUrl}/v1/approvals/${operationId}/decide`, {
        method: "POST",
        token: options.token,
        body: hubBody,
      });
      await requireGraphTemporal(temporal).signalGraphDecision(id, {
        nodeId,
        decision: body.decision,
        note: body.note,
      });
      return { runId: id, nodeId, operationId, decision: body.decision };
    },
  );

  app.post<{ Params: { id: string; nodeId: string } }>(
    "/v1/graph-runs/:id/nodes/:nodeId/input",
    async (req) => {
      const { id, nodeId } = parseOrBadRequest(NodeRunParamsSchema, req.params);
      const body = parseOrBadRequest(FlowGraphHumanInputRequestSchema, req.body);
      await requireGraphTemporal(temporal).signalGraphInput(id, { nodeId, value: body.value });
      return { runId: id, nodeId, accepted: true };
    },
  );

  return app;
}
