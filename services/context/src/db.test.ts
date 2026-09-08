import { existsSync, rmSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openContextDatabase } from "./db.js";

let tempDir: string | undefined;

afterEach(() => {
  if (tempDir !== undefined) rmSync(tempDir, { recursive: true, force: true });
  tempDir = undefined;
});

describe("openContextDatabase", () => {
  it("membuat direktori induk yang belum ada — `pnpm dev` di mesin baru tidak boleh gagal karena ./data/ belum dibuat", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "ecorione-context-db-"));
    const dbPath = join(tempDir, "nested", "sub", "ecorione.db");
    expect(existsSync(dbPath)).toBe(false);

    const db = openContextDatabase({ path: dbPath });
    try {
      expect(existsSync(dbPath)).toBe(true);
    } finally {
      db.close();
    }
  });

  it("readonly ke DB yang belum ada tidak diam-diam membuat direktori — tetap gagal jelas", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "ecorione-context-db-ro-"));
    const dbPath = join(tempDir, "nested", "sub", "ecorione.db");

    expect(() => openContextDatabase({ path: dbPath, readonly: true })).toThrow();
    expect(existsSync(join(tempDir, "nested"))).toBe(false);
  });
});
