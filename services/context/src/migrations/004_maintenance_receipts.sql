-- Batch 7 — durable Context maintenance/rebuild receipts.
-- L0 episodes remain immutable; this table records owner-service maintenance only.

CREATE TABLE context_maintenance_receipts (
  id                       TEXT PRIMARY KEY,
  operation_id             TEXT NOT NULL UNIQUE,
  kind                     TEXT NOT NULL CHECK (kind IN ('EXECUTE','ROLLBACK')),
  actions_json             TEXT NOT NULL,
  plan_digest              TEXT NOT NULL,
  source_digest_before     TEXT NOT NULL,
  source_digest_after      TEXT,
  projection_digest_before TEXT NOT NULL,
  projection_digest_after  TEXT,
  snapshot_path            TEXT,
  status                   TEXT NOT NULL CHECK (status IN ('SUCCEEDED','FAILED')),
  requested_at             TEXT NOT NULL,
  completed_at             TEXT NOT NULL,
  details_json             TEXT NOT NULL
);

CREATE INDEX idx_context_maintenance_receipts_completed
  ON context_maintenance_receipts (completed_at DESC, id ASC);
