"use client";

import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
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
const NODE_WIDTH = 196;

type SaveResponse = { version: FlowGraphVersionView; deduplicated: boolean };
type NodeRunState = FlowGraphRunState["nodes"][number];
type BuilderTab = "nodes" | "configure";
type MobileMode = "stack" | "canvas";
type EdgeDragPayload = { sourceNodeId: string; sourcePort: string };

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
    ) {
      return (error as { message: string }).message;
    }
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

function stringConfig(node: FlowGraphNode, key: string, fallback = ""): string {
  const value = node.config[key];
  return typeof value === "string" ? value : fallback;
}

function numberConfig(node: FlowGraphNode, key: string, fallback = 0): number {
  const value = node.config[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function outputOffset(node: FlowGraphNode, port: string): number {
  if (node.kind === "condition") return port === "false" ? 48 : 24;
  return 34;
}

function configSummary(node: FlowGraphNode): string {
  switch (node.kind) {
    case "ai":
      return `${stringConfig(node, "target", "local")} · ${stringConfig(node, "message", "message")}`;
    case "http":
      return `${stringConfig(node, "method", "GET")} · ${stringConfig(node, "url", "URL")}`;
    case "delay":
      return `${numberConfig(node, "milliseconds", 1000)} ms`;
    case "condition":
      return stringConfig(node, "operator", "truthy");
    case "approval":
    case "human-input":
      return stringConfig(node, "prompt", "Prompt");
    case "memory":
      return stringConfig(node, "query", "Query");
    default:
      return Object.keys(node.config).length === 0
        ? "No required config"
        : `${Object.keys(node.config).length} config field(s)`;
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
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
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
  const [builderTab, setBuilderTab] = useState<BuilderTab>("nodes");
  const [builderCollapsed, setBuilderCollapsed] = useState(false);
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null);
  const [mobileMode, setMobileMode] = useState<MobileMode>("stack");
  const busyInFlightRef = useRef(false);
  const validationInFlightRef = useRef(false);
  const runInFlightRef = useRef(false);
  const nodeActionInFlightRef = useRef(false);
  const draftRevisionRef = useRef(0);
  const selected = nodes.find((node) => node.id === selectedId) ?? null;

  const definitionsByKind = useMemo(
    () => new Map(definitions.map((item) => [item.kind, item])),
    [definitions],
  );
  const runStates = useMemo(
    () => new Map((run?.nodes ?? []).map((item) => [item.nodeId, item])),
    [run],
  );
  const orderedNodes = useMemo(
    () =>
      [...nodes].sort(
        (left, right) =>
          left.position.y - right.position.y || left.position.x - right.position.x,
      ),
    [nodes],
  );

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

  function addNode(definition: FlowNodeDefinition): void {
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
            x: 72 + (index % 4) * 220,
            y: 96 + Math.floor(index / 4) * 118,
          },
          config: defaultConfig(definition.kind),
          secretRefs: [],
          limits: {},
          retry: {},
        },
      ];
    });
    setSelectedId(id);
    setSelectedEdgeId(null);
    setBuilderTab("configure");
    markDraftChanged();
    setMessage(`${definition.label} ditambahkan ke flow.`);
  }

  function drop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect === undefined) return;
    const x = Math.max(12, event.clientX - rect.left - NODE_WIDTH / 2);
    const y = Math.max(12, event.clientY - rect.top - 30);
    const moving = event.dataTransfer.getData("application/x-ecorione-node");
    if (moving.length > 0) {
      setNodes((current) =>
        current.map((node) => (node.id === moving ? { ...node, position: { x, y } } : node)),
      );
      markDraftChanged();
      return;
    }
    const kind = event.dataTransfer.getData("application/x-ecorione-kind") as FlowNodeKind;
    const definition = definitionsByKind.get(kind);
    if (definition === undefined) return;
    const id = newNodeId(kind);
    setNodes((current) => [
      ...current,
      {
        id,
        kind,
        version: 1,
        label: definition.label,
        position: { x, y },
        config: defaultConfig(kind),
        secretRefs: [],
        limits: {},
        retry: {},
      },
    ]);
    setSelectedId(id);
    setBuilderTab("configure");
    markDraftChanged();
  }

  function selectNode(id: string, openConfigure = false): void {
    setSelectedId(id);
    setSelectedEdgeId(null);
    if (openConfigure) setBuilderTab("configure");
  }

  function connectNodes(sourceNodeId: string, sourcePort: string, targetNodeId: string): void {
    if (sourceNodeId === targetNodeId) {
      setMessage("Node tidak dapat dihubungkan ke dirinya sendiri.");
      return;
    }
    const source = nodes.find((node) => node.id === sourceNodeId);
    const target = nodes.find((node) => node.id === targetNodeId);
    if (source === undefined || target === undefined) return;
    if (target.kind === "trigger") {
      setConnectFrom(null);
      setMessage("Trigger tidak menerima koneksi masuk.");
      return;
    }
    const normalizedPort = source.kind === "condition" ? sourcePort : "out";
    const duplicate = edges.some(
      (edge) =>
        edge.sourceNodeId === sourceNodeId &&
        edge.sourcePort === normalizedPort &&
        edge.targetNodeId === targetNodeId &&
        edge.targetPort === "in",
    );
    if (duplicate) {
      setMessage("Koneksi tersebut sudah ada.");
      setConnectFrom(null);
      return;
    }
    setEdges((current) => [
      ...current,
      {
        id: newEdgeId(),
        sourceNodeId,
        sourcePort: normalizedPort,
        targetNodeId,
        targetPort: "in",
      },
    ]);
    setConnectFrom(null);
    setConnectPort("out");
    setSelectedEdgeId(null);
    markDraftChanged();
    setMessage(`${source.label} → ${target.label} terhubung.`);
  }

  function startConnection(sourceNodeId: string, sourcePort: string): void {
    setConnectFrom(sourceNodeId);
    setConnectPort(sourcePort);
    setSelectedId(sourceNodeId);
    setSelectedEdgeId(null);
    setMessage("Pilih port input node tujuan untuk menyelesaikan koneksi.");
  }

  function readEdgeDrag(event: DragEvent<HTMLElement>): EdgeDragPayload | null {
    const raw = event.dataTransfer.getData("application/x-ecorione-edge");
    if (raw.length === 0) return null;
    try {
      const parsed = JSON.parse(raw) as EdgeDragPayload;
      return parsed.sourceNodeId.length > 0 && parsed.sourcePort.length > 0 ? parsed : null;
    } catch {
      return null;
    }
  }

  function patchNodeConfig(node: FlowGraphNode, patch: Record<string, unknown>): void {
    const nextConfig = { ...node.config, ...patch };
    setNodes((current) =>
      current.map((item) => (item.id === node.id ? { ...item, config: nextConfig } : item)),
    );
    if (selectedId === node.id) setConfigDraft(JSON.stringify(nextConfig, null, 2));
    markDraftChanged();
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
    if (selected === null) return;
    setNodes((current) =>
      current.map((node) => (node.id === selected.id ? { ...node, ...patch } : node)),
    );
    markDraftChanged();
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
    setBuilderTab("nodes");
    markDraftChanged();
  }

  function removeEdge(edgeId: string): void {
    setEdges((current) => current.filter((edge) => edge.id !== edgeId));
    if (selectedEdgeId === edgeId) setSelectedEdgeId(null);
    markDraftChanged();
    setMessage("Koneksi dihapus dari draft.");
  }

  function removeSelectedEdge(): void {
    if (selectedEdgeId === null) return;
    removeEdge(selectedEdgeId);
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
      try {
        await loadVersions(body.version.graphId);
      } catch (reason) {
        const detail = reason instanceof Error ? reason.message : String(reason);
        setMessage(
          `v${body.version.version} tersimpan, tetapi riwayat versi gagal dimuat: ${detail}`,
        );
      }
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
      setSelectedEdgeId(null);
      setConfigDraft(JSON.stringify(firstNode?.config ?? {}, null, 2));
      draftRevisionRef.current += 1;
      setDirty(false);
      setValidation(body.validation);
      setMessage(`Memuat ${body.graphId} v${body.version}.`);
      try {
        await loadVersions(body.graphId);
      } catch (reason) {
        const detail = reason instanceof Error ? reason.message : String(reason);
        setMessage(
          `Graph ${body.graphId} v${body.version} termuat, tetapi riwayat versi gagal dimuat: ${detail}`,
        );
      }
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
    ) {
      return;
    }
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
      if (!response.ok) {
        setMessage(
          errorMessage(
            await response.json().catch(() => null),
            `Decision gagal (${response.status}).`,
          ),
        );
      }
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
      else {
        setMessage(
          errorMessage(
            await response.json().catch(() => null),
            `Input gagal (${response.status}).`,
          ),
        );
      }
    } finally {
      nodeActionInFlightRef.current = false;
      setPendingNodeAction(null);
    }
  }

  function renderQuickSettings(node: FlowGraphNode): ReactNode {
    const label = (
      <label className={styles.quickField}>
        <span>Label</span>
        <input
          className="ecr-input"
          value={node.label}
          onChange={(event) => {
            setNodes((current) =>
              current.map((item) =>
                item.id === node.id ? { ...item, label: event.target.value } : item,
              ),
            );
            markDraftChanged();
          }}
        />
      </label>
    );

    let primary: ReactNode = null;
    switch (node.kind) {
      case "ai":
        primary = (
          <>
            <label className={styles.quickField}>
              <span>Target</span>
              <select
                className="ecr-input"
                value={stringConfig(node, "target", "local")}
                onChange={(event) => patchNodeConfig(node, { target: event.target.value })}
              >
                <option value="local">Local</option>
                <option value="hosted">Hosted</option>
              </select>
            </label>
            <label className={styles.quickField}>
              <span>Message</span>
              <input
                className="ecr-input"
                value={stringConfig(node, "message")}
                onChange={(event) => patchNodeConfig(node, { message: event.target.value })}
              />
            </label>
          </>
        );
        break;
      case "http":
        primary = (
          <>
            <label className={styles.quickField}>
              <span>Method</span>
              <select
                className="ecr-input"
                value={stringConfig(node, "method", "GET")}
                onChange={(event) => patchNodeConfig(node, { method: event.target.value })}
              >
                <option>GET</option>
                <option>POST</option>
                <option>PUT</option>
                <option>PATCH</option>
                <option>DELETE</option>
              </select>
            </label>
            <label className={styles.quickField}>
              <span>URL</span>
              <input
                className="ecr-input"
                value={stringConfig(node, "url")}
                onChange={(event) => patchNodeConfig(node, { url: event.target.value })}
              />
            </label>
          </>
        );
        break;
      case "delay":
        primary = (
          <label className={styles.quickField}>
            <span>Delay (ms)</span>
            <input
              className="ecr-input"
              type="number"
              value={numberConfig(node, "milliseconds", 1000)}
              onChange={(event) =>
                patchNodeConfig(node, { milliseconds: Number(event.target.value) })
              }
            />
          </label>
        );
        break;
      case "condition":
        primary = (
          <label className={styles.quickField}>
            <span>Operator</span>
            <input
              className="ecr-input"
              value={stringConfig(node, "operator", "truthy")}
              onChange={(event) => patchNodeConfig(node, { operator: event.target.value })}
            />
          </label>
        );
        break;
      case "approval":
      case "human-input":
        primary = (
          <label className={styles.quickField}>
            <span>Prompt</span>
            <input
              className="ecr-input"
              value={stringConfig(node, "prompt")}
              onChange={(event) => patchNodeConfig(node, { prompt: event.target.value })}
            />
          </label>
        );
        break;
      case "memory":
        primary = (
          <label className={styles.quickField}>
            <span>Query</span>
            <input
              className="ecr-input"
              value={stringConfig(node, "query")}
              onChange={(event) => patchNodeConfig(node, { query: event.target.value })}
            />
          </label>
        );
        break;
      default:
        primary = <p className={styles.quickSummary}>{configSummary(node)}</p>;
    }

    return (
      <div className={styles.quickSettings}>
        {label}
        {primary}
        <button
          className="ecr-btn ecr-btn--secondary"
          onClick={() => {
            selectNode(node.id, true);
            setBuilderCollapsed(false);
          }}
        >
          Advanced
        </button>
      </div>
    );
  }

  function renderConnectionSelect(node: FlowGraphNode, port: string): ReactNode {
    return (
      <label className={styles.stackConnect}>
        <span>{node.kind === "condition" ? port : "Connect to"}</span>
        <select
          className="ecr-input"
          defaultValue=""
          onChange={(event) => {
            const target = event.target.value;
            if (target.length > 0) connectNodes(node.id, port, target);
            event.currentTarget.value = "";
          }}
        >
          <option value="" disabled>
            Choose node…
          </option>
          {nodes
            .filter((candidate) => candidate.id !== node.id && candidate.kind !== "trigger")
            .map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.label}
              </option>
            ))}
        </select>
      </label>
    );
  }

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.titleBlock}>
          <span className={styles.eyebrow}>Visual workflow builder</span>
          <input
            className={styles.nameInput}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              markDraftChanged();
            }}
            aria-label="Flow name"
          />
          <div className={styles.saveState}>
            <span className={dirty ? styles.unsavedDot : styles.savedDot} />
            {dirty ? "Unsaved changes" : version === null ? "Draft" : `Saved · v${version}`}
          </div>
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

      <details className={styles.detailsBar}>
        <summary>
          <span>Flow details</span>
          <code>{graphId ?? "unsaved"}</code>
        </summary>
        <div className={styles.metaGrid}>
          <label>
            Scope
            <input
              className="ecr-input"
              value={scope}
              onChange={(event) => {
                setScope(event.target.value);
                markDraftChanged();
              }}
            />
          </label>
          <label>
            Sensitivity
            <select
              className="ecr-input"
              value={sensitivity}
              onChange={(event) => {
                setSensitivity(event.target.value);
                markDraftChanged();
              }}
            >
              <option>PUBLIC</option>
              <option>INTERNAL</option>
              <option>SENSITIVE</option>
              <option>RESTRICTED</option>
            </select>
          </label>
          <label className={styles.loadField}>
            Graph id
            <span>
              <input
                className="ecr-input"
                value={loadId}
                onChange={(event) => setLoadId(event.target.value)}
                placeholder="fg_…"
              />
              <button
                className="ecr-btn ecr-btn--secondary"
                onClick={() => void runUiAction("Load gagal", () => loadGraph())}
                disabled={busy}
              >
                Load
              </button>
            </span>
          </label>
        </div>
      </details>

      <div className={styles.mobileModeSwitch} aria-label="Flow mobile view">
        <button
          className={mobileMode === "stack" ? styles.modeActive : ""}
          onClick={() => setMobileMode("stack")}
        >
          Stack
        </button>
        <button
          className={mobileMode === "canvas" ? styles.modeActive : ""}
          onClick={() => setMobileMode("canvas")}
        >
          Canvas
        </button>
      </div>

      <main
        className={`${styles.workspace} ${builderCollapsed ? styles.workspaceCollapsed : ""}`}
      >
        <aside
          className={`${styles.builder} ${builderCollapsed ? styles.builderCollapsed : ""}`}
        >
          <div className={styles.builderHeader}>
            {builderCollapsed ? null : (
              <div className={styles.builderTabs}>
                <button
                  className={builderTab === "nodes" ? styles.builderTabActive : ""}
                  onClick={() => setBuilderTab("nodes")}
                >
                  Nodes
                </button>
                <button
                  className={builderTab === "configure" ? styles.builderTabActive : ""}
                  onClick={() => setBuilderTab("configure")}
                  disabled={selected === null}
                >
                  Configure
                </button>
              </div>
            )}
            <button
              className={styles.collapseButton}
              onClick={() => setBuilderCollapsed((value) => !value)}
              aria-label={builderCollapsed ? "Expand builder panel" : "Collapse builder panel"}
              title={builderCollapsed ? "Expand builder" : "Collapse builder"}
            >
              {builderCollapsed ? "›" : "‹"}
            </button>
          </div>

          {builderCollapsed ? null : builderTab === "nodes" ? (
            <div className={styles.builderBody}>
              <div className={styles.panelIntro}>
                <strong>Add a node</strong>
                <span>Click + or drag a node onto the canvas.</span>
              </div>
              <div className={styles.paletteList}>
                {definitions.map((definition) => (
                  <button
                    key={definition.id}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData(
                        "application/x-ecorione-kind",
                        definition.kind,
                      );
                      event.dataTransfer.effectAllowed = "copy";
                    }}
                    onClick={() => addNode(definition)}
                    aria-label={`Add ${definition.label} node`}
                    className={styles.paletteNode}
                  >
                    <span className={styles.paletteIcon}>+</span>
                    <span className={styles.paletteCopy}>
                      <strong>{definition.label}</strong>
                      <small>{definition.category}</small>
                    </span>
                    <span className={styles.paletteArrow}>→</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className={styles.builderBody}>
              {selected === null ? (
                <p className={styles.muted}>Select a node to configure it.</p>
              ) : (
                <>
                  <div className={styles.panelIntro}>
                    <strong>{selected.label}</strong>
                    <span>
                      {selected.kind} · v{selected.version}
                    </span>
                  </div>
                  {renderQuickSettings(selected)}
                  <details className={styles.advancedSection}>
                    <summary>Advanced configuration</summary>
                    <div className={styles.inspectorBody}>
                      <label>
                        Config JSON
                        <textarea
                          value={configDraft}
                          onChange={(event) => setConfigDraft(event.target.value)}
                        />
                      </label>
                      <button className="ecr-btn ecr-btn--secondary" onClick={applyConfig}>
                        Apply JSON
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
                    </div>
                  </details>
                  <button
                    className="ecr-btn ecr-btn--secondary"
                    onClick={removeSelected}
                    disabled={selected.kind === "trigger"}
                  >
                    Delete node
                  </button>
                </>
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
            </div>
          )}
        </aside>

        <section
          className={`${styles.canvasWrap} ${mobileMode === "canvas" ? styles.mobileCanvasActive : ""}`}
        >
          <div className={styles.canvasToolbar}>
            <span role="status" aria-live="polite">
              {message}
            </span>
            <div className={styles.canvasToolbarActions}>
              {connectFrom === null ? (
                <span>Drag from an output dot to an input dot.</span>
              ) : (
                <strong>
                  Connecting{" "}
                  {nodes.find((node) => node.id === connectFrom)?.label ?? connectFrom} ·{" "}
                  {connectPort}
                </strong>
              )}
              {connectFrom !== null ? (
                <button
                  className={styles.linkButton}
                  onClick={() => {
                    setConnectFrom(null);
                    setMessage("Koneksi dibatalkan.");
                  }}
                >
                  Cancel
                </button>
              ) : null}
              {selectedEdgeId !== null ? (
                <button className={styles.linkButtonDanger} onClick={removeSelectedEdge}>
                  Delete edge
                </button>
              ) : null}
            </div>
          </div>
          <div
            ref={canvasRef}
            className={styles.canvas}
            onDragOver={(event) => event.preventDefault()}
            onDrop={drop}
            onClick={() => setSelectedEdgeId(null)}
          >
            <svg className={styles.edges} aria-label="Flow connections">
              {edges.map((edge) => {
                const source = nodes.find((node) => node.id === edge.sourceNodeId);
                const target = nodes.find((node) => node.id === edge.targetNodeId);
                if (source === undefined || target === undefined) return null;
                const x1 = source.position.x + NODE_WIDTH;
                const y1 = source.position.y + outputOffset(source, edge.sourcePort);
                const x2 = target.position.x;
                const y2 = target.position.y + 34;
                const bend = Math.max(40, Math.abs(x2 - x1) / 2);
                const path = `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`;
                return (
                  <g key={edge.id}>
                    <path className={styles.edgeLine} d={path} />
                    <path
                      className={`${styles.edgeHit} ${selectedEdgeId === edge.id ? styles.edgeSelected : ""}`}
                      d={path}
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedEdgeId(edge.id);
                        setConnectFrom(null);
                      }}
                    />
                  </g>
                );
              })}
            </svg>

            {nodes.map((node) => {
              const state = runStates.get(node.id);
              const expanded = expandedNodeId === node.id;
              return (
                <div
                  key={node.id}
                  className={`${styles.nodeWrap} ${selectedId === node.id ? styles.selected : ""} ${state === undefined ? "" : (styles[`status_${state.status.toLowerCase()}`] ?? "")}`}
                  style={{ transform: `translate(${node.position.x}px, ${node.position.y}px)` }}
                >
                  {node.kind === "trigger" ? null : (
                    <button
                      className={`${styles.port} ${styles.portInput}`}
                      aria-label={`Connect into ${node.label}`}
                      title="Input"
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "link";
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        const payload = readEdgeDrag(event);
                        if (payload !== null)
                          connectNodes(payload.sourceNodeId, payload.sourcePort, node.id);
                      }}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (connectFrom !== null)
                          connectNodes(connectFrom, connectPort, node.id);
                        else selectNode(node.id);
                      }}
                    />
                  )}

                  {node.kind === "condition" ? (
                    <>
                      {(["true", "false"] as const).map((port) => (
                        <button
                          key={port}
                          className={`${styles.port} ${styles.portOutput} ${port === "true" ? styles.portTrue : styles.portFalse}`}
                          draggable
                          aria-label={`Connect ${node.label} ${port} output`}
                          title={port}
                          onDragStart={(event) => {
                            event.stopPropagation();
                            event.dataTransfer.setData(
                              "application/x-ecorione-edge",
                              JSON.stringify({ sourceNodeId: node.id, sourcePort: port }),
                            );
                            event.dataTransfer.effectAllowed = "link";
                            startConnection(node.id, port);
                          }}
                          onClick={(event) => {
                            event.stopPropagation();
                            startConnection(node.id, port);
                          }}
                        >
                          <span>{port}</span>
                        </button>
                      ))}
                    </>
                  ) : (
                    <button
                      className={`${styles.port} ${styles.portOutput}`}
                      draggable
                      aria-label={`Connect from ${node.label}`}
                      title="Output"
                      onDragStart={(event) => {
                        event.stopPropagation();
                        event.dataTransfer.setData(
                          "application/x-ecorione-edge",
                          JSON.stringify({ sourceNodeId: node.id, sourcePort: "out" }),
                        );
                        event.dataTransfer.effectAllowed = "link";
                        startConnection(node.id, "out");
                      }}
                      onClick={(event) => {
                        event.stopPropagation();
                        startConnection(node.id, "out");
                      }}
                    />
                  )}

                  <div
                    role="button"
                    tabIndex={0}
                    draggable
                    onDragStart={(event) => {
                      event.stopPropagation();
                      event.dataTransfer.setData("application/x-ecorione-node", node.id);
                      event.dataTransfer.effectAllowed = "move";
                    }}
                    onClick={() => selectNode(node.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        selectNode(node.id);
                      }
                    }}
                    className={styles.nodeMain}
                  >
                    <span className={styles.nodeKind}>{node.kind}</span>
                    <strong>{node.label}</strong>
                    <small>{configSummary(node)}</small>
                    <span className={styles.nodeFooter}>
                      <span>{state?.status ?? `v${node.version}`}</span>
                      <button
                        type="button"
                        className={styles.viewMoreButton}
                        onClick={(event) => {
                          event.stopPropagation();
                          setExpandedNodeId(expanded ? null : node.id);
                          selectNode(node.id);
                        }}
                      >
                        {expanded ? "Less" : "View more"}
                      </button>
                    </span>
                  </div>
                  {expanded ? (
                    <div className={styles.nodeQuickPopover}>{renderQuickSettings(node)}</div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>

        <section
          className={`${styles.mobileStack} ${mobileMode === "stack" ? styles.mobileStackActive : ""}`}
        >
          <div className={styles.mobileStackHeader}>
            <div>
              <strong>Flow steps</strong>
              <span>
                {nodes.length} node(s) · {edges.length} connection(s)
              </span>
            </div>
            <button
              className="ecr-btn ecr-btn--secondary"
              onClick={() => {
                setBuilderCollapsed(false);
                setBuilderTab("nodes");
              }}
            >
              + Add node
            </button>
          </div>
          <div className={styles.stackList}>
            {orderedNodes.map((node, index) => {
              const expanded = expandedNodeId === node.id;
              const incoming = edges.filter((edge) => edge.targetNodeId === node.id);
              const outgoing = edges.filter((edge) => edge.sourceNodeId === node.id);
              return (
                <article key={node.id} className={styles.stackCard}>
                  <button
                    className={styles.stackCardHeader}
                    onClick={() => {
                      setExpandedNodeId(expanded ? null : node.id);
                      selectNode(node.id);
                    }}
                  >
                    <span className={styles.stackIndex}>{index + 1}</span>
                    <span>
                      <small>{node.kind}</small>
                      <strong>{node.label}</strong>
                      <em>{configSummary(node)}</em>
                    </span>
                    <b>{expanded ? "−" : "+"}</b>
                  </button>
                  <div className={styles.stackEdgeSummary}>
                    {incoming.length === 0 && outgoing.length === 0 ? (
                      <span>No connections</span>
                    ) : null}
                    {incoming.map((edge) => {
                      const source = nodes.find(
                        (candidate) => candidate.id === edge.sourceNodeId,
                      );
                      return (
                        <span key={`in-${edge.id}`}>
                          {source?.label ?? edge.sourceNodeId} [{edge.sourcePort}] →{" "}
                          {node.label}
                          {" · "}
                          <button
                            type="button"
                            className={styles.linkButtonDanger}
                            onClick={() => removeEdge(edge.id)}
                          >
                            Remove
                          </button>
                        </span>
                      );
                    })}
                    {outgoing.map((edge) => {
                      const target = nodes.find(
                        (candidate) => candidate.id === edge.targetNodeId,
                      );
                      return (
                        <span key={`out-${edge.id}`}>
                          {node.label} [{edge.sourcePort}] →{" "}
                          {target?.label ?? edge.targetNodeId}
                          {" · "}
                          <button
                            type="button"
                            className={styles.linkButtonDanger}
                            onClick={() => removeEdge(edge.id)}
                          >
                            Remove
                          </button>
                        </span>
                      );
                    })}
                  </div>
                  {expanded ? (
                    <div className={styles.stackBody}>
                      {renderQuickSettings(node)}
                      <div className={styles.stackConnectionBlock}>
                        {node.kind === "condition" ? (
                          <>
                            {renderConnectionSelect(node, "true")}
                            {renderConnectionSelect(node, "false")}
                          </>
                        ) : (
                          renderConnectionSelect(node, "out")
                        )}
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
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
