"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
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
import {
  PERSONAL_PROJECT_ID,
  PROJECT_STORAGE_KEY,
  activeProjects,
  isProjectIdCandidate,
  resolveActiveProjectId,
} from "../../lib/project-selection";
import { layoutBrainNodes } from "../../lib/brain-layout";
import styles from "./Brain.module.css";

const WORKSPACE_ID = "ws_personal";
const MIN_GRAPH_ZOOM = 0.75;
const MAX_GRAPH_ZOOM = 1.75;
const GRAPH_ZOOM_STEP = 0.25;
const GRAPH_PAN_STEP = 180;

type PanDrag = {
  pointerId: number;
  startX: number;
  startY: number;
  scrollLeft: number;
  scrollTop: number;
};

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
  const [projectReady, setProjectReady] = useState(false);
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
  const graphScrollRef = useRef<HTMLDivElement>(null);
  const panDragRef = useRef<PanDrag | null>(null);
  const [graphZoom, setGraphZoom] = useState(1);

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
    let cancelled = false;
    let candidate: string | null = null;
    try {
      const stored = window.localStorage.getItem(PROJECT_STORAGE_KEY);
      if (isProjectIdCandidate(stored)) candidate = stored;
    } catch {
      // The active Project list remains the source of truth.
    }

    void fetch(`/api/projects?workspaceId=${WORKSPACE_ID}`, { cache: "no-store" })
      .then((response) => json<{ projects: Project[] }>(response))
      .then((body) => {
        if (cancelled) return;
        const active = activeProjects(body.projects);
        const chosen = resolveActiveProjectId(candidate, active);
        setProjects(active);
        if (chosen === null) {
          setProjectReady(false);
          setMessage("Brain tidak menemukan Project aktif.");
          return;
        }
        setProjectId(chosen);
        setProjectReady(true);
        try {
          window.localStorage.setItem(PROJECT_STORAGE_KEY, chosen);
        } catch {
          // In-memory selection still uses the reconciled active Project.
        }
      })
      .catch(() => {
        if (cancelled) return;
        setProjects([]);
        setProjectReady(false);
        setMessage("Brain gagal memuat daftar Project aktif.");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!projectReady) return;
    void loadBrain(projectId);
  }, [loadBrain, projectId, projectReady]);

  function chooseProject(next: string): void {
    const chosen = resolveActiveProjectId(next, projects);
    if (chosen === null) return;
    setProjectId(chosen);
    setSelectedId(null);
    try {
      window.localStorage.setItem(PROJECT_STORAGE_KEY, chosen);
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

  function panGraph(left: number, top: number): void {
    graphScrollRef.current?.scrollBy({ left, top });
  }

  function zoomGraph(delta: number): void {
    setGraphZoom((current) =>
      Math.min(MAX_GRAPH_ZOOM, Math.max(MIN_GRAPH_ZOOM, current + delta)),
    );
  }

  function resetGraphView(): void {
    setGraphZoom(1);
    graphScrollRef.current?.scrollTo({ left: 0, top: 0 });
  }

  function startGraphPan(event: ReactPointerEvent<HTMLDivElement>): void {
    if (event.button !== 0) return;
    const target = event.target as { closest?: (selector: string) => unknown };
    if (target.closest?.('[role="button"]')) return;

    const viewport = event.currentTarget;
    panDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop,
    };
    viewport.setPointerCapture(event.pointerId);
  }

  function moveGraphPan(event: ReactPointerEvent<HTMLDivElement>): void {
    const drag = panDragRef.current;
    if (drag === null || drag.pointerId !== event.pointerId) return;

    const viewport = event.currentTarget;
    viewport.scrollLeft = drag.scrollLeft - (event.clientX - drag.startX);
    viewport.scrollTop = drag.scrollTop - (event.clientY - drag.startY);
  }

  function endGraphPan(event: ReactPointerEvent<HTMLDivElement>): void {
    const drag = panDragRef.current;
    if (drag === null || drag.pointerId !== event.pointerId) return;
    panDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
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
  const graphLayout = useMemo(() => layoutBrainNodes(visibleNodes), [visibleNodes]);
  const nodePositions = graphLayout.positions;
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
          <span className={styles.eyebrow}>Explore connections</span>
          <h1>Brain</h1>
          <p>
            Lihat hubungan antar sumber, memori, dan aktivitas Project tanpa mengubah data
            sumbernya.
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
          <div className={styles.graphToolbar} aria-label="Brain graph navigation">
            <div className={styles.panControls}>
              <button
                type="button"
                aria-label="Pan left"
                onClick={() => panGraph(-GRAPH_PAN_STEP, 0)}
              >
                ←
              </button>
              <button
                type="button"
                aria-label="Pan up"
                onClick={() => panGraph(0, -GRAPH_PAN_STEP)}
              >
                ↑
              </button>
              <button
                type="button"
                aria-label="Pan down"
                onClick={() => panGraph(0, GRAPH_PAN_STEP)}
              >
                ↓
              </button>
              <button
                type="button"
                aria-label="Pan right"
                onClick={() => panGraph(GRAPH_PAN_STEP, 0)}
              >
                →
              </button>
            </div>
            <div className={styles.zoomControls}>
              <button
                type="button"
                aria-label="Zoom out"
                disabled={graphZoom <= MIN_GRAPH_ZOOM}
                onClick={() => zoomGraph(-GRAPH_ZOOM_STEP)}
              >
                −
              </button>
              <output aria-label="Brain graph zoom">{Math.round(graphZoom * 100)}%</output>
              <button
                type="button"
                aria-label="Zoom in"
                disabled={graphZoom >= MAX_GRAPH_ZOOM}
                onClick={() => zoomGraph(GRAPH_ZOOM_STEP)}
              >
                +
              </button>
              <button type="button" aria-label="Reset graph view" onClick={resetGraphView}>
                Reset
              </button>
            </div>
          </div>
          <div
            ref={graphScrollRef}
            className={styles.graphScroll}
            aria-label="Pan Brain graph"
            tabIndex={0}
            onPointerDown={startGraphPan}
            onPointerMove={moveGraphPan}
            onPointerUp={endGraphPan}
            onPointerCancel={endGraphPan}
          >
            {visibleNodes.length === 0 && !loading ? (
              <div className={styles.empty}>Tidak ada node yang aktif pada filter ini.</div>
            ) : (
              <svg
                className={styles.graph}
                viewBox={`0 0 ${String(graphLayout.width)} ${String(graphLayout.height)}`}
                style={{
                  width: `${String(graphLayout.width * graphZoom)}px`,
                  height: `${String(graphLayout.height * graphZoom)}px`,
                }}
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
