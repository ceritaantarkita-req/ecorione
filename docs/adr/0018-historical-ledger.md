# ADR-18 — Historical Ledger adalah subsystem durable Hub

**Status:** Diterima · 2026-09-09

## Konteks

Context L0 menyimpan episodic memory dan Hub Audit menyimpan policy/security evidence, tetapi belum ada satu chronological typed stream yang merepresentasikan interaction/execution history untuk replay, history UI, dan reference-based agent handoff.

DeepSeek Harness memberi evidence kuat untuk append-only contiguous event log. Namun menambah top-level module/service baru akan memperlebar architecture tanpa kebutuhan ownership yang jelas.

## Keputusan

Historical Ledger menjadi **durable subsystem di Hub**, menggunakan database Hub sendiri. Ia bukan pengganti:

- Context L0 — memory source material;
- Hub Audit — policy/security evidence;
- RnD Trace — observability/evaluation;
- Temporal — workflow durability.

Ledger menyimpan typed session events dengan invariant:

1. `SessionId` dan `EventId` memakai ID registry existing.
2. `seq` dimulai 0 dan harus contiguous.
3. committed event tidak dapat UPDATE/DELETE.
4. append menerima `expectedSeq`; mismatch = conflict.
5. retry event ID yang identik bersifat idempotent; payload berbeda dengan ID sama = conflict.
6. payload harus JSON-serializable.
7. setiap event menyimpan `prevHash` + SHA-256 hash untuk mendeteksi perubahan committed prefix.
8. read memverifikasi chain fail-closed.
9. suffix API mengembalikan `afterSeq`, `throughSeq`, `nextSeq` dan events.
10. scope/sensitivity/sync-class tetap bagian dari grant; history tidak boleh menjadi jalur bypass privacy.

Tidak ada parallel message-history table di Ai. UI history membaca projection Ledger.

## Durability

SQLite transaction adalah serialization point v1. Ini sengaja berbeda dari single-writer in-process DeepSeek: concurrent HTTP writers tetap bertemu di durable DB transaction dan `expectedSeq` conflict.

Batch append yang mewakili satu provenance unit harus memakai satu DB transaction: batch commit seluruhnya atau rollback seluruhnya. Ini mencegah partial `agent.handoff`, model event, atau assistant event ketika event berikutnya dalam batch gagal.

## Batch 6 lifecycle extension

Batch 6 menambahkan **physical compaction tanpa logical history rewrite**. Invariant append-only di atas tetap berlaku pada event stream yang terlihat oleh caller.

Aturan lifecycle-nya:

1. event lama hanya boleh dipindahkan sebagai **contiguous verified prefix** dari hot `history_events` ke immutable archive segment;
2. `SessionId`, `EventId`, `seq`, payload, `prevHash`, dan event hash tidak boleh diubah;
3. archive segment memiliki format version, SHA-256 payload, boundary sequence/hash, dan immutable EventId index;
4. read/replay dan retry-by-EventId tetap transparan melintasi archive + hot suffix;
5. compaction berjalan dalam satu immediate SQLite transaction dan memverifikasi full logical chain sebelum serta sesudah mutation;
6. legacy database menerima lifecycle columns/tables melalui additive migration; existing committed rows tidak ditulis ulang;
7. retention berarti jumlah recent events yang tetap berada di hot table, **bukan** izin untuk menghapus logical history;
8. corrupt/missing archive payload atau watermark mismatch harus fail closed sebagai integrity error.

Representasi archive v1 memakai canonical HistoryEvent JSON yang dikompresi gzip. Penggantian format archive di masa depan harus memakai `format_version` baru dan reader migration eksplisit; format lama tidak boleh ditafsir ulang diam-diam.

## Integration semantics

- user/input event boleh dicatat sebelum provider dispatch;
- event setelah provider/side-effect success tidak boleh mengubah success menjadi retryable provider call hanya karena ledger telemetry gagal;
- kegagalan append pasca-side-effect harus diaudit/ditrace sebagai degraded observability, bukan memicu duplicate side effect.

### Implementasi chat

`/v1/chat` melakukan dual-write dengan ownership yang tetap terpisah:

- Historical Ledger menyimpan chronological/replay state (`user.message` → `model.called` → `agent.message`);
- Context tetap menyimpan episodic memory dan tetap menjadi memory source material;
- live hosted-chat session memakai `CLOUD_ALLOWED` karena surface tersebut memang melakukan hosted egress;
- selama belum ada classifier sensitivity per-message, `maxSensitivity` request dipakai sebagai label konservatif session dan hanya boleh bergerak naik; ia tidak boleh otomatis downgrade;
- scope atau sync-class yang berubah pada SessionId yang sama dianggap conflict;
- kegagalan batch Ledger setelah provider berhasil direkam sebagai `HISTORY_WRITE_FAILED` dan tidak mengubah chat sukses menjadi retryable 502.

## Konsekuensi

- exact replay/history projection menjadi mungkin;
- ECX bisa menunjuk range history tanpa copy payload;
- logical history tetap bertambah monoton; Batch 6 boleh mengompresi representasi fisik prefix lama ke immutable archive segment tanpa mengubah committed sequence/hash, dan perubahan format berikutnya tetap membutuhkan explicit migration/versioning.