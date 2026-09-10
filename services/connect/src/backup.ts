import { existsSync } from "node:fs";
import { basename } from "node:path";
import {
  OwnerBackupStore,
  type BackupManifest,
  type BundleBackupSource,
  type RestoreReceipt,
} from "@ecorione/shared-server";

export interface ConnectBackupPaths {
  readonly credentialVaultPath?: string | undefined;
  readonly spendBudgetPath?: string | undefined;
  readonly mcpRegistryPath?: string | undefined;
  readonly mcpInvocationPath?: string | undefined;
}

export interface ConnectBackupResult {
  readonly state: BackupManifest | null;
  readonly vaultCiphertext: BackupManifest | null;
}

/**
 * Backup Connect tidak pernah menerima master key dan tidak pernah memanggil decrypt.
 * Vault disalin sebagai ciphertext file terpisah; master key tetap out-of-band.
 */
export function backupConnectState(
  paths: ConnectBackupPaths,
  backupRoot: string,
  createdAt: string,
): ConnectBackupResult {
  const store = new OwnerBackupStore(backupRoot, "connect");
  const release = store.acquireOperationLock();
  try {
    const stateSources: BundleBackupSource[] = [];
    for (const path of [paths.spendBudgetPath, paths.mcpRegistryPath, paths.mcpInvocationPath]) {
      if (path !== undefined && existsSync(path)) {
        stateSources.push({ relativePath: basename(path), sourcePath: path });
      }
    }
    const state = stateSources.length === 0 ? null : store.createBundle("connect-state", stateSources, createdAt);
    const vaultCiphertext =
      paths.credentialVaultPath !== undefined && existsSync(paths.credentialVaultPath)
        ? store.createFile("credential-vault", paths.credentialVaultPath, "vault-ciphertext", createdAt)
        : null;
    return { state, vaultCiphertext };
  } finally {
    release();
  }
}

/** Restore ciphertext vault only; caller tetap harus menyediakan master key out-of-band. */
export function restoreConnectVaultCiphertext(
  backupRoot: string,
  backupId: string,
  targetPath: string,
  restoredAt: string,
): RestoreReceipt {
  const store = new OwnerBackupStore(backupRoot, "connect");
  const release = store.acquireOperationLock();
  try {
    const manifest = store.verify(backupId);
    if (manifest.kind !== "vault-ciphertext") throw new Error("backup bukan Connect vault ciphertext");
    return store.restoreFile(backupId, targetPath, restoredAt);
  } finally {
    release();
  }
}

export function restoreConnectState(
  backupRoot: string,
  backupId: string,
  targetRoot: string,
  restoredAt: string,
): RestoreReceipt {
  const store = new OwnerBackupStore(backupRoot, "connect");
  const release = store.acquireOperationLock();
  try {
    return store.restoreDirectory(backupId, targetRoot, restoredAt);
  } finally {
    release();
  }
}
