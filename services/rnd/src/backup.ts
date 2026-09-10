import { BackupIntegrityError, OwnerBackupStore, type BackupManifest, type RestoreReceipt } from "@ecorione/shared-server";
import type { RndDatabase } from "./db.js";

function assertHealthy(db: RndDatabase): void {
  const quick = db.raw.pragma("quick_check", { simple: true });
  if (quick !== "ok") throw new BackupIntegrityError(`RnD quick_check gagal: ${String(quick)}`);
}

export async function backupRndDatabase(
  db: RndDatabase,
  backupRoot: string,
  createdAt: string,
): Promise<BackupManifest> {
  assertHealthy(db);
  const store = new OwnerBackupStore(backupRoot, "rnd");
  const release = store.acquireOperationLock();
  try {
    return await store.createSqlite("rnd-db", (destination) => db.raw.backup(destination), createdAt);
  } finally {
    release();
  }
}

/** Caller wajib menghentikan/menutup RnD DB sebelum restore file SQLite. */
export function restoreRndDatabase(
  backupRoot: string,
  backupId: string,
  targetPath: string,
  restoredAt: string,
): RestoreReceipt {
  const store = new OwnerBackupStore(backupRoot, "rnd");
  const release = store.acquireOperationLock();
  try {
    return store.restoreFile(backupId, targetPath, restoredAt);
  } finally {
    release();
  }
}
