import {
  FlowGraphDocumentSchema,
  FlowGraphSaveResultSchema,
  FlowGraphSummarySchema,
  FlowGraphVersionViewSchema,
  type FlowGraphDocument,
  type FlowGraphId,
  type FlowGraphSaveResult,
  type FlowGraphSummary,
  type FlowGraphVersionView,
  type Timestamp,
  type WorkspaceId,
} from "@ecorione/shared-schema";
import type { FlowDatabase } from "./db.js";
import { digestCanonical, validateAndCompileFlowGraph } from "./node-registry.js";

interface GraphRow {
  id: string;
  workspace_id: string;
  name: string;
  scope: string;
  sensitivity: string;
  current_version: number;
  created_at: string;
  updated_at: string;
}
interface VersionRow {
  graph_id: string;
  version: number;
  digest: string;
  graph_json: string;
  validation_json: string;
  created_at: string;
}
export class FlowGraphNotFoundError extends Error {
  constructor(id: string) {
    super(`Flow graph tidak ditemukan: ${id}`);
    this.name = "FlowGraphNotFoundError";
  }
}
export class FlowGraphVersionConflictError extends Error {
  constructor(expected: number, actual: number) {
    super(`Versi graph stale: expected ${String(expected)}, current ${String(actual)}.`);
    this.name = "FlowGraphVersionConflictError";
  }
}
export class FlowGraphWorkspaceConflictError extends Error {
  constructor() {
    super("workspaceId graph tidak boleh berubah setelah dibuat.");
    this.name = "FlowGraphWorkspaceConflictError";
  }
}
function summary(row: GraphRow): FlowGraphSummary {
  return FlowGraphSummarySchema.parse({
    graphId: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    scope: row.scope,
    sensitivity: row.sensitivity,
    currentVersion: row.current_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}
function version(row: VersionRow): FlowGraphVersionView {
  return FlowGraphVersionViewSchema.parse({
    graphId: row.graph_id,
    version: row.version,
    digest: row.digest,
    graph: JSON.parse(row.graph_json) as unknown,
    validation: JSON.parse(row.validation_json) as unknown,
    createdAt: row.created_at,
  });
}

export class FlowGraphRepository {
  constructor(readonly db: FlowDatabase) {}
  list(workspaceId?: WorkspaceId): FlowGraphSummary[] {
    const rows = (
      workspaceId === undefined
        ? this.db.raw
            .prepare("SELECT * FROM flow_graphs ORDER BY updated_at DESC, id ASC")
            .all()
        : this.db.raw
            .prepare(
              "SELECT * FROM flow_graphs WHERE workspace_id=? ORDER BY updated_at DESC, id ASC",
            )
            .all(workspaceId)
    ) as GraphRow[];
    return rows.map(summary);
  }
  create(graphInput: FlowGraphDocument, now: Timestamp): FlowGraphSaveResult {
    const graph = FlowGraphDocumentSchema.parse(graphInput);
    const digest = digestCanonical(graph);
    const validation = validateAndCompileFlowGraph(graph, 1, digest);
    const tx = this.db.raw.transaction(() => {
      this.db.raw
        .prepare(
          "INSERT INTO flow_graphs(id,workspace_id,name,scope,sensitivity,current_version,created_at,updated_at) VALUES(?,?,?,?,?,1,?,?)",
        )
        .run(graph.id, graph.workspaceId, graph.name, graph.scope, graph.sensitivity, now, now);
      this.db.raw
        .prepare(
          "INSERT INTO flow_graph_versions(graph_id,version,digest,graph_json,validation_json,created_at) VALUES(?,1,?,?,?,?)",
        )
        .run(graph.id, digest, JSON.stringify(graph), JSON.stringify(validation), now);
      return FlowGraphSaveResultSchema.parse({
        version: { graphId: graph.id, version: 1, digest, graph, validation, createdAt: now },
        deduplicated: false,
      });
    });
    return tx();
  }
  save(
    graphInput: FlowGraphDocument,
    expectedVersion: number,
    now: Timestamp,
  ): FlowGraphSaveResult {
    const graph = FlowGraphDocumentSchema.parse(graphInput);
    const row = this.db.raw.prepare("SELECT * FROM flow_graphs WHERE id=?").get(graph.id) as
      GraphRow | undefined;
    if (row === undefined) throw new FlowGraphNotFoundError(graph.id);
    if (row.workspace_id !== graph.workspaceId) throw new FlowGraphWorkspaceConflictError();
    if (row.current_version !== expectedVersion)
      throw new FlowGraphVersionConflictError(expectedVersion, row.current_version);
    const digest = digestCanonical(graph);
    const current = this.db.raw
      .prepare("SELECT * FROM flow_graph_versions WHERE graph_id=? AND version=?")
      .get(graph.id, row.current_version) as VersionRow;
    if (current.digest === digest)
      return FlowGraphSaveResultSchema.parse({ version: version(current), deduplicated: true });
    const next = row.current_version + 1;
    const validation = validateAndCompileFlowGraph(graph, next, digest);
    const tx = this.db.raw.transaction(() => {
      const changed = this.db.raw
        .prepare(
          "UPDATE flow_graphs SET name=?,scope=?,sensitivity=?,current_version=?,updated_at=? WHERE id=? AND current_version=?",
        )
        .run(graph.name, graph.scope, graph.sensitivity, next, now, graph.id, expectedVersion);
      if (changed.changes !== 1) {
        const latest = this.db.raw
          .prepare("SELECT current_version FROM flow_graphs WHERE id=?")
          .get(graph.id) as { current_version: number };
        throw new FlowGraphVersionConflictError(expectedVersion, latest.current_version);
      }
      this.db.raw
        .prepare(
          "INSERT INTO flow_graph_versions(graph_id,version,digest,graph_json,validation_json,created_at) VALUES(?,?,?,?,?,?)",
        )
        .run(graph.id, next, digest, JSON.stringify(graph), JSON.stringify(validation), now);
      return FlowGraphSaveResultSchema.parse({
        version: {
          graphId: graph.id,
          version: next,
          digest,
          graph,
          validation,
          createdAt: now,
        },
        deduplicated: false,
      });
    });
    return tx();
  }
  get(graphId: FlowGraphId, requestedVersion?: number): FlowGraphVersionView {
    let row: VersionRow | undefined;
    if (requestedVersion === undefined)
      row = this.db.raw
        .prepare(
          "SELECT v.* FROM flow_graph_versions v JOIN flow_graphs g ON g.id=v.graph_id AND g.current_version=v.version WHERE v.graph_id=?",
        )
        .get(graphId) as VersionRow | undefined;
    else
      row = this.db.raw
        .prepare("SELECT * FROM flow_graph_versions WHERE graph_id=? AND version=?")
        .get(graphId, requestedVersion) as VersionRow | undefined;
    if (row === undefined)
      throw new FlowGraphNotFoundError(
        `${graphId}@${requestedVersion === undefined ? "current" : String(requestedVersion)}`,
      );
    return version(row);
  }
  versions(graphId: FlowGraphId): FlowGraphVersionView[] {
    const exists = this.db.raw.prepare("SELECT 1 FROM flow_graphs WHERE id=?").get(graphId);
    if (exists === undefined) throw new FlowGraphNotFoundError(graphId);
    return (
      this.db.raw
        .prepare("SELECT * FROM flow_graph_versions WHERE graph_id=? ORDER BY version DESC")
        .all(graphId) as VersionRow[]
    ).map(version);
  }
}
