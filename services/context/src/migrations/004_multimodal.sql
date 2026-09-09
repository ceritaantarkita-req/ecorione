CREATE TABLE IF NOT EXISTS multimodal_attachments (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  artifact_id TEXT NOT NULL REFERENCES artifact_pointers(id),
  media_kind TEXT NOT NULL CHECK(media_kind IN ('image','document','audio','video')),
  lifecycle_state TEXT NOT NULL CHECK(lifecycle_state IN ('UPLOADED','PROCESSING','READY','FAILED')),
  latest_derivation_id TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(workspace_id, artifact_id)
);
CREATE INDEX IF NOT EXISTS idx_multimodal_attachments_workspace_state
  ON multimodal_attachments(workspace_id, lifecycle_state, updated_at);

CREATE TABLE IF NOT EXISTS multimodal_derivations (
  id TEXT PRIMARY KEY,
  attachment_id TEXT NOT NULL REFERENCES multimodal_attachments(id),
  artifact_id TEXT NOT NULL REFERENCES artifact_pointers(id),
  operation_id TEXT NOT NULL,
  session_id TEXT,
  task TEXT NOT NULL CHECK(task IN ('vision','ocr','transcribe','tts')),
  result_json TEXT NOT NULL,
  target TEXT NOT NULL CHECK(target IN ('local','hosted')),
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  scope TEXT NOT NULL,
  sensitivity TEXT NOT NULL,
  sync_class TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(attachment_id, operation_id)
);
CREATE INDEX IF NOT EXISTS idx_multimodal_derivations_attachment_created
  ON multimodal_derivations(attachment_id, created_at);
CREATE INDEX IF NOT EXISTS idx_multimodal_derivations_session
  ON multimodal_derivations(session_id, created_at);

CREATE TRIGGER IF NOT EXISTS multimodal_derivations_no_update
BEFORE UPDATE ON multimodal_derivations
BEGIN
  SELECT RAISE(ABORT, 'multimodal_derivations are append-only');
END;
CREATE TRIGGER IF NOT EXISTS multimodal_derivations_no_delete
BEFORE DELETE ON multimodal_derivations
BEGIN
  SELECT RAISE(ABORT, 'multimodal_derivations are append-only');
END;
