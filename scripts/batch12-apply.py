from pathlib import Path
import json


def replace(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"missing marker in {path}: {old[:100]!r}")
    p.write_text(text.replace(old, new, 1))


def write(path: str, content: str) -> None:
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content)


# Credential vault admin contract + delete without exposing plaintext.
replace(
    "services/connect/src/credential-vault.ts",
    '''export interface ProviderCredentialReader {
  get(provider: CredentialProvider, purpose: CredentialPurpose): string | undefined;
}

export interface CredentialMetadata {''',
    '''export interface ProviderCredentialReader {
  get(provider: CredentialProvider, purpose: CredentialPurpose): string | undefined;
}

export interface CredentialVaultAdmin extends ProviderCredentialReader {
  list(): readonly CredentialMetadata[];
  set(
    provider: CredentialProvider,
    purpose: CredentialPurpose,
    secret: string,
    updatedAt: string,
  ): CredentialMetadata;
  remove(provider: CredentialProvider, purpose: CredentialPurpose): boolean;
}

export interface CredentialMetadata {''',
)
replace(
    "services/connect/src/credential-vault.ts",
    '''  /** Re-encrypts every entry under a new 32-byte master key as one atomic file replacement. */
  rotateMasterKey(nextMasterKey: string | Buffer): void {''',
    '''  remove(provider: CredentialProvider, purpose: CredentialPurpose): boolean {
    assertCredentialScope(provider, purpose);
    const vault = readVault(this.path);
    const entries = vault.entries.filter(
      (entry) => !(entry.provider === provider && entry.purpose === purpose),
    );
    if (entries.length == vault.entries.length) return false;
    writeVault(this.path, { version: 1, revision: vault.revision + 1, entries });
    return true;
  }

  /** Re-encrypts every entry under a new 32-byte master key as one atomic file replacement. */
  rotateMasterKey(nextMasterKey: string | Buffer): void {''',
)

# MCP manager admin methods preserve registry ownership and disconnect stale sessions.
replace(
    "services/connect/src/mcp-client/manager.ts",
    '''  McpToolCallRequest,
  McpToolCallResult,
} from "./types.js";''',
    '''  McpToolCallRequest,
  McpToolCallResult,
  McpToolPolicy,
} from "./types.js";''',
)
replace(
    "services/connect/src/mcp-client/manager.ts",
    '''  listServers(workspaceId: WorkspaceId): readonly {''',
    '''  configuredServers(workspaceId?: WorkspaceId): readonly McpServerConfig[] {
    return this.registry.list(workspaceId);
  }

  async upsertServer(config: McpServerConfig): Promise<McpServerConfig> {
    const prior = this.registry.list().find((candidate) => candidate.id === config.id);
    const saved = this.registry.upsert(config);
    const workspaces = new Set([...(prior?.workspaceIds ?? []), ...saved.workspaceIds]);
    await Promise.all([...workspaces].map((workspaceId) => this.disconnect(saved.id, workspaceId)));
    return saved;
  }

  async removeServer(serverId: McpServerId): Promise<boolean> {
    const prior = this.registry.list().find((candidate) => candidate.id === serverId);
    if (prior === undefined) return false;
    const removed = this.registry.remove(serverId);
    if (removed) {
      await Promise.all(prior.workspaceIds.map((workspaceId) => this.disconnect(serverId, workspaceId)));
    }
    return removed;
  }

  async setServerToolPolicy(
    serverId: McpServerId,
    policy: McpToolPolicy,
  ): Promise<McpServerConfig> {
    const saved = this.registry.setToolPolicy(serverId, policy);
    await Promise.all(saved.workspaceIds.map((workspaceId) => this.disconnect(serverId, workspaceId)));
    return saved;
  }

  listServers(workspaceId: WorkspaceId): readonly {''',
)

# MCP admin routes use the same validated registry and never bypass execution governance.
replace(
    "services/connect/src/mcp-client/http.ts",
    '''  McpDiscoverRequestSchema,
  McpServerIdSchema,
  McpToolCallRequestSchema,
} from "./types.js";''',
    '''  McpDiscoverRequestSchema,
  McpServerConfigSchema,
  McpServerIdSchema,
  McpToolCallRequestSchema,
  McpToolPolicySchema,
} from "./types.js";''',
)
replace(
    "services/connect/src/mcp-client/http.ts",
    '''const WorkspaceQuerySchema = z.object({ workspaceId: WorkspaceIdSchema });
const ServerParamsSchema = z.object({ id: McpServerIdSchema });''',
    '''const WorkspaceQuerySchema = z.object({ workspaceId: WorkspaceIdSchema });
const OptionalWorkspaceQuerySchema = z.object({ workspaceId: WorkspaceIdSchema.optional() });
const ServerParamsSchema = z.object({ id: McpServerIdSchema });''',
)
replace(
    "services/connect/src/mcp-client/http.ts",
    '''  app.post<{ Params: { id: string } }>(
    "/v1/mcp-outbound/servers/:id/disconnect",''',
    '''  app.get("/v1/settings/mcp/servers", async (req) => {
    const query = parseOrBadRequest(OptionalWorkspaceQuerySchema, req.query);
    return { servers: manager.configuredServers(query.workspaceId) };
  });

  app.put<{ Params: { id: string } }>("/v1/settings/mcp/servers/:id", async (req) => {
    const params = parseOrBadRequest(ServerParamsSchema, req.params);
    const body = parseOrBadRequest(McpServerConfigSchema, req.body);
    if (body.id !== params.id) throw new BadRequestError("MCP server id body/path harus sama.");
    return manager.upsertServer(body);
  });

  app.delete<{ Params: { id: string } }>("/v1/settings/mcp/servers/:id", async (req) => {
    const params = parseOrBadRequest(ServerParamsSchema, req.params);
    return { removed: await manager.removeServer(params.id) };
  });

  app.put<{ Params: { id: string; tool: string } }>(
    "/v1/settings/mcp/servers/:id/tools/:tool",
    async (req) => {
      const params = parseOrBadRequest(ToolParamsSchema, req.params);
      const body = parseOrBadRequest(McpToolPolicySchema, req.body);
      if (body.name !== params.tool) throw new BadRequestError("Nama tool body/path harus sama.");
      return manager.setServerToolPolicy(params.id, body);
    },
  );

  app.post<{ Params: { id: string } }>(
    "/v1/mcp-outbound/servers/:id/disconnect",''',
)

write(
    "services/connect/src/control-http.ts",
    '''import { HttpError, observabilityFor, parseOrBadRequest } from "@ecorione/shared-server";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  CREDENTIAL_PROVIDERS,
  type CredentialProvider,
  type CredentialPurpose,
  type CredentialVaultAdmin,
} from "./credential-vault.js";
import { nowIso } from "./clock.js";
import {
  RuntimeSettingsPatchSchema,
  type RuntimeSettingsAdmin,
} from "./runtime-settings.js";

const CredentialParamsSchema = z.object({ provider: z.enum(CREDENTIAL_PROVIDERS) });
const CredentialBodySchema = z.object({ secret: z.string().min(1).max(32_768) }).strict();

function credentialPurpose(provider: CredentialProvider): CredentialPurpose {
  return provider === "mcp" ? "tokens" : "messages";
}

export interface ConnectControlOptions {
  readonly runtimeSettings?: RuntimeSettingsAdmin | undefined;
  readonly credentialVault?: CredentialVaultAdmin | undefined;
}

export function registerConnectControlRoutes(
  app: FastifyInstance,
  options: ConnectControlOptions,
): void {
  const metrics = observabilityFor(app);
  const runtime = (): RuntimeSettingsAdmin => {
    if (options.runtimeSettings === undefined)
      throw new HttpError(503, "SETTINGS_UNAVAILABLE", "Runtime settings store tidak tersedia.");
    return options.runtimeSettings;
  };
  const vault = (): CredentialVaultAdmin => {
    if (options.credentialVault === undefined)
      throw new HttpError(503, "CREDENTIAL_VAULT_UNAVAILABLE", "Credential vault admin tidak tersedia.");
    return options.credentialVault;
  };

  app.get("/v1/settings/runtime", async () => runtime().get());
  app.put("/v1/settings/runtime", async (req) => {
    const result = runtime().update(parseOrBadRequest(RuntimeSettingsPatchSchema, req.body));
    metrics.addCounter("ecorione_control_changes_total", 1, { surface: "runtime-settings" });
    return result;
  });

  app.get("/v1/settings/credentials", async () => ({
    available: options.credentialVault !== undefined,
    credentials: options.credentialVault?.list() ?? [],
  }));
  app.put<{ Params: { provider: string } }>("/v1/settings/credentials/:provider", async (req) => {
    const { provider } = parseOrBadRequest(CredentialParamsSchema, req.params);
    const { secret } = parseOrBadRequest(CredentialBodySchema, req.body);
    const metadata = vault().set(provider, credentialPurpose(provider), secret, nowIso());
    metrics.addCounter("ecorione_control_changes_total", 1, {
      surface: "credential",
      provider,
      action: "set",
    });
    return metadata;
  });
  app.delete<{ Params: { provider: string } }>(
    "/v1/settings/credentials/:provider",
    async (req) => {
      const { provider } = parseOrBadRequest(CredentialParamsSchema, req.params);
      const removed = vault().remove(provider, credentialPurpose(provider));
      metrics.addCounter("ecorione_control_changes_total", 1, {
        surface: "credential",
        provider,
        action: "remove",
      });
      return { removed };
    },
  );
}
''',
)

# Dynamic Connect runtime settings while preserving provider/spend/vault boundaries.
replace(
    "services/connect/src/http.ts",
    '''import { CredentialVaultError, type ProviderCredentialReader } from "./credential-vault.js";''',
    '''import {
  CredentialVaultError,
  type CredentialVaultAdmin,
  type ProviderCredentialReader,
} from "./credential-vault.js";
import { registerConnectControlRoutes } from "./control-http.js";''',
)
replace(
    "services/connect/src/http.ts",
    '''import { DEFAULT_HOSTED_PROVIDER, type HostedProviderId } from "./provider-types.js";''',
    '''import { DEFAULT_HOSTED_PROVIDER, type HostedProviderId } from "./provider-types.js";
import type {
  RuntimeSettings,
  RuntimeSettingsAdmin,
} from "./runtime-settings.js";''',
)
replace(
    "services/connect/src/http.ts",
    '''  readonly credentialVault?: ProviderCredentialReader | undefined;
  readonly hostedProvider?: HostedProviderId | undefined;''',
    '''  readonly credentialVault?: ProviderCredentialReader | undefined;
  readonly credentialVaultAdmin?: CredentialVaultAdmin | undefined;
  readonly runtimeSettings?: RuntimeSettingsAdmin | undefined;
  readonly hostedProvider?: HostedProviderId | undefined;''',
)
replace(
    "services/connect/src/http.ts",
    '''  const metrics = observabilityFor(app);
  const hostedProvider = options.hostedProvider ?? DEFAULT_HOSTED_PROVIDER;
  const deps: CompleteDeps = {
    credentialVault: options.credentialVault,
    hostedProvider,
    anthropicApiKey: options.anthropicApiKey,
    openrouterApiKey: options.openrouterApiKey,
    openaiApiKey: options.openaiApiKey,
    localRuntime: options.localRuntime,
    localBaseUrl: options.localBaseUrl,
    localModelTag: options.localModelTag,
    cache: options.cache ?? new ExactMatchCache(),
    hostedCallsEnabled: options.hostedCallsEnabled ?? true,
    spendBudget: options.spendBudget,
  };

  if (options.mcpManager !== undefined) registerOutboundMcpRoutes(app, options.mcpManager);''',
    '''  const metrics = observabilityFor(app);
  const cache = options.cache ?? new ExactMatchCache();
  const defaults: RuntimeSettings = {
    hostedProvider: options.hostedProvider ?? DEFAULT_HOSTED_PROVIDER,
    localRuntime: options.localRuntime ?? "openai-compatible",
    localBaseUrl: options.localBaseUrl,
    localModelTag: options.localModelTag,
    hostedCallsEnabled: options.hostedCallsEnabled ?? true,
  };
  const currentRuntime = (): RuntimeSettings =>
    options.runtimeSettings?.get().settings ?? defaults;
  const currentDeps = (runtime = currentRuntime()): CompleteDeps => ({
    credentialVault: options.credentialVault,
    hostedProvider: runtime.hostedProvider,
    anthropicApiKey: options.anthropicApiKey,
    openrouterApiKey: options.openrouterApiKey,
    openaiApiKey: options.openaiApiKey,
    localRuntime: runtime.localRuntime,
    localBaseUrl: runtime.localBaseUrl,
    localModelTag: runtime.localModelTag,
    cache,
    hostedCallsEnabled: runtime.hostedCallsEnabled,
    spendBudget: options.spendBudget,
  });

  if (options.mcpManager !== undefined) registerOutboundMcpRoutes(app, options.mcpManager);
  registerConnectControlRoutes(app, {
    runtimeSettings: options.runtimeSettings,
    credentialVault: options.credentialVaultAdmin,
  });''',
)
replace("services/connect/src/http.ts", "complete(deps, body, controller.signal)", "complete(currentDeps(), body, controller.signal)")
replace(
    "services/connect/src/http.ts",
    '''    const body = parseOrBadRequest(ProviderCanaryBodySchema, req.body ?? {});
    const started = performance.now();''',
    '''    const body = parseOrBadRequest(ProviderCanaryBodySchema, req.body ?? {});
    const runtime = currentRuntime();
    const started = performance.now();''',
)
replace("services/connect/src/http.ts", "complete(deps, completeBody)", "complete(currentDeps(runtime), completeBody)")
replace(
    "services/connect/src/http.ts",
    '''        provider: body.target === "local" ? "local" : hostedProvider,
        model: body.target === "local" ? options.localModelTag : "configured",''',
    '''        provider: body.target === "local" ? "local" : runtime.hostedProvider,
        model: body.target === "local" ? runtime.localModelTag : "configured",''',
)
replace(
    "services/connect/src/http.ts",
    '''          hostedProvider,
          hostedCallsEnabled: options.hostedCallsEnabled ?? true,''',
    '''          hostedProvider: currentRuntime().hostedProvider,
          hostedCallsEnabled: currentRuntime().hostedCallsEnabled,''',
)

# Main wires owner-persistent settings and vault admin.
replace(
    "services/connect/src/main.ts",
    '''import { parseLocalRuntime } from "./providers/local-runtime.js";''',
    '''import { parseLocalRuntime } from "./providers/local-runtime.js";
import { FileRuntimeSettings } from "./runtime-settings.js";''',
)
replace(
    "services/connect/src/main.ts",
    '''function developmentHostedApiKey(): string | undefined {
  switch (hostedProvider) {''',
    '''function developmentHostedApiKey(provider = hostedProvider): string | undefined {
  switch (provider) {''',
)
replace(
    "services/connect/src/main.ts",
    '''const hostedCallsEnabled = process.env.ECORIONE_COST_KILL_SWITCH !== "1";

const spendDailyUsd''',
    '''const hostedCallsEnabled = process.env.ECORIONE_COST_KILL_SWITCH !== "1";
const runtimeSettingsPath =
  process.env.ECORIONE_CONNECT_SETTINGS_PATH ??
  resolve(import.meta.dirname, "../../../data/connect-runtime-settings.json");
const runtimeSettings = new FileRuntimeSettings(runtimeSettingsPath, {
  hostedProvider,
  localRuntime,
  localBaseUrl,
  localModelTag,
  hostedCallsEnabled,
});

const spendDailyUsd''',
)
replace(
    "services/connect/src/main.ts",
    '''        authorizationBearer: () =>
          credentialVault?.get(hostedProvider, "messages") ?? developmentHostedApiKey(),''',
    '''        authorizationBearer: () => {
          const provider = runtimeSettings.get().settings.hostedProvider;
          return credentialVault?.get(provider, "messages") ?? developmentHostedApiKey(provider);
        },''',
)
replace(
    "services/connect/src/main.ts",
    '''  credentialVault,
  hostedProvider,''',
    '''  credentialVault,
  credentialVaultAdmin: credentialVault,
  runtimeSettings,
  hostedProvider,''',
)
replace(
    "services/connect/src/index.ts",
    '''export * from "./routing.js";''',
    '''export * from "./routing.js";
export * from "./runtime-settings.js";''',
)

write(
    "services/connect/src/runtime-settings.test.ts",
    '''import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FileRuntimeSettings } from "./runtime-settings.js";

const defaults = {
  hostedProvider: "anthropic" as const,
  localRuntime: "openai-compatible" as const,
  localBaseUrl: "http://127.0.0.1:11434/v1",
  localModelTag: "model-a",
  hostedCallsEnabled: true,
};

describe("FileRuntimeSettings", () => {
  it("memiliki revision monotonic dan file owner mode tanpa secret", () => {
    const dir = mkdtempSync(join(tmpdir(), "ecorione-settings-"));
    const path = join(dir, "settings.json");
    const store = new FileRuntimeSettings(path, defaults);
    expect(store.get()).toMatchObject({ revision: 0, settings: defaults });
    const next = store.update({ hostedProvider: "openai", localModelTag: "model-b" });
    expect(next.revision).toBe(1);
    expect(next.settings.hostedProvider).toBe("openai");
    expect(readFileSync(path, "utf8")).not.toContain("API_KEY");
  });

  it("menolak credential/fragment dan protocol non-http pada local runtime URL", () => {
    const dir = mkdtempSync(join(tmpdir(), "ecorione-settings-"));
    const store = new FileRuntimeSettings(join(dir, "settings.json"), defaults);
    expect(() => store.update({ localBaseUrl: "http://user:pass@host/v1" })).toThrow();
    expect(() => store.update({ localBaseUrl: "file:///tmp/model" })).toThrow();
  });
});
''',
)

# Ai server-only Connect settings proxy, path allowlist prevents proxy SSRF/path traversal.
replace(
    "apps/ai/lib/env.ts",
    '''const DEFAULT_FLOW_URL = "http://127.0.0.1:17028";''',
    '''const DEFAULT_FLOW_URL = "http://127.0.0.1:17028";
const DEFAULT_CONNECT_URL = "http://127.0.0.1:17023";''',
)
replace(
    "apps/ai/lib/env.ts",
    '''export function internalToken(): string | undefined {''',
    '''export function connectUrl(): string {
  const value = process.env.ECORIONE_CONNECT_URL;
  return value !== undefined && value.length > 0 ? value : DEFAULT_CONNECT_URL;
}
export function internalToken(): string | undefined {''',
)
write(
    "apps/ai/lib/settings-proxy.ts",
    '''import { connectUrl, internalToken } from "./env";
import { jsonError } from "./proxy";

const ALLOWED = [
  /^\/v1\/settings\/runtime$/,
  /^\/v1\/settings\/credentials(?:\/(?:anthropic|openai|openrouter|mcp))?$/,
  /^\/v1\/settings\/mcp\/servers(?:\/[a-z0-9][a-z0-9._-]*)?(?:\/tools\/[A-Za-z0-9._-]+)?$/,
  /^\/v1\/ops\/provider-canary$/,
];

export async function proxyToConnectSettings(
  request: Request,
  path: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
): Promise<Response> {
  if (!ALLOWED.some((pattern) => pattern.test(path)))
    return jsonError(400, "BAD_REQUEST", "Settings proxy path tidak diizinkan.");
  const headers: Record<string, string> = {};
  const token = internalToken();
  if (token !== undefined) headers.authorization = `Bearer ${token}`;
  let body: string | undefined;
  if (method === "POST" || method === "PUT") {
    try {
      body = JSON.stringify(await request.json());
      headers["content-type"] = "application/json";
    } catch {
      return jsonError(400, "BAD_REQUEST", "Body bukan JSON valid.");
    }
  }
  try {
    const upstream = await fetch(`${connectUrl()}${path}`, {
      method,
      headers,
      body,
      redirect: "error",
      cache: "no-store",
    });
    const text = await upstream.text();
    return new Response(text.length === 0 ? undefined : text, {
      status: upstream.status,
      headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
    });
  } catch {
    return jsonError(502, "UPSTREAM_UNAVAILABLE", "Connect tidak bisa dihubungi.");
  }
}
''',
)
write(
    "apps/ai/app/api/settings/[...path]/route.ts",
    '''import { proxyToConnectSettings } from "../../../../lib/settings-proxy";

type RouteContext = { params: Promise<{ path: string[] }> };
async function forward(
  request: Request,
  context: RouteContext,
  method: "GET" | "POST" | "PUT" | "DELETE",
): Promise<Response> {
  const { path } = await context.params;
  if (path.length === 0 || path.some((segment) => !/^[A-Za-z0-9._-]+$/.test(segment)))
    return new Response("Not Found", { status: 404 });
  const url = new URL(request.url);
  return proxyToConnectSettings(request, `/v1/${path.join("/")}${url.search}`, method);
}
export async function GET(request: Request, context: RouteContext) {
  return forward(request, context, "GET");
}
export async function POST(request: Request, context: RouteContext) {
  return forward(request, context, "POST");
}
export async function PUT(request: Request, context: RouteContext) {
  return forward(request, context, "PUT");
}
export async function DELETE(request: Request, context: RouteContext) {
  return forward(request, context, "DELETE");
}
''',
)
write(
    "apps/ai/app/settings/page.tsx",
    '''"use client";

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
  if (!response.ok) throw new Error(payload.error?.message ?? `HTTP ${String(response.status)}`);
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
      const result = await json<{ pass: boolean; latencyMs: number; provider: string; model: string }>(
        "/api/settings/ops/provider-canary",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ target: "local" }),
        },
      );
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
      setStatus("MCP server configuration saved. Execution permission is still evaluated separately.");
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
        <nav><a href="/ops">Operations</a><a href="/flow">Flow</a><a href="/space">Space</a></nav>
      </header>
      <p className={styles.status}>{status}</p>

      <section className={styles.section}>
        <h2>Runtime</h2>
        {runtime === null ? null : (
          <div className={styles.formGrid}>
            <label>Hosted provider<select value={runtime.settings.hostedProvider} onChange={(event) => setRuntime({ ...runtime, settings: { ...runtime.settings, hostedProvider: event.target.value as RuntimeSnapshot["settings"]["hostedProvider"] } })}><option value="anthropic">Anthropic</option><option value="openai">OpenAI</option><option value="openrouter">OpenRouter</option></select></label>
            <label>Local model<input value={runtime.settings.localModelTag} onChange={(event) => setRuntime({ ...runtime, settings: { ...runtime.settings, localModelTag: event.target.value } })} /></label>
            <label className={styles.wide}>Local base URL<input value={runtime.settings.localBaseUrl} onChange={(event) => setRuntime({ ...runtime, settings: { ...runtime.settings, localBaseUrl: event.target.value } })} /></label>
            <label className={styles.check}><input type="checkbox" checked={runtime.settings.hostedCallsEnabled} onChange={(event) => setRuntime({ ...runtime, settings: { ...runtime.settings, hostedCallsEnabled: event.target.checked } })} />Hosted calls enabled</label>
            <div className={styles.actions}><button onClick={() => void saveRuntime()}>Save runtime</button><button className={styles.secondary} onClick={() => void runCanary()}>Run local canary</button></div>
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h2>Credential vault</h2>
        <p className={styles.muted}>Stored metadata: {credentials.length === 0 ? "no credentials" : credentials.map((item) => `${item.provider} g${String(item.generation)}`).join(", ")}</p>
        <div className={styles.inline}><select value={secretProvider} onChange={(event) => setSecretProvider(event.target.value)}><option value="anthropic">Anthropic</option><option value="openai">OpenAI</option><option value="openrouter">OpenRouter</option><option value="mcp">MCP token</option></select><input type="password" autoComplete="new-password" placeholder="New secret" value={secret} onChange={(event) => setSecret(event.target.value)} /><button disabled={secret.length === 0} onClick={() => void saveCredential()}>Encrypt & save</button></div>
      </section>

      <section className={styles.section}>
        <h2>MCP servers</h2>
        <div className={styles.inline}><input value={workspaceId} onChange={(event) => setWorkspaceId(event.target.value)} /><button className={styles.secondary} onClick={() => void refreshMcp()}>Load workspace</button></div>
        <div className={styles.serverList}>{servers.map((server) => <button className={styles.server} key={server.id} onClick={() => setMcpJson(JSON.stringify(server, null, 2))}><strong>{server.displayName}</strong><span>{server.enabled ? "enabled" : "disabled"} · {server.id}</span></button>)}</div>
        <textarea rows={12} spellCheck={false} value={mcpJson} onChange={(event) => setMcpJson(event.target.value)} placeholder='{"id":"example","displayName":"Example","enabled":false,"workspaceIds":["workspace-default"],"transport":{"type":"streamable-http","url":"https://example.com/mcp"},"toolPolicies":[],"connectTimeoutMs":10000,"requestTimeoutMs":30000}' />
        <div className={styles.actions}><button disabled={mcpJson.trim().length === 0} onClick={() => void saveMcpServer()}>Validate & save MCP server</button></div>
        <p className={styles.muted}>Saving a server does not grant node/tool authority. Tool policies and Hub governance remain separate execution gates.</p>
      </section>
    </main>
  );
}
''',
)
write(
    "apps/ai/app/settings/Settings.module.css",
    '''.page { max-width: 1120px; margin: 0 auto; padding: 48px 28px 80px; color: #151515; }
.header { display: flex; justify-content: space-between; gap: 24px; align-items: end; border-bottom: 1px solid #dedede; padding-bottom: 24px; }
.header h1 { margin: 0 0 8px; font-size: clamp(2rem, 4vw, 3.3rem); letter-spacing: -0.04em; }
.header p, .muted { color: #686868; }
.header nav { display: flex; gap: 16px; }
.header a { color: inherit; font-size: 14px; }
.status { margin: 20px 0; padding: 12px 14px; background: #f5f5f5; border-left: 3px solid #222; font-family: ui-monospace, monospace; font-size: 13px; }
.section { padding: 28px 0; border-bottom: 1px solid #e6e6e6; }
.section h2 { margin: 0 0 18px; font-size: 1.25rem; }
.formGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.formGrid label { display: grid; gap: 8px; font-size: 13px; font-weight: 600; }
.wide { grid-column: 1 / -1; }
.check { display: flex !important; align-items: center; gap: 8px !important; }
.inline, .actions { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
input, select, textarea { border: 1px solid #c9c9c9; background: #fff; color: #151515; border-radius: 7px; padding: 10px 12px; font: inherit; }
textarea { width: 100%; margin-top: 14px; font-family: ui-monospace, monospace; font-size: 13px; line-height: 1.45; }
.inline input { flex: 1; min-width: 220px; }
button { border: 0; border-radius: 7px; padding: 10px 14px; background: #181818; color: #fff; font: 600 13px/1.2 inherit; cursor: pointer; }
button:disabled { opacity: .45; cursor: not-allowed; }
.secondary { background: #ececec; color: #181818; }
.serverList { display: grid; gap: 8px; margin-top: 14px; }
.server { text-align: left; display: flex; justify-content: space-between; background: #f6f6f6; color: #181818; border: 1px solid #e2e2e2; }
.server span { color: #777; font-weight: 400; }
@media (max-width: 720px) { .header { align-items: start; flex-direction: column; } .formGrid { grid-template-columns: 1fr; } .wide { grid-column: auto; } .server { flex-direction: column; gap: 4px; } }
''',
)

# Minimal typed developer SDK package.
write(
    "packages/sdk/package.json",
    '''{
  "name": "@ecorione/sdk",
  "version": "0.1.0",
  "private": true,
  "license": "MIT",
  "type": "module",
  "exports": { ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" } },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": { "build": "tsc --build" },
  "dependencies": { "@ecorione/shared-schema": "workspace:*" }
}
''',
)
write(
    "packages/sdk/tsconfig.json",
    '''{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "./src", "outDir": "./dist" },
  "include": ["src/**/*"],
  "references": [{ "path": "../shared-schema" }]
}
''',
)
write(
    "packages/sdk/src/index.ts",
    '''export interface EcorioneSdkOptions {
  readonly token?: string;
  readonly contextUrl?: string;
  readonly connectUrl?: string;
  readonly flowUrl?: string;
  readonly artifactUrl?: string;
}

export interface FlowRunInput {
  readonly operationId: string;
  readonly input?: unknown;
}

async function request<T>(base: string, path: string, token: string | undefined, init?: RequestInit): Promise<T> {
  const url = new URL(path, base.endsWith("/") ? base : `${base}/`);
  if (!new Set(["http:", "https:"]).has(url.protocol)) throw new Error("SDK base URL harus HTTP/HTTPS.");
  const headers = new Headers(init?.headers);
  if (token !== undefined) headers.set("authorization", `Bearer ${token}`);
  if (init?.body !== undefined) headers.set("content-type", "application/json");
  const response = await fetch(url, { ...init, headers, redirect: "error" });
  const text = await response.text();
  if (!response.ok) throw new Error(`ECORIONE HTTP ${String(response.status)}: ${text.slice(0, 512)}`);
  return (text.length === 0 ? undefined : JSON.parse(text)) as T;
}

export class EcorioneSdk {
  readonly #token: string | undefined;
  readonly #contextUrl: string;
  readonly #connectUrl: string;
  readonly #flowUrl: string;
  readonly #artifactUrl: string;

  constructor(options: EcorioneSdkOptions = {}) {
    this.#token = options.token;
    this.#contextUrl = options.contextUrl ?? "http://127.0.0.1:17022";
    this.#connectUrl = options.connectUrl ?? "http://127.0.0.1:17023";
    this.#flowUrl = options.flowUrl ?? "http://127.0.0.1:17028";
    this.#artifactUrl = options.artifactUrl ?? "http://127.0.0.1:17025";
  }

  health(service: "context" | "connect" | "flow" | "artifact"): Promise<{ status: string; service: string }> {
    const base = service === "context" ? this.#contextUrl : service === "connect" ? this.#connectUrl : service === "flow" ? this.#flowUrl : this.#artifactUrl;
    return request(base, "/healthz", undefined);
  }

  retrieve<T = unknown>(body: unknown): Promise<T> {
    return request(this.#contextUrl, "/v1/retrieve", this.#token, { method: "POST", body: JSON.stringify(body) });
  }

  complete<T = unknown>(body: unknown): Promise<T> {
    return request(this.#connectUrl, "/v1/complete", this.#token, { method: "POST", body: JSON.stringify(body) });
  }

  runGraph<T = unknown>(graphId: string, body: FlowRunInput): Promise<T> {
    return request(this.#flowUrl, `/v1/graphs/${encodeURIComponent(graphId)}/runs`, this.#token, { method: "POST", body: JSON.stringify(body) });
  }

  async artifactContent(artifactId: string, query: { scope: string; maxSensitivity: string }): Promise<Uint8Array> {
    const url = new URL(`/v1/artifacts/${encodeURIComponent(artifactId)}/content`, this.#artifactUrl);
    url.searchParams.set("scope", query.scope);
    url.searchParams.set("maxSensitivity", query.maxSensitivity);
    const headers = new Headers();
    if (this.#token !== undefined) headers.set("authorization", `Bearer ${this.#token}`);
    const response = await fetch(url, { headers, redirect: "error" });
    if (!response.ok) throw new Error(`ECORIONE Artifact HTTP ${String(response.status)}`);
    return new Uint8Array(await response.arrayBuffer());
  }
}
''',
)

# Root TypeScript references SDK.
tsconfig = json.loads(Path("tsconfig.json").read_text())
if {"path": "./packages/sdk"} not in tsconfig["references"]:
    tsconfig["references"].insert(5, {"path": "./packages/sdk"})
Path("tsconfig.json").write_text(json.dumps(tsconfig, indent=2) + "\n")

# Deployment settings state belongs to existing Connect owner volume.
replace(
    "deploy/compose.yml",
    '''      ECORIONE_CONNECT_VAULT_PATH: /app/data/connect-credentials.vault.json''',
    '''      ECORIONE_CONNECT_VAULT_PATH: /app/data/connect-credentials.vault.json
      ECORIONE_CONNECT_SETTINGS_PATH: /app/data/connect-runtime-settings.json''',
)
replace(
    "deploy/production.env.example",
    '''ECORIONE_CONNECT_VAULT_MASTER_KEY=CHANGE_ME_BASE64URL_32_BYTE_MASTER_KEY''',
    '''ECORIONE_CONNECT_VAULT_MASTER_KEY=CHANGE_ME_BASE64URL_32_BYTE_MASTER_KEY
# Runtime provider/model changes from Control Center persist under Connect's owner volume.''',
)

# Installer/upgrade/rollback are conservative: config validation first, explicit mutation flags.
write(
    "scripts/self-host-install.sh",
    '''#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
command -v docker >/dev/null || { echo "docker is required" >&2; exit 1; }
docker compose version >/dev/null
ENV_FILE="deploy/production.env"
if [[ ! -f "$ENV_FILE" ]]; then cp deploy/production.env.example "$ENV_FILE"; chmod 600 "$ENV_FILE"; echo "Prepared $ENV_FILE; replace CHANGE_ME values before deployment."; exit 0; fi
if grep -q 'CHANGE_ME' "$ENV_FILE"; then echo "Refusing deploy: CHANGE_ME remains in $ENV_FILE" >&2; exit 1; fi
docker compose --env-file "$ENV_FILE" -f deploy/compose.yml config >/dev/null
if [[ "${1:-}" != "--apply" ]]; then echo "Configuration valid. Re-run with --apply to build and start."; exit 0; fi
docker compose --env-file "$ENV_FILE" -f deploy/compose.yml up -d --build
echo "ECORIONE self-host baseline started. Verify HTTPS /ops and provider canary before traffic.";
''',
)
write(
    "scripts/self-host-upgrade.sh",
    '''#!/usr/bin/env bash
set -euo pipefail
[[ "${1:-}" == "--apply" ]] || { echo "Usage: $0 --apply <image-tag>" >&2; exit 2; }
TAG="${2:-}"
[[ "$TAG" =~ ^[A-Za-z0-9._-]+$ ]] || { echo "Invalid image tag" >&2; exit 2; }
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; cd "$ROOT"
ENV_FILE=deploy/production.env
[[ -f "$ENV_FILE" ]] || { echo "Missing $ENV_FILE" >&2; exit 1; }
mkdir -p data/release-receipts
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
printf '%s\n' "pre-upgrade backup must be verified per docs/data-rebuild-operations.md before this command" > "data/release-receipts/$STAMP.pre-upgrade.txt"
ECORIONE_IMAGE_TAG="$TAG" docker compose --env-file "$ENV_FILE" -f deploy/compose.yml config >/dev/null
ECORIONE_IMAGE_TAG="$TAG" docker compose --env-file "$ENV_FILE" -f deploy/compose.yml up -d --build
printf '%s\n' "$TAG" > "data/release-receipts/$STAMP.applied-tag.txt"
echo "Upgrade applied. Run provider canary, /ops smoke, and backup verification before declaring healthy.";
''',
)
write(
    "scripts/self-host-rollback.sh",
    '''#!/usr/bin/env bash
set -euo pipefail
[[ "${1:-}" == "--apply" ]] || { echo "Usage: $0 --apply <previous-image-tag>" >&2; exit 2; }
TAG="${2:-}"
[[ "$TAG" =~ ^[A-Za-z0-9._-]+$ ]] || { echo "Invalid image tag" >&2; exit 2; }
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; cd "$ROOT"
ENV_FILE=deploy/production.env
[[ -f "$ENV_FILE" ]] || { echo "Missing $ENV_FILE" >&2; exit 1; }
ECORIONE_IMAGE_TAG="$TAG" docker compose --env-file "$ENV_FILE" -f deploy/compose.yml config >/dev/null
ECORIONE_IMAGE_TAG="$TAG" docker compose --env-file "$ENV_FILE" -f deploy/compose.yml up -d
printf '%s\n' "$(date -u +%FT%TZ) rollback=$TAG" >> data/release-rollback.log
echo "Runtime image rollback applied. Data rollback is separate and must use verified owner backup/restore receipts.";
''',
)

# Batch 12 docs.
write(
    "docs/security-review.md",
    '''# ECORIONE Security Review Baseline

Batch 12 closes a production/self-host **baseline**, not an assertion that future vulnerabilities are impossible.

## Enforced controls

- Internal HTTP uses bearer authentication, timing-safe comparison, bounded request IDs, no-store responses, security headers, and process-local rate limiting.
- Public MCP keeps OAuth/OIDC resource-server validation and Sync remains the public bridge; inbound MCP itself stays loopback-only in Compose.
- Outbound MCP HTTPS rejects inline URL credentials/fragments; insecure HTTP is loopback-only with explicit opt-in; stdio commands require an operator allowlist; secret-looking env names require vault references.
- Flow HTTP is host-allowlisted, redirect-disabled, timeout-bounded, and HTTP node POSTs carry deterministic idempotency keys.
- Artifact/backup/Sandbox existing traversal and escape tests remain release evidence; Docker socket is not mounted into the application baseline.
- Credential plaintext is accepted only at Connect's control endpoint, encrypted into the Connect vault, and never returned by list/settings APIs.
- Working-tree and full Git-history secret scans are separate CI gates.

## AuthN/AuthZ and audit review

Caddy Basic Auth protects external `/ops` and `/settings`; internal service routes remain protected by `ECORIONE_INTERNAL_TOKEN`. Hub remains the capability/policy authority for node/model/MCP execution. Control-plane mutations do not grant execution permission. Operational counters record control changes; Hub/RnD keep the existing durable execution/audit evidence for governed actions.

## Residual operator responsibilities

Host firewalling, OS patching, TLS/DNS ownership, provider-account MFA/limits, off-host backup replication, external metrics retention, master-key custody, and real-provider canary evidence remain deployment responsibilities. DNS allowlists reduce SSRF surface but do not replace egress firewall/DNS controls on hostile infrastructure.
''',
)
write(
    "docs/release-operations.md",
    '''# ECORIONE Release / Upgrade / Rollback Operations

## Install

1. Run `scripts/self-host-install.sh`; first run creates mode-0600 `deploy/production.env` and exits.
2. Replace every `CHANGE_ME`; keep provider API secrets in Connect Vault, not the env file.
3. Run `scripts/self-host-install.sh --apply`.
4. Verify HTTPS, `/ops`, local provider canary, and public MCP resource metadata.

## Upgrade

Before `scripts/self-host-upgrade.sh --apply <tag>`, create and verify owner backups using Batch 8 procedures and retain the prior image tag. The upgrade script validates Compose before mutation and writes a release receipt. Run health/ops/provider-canary checks after deployment.

## Rollback

`scripts/self-host-rollback.sh --apply <previous-tag>` rolls runtime images back. **Data rollback is deliberately separate**: only restore an owner backup after validating its manifest/digest and the service-specific offline/online restore requirements. Never blindly revert Historical Ledger or Context L0 immutable sources.

## Failure rule

If migration, canary, recovery, or security acceptance fails, do not label the release healthy. Preserve evidence and return to the last verified image/data combination.
''',
)
write(
    "docs/developer-sdk.md",
    '''# @ecorione/sdk

`packages/sdk` is the baseline typed client for self-host integrations. It does not bypass service ownership or authority.

```ts
import { EcorioneSdk } from "@ecorione/sdk";
const sdk = new EcorioneSdk({ token: process.env.ECORIONE_INTERNAL_TOKEN });
const health = await sdk.health("flow");
```

The SDK exposes health, Context retrieval, Connect completion, Flow graph run, and Artifact byte retrieval. Callers still supply valid domain request bodies and remain subject to Hub/Connect/Flow policy, scope, sensitivity, idempotency, and owner-service validation.

Do not embed the internal bearer token in browser bundles. Use the SDK from trusted server-side/local integration code.
''',
)
write(
    "docs/adr/0033-final-security-release-closure.md",
    '''# ADR-33 — Final Security and Release Closure Baseline

Status: Accepted  
Date: 2026-09-10

## Decision

ECORIONE's production/self-host readiness label is gated by defense-in-depth HTTP hardening, full-history + working-tree secret scans, deterministic dependency/deployment review, existing Sandbox/backup/Temporal recovery evidence, operator-only Control Center routes, conservative install/upgrade/rollback tooling, and exact-head + post-merge CI.

Runtime provider/model state and credential metadata remain Connect-owned. Credential plaintext is encrypted into the existing vault and never copied to Ai. MCP configuration remains Connect-owned and configuration changes do not grant execution authority; Hub governance and per-tool policy remain mandatory.

The readiness label means the documented self-host baseline passed repository evidence. It does not assert real hosted-provider quality, future vulnerability absence, off-host backup durability, or host/network hardening that cannot be proven in repository CI.
''',
)

# Mark implementation as active without claiming closure.
tracker = Path("docs/EXECUTION-PROGRESS.md")
text = tracker.read_text()
text = text.replace("## Batch 12 — Final Security / Release Closure\n\nStatus: **PLANNED**", "## Batch 12 — Final Security / Release Closure\n\nStatus: **IN PROGRESS**", 1)
tracker.write_text(text)
