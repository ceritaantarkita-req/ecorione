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
import {
  ConnectionSelect,
  FlowAuthorityPanel,
  FlowExecutionPanel,
  QuickNodeSettings,
  type GraphAuthorityRequirement,
  type GraphAuthorityState,
} from "./FlowPageSections";
import {
  DRAFT_ID,
  NODE_WIDTH,
  WORKSPACE_ID,
  configSummary,
  defaultConfig,
  errorMessage,
  errorType,
  newEdgeId,
  newNodeId,
  outputOffset,
  parseInput,
} from "./flow-page-model";

type SaveResponse = { version: FlowGraphVersionView; deduplicated: boolean };
type NodeRunState = FlowGraphRunState["nodes"][number];
type BuilderTab = "nodes" | "configure";
type MobileMode = "stack" | "canvas";
type EdgeDragPayload = { sourceNodeId: string; sourcePort: string };

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
  const [authority, setAuthority] = useState<GraphAuthorityState | null>(null);
  const [authorityBusy, setAuthorityBusy] = useState(false);
  const [pendingAuthorityAction, setPendingAuthorityAction] = useState<string | null>(null);
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
    setAuthority(null);
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
      setAuthority(null);
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
      setAuthority(null);
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const graph = params.get("graph");
    if (graph === null || !/^fg_[a-z0-9][a-z0-9_-]+$/.test(graph)) return;
    const rawVersion = params.get("version");
    const parsedVersion =
      rawVersion !== null && /^[1-9][0-9]*$/.test(rawVersion) ? Number(rawVersion) : undefined;
    setLoadId(graph);
    void runUiAction("Flow deep-link gagal", () => loadGraph(graph, parsedVersion));
    // The deep-link is an initial navigation contract; later URL changes are handled by navigation.
  }, []);

  async function prepareAuthority(): Promise<GraphAuthorityState | null> {
    if (graphId === null || version === null || dirty || authorityBusy) {
      setMessage("Simpan graph/version terbaru sebelum menyiapkan authority.");
      return null;
    }
    setAuthorityBusy(true);
    setMessage("Checking Flow node authority…");
    try {
      const response = await fetch(
        `/api/flow/graphs/${encodeURIComponent(graphId)}/authority/prepare`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ version }),
        },
      );
      const body = (await response.json().catch(() => null)) as {
        ready?: boolean;
        requirements?: GraphAuthorityRequirement[];
      } | null;
      if (!response.ok || body?.ready === undefined || body.requirements === undefined) {
        setMessage(errorMessage(body, `Authority check gagal (${response.status}).`));
        return null;
      }
      const next: GraphAuthorityState = {
        ready: body.ready,
        graphVersion: version,
        requirements: body.requirements,
      };
      setAuthority(next);
      setMessage(
        body.ready
          ? "Flow authority siap untuk graph version ini."
          : "Flow membutuhkan approval node.execute sebelum Run.",
      );
      return next;
    } finally {
      setAuthorityBusy(false);
    }
  }

  async function decideAuthority(
    requirement: GraphAuthorityRequirement,
    decision: "APPROVE" | "REJECT",
  ): Promise<void> {
    if (
      graphId === null ||
      version === null ||
      requirement.operationId === null ||
      pendingAuthorityAction !== null
    ) {
      return;
    }
    const actionKey = `${requirement.definitionId}:${decision}`;
    setPendingAuthorityAction(actionKey);
    try {
      const response = await fetch(
        `/api/flow/graphs/${encodeURIComponent(graphId)}/authority/decide`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            version,
            definitionId: requirement.definitionId,
            operationId: requirement.operationId,
            decision,
          }),
        },
      );
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(errorMessage(body, `Authority decision gagal (${response.status}).`));
        return;
      }
      if (decision === "REJECT") {
        setAuthority(null);
        setMessage(`Authority ${requirement.definitionId} ditolak. Run tetap diblokir.`);
        return;
      }
      await prepareAuthority();
    } finally {
      setPendingAuthorityAction(null);
    }
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
    if (version === null) {
      setMessage("Graph version belum tersedia. Save dulu sebelum Run.");
      return;
    }
    if (authority?.graphVersion !== version || authority.ready !== true) {
      setMessage("Flow authority belum siap. Jalankan Prepare authority sebelum Run.");
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
        const type = errorType(body);
        if (type === "FLOW_NODE_AUTHORITY_DENIED") {
          setAuthority(null);
          setMessage(
            `Run diblokir oleh node authority: ${errorMessage(body, "standing grant tidak aktif")}. Jalankan Prepare authority lagi.`,
          );
        } else {
          setMessage(errorMessage(body, `Run gagal (${response.status}).`));
        }
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

  function quickNodeSettings(node: FlowGraphNode) {
    return (
      <QuickNodeSettings
        node={node}
        onRename={(nextLabel) => {
          setNodes((current) =>
            current.map((item) => (item.id === node.id ? { ...item, label: nextLabel } : item)),
          );
          markDraftChanged();
        }}
        onPatchConfig={(patch) => patchNodeConfig(node, patch)}
        onAdvanced={() => {
          selectNode(node.id, true);
          setBuilderCollapsed(false);
        }}
      />
    );
  }

  function connectionSelect(node: FlowGraphNode, port: string) {
    return (
      <ConnectionSelect
        node={node}
        port={port}
        nodes={nodes}
        onConnect={(targetNodeId) => connectNodes(node.id, port, targetNodeId)}
      />
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
            onClick={() => void runUiAction("Authority gagal", prepareAuthority)}
            disabled={
              busy ||
              validating ||
              authorityBusy ||
              graphId === null ||
              version === null ||
              dirty
            }
          >
            {authorityBusy
              ? "Checking authority…"
              : authority?.graphVersion === version && authority.ready
                ? "Authority ready"
                : "Prepare authority"}
          </button>
          <button
            className="ecr-btn ecr-btn--secondary"
            onClick={() => void runUiAction("Run gagal", runGraph)}
            disabled={
              busy ||
              validating ||
              runStarting ||
              graphId === null ||
              dirty ||
              version === null ||
              authority?.graphVersion !== version ||
              authority.ready !== true
            }
            title={
              dirty
                ? "Save perubahan terbaru sebelum Run"
                : authority?.graphVersion !== version || authority.ready !== true
                  ? "Prepare authority untuk graph version ini sebelum Run"
                  : undefined
            }
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

      <FlowAuthorityPanel
        authority={authority}
        authorityBusy={authorityBusy}
        pendingAuthorityAction={pendingAuthorityAction}
        onRefresh={() => void runUiAction("Authority refresh gagal", prepareAuthority)}
        onDecide={(requirement, decision) =>
          void runUiAction(
            decision === "APPROVE" ? "Authority approval gagal" : "Authority rejection gagal",
            () => decideAuthority(requirement, decision),
          )
        }
      />

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
                  {quickNodeSettings(selected)}
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
                    <div className={styles.nodeQuickPopover}>{quickNodeSettings(node)}</div>
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
                      {quickNodeSettings(node)}
                      <div className={styles.stackConnectionBlock}>
                        {node.kind === "condition" ? (
                          <>
                            {connectionSelect(node, "true")}
                            {connectionSelect(node, "false")}
                          </>
                        ) : (
                          connectionSelect(node, "out")
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

      <FlowExecutionPanel
        runInput={runInput}
        onRunInputChange={setRunInput}
        runId={runId}
        run={run}
        pendingNodeAction={pendingNodeAction}
        humanDraft={humanDraft}
        onHumanDraftChange={setHumanDraft}
        onDecide={(node, decision) =>
          void runUiAction(decision === "APPROVE" ? "Approval gagal" : "Rejection gagal", () =>
            decide(node, decision),
          )
        }
        onSubmitHuman={(node) => void runUiAction("Input gagal", () => submitHuman(node))}
      />
    </div>
  );
}
