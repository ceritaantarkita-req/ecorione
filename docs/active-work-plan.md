# ECORIONE — Active Work Plan

Last updated: **2026-09-14**

Status: **ACTIVE / canonical execution log for current work**

Dokumen ini adalah living document untuk pekerjaan aktif ECORIONE setelah Phase 4. Setiap pekerjaan terhadap repository wajib memperbarui dokumen ini sebelum pekerjaan dianggap selesai.

## 1. Aturan kerja aktif

1. **Visual current di-freeze.** Jangan redesign sidebar, layout, warna, composer, atau bahasa visual kecuali ada defect nyata atau kebutuhan fungsi yang tidak bisa diselesaikan tanpa perubahan visual.
2. Perubahan UX harus mengikuti desain existing. Fokus sekarang: fungsi, onboarding, reliability, observability, usability.
3. Jangan menambah modul besar baru sebelum gap aktif ditutup atau ada evidence nyata yang membenarkannya.
4. Fase 5 AutoClick tetap **DEFERRED BY DESIGN** sampai ada use case nyata yang tidak dapat diselesaikan melalui API/MCP.
5. Fase 6+ tetap **OPEN-ENDED / evidence-driven**. Tidak ada Batch 13 implisit.
6. Source of truth teknis: current code + current evidence + canonical current-state docs.
7. Setiap pekerjaan wajib dicatat dengan status, perubahan, evidence, commit/PR, limitation, dan next step.
8. Status repo-side tidak boleh dipakai untuk menyamarkan checkpoint operator/browser/runtime.

## 2. Current repository checkpoint

Current default-branch baseline setelah PR #79:

```text
main: 01efc87ef0409118ad0104a660f4d97f6a49f667
PR #79: merged
post-merge CI: 34865204054 — SUCCESS
post-merge Product Eval: 34865204071 — SUCCESS
```

Kondisi penting:

- PR #74 sudah merged; pekerjaan W01–W13 yang sebelumnya hidup di branch aktif sudah masuk `main`.
- PR #75 audit/security hardening sudah merged.
- PR #76 menambahkan Temporal CLI local-runtime path + Windows spawn handling, tetapi sempat masuk ke `main` dengan formatting regression.
- PR #77 menutup formatting regression tersebut; branch CI `34856483249` dan post-merge CI `34858779881` **SUCCESS**.
- PR #78 menyinkronkan canonical current-state docs setelah perbaikan `main`.
- PR #79 menambahkan W14 Product Eval Foundation: manifest bounded berisi 12 kasus nyata, provenance validator, dan workflow Product Eval terpisah.
- PR #79 head `183b9f3281dbedc16e459a3f09dea000d6756ba1` lulus CI `34864902355` dan Product Eval `34864902358`.
- PR #79 merged ke `main` sebagai `01efc87ef0409118ad0104a660f4d97f6a49f667`.
- push post-merge `main` lulus CI `34865204054` dan Product Eval `34865204071`.
- `main` adalah **GREEN BASELINE** untuk pekerjaan repo-side berikutnya.
- GitHub `main` belum memiliki required status-check branch protection; governance gap ini tetap terbuka terpisah.

## 3. Work queue aktif

| ID | Pekerjaan | Status | Definition / claim boundary |
|---|---|---:|---|
| W01 | Reconcile `system-analysis-2026-09-13.md` | **DONE** | Temuan valid/outdated sudah dipisahkan. |
| W02 | Tutup gap Vitest `*.test.tsx` | **DONE** | TSX tests masuk normal discovery/CI. |
| W03 | Audit UX/Product Validation current `main` | **BLOCKED — OPERATOR RUNTIME** | Full rendered Phase 4 walkthrough; tidak ada S0/S1 terbuka. |
| W04 | Partial-stack vs full-stack behavior | **DONE — REPO SIDE** | Human-readable service-down/proxy failures. |
| W05 | Provider Settings foundation | **DONE — REPO SIDE** | Provider catalog + Settings/Vault metadata authority. |
| W06 | Credential Vault integration | **DONE WITH LIMITATIONS — REPO SIDE** | Transient test → save/replace/remove; no browser plaintext persistence. |
| W07 | Provider health/status | **DONE WITH LIMITATIONS — REPO SIDE** | Backend health taxonomy; real external key validity tetap operator-owned evidence. |
| W08 | Default AI selection | **DONE — REPO SIDE** | Durable Local/Hosted default; fail-safe Local; no auto-router claim. |
| W09 | One-command full-system startup | **STARTED — NEEDS OPERATOR RUNTIME** | Engine lifecycle hardening + Temporal CLI path ada; clean Windows proof masih wajib. |
| W10 | `ecorione doctor` diagnostics | **STARTED — NEEDS OPERATOR RUNTIME** | Dependency/service/local-model diagnosis ada; operator matrix belum selesai. |
| W11 | Installer/Launcher | **STARTED — REPO-SIDE PACKAGING READY** | Launcher/bundle/installer workflow ada; real Setup + clean-Windows evidence belum ada. |
| W12 | Attachment composer real backend path | **DONE — REPO SIDE** | File/foto → Artifact → Context pointer → controlled hydration. |
| W13 | Immutable local model identity | **DONE WITH LIMITATIONS — REPO SIDE** | Alias gate + runtime provenance resolution + mismatch fail-closed implemented; actual operator model identity tetap butuh runtime evidence. |
| W14 | Product eval foundation | **DONE — REPO SIDE** | 12 real task/bug-derived deterministic regressions + provenance validation + dedicated CI gate. Tidak mengklaim kualitas agent/model. |
| W15 | Agentic local-model eval v1 | TODO | reason/tool/execute/observe/verify measured. |
| W16 | Automatic semantic reference selector | TODO | `refIndexes` tidak lagi caller/oracle-supplied. |
| W17 | ECX end-to-end tanpa oracle | TODO | full vs auto-selective vs oracle pada task set sama. |
| W18 | Hosted economic validation | TODO | real hosted token/cost with explicit bounded spend intent. |
| W19 | Release/security governance follow-up | **DONE — REPO SIDE** | full-history secret scan + stronger naming/model-alias gate berada di CI. |
| W20 | Final current-state sync | **STARTED** | Current docs disinkronkan bertahap; final closure baru setelah remaining work/evidence selesai. |

## 4. Provider / AI boundary

Provider onboarding target tetap:

```text
Settings → AI Provider → Paste API key → Test → Save → Choose route/model
```

Current boundary:

- Connect-owned Provider Catalog adalah source of truth onboarding metadata.
- Anthropic, OpenAI, OpenRouter: routing-ready + connection-test-ready.
- Kimi, Gemini, Qwen, GLM, custom OpenAI-compatible: credential-ready only sampai adapter/model/pricing contract nyata tersedia.
- hosted credential test adalah real call dan tetap tunduk pada kill switch + spend guard.
- `defaultChatTarget` durable: `local | hosted`; hosted hanya dipakai bila gate + credential siap.
- auto-router belum diimplementasikan atau diklaim.

## 5. Security hardening boundary

Remediasi audit 2026-09-14 yang sudah ada di `main`:

- same-origin mutation guard di `apps/ai/middleware.ts`;
- CSP + framing/nosniff/referrer/COOP/CORP headers di `apps/ai/next.config.ts`;
- default hosted-spend safety diperketat;
- `localBaseUrl` dibatasi ke loopback/private/private-name secara default, public opt-out eksplisit;
- mutable model alias gate mencakup `:latest`, `@latest`, `/latest`, dll.;
- local model provenance resolver menggunakan runtime boundary (`/api/tags` pada Ollama path) dan fail-closed pada digest mismatch;
- full-history secret scan menjadi CI job dengan `fetch-depth: 0`.

Known security limitation yang masih eksplisit:

- CSP `script-src` masih memakai `'unsafe-inline'` karena Next App Router bootstrap current implementation.

## 6. Local model identity boundary

W13 repo-side sekarang dianggap selesai dengan limitation:

- selector/tag dan immutable digest dipisahkan;
- mutable local aliases tidak boleh menjadi production identity tanpa pinned/verified identity contract;
- runtime yang bisa memberi provenance dapat menghasilkan `resolved` / `verified`;
- digest mismatch gagal tertutup;
- runtime tanpa provenance API tetap `declared-unverified` / `unverified`, bukan dipoles menjadi pinned;
- exact-cache/durable evidence tidak boleh diperlakukan reproducible saat identity tidak terpin/terverifikasi.

Ini **tidak** membuktikan model operator yang sedang terpasang saat ini sudah verified. Claim itu tetap membutuhkan runtime evidence pada mesin operator.

## 7. Startup / installer boundary

Developer bridge:

```text
pnpm engine:start
pnpm engine:doctor
pnpm engine:stop-temporal
```

Current engine behavior:

- `.env` local dibuat dari example bila perlu;
- internal token + Vault key dapat dibuat otomatis untuk local-only runtime;
- Temporal yang sudah reachable dipakai apa adanya;
- default local Temporal path sekarang dapat memakai Temporal CLI dev-server tanpa Docker;
- `ECORIONE_TEMPORAL_USE_DOCKER=1` mempertahankan jalur Docker compose eksplisit;
- Windows `pnpm.cmd` spawn memakai shell handling yang kompatibel;
- required Phase 4 services harus ready sebelum engine menyatakan ready;
- startup failure membersihkan spawned child processes.

W09/W10 tetap tidak ditutup karena clean Windows/operator runtime matrix belum dibuktikan.

Normal-user W11 tetap:

```text
Install ECORIONE → Open → Start/auto-start → Use
```

Repo-side launcher/bundle/installer spec tersedia, tetapi tidak ada real GitHub Release/Setup artifact evidence dan clean-Windows acceptance belum selesai.

## 8. Core product/economic claim boundary

Historical Ledger + ECX local evidence tetap CLOSED/PASS sesuai historical verification docs.

Comparative ECX tetap **PASS WITH LIMITATIONS**:

```text
5 tasks × 5 repeats × 3 lanes = 75 measured calls
cache hits = 0
passed task gates = 5/5
median selective transport reduction = 73.6379379246037%
median selective input-token reduction = 77.8580814717477%
median selective/full latency ratio = 0.8672873729681319
```

Tetapi:

- `ecx-selective-oracle` tetap oracle/control lane;
- `refIndexes` masih caller-supplied;
- automatic semantic selector **belum terbukti**;
- hosted dollar/token economics **belum tervalidasi dengan real provider spend**.

Jangan mengubah angka oracle/local benchmark menjadi universal public-savings claim.

## 9. Product eval boundary

W14 sekarang **DONE — REPO SIDE** melalui PR #79.

Current deterministic product-eval contract:

- `evals/product-regressions.json` adalah manifest versioned dan bounded maksimal 50 kasus;
- seed saat ini berisi 12 kasus dari defect/tugas repository nyata;
- setiap kasus wajib menunjuk provenance source/ref dan deterministic test target yang benar-benar ada;
- `evals/product-regressions.test.ts` memvalidasi provenance, uniqueness, bounded size, dan target test;
- `.github/workflows/product-eval.yml` menjalankan validator + deterministic target regressions pada pull request dan push ke `main`;
- workflow membangun runtime dependencies sebelum test sehingga internal package resolution valid di clean runner.

Claim boundary:

- W14 membuktikan regression-eval foundation dan gate deterministik;
- W14 **tidak** membuktikan reasoning quality, tool selection quality, execution reliability, pass^3 model reliability, atau general agentic quality;
- metrik tersebut tetap W15.

Evidence W14:

```text
PR #79 head: 183b9f3281dbedc16e459a3f09dea000d6756ba1
PR CI: 34864902355 — SUCCESS
PR Product Eval: 34864902358 — SUCCESS
merge: 01efc87ef0409118ad0104a660f4d97f6a49f667
post-merge CI: 34865204054 — SUCCESS
post-merge Product Eval: 34865204071 — SUCCESS
```

## 10. Prioritas eksekusi dari green baseline `01efc87e...`

1. **W03** rendered operator/browser walkthrough pada synchronized current `origin/main`.
2. **W09–W10** clean Windows/operator runtime proof.
3. **W11** real installer artifact + clean-Windows acceptance.
4. **W15** agentic local-model eval v1; jangan menyamakan deterministic W14 dengan model evidence.
5. **W16–W18** autonomous selector → no-oracle ECX → bounded hosted economics.
6. **W20** final synchronization.
7. Governance follow-up: required status checks / branch protection agar CI merah tidak bisa lagi masuk `main`.

Repo-side work dapat terus maju pada item independen, tetapi tidak boleh melompati claim boundary operator: bila checkpoint membutuhkan browser, clean Windows, real credential, local-model runtime, atau real hosted spend, statusnya tetap terbuka sampai evidence tersebut ada.

## 11. Execution log — 2026-09-14 baseline repair

### Current-main CI regression — CLOSED

**Finding:** PR #76 merged ke `main` pada `c6c1b786...`, lalu push CI `34848735694` gagal di `format:check` untuk `scripts/ecorione-engine.mjs`. Karena format adalah gate pertama, lint/typecheck/tests/acceptance/build tidak berjalan pada exact push tersebut.

**Changed:** PR #77 (`agent/fix-main-ci-doc-sync-20260914`) menyesuaikan file engine ke exact Prettier 3.9.6 output tanpa mengubah runtime behavior. Temporary formatter-oracle instrumentation dipakai hanya untuk memperoleh diff exact, lalu workflow `.github/workflows/ci.yml` dikembalikan ke baseline normal. Current-state docs ikut disinkronkan.

**Evidence:**

- code-fix head `25933a24647568643f71d73dd0c9b05d1a977cb2`; CI `34855810626` **SUCCESS**;
- final PR head `d7be123adcd598e9424d3ef84a337befdfe07b2f`; CI `34856483249` **SUCCESS**;
- merge commit `21ebecd2af7fb5f0f1fa5d54a971ae13582fe72b`;
- post-merge push CI `34858779881` **SUCCESS**.

**Result:** formatting regression ditutup dan `main` kembali menjadi green baseline. Pekerjaan berikutnya tidak perlu kembali ke PR #76/#77 kecuali ada regression baru yang dapat direproduksi.

**Limitation:** branch protection/required checks belum aktif; merge discipline masih bergantung pada operator sampai governance dikunci.

## 12. Execution log — W14 Product Eval Foundation

### W14 — CLOSED REPO SIDE

**Finding:** eval infrastructure sudah memiliki Promptfoo scaffolding dan aturan suite, tetapi belum memiliki real task/bug-derived executable product suite; `tests: []` belum memberi regression evidence.

**Changed:** PR #79 menambahkan 12-case deterministic product manifest, provenance validator, dedicated Product Eval workflow, dan dokumentasi yang memisahkan W14 deterministic regressions dari W15 agent/model evaluation.

**Evidence:** PR head dan post-merge `main` sama-sama lulus CI normal dan Product Eval sebagaimana dicatat di §9.

**Result:** W14 ditutup repo-side. Defect/task nyata sekarang dapat dipertahankan sebagai bounded regression contract yang dieksekusi di CI.

**Limitation:** suite ini tidak melakukan model call dan tidak mengukur reason/tool/execute/observe/verify. W15 tetap terbuka.

**Next:** repo-side berikutnya adalah W15 foundation sejauh dapat dibangun tanpa memalsukan local-runtime evidence; W03/W09/W10/W11 tetap menunggu operator checkpoints masing-masing.

## 13. Claim boundary

`DONE` hanya dipakai bila implementation/evidence aktual mendukung. `DONE — REPO SIDE` tidak menggantikan operator/browser/runtime evidence. Historical verification docs tetap source of truth untuk evidence lama; dokumen ini hanya menyatakan current execution state dan tidak menghapus limitation historis.
