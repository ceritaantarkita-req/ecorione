import { createHash } from "node:crypto";
import {
  FlowGraphValidationResultSchema,
  FlowNodeDefinitionSchema,
  parseFlowNodeConfig,
  type FlowCompiledNode,
  type FlowGraphDocument,
  type FlowGraphValidationIssue,
  type FlowGraphValidationResult,
  type FlowNodeDefinition,
  type FlowNodeKind,
  type FlowNodeResourceLimits,
  type FlowNodeRetry,
} from "@ecorione/shared-schema";

const INPUT = [{ id: "in", label: "Input", valueType: "any" as const }];
const OUTPUT = [{ id: "out", label: "Output", valueType: "any" as const }];
const CONDITION_OUTPUTS = [
  { id: "true", label: "True", valueType: "any" as const },
  { id: "false", label: "False", valueType: "any" as const },
];
const DEFAULT_LIMITS: FlowNodeResourceLimits = {
  timeoutMs: 120_000,
  maxOutputBytes: 1_048_576,
  maxIterations: 100,
  maxParallelism: 4,
};
const DEFAULT_RETRY: FlowNodeRetry = {
  maximumAttempts: 3,
  initialIntervalMs: 1_000,
  maximumIntervalMs: 10_000,
};

function definition(
  kind: FlowNodeKind,
  label: string,
  category: FlowNodeDefinition["category"],
  description: string,
  options: Partial<
    Pick<
      FlowNodeDefinition,
      | "inputPorts"
      | "outputPorts"
      | "policyActionClass"
      | "sideEffect"
      | "secretRefPolicy"
      | "limits"
      | "retry"
      | "idempotency"
    >
  > = {},
): FlowNodeDefinition {
  return FlowNodeDefinitionSchema.parse({
    id: `core/${kind}/v1`,
    kind,
    version: 1,
    label,
    category,
    description,
    inputPorts: options.inputPorts ?? INPUT,
    outputPorts: options.outputPorts ?? OUTPUT,
    capabilities: [{ capabilityId: "node.execute", permissionIds: ["node.execute"] }],
    policyActionClass: options.policyActionClass ?? null,
    sideEffect: options.sideEffect ?? false,
    secretRefPolicy: options.secretRefPolicy ?? "none",
    limits: options.limits ?? DEFAULT_LIMITS,
    retry: options.retry ?? DEFAULT_RETRY,
    idempotency: options.idempotency ?? "workflow-node",
  });
}

export const CORE_NODE_DEFINITIONS: readonly FlowNodeDefinition[] = [
  definition("trigger", "Trigger", "trigger", "Entry point graph.", {
    inputPorts: [],
    retry: { ...DEFAULT_RETRY, maximumAttempts: 1 },
    idempotency: "none",
  }),
  definition(
    "ai",
    "AI",
    "ai",
    "Inference melalui Connect; model authority tetap diperiksa terpisah.",
  ),
  definition(
    "memory",
    "Memory / Context",
    "data",
    "Read-only Context retrieval melalui owner API.",
    { retry: { ...DEFAULT_RETRY, maximumAttempts: 2 } },
  ),
  definition(
    "artifact",
    "Artifact",
    "data",
    "Read artifact bytes melalui Artifact authorization boundary.",
    { retry: { ...DEFAULT_RETRY, maximumAttempts: 2 } },
  ),
  definition(
    "mcp-tool",
    "MCP Tool",
    "integration",
    "Remote MCP call melalui Connect MCP manager.",
    { sideEffect: true, idempotency: "required-key" },
  ),
  definition(
    "http",
    "HTTP / API",
    "integration",
    "Allowlisted HTTPS request tanpa inline credential.",
    { policyActionClass: "EXTERNAL_SEND", sideEffect: true, idempotency: "required-key" },
  ),
  definition(
    "transform",
    "Transform",
    "control",
    "Deterministic template/pick/merge transform.",
    { retry: { ...DEFAULT_RETRY, maximumAttempts: 1 }, idempotency: "none" },
  ),
  definition(
    "condition",
    "Condition / Switch",
    "control",
    "Deterministic true/false routing.",
    {
      outputPorts: CONDITION_OUTPUTS,
      retry: { ...DEFAULT_RETRY, maximumAttempts: 1 },
      idempotency: "none",
    },
  ),
  definition("loop", "Loop / Map", "control", "Bounded data-map operation; graph tetap DAG.", {
    retry: { ...DEFAULT_RETRY, maximumAttempts: 1 },
    idempotency: "none",
  }),
  definition(
    "parallel",
    "Parallel",
    "control",
    "Join/fan-out control node; concurrency dibatasi graph/node limit.",
    { retry: { ...DEFAULT_RETRY, maximumAttempts: 1 }, idempotency: "none" },
  ),
  definition("delay", "Delay / Schedule", "control", "Durable Temporal timer.", {
    retry: { ...DEFAULT_RETRY, maximumAttempts: 1 },
    idempotency: "none",
  }),
  definition(
    "approval",
    "Approval",
    "human",
    "Durable Hub approval committed before Temporal signal.",
    {
      policyActionClass: "IRREVERSIBLE_WRITE",
      sideEffect: true,
      retry: { ...DEFAULT_RETRY, maximumAttempts: 1 },
      idempotency: "required-key",
    },
  ),
  definition(
    "human-input",
    "Human Input",
    "human",
    "Durable Temporal wait for operator input.",
    { retry: { ...DEFAULT_RETRY, maximumAttempts: 1 }, idempotency: "none" },
  ),
  definition(
    "sandbox",
    "Sandbox Code",
    "execution",
    "Sandbox execution through governed Sandbox boundary.",
    { sideEffect: true, idempotency: "required-key" },
  ),
  definition(
    "data-owner",
    "Data Owner API",
    "data",
    "Allowlisted read-only owner-service API call.",
    { policyActionClass: "READ", retry: { ...DEFAULT_RETRY, maximumAttempts: 2 } },
  ),
  definition(
    "notification",
    "Notification",
    "integration",
    "Local trace notification baseline; external send uses MCP/HTTP.",
    { sideEffect: true, idempotency: "workflow-node" },
  ),
  definition(
    "subflow",
    "Subflow",
    "control",
    "Versioned child graph executed as Temporal child workflow.",
    { sideEffect: true, idempotency: "workflow-node" },
  ),
] as const;

const DEFINITIONS = new Map(
  CORE_NODE_DEFINITIONS.map((item) => [`${item.kind}:${item.version}`, item]),
);
const SECRET_KEY = /(authorization|cookie|credential|password|secret|token|api[_-]?key)/i;

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonical(item)]),
    );
  }
  return value;
}
export function digestCanonical(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");
}

function hasInlineSecret(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasInlineSecret);
  if (value === null || typeof value !== "object") return false;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_KEY.test(key)) return true;
    if (hasInlineSecret(child)) return true;
  }
  return false;
}

function mergeLimits(
  definitionValue: FlowNodeResourceLimits,
  override: Partial<FlowNodeResourceLimits>,
  nodeId: string,
  issues: FlowGraphValidationIssue[],
): FlowNodeResourceLimits {
  const result = { ...definitionValue };
  for (const key of Object.keys(override) as Array<keyof FlowNodeResourceLimits>) {
    const value = override[key];
    if (value !== undefined && value > definitionValue[key]) {
      issues.push({
        code: "LIMIT_ESCALATION",
        message: `${key} tidak boleh melebihi registry maximum.`,
        nodeId: nodeId as never,
        edgeId: null,
      });
    } else if (value !== undefined) result[key] = value;
  }
  return result;
}
function mergeRetry(
  definitionValue: FlowNodeRetry,
  override: Partial<FlowNodeRetry>,
  nodeId: string,
  issues: FlowGraphValidationIssue[],
): FlowNodeRetry {
  const result = { ...definitionValue };
  for (const key of Object.keys(override) as Array<keyof FlowNodeRetry>) {
    const value = override[key];
    if (value !== undefined && value > definitionValue[key]) {
      issues.push({
        code: "RETRY_ESCALATION",
        message: `${key} tidak boleh melebihi registry maximum.`,
        nodeId: nodeId as never,
        edgeId: null,
      });
    } else if (value !== undefined) result[key] = value;
  }
  return result;
}

export function listCoreNodeDefinitions(): FlowNodeDefinition[] {
  return [...CORE_NODE_DEFINITIONS];
}

export function validateAndCompileFlowGraph(
  graph: FlowGraphDocument,
  graphVersion: number,
  graphDigest: string = digestCanonical(graph),
): FlowGraphValidationResult {
  const issues: FlowGraphValidationIssue[] = [];
  const compiled: FlowCompiledNode[] = [];
  const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));

  for (const node of graph.nodes) {
    const def = DEFINITIONS.get(`${node.kind}:${node.version}`);
    if (def === undefined) {
      issues.push({
        code: "UNKNOWN_NODE_VERSION",
        message: `Node ${node.kind} v${String(node.version)} tidak ada di registry.`,
        nodeId: node.id,
        edgeId: null,
      });
      continue;
    }
    try {
      parseFlowNodeConfig(node.kind, node.config);
    } catch (error) {
      issues.push({
        code: "INVALID_NODE_CONFIG",
        message:
          error instanceof Error ? error.message.slice(0, 500) : "Config node tidak valid.",
        nodeId: node.id,
        edgeId: null,
      });
    }
    if (hasInlineSecret(node.config))
      issues.push({
        code: "INLINE_SECRET",
        message:
          "Graph config tidak boleh menyimpan field yang tampak seperti credential/secret.",
        nodeId: node.id,
        edgeId: null,
      });
    if (def.secretRefPolicy === "none" && node.secretRefs.length > 0)
      issues.push({
        code: "SECRET_REF_NOT_ALLOWED",
        message: "Node ini tidak menerima secret reference.",
        nodeId: node.id,
        edgeId: null,
      });
    if (def.secretRefPolicy === "required" && node.secretRefs.length === 0)
      issues.push({
        code: "SECRET_REF_REQUIRED",
        message: "Node ini membutuhkan secret reference.",
        nodeId: node.id,
        edgeId: null,
      });
    compiled.push({
      node,
      definitionId: def.id,
      actionClass: def.policyActionClass,
      sideEffect: def.sideEffect,
      limits: mergeLimits(def.limits, node.limits, node.id, issues),
      retry: mergeRetry(def.retry, node.retry, node.id, issues),
      idempotency: def.idempotency,
    });
  }

  for (const edge of graph.edges) {
    const source = nodeMap.get(edge.sourceNodeId);
    const target = nodeMap.get(edge.targetNodeId);
    if (source === undefined || target === undefined) continue;
    const sourceDef = DEFINITIONS.get(`${source.kind}:${source.version}`);
    const targetDef = DEFINITIONS.get(`${target.kind}:${target.version}`);
    if (
      sourceDef !== undefined &&
      !sourceDef.outputPorts.some((port) => port.id === edge.sourcePort)
    )
      issues.push({
        code: "UNKNOWN_SOURCE_PORT",
        message: `Port output ${edge.sourcePort} tidak ada.`,
        nodeId: source.id,
        edgeId: edge.id,
      });
    if (
      targetDef !== undefined &&
      !targetDef.inputPorts.some((port) => port.id === edge.targetPort)
    )
      issues.push({
        code: "UNKNOWN_TARGET_PORT",
        message: `Port input ${edge.targetPort} tidak ada.`,
        nodeId: target.id,
        edgeId: edge.id,
      });
  }

  const triggers = graph.nodes.filter((node) => node.kind === "trigger");
  if (triggers.length !== 1)
    issues.push({
      code: "TRIGGER_COUNT",
      message: "Graph harus memiliki tepat satu Trigger.",
      nodeId: null,
      edgeId: null,
    });
  const incoming = new Map(graph.nodes.map((node) => [node.id, 0]));
  const outgoing = new Map(graph.nodes.map((node) => [node.id, [] as string[]]));
  for (const edge of graph.edges) {
    if (incoming.has(edge.targetNodeId))
      incoming.set(edge.targetNodeId, (incoming.get(edge.targetNodeId) ?? 0) + 1);
    outgoing.get(edge.sourceNodeId)?.push(edge.targetNodeId);
  }
  if (triggers[0] !== undefined && (incoming.get(triggers[0].id) ?? 0) !== 0)
    issues.push({
      code: "TRIGGER_INCOMING",
      message: "Trigger tidak boleh memiliki incoming edge.",
      nodeId: triggers[0].id,
      edgeId: null,
    });

  if (triggers.length === 1) {
    const reachable = new Set<string>();
    const stack = [triggers[0]!.id];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (reachable.has(current)) continue;
      reachable.add(current);
      for (const target of outgoing.get(current) ?? []) stack.push(target);
    }
    for (const node of graph.nodes)
      if (!reachable.has(node.id))
        issues.push({
          code: "UNREACHABLE_NODE",
          message: "Node tidak reachable dari Trigger.",
          nodeId: node.id,
          edgeId: null,
        });
  }

  const indegree = new Map(incoming);
  let frontier = graph.nodes
    .filter((node) => (indegree.get(node.id) ?? 0) === 0)
    .map((node) => node.id)
    .sort();
  const levels: string[][] = [];
  let visited = 0;
  while (frontier.length > 0) {
    levels.push(frontier);
    visited += frontier.length;
    const next: string[] = [];
    for (const source of frontier) {
      for (const target of outgoing.get(source) ?? []) {
        const degree = (indegree.get(target) ?? 0) - 1;
        indegree.set(target, degree);
        if (degree === 0) next.push(target);
      }
    }
    frontier = [...new Set(next)].sort();
  }
  if (visited !== graph.nodes.length)
    issues.push({
      code: "GRAPH_CYCLE",
      message: "Graph execution harus DAG; gunakan Loop/Map node untuk iterasi bounded.",
      nodeId: null,
      edgeId: null,
    });

  if (issues.length > 0)
    return FlowGraphValidationResultSchema.parse({ valid: false, issues, plan: null });
  const planWithoutDigest = { graph, graphVersion, graphDigest, nodes: compiled, levels };
  const plan = { ...planWithoutDigest, planDigest: digestCanonical(planWithoutDigest) };
  return FlowGraphValidationResultSchema.parse({ valid: true, issues: [], plan });
}
