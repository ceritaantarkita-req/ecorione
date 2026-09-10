import {
  ApplicationFailure,
  condition,
  defineQuery,
  defineSignal,
  executeChild,
  proxyActivities,
  setHandler,
  sleep,
} from "@temporalio/workflow";
import {
  ApprovalNodeConfigSchema,
  DelayNodeConfigSchema,
  type FlowApprovalSignal,
  type FlowCompiledNode,
  type FlowGraphExecutionInput,
  type FlowGraphExecutionResult,
  type FlowGraphNodeDecisionSignal,
  type FlowGraphNodeInputSignal,
  type FlowGraphRunState,
  type FlowNodeId,
  type FlowWorkflowInput,
  type FlowWorkflowResult,
  type OperationId,
  type WorkflowId,
} from "@ecorione/shared-schema";
import type { FlowActivities } from "./activities.js";
import { conditionGraphRoute, graphInputFromEdges, loopGraphValue, transformGraphValue } from "./graph-control.js";
import type { FlowGraphActivities } from "./graph-activities.js";

const activities = proxyActivities<FlowActivities>({
  startToCloseTimeout: "2 minutes",
  retry: { initialInterval: "1 second", backoffCoefficient: 2, maximumInterval: "10 seconds", maximumAttempts: 3 },
});

export const approvalSignal = defineSignal<[FlowApprovalSignal]>("approval");
export const operationIdQuery = defineQuery<OperationId>("operationId");
export const graphNodeDecisionSignal = defineSignal<[FlowGraphNodeDecisionSignal]>("graphNodeDecision");
export const graphNodeInputSignal = defineSignal<[FlowGraphNodeInputSignal]>("graphNodeInput");
export const graphRunStateQuery = defineQuery<FlowGraphRunState>("graphRunState");

export function transformInput(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export async function operationWorkflow(flow: FlowWorkflowInput): Promise<FlowWorkflowResult> {
  let approval: FlowApprovalSignal | undefined;
  setHandler(operationIdQuery, () => flow.operationId);
  setHandler(approvalSignal, (value) => { approval = value; });
  const transformed = transformInput(flow.inputText);
  await activities.recordTrace({ flow, name: "flow.started", attributes: { delayMs: flow.delayMs } });
  if (flow.delayMs > 0) await sleep(flow.delayMs);
  await activities.requestApproval({ flow, transformed });
  await activities.recordTrace({ flow, name: "flow.approval.waiting", attributes: { operationId: flow.operationId } });
  await condition(() => approval !== undefined);
  const decision = approval;
  if (decision === undefined || decision.decision !== "APPROVE") {
    await activities.recordTrace({ flow, name: "flow.rejected", attributes: { decision: decision?.decision ?? "UNKNOWN" } });
    throw ApplicationFailure.nonRetryable("Workflow ditolak pada human approval.", "FLOW_REJECTED");
  }
  await activities.recordTrace({ flow, name: "flow.approval.approved", attributes: { operationId: flow.operationId } });
  const ai = await activities.callAi({ flow, transformed });
  await activities.recordTrace({ flow, name: "flow.ai.completed", attributes: { operationId: flow.operationId } });
  const receipt = await activities.executeSandbox({ flow });
  await activities.recordTrace({ flow, name: "flow.sandbox.completed", attributes: { receiptId: receipt.id, exitCode: receipt.exitCode } });
  const verified = await activities.verifyExecution({ flow, receipt });
  await activities.recordTrace({ flow, name: "flow.verification.completed", attributes: { receiptId: receipt.id, verified } });
  if (!verified) {
    await activities.recordTrace({ flow, name: "flow.verification.failed", attributes: { receiptId: receipt.id } });
    throw ApplicationFailure.nonRetryable("Verifier independen tidak menemukan bukti eksekusi Sandbox yang cocok.", "FLOW_VERIFICATION_FAILED");
  }
  await activities.recordTrace({ flow, name: "flow.completed", attributes: { receiptId: receipt.id, verified: true } });
  return { flowId: flow.flowId, operationId: flow.operationId, transformed, aiReply: ai.reply, sandboxReceiptId: receipt.id, verified: true };
}

interface NodeOutput { value: unknown; route: string | null }
function graphActivitiesFor(compiled: FlowCompiledNode): FlowGraphActivities {
  return proxyActivities<FlowGraphActivities>({
    startToCloseTimeout: compiled.limits.timeoutMs,
    retry: {
      initialInterval: compiled.retry.initialIntervalMs,
      backoffCoefficient: 2,
      maximumInterval: compiled.retry.maximumIntervalMs,
      maximumAttempts: compiled.retry.maximumAttempts,
    },
  });
}
function childRunId(runId: WorkflowId, nodeId: FlowNodeId, depth: number): WorkflowId {
  return `${runId}-${nodeId}-d${String(depth)}` as WorkflowId;
}
function nodeInput(execution: FlowGraphExecutionInput, nodeId: FlowNodeId, outputs: Map<string, NodeOutput>, statuses: Map<string, string>): { active: boolean; value: unknown } {
  const incoming = execution.plan.graph.edges.filter((edge) => edge.targetNodeId === nodeId);
  if (incoming.length === 0) return { active: true, value: execution.input };
  const active: Array<{ sourceNodeId: string; value: unknown }> = [];
  for (const edge of incoming) {
    if (statuses.get(edge.sourceNodeId) !== "SUCCEEDED") continue;
    const output = outputs.get(edge.sourceNodeId);
    if (output === undefined) continue;
    const source = execution.plan.nodes.find((item) => item.node.id === edge.sourceNodeId);
    if (source?.node.kind === "condition" && output.route !== edge.sourcePort) continue;
    active.push({ sourceNodeId: edge.sourceNodeId, value: output.value });
  }
  return { active: active.length > 0, value: graphInputFromEdges(active) };
}

export async function graphExecutionWorkflow(execution: FlowGraphExecutionInput): Promise<FlowGraphExecutionResult> {
  if (execution.depth > 8) throw ApplicationFailure.nonRetryable("Subflow depth melewati batas 8.", "FLOW_SUBFLOW_DEPTH");
  const decisions = new Map<string, FlowGraphNodeDecisionSignal>();
  const humanInputs = new Map<string, unknown>();
  const outputs = new Map<string, NodeOutput>();
  const statuses = new Map<string, string>(execution.plan.nodes.map((item) => [item.node.id, "PENDING"]));
  const approvalKeys = new Map<string, string | null>(execution.plan.nodes.map((item) => [item.node.id, null]));
  const messages = new Map<string, string | null>(execution.plan.nodes.map((item) => [item.node.id, null]));
  let finalOutput: unknown = null;
  let finalError: string | null = null;
  let runStatus: "RUNNING" | "COMPLETED" | "FAILED" = "RUNNING";

  const state = (): FlowGraphRunState => ({
    runId: execution.runId,
    graphId: execution.plan.graph.id,
    graphVersion: execution.plan.graphVersion,
    traceOperationId: execution.operationId,
    status: runStatus,
    nodes: execution.plan.nodes.map((item) => ({ nodeId: item.node.id, status: statuses.get(item.node.id) as FlowGraphRunState["nodes"][number]["status"], approvalKey: approvalKeys.get(item.node.id) ?? null, message: messages.get(item.node.id) ?? null })),
    output: finalOutput,
    error: finalError,
  });
  setHandler(graphRunStateQuery, state);
  setHandler(operationIdQuery, () => execution.operationId);
  setHandler(graphNodeDecisionSignal, (signal) => { decisions.set(signal.nodeId, signal); });
  setHandler(graphNodeInputSignal, (signal) => { humanInputs.set(signal.nodeId, signal.value); });

  const byId = new Map(execution.plan.nodes.map((item) => [item.node.id, item]));

  async function executeNode(compiled: FlowCompiledNode): Promise<void> {
    const node = compiled.node;
    const incoming = nodeInput(execution, node.id, outputs, statuses);
    if (!incoming.active && node.kind !== "trigger") {
      statuses.set(node.id, "SKIPPED");
      messages.set(node.id, "No active incoming edge.");
      return;
    }
    const dynamic = graphActivitiesFor(compiled);
    statuses.set(node.id, "RUNNING");
    try {
      await dynamic.authorizeGraphNode({ execution, compiled });
      await dynamic.recordGraphTrace({ execution, compiled, name: "flow.graph.node.started", attributes: { kind: node.kind } });
      const policyKey = `${execution.runId}:${node.id}:policy`;
      if (node.kind !== "approval" && compiled.actionClass !== null) {
        const verdict = await dynamic.evaluateGraphNodePolicy({ execution, compiled, approvalKey: policyKey });
        if (verdict.outcome === "DENY") throw ApplicationFailure.nonRetryable(`Node policy ditolak: ${verdict.reason}`, "FLOW_NODE_POLICY_DENIED");
        if (verdict.outcome === "REQUIRE_APPROVAL") {
          approvalKeys.set(node.id, policyKey);
          messages.set(node.id, verdict.prompt);
          statuses.set(node.id, "WAITING_APPROVAL");
          await condition(() => decisions.has(node.id));
          const decision = decisions.get(node.id);
          if (decision?.decision !== "APPROVE") throw ApplicationFailure.nonRetryable("Node policy approval ditolak.", "FLOW_NODE_REJECTED");
          approvalKeys.set(node.id, null);
          messages.set(node.id, null);
          statuses.set(node.id, "RUNNING");
        }
      }

      let output: NodeOutput;
      if (node.kind === "trigger") output = { value: execution.input, route: null };
      else if (node.kind === "transform") output = { value: transformGraphValue(incoming.value, node.config), route: null };
      else if (node.kind === "condition") output = { value: incoming.value, route: conditionGraphRoute(incoming.value, node.config) };
      else if (node.kind === "loop") output = { value: loopGraphValue(incoming.value, node.config), route: null };
      else if (node.kind === "parallel") output = { value: incoming.value, route: null };
      else if (node.kind === "delay") {
        const cfg = DelayNodeConfigSchema.parse(node.config);
        if (cfg.milliseconds > 0) await sleep(cfg.milliseconds);
        output = { value: incoming.value, route: null };
      } else if (node.kind === "approval") {
        const cfg = ApprovalNodeConfigSchema.parse(node.config);
        const approvalKey = `${execution.runId}:${node.id}:approval`;
        const prompt = await dynamic.requestGraphApproval({ execution, compiled, approvalKey, prompt: cfg.prompt, input: incoming.value });
        approvalKeys.set(node.id, approvalKey);
        messages.set(node.id, prompt);
        statuses.set(node.id, "WAITING_APPROVAL");
        await condition(() => decisions.has(node.id));
        const decision = decisions.get(node.id);
        if (decision?.decision !== "APPROVE") throw ApplicationFailure.nonRetryable("Approval node ditolak.", "FLOW_NODE_REJECTED");
        approvalKeys.set(node.id, null);
        messages.set(node.id, null);
        statuses.set(node.id, "RUNNING");
        output = { value: incoming.value, route: null };
      } else if (node.kind === "human-input") {
        statuses.set(node.id, "WAITING_INPUT");
        messages.set(node.id, "Menunggu human input.");
        await condition(() => humanInputs.has(node.id));
        statuses.set(node.id, "RUNNING");
        messages.set(node.id, null);
        output = { value: humanInputs.get(node.id), route: null };
      } else if (node.kind === "subflow") {
        if (execution.depth >= 8) throw ApplicationFailure.nonRetryable("Subflow depth mencapai batas 8.", "FLOW_SUBFLOW_DEPTH");
        const plan = await dynamic.resolveSubflow({ execution, compiled });
        if (plan.graph.id === execution.plan.graph.id) throw ApplicationFailure.nonRetryable("Direct recursive subflow ditolak.", "FLOW_SUBFLOW_RECURSION");
        const runId = childRunId(execution.runId, node.id, execution.depth + 1);
        const child = await executeChild<FlowGraphExecutionResult>("graphExecutionWorkflow", {
          workflowId: runId,
          args: [{ runId, operationId: execution.operationId, plan, input: incoming.value, depth: execution.depth + 1 }],
        });
        output = { value: child.output, route: null };
      } else {
        output = { value: await dynamic.executeGraphNode({ execution, compiled, input: incoming.value }), route: null };
      }
      outputs.set(node.id, output);
      statuses.set(node.id, "SUCCEEDED");
      await dynamic.recordGraphTrace({ execution, compiled, name: "flow.graph.node.completed", attributes: { kind: node.kind } });
    } catch (error) {
      statuses.set(node.id, "FAILED");
      const message = error instanceof Error ? error.message.slice(0, 1000) : String(error).slice(0, 1000);
      messages.set(node.id, message);
      try { await dynamic.recordGraphTrace({ execution, compiled, name: "flow.graph.node.failed", attributes: { kind: node.kind, error: message } }); } catch { /* preserve original failure */ }
      throw error;
    }
  }

  try {
    for (const level of execution.plan.levels) {
      const ordered = level.map((id) => byId.get(id)).filter((item): item is FlowCompiledNode => item !== undefined);
      for (let index = 0; index < ordered.length; index += execution.plan.graph.maxParallelism) {
        await Promise.all(ordered.slice(index, index + execution.plan.graph.maxParallelism).map(executeNode));
      }
    }
    const outgoing = new Set(execution.plan.graph.edges.map((edge) => edge.sourceNodeId));
    const sinks = execution.plan.nodes.filter((item) => !outgoing.has(item.node.id) && statuses.get(item.node.id) === "SUCCEEDED");
    if (sinks.length === 1) finalOutput = outputs.get(sinks[0]!.node.id)?.value ?? null;
    else finalOutput = Object.fromEntries(sinks.map((item) => [item.node.id, outputs.get(item.node.id)?.value ?? null]));
    runStatus = "COMPLETED";
    return { runId: execution.runId, graphId: execution.plan.graph.id, graphVersion: execution.plan.graphVersion, output: finalOutput, traceOperationId: execution.operationId };
  } catch (error) {
    runStatus = "FAILED";
    finalError = error instanceof Error ? error.message.slice(0, 2000) : String(error).slice(0, 2000);
    throw error;
  }
}
