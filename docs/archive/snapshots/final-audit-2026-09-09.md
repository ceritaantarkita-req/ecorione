# ecorione — Final real-state audit

> **HISTORICAL SNAPSHOT:** audit ini merekam keadaan 2026-09-09 dan sengaja tidak direwrite untuk menyembunyikan blocker yang saat itu nyata. Blocker roadmap tersebut kemudian ditutup sampai Batch 12. Current canonical status ada di `current-state-and-next-steps.md`, `EXECUTION-PROGRESS.md`, dan `verification/batch12-closure-2026-09-10.md`.

**Tanggal:** 2026-09-09  
**Branch audit:** `agent/fullstack-audit-fixes-phases-20260909`  
**PR:** #1 (draft, belum merge)  
**Base main:** `06b15d6dba207c47d8693febffaaabf17afd2ed4`

## 1. Verdict

**GO untuk local/developer alpha dan kelanjutan product validation.**  
**NO-GO untuk klaim production-ready managed platform atau autonomous business operator.**

Alasannya bukan karena core architecture gagal. Sebaliknya, baseline sekarang sudah jauh lebih konsisten: service boundary jelas, memory/privacy invariant diperketat, MCP/Sync/Artifact/Sandbox/Space/Flow benar-benar ada, Flow dibuktikan survive worker crash, Docker acceptance nyata berjalan, dan CI strict mencakup format/lint/typecheck/test/secret-scan/build.

NO-GO production terutama karena masih ada gap yang secara eksplisit diwajibkan PRD tetapi belum selesai: production credential vault, durable cumulative spend budget, external MCP/tunnel interoperability acceptance, provider canary/eval evidence, dan full-history secret scan sebelum public release.

## 2. Status fase aktual

| Fase | Status | Real state |
|---|---|---|
| 0 | **CLOSED** | monorepo, schema, telemetry, CI foundation |
| 1 | **CLOSED + repaired** | Ai → Hub → Context → Connect → RnD; privacy/idempotency/cost/policy regressions diperbaiki |
| 2 | **CLOSED** | MCP inbound modern + Sync local/self-hosted encrypted relay/bridge |
| 3 | **CLOSED** | Artifact CAS + Sandbox Tier0/WASM/Docker + Space |
| 4 | **CLOSED** | Temporal durable Flow + Hub approval + Connect + Sandbox + RnD verification |
| 5 | **DEFERRED BY DESIGN** | AutoClick tidak dibangun karena belum ada use case non-API konkret |
| 6+ | **ACTIVE / evidence-driven** | hardening baseline; bukan fase yang layak diberi CLOSED permanen |

Fase 5 bukan kegagalan delivery. Blueprint dan ADR-11 justru melarang pembangunan RPA generik tanpa evidence kebutuhan nyata.

## 3. Arsitektur yang benar-benar ada

### Ai

- Next.js chat surface.
- Route `/space` untuk notes/core-memory editor.
- Proxy server-side menjaga internal token tidak dikirim ke browser.

### Hub

- Policy engine dan approval source of truth.
- Audit trail.
- Chat orchestration.
- MCP memory boundary.
- Idempotent side-effect handling.

### Connect

- Provider routing lokal/hosted.
- Prefix-stability enforcement.
- Exact-match bounded cache.
- Actual + naive cost accounting.
- Inbound MCP stdio + HTTP.
- OAuth resource-server validation untuk HTTP MCP.
- Emergency hosted cost kill switch.

### Context

- L0 episode, L1 facts, L2 core memory.
- Scope/sensitivity/sync-class filtering.
- Hosted-eligible filtering.
- Artifact metadata binding.
- Hosted writes/quarantine rules.

### Sync

- Device bootstrap/pairing.
- Device token disimpan sebagai hash.
- X25519 + HKDF-SHA256 + AES-256-GCM helper.
- Ciphertext-only relay contract.
- MCP bridge tetap local/loopback dan reachability publik diserahkan ke tunnel sesuai ADR-16.

### Artifact

- Content-addressed storage `art_<sha256>`.
- Dedup blob fisik.
- Classification binding tetap terpisah.
- Read melakukan authorization ulang lewat Context.
- Hash/size integrity check.

### Sandbox

- Tier 0 allowlist host command ketat.
- Tier 1.5 WASM tanpa host imports.
- Tier 1 Docker dengan network none, read-only rootfs, cap drop, no-new-privileges, non-root, resource limits, satu workspace mount, tanpa docker socket.
- Durable idempotency receipt.
- Hub policy + RnD trace.

### Space

- SQLite pages/blocks milik Space sendiri.
- Core memory tidak diduplikasi; edit tetap lewat Context.

### Flow

- Temporal self-hosted, SDK `1.23.0` dipin.
- Durable delay.
- Human approval lewat Hub.
- AI node lewat Connect.
- Execution lewat Sandbox.
- Independent verification dari RnD trace.
- Worker process crash/replacement acceptance.
- Durable approval lookup berasal dari Hub, bukan workflow query yang membutuhkan worker aktif.
- Sticky workflow failover dipersingkat menjadi 1 detik; cache tetap aktif, tetapi task worker yang mati cepat kembali ke non-sticky queue.
- Milestone node (`approval`, AI, Sandbox, verification, completion) tercatat di RnD untuk diagnosis lintas-boundary.

### AutoClick

- **Tidak ada**, sengaja.

## 4. Invariant audit

### PASS — memory sebagai untrusted data

Memory/tool result untuk hosted model dibungkus sebagai data, bukan instruksi. Hosted proposal masuk quarantine, bukan langsung trusted/core memory.

### PASS — no silent provider fallback

Routing error/provider error dibuat eksplisit. Cost kill switch juga menolak hosted request, bukan diam-diam mengalihkan ke local.

### PASS — local-first classification boundary

Hosted egress memakai scope/sensitivity/syncClass gate. `LOCAL_ONLY` tidak dianggap aman untuk relay/cloud hanya karena caller memintanya.

### PASS — direct cross-service DB access di jalur yang diaudit

Artifact/Space/Flow/Sandbox menggunakan HTTP/service boundary terhadap data milik modul lain. Tidak ditemukan desain baru yang sengaja membuka SQLite service lain.

### PASS — idempotency pada side effect yang diimplementasikan

Hub dan Sandbox menyimpan/reuse idempotent result/receipt untuk jalur side-effect yang dibangun.

### PASS — prefix stability

Stable prefix dijaga `context-assembly` + Connect dan regression test. Clock dinormalisasi ke boundary yang diaudit.

### PASS — model pin gate

CI menolak alias model `-latest`; Temporal SDK juga dipin exact.

### PASS — Sandbox hardening v1

Runtime acceptance menjalankan Docker nyata, bukan hanya mengassert string command.

### PASS — Flow durability

Acceptance membunuh worker process dua kali dan membuktikan workflow yang sama dapat dilanjutkan replacement worker melalui durable Hub approval, AI, Sandbox, dan verification. Recovery tidak lagi bergantung pada workflow query untuk mencari operation id.

### PARTIAL — cost control

Actual vs naive cost ledger ada dan emergency hosted kill switch sekarang ada. **Belum ada cumulative durable spend budget** yang aman terhadap restart dan concurrent calls.

### PARTIAL — credential security

Boundary kepemilikan credential benar: Connect. Tetapi **vault production terenkripsi at-rest belum diimplementasikan**. `.env` hanya layak untuk development lokal.

### PARTIAL — MCP production interoperability

Modern MCP stateless surface, OAuth resource validation, stdio/HTTP tests ada. Namun belum ada acceptance eksternal lewat HTTPS/tunnel nyata dengan host production seperti Claude/ChatGPT, dan implementation menggunakan MCP layer minimal internal, bukan interoperability test resmi terhadap seluruh host matrix.

### PARTIAL — production release secret assurance

Working-tree secret scan ada dan CI hijau. PRD §20 meminta review/full-history assurance sebelum publish; current script **tidak memindai seluruh git history**.

## 5. Evidence test/CI

Evidence closure utama:

- **Fase 3 strict closure:** run `34301124513`.
- **Fase 4 code strict closure:** run `34304885390`.
- **Fase 4 docs/head strict closure:** run `34305530219`.
- **Fase 6 baseline hardening + forced-crash recovery:** run `34311242323`.
- Run terakhir tersebut lulus frozen lockfile, format, lint, typecheck, **333/333 tests**, secret scan, dan production build.
- Acceptance yang aktif di CI mencakup Docker Tier 1 nyata dan forced Temporal worker crash/replacement.

Commit dokumen audit ini tetap harus menjalani strict CI karena evidence harus berlaku untuk HEAD yang akan di-merge. Run ID HEAD dokumen tidak ditulis kembali ke file untuk menghindari loop self-referential `ubah run ID → commit → butuh run ID baru`; status PR/HEAD adalah bukti closure terakhir.

## 6. Production blockers

### P0 — wajib sebelum production credential use

1. **Connect credential vault terenkripsi at-rest** + rotation path.
2. Definisi deployment production yang jelas untuk secret injection; jangan pakai `.env` permanen sebagai vault.

### P0/P1 — wajib sebelum hosted spend tak-diawasi

3. **Durable cumulative spend budget** di provider boundary. Harus tahan restart dan concurrency; in-memory counter tidak diterima.
4. Propagasi reason cost kill switch ke surface user-level perlu diverifikasi; Connect sudah typed `503`, tetapi higher-level caller dapat menormalisasi upstream failure.

### P1 — wajib sebelum klaim MCP hosted production

5. Real HTTPS/tunnel acceptance dengan OAuth issuer/resource/JWKS nyata.
6. Host/client interoperability matrix untuk MCP production.

### P1 — wajib sebelum public production release

7. Full-history secret scan/review.
8. Provider canary harian sesuai PRD, dengan quality floor dan model pin evidence.
9. RnD product eval suite 30–40 kasus yang benar-benar tugas nyata, k=3. **333 engineering tests bukan pengganti evaluation suite tersebut.**

### P1 — operasional

10. Deployment recipe untuk Temporal + seluruh local service, termasuk restart/persistence/backup.
11. Dedicated approval UX di Ai belum terbukti sebagai end-user flow; approval API/Flow sudah ada.
12. Next.js build masih pernah mengeluarkan warning bahwa Next ESLint plugin belum terdeteksi di flat ESLint config; build tetap hijau, tetapi rule coverage Next-specific belum dibuktikan.

### P2 / deferred by design

13. Managed Sync relay/cloud.
14. AutoClick/RPA sampai ada non-API use case nyata.
15. Vector/embedding production dependency jika evidence retrieval membutuhkannya.

## 7. Security posture

**Lebih kuat dari baseline awal**, terutama pada memory provenance/egress, hosted quarantine, MCP handle binding, Sync E2E payload design, Sandbox execution isolation, idempotency, dan explicit policy boundary.

Tetapi jangan menyebut sistem ini "secure autonomous business platform". Surface production yang paling sensitif—credential vault, public MCP exposure, provider budget, dan human-facing approval UX—belum semuanya ditutup.

## 8. Reliability posture

Flow durability adalah peningkatan paling penting: Temporal menjadi satu durability engine, bukan membuat scheduler/database kedua. Forced crash acceptance mengurangi risiko status workflow hilang setelah restart. Sticky assignment sekarang memiliki failover 1 detik, sehingga worker replacement tidak harus menunggu default sticky timeout lama sebelum replay dari history durable.

Sandbox juga memiliki idempotent receipt, jadi retry Flow tidak semestinya mengeksekusi side effect yang sama dua kali pada path yang memakai key stabil.

Remaining reliability gap utama adalah deployment persistence/backup di luar test environment dan eval/canary terhadap provider nyata.

## 9. Documentation truthfulness

Perbaikan penting sudah dilakukan:

- README tidak lagi bilang repo masih Fase 1.
- README tidak lagi menyebut satu SQLite global.
- `.env.example` tidak lagi mengklaim vault production sudah ada.
- Fase 5 jelas deferred, bukan pura-pura complete.
- Fase 6+ disebut open-ended/evidence-driven, bukan checklist yang dipaksakan selesai.

`docs/blueprint.md` tetap berfungsi sebagai planning snapshot v1.0 bertanggal 2026-09-08; untuk status runtime terbaru gunakan README + `docs/DECISIONS.md` + dokumen API fase.

## 10. Recommended next execution order

1. Production Connect credential vault.
2. Durable cumulative budget/kill policy.
3. Real external MCP + Sync tunnel acceptance.
4. Production deployment/persistence recipe Temporal + service DB/CAS backup.
5. Provider canary + RnD eval suite tugas nyata.
6. Approval UX di Ai.
7. Fitur produk/evidence-driven berikutnya dibangun di branch terpisah dari baseline yang sudah hijau.
8. AutoClick tetap jangan disentuh sampai use case non-API nyata muncul.

## 11. Merge posture

Baseline sekarang **layak menjadi development checkpoint** setelah strict CI pada HEAD dokumen ini hijau. User telah memilih menyelesaikan baseline terlebih dahulu sebelum menarik repo ke laptop dan sebelum fitur riset baru ditambahkan.

Untuk menjaga history `main` bersih dari lebih dari seratus commit debugging/CI, PR #1 sebaiknya di-**squash merge** setelah gate terakhir hijau. Production blockers di atas tetap menjadi milestone setelah development baseline merge; mereka bukan alasan mempertahankan `main` selamanya pada arsitektur lama.

## 12. Kesimpulan

Repo sekarang sudah menjadi **development baseline yang koheren dan jauh lebih dekat ke arsitektur PRD dibanding baseline main**, dengan Fase 2–4 benar-benar terimplementasi dan diuji lintas boundary. Keputusan paling benar setelah itu justru **tidak membangun AutoClick** tanpa evidence.

Baseline selanjutnya dapat dipakai untuk eksperimen/fitur baru hanya dari branch terpisah, sehingga Historical Ledger, komunikasi agent, dan hardening produksi tidak bercampur dengan sejarah audit besar ini.
