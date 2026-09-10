import { OwnerBackupStore, type BackupManifest, type RestoreReceipt } from "@ecorione/shared-server";
import type { SandboxReceiptStore } from "./receipt-store.js";

export function backupSandboxReceipts(
  store: SandboxReceiptStore,
  backupRoot: string,
  createdAt: string,
): BackupManifest {
  const backups = new OwnerBackupStore(backupRoot, "sandbox");
  const release = backups.acquireOperationLock();
  try {
    return backups.createDirectory("sandbox-receipts", store.root, createdAt);
  } finally {
    release();
  }
}

/** Caller wajib menghentikan receipt writers selama directory restore. */
export function restoreSandboxReceipts(
  backupRoot: string,
  backupId: string,
  targetRoot: string,
  restoredAt: string,
): RestoreReceipt {
  const backups = new OwnerBackupStore(backupRoot, "sandbox");
  const release = backups.acquireOperationLock();
  try {
    return backups.restoreDirectory(backupId, targetRoot, restoredAt);
  } finally {
    release();
  }
}
