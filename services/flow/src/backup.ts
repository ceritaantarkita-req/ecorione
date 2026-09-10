import {
  BackupIntegrityError,
  OwnerBackupStore,
  type BackupManifest,
  type RestoreReceipt,
} from "@ecorione/shared-server";
import type { FlowDatabase } from "./db.js";

function assertHealthy(db: FlowDatabase): void {
  const quick = db.raw.pragma("quick_check", { simple: true });
  if (quick !== "ok")
    throw new BackupIntegrityError(`Flow quick_check gagal: ${String(quick)}`);
  const foreignKeys = db.raw.pragma("foreign_key_check") as readonly unknown[];
  if (foreignKeys.length > 0) throw new BackupIntegrityError("Flow foreign_key_check gagal");
}

export async function backupFlowGraphRegistry(
  db: FlowDatabase,
  backupRoot: string,
  createdAt: string,
): Promise<BackupManifest> {
  assertHealthy(db);
  const store = new OwnerBackupStore(backupRoot, "flow");
  const release = store.acquireOperationLock();
  try {
    return await store.createSqlite(
      "flow-graph-registry",
      (destination) => db.raw.backup(destination),
      createdAt,
    );
  } finally {
    release();
  }
}

/** Caller wajib menghentikan/menutup Flow graph DB sebelum restore file SQLite. Temporal runtime persistence bukan bagian file ini. */
export function restoreFlowGraphRegistry(
  backupRoot: string,
  backupId: string,
  targetPath: string,
  restoredAt: string,
): RestoreReceipt {
  const store = new OwnerBackupStore(backupRoot, "flow");
  const release = store.acquireOperationLock();
  try {
    return store.restoreFile(backupId, targetPath, restoredAt);
  } finally {
    release();
  }
}
