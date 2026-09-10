import { BackupIntegrityError, OwnerBackupStore, type BackupManifest, type RestoreReceipt } from "@ecorione/shared-server";
import type { HubDatabase } from "./db.js";

function assertHealthy(db: HubDatabase): void {
  const quick = db.raw.pragma("quick_check", { simple: true });
  if (quick !== "ok") throw new BackupIntegrityError(`Hub quick_check gagal: ${String(quick)}`);
  const foreignKeys = db.raw.pragma("foreign_key_check") as readonly unknown[];
  if (foreignKeys.length > 0) throw new BackupIntegrityError("Hub foreign_key_check gagal");
}

export async function backupHubDatabase(
  db: HubDatabase,
  backupRoot: string,
  createdAt: string,
): Promise<BackupManifest> {
  assertHealthy(db);
  const store = new OwnerBackupStore(backupRoot, "hub");
  const release = store.acquireOperationLock();
  try {
    return await store.createSqlite("hub-db", (destination) => db.raw.backup(destination), createdAt);
  } finally {
    release();
  }
}

/** Caller wajib menghentikan/menutup Hub DB sebelum restore file SQLite. */
export function restoreHubDatabase(
  backupRoot: string,
  backupId: string,
  targetPath: string,
  restoredAt: string,
): RestoreReceipt {
  const store = new OwnerBackupStore(backupRoot, "hub");
  const release = store.acquireOperationLock();
  try {
    return store.restoreFile(backupId, targetPath, restoredAt);
  } finally {
    release();
  }
}
