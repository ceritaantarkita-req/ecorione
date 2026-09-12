from pathlib import Path


def replace_once(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text()
    if old not in text:
        raise SystemExit(f"{label} target not found")
    path.write_text(text.replace(old, new, 1))


def replace_between(path: Path, start_marker: str, end_marker: str, replacement: str, label: str) -> None:
    text = path.read_text()
    try:
        start = text.index(start_marker)
        end = text.index(end_marker, start)
    except ValueError as exc:
        raise SystemExit(f"{label} target not found") from exc
    path.write_text(text[:start] + replacement + text[end:])


settings = Path("apps/ai/app/settings/page.tsx")
replace_once(
    settings,
    'import { useCallback, useEffect, useState } from "react";',
    'import { useCallback, useEffect, useRef, useState } from "react";',
    "settings useRef",
)
replace_once(
    settings,
    '  const [status, setStatus] = useState("Loading control state…");',
    '''  const [status, setStatus] = useState("Loading control state…");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const actionInFlight = useRef(false);

  function beginAction(action: string): boolean {
    if (actionInFlight.current) return false;
    actionInFlight.current = true;
    setPendingAction(action);
    return true;
  }

  function finishAction(): void {
    actionInFlight.current = false;
    setPendingAction(null);
  }''',
    "settings pending state",
)

replace_between(
    settings,
    "  async function saveRuntime() {",
    "\n  async function saveCredential() {",
    '''  async function saveRuntime() {
    if (runtime === null || !beginAction("runtime")) return;
    const requestedHosted = runtime.settings.hostedCallsEnabled;
    setStatus("Saving runtime settings…");
    try {
      const result = await json<RuntimeSnapshot>("/api/settings/settings/runtime", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(runtime.settings),
      });
      setRuntime(result);
      if (requestedHosted && !result.settings.hostedCallsEnabled) {
        setStatus(
          `Runtime revision ${String(result.revision)} saved. Hosted remains OFF because the operator gate is closed.`,
        );
      } else {
        setStatus(`Runtime settings saved at revision ${String(result.revision)}.`);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      finishAction();
    }
  }''',
    "save runtime",
)
replace_between(
    settings,
    "  async function saveCredential() {",
    "\n  async function runCanary() {",
    '''  async function saveCredential() {
    if (!beginAction("credential")) return;
    setStatus("Encrypting credential…");
    try {
      await json(`/api/settings/settings/credentials/${secretProvider}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ secret }),
      });
      setSecret("");
      await refresh();
      setStatus("Credential encrypted in Connect vault. Plaintext was not returned.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      finishAction();
    }
  }''',
    "save credential",
)
replace_between(
    settings,
    "  async function runCanary() {",
    "\n  async function saveMcpServer() {",
    '''  async function runCanary() {
    if (!beginAction("canary")) return;
    setStatus("Running local canary…");
    try {
      const result = await json<{
        pass: boolean;
        latencyMs: number;
        provider: string;
        model: string;
      }>("/api/settings/ops/provider-canary", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target: "local" }),
      });
      setStatus(
        `Canary ${result.pass ? "PASS" : "FAIL"}: ${result.provider}/${result.model} ${result.latencyMs.toFixed(1)}ms`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      finishAction();
    }
  }''',
    "run canary",
)
replace_between(
    settings,
    "  async function saveMcpServer() {",
    "\n\n  return (",
    '''  async function saveMcpServer() {
    if (!beginAction("mcp")) return;
    setStatus("Validating and saving MCP server…");
    try {
      const parsed = JSON.parse(mcpJson) as McpServer;
      await json(`/api/settings/settings/mcp/servers/${encodeURIComponent(parsed.id)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed),
      });
      await refreshMcp();
      setStatus(
        "MCP server configuration saved. Execution permission is still evaluated separately.",
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      finishAction();
    }
  }''',
    "save mcp",
)

replace_once(
    settings,
    '''              <button type="button" onClick={() => void saveRuntime()}>
                Save runtime
              </button>''',
    '''              <button
                type="button"
                disabled={pendingAction !== null}
                onClick={() => void saveRuntime()}
              >
                {pendingAction === "runtime" ? "Saving…" : "Save runtime"}
              </button>''',
    "runtime button",
)
replace_once(
    settings,
    '''              <button
                type="button"
                className={styles.secondary}
                onClick={() => void runCanary()}
              >
                Run local canary
              </button>''',
    '''              <button
                type="button"
                className={styles.secondary}
                disabled={pendingAction !== null}
                onClick={() => void runCanary()}
              >
                {pendingAction === "canary" ? "Running…" : "Run local canary"}
              </button>''',
    "canary button",
)
replace_once(
    settings,
    '''          <button
            type="button"
            disabled={secret.length === 0}
            onClick={() => void saveCredential()}
          >
            Encrypt & save
          </button>''',
    '''          <button
            type="button"
            disabled={secret.length === 0 || pendingAction !== null}
            onClick={() => void saveCredential()}
          >
            {pendingAction === "credential" ? "Encrypting…" : "Encrypt & save"}
          </button>''',
    "credential button",
)
replace_once(
    settings,
    '''          <button
            type="button"
            disabled={mcpJson.trim().length === 0}
            onClick={() => void saveMcpServer()}
          >
            Validate & save MCP server
          </button>''',
    '''          <button
            type="button"
            disabled={mcpJson.trim().length === 0 || pendingAction !== null}
            onClick={() => void saveMcpServer()}
          >
            {pendingAction === "mcp" ? "Saving…" : "Validate & save MCP server"}
          </button>''',
    "mcp button",
)

space = Path("apps/ai/app/space/page.tsx")
replace_once(
    space,
    '  const [notice, setNotice] = useState<string | null>(null);',
    '  const [notice, setNotice] = useState<string | null>(null);\n  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);',
    "delete confirm state",
)
replace_once(
    space,
    '''      setSelectedBlockId(null);
      await loadPage(document.page.id);''',
    '''      setSelectedBlockId(null);
      setDeleteConfirmId(null);
      await loadPage(document.page.id);''',
    "delete reset",
)
replace_once(
    space,
    '''                          <button
                            type="button"
                            className={`${styles.iconButton} ${styles.deleteButton}`}
                            aria-label={`Delete ${block.type} block`}
                            onClick={(event) => {
                              event.stopPropagation();
                              void deleteBlock(block);
                            }}
                          >
                            Delete
                          </button>''',
    '''                          <button
                            type="button"
                            className={`${styles.iconButton} ${styles.deleteButton} ${deleteConfirmId === block.id ? styles.deleteButtonConfirm : ""}`}
                            aria-label={
                              deleteConfirmId === block.id
                                ? `Confirm delete ${block.type} block`
                                : `Delete ${block.type} block`
                            }
                            onClick={(event) => {
                              event.stopPropagation();
                              if (deleteConfirmId === block.id) {
                                void deleteBlock(block);
                              } else {
                                setDeleteConfirmId(block.id);
                                setNotice("Klik Confirm delete sekali lagi untuk menghapus block.");
                              }
                            }}
                          >
                            {deleteConfirmId === block.id ? "Confirm delete" : "Delete"}
                          </button>''',
    "delete button",
)

space_css = Path("apps/ai/app/space/Space.module.css")
replace_once(
    space_css,
    '''.inspectButton[aria-pressed="true"] {
  border-color: var(--accent);
  color: var(--text);
  background: var(--surface-2);
}
''',
    '''.inspectButton[aria-pressed="true"] {
  border-color: var(--accent);
  color: var(--text);
  background: var(--surface-2);
}

.deleteButtonConfirm {
  border-color: var(--danger);
  color: var(--danger);
  background: color-mix(in srgb, var(--danger) 8%, transparent);
}
''',
    "delete confirm style",
)
