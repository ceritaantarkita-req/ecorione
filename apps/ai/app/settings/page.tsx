"use client";

import { useCallback, useEffect, useState } from "react";
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
  const payload = (await response.json()) as T & { error?: { message?: string } };
  if (!response.ok)
    throw new Error(payload.error?.message ?? `HTTP ${String(response.status)}`);
  return payload;
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

  const refresh = useCallback(async () => {
    try {
      const [runtimeResult, credentialResult] = await Promise.all([
        json<RuntimeSnapshot>("/api/settings/settings/runtime"),
        json<{ credentials: Credential[] }>("/api/settings/settings/credentials"),
      ]);
      setRuntime(runtimeResult);
      setCredentials(credentialResult.credentials);
      setStatus("Control state loaded.");
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
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }, [workspaceId]);

  useEffect(() => void refresh(), [refresh]);

  async function saveRuntime() {
    if (runtime === null) return;
    try {
      const result = await json<RuntimeSnapshot>("/api/settings/settings/runtime", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(runtime.settings),
      });
      setRuntime(result);
      setStatus(`Runtime settings saved at revision ${String(result.revision)}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }

  async function saveCredential() {
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
  }

  async function runCanary() {
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
  }

  async function saveMcpServer() {
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
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Control Center</h1>
          <p>Provider, model, credential, and MCP configuration. Secrets never render back.</p>
        </div>
        <nav>
          <a href="/ops">Operations</a>
          <a href="/flow">Flow</a>
          <a href="/space">Space</a>
        </nav>
      </header>
      <p className={styles.status}>{status}</p>

      <section className={styles.section}>
        <h2>Runtime</h2>
        {runtime === null ? null : (
          <div className={styles.formGrid}>
            <label>
              Hosted provider
              <select
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
            <div className={styles.actions}>
              <button onClick={() => void saveRuntime()}>Save runtime</button>
              <button className={styles.secondary} onClick={() => void runCanary()}>
                Run local canary
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
            value={secret}
            onChange={(event) => setSecret(event.target.value)}
          />
          <button disabled={secret.length === 0} onClick={() => void saveCredential()}>
            Encrypt & save
          </button>
        </div>
      </section>

      <section className={styles.section}>
        <h2>MCP servers</h2>
        <div className={styles.inline}>
          <input value={workspaceId} onChange={(event) => setWorkspaceId(event.target.value)} />
          <button className={styles.secondary} onClick={() => void refreshMcp()}>
            Load workspace
          </button>
        </div>
        <div className={styles.serverList}>
          {servers.map((server) => (
            <button
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
          onChange={(event) => setMcpJson(event.target.value)}
          placeholder='{"id":"example","displayName":"Example","enabled":false,"workspaceIds":["workspace-default"],"transport":{"type":"streamable-http","url":"https://example.com/mcp"},"toolPolicies":[],"connectTimeoutMs":10000,"requestTimeoutMs":30000}'
        />
        <div className={styles.actions}>
          <button disabled={mcpJson.trim().length === 0} onClick={() => void saveMcpServer()}>
            Validate & save MCP server
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
