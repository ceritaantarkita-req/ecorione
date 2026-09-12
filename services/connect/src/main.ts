/** Entrypoint produksi Connect. */
import { resolve } from "node:path";
import { bindHost, resolveRepoRuntimePath } from "@ecorione/shared-server";
import { FileCredentialVault } from "./credential-vault.js";
import { buildConnectServer } from "./http.js";
import { VaultMcpCredentialReader } from "./mcp-client/credentials.js";
import { HubMcpGovernance } from "./mcp-client/governance.js";
import { FileMcpInvocationStore } from "./mcp-client/invocation-store.js";
import { McpManager } from "./mcp-client/manager.js";
import { FileMcpRegistry } from "./mcp-client/registry.js";
import { SdkMcpClientFactory } from "./mcp-client/sdk-client.js";
import { HttpMultimodalAdapter } from "./multimodal.js";
import { withHostedOperatorGate } from "./operator-runtime-settings.js";
import { parseHostedProvider } from "./provider-types.js";
import { parseLocalRuntime } from "./providers/local-runtime.js";
import { FileRuntimeSettings } from "./runtime-settings.js";
import { FileSpendBudget, parseOptionalBudgetUsd } from "./spend-budget.js";

const REPO_ROOT = resolve(import.meta.dirname, "../../..");
const port = Number(process.env.ECORIONE_CONNECT_PORT ?? "17023");
const token = process.env.ECORIONE_INTERNAL_TOKEN || undefined;
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
  hostedCallsEnabled: hostedCallsAllowedByOperator,
  spendBudget,
  mcpManager,
  localMultimodalAdapter,
  hostedMultimodalAdapter,
});

app
  .listen({ port, host: bindHost() })
  .then(() => {
    app.log.info(
      `Connect jalan di http://${bindHost()}:${String(port)} provider=${hostedProvider} local=${localRuntime}`,
    );
  })
  .catch((err: unknown) => {
    app.log.error(err);
    process.exit(1);
  });
