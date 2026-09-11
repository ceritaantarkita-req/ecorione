import { existsSync } from "node:fs";
import { resolve, sep } from "node:path";
import { resolveRepoRuntimePath } from "@ecorione/shared-server";
import {
  backupRndDatabase,
  backupRndDatasets,
  restoreRndDatabase,
  restoreRndDatasets,
} from "./backup.js";
import { openRndDatabase } from "./db.js";

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

const dbPath = resolveRepoRuntimePath(REPO_ROOT, process.env.ECORIONE_RND_DB_PATH, "data/rnd.db");
const datasetRoot = resolveRepoRuntimePath(
  REPO_ROOT,
  process.env.ECORIONE_RND_DATASET_ROOT,
  "data/rnd-datasets",
);

function inspect(path: string): { quickCheck: unknown; tableCount: number } {
  const db = openRndDatabase(path);
  try {
    return {
      quickCheck: db.raw.pragma("quick_check", { simple: true }),
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
  let dbManifest = null;
  if (existsSync(dbPath)) {
    const db = openRndDatabase(dbPath);
    try {
      dbManifest = await backupRndDatabase(db, backupRoot, timestamp);
    } finally {
      db.close();
    }
  }
  const datasetsManifest = existsSync(datasetRoot)
    ? backupRndDatasets(datasetRoot, backupRoot, timestamp)
    : null;
  console.log(
    JSON.stringify({
      owner: "rnd",
      action,
      status: dbManifest !== null || datasetsManifest !== null ? "backed-up" : "missing",
      source: { dbPath, datasetRoot },
      manifests: { db: dbManifest, datasets: datasetsManifest },
    }),
  );
} else if (action === "restore") {
  const restoreRoot = evidencePath(arg(5, "restoreRoot"));
  const ids = JSON.parse(arg(6, "backupIdsJson")) as {
    db?: string | null;
    datasets?: string | null;
  };
  const targetDb = resolve(restoreRoot, "rnd/rnd.db");
  const targetDatasets = resolve(restoreRoot, "rnd/datasets");
  if (targetDb === dbPath || targetDatasets === datasetRoot) {
    throw new Error("isolated restore target resolves to active RnD state");
  }
  const dbReceipt = ids.db
    ? restoreRndDatabase(backupRoot, ids.db, targetDb, timestamp)
    : null;
  const datasetsReceipt = ids.datasets
    ? restoreRndDatasets(backupRoot, ids.datasets, targetDatasets, timestamp)
    : null;
  const verification = dbReceipt === null ? null : inspect(targetDb);
  if (verification !== null && verification.quickCheck !== "ok") {
    throw new Error(`restored RnD DB integrity failed: ${JSON.stringify(verification)}`);
  }
  console.log(
    JSON.stringify({
      owner: "rnd",
      action,
      status: dbReceipt !== null || datasetsReceipt !== null ? "restored" : "missing",
      target: { dbPath: targetDb, datasetRoot: targetDatasets },
      receipts: { db: dbReceipt, datasets: datasetsReceipt },
      verification,
    }),
  );
} else {
  throw new Error(`unsupported action: ${action}`);
}
