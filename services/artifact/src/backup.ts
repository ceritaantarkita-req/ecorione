import {
  OwnerBackupStore,
  type BackupManifest,
  type RestoreReceipt,
} from "@ecorione/shared-server";
import type { ArtifactStore } from "./store.js";

export function backupArtifactStore(
  store: ArtifactStore,
  backupRoot: string,
  createdAt: string,
): BackupManifest {
  const backups = new OwnerBackupStore(backupRoot, "artifact");
  const release = backups.acquireOperationLock();
  try {
    return backups.createDirectory("artifact-cas", store.root, createdAt);
  } finally {
    release();
  }
}

/** Caller wajib menghentikan writers Artifact selama directory restore. */
export function restoreArtifactStore(
  backupRoot: string,
  backupId: string,
  targetRoot: string,
  restoredAt: string,
): RestoreReceipt {
  const backups = new OwnerBackupStore(backupRoot, "artifact");
  const release = backups.acquireOperationLock();
  try {
    return backups.restoreDirectory(backupId, targetRoot, restoredAt);
  } finally {
    release();
  }
}
