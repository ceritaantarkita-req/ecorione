"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ClientResponseError, readJson } from "../../lib/client-response";
import { canaryStatusFromErrorCode, providerHealth } from "../../lib/provider-health";
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
type CredentialProvider =
  | "anthropic"
  | "openai"
  | "openrouter"
  | "kimi"
  | "gemini"
  | "qwen"
  | "glm"
  | "custom-openai"
  | "mcp";
type HostedCanaryStatus = "connected" | "invalid-key" | "unreachable" | "error";
type McpServer = {
  id: string;
  displayName: string;
  enabled: boolean;
  workspaceIds: string[];
  transport: unknown;
  toolPolicies: unknown[];
};

const PERSONAL_WORKSPACE_ID = "ws_personal";
const CREDENTIAL_PROVIDER_OPTIONS: readonly {
  value: CredentialProvider;
  label: string;
  routingReady: boolean;
}[] = [
  { value: "anthropic", label: "Claude / Anthropic", routingReady: true },
  { value: "openai", label: "OpenAI / ChatGPT API", routingReady: true },
  { value: "openrouter", label: "OpenRouter", routingReady: true },
  { value: "kimi", label: "Kimi / Moonshot", routingReady: false },
  { value: "gemini", label: "Google Gemini", routingReady: false },
  { value: "qwen", label: "Qwen", routingReady: false },
  { value: "glm", label: "GLM", routingReady: false },
  { value: "custom-openai", label: "Custom OpenAI-compatible", routingReady: false },
  { value: "mcp", label: "MCP token", routingReady: false },
];

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  return readJson<T>(response);
}

export default function SettingsPage() {
  const [runtime, setRuntime] = useState<RuntimeSnapshot | null>(null);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [workspaceId, setWorkspaceId] = useState(PERSONAL_WORKSPACE_ID);
  const [servers, setServers] = useState<McpServer[]>([]);
  const [secret, setSecret] = useState("");
  const [secretProvider, setSecretProvider] = useState<CredentialProvider>("anthropic");
  const [mcpJson, setMcpJson] = useState("");
  const [status, setStatus] = useState("");
  const [hostedHealth, setHostedHealth] = useState<{
    provider: RuntimeSnapshot["settings"]["hostedProvider"];
    status: HostedCanaryStatus;
  } | null>(null);
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
  const selectedCredential =
    credentials.find((item) => item.provider === secretProvider) ?? null;
  const selectedProviderOption =
    CREDENTIAL_PROVIDER_OPTIONS.find((item) => item.value === secretProvider) ?? null;
  const selectedProviderHealth = providerHealth({
    hasCredential: selectedCredential !== null,
    routingReady: selectedProviderOption?.routingReady ?? false,
    isCurrentHostedProvider: runtime?.settings.hostedProvider === secretProvider,
    hostedCallsEnabled: runtime?.settings.hostedCallsEnabled ?? false,
    canaryStatus:
      hostedHealth !== null && hostedHealth.provider === secretProvider
        ? hostedHealth.status
        : undefined,
  });

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
      setHostedHealth(null);
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
      setHostedHealth((current) =>
        current?.provider === secretProvider ? null : current,
      );
      await refreshCredentials();
      setStatus("Credential encrypted in Connect vault. Plaintext was not returned.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      finishAction();
    }
  }

  async function removeCredential() {
    if (selectedCredential === null || !beginAction("remove-credential")) return;
    setStatus("Removing credential…");
    try {
      await json(`/api/settings/settings/credentials/${secretProvider}`, {
        method: "DELETE",
      });
      setSecret("");
      setHostedHealth((current) =>
        current?.provider === secretProvider ? null : current,
      );
      await refreshCredentials();
      setStatus("Credential removed from Connect vault.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      finishAction();
    }
  }

  async function runCanary(target: "local" | "hosted") {
    if (!beginAction(`canary-${target}`)) return;
    setStatus(target === "local" ? "Running local canary…" : "Running hosted canary…");
    const testedProvider = runtime?.settings.hostedProvider;
    try {
      const result = await json<{
        pass: boolean;
        latencyMs: number;
        provider: string;
        model: string;
      }>("/api/settings/ops/provider-canary", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target }),
      });
      if (target === "hosted" && testedProvider !== undefined) {
        setHostedHealth({
          provider: testedProvider,
          status: result.pass ? "connected" : "error",
        });
      }
      setStatus(
        `Canary ${result.pass ? "PASS" : "FAIL"}: ${result.provider}/${result.model} ${result.latencyMs.toFixed(1)}ms`,
      );
    } catch (error) {
      if (target === "hosted" && testedProvider !== undefined) {
        if (
          error instanceof ClientResponseError &&
          error.code === "PROVIDER_CREDENTIAL_MISSING"
        ) {
          setHostedHealth(null);
          try {
            await refreshCredentials();
          } catch {
            // Preserve the original canary failure as the user-facing result.
          }
        } else {
          setHostedHealth({
            provider: testedProvider,
            status:
              error instanceof ClientResponseError
                ? (canaryStatusFromErrorCode(error.code) ?? "error")
                : "error",
          });
        }
      }
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
        </div>
      </header>
      {status ? (
        <p className={styles.status} aria-live="polite" role="status">
          {status}
        </p>
      ) : null}

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
                onChange={(event) => {
                  setHostedHealth(null);
                  setRuntime({
                    ...runtime,
                    settings: {
                      ...runtime.settings,
                      hostedProvider: event.target
                        .value as RuntimeSnapshot["settings"]["hostedProvider"],
                    },
                  });
                }}
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
                onChange={(event) => {
                  setHostedHealth(null);
                  setRuntime({
                    ...runtime,
                    settings: { ...runtime.settings, hostedCallsEnabled: event.target.checked },
                  });
                }}
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
              Operator kill switch selalu menang, terlepas dari pengaturan di atas.
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
                onClick={() => void runCanary("local")}
              >
                {pendingAction === "canary-local" ? "Running…" : "Run local canary"}
              </button>
              <button
                type="button"
                className={styles.secondary}
                disabled={pendingAction !== null || !runtime.settings.hostedCallsEnabled}
                onClick={() => void runCanary("hosted")}
              >
                {pendingAction === "canary-hosted" ? "Running…" : "Test hosted provider"}
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
            onChange={(event) => setSecretProvider(event.target.value as CredentialProvider)}
          >
            {CREDENTIAL_PROVIDER_OPTIONS.map((provider) => (
              <option key={provider.value} value={provider.value}>
                {provider.label}
              </option>
            ))}
          </select>
          <input
            type="password"
            autoComplete="new-password"
            placeholder={selectedCredential === null ? "New secret" : "Replace secret"}
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
            {pendingAction === "credential"
              ? "Encrypting…"
              : selectedCredential === null
                ? "Encrypt & save"
                : "Replace credential"}
          </button>
          <button
            type="button"
            className={styles.secondary}
            disabled={selectedCredential === null || pendingAction !== null}
            onClick={() => void removeCredential()}
          >
            {pendingAction === "remove-credential" ? "Removing…" : "Remove"}
          </button>
        </div>
        <p className={styles.muted}>
          {selectedProviderHealth.label}
          {selectedCredential === null
            ? ""
            : ` generation ${String(selectedCredential.generation)} · updated ${selectedCredential.updatedAt}.`}
        </p>
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
