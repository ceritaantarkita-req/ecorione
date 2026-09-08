/**
 * Runner migrasi — sengaja sekecil mungkin.
 *
 * Skema hidup di file `.sql` bernomor, bukan di dalam TypeScript. Alasannya bukan gaya:
 * skema adalah artefak yang harus bisa dibaca, di-diff, dan dijalankan tanpa toolchain —
 * saat memulihkan backup jam tiga pagi yang tersedia cuma `sqlite3` dan file `.sql`.
 */

import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { SqliteDatabase } from "./sqlite.js";

/** `001_initial.sql` → versi 1, nama "initial". */
const MIGRATION_FILE = /^(\d+)_([a-z0-9_]+)\.sql$/;

export interface Migration {
  readonly version: number;
  readonly name: string;
  readonly sql: string;
}

/**
 * Tabel pencatat sengaja dibuat oleh runner, bukan oleh `001_initial.sql`: runner harus
 * bisa mem-bootstrap database kosong tanpa bergantung pada migrasi mana pun sudah jalan.
 */
const MIGRATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version    INTEGER PRIMARY KEY,
    name       TEXT NOT NULL,
    applied_at TEXT NOT NULL
  );
`;

function migrationsDir(): string {
  return fileURLToPath(new URL("./migrations/", import.meta.url));
}

export function loadMigrations(dir: string = migrationsDir()): Migration[] {
  const migrations: Migration[] = [];

  for (const file of readdirSync(dir)) {
    const matched = MIGRATION_FILE.exec(file);
    if (matched === null) continue;

    const [, rawVersion, name] = matched;
    if (rawVersion === undefined || name === undefined) continue;

    migrations.push({
      version: Number.parseInt(rawVersion, 10),
      name,
      sql: readFileSync(`${dir}${file}`, "utf8"),
    });
  }

  return migrations.sort((a, b) => a.version - b.version);
}

export interface MigrateResult {
  readonly applied: readonly number[];
  readonly currentVersion: number;
}

/**
 * Menjalankan migrasi yang belum pernah dipakai, satu transaksi per migrasi. DDL di SQLite
 * transaksional, jadi migrasi yang gagal di tengah tidak meninggalkan skema separuh jadi.
 *
 * `applied_at` diambil dari jam SQLite, bukan dari JS. Bukan karena aturan 1 berlaku di
 * sini — ini bukan jalur perakitan prefix — tapi supaya runner tidak butuh clock yang
 * diinjeksikan hanya demi satu kolom bookkeeping.
 */
export function migrate(
  db: SqliteDatabase,
  migrations: readonly Migration[] = loadMigrations(),
): MigrateResult {
  db.exec(MIGRATIONS_TABLE);

  const alreadyApplied = new Set(
    (db.prepare("SELECT version FROM schema_migrations").all() as { version: number }[]).map(
      (row) => row.version,
    ),
  );

  const record = db.prepare(
    `INSERT INTO schema_migrations (version, name, applied_at)
     VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
  );

  const applied: number[] = [];

  for (const migration of migrations) {
    if (alreadyApplied.has(migration.version)) continue;

    db.transaction(() => {
      db.exec(migration.sql);
      record.run(migration.version, migration.name);
    })();

    applied.push(migration.version);
  }

  const latest = migrations.at(-1)?.version ?? 0;
  return { applied, currentVersion: Math.max(latest, ...alreadyApplied, 0) };
}
