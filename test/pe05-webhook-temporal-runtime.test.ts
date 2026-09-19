import { fileURLToPath } from "node:url";
import { TestWorkflowEnvironment } from "@temporalio/testing";
import { Worker } from "@temporalio/worker";
import { describe, expect, it } from "vitest";
import { createServer } from "../packages/shared-server/src/index.js";
import { buildConnectServer } from "../services/connect/src/http.js";
import { deriveWebhookToken } from "../services/connect/src/webhook-http.js";
import { openFlowDatabase } from "../services/flow/src/db.js";
import { createFlowGraphActivities } from "../services/flow/src/graph-activities.js";
import { FlowGraphRepository } from "../services/flow/src/graph-repository.js";
import { buildFlowServer } from "../services/flow/src/http.js";
import {
  FLOW_GRAPH_WORKFLOW_TYPE,
  type FlowServerTemporalClient,
} from "../services/flow/src/temporal-client.js";
import { TriggerRepository } from "../services/flow/src/trigger-repository.js";
import { openRndDatabase } from "../services/rnd/src/db.js";
import { buildRndServer } from "../services/rnd/src/http.js";

const INTERNAL_TOKEN = "pe05-internal-token";
const ROOT_SECRET = "pe05-webhook-root-secret-acceptance";
const HOOK_ID = "hook_pe05_runtime_001";
const NOW = "2026-09-19T10:30:00.000Z" as never;

interface FastifyLike {
  listen(options: { port: number; host: string }): Promise<string>;
  close(): Promise<void>;
  server: { address(): string | { port: number } | null };
}

async function listen(app: FastifyLike): Promise<string> {
  await app.listen({ host: "127.0.0.1", port: 0 });
  const address = app.server.address();
  if (address === null || typeof address === "string") {
    throw new Error("PE-05 test service address gagal.");
  }
  return `http://127.0.0.1:${String(address.port)}`;
}

function graph() {
  return {
    id: "fg_pe05runtime01",
    workspaceId: "ws_personal",
    projectId: "prj_personal",
    name: "PE-05 webhook target",
    scope: "personal",
    sensitivity: "INTERNAL",
    maxParallelism: 1,
    nodes: [
      {
        id: "node_trigger1",
        kind: "trigger",
        version: 1,
        label: "Webhook input",
        position: { x: 0, y: 0 },
        config: {},
        secretRefs: [],
        limits: {},
        retry: {},
      },
    ],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  } as never;
}

function temporalAdapter(
  env: TestWorkflowEnvironment,
  taskQueue: string,
): FlowServerTemporalClient {
  return {
    async start(): Promise<void> {
      throw new Error("Legacy Flow start tidak dipakai PE-05 acceptance.");
    },
    async signal(): Promise<void> {
      throw new Error("Legacy Flow signal tidak dipakai PE-05 acceptance.");
    },
    async operationId(flowId) {
      return env.client.workflow.getHandle(flowId).query("operationId");
    },
    async describe(flowId) {
      const description = await env.client.workflow.getHandle(flowId).describe();
      return { status: description.status.name };
    },
    async startGraph(input) {
      await env.client.workflow.start(FLOW_GRAPH_WORKFLOW_TYPE, {
        workflowId: input.runId,
        taskQueue,
        args: [input],
      });
    },
    async signalGraphDecision(runId, signal) {
      await env.client.workflow.getHandle(runId).signal("graphNodeDecision", signal);
    },
    async signalGraphInput(runId, signal) {
      await env.client.workflow.getHandle(runId).signal("graphNodeInput", signal);
    },
    async graphState(runId) {
      return env.client.workflow.getHandle(runId).query("graphRunState");
    },
  };
}

async function jsonFetch<T>(
  url: string,
  init: RequestInit = {},
): Promise<{ readonly status: number; readonly body: T }> {
  const response = await fetch(url, init);
  const body = (await response.json()) as T;
  return { status: response.status, body };
}

describe("PE-05 webhook -> Temporal runtime acceptance", () => {
  it.skipIf(process.env.ECORIONE_PHASE4_PROCESS_ACCEPTANCE !== "1")(
    "verifies public delivery, deduplicates it, executes pinned Flow, and rebuilds Run evidence",
    async () => {
      const env = await TestWorkflowEnvironment.createLocal();
      const taskQueue = "pe05-webhook-runtime";
      const flowDb = openFlowDatabase(":memory:");
      const rndDb = openRndDatabase(":memory:");
      const rnd = buildRndServer(rndDb);
      const hub = createServer({ name: "pe05-hub", token: INTERNAL_TOKEN });
      let flow: ReturnType<typeof buildFlowServer> | null = null;
      let connect: ReturnType<typeof buildConnectServer> | null = null;
      let worker: Worker | null = null;
      let workerRun: Promise<void> | null = null;

      hub.get<{ Params: { id: string } }>("/v1/projects/:id", async (req) => ({
        id: req.params.id,
        workspaceId: "ws_personal",
        name: "Personal",
        description: "",
        instruction: "",
        memoryPolicy: "GLOBAL_PLUS_PROJECT",
        autonomyCeiling: "L3",
        createdAt: "2026-09-19T00:00:00.000Z",
        updatedAt: "2026-09-19T00:00:00.000Z",
        archivedAt: null,
      }));
      hub.post("/v1/actions/evaluate", async () => ({
        outcome: "ALLOW",
        reason: "PE-05 acceptance",
      }));
      hub.post("/v1/authority/authorize", async () => ({
        outcome: "ALLOW",
        reason: "PE-05 acceptance",
        grantedPermissionIds: ["node.execute"],
      }));
      hub.get("/v1/audit", async () => ({ events: [] }));

      try {
        const rndUrl = await listen(rnd);
        const hubUrl = await listen(hub);
        const graphs = new FlowGraphRepository(flowDb);
        graphs.create(graph(), NOW);
        const triggers = new TriggerRepository(flowDb);

        const activities = createFlowGraphActivities({
          hubUrl,
          connectUrl: "http://127.0.0.1:1",
          contextUrl: "http://127.0.0.1:1",
          artifactUrl: "http://127.0.0.1:1",
          spaceUrl: "http://127.0.0.1:1",
          sandboxUrl: "http://127.0.0.1:1",
          rndUrl,
          flowUrl: "http://127.0.0.1:1",
          token: INTERNAL_TOKEN,
          httpHostAllowlist: [],
          ownerApiAllowlist: [],
        });
        const workflowsPath = fileURLToPath(
          new URL("../services/flow/src/workflows.ts", import.meta.url),
        );
        worker = await Worker.create({
          connection: env.nativeConnection,
          taskQueue,
          workflowsPath,
          activities,
        });
        workerRun = worker.run();

        flow = buildFlowServer(temporalAdapter(env, taskQueue), {
          hubUrl,
          rndUrl,
          token: INTERNAL_TOKEN,
          graphRepository: graphs,
          triggerRepository: triggers,
        });
        const flowUrl = await listen(flow);

        connect = buildConnectServer({
          token: INTERNAL_TOKEN,
          localBaseUrl: "http://127.0.0.1:1/v1",
          localModelTag: "qwen3:8b-instruct-q4_K_M",
          flowUrl,
          credentialVault: {
            get(provider, purpose) {
              return provider === "webhook" && purpose === "tokens" ? ROOT_SECRET : undefined;
            },
          },
        });
        const connectUrl = await listen(connect);

        const created = await jsonFetch<{ id: string }>(`${flowUrl}/v1/triggers`, {
          method: "POST",
          headers: {
            authorization: `Bearer ${INTERNAL_TOKEN}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            workspaceId: "ws_personal",
            projectId: "prj_personal",
            name: "PE-05 runtime webhook",
            kind: "webhook",
            graphId: "fg_pe05runtime01",
            graphVersion: 1,
            versionPolicy: "PINNED",
            requestedAutonomy: "L2",
            enabled: true,
            configuration: {
              adapter: "generic",
              hookId: HOOK_ID,
              source: "github",
              eventKind: "push",
            },
          }),
        });
        expect(created.status).toBe(201);

        const tokenResponse = await jsonFetch<{ hookId: string; token: string }>(
          `${connectUrl}/v1/settings/webhooks/${HOOK_ID}/token`,
          { headers: { authorization: `Bearer ${INTERNAL_TOKEN}` } },
        );
        expect(tokenResponse.status).toBe(200);
        expect(tokenResponse.body).toEqual({
          hookId: HOOK_ID,
          token: deriveWebhookToken(ROOT_SECRET, HOOK_ID),
        });

        const unauthenticated = await jsonFetch<{ error: { type: string } }>(
          `${connectUrl}/v1/webhooks/${HOOK_ID}`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              deliveryId: "delivery-runtime-001",
              payload: { ref: "refs/heads/main" },
            }),
          },
        );
        expect(unauthenticated.status).toBe(401);
        expect(unauthenticated.body.error.type).toBe("WEBHOOK_UNAUTHORIZED");

        const deliveryBody = {
          deliveryId: "delivery-runtime-001",
          occurredAt: "2026-09-19T10:31:00.000Z",
          payload: { ref: "refs/heads/main", after: "abc123" },
          metadata: { provider: "acceptance" },
        };
        const first = await jsonFetch<{
          triggerId: string;
          workflowId: string;
          operationId: string;
          graphVersion: number;
          deduplicated: boolean;
        }>(`${connectUrl}/v1/webhooks/${HOOK_ID}`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-ecorione-webhook-token": tokenResponse.body.token,
          },
          body: JSON.stringify(deliveryBody),
        });
        expect(first.status).toBe(200);
        expect(first.body).toMatchObject({
          triggerId: created.body.id,
          graphVersion: 1,
          deduplicated: false,
        });

        const handle = env.client.workflow.getHandle(first.body.workflowId);
        const result = (await handle.result()) as { output: unknown };
        expect(result.output).toEqual(deliveryBody.payload);

        const duplicate = await jsonFetch<typeof first.body>(
          `${connectUrl}/v1/webhooks/${HOOK_ID}`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-ecorione-webhook-token": tokenResponse.body.token,
            },
            body: JSON.stringify(deliveryBody),
          },
        );
        expect(duplicate.status).toBe(200);
        expect(duplicate.body).toMatchObject({
          workflowId: first.body.workflowId,
          operationId: first.body.operationId,
          deduplicated: true,
        });

        const run = await jsonFetch<{
          operationId: string;
          triggerId: string | null;
          projectId: string;
          graphVersion: number;
          status: string;
          output: unknown;
          availability: { temporal: boolean; rnd: boolean; hubAudit: boolean };
        }>(
          `${flowUrl}/v1/runs/${encodeURIComponent(first.body.operationId)}?workspaceId=ws_personal&projectId=prj_personal`,
          { headers: { authorization: `Bearer ${INTERNAL_TOKEN}` } },
        );
        expect(run.status).toBe(200);
        expect(run.body).toMatchObject({
          operationId: first.body.operationId,
          triggerId: created.body.id,
          projectId: "prj_personal",
          graphVersion: 1,
          status: "COMPLETED",
          output: deliveryBody.payload,
          availability: {
            temporal: true,
            rnd: true,
            hubAudit: true,
          },
        });
      } finally {
        if (worker !== null) worker.shutdown();
        if (workerRun !== null) await workerRun.catch(() => undefined);
        if (connect !== null) await connect.close();
        if (flow !== null) await flow.close();
        await hub.close();
        await rnd.close();
        flowDb.close();
        rndDb.close();
        await env.teardown();
      }
    },
    120_000,
  );
});
