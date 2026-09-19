-- PE-01 Project context boundary (ADR-35).
-- Project metadata remains Hub-owned; Context stores only direct project identity needed
-- for isolation/retrieval. Existing core memory remains global by design.

ALTER TABLE episodes ADD COLUMN project_id TEXT;
ALTER TABLE facts ADD COLUMN project_id TEXT;
ALTER TABLE quarantine ADD COLUMN project_id TEXT;

-- Historical personal chat episodes with a durable session are deterministically Personal.
UPDATE episodes
SET project_id='prj_personal'
WHERE scope='personal'
  AND source_app='ai'
  AND session_id IS NOT NULL
  AND project_id IS NULL;

-- A fact is Personal only when every source episode resolves to Personal.
UPDATE facts AS f
SET project_id='prj_personal'
WHERE f.scope='personal'
  AND json_array_length(f.source_episode_ids) > 0
  AND NOT EXISTS (
    SELECT 1
    FROM json_each(f.source_episode_ids) AS source
    LEFT JOIN episodes AS e ON e.id = source.value
    WHERE e.project_id IS NULL OR e.project_id <> 'prj_personal'
  );

UPDATE quarantine
SET project_id='prj_personal'
WHERE scope='personal'
  AND source_app='ai'
  AND session_id IS NOT NULL
  AND project_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_episodes_project_ts
  ON episodes(project_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_facts_project_live
  ON facts(project_id, scope, t_invalid);
CREATE INDEX IF NOT EXISTS idx_quarantine_project_status
  ON quarantine(project_id, status, proposed_at);

-- Rebuild core_memory because its old PRIMARY KEY(label) prevents the same label from
-- existing globally and inside different Projects.
CREATE TABLE core_memory_pe01 (
  label       TEXT NOT NULL,
  project_id  TEXT,
  description TEXT NOT NULL,
  value       TEXT NOT NULL,
  read_only   INTEGER NOT NULL DEFAULT 0 CHECK (read_only IN (0, 1)),
  updated_at  TEXT NOT NULL,
  scope       TEXT NOT NULL DEFAULT 'personal',
  sensitivity TEXT NOT NULL DEFAULT 'INTERNAL'
    CHECK (sensitivity IN ('PUBLIC','INTERNAL','SENSITIVE','RESTRICTED')),
  sync_class  TEXT NOT NULL DEFAULT 'LOCAL_ONLY'
    CHECK (sync_class IN ('LOCAL_ONLY','SYNC_ENCRYPTED','CLOUD_ALLOWED','PUBLIC')),
  trust       TEXT NOT NULL DEFAULT 'USER'
    CHECK (trust IN ('USER','LOCAL_AGENT','HOSTED_AGENT','THIRD_PARTY'))
);

INSERT INTO core_memory_pe01
  (label,project_id,description,value,read_only,updated_at,scope,sensitivity,sync_class,trust)
SELECT
  label,NULL,description,value,read_only,updated_at,scope,sensitivity,sync_class,trust
FROM core_memory;

DROP TABLE core_memory;
ALTER TABLE core_memory_pe01 RENAME TO core_memory;

CREATE UNIQUE INDEX idx_core_memory_global_label
  ON core_memory(label) WHERE project_id IS NULL;
CREATE UNIQUE INDEX idx_core_memory_project_label
  ON core_memory(project_id,label) WHERE project_id IS NOT NULL;
CREATE INDEX idx_core_memory_scope_sensitivity
  ON core_memory(scope,sensitivity);
CREATE INDEX idx_core_memory_project_scope
  ON core_memory(project_id,scope,sensitivity);

-- After the deterministic backfill, Project assignment is part of append-only L0 identity.
DROP TRIGGER IF EXISTS episodes_no_update;
CREATE TRIGGER episodes_no_update
BEFORE UPDATE OF
  id, ts, raw_text, source_app, session_id, tool_call_id, source_uri,
  scope, sensitivity, sync_class, trust, project_id
ON episodes
BEGIN
  SELECT RAISE(ABORT, 'L0 append-only: isi episode tidak boleh diubah (ADR-06).');
END;

CREATE TRIGGER facts_project_no_update
BEFORE UPDATE OF project_id ON facts
WHEN OLD.project_id IS NOT NEW.project_id
BEGIN
  SELECT RAISE(ABORT, 'Project fakta tidak boleh dipindahkan; buat fakta baru/supersede.');
END;
