/** Entrypoint produksi Connect. */
import { resolve } from "node:path";
import { bindHostForAuthenticatedService, resolveRepoRuntimePath } from "@ecorione/shared-server";
import { FileCredentialVault } from "./credential-vault.js";
import { buildConnectServer, type BuildConnectServerOptions } from "./http.js";
import { parseOptionalLocalModelDigest } from "./local-model-identity.js";
import { VaultMcpCredentialReader } from "./mcp-client/credentials.js";
import { HubMcpGovernance } from "./mcp-client/governance.js";
import { FileMcpInvocationStore } from "./mcp-client/invocation-store.js";
import { McpManager } from "./mcp-client/manager.js";
import { FileMcpRegistry } from "./mcp-client/registry.js";
import { SdkMcpClientFactory } from "./mcp-client/sdk-client.js";
import { HttpMultimodalAdapter } from "./multimodal.js";
import { withHostedOperatorGate } from "./operator-runtime-settings.js";
import { parseHostedProvider } from "./provider-types.js";
import { LocalModelProvenanceResolver } from "./providers/local-model-provenance.js";
import { parseLocalRuntime } from "./providers/local-runtime.js";
import { FileRuntimeSettings } from "./runtime-settings.js";
import { FileSpendBudget, parseOptionalBudgetUsd } from "./spend-budget.js";

const REPO_ROOT = resolve(import.meta.dirname, "../../..");
const port = Number(process.env.ECORIONE_CONNECT_PORT ?? "17023");
const token = process.env.ECORIONE_INTERNAL_TOKEN || undefined;
const host = bindHostForAuthenticatedService(token);
const hostedProvider = parseHostedProvider(process.env.ECORIONE_HOSTED_PROVIDER);

const vaultMasterKey = process.env.ECORIONE_CONNECT_VAULT_MASTER_KEY || undefined;
const vaultPath = resolveRepoRuntimePath(
  REPO_ROOT,
  process.env.ECORIONE_CONNECT_VAULT_PATH,
  "data/connect-credentials.vault.json",
);
const credentialVault =
  vaultMasterKey === undefined ? undefined : new FileCredentialVault(vaultPath, vaultMasterKey);

// Raw provider env keys are development-only and ignored as soon as the vault is active.
const anthropicApiKey =
  credentialVault === undefined ? process.env.ANTHROPIC_API_KEY || undefined : undefined;
const openrouterApiKey =
  credentialVault === undefined ? process.env.OPENROUTER_API_KEY || undefined : undefined;
const openaiApiKey =
  credentialVault === undefined ? process.env.OPENAI_API_KEY || undefined : undefined;
const webhookRootSecret =
  credentialVault === undefined
    ? process.env.ECORIONE_WEBHOOK_ROOT_SECRET || undefined
    : undefined;
const flowUrl = process.env.ECORIONE_FLOW_URL ?? "http://127.0.0.1:17028";

function developmentHostedApiKey(provider = hostedProvider): string | undefined {
  switch (provider) {
    case "anthropic":
      return anthropicApiKey;
    case "openrouter":
      return openrouterApiKey;
    case "openai":
      return openaiApiKey;
  }
}

const localRuntime = parseLocalRuntime(process.env.ECORIONE_LOCAL_RUNTIME);
const localBaseUrl = process.env.ECORIONE_LOCAL_BASE_URL ?? "http://127.0.0.1:11434/v1";
const localModelTag = process.env.ECORIONE_LOCAL_MODEL ?? "qwen3:8b-instruct-q4_K_M";
const localModelDigest = parseOptionalLocalModelDigest(process.env.ECORIONE_LOCAL_MODEL_DIGEST);
const hostedCallsAllowedByOperator = process.env.ECORIONE_COST_KILL_SWITCH !== "1";
const runtimeSettingsPath = resolveRepoRuntimePath(
  REPO_ROOT,
  process.env.ECORIONE_CONNECT_SETTINGS_PATH,
  "data/connect-runtime-settings.json",
);
const runtimeSettingsStore = new FileRuntimeSettings(runtimeSettingsPath, {
  hostedProvider,
  localRuntime,
  localBaseUrl,
  localModelTag,
  localModelDigest,
  hostedCallsEnabled: hostedCallsAllowedByOperator,
});
const runtimeSettings = withHostedOperatorGate(
  runtimeSettingsStore,
  hostedCallsAllowedByOperator,
);

const spendDailyUsd = parseOptionalBudgetUsd(
  "ECORIONE_SPEND_DAILY_USD",
  process.env.ECORIONE_SPEND_DAILY_USD,
);
const spendMonthlyUsd = parseOptionalBudgetUsd(
  "ECORIONE_SPEND_MONTHLY_USD",
  process.env.ECORIONE_SPEND_MONTHLY_USD,
);
const spendBudgetPath = resolveRepoRuntimePath(
  REPO_ROOT,
  process.env.ECORIONE_SPEND_BUDGET_PATH,
  "data/connect-spend-budget.json",
);
const spendBudget =
  spendDailyUsd === undefined && spendMonthlyUsd === undefined
    ? undefined
    : new FileSpendBudget(spendBudgetPath, {
        dailyUsd: spendDailyUsd,
        monthlyUsd: spendMonthlyUsd,
      });
/**
 * ADR-21: dispatch hosted tunduk pada kill switch DAN plafon kumulatif. Tanpa plafon
 * terkonfigurasi, Connect menolak hosted (`SPEND_BUDGET_NOT_CONFIGURED`) alih-alih
 * berjalan tanpa admission control sama sekali. Operator yang memang menginginkan
 * tanpa-plafon harus menyatakannya, bukan mendapatkannya karena lupa mengisi env.
 */
const hostedSpendUnlimited = process.env.ECORIONE_SPEND_UNLIMITED === "1";

/**
 * Identitas model lokal diselesaikan lewat boundary provider, bukan dipercaya dari
 * deklarasi env (audit 2026-09-14 S2-5). TTL pendek supaya `ollama pull` yang mengganti
 * isi sebuah tag terlihat, karena justru itu yang sedang dijaga.
 */
const localProvenanceResolver = new LocalModelProvenanceResolver();
const resolveLocalProvenance: BuildConnectServerOptions["resolveLocalProvenance"] = (input) =>
  localProvenanceResolver.resolve(input);

const localMultimodalUrl = process.env.ECORIONE_MULTIMODAL_LOCAL_URL || undefined;
const hostedMultimodalUrl = process.env.ECORIONE_MULTIMODAL_HOSTED_URL || undefined;
const hostedMultimodalReservationUsd =
  parseOptionalBudgetUsd(
    "ECORIONE_MULTIMODAL_HOSTED_RESERVATION_USD",
    process.env.ECORIONE_MULTIMODAL_HOSTED_RESERVATION_USD,
  ) ?? 1;
const localMultimodalAdapter =
  localMultimodalUrl === undefined
    ? undefined
    : new HttpMultimodalAdapter({ route: "local", endpoint: localMultimodalUrl });
const hostedMultimodalAdapter =
  hostedMultimodalUrl === undefined
    ? undefined
    : new HttpMultimodalAdapter({
        route: "hosted",
        endpoint: hostedMultimodalUrl,
        reservationUsd: hostedMultimodalReservationUsd,
        authorizationBearer: () => {
          const provider = runtimeSettings.get().settings.hostedProvider;
          return (
            credentialVault?.get(provider, "messages") ?? developmentHostedApiKey(provider)
          );
        },
      });

const mcpRegistryPath = resolveRepoRuntimePath(
  REPO_ROOT,
  process.env.ECORIONE_MCP_OUTBOUND_REGISTRY_PATH,
  "data/connect-mcp-registry.json",
);
const mcpInvocationPath = resolveRepoRuntimePath(
  REPO_ROOT,
  process.env.ECORIONE_MCP_OUTBOUND_INVOCATION_PATH,
  "data/connect-mcp-invocations.json",
);
const mcpCredentials =
  credentialVault === undefined ? undefined : new VaultMcpCredentialReader(credentialVault);
const mcpManager = new McpManager(
  new FileMcpRegistry(mcpRegistryPath),
  new SdkMcpClientFactory(mcpCredentials, process.env.ECORIONE_MCP_STDIO_ALLOWLIST ?? ""),
  new HubMcpGovernance(process.env.ECORIONE_HUB_URL ?? "http://127.0.0.1:17024", token),
  new FileMcpInvocationStore(mcpInvocationPath),
);

const app = buildConnectServer({
  token,
  logger: true,
  credentialVault,
  credentialVaultAdmin: credentialVault,
  runtimeSettings,
  hostedProvider,
  anthropicApiKey,
  openrouterApiKey,
  openaiApiKey,
  localRuntime,
  localBaseUrl,
  localModelTag,
  localModelDigest,
  hostedCallsEnabled: hostedCallsAllowedByOperator,
  spendBudget,
  hostedSpendUnlimited,
  resolveLocalProvenance,
  mcpManager,
  localMultimodalAdapter,
  hostedMultimodalAdapter,
  flowUrl,
  webhookRootSecret,
});

app
  .listen({ port, host })
  .then(() => {
    app.log.info(
      `Connect jalan di http://${host}:${String(port)} provider=${hostedProvider} local=${localRuntime}`,
    );
  })
  .catch((err: unknown) => {
    app.log.error(err);
    process.exit(1);
  });
