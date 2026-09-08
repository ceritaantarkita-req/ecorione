import { existsSync, rmSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openRndDatabase } from "./db.js";

let tempDir: string | undefined;

afterEach(() => {
  if (tempDir !== undefined) rmSync(tempDir, { recursive: true, force: true });
  tempDir = undefined;
});

describe("openRndDatabase", () => {
  it("membuat direktori induk yang belum ada — `pnpm dev` di mesin baru tidak boleh gagal karena ./data/ belum dibuat", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "ecorione-rnd-db-"));
    const dbPath = join(tempDir, "nested", "sub", "rnd.db");
    expect(existsSync(dbPath)).toBe(false);

    const db = openRndDatabase(dbPath);
    try {
      expect(existsSync(dbPath)).toBe(true);
    } finally {
      db.close();
    }
  });
});
