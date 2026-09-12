"use client";

import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import type {
  FlowGraphEdge,
  FlowGraphNode,
  FlowGraphRunState,
  FlowGraphValidationResult,
  FlowGraphVersionView,
  FlowNodeDefinition,
  FlowNodeKind,
} from "@ecorione/shared-schema";
import styles from "./FlowCanvas.module.css";

const DRAFT_ID = "fg_draftcanvas01";
const WORKSPACE_ID = "ws_personal";

type SaveResponse = { version: FlowGraphVersionView; deduplicated: boolean };
type NodeRunState = FlowGraphRunState["nodes"][number];

function defaultConfig(kind: FlowNodeKind): Record<string, unknown> {
  switch (kind) {
    case "trigger":
    case "parallel":
      return {};
    case "ai":
      return { target: "local", message: "Process this input." };
    case "memory":
      return { query: "{{ }}", k: 8, hostedEligibleOnly: false };
    case "artifact":
      return { artifactId: `art_${"0".repeat(64)}`, encoding: "utf8" };
    case "mcp-tool":
      return { serverId: "server", tool: "tool", arguments: {} };
    case "http":
      return { url: "https://example.com", method: "GET", headers: {} };
    case "transform":
      return { mode: "pick", path: "" };
    case "condition":
      return { operator: "truthy" };
    case "loop":
      return { mode: "identity", maxIterations: 100 };
    case "delay":
      return { milliseconds: 1000 };
    case "approval":
      return { prompt: "Approve this step?" };
    case "human-input":
      return { prompt: "Provide input" };
    case "sandbox":
      return {
        tier: "tier0",
        workspace: "/tmp/work",
        command: "pwd",
        wasmBase64: null,
        wasmExport: "run",
        wasmArgs: [],
      };
    case "data-owner":
      return { service: "context", path: "/v1/episodes?limit=20" };
    case "notification":
      return { message: "Flow node completed." };
    case "subflow":
      return { graphId: DRAFT_ID, waitForCompletion: true };
  }
}
function newNodeId(kind: FlowNodeKind): string {
  return `node_${kind.replaceAll("-", "")}_${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}`;
}
function newEdgeId(): string {
  return `edge_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
}
function errorMessage(body: unknown, fallback: string): string {
  if (body !== null && typeof body === "object" && "error" in body) {
    const error = (body as { error?: unknown }).error;
    if (
      error !== null &&
      typeof error === "object" &&
      "message" in error &&
      typeof (error as { message?: unknown }).message === "string"
    )
      return (error as { message: string }).message;
  }
  return fallback;
}
function parseInput(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export default function FlowCanvasPage() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [definitions, setDefinitions] = useState<FlowNodeDefinition[]>([]);
  const [nodes, setNodes] = useState<FlowGraphNode[]>([
    {
      id: "node_trigger1",
      kind: "trigger",
      version: 1,
      label: "Trigger",
      position: { x: 72, y: 96 },
      config: {},
      secretRefs: [],
      limits: {},
      retry: {},
    },
  ]);
  const [edges, setEdges] = useState<FlowGraphEdge[]>([]);
  const [selectedId, setSelectedId] = useState<string>("node_trigger1");
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [connectPort, setConnectPort] = useState("out");
  const [configDraft, setConfigDraft] = useState("{}");
  const [graphId, setGraphId] = useState<string | null>(null);
  const [loadId, setLoadId] = useState("");
  const [name, setName] = useState("Untitled flow");
  const [scope, setScope] = useState("personal");
  const [sensitivity, setSensitivity] = useState("INTERNAL");
  const [version, setVersion] = useState<number | null>(null);
  const [versions, setVersions] = useState<FlowGraphVersionView[]>([]);
  const [validation, setValidation] = useState<FlowGraphValidationResult | null>(null);
  const [dirty, setDirty] = useState(true);
  const [busy, setBusy] = useState(false);
  const [validating, setValidating] = useState(false);
  const [runStarting, setRunStarting] = useState(false);
  const [pendingNodeAction, setPendingNodeAction] = useState<string | null>(null);
  const [message, setMessage] = useState("Draft lokal");
  const [runInput, setRunInput] = useState('{"hello":"world"}');
  const [run, setRun] = useState<(FlowGraphRunState & { temporalStatus?: string }) | null>(
    null,
  );
  const [runId, setRunId] = useState<string | null>(null);
  const [humanDraft, setHumanDraft] = useState("");
  const busyInFlightRef = useRef(false);
  const validationInFlightRef = useRef(false);
  const runInFlightRef = useRef(false);
  const nodeActionInFlightRef = useRef(false);
  const draftRevisionRef = useRef(0);
  const selected = nodes.find((node) => node.id === selectedId) ?? null;

  function markDraftChanged(): void {
    draftRevisionRef.current += 1;
    setDirty(true);
    setValidation(null);
  }

  function beginBusy(): boolean {
    if (busyInFlightRef.current) return false;
    busyInFlightRef.current = true;
    setBusy(true);
    return true;
  }

  function finishBusy(): void {
    busyInFlightRef.current = false;
    setBusy(false);
  }

  async function runUiAction(label: string, action: () => Promise<unknown>): Promise<void> {
    try {
      await action();
    } catch (reason) {
      const detail = reason instanceof Error ? reason.message : String(reason);
      setMessage(`${label}: ${detail}`);
    }
  }

  useEffect(() => {
    void fetch("/api/flow/nodes")
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return response.json() as Promise<{ nodes: FlowNodeDefinition[] }>;
      })
      .then((body) => setDefinitions(body.nodes))
      .catch(() => setMessage("Node registry tidak dapat dimuat."));
  }, []);
  useEffect(() => {
    if (selected !== null) setConfigDraft(JSON.stringify(selected.config, null, 2));
  }, [selectedId]);
  useEffect(() => {
    if (runId === null || run?.status === "COMPLETED" || run?.status === "FAILED") return;
    let cancelled = false;
    const refresh = async () => {
      const response = await fetch(`/api/flow/graph-runs/${encodeURIComponent(runId)}`);
      const body = (await response.json().catch(() => null)) as
        (FlowGraphRunState & { temporalStatus?: string }) | null;
      if (!response.ok || body === null) {
        throw new Error(
          errorMessage(
            body,
            response.ok ? "Respons status run tidak valid." : `HTTP ${String(response.status)}`,
          ),
        );
      }
      if (!cancelled) setRun(body);
    };
    const refreshSafely = () => {
      void refresh().catch((reason) => {
        if (!cancelled) {
          const detail = reason instanceof Error ? reason.message : String(reason);
          setMessage(`Run refresh gagal: ${detail}`);
        }
      });
    };
    refreshSafely();
    const timer = window.setInterval(refreshSafely, 1200);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [runId, run?.status]);

  const definitionsByKind = useMemo(
    () => new Map(definitions.map((item) => [item.kind, item])),
    [definitions],
  );
  const runStates = useMemo(
    () => new Map((run?.nodes ?? []).map((item) => [item.nodeId, item])),
    [run],
  );

  function graphDocument(id = graphId ?? DRAFT_ID) {
    return {
      id,
      workspaceId: WORKSPACE_ID,
      name,
      scope,
      sensitivity,
      maxParallelism: 4,
      nodes,
      edges,
      viewport: { x: 0, y: 0, zoom: 1 },
    };
  }
  function drop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect === undefined) return;
    const x = Math.max(12, event.clientX - rect.left - 82);
    const y = Math.max(12, event.clientY - rect.top - 28);
    const moving = event.dataTransfer.getData("application/x-ecorione-node");
    if (moving.length > 0) {
      setNodes((current) =>
        current.map((node) => (node.id === moving ? { ...node, position: { x, y } } : node)),
      );
      markDraftChanged();
      return;
    }
    const kind = event.dataTransfer.getData("application/x-ecorione-kind") as FlowNodeKind;
    if (!definitionsByKind.has(kind)) return;
    const id = newNodeId(kind);
    setNodes((current) => [
      ...current,
      {
        id,
        kind,
        version: 1,
        label: definitionsByKind.get(kind)?.label ?? kind,
        position: { x, y },
        config: defaultConfig(kind),
        secretRefs: [],
        limits: {},
        retry: {},
      },
    ]);
    setSelectedId(id);
    markDraftChanged();
  }
  function selectNode(id: string): void {
    if (connectFrom !== null && connectFrom !== id) {
      const source = nodes.find((item) => item.id === connectFrom);
      const target = nodes.find((item) => item.id === id);
      if (source !== undefined && target !== undefined) {
        setEdges((current) => [
          ...current,
          {
            id: newEdgeId(),
            sourceNodeId: source.id,
            sourcePort: source.kind === "condition" ? connectPort : "out",
            targetNodeId: target.id,
            targetPort: "in",
          },
        ]);
      }
      setConnectFrom(null);
      setConnectPort("out");
      markDraftChanged();
    }
    setSelectedId(id);
  }
  function applyConfig(): void {
    if (selected === null) return;
    try {
      const parsed = JSON.parse(configDraft) as Record<string, unknown>;
      setNodes((current) =>
        current.map((node) => (node.id === selected.id ? { ...node, config: parsed } : node)),
      );
      markDraftChanged();
      setMessage("Config node diterapkan ke draft.");
    } catch {
      setMessage("Config harus JSON valid.");
    }
  }
  function updateSelected(patch: Partial<FlowGraphNode>): void {
    if (selected !== null) {
      setNodes((current) =>
        current.map((node) => (node.id === selected.id ? { ...node, ...patch } : node)),
      );
      markDraftChanged();
    }
  }
  function removeSelected(): void {
    if (selected === null || selected.kind === "trigger") return;
    setNodes((current) => current.filter((node) => node.id !== selected.id));
    setEdges((current) =>
      current.filter(
        (edge) => edge.sourceNodeId !== selected.id && edge.targetNodeId !== selected.id,
      ),
    );
    setSelectedId("node_trigger1");
    markDraftChanged();
  }
  async function validate(): Promise<FlowGraphValidationResult | null> {
    if (validationInFlightRef.current) return null;
    validationInFlightRef.current = true;
    setValidating(true);
    const revision = draftRevisionRef.current;
    const snapshot = graphDocument();
    try {
      const response = await fetch("/api/flow/graphs/validate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(snapshot),
      });
      const body = (await response
        .json()
        .catch(() => null)) as FlowGraphValidationResult | null;
      if (!response.ok || body === null) {
        setMessage(errorMessage(body, `Validasi gagal (${response.status}).`));
        return null;
      }
      if (revision !== draftRevisionRef.current) {
        setMessage(
          "Draft berubah selama validasi. Validasi lama diabaikan; jalankan Validate lagi.",
        );
        return null;
      }
      setValidation(body);
      setMessage(
        body.valid ? "Graph valid dan compileable." : `${body.issues.length} masalah validasi.`,
      );
      return body;
    } finally {
      validationInFlightRef.current = false;
      setValidating(false);
    }
  }
  async function save(): Promise<void> {
    if (!beginBusy()) return;
    const revision = draftRevisionRef.current;
    const snapshot = graphDocument();
    try {
      const target =
        graphId === null
          ? "/api/flow/graphs"
          : `/api/flow/graphs/${encodeURIComponent(graphId)}`;
      const payload =
        graphId === null
          ? { ...snapshot, id: undefined }
          : { ...snapshot, id: undefined, expectedVersion: version ?? 1 };
      const response = await fetch(target, {
        method: graphId === null ? "POST" : "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json().catch(() => null)) as SaveResponse | null;
      if (!response.ok || body === null) {
        setMessage(errorMessage(body, `Save gagal (${response.status}).`));
        return;
      }
      setGraphId(body.version.graphId);
      setLoadId(body.version.graphId);
      setVersion(body.version.version);
      if (revision === draftRevisionRef.current) {
        setNodes(body.version.graph.nodes);
        setEdges(body.version.graph.edges);
        setValidation(body.version.validation);
        setDirty(false);
        setMessage(
          body.deduplicated
            ? `Tidak ada perubahan — tetap v${body.version.version}.`
            : `Tersimpan sebagai v${body.version.version}.`,
        );
      } else {
        setValidation(null);
        setDirty(true);
        setMessage(
          `v${body.version.version} tersimpan, tetapi draft berubah selama request. Simpan lagi sebelum Run.`,
        );
      }
      await loadVersions(body.version.graphId);
    } finally {
      finishBusy();
    }
  }
  async function loadGraph(id = loadId, requestedVersion?: number): Promise<void> {
    const clean = id.trim();
    if (clean.length === 0 || !beginBusy()) return;
    try {
      const response = await fetch(
        `/api/flow/graphs/${encodeURIComponent(clean)}${requestedVersion === undefined ? "" : `?version=${String(requestedVersion)}`}`,
      );
      const body = (await response.json().catch(() => null)) as FlowGraphVersionView | null;
      if (!response.ok || body === null) {
        setMessage(errorMessage(body, `Load gagal (${response.status}).`));
        return;
      }
      setGraphId(body.graphId);
      setLoadId(body.graphId);
      setVersion(body.version);
      setName(body.graph.name);
      setScope(body.graph.scope);
      setSensitivity(body.graph.sensitivity);
      setNodes(body.graph.nodes);
      setEdges(body.graph.edges);
      const firstNode = body.graph.nodes[0] ?? null;
      setSelectedId(firstNode?.id ?? "");
      setConfigDraft(JSON.stringify(firstNode?.config ?? {}, null, 2));
      draftRevisionRef.current += 1;
      setDirty(false);
      setValidation(body.validation);
      setMessage(`Memuat ${body.graphId} v${body.version}.`);
      await loadVersions(body.graphId);
    } finally {
      finishBusy();
    }
  }
  async function loadVersions(id: string): Promise<void> {
    const response = await fetch(`/api/flow/graphs/${encodeURIComponent(id)}/versions`);
    const body = (await response.json().catch(() => null)) as {
      versions?: FlowGraphVersionView[];
      error?: unknown;
    } | null;
    if (!response.ok || body?.versions === undefined) {
      throw new Error(
        errorMessage(
          body,
          response.ok ? "Respons versions tidak valid." : `HTTP ${String(response.status)}`,
        ),
      );
    }
    setVersions(body.versions);
  }
  async function runGraph(): Promise<void> {
    if (runInFlightRef.current || runStarting) return;
    if (graphId === null) {
      setMessage("Simpan graph sebelum Run.");
      return;
    }
    if (dirty) {
      setMessage("Ada perubahan yang belum disimpan. Save dulu sebelum Run.");
      return;
    }
    runInFlightRef.current = true;
    setRunStarting(true);
    try {
      const checked = validation?.valid ? validation : await validate();
      if (checked?.valid !== true) return;
      const response = await fetch(`/api/flow/graphs/${encodeURIComponent(graphId)}/runs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ version, input: parseInput(runInput) }),
      });
      const body = (await response.json().catch(() => null)) as {
        runId?: string;
        traceOperationId?: string;
      } | null;
      if (!response.ok || body?.runId === undefined) {
        setMessage(errorMessage(body, `Run gagal (${response.status}).`));
        return;
      }
      setRunId(body.runId);
      setRun(null);
      setMessage(`Run ${body.runId} dimulai. Trace ${body.traceOperationId ?? "-"}.`);
    } finally {
      runInFlightRef.current = false;
      setRunStarting(false);
    }
  }
  async function decide(node: NodeRunState, decision: "APPROVE" | "REJECT"): Promise<void> {
    if (
      runId === null ||
      node.approvalKey === null ||
      pendingNodeAction !== null ||
      nodeActionInFlightRef.current
    )
      return;
    const actionKey = `${node.nodeId}:decision`;
    nodeActionInFlightRef.current = true;
    setPendingNodeAction(actionKey);
    try {
      const response = await fetch(
        `/api/flow/graph-runs/${encodeURIComponent(runId)}/nodes/${encodeURIComponent(node.nodeId)}/decision`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ decision, note: null, approvalKey: node.approvalKey }),
        },
      );
      if (!response.ok)
        setMessage(
          errorMessage(
            await response.json().catch(() => null),
            `Decision gagal (${response.status}).`,
          ),
        );
    } finally {
      nodeActionInFlightRef.current = false;
      setPendingNodeAction(null);
    }
  }
  async function submitHuman(node: NodeRunState): Promise<void> {
    if (runId === null || pendingNodeAction !== null || nodeActionInFlightRef.current) return;
    const actionKey = `${node.nodeId}:input`;
    nodeActionInFlightRef.current = true;
    setPendingNodeAction(actionKey);
    try {
      const response = await fetch(
        `/api/flow/graph-runs/${encodeURIComponent(runId)}/nodes/${encodeURIComponent(node.nodeId)}/input`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ value: parseInput(humanDraft) }),
        },
      );
      if (response.ok) setHumanDraft("");
      else
        setMessage(
          errorMessage(
            await response.json().catch(() => null),
            `Input gagal (${response.status}).`,
          ),
        );
    } finally {
      nodeActionInFlightRef.current = false;
      setPendingNodeAction(null);
    }
  }

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <div>
          <h1>ecorione — Flow</h1>
          <p>Node Registry · Visual Canvas · Temporal runtime</p>
        </div>
        <div className={styles.topActions}>
          <button
            className="ecr-btn ecr-btn--secondary"
            onClick={() => void runUiAction("Validasi gagal", validate)}
            disabled={busy || validating}
          >
            {validating ? "Validating…" : "Validate"}
          </button>
          <button
            className="ecr-btn ecr-btn--primary"
            onClick={() => void runUiAction("Save gagal", save)}
            disabled={busy}
          >
            Save
          </button>
          <button
            className="ecr-btn ecr-btn--secondary"
            onClick={() => void runUiAction("Run gagal", runGraph)}
            disabled={busy || validating || runStarting || graphId === null || dirty}
            title={dirty ? "Save perubahan terbaru sebelum Run" : undefined}
          >
            {runStarting ? "Starting…" : "Run"}
          </button>
        </div>
      </header>
      <div className={styles.metaBar}>
        <input
          className="ecr-input"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            markDraftChanged();
          }}
          aria-label="Flow name"
        />
        <input
          className="ecr-input"
          value={scope}
          onChange={(event) => {
            setScope(event.target.value);
            markDraftChanged();
          }}
          aria-label="Scope"
        />
        <select
          className="ecr-input"
          value={sensitivity}
          onChange={(event) => {
            setSensitivity(event.target.value);
            markDraftChanged();
          }}
          aria-label="Sensitivity"
        >
          <option>PUBLIC</option>
          <option>INTERNAL</option>
          <option>SENSITIVE</option>
          <option>RESTRICTED</option>
        </select>
        <input
          className="ecr-input"
          value={loadId}
          onChange={(event) => setLoadId(event.target.value)}
          placeholder="fg_…"
          aria-label="Graph id"
        />
        <button
          className="ecr-btn ecr-btn--secondary"
          onClick={() => void runUiAction("Load gagal", () => loadGraph())}
          disabled={busy}
        >
          Load
        </button>
        <code>
          {graphId ?? "unsaved"}
          {version === null ? "" : ` · v${version}`}
          {dirty ? " · unsaved changes" : ""}
        </code>
      </div>
      <main className={styles.workspace}>
        <aside className={styles.palette}>
          <div className={styles.panelTitle}>Nodes</div>
          <div className={styles.paletteList}>
            {definitions.map((definition) => (
              <button
                key={definition.id}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData("application/x-ecorione-kind", definition.kind);
                  event.dataTransfer.effectAllowed = "copy";
                }}
                onClick={() => {
                  const id = newNodeId(definition.kind);
                  setNodes((current) => {
                    const index = current.length;
                    return [
                      ...current,
                      {
                        id,
                        kind: definition.kind,
                        version: 1,
                        label: definition.label,
                        position: {
                          x: 72 + (index % 4) * 190,
                          y: 96 + Math.floor(index / 4) * 100,
                        },
                        config: defaultConfig(definition.kind),
                        secretRefs: [],
                        limits: {},
                        retry: {},
                      },
                    ];
                  });
                  setSelectedId(id);
                  markDraftChanged();
                  setMessage(`${definition.label} ditambahkan ke canvas.`);
                }}
                aria-label={`Add ${definition.label} node`}
                className={styles.paletteNode}
              >
                <strong>{definition.label}</strong>
                <span>{definition.category}</span>
              </button>
            ))}
          </div>
        </aside>
        <section className={styles.canvasWrap}>
          <div className={styles.canvasToolbar}>
            <span role="status" aria-live="polite">
              {message}
            </span>
            {connectFrom === null ? (
              <span>Klik atau drag node dari kiri. Klik node di canvas untuk edit.</span>
            ) : (
              <strong>Connect dari {connectFrom} · klik target</strong>
            )}
          </div>
          <div
            ref={canvasRef}
            className={styles.canvas}
            onDragOver={(event) => event.preventDefault()}
            onDrop={drop}
          >
            <svg className={styles.edges} aria-hidden="true">
              {edges.map((edge) => {
                const source = nodes.find((node) => node.id === edge.sourceNodeId);
                const target = nodes.find((node) => node.id === edge.targetNodeId);
                if (source === undefined || target === undefined) return null;
                const x1 = source.position.x + 170;
                const y1 = source.position.y + 32;
                const x2 = target.position.x;
                const y2 = target.position.y + 32;
                const bend = Math.max(40, Math.abs(x2 - x1) / 2);
                return (
                  <path
                    key={edge.id}
                    d={`M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`}
                  />
                );
              })}
            </svg>
            {nodes.map((node) => {
              const state = runStates.get(node.id);
              return (
                <button
                  key={node.id}
                  draggable
                  onDragStart={(event) => {
                    event.stopPropagation();
                    event.dataTransfer.setData("application/x-ecorione-node", node.id);
                    event.dataTransfer.effectAllowed = "move";
                  }}
                  onClick={() => selectNode(node.id)}
                  className={`${styles.canvasNode} ${selectedId === node.id ? styles.selected : ""} ${state === undefined ? "" : (styles[`status_${state.status.toLowerCase()}`] ?? "")}`}
                  style={{ transform: `translate(${node.position.x}px, ${node.position.y}px)` }}
                >
                  <span className={styles.nodeKind}>{node.kind}</span>
                  <strong>{node.label}</strong>
                  <small>{state?.status ?? `v${node.version}`}</small>
                </button>
              );
            })}
          </div>
        </section>
        <aside className={styles.inspector}>
          <div className={styles.panelTitle}>Inspector</div>
          {selected === null ? (
            <p className={styles.muted}>Pilih node.</p>
          ) : (
            <div className={styles.inspectorBody}>
              <label>
                Label
                <input
                  className="ecr-input"
                  value={selected.label}
                  onChange={(event) => updateSelected({ label: event.target.value })}
                />
              </label>
              <label>
                Config JSON
                <textarea
                  value={configDraft}
                  onChange={(event) => setConfigDraft(event.target.value)}
                />
              </label>
              <button className="ecr-btn ecr-btn--secondary" onClick={applyConfig}>
                Apply config
              </button>
              <label>
                Timeout ms
                <input
                  className="ecr-input"
                  type="number"
                  value={selected.limits.timeoutMs ?? ""}
                  placeholder="registry default"
                  onChange={(event) =>
                    updateSelected({
                      limits: {
                        ...selected.limits,
                        ...(event.target.value === ""
                          ? { timeoutMs: undefined }
                          : { timeoutMs: Number(event.target.value) }),
                      },
                    })
                  }
                />
              </label>
              <label>
                Retry attempts
                <input
                  className="ecr-input"
                  type="number"
                  value={selected.retry.maximumAttempts ?? ""}
                  placeholder="registry default"
                  onChange={(event) =>
                    updateSelected({
                      retry: {
                        ...selected.retry,
                        ...(event.target.value === ""
                          ? { maximumAttempts: undefined }
                          : { maximumAttempts: Number(event.target.value) }),
                      },
                    })
                  }
                />
              </label>
              {selected.kind === "condition" ? (
                <label>
                  Source port
                  <select
                    className="ecr-input"
                    value={connectPort}
                    onChange={(event) => setConnectPort(event.target.value)}
                  >
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                </label>
              ) : null}
              <button
                className="ecr-btn ecr-btn--primary"
                onClick={() => setConnectFrom(selected.id)}
              >
                Mulai koneksi
              </button>
              <button
                className="ecr-btn ecr-btn--secondary"
                onClick={removeSelected}
                disabled={selected.kind === "trigger"}
              >
                Hapus node
              </button>
            </div>
          )}
          <div className={styles.section}>
            <div className={styles.panelTitle}>Validation</div>
            {validation === null ? (
              <p className={styles.muted}>Belum divalidasi.</p>
            ) : validation.valid ? (
              <p className={styles.ok}>
                Valid · plan {validation.plan?.planDigest.slice(0, 10)}…
              </p>
            ) : (
              <ul className={styles.issueList}>
                {validation.issues.map((issue, index) => (
                  <li key={`${issue.code}-${index}`}>
                    <code>{issue.code}</code>
                    {issue.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className={styles.section}>
            <div className={styles.panelTitle}>Versions</div>
            <div className={styles.versionList}>
              {versions.map((item) => (
                <button
                  key={item.version}
                  disabled={busy}
                  onClick={() =>
                    void runUiAction("Load version gagal", () =>
                      loadGraph(item.graphId, item.version),
                    )
                  }
                >
                  v{item.version}
                  <small>{item.digest.slice(0, 8)}</small>
                </button>
              ))}
            </div>
          </div>
        </aside>
      </main>
      <section className={styles.runPanel}>
        <div>
          <div className={styles.panelTitle}>Execution</div>
          <textarea
            value={runInput}
            onChange={(event) => setRunInput(event.target.value)}
            aria-label="Run input JSON"
          />
          <div className={styles.runMeta}>
            <code>{runId ?? "no run"}</code>
            <span>{run?.status ?? "IDLE"}</span>
            <code>{run?.traceOperationId ?? "trace —"}</code>
          </div>
        </div>
        <div className={styles.runNodes}>
          {run?.nodes.map((node) => (
            <div key={node.nodeId} className={styles.runNode}>
              <code>{node.nodeId}</code>
              <strong>{node.status}</strong>
              {node.message !== null ? <span>{node.message}</span> : null}
              {node.status === "WAITING_APPROVAL" ? (
                <div className={styles.inlineActions}>
                  <button
                    className="ecr-btn ecr-btn--primary"
                    disabled={pendingNodeAction !== null}
                    onClick={() =>
                      void runUiAction("Approval gagal", () => decide(node, "APPROVE"))
                    }
                  >
                    {pendingNodeAction === `${node.nodeId}:decision` ? "Sending…" : "Approve"}
                  </button>
                  <button
                    className="ecr-btn ecr-btn--secondary"
                    disabled={pendingNodeAction !== null}
                    onClick={() =>
                      void runUiAction("Rejection gagal", () => decide(node, "REJECT"))
                    }
                  >
                    Reject
                  </button>
                </div>
              ) : null}
              {node.status === "WAITING_INPUT" ? (
                <div className={styles.inlineActions}>
                  <input
                    className="ecr-input"
                    value={humanDraft}
                    onChange={(event) => setHumanDraft(event.target.value)}
                    placeholder="human input"
                  />
                  <button
                    className="ecr-btn ecr-btn--primary"
                    disabled={pendingNodeAction !== null}
                    onClick={() => void runUiAction("Input gagal", () => submitHuman(node))}
                  >
                    {pendingNodeAction === `${node.nodeId}:input` ? "Sending…" : "Send"}
                  </button>
                </div>
              ) : null}
            </div>
          )) ?? <p className={styles.muted}>Execution status muncul setelah Run.</p>}
        </div>
      </section>
    </div>
  );
}
