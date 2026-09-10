import { BackupIntegrityError, OwnerBackupStore, type BackupManifest, type RestoreReceipt } from "@ecorione/shared-server";
import type { ContextDatabase } from "./db.js";

function assertHealthy(db: ContextDatabase): void {
  const quick = db.raw.pragma("quick_check", { simple: true });
  if (quick !== "ok") throw new BackupIntegrityError(`Context quick_check gagal: ${String(quick)}`);
  const foreignKeys = db.raw.pragma("foreign_key_check") as readonly unknown[];
  if (foreignKeys.length > 0) throw new BackupIntegrityError("Context foreign_key_check gagal");
}

export async function backupContextDatabase(
  db: ContextDatabase,
  backupRoot: string,
  createdAt: string,
): Promise<BackupManifest> {
  assertHealthy(db);
  const store = new OwnerBackupStore(backupRoot, "context");
  const release = store.acquireOperationLock();
  try {
    return await store.createSqlite("context-db", (destination) => db.raw.backup(destination), createdAt);
  } finally {
    release();
  }
}

/** Caller wajib menghentikan/menutup Context DB sebelum restore file SQLite. */
export function restoreContextDatabase(
  backupRoot: string,
  backupId: string,
  targetPath: string,
  restoredAt: string,
): RestoreReceipt {
  const store = new OwnerBackupStore(backupRoot, "context");
  const release = store.acquireOperationLock();
  try {
    return store.restoreFile(backupId, targetPath, restoredAt);
  } finally {
    release();
  }
}
