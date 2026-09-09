/** SQLite state for local self-hosted Sync. Relay rows contain ciphertext only. */
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { SqliteConstructor, type SqliteDatabase } from "./sqlite.js";

export interface SyncDatabase { readonly raw: SqliteDatabase; close(): void; }

const SCHEMA = `
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  public_key TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  revoked_at TEXT
);
CREATE TABLE IF NOT EXISTS pairing_codes (
  code_hash TEXT PRIMARY KEY,
  created_by_device_id TEXT NOT NULL REFERENCES devices(id),
  expires_at TEXT NOT NULL,
  consumed_at TEXT
);
CREATE TABLE IF NOT EXISTS relay_messages (
  id TEXT PRIMARY KEY,
  from_device_id TEXT NOT NULL REFERENCES devices(id),
  to_device_id TEXT NOT NULL REFERENCES devices(id),
  sender_ephemeral_public_key TEXT NOT NULL,
  nonce TEXT NOT NULL,
  auth_tag TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  created_at TEXT NOT NULL,
  acknowledged_at TEXT
);
CREATE INDEX IF NOT EXISTS relay_messages_recipient_idx
  ON relay_messages(to_device_id, created_at, id);
`;

export function openSyncDatabase(path: string): SyncDatabase {
  mkdirSync(dirname(path), { recursive: true });
  const raw = new SqliteConstructor(path);
  raw.pragma("journal_mode = WAL");
  raw.exec(SCHEMA);
  return { raw, close: () => raw.close() };
}
