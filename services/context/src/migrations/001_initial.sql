-- Memori 4 tier dalam satu file SQLite — PRD §12.1, ADR-05/06/07.
--
-- Semuanya di satu file dan satu transaksi: metadata, teks, dan vektor berubah bersama
-- atau tidak sama sekali. Di bawah ~1 juta fakta ini mengalahkan vector DB terpisah pada
-- setiap sumbu yang penting di sini — nol servis, backup = salin satu file, dan tidak ada
-- kelas bug "index vektor tidak sinkron dengan baris metadata" sama sekali.
--
-- Invarian struktural yang menopang seluruh berkas ini: **L0 (`episodes`) adalah ground
-- truth; L1–L3 adalah proyeksi turunan yang bisa dibangun ulang.** Karena L0 tidak pernah
-- diubah, menurunkan ulang L1 dari L0 selalu aman — kalau konsolidasi menulis fakta yang
-- salah, tier turunannya dibuang, bukan ditambal.

-- ---------------------------------------------------------------------------
-- Meta internal
-- ---------------------------------------------------------------------------

-- Dipakai trigger sebagai gerbang: satu-satunya cara menghapus baris L1 adalah membuka
-- flag `allow_derived_rebuild` secara eksplisit (lihat `rebuildDerivedTiers`).
CREATE TABLE IF NOT EXISTS context_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- ---------------------------------------------------------------------------
-- L0 — log episodik (append-only)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS episodes (
  id            TEXT PRIMARY KEY,
  ts            TEXT NOT NULL,
  raw_text      TEXT NOT NULL,

  -- Provenance didatarkan jadi kolom, bukan JSON: filter scope dan mitigasi poisoning
  -- harus bisa jadi predikat indeks, bukan hasil parsing per baris.
  source_app    TEXT NOT NULL,
  session_id    TEXT,
  tool_call_id  TEXT,
  source_uri    TEXT,

  scope         TEXT NOT NULL,
  sensitivity   TEXT NOT NULL CHECK (sensitivity IN ('PUBLIC','INTERNAL','SENSITIVE','RESTRICTED')),
  sync_class    TEXT NOT NULL CHECK (sync_class IN ('LOCAL_ONLY','SYNC_ENCRYPTED','CLOUD_ALLOWED','PUBLIC')),
  trust         TEXT NOT NULL CHECK (trust IN ('USER','LOCAL_AGENT','HOSTED_AGENT','THIRD_PARTY')),

  -- Diisi konsolidasi, bukan saat penulisan. Ini penanda turunan, bukan isi episode —
  -- lihat catatan di trigger `episodes_no_update`.
  summary          TEXT,
  consolidated_at  TEXT
);

-- Rekonsiliasi konsolidasi berjalan menurut waktu: "episode mana yang belum diproses".
CREATE INDEX IF NOT EXISTS idx_episodes_unconsolidated
  ON episodes (consolidated_at, ts);
CREATE INDEX IF NOT EXISTS idx_episodes_scope_ts
  ON episodes (scope, ts);

-- Isi episode tidak boleh berubah. `summary`/`consolidated_at` sengaja TIDAK ada di daftar
-- `UPDATE OF` karena keduanya penanda turunan yang ditulis konsolidasi, bukan pengubahan
-- ground truth. Justru immutabilitas kolom-kolom di bawah inilah yang membuat membangun
-- ulang L1 dari L0 aman: sumbernya dijamin sama seperti saat fakta lama diturunkan.
CREATE TRIGGER IF NOT EXISTS episodes_no_update
BEFORE UPDATE OF
  id, ts, raw_text, source_app, session_id, tool_call_id, source_uri,
  scope, sensitivity, sync_class, trust
ON episodes
BEGIN
  SELECT RAISE(ABORT, 'L0 append-only: isi episode tidak boleh diubah (ADR-06).');
END;

CREATE TRIGGER IF NOT EXISTS episodes_no_delete
BEFORE DELETE ON episodes
BEGIN
  SELECT RAISE(ABORT, 'L0 append-only: episode tidak boleh dihapus (ADR-06).');
END;

-- ---------------------------------------------------------------------------
-- L1 — fakta semantik bi-temporal
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS facts (
  id            TEXT PRIMARY KEY,
  subject       TEXT NOT NULL,
  predicate     TEXT NOT NULL,
  object        TEXT NOT NULL,
  text          TEXT NOT NULL,

  confidence    REAL NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  salience      REAL NOT NULL CHECK (salience   BETWEEN 0 AND 1),

  -- JSON array of episode id. Tidak bisa jadi FOREIGN KEY karena kardinalitasnya banyak;
  -- integritasnya dijaga di lapisan repository saat penulisan.
  source_episode_ids TEXT NOT NULL,

  -- Model bi-temporal diambil dari Graphiti **sebagai kolom, bukan graph database** (ADR-05).
  t_valid       TEXT NOT NULL,
  t_invalid     TEXT,
  superseded_by TEXT REFERENCES facts (id),
  created_at    TEXT NOT NULL,

  scope         TEXT NOT NULL,
  sensitivity   TEXT NOT NULL CHECK (sensitivity IN ('PUBLIC','INTERNAL','SENSITIVE','RESTRICTED')),
  sync_class    TEXT NOT NULL CHECK (sync_class IN ('LOCAL_ONLY','SYNC_ENCRYPTED','CLOUD_ALLOWED','PUBLIC')),
  trust         TEXT NOT NULL CHECK (trust IN ('USER','LOCAL_AGENT','HOSTED_AGENT','THIRD_PARTY')),

  source_app    TEXT NOT NULL,
  session_id    TEXT,
  tool_call_id  TEXT,
  source_uri    TEXT
);

-- Indeks utama retrieval. Setiap query fakta memfilter scope (gerbang privasi lintas
-- konteks) DAN `t_invalid IS NULL` (aturan 4), selalu berpasangan — jadi satu indeks
-- komposit dengan urutan itu yang dipakai, bukan dua indeks terpisah.
CREATE INDEX IF NOT EXISTS idx_facts_scope_live ON facts (scope, t_invalid);

-- Deteksi kontradiksi saat konsolidasi mencari "apa yang sudah saya tahu tentang X" —
-- lookup selalu lewat subject, sebelum tahu fakta mana yang akan digantikan.
CREATE INDEX IF NOT EXISTS idx_facts_subject ON facts (subject, predicate);

-- Peluruhan recency, jendela audit, dan ekspor inkremental semuanya berjalan menurut
-- waktu pembuatan. Tanpa ini setiap sapuan waktu jadi full scan.
CREATE INDEX IF NOT EXISTS idx_facts_created_at ON facts (created_at);

-- Menelusuri rantai supersede ke belakang ("fakta ini menggantikan apa saja").
CREATE INDEX IF NOT EXISTS idx_facts_superseded_by ON facts (superseded_by);

-- Aturan 4: jangan hapus fakta — invalidate. Provenance harus tetap bisa ditelusuri,
-- jadi baris tunggal tidak pernah boleh hilang. Satu-satunya pengecualian yang sah adalah
-- membuang **seluruh** tier turunan untuk diturunkan ulang dari L0; itu membuka flag di
-- `context_meta` secara eksplisit, jadi tidak mungkin terjadi tanpa disengaja.
CREATE TRIGGER IF NOT EXISTS facts_no_delete
BEFORE DELETE ON facts
WHEN (SELECT value FROM context_meta WHERE key = 'allow_derived_rebuild') IS NOT '1'
BEGIN
  SELECT RAISE(ABORT, 'Fakta tidak boleh dihapus — invalidate lewat supersedeFact (ADR-06).');
END;

-- ---------------------------------------------------------------------------
-- Embedding — sumber kebenaran untuk jalur vektor
-- ---------------------------------------------------------------------------

-- BLOB float32 mentah. Ini yang durable; index vektor apa pun (sqlite-vec) adalah
-- proyeksi turunan dari tabel ini dan bisa dibangun ulang tanpa meng-embed ulang.
-- `model` ikut disimpan karena embedding dari model berbeda tidak sebanding — ADR-14
-- melarang alias longgar justru supaya perbandingan seperti ini tetap jujur.
CREATE TABLE IF NOT EXISTS fact_embeddings (
  fact_id   TEXT PRIMARY KEY REFERENCES facts (id) ON DELETE CASCADE,
  model     TEXT NOT NULL,
  dim       INTEGER NOT NULL CHECK (dim > 0),
  embedding BLOB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fact_embeddings_model ON fact_embeddings (model);

-- ---------------------------------------------------------------------------
-- FTS5 — jalur leksikal
-- ---------------------------------------------------------------------------

-- External content: isi tetap tinggal di `facts`, FTS hanya menyimpan index. Tidak ada
-- duplikasi teks, dan `rowid` yang sama dipakai jalur leksikal maupun vektor.
CREATE VIRTUAL TABLE IF NOT EXISTS facts_fts USING fts5 (
  text,
  content = 'facts',
  content_rowid = 'rowid',
  tokenize = 'unicode61'
);

CREATE TRIGGER IF NOT EXISTS facts_fts_ai AFTER INSERT ON facts BEGIN
  INSERT INTO facts_fts (rowid, text) VALUES (new.rowid, new.text);
END;

-- Sengaja `UPDATE OF text`: menaikkan salience atau meng-invalidate fakta tidak mengubah
-- teksnya, jadi tidak perlu menyentuh index leksikal sama sekali.
CREATE TRIGGER IF NOT EXISTS facts_fts_au AFTER UPDATE OF text ON facts BEGIN
  INSERT INTO facts_fts (facts_fts, rowid, text) VALUES ('delete', old.rowid, old.text);
  INSERT INTO facts_fts (rowid, text) VALUES (new.rowid, new.text);
END;

-- Hanya menyala saat rebuild tier turunan (lihat `facts_no_delete`).
CREATE TRIGGER IF NOT EXISTS facts_fts_ad AFTER DELETE ON facts BEGIN
  INSERT INTO facts_fts (facts_fts, rowid, text) VALUES ('delete', old.rowid, old.text);
END;

-- ---------------------------------------------------------------------------
-- Karantina — ADR-07
-- ---------------------------------------------------------------------------

-- Tulisan dari model hosted dan dari tool mendarat di sini, tidak pernah langsung ke
-- `facts`. `memory_propose`, bukan `memory_write`. Promosi hanya lewat konsolidasi lokal.
-- Ini yang menetralkan sebagian besar permukaan memory poisoning: konten yang belum
-- diperiksa tidak pernah masuk jangkauan retrieval.
CREATE TABLE IF NOT EXISTS quarantine (
  id               TEXT PRIMARY KEY,
  proposed_text    TEXT NOT NULL,
  proposed_at      TEXT NOT NULL,

  source_app       TEXT NOT NULL,
  session_id       TEXT,
  tool_call_id     TEXT,
  source_uri       TEXT,

  trust            TEXT NOT NULL CHECK (trust IN ('USER','LOCAL_AGENT','HOSTED_AGENT','THIRD_PARTY')),
  scope            TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PROMOTED','REJECTED')),
  rejection_reason TEXT,
  reviewed_at      TEXT,

  -- Jejak audit dua arah: dari usulan ke fakta, dan dari fakta kembali ke usulannya.
  promoted_fact_id TEXT REFERENCES facts (id)
);

CREATE INDEX IF NOT EXISTS idx_quarantine_pending ON quarantine (status, proposed_at);

-- ---------------------------------------------------------------------------
-- L2 — memori inti
-- ---------------------------------------------------------------------------

-- Selalu ada di konteks setiap panggilan dan bagian dari prefix stabil (ADR-01). Tidak ada
-- kolom urutan: blok dirender terurut `label` supaya hasilnya deterministik — satu byte
-- bergeser dan cache prefix provider tidak pernah kena, tanpa error apa pun.
CREATE TABLE IF NOT EXISTS core_memory (
  label       TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  value       TEXT NOT NULL,
  read_only   INTEGER NOT NULL DEFAULT 0 CHECK (read_only IN (0, 1)),
  updated_at  TEXT NOT NULL
);

-- ---------------------------------------------------------------------------
-- L3 — pointer artifact
-- ---------------------------------------------------------------------------

-- Isi artifact tidak pernah dimuat spekulatif; yang disimpan hanya path + deskripsi satu
-- baris, dan agent membukanya saat perlu (`research.md` §3.2).
CREATE TABLE IF NOT EXISTS artifact_pointers (
  id          TEXT PRIMARY KEY,
  path        TEXT NOT NULL,
  description TEXT NOT NULL,
  mime_type   TEXT NOT NULL,
  size_bytes  INTEGER NOT NULL CHECK (size_bytes >= 0),
  scope       TEXT NOT NULL,
  sensitivity TEXT NOT NULL CHECK (sensitivity IN ('PUBLIC','INTERNAL','SENSITIVE','RESTRICTED'))
);

CREATE INDEX IF NOT EXISTS idx_artifact_pointers_scope ON artifact_pointers (scope, sensitivity);
