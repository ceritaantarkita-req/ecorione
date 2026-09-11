import { existsSync } from "node:fs";
import { resolve, sep } from "node:path";
import { resolveRepoRuntimePath } from "@ecorione/shared-server";
import { backupFlowGraphRegistry, restoreFlowGraphRegistry } from "./backup.js";
import { openFlowDatabase } from "./db.js";

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
  process.env.ECORIONE_FLOW_DB_PATH,
  "data/flow.sqlite",
);

function inspect(path: string): {
  quickCheck: unknown;
  foreignKeyViolations: number;
  tableCount: number;
} {
  const db = openFlowDatabase(path);
  try {
    return {
      quickCheck: db.raw.pragma("quick_check", { simple: true }),
      foreignKeyViolations: (db.raw.pragma("foreign_key_check") as readonly unknown[]).length,
      tableCount: (
        db.raw
          .prepare(
            "SELECT count(*) AS count FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
          )
          .get() as { count: number }
      ).count,
    };
  } finally {
    db.close();
  }
}

const action = arg(2, "action");
const backupRoot = evidencePath(arg(3, "backupRoot"));
const timestamp = arg(4, "timestamp");

if (action === "backup") {
  if (!existsSync(source)) {
    console.log(JSON.stringify({ owner: "flow", action, status: "missing", source }));
  } else {
    const db = openFlowDatabase(source);
    try {
      const manifest = await backupFlowGraphRegistry(db, backupRoot, timestamp);
      console.log(
        JSON.stringify({ owner: "flow", action, status: "backed-up", source, manifest }),
      );
    } finally {
      db.close();
    }
  }
} else if (action === "restore") {
  const restoreRoot = evidencePath(arg(5, "restoreRoot"));
  const ids = JSON.parse(arg(6, "backupIdsJson")) as { graph?: string | null };
  if (!ids.graph) {
    console.log(JSON.stringify({ owner: "flow", action, status: "missing" }));
  } else {
    const target = resolve(restoreRoot, "flow/flow.sqlite");
    if (target === source)
      throw new Error("isolated restore target resolves to active Flow DB");
    const receipt = restoreFlowGraphRegistry(backupRoot, ids.graph, target, timestamp);
    const verification = inspect(target);
    if (verification.quickCheck !== "ok" || verification.foreignKeyViolations !== 0) {
      throw new Error(`restored Flow DB integrity failed: ${JSON.stringify(verification)}`);
    }
    console.log(
      JSON.stringify({
        owner: "flow",
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
