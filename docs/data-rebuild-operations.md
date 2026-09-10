# Data Refactor / Rebuild Operations — Batch 7

## Safety boundary

- Historical Ledger (Hub) dan Context L0 `episodes` immutable fields adalah authoritative append-only source.
- Context maintenance hanya boleh dipanggil melalui Context owner-service contract; service lain tidak membuka `ecorione.db` secara langsung.
- L2 core memory dan L3 artifact pointers tidak ikut mass normalization/rebuild Batch 7.
- Safety snapshot Batch 7 adalah snapshot operasi lokal. Backup/restore/DR governance lintas mesin adalah Batch 8.

## Context maintenance contract

- `POST /v1/maintenance/plan` — dry-run. Input: `operationId`, `actions`, `now`.
- `POST /v1/maintenance/execute` — execute exact plan; stale source/projection digest ditolak.
- `POST /v1/maintenance/rollback` — rollback projection dari snapshot receipt lama, hanya bila current L0 digest sama.
- `GET /v1/maintenance/verify` — owner integrity verification.
- `GET /v1/maintenance/receipts` — durable receipt list.
- `GET /v1/maintenance/receipts/:id` — one receipt.

Supported actions:

- `migrate` — menjalankan numbered migration runner untuk migration yang belum applied.
- `normalize-metadata` — trim/collapse derived `LOCAL_AGENT` L1 subject/predicate/object/text dan canonicalize source episode ids.
- `dedupe-facts` — merge duplicate live derived facts secara deterministic lalu invalidate duplicate dengan `superseded_by`; tidak menghapus source.
- `rebuild-l1` — staging-first reconstruction dari immutable episodes memakai local extractor via Connect; main projection hanya diganti setelah staging berhasil.
- `rebuild-fts` — FTS5 rebuild dari canonical `facts` content table.
- `reindex-vector` — rebuild vector accelerator dari durable `fact_embeddings`; tidak melakukan provider re-embedding.
- `verify` — integrity validation.

`rebuild-l1` sengaja tidak boleh digabung dengan `normalize-metadata`/`dedupe-facts`, karena kedua transformasi itu akan langsung tertimpa oleh projection baru. FTS/vector rebuild boleh digabung dan juga dijalankan otomatis setelah L1 swap.

## Dry-run / anti-TOCTOU

Plan mengandung:

- immutable L0 source digest;
- projection digest (facts + episode derived markers + durable embeddings);
- applied/current/target schema version;
- pending migration versions;
- counts untuk episode/fact/embedding;
- normalizable derived facts dan duplicate groups;
- orphan/integrity findings;
- plan digest.

Execute menghitung ulang keadaan tersebut. Bila source atau projection bergerak sejak plan dibuat, execute fail closed dan operator harus membuat plan baru.

## Snapshot

Execute/rollback mutation membutuhkan file-backed Context DB. Sebelum mutation, Context memakai SQLite online backup ke direktori owner-controlled `context-maintenance-snapshots/` (atau directory yang diinject service owner) dan mengatur file snapshot `0600`. Caller tidak dapat memilih arbitrary path.

## Rebuild L1

1. Read immutable L0 episodes dari owner repository.
2. Copy ke isolated in-memory staging Context DB tanpa membawa summary/consolidated markers lama.
3. Jalankan consolidation batch lokal memakai extractor Connect yang sama.
4. Bila extraction/consolidation error, main projection tidak disentuh.
5. Recheck exact dry-run digest.
6. Snapshot main DB.
7. Swap L1 melalui existing guarded `rebuildDerivedTiers()` transaction.
8. Apply staged episode summary/consolidated markers yang derived.
9. Rebuild FTS dan vector accelerator.
10. Verify integrity dan pastikan L0 digest identik.
11. Write receipt.

Rebuild L1 dapat mengubah fact IDs. Embedding lama yang cascade-delete karena fact lama diganti tidak dianggap berhasil di-reembed; jumlah yang ter-drop dicatat di receipt.

## Rollback

Rollback menerima `sourceReceiptId`, bukan file path. Context menemukan owner snapshot dari receipt tersebut, membaca source digest snapshot, lalu membandingkannya dengan current L0.

- digest sama → buat safety snapshot current projection, restore L1/embedding/derived episode markers/quarantine promotion links, rebuild indexes, verify, tulis rollback receipt;
- digest berbeda → **reject**. Jangan mengganti whole database atau mengembalikan L0 ke masa lalu. Jalankan rebuild baru dari current immutable L0.

## Integrity checks

Closure verification mencakup:

- SQLite `quick_check`;
- `foreign_key_check`;
- every fact `source_episode_ids` points to existing L0 episode;
- `superseded_by` target exists;
- every durable embedding points to an existing fact;
- quarantine promotion pointer points to an existing fact;
- FTS5 external-content integrity check;
- source digest before/after execute or rollback is unchanged.

## Historical Ledger

Hub exposes owner verification for all Historical Ledger sessions. Verification recomputes sequence continuity, previous-hash chain, event hash, `nextSeq`, and head hash. Batch 7 does not add a Ledger rewrite/repair endpoint.
