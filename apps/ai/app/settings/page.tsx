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
  const [workspaceId, setWorkspaceId] = useState("workspace-default");
  const [servers, setServers] = useState<McpServer[]>([]);
  const [secret, setSecret] = useState("");
  const [secretProvider, setSecretProvider] = useState("anthropic");
  const [mcpJson, setMcpJson] = useState("");
  const [status, setStatus] = useState("Loading control state…");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const actionLockRef = useRef<string | null>(null);

  function beginAction(action: string): boolean {
    if (actionLockRef.current !== null) return false;
    actionLockRef.current = action;
    setBusyAction(action);
    return true;
  }

  function endAction(action: string): void {
    if (actionLockRef.current !== action) return;
    actionLockRef.current = null;
    setBusyAction(null);
  }

  async function runAction(action: string, work: () => Promise<void>): Promise<void> {
    if (!beginAction(action)) return;
    try {
      await work();
    } finally {
      endAction(action);
    }
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

  const refreshMcp = useCallback(async () => {
    try {
      const result = await json<{ servers: McpServer[] }>(
        `/api/settings/settings/mcp/servers?workspaceId=${encodeURIComponent(workspaceId)}`,
      );
      setServers(result.servers);
      setStatus(`Loaded ${String(result.servers.length)} MCP server configuration(s).`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }, [workspaceId]);

  useEffect(() => void refresh(), [refresh]);

  async function saveRuntime() {
    if (runtime === null) return;
    await runAction("runtime-save", async () => {
      const requestedHosted = runtime.settings.hostedCallsEnabled;
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
      }
    });
  }

  async function saveCredential() {
    await runAction("credential-save", async () => {
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
      }
    });
  }

  async function runCanary() {
    await runAction("canary", async () => {
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
      }
    });
  }

  async function loadMcpWorkspace() {
    await runAction("mcp-load", refreshMcp);
  }

  async function saveMcpServer() {
    await runAction("mcp-save", async () => {
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
      }
    });
  }

  const busy = busyAction !== null;

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
                disabled={busy}
                value={runtime.settings.hostedProvider}
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
                disabled={busy}
                value={runtime.settings.localModelTag}
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
                disabled={busy}
                value={runtime.settings.localBaseUrl}
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
                disabled={busy}
                checked={runtime.settings.hostedCallsEnabled}
                onChange={(event) =>
                  setRuntime({
                    ...runtime,
                    settings: { ...runtime.settings, hostedCallsEnabled: event.target.checked },
                  })
                }
              />
              Hosted calls enabled
            </label>
            <p className={`${styles.muted} ${styles.wide}`}>
              The process-level operator kill switch is a hard ceiling. Runtime settings can
              turn Hosted off, but cannot override a closed operator gate.
            </p>
            <div className={styles.actions}>
              <button type="button" disabled={busy} onClick={() => void saveRuntime()}>
                {busyAction === "runtime-save" ? "Saving…" : "Save runtime"}
              </button>
              <button
                type="button"
                className={styles.secondary}
                disabled={busy}
                onClick={() => void runCanary()}
              >
                {busyAction === "canary" ? "Running…" : "Run local canary"}
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
            disabled={busy}
            value={secretProvider}
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
            disabled={busy}
            value={secret}
            onChange={(event) => setSecret(event.target.value)}
          />
          <button
            type="button"
            disabled={busy || secret.length === 0}
            onClick={() => void saveCredential()}
          >
            {busyAction === "credential-save" ? "Saving…" : "Encrypt & save"}
          </button>
        </div>
      </section>

      <section className={styles.section}>
        <h2>MCP servers</h2>
        <div className={styles.inline}>
          <input
            aria-label="MCP workspace id"
            disabled={busy}
            value={workspaceId}
            onChange={(event) => setWorkspaceId(event.target.value)}
          />
          <button
            type="button"
            className={styles.secondary}
            disabled={busy}
            onClick={() => void loadMcpWorkspace()}
          >
            {busyAction === "mcp-load" ? "Loading…" : "Load workspace"}
          </button>
        </div>
        <div className={styles.serverList}>
          {servers.map((server) => (
            <button
              type="button"
              className={styles.server}
              key={server.id}
              disabled={busy}
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
          disabled={busy}
          value={mcpJson}
          onChange={(event) => setMcpJson(event.target.value)}
          aria-label="MCP server JSON"
          placeholder='{"id":"example","displayName":"Example","enabled":false,"workspaceIds":["workspace-default"],"transport":{"type":"streamable-http","url":"https://example.com/mcp"},"toolPolicies":[],"connectTimeoutMs":10000,"requestTimeoutMs":30000}'
        />
        <div className={styles.actions}>
          <button
            type="button"
            disabled={busy || mcpJson.trim().length === 0}
            onClick={() => void saveMcpServer()}
          >
            {busyAction === "mcp-save" ? "Saving…" : "Validate & save MCP server"}
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
