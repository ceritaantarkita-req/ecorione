import type { FlowGraphNode, FlowGraphRunState } from "@ecorione/shared-schema";
import styles from "./FlowCanvas.module.css";
import { configSummary, numberConfig, stringConfig } from "./flow-page-model";

export type GraphAuthorityRequirement = {
  definitionId: string;
  nodeIds: string[];
  status: "GRANTED" | "APPROVAL_REQUIRED";
  operationId: string | null;
  prompt: string | null;
};

export type GraphAuthorityState = {
  ready: boolean;
  graphVersion: number;
  requirements: GraphAuthorityRequirement[];
};

type NodeRunState = FlowGraphRunState["nodes"][number];

export function QuickNodeSettings({
  node,
  onRename,
  onPatchConfig,
  onAdvanced,
}: {
  node: FlowGraphNode;
  onRename: (label: string) => void;
  onPatchConfig: (patch: Record<string, unknown>) => void;
  onAdvanced: () => void;
}) {
  let primary = null;
  switch (node.kind) {
    case "ai":
      primary = (
        <>
          <label className={styles.quickField}>
            <span>Target</span>
            <select
              className="ecr-input"
              value={stringConfig(node, "target", "local")}
              onChange={(event) => onPatchConfig({ target: event.target.value })}
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
              onChange={(event) => onPatchConfig({ message: event.target.value })}
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
              onChange={(event) => onPatchConfig({ method: event.target.value })}
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
              onChange={(event) => onPatchConfig({ url: event.target.value })}
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
            onChange={(event) => onPatchConfig({ milliseconds: Number(event.target.value) })}
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
            onChange={(event) => onPatchConfig({ operator: event.target.value })}
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
            onChange={(event) => onPatchConfig({ prompt: event.target.value })}
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
            onChange={(event) => onPatchConfig({ query: event.target.value })}
          />
        </label>
      );
      break;
    default:
      primary = <p className={styles.quickSummary}>{configSummary(node)}</p>;
  }

  return (
    <div className={styles.quickSettings}>
      <label className={styles.quickField}>
        <span>Label</span>
        <input
          className="ecr-input"
          value={node.label}
          onChange={(event) => onRename(event.target.value)}
        />
      </label>
      {primary}
      <button className="ecr-btn ecr-btn--secondary" onClick={onAdvanced}>
        Advanced
      </button>
    </div>
  );
}

export function ConnectionSelect({
  node,
  port,
  nodes,
  onConnect,
}: {
  node: FlowGraphNode;
  port: string;
  nodes: FlowGraphNode[];
  onConnect: (targetNodeId: string) => void;
}) {
  return (
    <label className={styles.stackConnect}>
      <span>{node.kind === "condition" ? port : "Connect to"}</span>
      <select
        className="ecr-input"
        defaultValue=""
        onChange={(event) => {
          const target = event.target.value;
          if (target.length > 0) onConnect(target);
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

export function FlowAuthorityPanel({
  authority,
  authorityBusy,
  pendingAuthorityAction,
  onRefresh,
  onDecide,
}: {
  authority: GraphAuthorityState | null;
  authorityBusy: boolean;
  pendingAuthorityAction: string | null;
  onRefresh: () => void;
  onDecide: (
    requirement: GraphAuthorityRequirement,
    decision: "APPROVE" | "REJECT",
  ) => void;
}) {
  if (authority === null) return null;

  return (
    <section className={styles.authorityPanel} aria-label="Flow execution authority">
      <div className={styles.authorityHeader}>
        <div>
          <strong>{authority.ready ? "Execution authority ready" : "Approval required"}</strong>
          <span>Graph v{authority.graphVersion} · exact node.execute grants</span>
        </div>
        <button
          className="ecr-btn ecr-btn--secondary"
          disabled={authorityBusy || pendingAuthorityAction !== null}
          onClick={onRefresh}
        >
          Refresh
        </button>
      </div>
      {authority.requirements.map((requirement) => (
        <div className={styles.authorityRequirement} key={requirement.definitionId}>
          <div>
            <code>{requirement.definitionId}</code>
            <span>
              {requirement.nodeIds.length} node(s) ·{" "}
              {requirement.status === "GRANTED" ? "Granted" : requirement.prompt}
            </span>
          </div>
          {requirement.status === "APPROVAL_REQUIRED" &&
          requirement.operationId !== null ? (
            <div className={styles.inlineActions}>
              <button
                className="ecr-btn ecr-btn--primary"
                disabled={pendingAuthorityAction !== null}
                onClick={() => onDecide(requirement, "APPROVE")}
              >
                {pendingAuthorityAction === `${requirement.definitionId}:APPROVE`
                  ? "Approving…"
                  : "Approve"}
              </button>
              <button
                className="ecr-btn ecr-btn--secondary"
                disabled={pendingAuthorityAction !== null}
                onClick={() => onDecide(requirement, "REJECT")}
              >
                Reject
              </button>
            </div>
          ) : null}
        </div>
      ))}
    </section>
  );
}

export function FlowExecutionPanel({
  runInput,
  onRunInputChange,
  runId,
  run,
  pendingNodeAction,
  humanDraft,
  onHumanDraftChange,
  onDecide,
  onSubmitHuman,
}: {
  runInput: string;
  onRunInputChange: (value: string) => void;
  runId: string | null;
  run: (FlowGraphRunState & { temporalStatus?: string }) | null;
  pendingNodeAction: string | null;
  humanDraft: string;
  onHumanDraftChange: (value: string) => void;
  onDecide: (node: NodeRunState, decision: "APPROVE" | "REJECT") => void;
  onSubmitHuman: (node: NodeRunState) => void;
}) {
  return (
    <section className={styles.runPanel}>
      <div>
        <div className={styles.panelTitle}>Execution</div>
        <textarea
          value={runInput}
          onChange={(event) => onRunInputChange(event.target.value)}
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
                  onClick={() => onDecide(node, "APPROVE")}
                >
                  {pendingNodeAction === `${node.nodeId}:decision` ? "Sending…" : "Approve"}
                </button>
                <button
                  className="ecr-btn ecr-btn--secondary"
                  disabled={pendingNodeAction !== null}
                  onClick={() => onDecide(node, "REJECT")}
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
                  onChange={(event) => onHumanDraftChange(event.target.value)}
                  placeholder="human input"
                />
                <button
                  className="ecr-btn ecr-btn--primary"
                  disabled={pendingNodeAction !== null}
                  onClick={() => onSubmitHuman(node)}
                >
                  {pendingNodeAction === `${node.nodeId}:input` ? "Sending…" : "Send"}
                </button>
              </div>
            ) : null}
          </div>
        )) ?? <p className={styles.muted}>Execution status muncul setelah Run.</p>}
      </div>
    </section>
  );
}
