import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openHubDatabase } from "./db.js";
import { HistoryLedger } from "./history-ledger.js";
import { SqliteConstructor } from "./sqlite.js";

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("PE-01 Historical Ledger migration", () => {
  it("preserves legacy Ledger events while assigning personal session metadata", () => {
    const dir = mkdtempSync(join(tmpdir(), "ecorione-hub-project-"));
    dirs.push(dir);
    const path = join(dir, "hub.sqlite");

    const legacy = new SqliteConstructor(path);
    legacy.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE history_sessions (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        scope TEXT NOT NULL,
        sensitivity TEXT NOT NULL,
        sync_class TEXT NOT NULL,
        next_seq INTEGER NOT NULL DEFAULT 0,
        head_hash TEXT
      );
      CREATE TABLE history_events (
        id TEXT NOT NULL UNIQUE,
        session_id TEXT NOT NULL REFERENCES history_sessions(id),
        seq INTEGER NOT NULL,
        recorded_at TEXT NOT NULL,
        event_type TEXT NOT NULL,
        actor TEXT NOT NULL,
        operation_id TEXT,
        parent_event_id TEXT,
        payload_json TEXT NOT NULL,
        prev_hash TEXT,
        hash TEXT NOT NULL,
        PRIMARY KEY(session_id, seq)
      );
      INSERT INTO history_sessions
        (id,created_at,scope,sensitivity,sync_class,next_seq,head_hash)
      VALUES
        ('sess_legacy_project','2026-09-01T00:00:00.000Z','personal','INTERNAL','LOCAL_ONLY',1,'legacy-head');
      INSERT INTO history_events
        (id,session_id,seq,recorded_at,event_type,actor,operation_id,parent_event_id,payload_json,prev_hash,hash)
      VALUES
        ('evt_legacy_project','sess_legacy_project',0,'2026-09-01T00:00:00.000Z','user.message','user',NULL,NULL,'{"text":"legacy"}',NULL,'legacy-hash');
    `);
    legacy.close();

    const db = openHubDatabase(path);
    try {
      const ledger = new HistoryLedger(db);
      expect(ledger.getSession("sess_legacy_project")).toMatchObject({
        workspaceId: "ws_personal",
        projectId: "prj_personal",
        updatedAt: "2026-09-01T00:00:00.000Z",
      });
      const event = db.raw
        .prepare("SELECT id,payload_json FROM history_events WHERE session_id=? AND seq=0")
        .get("sess_legacy_project") as { id: string; payload_json: string };
      expect(event).toEqual({
        id: "evt_legacy_project",
        payload_json: '{"text":"legacy"}',
      });
    } finally {
      db.close();
    }

    const reopened = openHubDatabase(path);
    try {
      const ledger = new HistoryLedger(reopened);
      expect(ledger.getSession("sess_legacy_project")).toMatchObject({
        workspaceId: "ws_personal",
        projectId: "prj_personal",
      });
      expect(
        reopened.raw
          .prepare("SELECT COUNT(*) AS count FROM history_events WHERE session_id=?")
          .get("sess_legacy_project"),
      ).toEqual({ count: 1 });
    } finally {
      reopened.close();
    }
  });
});
