import { createHash, randomUUID } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  closeSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
export type { BackupManifest, RestoreReceipt } from "@ecorione/shared-schema";
import {
  BackupManifestSchema,
  type BackupEntry,
  type BackupKind,
  type BackupManifest,
  type RestoreReceipt,
} from "@ecorione/shared-schema";

export class BackupIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackupIntegrityError";
  }
}

export class BackupPathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackupPathError";
  }
}

function safeSegment(value: string): string {
  if (!/^[a-z0-9][a-z0-9._-]{0,127}$/i.test(value)) {
    throw new BackupPathError(`segmen path backup tidak valid: ${value}`);
  }
  return value;
}

function safeRelative(value: string): string {
  const normalized = value.replaceAll("\\", "/");
  if (
    normalized.length === 0 ||
    normalized.startsWith("/") ||
    normalized.split("/").some((part) => part === "" || part === "." || part === "..")
  ) {
    throw new BackupPathError(`relative path backup tidak valid: ${value}`);
  }
  return normalized;
}

function digestBytes(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function digestFile(path: string): string {
  return digestBytes(readFileSync(path));
}

function canonicalEntries(entries: readonly BackupEntry[]): string {
  return JSON.stringify(
    [...entries]
      .sort((a, b) => a.relativePath.localeCompare(b.relativePath))
      .map((entry) => ({
        relativePath: entry.relativePath,
        digest: entry.digest,
        sizeBytes: entry.sizeBytes,
      })),
  );
}

function aggregateDigest(entries: readonly BackupEntry[]): string {
  return digestBytes(canonicalEntries(entries));
}

function listRegularFiles(root: string): readonly string[] {
  const result: string[] = [];
  const walk = (directory: string): void => {
    for (const name of readdirSync(directory).sort()) {
      const path = join(directory, name);
      const stat = lstatSync(path);
      if (stat.isSymbolicLink()) {
        throw new BackupPathError(`symlink tidak boleh masuk backup: ${path}`);
      }
      if (stat.isDirectory()) walk(path);
      else if (stat.isFile()) result.push(path);
      else throw new BackupPathError(`jenis file tidak didukung: ${path}`);
    }
  };
  walk(root);
  return result;
}

function relativeFrom(root: string, path: string): string {
  const value = relative(root, path).split(sep).join("/");
  return safeRelative(value);
}

function copyWithEntry(source: string, destination: string, relativePath: string): BackupEntry {
  mkdirSync(dirname(destination), { recursive: true, mode: 0o700 });
  copyFileSync(source, destination);
  chmodSync(destination, 0o600);
  const stat = statSync(destination);
  return {
    relativePath: safeRelative(relativePath),
    digest: digestFile(destination),
    sizeBytes: stat.size,
  };
}

function writeManifest(path: string, manifest: BackupManifest): void {
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx",
  });
  chmodSync(path, 0o600);
}

function readManifest(path: string): BackupManifest {
  try {
    return BackupManifestSchema.parse(JSON.parse(readFileSync(path, "utf8")) as unknown);
  } catch (error) {
    throw new BackupIntegrityError(
      `manifest backup tidak valid: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export interface BundleBackupSource {
  readonly relativePath: string;
  readonly sourcePath: string;
}

export interface SnapshotWriter {
  (destinationPath: string): Promise<unknown>;
}

/**
 * Primitive backup reusable yang tidak mengetahui path database service lain.
 * Owner membangun store sendiri dan memasukkan handle/path yang memang dimilikinya.
 */
export class OwnerBackupStore {
  readonly root: string;
  readonly owner: string;

  constructor(root: string, owner: string) {
    this.root = resolve(root);
    this.owner = safeSegment(owner);
    mkdirSync(join(this.root, this.owner), { recursive: true, mode: 0o700 });
    chmodSync(join(this.root, this.owner), 0o700);
  }

  private ownerRoot(): string {
    return join(this.root, this.owner);
  }

  private finalize(
    stagingRoot: string,
    logicalName: string,
    kind: BackupKind,
    createdAt: string,
    entries: readonly BackupEntry[],
  ): BackupManifest {
    const sortedEntries = [...entries].sort((a, b) =>
      a.relativePath.localeCompare(b.relativePath),
    );
    const aggregate = aggregateDigest(sortedEntries);
    const backupId = digestBytes(
      JSON.stringify({
        format: "ecorione.owner-backup/v1",
        owner: this.owner,
        logicalName,
        kind,
        createdAt,
        aggregateDigest: aggregate,
        entries: sortedEntries,
      }),
    );
    const manifest = BackupManifestSchema.parse({
      format: "ecorione.owner-backup/v1",
      backupId,
      owner: this.owner,
      logicalName,
      kind,
      createdAt,
      aggregateDigest: aggregate,
      entries: sortedEntries,
    });
    writeManifest(join(stagingRoot, "manifest.json"), manifest);
    const finalRoot = join(this.ownerRoot(), backupId);
    if (existsSync(finalRoot)) {
      const existing = this.verify(backupId);
      if (JSON.stringify(existing) !== JSON.stringify(manifest)) {
        throw new BackupIntegrityError(`backup id collision untuk ${backupId}`);
      }
      rmSync(stagingRoot, { recursive: true, force: true });
      return existing;
    }
    renameSync(stagingRoot, finalRoot);
    chmodSync(finalRoot, 0o700);
    return manifest;
  }

  private stagingRoot(): string {
    const path = join(this.ownerRoot(), `.tmp-${randomUUID()}`);
    mkdirSync(path, { recursive: false, mode: 0o700 });
    return path;
  }

  createFile(
    logicalName: string,
    sourcePath: string,
    kind: Extract<BackupKind, "file" | "vault-ciphertext">,
    createdAt: string,
  ): BackupManifest {
    const name = safeSegment(logicalName);
    const staging = this.stagingRoot();
    try {
      const entry = copyWithEntry(
        sourcePath,
        join(staging, "payload", basename(sourcePath)),
        `payload/${basename(sourcePath)}`,
      );
      return this.finalize(staging, name, kind, createdAt, [entry]);
    } catch (error) {
      rmSync(staging, { recursive: true, force: true });
      throw error;
    }
  }

  createDirectory(logicalName: string, sourceRoot: string, createdAt: string): BackupManifest {
    const name = safeSegment(logicalName);
    const resolvedSource = resolve(sourceRoot);
    const staging = this.stagingRoot();
    try {
      const entries = listRegularFiles(resolvedSource).map((source) => {
        const rel = relativeFrom(resolvedSource, source);
        return copyWithEntry(source, join(staging, "payload", rel), `payload/${rel}`);
      });
      return this.finalize(staging, name, "directory", createdAt, entries);
    } catch (error) {
      rmSync(staging, { recursive: true, force: true });
      throw error;
    }
  }

  createBundle(
    logicalName: string,
    sources: readonly BundleBackupSource[],
    createdAt: string,
  ): BackupManifest {
    if (sources.length === 0)
      throw new BackupIntegrityError("bundle backup tidak boleh kosong");
    const name = safeSegment(logicalName);
    const staging = this.stagingRoot();
    try {
      const seen = new Set<string>();
      const entries = sources.map((source) => {
        const rel = safeRelative(source.relativePath);
        if (seen.has(rel)) throw new BackupPathError(`relative path bundle duplikat: ${rel}`);
        seen.add(rel);
        return copyWithEntry(
          source.sourcePath,
          join(staging, "payload", rel),
          `payload/${rel}`,
        );
      });
      return this.finalize(staging, name, "bundle", createdAt, entries);
    } catch (error) {
      rmSync(staging, { recursive: true, force: true });
      throw error;
    }
  }

  async createSqlite(
    logicalName: string,
    snapshotWriter: SnapshotWriter,
    createdAt: string,
  ): Promise<BackupManifest> {
    const name = safeSegment(logicalName);
    const staging = this.stagingRoot();
    const destination = join(staging, "payload", `${name}.sqlite`);
    mkdirSync(dirname(destination), { recursive: true, mode: 0o700 });
    try {
      await snapshotWriter(destination);
      chmodSync(destination, 0o600);
      const stat = statSync(destination);
      const entry: BackupEntry = {
        relativePath: `payload/${name}.sqlite`,
        digest: digestFile(destination),
        sizeBytes: stat.size,
      };
      return this.finalize(staging, name, "sqlite", createdAt, [entry]);
    } catch (error) {
      rmSync(staging, { recursive: true, force: true });
      throw error;
    }
  }

  verify(backupId: string): BackupManifest {
    if (!/^[a-f0-9]{64}$/.test(backupId)) throw new BackupPathError("backup id tidak valid");
    const root = join(this.ownerRoot(), backupId);
    const manifest = readManifest(join(root, "manifest.json"));
    if (manifest.owner !== this.owner || manifest.backupId !== backupId) {
      throw new BackupIntegrityError("owner/backup id manifest tidak cocok");
    }
    for (const entry of manifest.entries) {
      const rel = safeRelative(entry.relativePath);
      const path = join(root, rel);
      const stat = statSync(path);
      if (
        !stat.isFile() ||
        stat.size !== entry.sizeBytes ||
        digestFile(path) !== entry.digest
      ) {
        throw new BackupIntegrityError(`integritas payload backup gagal: ${rel}`);
      }
    }
    if (aggregateDigest(manifest.entries) !== manifest.aggregateDigest) {
      throw new BackupIntegrityError("aggregate digest backup tidak cocok");
    }
    return manifest;
  }

  restoreFile(backupId: string, targetPath: string, restoredAt: string): RestoreReceipt {
    const manifest = this.verify(backupId);
    if (!(["sqlite", "file", "vault-ciphertext"] as const).includes(manifest.kind as never)) {
      throw new BackupIntegrityError(
        `backup ${manifest.kind} tidak dapat direstore sebagai file`,
      );
    }
    if (manifest.entries.length !== 1)
      throw new BackupIntegrityError("file backup harus satu entry");
    const entry = manifest.entries[0]!;
    const source = join(this.ownerRoot(), backupId, safeRelative(entry.relativePath));
    const target = resolve(targetPath);
    mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
    let safetyBackupId: string | null = null;
    if (existsSync(target)) {
      safetyBackupId = this.createFile("pre-restore", target, "file", restoredAt).backupId;
    }
    const temp = `${target}.restore-${randomUUID()}`;
    try {
      copyFileSync(source, temp);
      chmodSync(temp, 0o600);
      if (digestFile(temp) !== entry.digest)
        throw new BackupIntegrityError("staging restore digest mismatch");
      renameSync(temp, target);
      chmodSync(target, 0o600);
    } finally {
      rmSync(temp, { force: true });
    }
    const restoredDigest = digestFile(target);
    if (restoredDigest !== entry.digest)
      throw new BackupIntegrityError("restore digest mismatch");
    return {
      format: "ecorione.owner-restore/v1",
      owner: this.owner,
      backupId,
      restoredAt,
      target,
      restoredDigest,
      safetyBackupId,
    };
  }

  restoreDirectory(backupId: string, targetRoot: string, restoredAt: string): RestoreReceipt {
    const manifest = this.verify(backupId);
    if (manifest.kind !== "directory" && manifest.kind !== "bundle") {
      throw new BackupIntegrityError(
        `backup ${manifest.kind} tidak dapat direstore sebagai directory`,
      );
    }
    const target = resolve(targetRoot);
    const staging = `${target}.restore-${randomUUID()}`;
    const displaced = `${target}.pre-restore-${randomUUID()}`;
    let safetyBackupId: string | null = null;
    if (existsSync(target))
      safetyBackupId = this.createDirectory("pre-restore", target, restoredAt).backupId;
    mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
    mkdirSync(staging, { recursive: false, mode: 0o700 });
    try {
      for (const entry of manifest.entries) {
        const source = join(this.ownerRoot(), backupId, safeRelative(entry.relativePath));
        const payloadRelative = safeRelative(entry.relativePath).replace(/^payload\//, "");
        const destination = join(staging, payloadRelative);
        copyWithEntry(source, destination, payloadRelative);
      }
      if (existsSync(target)) renameSync(target, displaced);
      try {
        renameSync(staging, target);
      } catch (error) {
        if (existsSync(displaced) && !existsSync(target)) renameSync(displaced, target);
        throw error;
      }
      rmSync(displaced, { recursive: true, force: true });
    } finally {
      rmSync(staging, { recursive: true, force: true });
    }
    const restoredEntries = listRegularFiles(target).map((path) => ({
      relativePath: `payload/${relativeFrom(target, path)}`,
      digest: digestFile(path),
      sizeBytes: statSync(path).size,
    }));
    const restoredDigest = aggregateDigest(restoredEntries);
    if (restoredDigest !== manifest.aggregateDigest)
      throw new BackupIntegrityError("restore directory digest mismatch");
    return {
      format: "ecorione.owner-restore/v1",
      owner: this.owner,
      backupId,
      restoredAt,
      target,
      restoredDigest,
      safetyBackupId,
    };
  }

  acquireOperationLock(): () => void {
    const path = join(this.ownerRoot(), ".operation.lock");
    let fd: number;
    try {
      fd = openSync(path, "wx", 0o600);
    } catch (error) {
      throw new BackupIntegrityError(
        `backup/restore owner sedang aktif: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return () => {
      closeSync(fd);
      rmSync(path, { force: true });
    };
  }
}
