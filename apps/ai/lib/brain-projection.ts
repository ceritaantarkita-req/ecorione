import { createHash } from "node:crypto";
import { z } from "zod";
import {
  BrainGraphResponseSchema,
  FlowGraphSummarySchema,
  ProjectSchema,
  ProjectSourceListResponseSchema,
  RunListResponseSchema,
  TriggerDefinitionSchema,
  type BrainEdge,
  type BrainGraphResponse,
  type BrainNode,
  type BrainNodeType,
  type BrainQuery,
  type FlowGraphSummary,
  type Project,
  type ProjectSourceView,
  type RunListItem,
  type TriggerDefinition,
} from "@ecorione/shared-schema";
import { flowUrl, hubUrl, internalToken } from "./env";

const FlowListResponseSchema = z.object({ graphs: z.array(FlowGraphSummarySchema) }).strict();
const TriggerListResponseSchema = z
  .object({ triggers: z.array(TriggerDefinitionSchema) })
  .strict();

export class BrainOwnerRequestError extends Error {
  constructor(
    readonly owner: "HubProject" | "HubSources" | "Flow",
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

type BrainOwnerSnapshot = {
  project: Project;
  sources: ProjectSourceView[];
  graphs: FlowGraphSummary[];
  triggers: TriggerDefinition[];
  runs: RunListItem[];
};

function requestHeaders(): Record<string, string> {
  const token = internalToken();
  return token === undefined ? {} : { authorization: `Bearer ${token}` };
}

async function ownerJson(
  owner: BrainOwnerRequestError["owner"],
  url: string,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: requestHeaders(),
      redirect: "error",
      cache: "no-store",
    });
  } catch {
    throw new BrainOwnerRequestError(owner, 502, `${owner} tidak dapat dihubungi.`);
  }
  if (!response.ok) {
    throw new BrainOwnerRequestError(
      owner,
      response.status,
      `${owner} menolak Brain projection dengan HTTP ${String(response.status)}.`,
    );
  }
  try {
    return await response.json();
  } catch {
    throw new BrainOwnerRequestError(owner, 502, `${owner} mengembalikan JSON tidak valid.`);
  }
}

function exactProject<T extends { workspaceId: string; projectId: string }>(
  rows: readonly T[],
  workspaceId: string,
  projectId: string,
): T[] {
  return rows.filter((row) => row.workspaceId === workspaceId && row.projectId === projectId);
}

async function readOwnerSnapshot(query: BrainQuery): Promise<BrainOwnerSnapshot> {
  // Authorization is deliberately first. No sibling owner is queried until Hub confirms
  // that this Project belongs to the caller Workspace.
  const project = ProjectSchema.parse(
    await ownerJson(
      "HubProject",
      `${hubUrl()}/v1/projects/${encodeURIComponent(query.projectId)}?workspaceId=${encodeURIComponent(query.workspaceId)}`,
    ),
  );
  if (project.workspaceId !== query.workspaceId || project.id !== query.projectId) {
    throw new BrainOwnerRequestError("HubProject", 404, "Project tidak tersedia.");
  }

  const common = new URLSearchParams({
    workspaceId: query.workspaceId,
    projectId: query.projectId,
  });
  const [sourceRaw, graphRaw, triggerRaw, runRaw] = await Promise.all([
    ownerJson(
      "HubSources",
      `${hubUrl()}/v1/projects/${encodeURIComponent(query.projectId)}/sources?workspaceId=${encodeURIComponent(query.workspaceId)}`,
    ),
    ownerJson("Flow", `${flowUrl()}/v1/graphs?${common.toString()}`),
    ownerJson("Flow", `${flowUrl()}/v1/triggers?${common.toString()}`),
    ownerJson(
      "Flow",
      `${flowUrl()}/v1/runs?${common.toString()}&limit=${String(query.runLimit)}`,
    ),
  ]);

  const sourceViews = ProjectSourceListResponseSchema.parse(sourceRaw).sources.filter(
    (view) =>
      view.binding.workspaceId === query.workspaceId &&
      view.binding.projectId === query.projectId,
  );
  const graphs = FlowListResponseSchema.parse(graphRaw).graphs.filter(
    (graph) => graph.workspaceId === query.workspaceId && graph.projectId === query.projectId,
  );
  const triggers = exactProject(
    TriggerListResponseSchema.parse(triggerRaw).triggers,
    query.workspaceId,
    query.projectId,
  );
  const runs = exactProject(
    RunListResponseSchema.parse(runRaw).runs,
    query.workspaceId,
    query.projectId,
  );

  return { project, sources: sourceViews, graphs, triggers, runs };
}

function nodeId(type: BrainNodeType, canonicalId: string): string {
  const digest = createHash("sha256").update(canonicalId).digest("hex");
  return `${type.toLowerCase()}:${digest}`;
}

function sourceCanonical(view: ProjectSourceView): string {
  const { resourceType, resourceId, role } = view.binding;
  return `${resourceType}:${resourceId}:${role}`;
}

function sourceLabel(view: ProjectSourceView): string {
  const raw = view.binding.resourceId;
  const short = raw.length > 88 ? `${raw.slice(0, 85)}…` : raw;
  return `${view.binding.resourceType} · ${short}`;
}

function addEdge(
  edges: Map<string, BrainEdge>,
  type: BrainEdge["type"],
  sourceNodeId: string,
  targetNodeId: string,
): void {
  const id = `${type}:${sourceNodeId}->${targetNodeId}`;
  edges.set(id, { id, type, sourceNodeId, targetNodeId });
}

const TYPE_ORDER: Record<BrainNodeType, number> = {
  Project: 0,
  Source: 1,
  Flow: 2,
  Trigger: 3,
  Run: 4,
};

function compareNode(a: BrainNode, b: BrainNode): number {
  return TYPE_ORDER[a.type] - TYPE_ORDER[b.type] || a.id.localeCompare(b.id);
}

export function buildBrainGraph(
  query: BrainQuery,
  snapshot: BrainOwnerSnapshot,
): BrainGraphResponse {
  const nodes = new Map<string, BrainNode>();
  const edges = new Map<string, BrainEdge>();
  const projectNodeId = nodeId("Project", snapshot.project.id);

  nodes.set(projectNodeId, {
    id: projectNodeId,
    type: "Project",
    canonicalId: snapshot.project.id,
    owner: "Hub",
    label: snapshot.project.name,
    workspaceId: query.workspaceId,
    projectId: query.projectId,
    availability: "AVAILABLE",
    href: "/projects",
    metadata: {
      archived: snapshot.project.archivedAt !== null,
      autonomyCeiling: snapshot.project.autonomyCeiling,
      memoryPolicy: snapshot.project.memoryPolicy,
    },
  });

  for (const view of [...snapshot.sources].sort((a, b) =>
    sourceCanonical(a).localeCompare(sourceCanonical(b)),
  )) {
    const canonicalId = sourceCanonical(view);
    const id = nodeId("Source", canonicalId);
    nodes.set(id, {
      id,
      type: "Source",
      canonicalId,
      owner: view.binding.owner,
      label: sourceLabel(view),
      workspaceId: query.workspaceId,
      projectId: query.projectId,
      availability: view.availability,
      href: "/projects",
      metadata: {
        resourceType: view.binding.resourceType,
        resourceId: view.binding.resourceId,
        role: view.binding.role,
        unavailableReason:
          view.availability === "UNAVAILABLE"
            ? (view.unavailableReason ?? "unavailable")
            : null,
      },
    });
    addEdge(edges, "BELONGS_TO", id, projectNodeId);
  }

  const graphIds = new Set<string>();
  for (const graph of [...snapshot.graphs].sort((a, b) => a.graphId.localeCompare(b.graphId))) {
    const id = nodeId("Flow", graph.graphId);
    graphIds.add(graph.graphId);
    nodes.set(id, {
      id,
      type: "Flow",
      canonicalId: graph.graphId,
      owner: "Flow",
      label: graph.name,
      workspaceId: query.workspaceId,
      projectId: query.projectId,
      availability: "AVAILABLE",
      href: `/flow?graph=${encodeURIComponent(graph.graphId)}&version=${String(graph.currentVersion)}`,
      metadata: {
        version: graph.currentVersion,
        scope: graph.scope,
        sensitivity: graph.sensitivity,
      },
    });
    addEdge(edges, "BELONGS_TO", id, projectNodeId);
  }

  for (const view of snapshot.sources) {
    if (view.binding.resourceType !== "flow-graph" || !graphIds.has(view.binding.resourceId)) {
      continue;
    }
    addEdge(
      edges,
      "REFERENCES",
      nodeId("Source", sourceCanonical(view)),
      nodeId("Flow", view.binding.resourceId),
    );
  }

  const triggerIds = new Set<string>();
  for (const trigger of [...snapshot.triggers].sort((a, b) => a.id.localeCompare(b.id))) {
    const id = nodeId("Trigger", trigger.id);
    triggerIds.add(trigger.id);
    nodes.set(id, {
      id,
      type: "Trigger",
      canonicalId: trigger.id,
      owner: "Flow",
      label: trigger.name,
      workspaceId: query.workspaceId,
      projectId: query.projectId,
      availability: "AVAILABLE",
      href: "/work",
      metadata: {
        kind: trigger.kind,
        graphVersion: trigger.graphVersion,
        enabled: trigger.enabled,
        versionPolicy: trigger.versionPolicy,
      },
    });
    addEdge(edges, "BELONGS_TO", id, projectNodeId);
    if (graphIds.has(trigger.graphId)) {
      addEdge(edges, "USES", id, nodeId("Flow", trigger.graphId));
    }
  }

  for (const run of [...snapshot.runs].sort((a, b) =>
    a.operationId.localeCompare(b.operationId),
  )) {
    const id = nodeId("Run", run.operationId);
    nodes.set(id, {
      id,
      type: "Run",
      canonicalId: run.operationId,
      owner: "Flow",
      label: `${run.status} · ${run.operationId}`,
      workspaceId: query.workspaceId,
      projectId: query.projectId,
      availability: "AVAILABLE",
      href: "/work",
      metadata: {
        status: run.status,
        graphVersion: run.graphVersion,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        triggerId: run.triggerId,
      },
    });
    addEdge(edges, "BELONGS_TO", id, projectNodeId);
    if (graphIds.has(run.graphId)) {
      addEdge(edges, "EXECUTED", id, nodeId("Flow", run.graphId));
    }
    if (run.triggerId !== null && triggerIds.has(run.triggerId)) {
      addEdge(edges, "TRIGGERED", nodeId("Trigger", run.triggerId), id);
    }
  }

  const allNodes = [...nodes.values()].sort(compareNode);
  const allEdges = [...edges.values()].sort((a, b) => a.id.localeCompare(b.id));
  const visibleNodes = allNodes.slice(0, query.limit);
  const visibleIds = new Set(visibleNodes.map((node) => node.id));
  const edgeLimit = Math.min(500, query.limit * 4);
  const visibleEdges = allEdges
    .filter((edge) => visibleIds.has(edge.sourceNodeId) && visibleIds.has(edge.targetNodeId))
    .slice(0, edgeLimit);

  return BrainGraphResponseSchema.parse({
    workspaceId: query.workspaceId,
    projectId: query.projectId,
    nodes: visibleNodes,
    edges: visibleEdges,
    totalNodes: allNodes.length,
    totalEdges: allEdges.length,
    truncated:
      visibleNodes.length !== allNodes.length || visibleEdges.length !== allEdges.length,
  });
}

export async function queryBrainGraph(query: BrainQuery): Promise<BrainGraphResponse> {
  return buildBrainGraph(query, await readOwnerSnapshot(query));
}
