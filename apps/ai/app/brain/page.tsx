"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BRAIN_EDGE_TYPES,
  BRAIN_NODE_TYPES,
  type BrainEdge,
  type BrainEdgeType,
  type BrainGraphResponse,
  type BrainNode,
  type BrainNodeType,
  type Project,
} from "@ecorione/shared-schema";
import styles from "./Brain.module.css";

const WORKSPACE_ID = "ws_personal";
const PERSONAL_PROJECT_ID = "prj_personal";
const PROJECT_STORAGE_KEY = "ecorione.projectId";
const VIEWBOX_WIDTH = 1080;
const VIEWBOX_HEIGHT = 640;

type Point = { x: number; y: number };

function errorMessage(body: unknown, fallback: string): string {
  if (body !== null && typeof body === "object" && "error" in body) {
    const error = (body as { error?: unknown }).error;
    if (
      error !== null &&
      typeof error === "object" &&
      "message" in error &&
      typeof (error as { message?: unknown }).message === "string"
    ) {
      return (error as { message: string }).message;
    }
  }
  return fallback;
}

async function json<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as T | null;
  if (!response.ok || body === null) {
    throw new Error(errorMessage(body, `HTTP ${String(response.status)}`));
  }
  return body;
}

function laneX(type: BrainNodeType): number {
  switch (type) {
    case "Project":
      return 100;
    case "Source":
      return 300;
    case "Flow":
      return 510;
    case "Trigger":
      return 730;
    case "Run":
      return 960;
  }
}

function positions(nodes: BrainNode[]): Map<string, Point> {
  const result = new Map<string, Point>();
  for (const type of BRAIN_NODE_TYPES) {
    const group = nodes.filter((node) => node.type === type);
    if (type === "Project") {
      for (const node of group) result.set(node.id, { x: laneX(type), y: VIEWBOX_HEIGHT / 2 });
      continue;
    }
    const step = VIEWBOX_HEIGHT / (group.length + 1);
    group.forEach((node, index) => {
      result.set(node.id, { x: laneX(type), y: step * (index + 1) });
    });
  }
  return result;
}

function nodeRadius(type: BrainNodeType): number {
  return type === "Project" ? 30 : type === "Run" ? 18 : 22;
}

function metadataRows(node: BrainNode): Array<[string, string]> {
  return Object.entries(node.metadata).map(([key, value]) => [
    key,
    value === null ? "—" : String(value),
  ]);
}

function relationText(edge: BrainEdge, nodesById: Map<string, BrainNode>): string {
  const source = nodesById.get(edge.sourceNodeId);
  const target = nodesById.get(edge.targetNodeId);
  return `${source?.label ?? edge.sourceNodeId} · ${edge.type} · ${target?.label ?? edge.targetNodeId}`;
}

export default function BrainPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState(PERSONAL_PROJECT_ID);
  const [graph, setGraph] = useState<BrainGraphResponse | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [enabledNodeTypes, setEnabledNodeTypes] = useState<Set<BrainNodeType>>(
    () => new Set(BRAIN_NODE_TYPES),
  );
  const [enabledEdgeTypes, setEnabledEdgeTypes] = useState<Set<BrainEdgeType>>(
    () => new Set(BRAIN_EDGE_TYPES),
  );
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(
    "Brain membaca relationship deterministik dari canonical owner contracts.",
  );
  const requestRef = useRef(0);

  const loadBrain = useCallback(async (nextProjectId: string) => {
    const seq = ++requestRef.current;
    setLoading(true);
    try {
      const query = new URLSearchParams({
        workspaceId: WORKSPACE_ID,
        projectId: nextProjectId,
        limit: "120",
        runLimit: "50",
      });
      const next = await fetch(`/api/brain?${query.toString()}`, {
        cache: "no-store",
      }).then((response) => json<BrainGraphResponse>(response));
      if (seq !== requestRef.current) return;
      setGraph(next);
      setSelectedId((current) =>
        current !== null && next.nodes.some((node) => node.id === current) ? current : null,
      );
      setMessage(
        next.truncated
          ? `Showing ${String(next.nodes.length)} of ${String(next.totalNodes)} nodes within bounded query limits.`
          : `${String(next.nodes.length)} nodes · ${String(next.edges.length)} deterministic relationships.`,
      );
    } catch (reason) {
      if (seq !== requestRef.current) return;
      setGraph(null);
      setSelectedId(null);
      setMessage(
        `Brain load gagal: ${reason instanceof Error ? reason.message : String(reason)}`,
      );
    } finally {
      if (seq === requestRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let chosen = PERSONAL_PROJECT_ID;
    try {
      const stored = window.localStorage.getItem(PROJECT_STORAGE_KEY);
      if (stored !== null && /^prj_[a-z0-9][a-z0-9_-]*$/.test(stored)) chosen = stored;
    } catch {
      // Personal remains the safe fallback.
    }
    setProjectId(chosen);
    void fetch(`/api/projects?workspaceId=${WORKSPACE_ID}`, { cache: "no-store" })
      .then((response) => json<{ projects: Project[] }>(response))
      .then((body) =>
        setProjects(body.projects.filter((project) => project.archivedAt === null)),
      )
      .catch(() => setProjects([]));
  }, []);

  useEffect(() => {
    void loadBrain(projectId);
  }, [loadBrain, projectId]);

  function chooseProject(next: string): void {
    setProjectId(next);
    setSelectedId(null);
    try {
      window.localStorage.setItem(PROJECT_STORAGE_KEY, next);
    } catch {
      // Project selection still works for this session when storage is unavailable.
    }
  }

  function toggleNodeType(type: BrainNodeType): void {
    setEnabledNodeTypes((current) => {
      const next = new Set(current);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  function toggleEdgeType(type: BrainEdgeType): void {
    setEnabledEdgeTypes((current) => {
      const next = new Set(current);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  const visibleNodes = useMemo(
    () => (graph?.nodes ?? []).filter((node) => enabledNodeTypes.has(node.type)),
    [enabledNodeTypes, graph],
  );
  const visibleIds = useMemo(
    () => new Set(visibleNodes.map((node) => node.id)),
    [visibleNodes],
  );
  const visibleEdges = useMemo(
    () =>
      (graph?.edges ?? []).filter(
        (edge) =>
          enabledEdgeTypes.has(edge.type) &&
          visibleIds.has(edge.sourceNodeId) &&
          visibleIds.has(edge.targetNodeId),
      ),
    [enabledEdgeTypes, graph, visibleIds],
  );
  const nodePositions = useMemo(() => positions(visibleNodes), [visibleNodes]);
  const nodesById = useMemo(
    () => new Map((graph?.nodes ?? []).map((node) => [node.id, node])),
    [graph],
  );
  const selectedNode = selectedId === null ? null : (nodesById.get(selectedId) ?? null);
  const selectedRelations = useMemo(
    () =>
      selectedId === null
        ? []
        : (graph?.edges ?? []).filter(
            (edge) => edge.sourceNodeId === selectedId || edge.targetNodeId === selectedId,
          ),
    [graph, selectedId],
  );
  const selectedProject = projects.find((project) => project.id === projectId);

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>ECORIONE · PE-06 · derived projection</span>
          <h1>Brain</h1>
          <p>
            Connected view dari relationship yang sudah dibuktikan owner data. Brain tidak
            membuat fakta baru dan tidak menggantikan Context atau ECX.
          </p>
        </div>
        <label className={styles.projectPicker}>
          <span>Project</span>
          <select value={projectId} onChange={(event) => chooseProject(event.target.value)}>
            {projects.length === 0 ? (
              <option value={PERSONAL_PROJECT_ID}>Personal</option>
            ) : (
              projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))
            )}
          </select>
          <small>{selectedProject?.id ?? projectId}</small>
        </label>
      </header>

      <div className={styles.notice} role="status">
        <span>{loading ? "Refreshing authorized owner projection…" : message}</span>
        <button type="button" disabled={loading} onClick={() => void loadBrain(projectId)}>
          Refresh
        </button>
      </div>

      <section className={styles.filters} aria-label="Brain graph filters">
        <div>
          <strong>Nodes</strong>
          <div className={styles.filterGroup}>
            {BRAIN_NODE_TYPES.map((type) => (
              <label key={type}>
                <input
                  type="checkbox"
                  checked={enabledNodeTypes.has(type)}
                  onChange={() => toggleNodeType(type)}
                />
                {type}
              </label>
            ))}
          </div>
        </div>
        <div>
          <strong>Relationships</strong>
          <div className={styles.filterGroup}>
            {BRAIN_EDGE_TYPES.map((type) => (
              <label key={type}>
                <input
                  type="checkbox"
                  checked={enabledEdgeTypes.has(type)}
                  onChange={() => toggleEdgeType(type)}
                />
                {type}
              </label>
            ))}
          </div>
        </div>
      </section>

      <div className={styles.workspace}>
        <section className={styles.graphPanel} aria-label="Brain relationship graph">
          <div className={styles.laneLabels} aria-hidden="true">
            {BRAIN_NODE_TYPES.map((type) => (
              <span key={type}>{type}</span>
            ))}
          </div>
          <div className={styles.graphScroll}>
            {visibleNodes.length === 0 && !loading ? (
              <div className={styles.empty}>Tidak ada node yang aktif pada filter ini.</div>
            ) : (
              <svg
                className={styles.graph}
                viewBox={`0 0 ${String(VIEWBOX_WIDTH)} ${String(VIEWBOX_HEIGHT)}`}
                role="img"
                aria-label="Connected Brain graph"
              >
                <defs>
                  <marker
                    id="brain-arrow"
                    markerWidth="8"
                    markerHeight="8"
                    refX="7"
                    refY="4"
                    orient="auto"
                  >
                    <path d="M0,0 L8,4 L0,8 z" className={styles.arrow} />
                  </marker>
                </defs>

                <g className={styles.edges}>
                  {visibleEdges.map((edge) => {
                    const from = nodePositions.get(edge.sourceNodeId);
                    const to = nodePositions.get(edge.targetNodeId);
                    if (from === undefined || to === undefined) return null;
                    return (
                      <line
                        key={edge.id}
                        x1={from.x}
                        y1={from.y}
                        x2={to.x}
                        y2={to.y}
                        className={
                          selectedId === edge.sourceNodeId || selectedId === edge.targetNodeId
                            ? styles.edgeSelected
                            : styles.edge
                        }
                        markerEnd="url(#brain-arrow)"
                      >
                        <title>{relationText(edge, nodesById)}</title>
                      </line>
                    );
                  })}
                </g>

                <g className={styles.nodes}>
                  {visibleNodes.map((node) => {
                    const point = nodePositions.get(node.id);
                    if (point === undefined) return null;
                    const selected = selectedId === node.id;
                    const unavailable = node.availability === "UNAVAILABLE";
                    return (
                      <g
                        key={node.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`${node.type}: ${node.label}`}
                        aria-pressed={selected}
                        className={[
                          styles.node,
                          selected ? styles.nodeSelected : "",
                          unavailable ? styles.nodeUnavailable : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        transform={`translate(${String(point.x)} ${String(point.y)})`}
                        onClick={() => setSelectedId(node.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedId(node.id);
                          }
                        }}
                      >
                        <circle r={nodeRadius(node.type)} />
                        <text y={nodeRadius(node.type) + 18} textAnchor="middle">
                          {node.label.length > 24 ? `${node.label.slice(0, 22)}…` : node.label}
                        </text>
                        <title>{`${node.type} · ${node.canonicalId}`}</title>
                      </g>
                    );
                  })}
                </g>
              </svg>
            )}
          </div>
        </section>

        <aside className={styles.inspector}>
          {selectedNode === null ? (
            <div className={styles.empty}>
              Pilih satu connected dot untuk melihat canonical identity dan relationship-nya.
            </div>
          ) : (
            <>
              <div className={styles.inspectorHead}>
                <span className={styles.typeBadge}>{selectedNode.type}</span>
                <h2>{selectedNode.label}</h2>
                <code>{selectedNode.canonicalId}</code>
              </div>

              <dl className={styles.meta}>
                <div>
                  <dt>Owner</dt>
                  <dd>{selectedNode.owner}</dd>
                </div>
                <div>
                  <dt>Availability</dt>
                  <dd>{selectedNode.availability}</dd>
                </div>
                <div>
                  <dt>Project</dt>
                  <dd>{selectedNode.projectId}</dd>
                </div>
                <div>
                  <dt>Workspace</dt>
                  <dd>{selectedNode.workspaceId}</dd>
                </div>
                {metadataRows(selectedNode).map(([key, value]) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>

              {selectedNode.href !== null ? (
                <Link className={styles.ownerLink} href={selectedNode.href}>
                  Open canonical surface
                </Link>
              ) : null}

              <div className={styles.relations}>
                <strong>Relationships ({selectedRelations.length})</strong>
                {selectedRelations.map((edge) => (
                  <button
                    key={edge.id}
                    type="button"
                    onClick={() =>
                      setSelectedId(
                        edge.sourceNodeId === selectedNode.id
                          ? edge.targetNodeId
                          : edge.sourceNodeId,
                      )
                    }
                  >
                    <span>{edge.type}</span>
                    <small>{relationText(edge, nodesById)}</small>
                  </button>
                ))}
                {selectedRelations.length === 0 ? (
                  <p>Tidak ada relationship pada projection saat ini.</p>
                ) : null}
              </div>
            </>
          )}
        </aside>
      </div>
    </main>
  );
}
