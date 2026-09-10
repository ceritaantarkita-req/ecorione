import { BackupIntegrityError, OwnerBackupStore, type BackupManifest, type RestoreReceipt } from "@ecorione/shared-server";
import type { SyncDatabase } from "./db.js";

function assertHealthy(db: SyncDatabase): void {
  const quick = db.raw.pragma("quick_check", { simple: true });
  if (quick !== "ok") throw new BackupIntegrityError(`Sync quick_check gagal: ${String(quick)}`);
  const foreignKeys = db.raw.pragma("foreign_key_check") as readonly unknown[];
  if (foreignKeys.length > 0) throw new BackupIntegrityError("Sync foreign_key_check gagal");
}

export async function backupSyncDatabase(
  db: SyncDatabase,
  backupRoot: string,
  createdAt: string,
): Promise<BackupManifest> {
  assertHealthy(db);
  const store = new OwnerBackupStore(backupRoot, "sync");
  const release = store.acquireOperationLock();
  try {
    return await store.createSqlite("sync-db", (destination) => db.raw.backup(destination), createdAt);
  } finally {
    release();
  }
}

/** Caller wajib menghentikan/menutup Sync DB sebelum restore file SQLite. */
export function restoreSyncDatabase(
  backupRoot: string,
  backupId: string,
  targetPath: string,
  restoredAt: string,
): RestoreReceipt {
  const store = new OwnerBackupStore(backupRoot, "sync");
  const release = store.acquireOperationLock();
  try {
    return store.restoreFile(backupId, targetPath, restoredAt);
  } finally {
    release();
  }
}
