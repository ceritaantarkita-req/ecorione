/** Entrypoint produksi Connect. */
import { resolve } from "node:path";
import { bindHost } from "@ecorione/shared-server";
import { FileCredentialVault } from "./credential-vault.js";
import { buildConnectServer } from "./http.js";
import { parseHostedProvider } from "./provider-types.js";
import { parseLocalRuntime } from "./providers/local-runtime.js";
import { FileSpendBudget, parseOptionalBudgetUsd } from "./spend-budget.js";

const port = Number(process.env.ECORIONE_CONNECT_PORT ?? "17023");
const token = process.env.ECORIONE_INTERNAL_TOKEN || undefined;
const hostedProvider = parseHostedProvider(process.env.ECORIONE_HOSTED_PROVIDER);

const vaultMasterKey = process.env.ECORIONE_CONNECT_VAULT_MASTER_KEY || undefined;
const vaultPath =
  process.env.ECORIONE_CONNECT_VAULT_PATH ??
  resolve(import.meta.dirname, "../../../data/connect-credentials.vault.json");
const credentialVault =
  vaultMasterKey === undefined ? undefined : new FileCredentialVault(vaultPath, vaultMasterKey);

// Raw provider env keys are development-only and ignored as soon as the vault is active.
const anthropicApiKey =
  credentialVault === undefined ? process.env.ANTHROPIC_API_KEY || undefined : undefined;
const openrouterApiKey =
  credentialVault === undefined ? process.env.OPENROUTER_API_KEY || undefined : undefined;
const openaiApiKey =
  credentialVault === undefined ? process.env.OPENAI_API_KEY || undefined : undefined;

const localRuntime = parseLocalRuntime(process.env.ECORIONE_LOCAL_RUNTIME);
const localBaseUrl = process.env.ECORIONE_LOCAL_BASE_URL ?? "http://127.0.0.1:11434/v1";
const localModelTag = process.env.ECORIONE_LOCAL_MODEL ?? "qwen3:8b-instruct-q4_K_M";
const hostedCallsEnabled = process.env.ECORIONE_COST_KILL_SWITCH !== "1";

const spendDailyUsd = parseOptionalBudgetUsd(
  "ECORIONE_SPEND_DAILY_USD",
  process.env.ECORIONE_SPEND_DAILY_USD,
);
const spendMonthlyUsd = parseOptionalBudgetUsd(
  "ECORIONE_SPEND_MONTHLY_USD",
  process.env.ECORIONE_SPEND_MONTHLY_USD,
);
const spendBudgetPath =
  process.env.ECORIONE_SPEND_BUDGET_PATH ??
  resolve(import.meta.dirname, "../../../data/connect-spend-budget.json");
const spendBudget =
  spendDailyUsd === undefined && spendMonthlyUsd === undefined
    ? undefined
    : new FileSpendBudget(spendBudgetPath, {
        dailyUsd: spendDailyUsd,
        monthlyUsd: spendMonthlyUsd,
      });

const app = buildConnectServer({
  token,
  logger: true,
  credentialVault,
  hostedProvider,
  anthropicApiKey,
  openrouterApiKey,
  openaiApiKey,
  localRuntime,
  localBaseUrl,
  localModelTag,
  hostedCallsEnabled,
  spendBudget,
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
