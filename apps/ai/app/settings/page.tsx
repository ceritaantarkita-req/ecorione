"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./Settings.module.css";

type RuntimeSnapshot = {
  revision: number;
  settings: {
    hostedProvider: "anthropic" | "openrouter" | "openai";
    localRuntime: "openai-compatible";
    localBaseUrl: string;
    localModelTag: string;
    hostedCallsEnabled: boolean;
  };
};
type Credential = { provider: string; purpose: string; generation: number; updatedAt: string };
type McpServer = {
  id: string;
  displayName: string;
  enabled: boolean;
  workspaceIds: string[];
  transport: unknown;
  toolPolicies: unknown[];
};

const PERSONAL_WORKSPACE_ID = "ws_personal";

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const text = await response.text();
  let payload: unknown = null;

  if (text.length > 0) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      if (!response.ok) {
        throw new Error(`HTTP ${String(response.status)}: ${text.slice(0, 240)}`);
      }
      throw new Error(`HTTP ${String(response.status)} returned a non-JSON response.`);
    }
  }

  if (!response.ok) {
    const error =
      typeof payload === "object" && payload !== null
        ? (payload as { error?: { message?: unknown } }).error
        : undefined;
    const message = typeof error?.message === "string" ? error.message : undefined;
    throw new Error(message ?? `HTTP ${String(response.status)}`);
  }

  return payload as T;
}

export default function SettingsPage() {
  const [runtime, setRuntime] = useState<RuntimeSnapshot | null>(null);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [workspaceId, setWorkspaceId] = useState(PERSONAL_WORKSPACE_ID);
  const [servers, setServers] = useState<McpServer[]>([]);
  const [secret, setSecret] = useState("");
  const [secretProvider, setSecretProvider] = useState("anthropic");
  const [mcpJson, setMcpJson] = useState("");
  const [status, setStatus] = useState("Loading control state…");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [mcpLoading, setMcpLoading] = useState(false);
  const actionInFlight = useRef(false);
  const mcpLoadRequestRef = useRef(0);
  const workspaceIdRef = useRef(workspaceId);

  function beginAction(action: string): boolean {
    if (actionInFlight.current) return false;
    actionInFlight.current = true;
    setPendingAction(action);
    return true;
  }

  function finishAction(): void {
    actionInFlight.current = false;
    setPendingAction(null);
  }

  const refresh = useCallback(async () => {
    try {
      const [runtimeResult, credentialResult] = await Promise.all([
        json<RuntimeSnapshot>("/api/settings/settings/runtime"),
        json<{ credentials: Credential[] }>("/api/settings/settings/credentials"),
      ]);
      setRuntime(runtimeResult);
      setCredentials(credentialResult.credentials);
      setStatus(`Control state loaded · runtime revision ${String(runtimeResult.revision)}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }, []);

  const refreshCredentials = useCallback(async () => {
    const result = await json<{ credentials: Credential[] }>(
      "/api/settings/settings/credentials",
    );
    setCredentials(result.credentials);
  }, []);

  const refreshMcp = useCallback(async () => {
    const requestId = ++mcpLoadRequestRef.current;
    const requestedWorkspace = workspaceId;
    setMcpLoading(true);
    try {
      const result = await json<{ servers: McpServer[] }>(
        `/api/settings/settings/mcp/servers?workspaceId=${encodeURIComponent(requestedWorkspace)}`,
      );
      if (
        requestId !== mcpLoadRequestRef.current ||
        workspaceIdRef.current !== requestedWorkspace
      )
        return;
      setServers(result.servers);
      setStatus(`Loaded ${String(result.servers.length)} MCP server configuration(s).`);
    } catch (error) {
      if (requestId === mcpLoadRequestRef.current) {
        setStatus(error instanceof Error ? error.message : String(error));
      }
    } finally {
      if (requestId === mcpLoadRequestRef.current) setMcpLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => void refresh(), [refresh]);

  const mutableLocalModel =
    runtime !== null && /(^|[:@])latest$/i.test(runtime.settings.localModelTag.trim());

  async function saveRuntime() {
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
  }
  async function saveCredential() {
    if (!beginAction("credential")) return;
    setStatus("Encrypting credential…");
    try {
      await json(`/api/settings/settings/credentials/${secretProvider}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ secret }),
      });
      setSecret("");
      await refreshCredentials();
      setStatus("Credential encrypted in Connect vault. Plaintext was not returned.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      finishAction();
    }
  }
  async function runCanary() {
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
  }
  async function saveMcpServer() {
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
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Control Center</h1>
          <p>Provider, model, credential, and MCP configuration. Secrets never render back.</p>
        </div>
      </header>
      <p className={styles.status} aria-live="polite" role="status">
        {status}
      </p>

      <section className={styles.section}>
        <h2>Runtime</h2>
        {runtime === null ? (
          <p className={styles.muted}>Runtime state is loading.</p>
        ) : (
          <div className={styles.formGrid}>
            <label>
              Hosted provider
              <select
                value={runtime.settings.hostedProvider}
                disabled={pendingAction !== null}
                onChange={(event) =>
                  setRuntime({
                    ...runtime,
                    settings: {
                      ...runtime.settings,
                      hostedProvider: event.target
                        .value as RuntimeSnapshot["settings"]["hostedProvider"],
                    },
                  })
                }
              >
                <option value="anthropic">Anthropic</option>
                <option value="openai">OpenAI</option>
                <option value="openrouter">OpenRouter</option>
              </select>
            </label>
            <label>
              Local model
              <input
                value={runtime.settings.localModelTag}
                disabled={pendingAction !== null}
                onChange={(event) =>
                  setRuntime({
                    ...runtime,
                    settings: { ...runtime.settings, localModelTag: event.target.value },
                  })
                }
              />
            </label>
            <label className={styles.wide}>
              Local base URL
              <input
                value={runtime.settings.localBaseUrl}
                disabled={pendingAction !== null}
                onChange={(event) =>
                  setRuntime({
                    ...runtime,
                    settings: { ...runtime.settings, localBaseUrl: event.target.value },
                  })
                }
              />
            </label>
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={runtime.settings.hostedCallsEnabled}
                disabled={pendingAction !== null}
                onChange={(event) =>
                  setRuntime({
                    ...runtime,
                    settings: { ...runtime.settings, hostedCallsEnabled: event.target.checked },
                  })
                }
              />
              Hosted calls enabled
            </label>
            {mutableLocalModel ? (
              <p className={`${styles.warning} ${styles.wide}`}>
                Local model memakai alias mutable <code>{runtime.settings.localModelTag}</code>.
                Cocok untuk rehearsal, belum immutable production identity.
              </p>
            ) : null}
            <p className={`${styles.muted} ${styles.wide}`}>
              The process-level operator kill switch is a hard ceiling. Runtime settings can
              turn Hosted off, but cannot override a closed operator gate.
            </p>
            <div className={styles.actions}>
              <button
                type="button"
                disabled={pendingAction !== null}
                onClick={() => void saveRuntime()}
              >
                {pendingAction === "runtime" ? "Saving…" : "Save runtime"}
              </button>
              <button
                type="button"
                className={styles.secondary}
                disabled={pendingAction !== null}
                onClick={() => void runCanary()}
              >
                {pendingAction === "canary" ? "Running…" : "Run local canary"}
              </button>
            </div>
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h2>Credential vault</h2>
        <p className={styles.muted}>
          Stored metadata:{" "}
          {credentials.length === 0
            ? "no credentials"
            : credentials
                .map((item) => `${item.provider} g${String(item.generation)}`)
                .join(", ")}
        </p>
        <div className={styles.inline}>
          <select
            aria-label="Credential provider"
            value={secretProvider}
            disabled={pendingAction !== null}
            onChange={(event) => setSecretProvider(event.target.value)}
          >
            <option value="anthropic">Anthropic</option>
            <option value="openai">OpenAI</option>
            <option value="openrouter">OpenRouter</option>
            <option value="mcp">MCP token</option>
          </select>
          <input
            type="password"
            autoComplete="new-password"
            placeholder="New secret"
            aria-label="New credential secret"
            value={secret}
            disabled={pendingAction !== null}
            onChange={(event) => setSecret(event.target.value)}
          />
          <button
            type="button"
            disabled={secret.length === 0 || pendingAction !== null}
            onClick={() => void saveCredential()}
          >
            {pendingAction === "credential" ? "Encrypting…" : "Encrypt & save"}
          </button>
        </div>
      </section>

      <section className={styles.section}>
        <h2>MCP servers</h2>
        <div className={styles.inline}>
          <input
            aria-label="MCP workspace id"
            value={workspaceId}
            disabled={mcpLoading || pendingAction !== null}
            onChange={(event) => {
              workspaceIdRef.current = event.target.value;
              setWorkspaceId(event.target.value);
            }}
          />
          <button
            type="button"
            className={styles.secondary}
            disabled={mcpLoading || pendingAction !== null}
            onClick={() => void refreshMcp()}
          >
            {mcpLoading ? "Loading…" : "Load workspace"}
          </button>
        </div>
        <div className={styles.serverList}>
          {servers.map((server) => (
            <button
              type="button"
              className={styles.server}
              key={server.id}
              onClick={() => setMcpJson(JSON.stringify(server, null, 2))}
            >
              <strong>{server.displayName}</strong>
              <span>
                {server.enabled ? "enabled" : "disabled"} · {server.id}
              </span>
            </button>
          ))}
        </div>
        <textarea
          rows={12}
          spellCheck={false}
          value={mcpJson}
          disabled={pendingAction !== null}
          onChange={(event) => setMcpJson(event.target.value)}
          aria-label="MCP server JSON"
          placeholder='{"id":"example","displayName":"Example","enabled":false,"workspaceIds":["ws_personal"],"transport":{"type":"streamable-http","url":"https://example.com/mcp"},"toolPolicies":[],"connectTimeoutMs":10000,"requestTimeoutMs":30000}'
        />
        <div className={styles.actions}>
          <button
            type="button"
            disabled={mcpJson.trim().length === 0 || pendingAction !== null}
            onClick={() => void saveMcpServer()}
          >
            {pendingAction === "mcp" ? "Saving…" : "Validate & save MCP server"}
          </button>
        </div>
        <p className={styles.muted}>
          Saving a server does not grant node/tool authority. Tool policies and Hub governance
          remain separate execution gates.
        </p>
      </section>
    </main>
  );
}
