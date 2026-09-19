import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadMigrations } from "./migrate.js";

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("Context migration inventory", () => {
  it("has unique migration versions", () => {
    const migrations = loadMigrations();
    expect(new Set(migrations.map((migration) => migration.version)).size).toBe(
      migrations.length,
    );
    expect(migrations.at(-1)?.version).toBe(5);
  });

  it("fails fast when two migration files reuse one version", () => {
    const dir = mkdtempSync(join(tmpdir(), "ecorione-migrations-"));
    dirs.push(dir);
    writeFileSync(join(dir, "001_alpha.sql"), "SELECT 1;");
    writeFileSync(join(dir, "001_beta.sql"), "SELECT 2;");

    expect(() => loadMigrations(`${dir}/`)).toThrow(/Duplicate Context migration version 1/);
  });
});
