# ADR-29 — Dataset governance and disaster recovery remain owner-scoped

Status: Accepted — Batch 8 implementation
Date: 2026-09-10

## Context

Setelah Batch 7, ecorione sudah dapat membangun ulang projection dari authoritative sources, tetapi rebuild bukan pengganti backup/restore. Sistem juga mulai memiliki trace/eval material yang dapat dipakai sebagai dataset. Dua kebutuhan ini terlihat mirip karena sama-sama memindahkan data, padahal trust boundary dan tujuan operasionalnya berbeda.

Dataset release adalah material terkurasi untuk evaluasi/training/regression. Backup adalah salinan recovery dari durable owner state. Menyamakan keduanya dapat membuat secret/PII ikut masuk dataset, atau sebaliknya membuat backup kehilangan data yang memang harus dipulihkan.

ECORIONE juga tidak boleh membuat coordinator yang membuka database service lain secara langsung. Connect credential vault membawa ciphertext yang hanya dapat dibuka dengan master key out-of-band. Flow menggunakan Temporal sebagai durability engine sehingga history/state Flow bukan file database lokal yang boleh diasumsikan dimiliki service Flow.

## Decision

1. **Dataset governance dimiliki RnD.** Shared schema mendefinisikan kontrak release, tetapi registry dan immutable release storage berada di RnD. Service lain menyerahkan export yang eksplisit beserta lineage; RnD tidak membuka database mereka.
2. **Dataset release dan backup adalah dua artefak berbeda.** Dataset wajib melewati sanitation, dedupe, schema/version, lineage, quality gate, dan optional deterministic train/eval/regression split. Backup harus mempertahankan bytes owner state untuk recovery dan tidak boleh disanitasi destruktif.
3. **Dataset release immutable dan content-identified.** Release ID diturunkan dari dataset/schema/source lineage, governed record bytes, dan quality report. `createdAt` adalah metadata dan tidak mengubah identity. Retry dengan content yang sama mengembalikan release yang sama.
4. **Sanitation fail-safe dilakukan sebelum release.** Field yang bernama seperti password/token/API key/credential di-redact. Email, phone-like values, dan Bearer-like values juga di-redact. Quality gate menolak payload kosong. Ini baseline deterministic sanitation, bukan klaim universal PII detector.
5. **Dedupe dilakukan setelah sanitation.** Record dengan governed payload byte-equivalent menjadi satu record release. Source IDs tetap tercatat pada record yang dipertahankan dan aggregate input/unique/dedupe count masuk quality report.
6. **Split bersifat deterministic dan group-safe bila dipakai.** Split policy harus tepat 100%. `groupId` yang sama selalu di-hash ke split yang sama agar satu conversation/entity group tidak bocor lintas train/eval/regression.
7. **Backup primitive boleh shared; ownership tidak.** `OwnerBackupStore` hanya menyediakan mekanisme file/directory/bundle/SQLite snapshot, SHA-256 manifest, locking, verification, dan staged restore. Masing-masing owner adapter memberikan handle/path miliknya sendiri. Tidak ada central module yang membuka DB service lain.
8. **SQLite backup memakai online backup dari handle owner yang sedang aktif.** Context, Hub, RnD, Sync, dan Space menjalankan integrity preflight sebelum snapshot. Restore SQLite bersifat offline: caller harus menghentikan/menutup owner DB sebelum atomic file replacement.
9. **Filesystem owners dipulihkan sebagai directory snapshots.** Artifact CAS dan Sandbox receipts memakai recursive regular-file backup; symlink ditolak. Restore dilakukan staging-first dan menghasilkan pre-restore safety backup bila target sudah ada.
10. **Connect Vault backup adalah ciphertext-only.** Backup API tidak menerima master key dan tidak memanggil decrypt. Vault file dicatat sebagai `vault-ciphertext`; master key harus dibackup lewat secret-management channel terpisah. Non-secret Connect durable state dibackup sebagai bundle tersendiri.
11. **Setiap backup diverifikasi dengan per-file SHA-256 + aggregate digest.** Manifest sendiri memiliki content-bound backup ID. Restore memverifikasi source backup sebelum mutation dan restored bytes setelah atomic replacement.
12. **Restore tidak menghancurkan current state tanpa recovery point.** Jika target sudah ada, owner backup store membuat pre-restore safety backup dan mengembalikan restore receipt yang menunjuk safety backup tersebut.
13. **Flow/Temporal adalah external DR dependency.** ECORIONE tidak menyalin working directory Flow dan menyebutnya backup durable execution. Recovery Flow membutuhkan backup/restore persistence Temporal sesuai deployment dan verification terhadap workflow continuity.
14. **DR closure membutuhkan recovery drill.** Minimal harus ada real SQLite online-backup → mutation/failure simulation → offline restore → integrity verification, vault ciphertext round-trip tanpa plaintext leakage, dataset tamper detection, dan generic backup tamper detection.
15. **Backup set harus dipindahkan ke failure domain berbeda untuk production.** Local owner backup directory membuktikan format/restore semantics, tetapi bukan disaster recovery jika disimpan di disk yang sama. Cross-machine/object-storage scheduling/encryption menjadi deployment responsibility menggunakan manifest yang sama.

## Consequences

- Data untuk training/eval tidak otomatis dianggap aman hanya karena berasal dari internal service.
- Restore tidak membutuhkan bypass arsitektur Hub/Context/Connect karena setiap owner tetap mengendalikan snapshot source-nya.
- Backup lokal dapat diuji deterministik tanpa mengklaim sudah tahan disk loss; operator harus mereplikasi backup yang telah diverifikasi ke failure domain terpisah.
- Master key Connect tidak pernah masuk backup payload atau reasoning context. Kehilangan master key tetap membuat ciphertext vault tidak dapat dipulihkan; itu harus dikelola sebagai secret DR terpisah.
- Batch 7 safety snapshot tetap snapshot operasi rebuild; Batch 8 owner backup adalah recovery artifact dengan manifest/integrity/restore semantics yang lebih umum.
- Temporal persistence backup tidak disamarkan sebagai fitur filesystem ECORIONE.
