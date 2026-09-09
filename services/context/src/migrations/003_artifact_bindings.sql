-- Fase 3 Artifact: satu blob CAS dapat punya beberapa binding klasifikasi logis.
-- Tabel legacy artifact_pointers tetap dipertahankan untuk kompatibilitas context-pack.
CREATE TABLE IF NOT EXISTS artifact_bindings (
  id          TEXT NOT NULL,
  path        TEXT NOT NULL,
  description TEXT NOT NULL,
  mime_type   TEXT NOT NULL,
  size_bytes  INTEGER NOT NULL CHECK (size_bytes >= 0),
  scope       TEXT NOT NULL,
  sensitivity TEXT NOT NULL CHECK (sensitivity IN ('PUBLIC','INTERNAL','SENSITIVE','RESTRICTED')),
  sync_class  TEXT NOT NULL CHECK (sync_class IN ('LOCAL_ONLY','SYNC_ENCRYPTED','CLOUD_ALLOWED','PUBLIC')),
  PRIMARY KEY (id, scope, sensitivity, sync_class)
);

CREATE INDEX IF NOT EXISTS idx_artifact_bindings_scope
  ON artifact_bindings (scope, sensitivity, sync_class, id);
