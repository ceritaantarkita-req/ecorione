-- Hardening hasil full-code audit 2026-09-09.
-- Menyamakan L2/L3 dengan boundary scope/sensitivity/egress dan mempercepat episodic lookup.

ALTER TABLE core_memory ADD COLUMN scope TEXT NOT NULL DEFAULT 'personal';
ALTER TABLE core_memory ADD COLUMN sensitivity TEXT NOT NULL DEFAULT 'INTERNAL'
  CHECK (sensitivity IN ('PUBLIC','INTERNAL','SENSITIVE','RESTRICTED'));
ALTER TABLE core_memory ADD COLUMN sync_class TEXT NOT NULL DEFAULT 'LOCAL_ONLY'
  CHECK (sync_class IN ('LOCAL_ONLY','SYNC_ENCRYPTED','CLOUD_ALLOWED','PUBLIC'));
ALTER TABLE core_memory ADD COLUMN trust TEXT NOT NULL DEFAULT 'USER'
  CHECK (trust IN ('USER','LOCAL_AGENT','HOSTED_AGENT','THIRD_PARTY'));
CREATE INDEX IF NOT EXISTS idx_core_memory_scope_sensitivity
  ON core_memory (scope, sensitivity);

ALTER TABLE artifact_pointers ADD COLUMN sync_class TEXT NOT NULL DEFAULT 'LOCAL_ONLY'
  CHECK (sync_class IN ('LOCAL_ONLY','SYNC_ENCRYPTED','CLOUD_ALLOWED','PUBLIC'));
CREATE INDEX IF NOT EXISTS idx_artifact_pointers_scope_egress
  ON artifact_pointers (scope, sensitivity, sync_class);

CREATE INDEX IF NOT EXISTS idx_episodes_session_ts
  ON episodes (session_id, ts DESC);
