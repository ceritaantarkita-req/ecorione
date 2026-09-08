/**
 * Satu-satunya tempat `better-sqlite3` diimpor sebagai nilai di paket ini — pola yang
 * sama dengan `services/context/src/sqlite.ts`: driver-nya CommonJS `export =`,
 * mengurungnya di satu modul membuat sisa paket bebas dari detail interop.
 */

import Database from "better-sqlite3";

export { Database as SqliteConstructor };

export type SqliteDatabase = Database.Database;
