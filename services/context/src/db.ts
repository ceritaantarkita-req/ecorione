/**
 * Membuka dan mengonfigurasi database memori — PRD §12.1, ADR-05.
 *
 * Satu file untuk keempat tier. Konsekuensi yang membuat pilihan ini menang di skala
 * personal: satu transaksi bisa mencakup metadata **dan** vektor sekaligus, backup adalah
 * menyalin satu file, dan tidak ada servis yang harus hidup supaya memori bisa dibaca.
 */

import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { migrate, type MigrateResult } from "./migrate.js";
import { SqliteConstructor, type SqliteDatabase } from "./sqlite.js";

/** Database in-memory. Dipakai test dan konsumen ephemeral. */
export const IN_MEMORY = ":memory:";

export interface OpenContextDatabaseOptions {
  /** Path file SQLite. Default `:memory:`. */
  readonly path?: string;
  /** Buka read-only — dipakai pembaca (UI, ekspor) supaya tidak pernah bisa menulis. */
  readonly readonly?: boolean;
  /** `false` untuk membuka database yang skemanya sudah dikelola pihak lain. */
  readonly runMigrations?: boolean;
}

export interface ContextDatabase {
  readonly raw: SqliteDatabase;
  readonly path: string;
  readonly migration: MigrateResult;
  close(): void;
}

export function openContextDatabase(options: OpenContextDatabaseOptions = {}): ContextDatabase {
  const path = options.path ?? IN_MEMORY;
  // `better-sqlite3` tidak membuat direktori induk sendiri — tanpa ini, `pnpm dev` di
  // mesin baru (`./data/` belum ada, gitignored) gagal dengan "directory does not
  // exist" alih-alih menyala. Tidak berlaku untuk `readonly`: pembaca yang menunjuk ke
  // DB yang belum ada seharusnya gagal jelas, bukan diam-diam membuat direktori kosong.
  if (path !== IN_MEMORY && options.readonly !== true) {
    mkdirSync(dirname(path), { recursive: true });
  }
  const raw = new SqliteConstructor(path, { readonly: options.readonly ?? false });

  // Foreign key di SQLite default **mati**. Rantai supersede dan cascade embedding
  // bergantung padanya, jadi ini dinyalakan sebelum apa pun berjalan — dan harus di luar
  // transaksi, karena PRAGMA ini diabaikan diam-diam di dalam transaksi.
  raw.pragma("foreign_keys = ON");

  if (path !== IN_MEMORY) {
    // WAL: pembaca tidak memblokir penulis. Bukan optimasi throughput — ini yang membuat
    // UI bisa membaca memori sementara konsolidasi lokal sedang menulis.
    raw.pragma("journal_mode = WAL");
    // Aman dipasangkan dengan WAL: yang bisa hilang saat mati mendadak hanya transaksi
    // paling akhir, bukan integritas file.
    raw.pragma("synchronous = NORMAL");
    // Beberapa proses menulis ke file yang sama (daemon + CLI). Tunggu, jangan langsung
    // melempar SQLITE_BUSY.
    raw.pragma("busy_timeout = 5000");
  }

  // Handle read-only tidak boleh menjalankan DDL; default-nya mengikuti itu tanpa perlu
  // pemanggil mengingatnya.
  const shouldMigrate = options.runMigrations ?? !(options.readonly ?? false);
  const migration: MigrateResult = shouldMigrate
    ? migrate(raw)
    : { applied: [], currentVersion: 0 };

  return {
    raw,
    path,
    migration,
    close(): void {
      raw.close();
    },
  };
}
