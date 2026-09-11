import { existsSync } from "node:fs";
import { basename, resolve, sep } from "node:path";
import { resolveRepoRuntimePath } from "@ecorione/shared-server";
import {
  backupConnectState,
  restoreConnectState,
  restoreConnectVaultCiphertext,
} from "./backup.js";

const REPO_ROOT = resolve(import.meta.dirname, "../../..");
const EVIDENCE_ROOT = resolve(REPO_ROOT, ".ecorione/evidence/local-backup-restore");

function arg(index: number, name: string): string {
  const value = process.argv[index];
  if (value === undefined || value.length === 0) throw new Error(`missing ${name}`);
  return value;
}

function evidencePath(value: string): string {
  const path = resolve(value);
  if (path !== EVIDENCE_ROOT && !path.startsWith(`${EVIDENCE_ROOT}${sep}`)) {
    throw new Error(`evidence path keluar boundary: ${path}`);
  }
  return path;
}

const paths = {
  credentialVaultPath: resolveRepoRuntimePath(
    REPO_ROOT,
    process.env.ECORIONE_CONNECT_VAULT_PATH,
    "data/connect-credentials.vault.json",
  ),
  runtimeSettingsPath: resolveRepoRuntimePath(
    REPO_ROOT,
    process.env.ECORIONE_CONNECT_SETTINGS_PATH,
    "data/connect-runtime-settings.json",
  ),
  spendBudgetPath: resolveRepoRuntimePath(
    REPO_ROOT,
    process.env.ECORIONE_SPEND_BUDGET_PATH,
    "data/connect-spend-budget.json",
  ),
  mcpRegistryPath: resolveRepoRuntimePath(
    REPO_ROOT,
    process.env.ECORIONE_MCP_OUTBOUND_REGISTRY_PATH,
    "data/connect-mcp-registry.json",
  ),
  mcpInvocationPath: resolveRepoRuntimePath(
    REPO_ROOT,
    process.env.ECORIONE_MCP_OUTBOUND_INVOCATION_PATH,
    "data/connect-mcp-invocations.json",
  ),
};

const action = arg(2, "action");
const backupRoot = evidencePath(arg(3, "backupRoot"));
const timestamp = arg(4, "timestamp");

if (action === "backup") {
  const result = backupConnectState(paths, backupRoot, timestamp);
  const present = Object.fromEntries(
    Object.entries(paths).map(([name, path]) => [name, existsSync(path)]),
  );
  console.log(
    JSON.stringify({
      owner: "connect",
      action,
      status: result.state !== null || result.vaultCiphertext !== null ? "backed-up" : "missing",
      source: paths,
      present,
      manifests: result,
    }),
  );
} else if (action === "restore") {
  const restoreRoot = evidencePath(arg(5, "restoreRoot"));
  const ids = JSON.parse(arg(6, "backupIdsJson")) as {
    state?: string | null;
    vault?: string | null;
  };
  const stateRoot = resolve(restoreRoot, "connect/state");
  const vaultTarget = resolve(
    restoreRoot,
    "connect/vault",
    basename(paths.credentialVaultPath),
  );
  if (Object.values(paths).includes(stateRoot) || Object.values(paths).includes(vaultTarget)) {
    throw new Error("isolated restore target resolves to active Connect state");
  }
  const stateReceipt = ids.state
    ? restoreConnectState(backupRoot, ids.state, stateRoot, timestamp)
    : null;
  const vaultReceipt = ids.vault
    ? restoreConnectVaultCiphertext(backupRoot, ids.vault, vaultTarget, timestamp)
    : null;
  const restoredPaths = {
    credentialVaultPath: vaultReceipt === null ? null : vaultTarget,
    runtimeSettingsPath: resolve(stateRoot, basename(paths.runtimeSettingsPath)),
    spendBudgetPath: resolve(stateRoot, basename(paths.spendBudgetPath)),
    mcpRegistryPath: resolve(stateRoot, basename(paths.mcpRegistryPath)),
    mcpInvocationPath: resolve(stateRoot, basename(paths.mcpInvocationPath)),
  };
  console.log(
    JSON.stringify({
      owner: "connect",
      action,
      status: stateReceipt !== null || vaultReceipt !== null ? "restored" : "missing",
      target: restoredPaths,
      receipts: { state: stateReceipt, vault: vaultReceipt },
      present: Object.fromEntries(
        Object.entries(restoredPaths).map(([name, path]) => [
          name,
          path === null ? false : existsSync(path),
        ]),
      ),
    }),
  );
} else {
  throw new Error(`unsupported action: ${action}`);
}
