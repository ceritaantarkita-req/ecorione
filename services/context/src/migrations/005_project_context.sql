-- PE-01 Project context boundary (ADR-35).
-- Project metadata remains Hub-owned; Context stores only direct Project identity needed
-- for isolation/retrieval. Existing core memory remains global by design.
--
-- project_state is intentionally storage-internal:
--   GLOBAL             = explicit post-PE-01 global memory
--   ASSIGNED           = belongs to project_id
--   LEGACY_UNASSIGNED  = pre-PE-01 row whose Project cannot be proven
-- This prevents ambiguous legacy NULL rows from being mistaken for global memory.

ALTER TABLE episodes ADD COLUMN project_id TEXT;
ALTER TABLE episodes ADD COLUMN project_state TEXT NOT NULL DEFAULT 'LEGACY_UNASSIGNED'
  CHECK (project_state IN ('GLOBAL','ASSIGNED','LEGACY_UNASSIGNED'));
ALTER TABLE facts ADD COLUMN project_id TEXT;
ALTER TABLE facts ADD COLUMN project_state TEXT NOT NULL DEFAULT 'LEGACY_UNASSIGNED'
  CHECK (project_state IN ('GLOBAL','ASSIGNED','LEGACY_UNASSIGNED'));
ALTER TABLE quarantine ADD COLUMN project_id TEXT;
ALTER TABLE quarantine ADD COLUMN project_state TEXT NOT NULL DEFAULT 'LEGACY_UNASSIGNED'
  CHECK (project_state IN ('GLOBAL','ASSIGNED','LEGACY_UNASSIGNED'));

-- Historical personal Ai chat episodes with durable session provenance are deterministic.
UPDATE episodes
SET project_id='prj_personal', project_state='ASSIGNED'
WHERE scope='personal'
  AND (source_app='ai' OR source_app LIKE 'connect:%')
  AND session_id IS NOT NULL
  AND project_id IS NULL;

-- A fact is Personal only when every source episode resolves to Personal.
UPDATE facts AS f
SET project_id='prj_personal', project_state='ASSIGNED'
WHERE f.scope='personal'
  AND json_array_length(f.source_episode_ids) > 0
  AND NOT EXISTS (
    SELECT 1
    FROM json_each(f.source_episode_ids) AS source
    LEFT JOIN episodes AS e ON e.id = source.value
    WHERE e.project_id IS NULL
       OR e.project_id <> 'prj_personal'
       OR e.project_state <> 'ASSIGNED'
  );

UPDATE quarantine
SET project_id='prj_personal', project_state='ASSIGNED'
WHERE scope='personal'
  AND (source_app='ai' OR source_app LIKE 'connect:%')
  AND session_id IS NOT NULL
  AND project_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_episodes_project_ts
  ON episodes(project_state, project_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_facts_project_live
  ON facts(project_state, project_id, scope, t_invalid);
CREATE INDEX IF NOT EXISTS idx_quarantine_project_status
  ON quarantine(project_state, project_id, status, proposed_at);

-- Rebuild core_memory because its old PRIMARY KEY(label) prevents the same label from
-- existing globally and inside different Projects. Existing core memory is global by design.
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

-- After deterministic backfill, Project identity/state is part of append-only L0 identity.
DROP TRIGGER IF EXISTS episodes_no_update;
CREATE TRIGGER episodes_no_update
BEFORE UPDATE OF
  id, ts, raw_text, source_app, session_id, tool_call_id, source_uri,
  scope, sensitivity, sync_class, trust, project_id, project_state
ON episodes
BEGIN
  SELECT RAISE(ABORT, 'L0 append-only: isi episode tidak boleh diubah (ADR-06).');
END;

CREATE TRIGGER facts_project_no_update
BEFORE UPDATE OF project_id, project_state ON facts
WHEN OLD.project_id IS NOT NEW.project_id OR OLD.project_state <> NEW.project_state
BEGIN
  SELECT RAISE(ABORT, 'Project fakta tidak boleh dipindahkan; buat fakta baru/supersede.');
END;
