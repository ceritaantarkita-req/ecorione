import { BackupIntegrityError, OwnerBackupStore, type BackupManifest, type RestoreReceipt } from "@ecorione/shared-server";
import type { SpaceDatabase } from "./db.js";

function assertHealthy(db: SpaceDatabase): void {
  const quick = db.raw.pragma("quick_check", { simple: true });
  if (quick !== "ok") throw new BackupIntegrityError(`Space quick_check gagal: ${String(quick)}`);
  const foreignKeys = db.raw.pragma("foreign_key_check") as readonly unknown[];
  if (foreignKeys.length > 0) throw new BackupIntegrityError("Space foreign_key_check gagal");
}

export async function backupSpaceDatabase(
  db: SpaceDatabase,
  backupRoot: string,
  createdAt: string,
): Promise<BackupManifest> {
  assertHealthy(db);
  const store = new OwnerBackupStore(backupRoot, "space");
  const release = store.acquireOperationLock();
  try {
    return await store.createSqlite("space-db", (destination) => db.raw.backup(destination), createdAt);
  } finally {
    release();
  }
}

/** Caller wajib menghentikan/menutup Space DB sebelum restore file SQLite. */
export function restoreSpaceDatabase(
  backupRoot: string,
  backupId: string,
  targetPath: string,
  restoredAt: string,
): RestoreReceipt {
  const store = new OwnerBackupStore(backupRoot, "space");
  const release = store.acquireOperationLock();
  try {
    return store.restoreFile(backupId, targetPath, restoredAt);
  } finally {
    release();
  }
}
