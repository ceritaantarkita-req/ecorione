import { z } from "zod";
import { ScopeSchema, SensitivitySchema } from "./classification.js";
import { FlowExecutionNodeSchema } from "./flow.js";
import {
  ArtifactIdSchema,
  OperationIdSchema,
  WorkflowIdSchema,
  WorkspaceIdSchema,
} from "./ids.js";
import { TimestampSchema } from "./memory.js";
import { ActionClassSchema } from "./policy.js";

export const FLOW_NODE_KINDS = [
  "trigger",
  "ai",
  "memory",
  "artifact",
  "mcp-tool",
  "http",
  "transform",
  "condition",
  "loop",
  "parallel",
  "delay",
  "approval",
  "human-input",
  "sandbox",
  "data-owner",
  "notification",
  "subflow",
] as const;
export const FlowNodeKindSchema = z.enum(FLOW_NODE_KINDS);
export type FlowNodeKind = z.infer<typeof FlowNodeKindSchema>;

export const FlowGraphIdSchema = z
  .string()
  .min(9)
  .max(72)
  .regex(/^fg_[a-z0-9][a-z0-9_-]+$/);
export type FlowGraphId = z.infer<typeof FlowGraphIdSchema>;
export const FlowNodeIdSchema = z
  .string()
  .min(7)
  .max(72)
  .regex(/^node_[a-z0-9][a-z0-9_-]+$/);
export type FlowNodeId = z.infer<typeof FlowNodeIdSchema>;
export const FlowEdgeIdSchema = z
  .string()
  .min(7)
  .max(72)
  .regex(/^edge_[a-z0-9][a-z0-9_-]+$/);
export type FlowEdgeId = z.infer<typeof FlowEdgeIdSchema>;

export const FlowNodeValueTypeSchema = z.enum(["any", "text", "json", "boolean", "binary"]);
export type FlowNodeValueType = z.infer<typeof FlowNodeValueTypeSchema>;
export const FlowNodePortSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .max(48)
      .regex(/^[a-z][a-z0-9_-]*$/),
    label: z.string().min(1).max(64),
    valueType: FlowNodeValueTypeSchema,
  })
  .strict();
export type FlowNodePort = z.infer<typeof FlowNodePortSchema>;

export const FlowNodeResourceLimitsSchema = z
  .object({
    timeoutMs: z
      .number()
      .int()
      .min(100)
      .max(30 * 24 * 60 * 60 * 1000),
    maxOutputBytes: z
      .number()
      .int()
      .min(256)
      .max(10 * 1024 * 1024),
    maxIterations: z.number().int().min(1).max(1000),
    maxParallelism: z.number().int().min(1).max(32),
  })
  .strict();
export type FlowNodeResourceLimits = z.infer<typeof FlowNodeResourceLimitsSchema>;
export const FlowNodeResourceOverrideSchema = FlowNodeResourceLimitsSchema.partial().strict();
export type FlowNodeResourceOverride = z.infer<typeof FlowNodeResourceOverrideSchema>;

export const FlowNodeRetrySchema = z
  .object({
    maximumAttempts: z.number().int().min(1).max(10),
    initialIntervalMs: z.number().int().min(100).max(60_000),
    maximumIntervalMs: z.number().int().min(100).max(120_000),
  })
  .strict();
export type FlowNodeRetry = z.infer<typeof FlowNodeRetrySchema>;
export const FlowNodeRetryOverrideSchema = FlowNodeRetrySchema.partial().strict();
export type FlowNodeRetryOverride = z.infer<typeof FlowNodeRetryOverrideSchema>;

export const FlowNodeCapabilityRequirementSchema = z
  .object({
    capabilityId: z.string().min(2).max(96),
    permissionIds: z.array(z.string().min(2).max(96)).min(1).max(16),
  })
  .strict();
export const FlowNodeDefinitionSchema = z
  .object({
    id: z
      .string()
      .min(4)
      .max(128)
      .regex(/^core\/[a-z0-9-]+\/v[1-9][0-9]*$/),
    kind: FlowNodeKindSchema,
    version: z.number().int().min(1).max(999),
    label: z.string().min(1).max(64),
    category: z.enum(["trigger", "ai", "data", "integration", "control", "human", "execution"]),
    description: z.string().min(1).max(512),
    inputPorts: z.array(FlowNodePortSchema).max(8),
    outputPorts: z.array(FlowNodePortSchema).min(1).max(8),
    capabilities: z.array(FlowNodeCapabilityRequirementSchema).max(8),
    policyActionClass: ActionClassSchema.nullable(),
    sideEffect: z.boolean(),
    secretRefPolicy: z.enum(["none", "optional", "required"]),
    limits: FlowNodeResourceLimitsSchema,
    retry: FlowNodeRetrySchema,
    idempotency: z.enum(["none", "workflow-node", "required-key"]),
  })
  .strict();
export type FlowNodeDefinition = z.infer<typeof FlowNodeDefinitionSchema>;

export const TriggerNodeConfigSchema = z.object({}).strict();
export const AiNodeConfigSchema = z
  .object({ target: z.enum(["hosted", "local"]), message: z.string().min(1).max(16_000) })
  .strict();
export const MemoryNodeConfigSchema = z
  .object({
    query: z.string().min(1).max(4096),
    scopes: z.array(ScopeSchema).min(1).max(8).optional(),
    k: z.number().int().min(1).max(20).default(8),
    maxSensitivity: SensitivitySchema.optional(),
    hostedEligibleOnly: z.boolean().default(false),
  })
  .strict();
export const ArtifactNodeConfigSchema = z
  .object({
    artifactId: ArtifactIdSchema,
    encoding: z.enum(["utf8", "base64"]).default("utf8"),
  })
  .strict();
export const McpToolNodeConfigSchema = z
  .object({
    serverId: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-z0-9][a-z0-9._-]*$/),
    tool: z.string().min(1).max(128),
    arguments: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();
export const HttpNodeConfigSchema = z
  .object({
    url: z.string().url(),
    method: z.enum(["GET", "POST"]).default("GET"),
    headers: z.record(z.string().min(1).max(128), z.string().max(8192)).default({}),
    body: z.unknown().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const url = new URL(value.url);
    if (
      url.protocol !== "https:" ||
      url.username !== "" ||
      url.password !== "" ||
      url.hash !== ""
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["url"],
        message: "HTTP node wajib HTTPS tanpa inline credential atau fragment.",
      });
    }
    for (const name of Object.keys(value.headers)) {
      if (/^(authorization|cookie|proxy-authorization|x-api-key)$/i.test(name)) {
        ctx.addIssue({
          code: "custom",
          path: ["headers", name],
          message: "Credential header tidak boleh disimpan inline di graph.",
        });
      }
    }
  });
export const TransformNodeConfigSchema = z
  .object({
    mode: z.enum(["template", "pick", "merge"]),
    template: z.string().max(16_000).optional(),
    path: z.string().max(256).optional(),
    value: z.record(z.string(), z.unknown()).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.mode === "template" && value.template === undefined)
      ctx.addIssue({
        code: "custom",
        path: ["template"],
        message: "template wajib untuk mode template.",
      });
    if (value.mode === "pick" && value.path === undefined)
      ctx.addIssue({ code: "custom", path: ["path"], message: "path wajib untuk mode pick." });
    if (value.mode === "merge" && value.value === undefined)
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message: "value wajib untuk mode merge.",
      });
  });
export const ConditionNodeConfigSchema = z
  .object({
    path: z.string().max(256).optional(),
    operator: z.enum(["eq", "neq", "exists", "truthy", "gt", "gte", "lt", "lte"]),
    value: z.unknown().optional(),
  })
  .strict();
export const LoopNodeConfigSchema = z
  .object({
    path: z.string().max(256).optional(),
    mode: z.enum(["identity", "pick"]).default("identity"),
    pickPath: z.string().max(256).optional(),
    maxIterations: z.number().int().min(1).max(1000).default(100),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.mode === "pick" && value.pickPath === undefined)
      ctx.addIssue({
        code: "custom",
        path: ["pickPath"],
        message: "pickPath wajib untuk loop mode pick.",
      });
  });
export const ParallelNodeConfigSchema = z.object({}).strict();
export const DelayNodeConfigSchema = z
  .object({
    milliseconds: z
      .number()
      .int()
      .min(0)
      .max(30 * 24 * 60 * 60 * 1000),
  })
  .strict();
export const ApprovalNodeConfigSchema = z
  .object({ prompt: z.string().min(1).max(1024) })
  .strict();
export const HumanInputNodeConfigSchema = z
  .object({ prompt: z.string().min(1).max(1024) })
  .strict();
export const SandboxNodeConfigSchema = FlowExecutionNodeSchema;
export const DataOwnerNodeConfigSchema = z
  .object({
    service: z.enum(["context", "artifact", "space", "rnd", "hub", "connect"]),
    path: z
      .string()
      .min(4)
      .max(2048)
      .regex(/^\/v1\/[A-Za-z0-9_?&=/%.-]+$/),
  })
  .strict();
export const NotificationNodeConfigSchema = z
  .object({ message: z.string().min(1).max(2048) })
  .strict();
export const SubflowNodeConfigSchema = z
  .object({
    graphId: FlowGraphIdSchema,
    version: z.number().int().min(1).optional(),
    waitForCompletion: z.literal(true).default(true),
  })
  .strict();

export type FlowNodeConfig =
  | z.infer<typeof TriggerNodeConfigSchema>
  | z.infer<typeof AiNodeConfigSchema>
  | z.infer<typeof MemoryNodeConfigSchema>
  | z.infer<typeof ArtifactNodeConfigSchema>
  | z.infer<typeof McpToolNodeConfigSchema>
  | z.infer<typeof HttpNodeConfigSchema>
  | z.infer<typeof TransformNodeConfigSchema>
  | z.infer<typeof ConditionNodeConfigSchema>
  | z.infer<typeof LoopNodeConfigSchema>
  | z.infer<typeof ParallelNodeConfigSchema>
  | z.infer<typeof DelayNodeConfigSchema>
  | z.infer<typeof ApprovalNodeConfigSchema>
  | z.infer<typeof HumanInputNodeConfigSchema>
  | z.infer<typeof SandboxNodeConfigSchema>
  | z.infer<typeof DataOwnerNodeConfigSchema>
  | z.infer<typeof NotificationNodeConfigSchema>
  | z.infer<typeof SubflowNodeConfigSchema>;

export function parseFlowNodeConfig(kind: FlowNodeKind, input: unknown): FlowNodeConfig {
  switch (kind) {
    case "trigger":
      return TriggerNodeConfigSchema.parse(input);
    case "ai":
      return AiNodeConfigSchema.parse(input);
    case "memory":
      return MemoryNodeConfigSchema.parse(input);
    case "artifact":
      return ArtifactNodeConfigSchema.parse(input);
    case "mcp-tool":
      return McpToolNodeConfigSchema.parse(input);
    case "http":
      return HttpNodeConfigSchema.parse(input);
    case "transform":
      return TransformNodeConfigSchema.parse(input);
    case "condition":
      return ConditionNodeConfigSchema.parse(input);
    case "loop":
      return LoopNodeConfigSchema.parse(input);
    case "parallel":
      return ParallelNodeConfigSchema.parse(input);
    case "delay":
      return DelayNodeConfigSchema.parse(input);
    case "approval":
      return ApprovalNodeConfigSchema.parse(input);
    case "human-input":
      return HumanInputNodeConfigSchema.parse(input);
    case "sandbox":
      return SandboxNodeConfigSchema.parse(input);
    case "data-owner":
      return DataOwnerNodeConfigSchema.parse(input);
    case "notification":
      return NotificationNodeConfigSchema.parse(input);
    case "subflow":
      return SubflowNodeConfigSchema.parse(input);
  }
}

export const FlowGraphNodeSchema = z
  .object({
    id: FlowNodeIdSchema,
    kind: FlowNodeKindSchema,
    version: z.number().int().min(1).max(999).default(1),
    label: z.string().min(1).max(96),
    position: z.object({ x: z.number().finite(), y: z.number().finite() }).strict(),
    config: z.record(z.string(), z.unknown()).default({}),
    secretRefs: z
      .array(
        z
          .string()
          .min(1)
          .max(128)
          .regex(/^[a-z0-9][a-z0-9._:/-]*$/),
      )
      .max(16)
      .default([]),
    limits: FlowNodeResourceOverrideSchema.default({}),
    retry: FlowNodeRetryOverrideSchema.default({}),
  })
  .strict();
export type FlowGraphNode = z.infer<typeof FlowGraphNodeSchema>;
export const FlowGraphEdgeSchema = z
  .object({
    id: FlowEdgeIdSchema,
    sourceNodeId: FlowNodeIdSchema,
    sourcePort: z.string().min(1).max(48).default("out"),
    targetNodeId: FlowNodeIdSchema,
    targetPort: z.string().min(1).max(48).default("in"),
  })
  .strict();
export type FlowGraphEdge = z.infer<typeof FlowGraphEdgeSchema>;
export const FlowGraphViewportSchema = z
  .object({ x: z.number().finite(), y: z.number().finite(), zoom: z.number().min(0.2).max(3) })
  .strict();

const GraphFields = {
  workspaceId: WorkspaceIdSchema,
  name: z.string().min(1).max(160),
  scope: ScopeSchema,
  sensitivity: SensitivitySchema,
  maxParallelism: z.number().int().min(1).max(16).default(4),
  nodes: z.array(FlowGraphNodeSchema).min(1).max(100),
  edges: z.array(FlowGraphEdgeSchema).max(300),
  viewport: FlowGraphViewportSchema.default({ x: 0, y: 0, zoom: 1 }),
} as const;

function structuralGraphChecks(
  value: { nodes: readonly FlowGraphNode[]; edges: readonly FlowGraphEdge[] },
  ctx: z.RefinementCtx,
): void {
  const nodes = new Set<string>();
  for (const [index, node] of value.nodes.entries()) {
    if (nodes.has(node.id))
      ctx.addIssue({
        code: "custom",
        path: ["nodes", index, "id"],
        message: `node id duplikat: ${node.id}`,
      });
    nodes.add(node.id);
  }
  const edges = new Set<string>();
  for (const [index, edge] of value.edges.entries()) {
    if (edges.has(edge.id))
      ctx.addIssue({
        code: "custom",
        path: ["edges", index, "id"],
        message: `edge id duplikat: ${edge.id}`,
      });
    edges.add(edge.id);
    if (!nodes.has(edge.sourceNodeId))
      ctx.addIssue({
        code: "custom",
        path: ["edges", index, "sourceNodeId"],
        message: "source node tidak ada.",
      });
    if (!nodes.has(edge.targetNodeId))
      ctx.addIssue({
        code: "custom",
        path: ["edges", index, "targetNodeId"],
        message: "target node tidak ada.",
      });
    if (edge.sourceNodeId === edge.targetNodeId)
      ctx.addIssue({
        code: "custom",
        path: ["edges", index],
        message: "self edge tidak diizinkan.",
      });
  }
}

export const FlowGraphDocumentSchema = z
  .object({ id: FlowGraphIdSchema, ...GraphFields })
  .strict()
  .superRefine(structuralGraphChecks);
export type FlowGraphDocument = z.infer<typeof FlowGraphDocumentSchema>;
export const FlowGraphCreateRequestSchema = z
  .object(GraphFields)
  .strict()
  .superRefine(structuralGraphChecks);
export type FlowGraphCreateRequest = z.infer<typeof FlowGraphCreateRequestSchema>;
export const FlowGraphUpdateRequestSchema = z
  .object({ ...GraphFields, expectedVersion: z.number().int().min(1) })
  .strict()
  .superRefine(structuralGraphChecks);
export type FlowGraphUpdateRequest = z.infer<typeof FlowGraphUpdateRequestSchema>;

export const FlowGraphValidationIssueSchema = z
  .object({
    code: z.string().min(1).max(64),
    message: z.string().min(1).max(512),
    nodeId: FlowNodeIdSchema.nullable().default(null),
    edgeId: FlowEdgeIdSchema.nullable().default(null),
  })
  .strict();
export type FlowGraphValidationIssue = z.infer<typeof FlowGraphValidationIssueSchema>;
export const FlowCompiledNodeSchema = z
  .object({
    node: FlowGraphNodeSchema,
    definitionId: z.string().min(1),
    actionClass: ActionClassSchema.nullable(),
    sideEffect: z.boolean(),
    limits: FlowNodeResourceLimitsSchema,
    retry: FlowNodeRetrySchema,
    idempotency: z.enum(["none", "workflow-node", "required-key"]),
  })
  .strict();
export type FlowCompiledNode = z.infer<typeof FlowCompiledNodeSchema>;
export const CompiledFlowGraphPlanSchema = z
  .object({
    graph: FlowGraphDocumentSchema,
    graphVersion: z.number().int().min(1),
    graphDigest: z.string().regex(/^[a-f0-9]{64}$/),
    planDigest: z.string().regex(/^[a-f0-9]{64}$/),
    nodes: z.array(FlowCompiledNodeSchema).min(1).max(100),
    levels: z.array(z.array(FlowNodeIdSchema).min(1)).min(1),
  })
  .strict();
export type CompiledFlowGraphPlan = z.infer<typeof CompiledFlowGraphPlanSchema>;
export const FlowGraphValidationResultSchema = z
  .object({
    valid: z.boolean(),
    issues: z.array(FlowGraphValidationIssueSchema),
    plan: CompiledFlowGraphPlanSchema.nullable(),
  })
  .strict();
export type FlowGraphValidationResult = z.infer<typeof FlowGraphValidationResultSchema>;
export const FlowGraphVersionViewSchema = z
  .object({
    graphId: FlowGraphIdSchema,
    version: z.number().int().min(1),
    digest: z.string().regex(/^[a-f0-9]{64}$/),
    graph: FlowGraphDocumentSchema,
    validation: FlowGraphValidationResultSchema,
    createdAt: TimestampSchema,
  })
  .strict();
export type FlowGraphVersionView = z.infer<typeof FlowGraphVersionViewSchema>;
export const FlowGraphSummarySchema = z
  .object({
    graphId: FlowGraphIdSchema,
    workspaceId: WorkspaceIdSchema,
    name: z.string(),
    scope: ScopeSchema,
    sensitivity: SensitivitySchema,
    currentVersion: z.number().int().min(1),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
  })
  .strict();
export type FlowGraphSummary = z.infer<typeof FlowGraphSummarySchema>;
export const FlowGraphSaveResultSchema = z
  .object({ version: FlowGraphVersionViewSchema, deduplicated: z.boolean() })
  .strict();
export type FlowGraphSaveResult = z.infer<typeof FlowGraphSaveResultSchema>;

export const FlowGraphRunRequestSchema = z.object({
  version: z.number().int().min(1).optional(),
  input: z.unknown().default(null),
});
export const FlowGraphRunResponseSchema = z
  .object({
    runId: WorkflowIdSchema,
    graphId: FlowGraphIdSchema,
    graphVersion: z.number().int().min(1),
    temporalWorkflowId: WorkflowIdSchema,
    traceOperationId: OperationIdSchema,
    planDigest: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export type FlowGraphRunResponse = z.infer<typeof FlowGraphRunResponseSchema>;
export const FlowGraphNodeDecisionSignalSchema = z
  .object({
    nodeId: FlowNodeIdSchema,
    decision: z.enum(["APPROVE", "REJECT"]),
    note: z.string().max(1024).nullable().default(null),
  })
  .strict();
export type FlowGraphNodeDecisionSignal = z.infer<typeof FlowGraphNodeDecisionSignalSchema>;
export const FlowGraphNodeInputSignalSchema = z
  .object({ nodeId: FlowNodeIdSchema, value: z.unknown() })
  .strict();
export type FlowGraphNodeInputSignal = z.infer<typeof FlowGraphNodeInputSignalSchema>;
export const FlowGraphDecisionRequestSchema = z
  .object({
    decision: z.enum(["APPROVE", "REJECT"]),
    note: z.string().max(1024).nullable().default(null),
    approvalKey: z.string().min(8).max(256),
  })
  .strict();
export const FlowGraphHumanInputRequestSchema = z.object({ value: z.unknown() }).strict();

export const FLOW_GRAPH_NODE_STATUSES = [
  "PENDING",
  "RUNNING",
  "WAITING_APPROVAL",
  "WAITING_INPUT",
  "SUCCEEDED",
  "SKIPPED",
  "FAILED",
] as const;
export const FlowGraphNodeStatusSchema = z.enum(FLOW_GRAPH_NODE_STATUSES);
export const FlowGraphNodeStateSchema = z
  .object({
    nodeId: FlowNodeIdSchema,
    status: FlowGraphNodeStatusSchema,
    approvalKey: z.string().nullable().default(null),
    message: z.string().max(1024).nullable().default(null),
  })
  .strict();
export const FlowGraphRunStateSchema = z
  .object({
    runId: WorkflowIdSchema,
    graphId: FlowGraphIdSchema,
    graphVersion: z.number().int().min(1),
    traceOperationId: OperationIdSchema,
    status: z.enum(["RUNNING", "COMPLETED", "FAILED"]),
    nodes: z.array(FlowGraphNodeStateSchema),
    output: z.unknown().nullable(),
    error: z.string().nullable(),
  })
  .strict();
export type FlowGraphRunState = z.infer<typeof FlowGraphRunStateSchema>;
export const FlowGraphExecutionInputSchema = z
  .object({
    runId: WorkflowIdSchema,
    operationId: OperationIdSchema,
    plan: CompiledFlowGraphPlanSchema,
    input: z.unknown(),
    depth: z.number().int().min(0).max(8).default(0),
  })
  .strict();
export type FlowGraphExecutionInput = z.infer<typeof FlowGraphExecutionInputSchema>;
export const FlowGraphExecutionResultSchema = z
  .object({
    runId: WorkflowIdSchema,
    graphId: FlowGraphIdSchema,
    graphVersion: z.number().int().min(1),
    output: z.unknown(),
    traceOperationId: OperationIdSchema,
  })
  .strict();
export type FlowGraphExecutionResult = z.infer<typeof FlowGraphExecutionResultSchema>;
