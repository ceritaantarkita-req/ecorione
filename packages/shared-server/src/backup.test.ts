import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { BackupIntegrityError, BackupPathError, OwnerBackupStore } from "./backup.js";

const roots: string[] = [];
function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "ecorione-backup-"));
  roots.push(root);
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("OwnerBackupStore", () => {
  it("restores a byte-identical file and keeps a pre-restore safety backup", () => {
    const root = tempRoot();
    const source = join(root, "source.json");
    const backups = join(root, "backups");
    writeFileSync(source, "before\n", { mode: 0o600 });
    const store = new OwnerBackupStore(backups, "test-owner");
    const manifest = store.createFile("state", source, "file", "2026-09-10T01:00:00.000Z");

    writeFileSync(source, "after\n", { mode: 0o600 });
    const receipt = store.restoreFile(manifest.backupId, source, "2026-09-10T01:01:00.000Z");

    expect(readFileSync(source, "utf8")).toBe("before\n");
    expect(receipt.safetyBackupId).not.toBeNull();
    expect(store.verify(manifest.backupId)).toEqual(manifest);
    expect(store.verify(receipt.safetyBackupId!)).toBeTruthy();
  });

  it("fails closed when a backed-up payload is tampered", () => {
    const root = tempRoot();
    const source = join(root, "source.txt");
    const backups = join(root, "backups");
    writeFileSync(source, "trusted\n");
    const store = new OwnerBackupStore(backups, "owner");
    const manifest = store.createFile("state", source, "file", "2026-09-10T01:00:00.000Z");
    const entry = manifest.entries[0]!;
    const payload = join(backups, "owner", manifest.backupId, entry.relativePath);
    chmodSync(payload, 0o600);
    writeFileSync(payload, "tampered\n");

    expect(() => store.verify(manifest.backupId)).toThrow(BackupIntegrityError);
  });

  it("backs up and restores bundles without escaping the target root", () => {
    const root = tempRoot();
    const a = join(root, "a.json");
    const b = join(root, "b.json");
    writeFileSync(a, "A");
    writeFileSync(b, "B");
    const store = new OwnerBackupStore(join(root, "backups"), "connect");
    const manifest = store.createBundle(
      "state",
      [
        { relativePath: "a.json", sourcePath: a },
        { relativePath: "nested/b.json", sourcePath: b },
      ],
      "2026-09-10T01:00:00.000Z",
    );
    const target = join(root, "restored");
    const receipt = store.restoreDirectory(
      manifest.backupId,
      target,
      "2026-09-10T01:01:00.000Z",
    );

    expect(readFileSync(join(target, "a.json"), "utf8")).toBe("A");
    expect(readFileSync(join(target, "nested/b.json"), "utf8")).toBe("B");
    expect(receipt.restoredDigest).toBe(manifest.aggregateDigest);
  });

  it("rejects traversal and symlinks", () => {
    const root = tempRoot();
    const source = join(root, "source.txt");
    writeFileSync(source, "x");
    const store = new OwnerBackupStore(join(root, "backups"), "owner");
    expect(() =>
      store.createBundle(
        "state",
        [{ relativePath: "../escape", sourcePath: source }],
        "2026-09-10T01:00:00.000Z",
      ),
    ).toThrow(BackupPathError);

    const directory = join(root, "directory");
    mkdirSync(directory);
    symlinkSync(source, join(directory, "link"));
    expect(() =>
      store.createDirectory("directory", directory, "2026-09-10T01:00:00.000Z"),
    ).toThrow(BackupPathError);
  });
});
