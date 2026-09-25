import { createHash } from "node:crypto";
import { z } from "zod";
import {
  BrainGraphResponseSchema,
  BrainNeighborhoodResponseSchema,
  FlowGraphSummarySchema,
  MemoryFactSchema,
  ProjectSchema,
  ProjectSourceListResponseSchema,
  RunListResponseSchema,
  TriggerDefinitionSchema,
  type BrainEdge,
  type BrainGraphResponse,
  type BrainNeighborhoodQuery,
  type BrainNeighborhoodResponse,
  type BrainNode,
  type BrainNodeType,
  type BrainQuery,
  type FlowGraphSummary,
  type MemoryFact,
  type Project,
  type ProjectSourceView,
  type RunListItem,
  type TriggerDefinition,
} from "@ecorione/shared-schema";

const FlowListResponseSchema = z.object({ graphs: z.array(FlowGraphSummarySchema) }).strict();
const TriggerListResponseSchema = z
  .object({ triggers: z.array(TriggerDefinitionSchema) })
  .strict();
const FactListResponseSchema = z.object({ facts: z.array(MemoryFactSchema).max(500) }).strict();

const DEFAULT_CONTEXT_URL = "http://127.0.0.1:17022";
const DEFAULT_HUB_URL = "http://127.0.0.1:17024";
const DEFAULT_FLOW_URL = "http://127.0.0.1:17028";
const BRAIN_OWNER_TIMEOUT_MS = 10_000;
const BRAIN_FACT_LIMIT = 40;

function ownerBaseUrl(
  name: "ECORIONE_CONTEXT_URL" | "ECORIONE_HUB_URL" | "ECORIONE_FLOW_URL",
  fallback: string,
): string {
  const value = process.env[name];
  return value !== undefined && value.length > 0 ? value : fallback;
}

function brainContextUrl(): string {
  return ownerBaseUrl("ECORIONE_CONTEXT_URL", DEFAULT_CONTEXT_URL);
}

function brainHubUrl(): string {
  return ownerBaseUrl("ECORIONE_HUB_URL", DEFAULT_HUB_URL);
}

function brainFlowUrl(): string {
  return ownerBaseUrl("ECORIONE_FLOW_URL", DEFAULT_FLOW_URL);
}

function brainInternalToken(): string | undefined {
  const value = process.env.ECORIONE_INTERNAL_TOKEN;
  return value !== undefined && value.length > 0 ? value : undefined;
}

export class BrainOwnerRequestError extends Error {
  constructor(
    readonly owner: "HubProject" | "HubSources" | "Flow" | "Context",
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
  facts?: MemoryFact[];
};

function requestHeaders(): Record<string, string> {
  const token = brainInternalToken();
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
      signal: AbortSignal.timeout(BRAIN_OWNER_TIMEOUT_MS),
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

export async function authorizeBrainProject(input: {
  readonly workspaceId: string;
  readonly projectId: string;
}): Promise<Project> {
  const project = ProjectSchema.parse(
    await ownerJson(
      "HubProject",
      `${brainHubUrl()}/v1/projects/${encodeURIComponent(input.projectId)}?workspaceId=${encodeURIComponent(input.workspaceId)}`,
    ),
  );
  if (project.workspaceId !== input.workspaceId || project.id !== input.projectId) {
    throw new BrainOwnerRequestError("HubProject", 404, "Project tidak tersedia.");
  }
  return project;
}

async function readOwnerSnapshot(query: BrainQuery): Promise<BrainOwnerSnapshot> {
  // Authorization is deliberately first. No sibling owner is queried until Hub confirms
  // that this Project belongs to the caller Workspace.
  const project = await authorizeBrainProject(query);

  const common = new URLSearchParams({
    workspaceId: query.workspaceId,
    projectId: query.projectId,
  });
  const factQuery = new URLSearchParams({
    projectId: query.projectId,
    maxSensitivity: "RESTRICTED",
    limit: String(Math.min(BRAIN_FACT_LIMIT, query.limit)),
  });
  const [sourceRaw, graphRaw, triggerRaw, runRaw, factRaw] = await Promise.all([
    ownerJson(
      "HubSources",
      `${brainHubUrl()}/v1/projects/${encodeURIComponent(query.projectId)}/sources?workspaceId=${encodeURIComponent(query.workspaceId)}`,
    ),
    ownerJson("Flow", `${brainFlowUrl()}/v1/graphs?${common.toString()}`),
    ownerJson("Flow", `${brainFlowUrl()}/v1/triggers?${common.toString()}`),
    ownerJson(
      "Flow",
      `${brainFlowUrl()}/v1/runs?${common.toString()}&limit=${String(query.runLimit)}`,
    ),
    ownerJson("Context", `${brainContextUrl()}/v1/facts?${factQuery.toString()}`),
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
  const facts = FactListResponseSchema.parse(factRaw).facts;
  if (facts.some((fact) => fact.projectId !== query.projectId)) {
    throw new BrainOwnerRequestError(
      "Context",
      502,
      "Context mengembalikan fakta di luar Project yang diotorisasi.",
    );
  }

  return { project, sources: sourceViews, graphs, triggers, runs, facts };
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

function metadataObject(view: ProjectSourceView): Record<string, unknown> | null {
  return typeof view.metadata === "object" && view.metadata !== null
    ? (view.metadata as Record<string, unknown>)
    : null;
}

function metadataString(view: ProjectSourceView, key: string): string | null {
  const value = metadataObject(view)?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function metadataNumber(view: ProjectSourceView, key: string): number | null {
  const value = metadataObject(view)?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
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
  Artifact: 2,
  Page: 3,
  Flow: 4,
  Trigger: 5,
  Run: 6,
  Fact: 7,
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

    if (view.binding.resourceType === "artifact") {
      const resourceId = view.binding.resourceId;
      const resourceNodeId = nodeId("Artifact", resourceId);
      nodes.set(resourceNodeId, {
        id: resourceNodeId,
        type: "Artifact",
        canonicalId: resourceId,
        owner: "Artifact",
        label: metadataString(view, "description") ?? resourceId,
        workspaceId: query.workspaceId,
        projectId: query.projectId,
        availability: view.availability,
        href: "/projects",
        metadata: {
          mimeType: metadataString(view, "mimeType"),
          sizeBytes: metadataNumber(view, "sizeBytes"),
          scope: metadataString(view, "scope"),
          sensitivity: metadataString(view, "sensitivity"),
          syncClass: metadataString(view, "syncClass"),
          unavailableReason:
            view.availability === "UNAVAILABLE"
              ? (view.unavailableReason ?? "unavailable")
              : null,
        },
      });
      addEdge(edges, "BELONGS_TO", resourceNodeId, projectNodeId);
      addEdge(edges, "REFERENCES", id, resourceNodeId);
    }

    if (view.binding.resourceType === "space-page") {
      const resourceId = view.binding.resourceId;
      const resourceNodeId = nodeId("Page", resourceId);
      nodes.set(resourceNodeId, {
        id: resourceNodeId,
        type: "Page",
        canonicalId: resourceId,
        owner: "Space",
        label: metadataString(view, "title") ?? resourceId,
        workspaceId: query.workspaceId,
        projectId: query.projectId,
        availability: view.availability,
        href: "/space",
        metadata: {
          scope: metadataString(view, "scope"),
          version: metadataNumber(view, "version"),
          updatedAt: metadataString(view, "updatedAt"),
          unavailableReason:
            view.availability === "UNAVAILABLE"
              ? (view.unavailableReason ?? "unavailable")
              : null,
        },
      });
      addEdge(edges, "BELONGS_TO", resourceNodeId, projectNodeId);
      addEdge(edges, "REFERENCES", id, resourceNodeId);
    }
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

  for (const fact of [...(snapshot.facts ?? [])].sort((a, b) => a.id.localeCompare(b.id))) {
    const id = nodeId("Fact", fact.id);
    const label = fact.text.length > 512 ? `${fact.text.slice(0, 509)}…` : fact.text;
    nodes.set(id, {
      id,
      type: "Fact",
      canonicalId: fact.id,
      owner: "Context",
      label,
      workspaceId: query.workspaceId,
      projectId: query.projectId,
      availability: "AVAILABLE",
      href: null,
      metadata: {
        subject: fact.subject,
        predicate: fact.predicate,
        object: fact.object,
        confidence: fact.confidence,
        salience: fact.salience,
        scope: fact.scope,
        sensitivity: fact.sensitivity,
        syncClass: fact.syncClass,
        trust: fact.trust,
        sourceUri: fact.provenance.sourceUri ?? null,
        createdAt: fact.createdAt,
        tValid: fact.tValid,
      },
    });
    addEdge(edges, "BELONGS_TO", id, projectNodeId);
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

export class BrainNeighborhoodSeedError extends Error {
  constructor(readonly seedNodeId: string) {
    super(`Brain seed tidak tersedia di Project ini: ${seedNodeId}`);
    this.name = "BrainNeighborhoodSeedError";
  }
}

function sourceUriConstraint(nodes: readonly BrainNode[]): string[] {
  return [
    ...new Set(
      nodes.flatMap((node) => {
        if (
          node.type !== "Source" ||
          node.availability !== "AVAILABLE" ||
          node.metadata.resourceType !== "url" ||
          typeof node.metadata.resourceId !== "string"
        ) {
          return [];
        }
        return [node.metadata.resourceId];
      }),
    ),
  ]
    .sort((a, b) => a.localeCompare(b))
    .slice(0, 32);
}

export function selectBrainNeighborhood(
  graph: BrainGraphResponse,
  query: BrainNeighborhoodQuery,
): BrainNeighborhoodResponse {
  if (graph.workspaceId !== query.workspaceId || graph.projectId !== query.projectId) {
    throw new BrainOwnerRequestError("HubProject", 404, "Project tidak tersedia.");
  }

  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  for (const seedNodeId of query.seedNodeIds) {
    if (!nodesById.has(seedNodeId)) throw new BrainNeighborhoodSeedError(seedNodeId);
  }

  const allowedNodeTypes =
    query.nodeTypes === undefined ? null : new Set<BrainNodeType>(query.nodeTypes);
  const allowedEdgeTypes =
    query.edgeTypes === undefined ? null : new Set<BrainEdge["type"]>(query.edgeTypes);
  const seedSet = new Set(query.seedNodeIds);
  const distance = new Map<string, number>(query.seedNodeIds.map((id) => [id, 0]));
  let frontier = new Set(query.seedNodeIds);
  const orderedEdges = [...graph.edges].sort((a, b) => a.id.localeCompare(b.id));

  for (let hop = 0; hop < query.maxHops && frontier.size > 0; hop += 1) {
    const next = new Set<string>();
    for (const edge of orderedEdges) {
      if (allowedEdgeTypes !== null && !allowedEdgeTypes.has(edge.type)) continue;
      const pairs: Array<[string, string]> = [
        [edge.sourceNodeId, edge.targetNodeId],
        [edge.targetNodeId, edge.sourceNodeId],
      ];
      for (const [from, to] of pairs) {
        if (!frontier.has(from) || distance.has(to)) continue;
        const node = nodesById.get(to);
        if (node === undefined) continue;
        if (!seedSet.has(to) && allowedNodeTypes !== null && !allowedNodeTypes.has(node.type)) {
          continue;
        }
        distance.set(to, hop + 1);
        next.add(to);
      }
    }
    frontier = next;
  }

  const reachable = [...distance.keys()]
    .map((id) => nodesById.get(id))
    .filter((node): node is BrainNode => node !== undefined)
    .sort((a, b) => (distance.get(a.id) ?? 0) - (distance.get(b.id) ?? 0) || compareNode(a, b));
  const nodes = reachable.slice(0, query.maxNodes);
  const visible = new Set(nodes.map((node) => node.id));
  const matchingEdges = orderedEdges.filter(
    (edge) =>
      visible.has(edge.sourceNodeId) &&
      visible.has(edge.targetNodeId) &&
      (allowedEdgeTypes === null || allowedEdgeTypes.has(edge.type)),
  );
  const edges = matchingEdges.slice(0, 256);

  return BrainNeighborhoodResponseSchema.parse({
    workspaceId: graph.workspaceId,
    projectId: graph.projectId,
    seedNodeIds: [...query.seedNodeIds].sort((a, b) => a.localeCompare(b)),
    nodes,
    edges,
    contextConstraint: {
      sourceUris: sourceUriConstraint(nodes),
    },
    truncated:
      graph.truncated || reachable.length > nodes.length || matchingEdges.length > edges.length,
  });
}

export async function queryBrainNeighborhood(
  query: BrainNeighborhoodQuery,
): Promise<BrainNeighborhoodResponse> {
  const graph = await queryBrainGraph({
    workspaceId: query.workspaceId,
    projectId: query.projectId,
    limit: 200,
    runLimit: 100,
  });
  return selectBrainNeighborhood(graph, query);
}
