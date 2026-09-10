import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openContextDatabase } from "./db.js";
import { backupContextDatabase, restoreContextDatabase } from "./backup.js";

const roots: string[] = [];
function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "ecorione-context-dr-"));
  roots.push(root);
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("Context recovery drill", () => {
  it("online-backups a live SQLite owner and restores the pre-failure state offline", async () => {
    const root = tempRoot();
    const dbPath = join(root, "context.db");
    const backupRoot = join(root, "backups");
    const db = openContextDatabase({ path: dbPath });
    db.raw.exec("CREATE TABLE recovery_drill(value TEXT NOT NULL)");
    db.raw.prepare("INSERT INTO recovery_drill(value) VALUES (?)").run("before-failure");

    const backup = await backupContextDatabase(db, backupRoot, "2026-09-10T02:00:00.000Z");
    db.raw.prepare("UPDATE recovery_drill SET value = ?").run("after-failure");
    db.close();

    const receipt = restoreContextDatabase(
      backupRoot,
      backup.backupId,
      dbPath,
      "2026-09-10T02:01:00.000Z",
    );
    expect(receipt.safetyBackupId).not.toBeNull();

    const restored = openContextDatabase({ path: dbPath, runMigrations: false });
    const row = restored.raw.prepare("SELECT value FROM recovery_drill").get() as { value: string };
    expect(row.value).toBe("before-failure");
    expect(restored.raw.pragma("quick_check", { simple: true })).toBe("ok");
    restored.close();
  });
});
