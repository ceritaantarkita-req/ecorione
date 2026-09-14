# Analisis Sistem — 2026-09-13

> Reconciled against current repository state on **2026-09-14**.
>
> Dokumen ini awalnya ditulis sebagai analisis sesi 2026-09-13. Nilai historisnya dipertahankan, tetapi status temuan di bawah sudah diselaraskan dengan implementation/evidence yang benar-benar ada di repository. Untuk status operasional terbaru, baca juga `docs/current-state-and-next-steps.md` dan `docs/active-work-plan.md`.

## Ringkasan current verdict

Analisis 2026-09-13 tetap berguna sebagai kritik produk: kompleksitas sistem sudah tinggi sementara validasi penggunaan nyata, product eval, UX runtime, dan hosted economic validation masih terbatas. Namun sebagian blocker teknis yang disebut saat itu sudah tidak akurat terhadap codebase sekarang.

Current framing yang benar:

- planned Batch 1–12: **CLOSED**;
- production/self-host repository baseline: **READY**;
- Historical Ledger + ECX local evidence: **CLOSED / PASS**;
- Comparative ECX: **CLOSED / PASS WITH LIMITATIONS**;
- automatic semantic reference selector: **NOT PROVEN**;
- UX/product validation: **ACTIVE / runtime walkthrough current main masih perlu ditutup**;
- Fase 5 AutoClick: **DEFERRED BY DESIGN**;
- Fase 6+: **OPEN-ENDED / evidence-driven**;
- tidak ada implicit Batch 13.

## Reconciliation temuan 2026-09-13

### 1. Kompleksitas jauh di atas validasi pemakaian nyata — VALID

11 modul, Temporal, Docker, observability, backup/restore, policy boundary, dan berbagai evidence harness sudah membentuk platform yang jauh lebih kompleks daripada jumlah pemakaian harian nyata yang sudah dibuktikan. Ini bukan defect arsitektur, tetapi risiko produk.

**Current action:** jangan tambah modul besar baru sebelum UX/product validation, product eval, onboarding, dan agentic/optimizer evidence memberi alasan nyata.

### 2. `pnpm dev` hanya menjalankan partial stack — VALID

Root development command tetap bukan full Phase 4 stack. `dev:phase3`/`dev:phase4` diperlukan untuk service tambahan seperti Artifact, Sandbox, Space, Flow, dan Temporal-dependent runtime.

Ini intentional untuk development staging, tetapi masih menjadi gap usability karena user bisa melihat 502/degraded state tanpa penjelasan bahwa stack yang berjalan memang partial.

**Current action:** W04/W09 di `docs/active-work-plan.md` — human-readable partial/full-stack state dan satu jalur startup full-system yang sederhana.

### 3. Penghematan ECX belum diuji sebagai hosted-dollar saving — VALID WITH BOUNDARY

Comparative ECX sudah membuktikan manfaat lokal pada benchmark terkontrol: selective transport/input-context reduction dan task-level gates. Itu bukti nyata untuk context/transport efficiency, tetapi **bukan** bukti universal actual USD saving pada Claude/OpenAI/OpenRouter.

Hosted-provider comparative validation tetap future/optional dan harus dilakukan dengan explicit operator spend intent serta budget yang bounded.

### 4. Mutable local model alias — VALID

Evidence observability lama memakai `gemma4:latest`. Mutable alias tidak cukup untuk durable reproducibility claims.

**Current action:** W13 — pin identity/version/digest dan rekam exact identity dalam trace/evidence.

### 5. Backup/restore Sync & Connect — ORIGINAL WORDING MISLEADING

Pernyataan lama bahwa "state Sync & Connect tidak ikut ter-restore" terlalu luas.

Evidence backup/restore sebenarnya mencatat Sync dan Connect sebagai **missing optional source state** pada run tersebut. Harness tidak men-seed state palsu hanya agar bisa mengklaim restore. Jadi run tersebut **tidak membuktikan runtime restore untuk state Sync/Connect yang absent**, tetapi juga tidak membuktikan bahwa existing state pasti hilang.

Repository sekarang juga memiliki Connect backup plumbing untuk credential vault/runtime settings. Claim boundary tetap harus eksplisit: absent source state tidak boleh dihitung sebagai restore proof.

### 6. UX walkthrough resmi current main belum ditutup — VALID

Checklist UX mensyaratkan synchronized current main, full Phase 4 stack, Temporal reachable, dan precondition lengkap. Perubahan UI 2026-09-13 terjadi setelah sebagian evidence sebelumnya, sehingga current visual/runtime tetap harus direvalidasi.

**Current action:** W03. Visual sekarang di-freeze; pekerjaan UX fokus pada defect/runtime/functionality, bukan redesign.

### 7. `*.test.tsx` tidak masuk Vitest discovery — VALID DEFECT

`vitest.config.ts` hanya memasukkan `*.test.ts` untuk apps/packages/services dan satu test nyata `apps/ai/app/page.hydration.test.tsx` ada di repository. Artinya test tersebut silent-skip dari normal `pnpm test`/CI discovery.

**Current action:** W02 memperluas discovery ke `*.test.tsx` dan memverifikasi tidak ada pola serupa yang tertinggal.

### 8. Attachment composer masih UI-only — VALID

Attachment current composer belum merupakan real upload/content ingestion. File/foto/folder direpresentasikan sebagai label teks ke request chat; bytes belum mengalir melalui Artifact → Context pointer → controlled hydration.

**Current action:** W12. Visual composer tidak perlu didesain ulang; yang diperbaiki adalah backend path dan state/error semantics.

### 9. Production blockers — PARTLY OUTDATED / PARTLY VALID

Bagian original mencampur blocker dari audit lama dengan current implementation.

**Sudah ada di current repository dan tidak boleh lagi disebut "belum ada":**

- encrypted file-backed Credential Vault dengan Connect sebagai credential authority;
- durable file-backed spend budget/reservation ledger untuk single-host boundary;
- external/public HTTPS MCP acceptance workflow;
- full-history secret scan implementation/script;
- production/self-host repository baseline yang sudah melewati closure evidence terkait.

**Nuance yang masih aktif:**

- full-history secret scanner ada, tetapi normal per-commit CI tidak saat ini menjalankan history scan sebagai continuous gate;
- product eval suite target 30–40 kasus tugas nyata belum terisi secara memadai (`evals/README.md` masih baseline kosong);
- branch/release governance masih dapat diperketat;
- hosted economic validation belum dilakukan sebagai actual-dollar proof;
- current UX/product validation belum closed;
- immutable local model identity masih pending.

## Prioritas setelah reconciliation

Urutan current work tidak mengikuti blocker lama secara buta. Source of truth aktif adalah `docs/active-work-plan.md`.

Prioritas saat reconciliation ini:

1. W02 — tutup test discovery gap;
2. W03 — runtime UX/product validation pada current main;
3. W04 — partial/full-stack usability;
4. W05–W08 — provider onboarding + Credential Vault UX;
5. W09–W11 — one-command startup, doctor, installer/launcher path;
6. W12 — real attachment pipeline;
7. W13 — immutable model identity;
8. W14–W15 — real product eval + agentic local-model validation;
9. W16–W18 — semantic selector, ECX no-oracle, hosted economic validation;
10. W19–W20 — release/security governance dan final current-state sync.

## Claim boundary

Dokumen ini bukan pengganti evidence files. Ia adalah reconciliation atas analisis 2026-09-13 agar historical findings tidak dibaca sebagai current blockers ketika code/evidence yang lebih baru sudah menutupnya.

Jika ada konflik antara wording historical audit dengan current code + current evidence + canonical current-state docs, gunakan kondisi repository yang lebih baru dan catat perbedaannya secara eksplisit.