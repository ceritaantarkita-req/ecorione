# ADR-28 — Data rebuild is owner-service maintenance over immutable sources

Status: Accepted — Batch 7 implementation
Date: 2026-09-10

## Context

ECORIONE sekarang memiliki durable data yang tidak semuanya memiliki semantics yang sama. Historical Ledger di Hub dan Context L0 (`episodes`) adalah authoritative append-only sources. Context L1 facts, FTS5 index, vector accelerator, dan sebagian metadata konsolidasi adalah projection/derived state. L2 core memory tetap user-owned dan L3 artifact pointer tetap mengikuti Artifact ownership.

Refactor/rebuild yang langsung membuka database service lain akan melanggar owner boundary, membuat rollback lintas service sulit dibuktikan, dan berisiko mengubah source-of-truth ketika tujuan sebenarnya hanya memperbaiki projection.

## Decision

1. **Historical Ledger dan Context L0 tidak boleh direwrite in-place.** Batch 7 hanya menambah integrity verification untuk Ledger. Context maintenance menghitung digest dari immutable L0 fields sebelum dan sesudah operasi dan fail closed bila digest berubah.
2. **Maintenance dimiliki service pemilik data.** Context menyediakan maintenance contract/API sendiri. Hub/Flow/operator tidak diberi akses SQL ke Context. Hub memverifikasi Historical Ledger melalui `HistoryLedger`, bukan melalui Context engine.
3. **Dry-run mendahului execute.** Plan mencatat action, explicit diff, schema migration state, source digest, projection digest, integrity/orphan findings, normalization count, duplicate-derived-fact groups, dan plan digest. Execute menolak plan jika source atau projection berubah setelah dry-run.
4. **Snapshot wajib sebelum mutation.** File-backed Context membuat SQLite online backup ke direktori owner-controlled dengan permission terbatas. Caller tidak boleh memasok arbitrary snapshot path.
5. **L1 rebuild dilakukan staging-first.** Immutable episodes disalin ke Context DB staging, konsolidasi lokal berjalan melalui extractor Connect yang sama, dan main L1 baru diganti setelah staging sukses dan source digest masih sama. Raw L0 tidak dipindahkan/ditimpa.
6. **Normalization/dedupe hanya menyentuh derived L1 `LOCAL_AGENT` facts.** USER facts, L2 core memory, dan L3 artifact pointers tidak dinormalisasi massal oleh Batch 7.
7. **FTS dan vector accelerator adalah rebuildable projections.** FTS memakai FTS5 rebuild command. Vector accelerator dibangun ulang dari durable `fact_embeddings`; ini bukan klaim melakukan re-embedding. Rebuild L1 yang menghasilkan fact IDs baru dapat menjatuhkan embedding lama dan receipt harus melaporkannya.
8. **Rollback adalah projection rollback, bukan database replacement.** Snapshot source digest harus sama dengan current L0. Jika L0 sudah bertambah/berubah, rollback ditolak dan operator harus rebuild dari L0 terbaru. Execute receipt `SUCCEEDED` maupun `FAILED` boleh menjadi rollback source selama pre-mutation owner snapshot tersedia; ini menutup recovery path bila kegagalan terjadi setelah sebagian projection mutation.
9. **Setiap execute/rollback menghasilkan durable receipt.** Receipt menyimpan operation id, actions, plan/source/projection digests, snapshot owner path, status, timestamps, dan detail hasil.
10. **Integrity validation adalah bagian closure.** SQLite quick check, foreign-key check, source episode references, supersede references, embedding references, quarantine promotion references, dan FTS integrity diperiksa. Repairable FTS drift boleh diperbaiki hanya bila plan eksplisit meminta FTS rebuild.

## Consequences

- Rebuild dapat diulang tanpa menjadikan backup sebagai source-of-truth baru.
- Historical Ledger dan Context L0 tetap memiliki semantics append-only yang sama seperti sebelum Batch 7.
- Snapshot lokal yang dibuat Batch 7 adalah safety snapshot operasi, bukan pengganti Backup/Restore/DR governance Batch 8.
- Kegagalan sesudah mutation tidak menghasilkan recovery dead-end selama pre-mutation snapshot berhasil dibuat; rollback tetap dibatasi oleh immutable L0 digest equality.
- L1 semantic reconstruction tetap bergantung pada local extraction. Dry-run tidak menjalankan model hanya untuk mengestimasi semantic diff karena itu akan menambah cost/non-determinism; receipt mencatat hasil aktual staging saat execute.
- Cross-service coordinator di masa depan harus memanggil owner APIs ini, bukan membuka file SQLite service lain.
