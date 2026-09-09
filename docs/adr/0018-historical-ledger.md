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

## Integration semantics

- user/input event boleh dicatat sebelum provider dispatch;
- event setelah provider/side-effect success tidak boleh mengubah success menjadi retryable provider call hanya karena ledger telemetry gagal;
- kegagalan append pasca-side-effect harus diaudit/ditrace sebagai degraded observability, bukan memicu duplicate side effect.

## Konsekuensi

- exact replay/history projection menjadi mungkin;
- ECX bisa menunjuk range history tanpa copy payload;
- storage bertambah monoton; retention/compaction adalah pekerjaan terpisah dan tidak boleh mengubah committed sequence tanpa explicit migration/versioning.