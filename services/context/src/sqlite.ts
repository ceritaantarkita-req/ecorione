/**
 * Satu-satunya tempat `better-sqlite3` diimpor sebagai nilai.
 *
 * Driver-nya CommonJS dengan `export =`; mengurungnya di satu modul membuat sisa paket
 * bebas dari detail interop dan memberi satu titik ganti kalau driver-nya berubah.
 */

import Database from "better-sqlite3";

export { Database as SqliteConstructor };

/** Handle database. Sinkron — better-sqlite3 memang tidak async. */
export type SqliteDatabase = Database.Database;
export type SqliteStatement = Database.Statement;

export const SqliteError = Database.SqliteError;

/** Nilai yang boleh di-bind. `undefined` **tidak** termasuk — driver menolaknya. */
export type BindValue = string | number | bigint | Buffer | null;
