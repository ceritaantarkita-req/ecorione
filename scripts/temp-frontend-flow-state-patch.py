from pathlib import Path


def replace_once(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text()
    if old not in text:
        raise SystemExit(f"{label} target not found")
    path.write_text(text.replace(old, new, 1))


flow = Path("apps/ai/app/flow/page.tsx")

replace_once(
    flow,
    '  const [busy, setBusy] = useState(false);\n  const [message, setMessage] = useState("Draft lokal");',
    '  const [busy, setBusy] = useState(false);\n  const [runStarting, setRunStarting] = useState(false);\n  const [pendingNodeAction, setPendingNodeAction] = useState<string | null>(null);\n  const [message, setMessage] = useState("Draft lokal");',
    "pending state",
)

replace_once(
    flow,
    """      const body = (await response.json().catch(() => null)) as
        (FlowGraphRunState & { temporalStatus?: string }) | null;
      if (!cancelled && response.ok && body !== null) setRun(body);""",
    """      const body = (await response.json().catch(() => null)) as
        (FlowGraphRunState & { temporalStatus?: string }) | null;
      if (!response.ok || body === null) {
        throw new Error(
          errorMessage(
            body,
            response.ok ? "Respons status run tidak valid." : `HTTP ${String(response.status)}`,
          ),
        );
      }
      if (!cancelled) setRun(body);""",
    "poll failure",
)

replace_once(
    flow,
    """  async function loadVersions(id: string): Promise<void> {
    const response = await fetch(`/api/flow/graphs/${encodeURIComponent(id)}/versions`);
    if (response.ok)
      setVersions(((await response.json()) as { versions: FlowGraphVersionView[] }).versions);
  }""",
    """  async function loadVersions(id: string): Promise<void> {
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
  }""",
    "versions failure",
)

text = flow.read_text()
start = text.index("  async function runGraph(): Promise<void> {")
end = text.index("\n  async function decide(", start)
new = """  async function runGraph(): Promise<void> {
    if (runStarting) return;
    if (graphId === null) {
      setMessage("Simpan graph sebelum Run.");
      return;
    }
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
      setRunStarting(false);
    }
  }"""
flow.write_text(text[:start] + new + text[end:])

text = flow.read_text()
start = text.index("  async function decide(")
end = text.index("\n  async function submitHuman(", start)
new = """  async function decide(node: NodeRunState, decision: "APPROVE" | "REJECT"): Promise<void> {
    if (runId === null || node.approvalKey === null || pendingNodeAction !== null) return;
    const actionKey = `${node.nodeId}:decision`;
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
      setPendingNodeAction(null);
    }
  }"""
flow.write_text(text[:start] + new + text[end:])

text = flow.read_text()
start = text.index("  async function submitHuman(")
end = text.index("\n\n  return (", start)
new = """  async function submitHuman(node: NodeRunState): Promise<void> {
    if (runId === null || pendingNodeAction !== null) return;
    const actionKey = `${node.nodeId}:input`;
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
      setPendingNodeAction(null);
    }
  }"""
flow.write_text(text[:start] + new + text[end:])

replace_once(
    flow,
    """            disabled={busy || graphId === null}
          >
            Run
""",
    """            disabled={busy || runStarting || graphId === null}
          >
            {runStarting ? "Starting…" : "Run"}
""",
    "run button",
)

replace_once(
    flow,
    """            <span>{message}</span>
            {connectFrom === null ? (
              <span>Drag node dari kiri. Klik node untuk edit.</span>""",
    """            <span role="status" aria-live="polite">
              {message}
            </span>
            {connectFrom === null ? (
              <span>Klik atau drag node dari kiri. Klik node di canvas untuk edit.</span>""",
    "status copy",
)

replace_once(
    flow,
    """                  <button
                    className="ecr-btn ecr-btn--primary"
                    onClick={() =>
                      void runUiAction("Approval gagal", () => decide(node, "APPROVE"))
                    }
                  >
                    Approve
                  </button>""",
    """                  <button
                    className="ecr-btn ecr-btn--primary"
                    disabled={pendingNodeAction !== null}
                    onClick={() =>
                      void runUiAction("Approval gagal", () => decide(node, "APPROVE"))
                    }
                  >
                    {pendingNodeAction === `${node.nodeId}:decision` ? "Sending…" : "Approve"}
                  </button>""",
    "approve lock",
)

replace_once(
    flow,
    """                  <button
                    className="ecr-btn ecr-btn--secondary"
                    onClick={() =>
                      void runUiAction("Rejection gagal", () => decide(node, "REJECT"))
                    }
                  >
                    Reject
                  </button>""",
    """                  <button
                    className="ecr-btn ecr-btn--secondary"
                    disabled={pendingNodeAction !== null}
                    onClick={() =>
                      void runUiAction("Rejection gagal", () => decide(node, "REJECT"))
                    }
                  >
                    Reject
                  </button>""",
    "reject lock",
)

replace_once(
    flow,
    """                  <button
                    className="ecr-btn ecr-btn--primary"
                    onClick={() => void runUiAction("Input gagal", () => submitHuman(node))}
                  >
                    Send
                  </button>""",
    """                  <button
                    className="ecr-btn ecr-btn--primary"
                    disabled={pendingNodeAction !== null}
                    onClick={() => void runUiAction("Input gagal", () => submitHuman(node))}
                  >
                    {pendingNodeAction === `${node.nodeId}:input` ? "Sending…" : "Send"}
                  </button>""",
    "input lock",
)
