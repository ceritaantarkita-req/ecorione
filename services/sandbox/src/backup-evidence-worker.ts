import { existsSync, readdirSync } from "node:fs";
import { resolve, sep } from "node:path";
import { resolveRepoRuntimePath } from "@ecorione/shared-server";
import { backupSandboxReceipts, restoreSandboxReceipts } from "./backup.js";
import { SandboxReceiptStore } from "./receipt-store.js";

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

const source = resolveRepoRuntimePath(
  REPO_ROOT,
  process.env.ECORIONE_SANDBOX_RECEIPT_DIR,
  "data/sandbox-receipts",
);

const action = arg(2, "action");
const backupRoot = evidencePath(arg(3, "backupRoot"));
const timestamp = arg(4, "timestamp");

if (action === "backup") {
  if (!existsSync(source)) {
    console.log(JSON.stringify({ owner: "sandbox", action, status: "missing", source }));
  } else {
    const manifest = backupSandboxReceipts(
      new SandboxReceiptStore(source),
      backupRoot,
      timestamp,
    );
    console.log(
      JSON.stringify({ owner: "sandbox", action, status: "backed-up", source, manifest }),
    );
  }
} else if (action === "restore") {
  const restoreRoot = evidencePath(arg(5, "restoreRoot"));
  const ids = JSON.parse(arg(6, "backupIdsJson")) as { receipts?: string | null };
  if (!ids.receipts) {
    console.log(JSON.stringify({ owner: "sandbox", action, status: "missing" }));
  } else {
    const target = resolve(restoreRoot, "sandbox/receipts");
    if (target === source)
      throw new Error("isolated restore target resolves to active Sandbox receipts");
    const receipt = restoreSandboxReceipts(backupRoot, ids.receipts, target, timestamp);
    const verification = {
      root: new SandboxReceiptStore(target).root,
      topLevelEntries: readdirSync(target).length,
    };
    console.log(
      JSON.stringify({
        owner: "sandbox",
        action,
        status: "restored",
        target,
        receipt,
        verification,
      }),
    );
  }
} else {
  throw new Error(`unsupported action: ${action}`);
}
