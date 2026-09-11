# AGENTS.md — konvensi untuk AI yang mengerjakan repo ini

ECORIONE adalah lapisan memori dan optimizer bersama untuk AI lokal maupun hosted, dengan Hub governance, Connect provider/MCP boundary, durable Flow, Sandbox, observability, dan self-host release baseline.

## Current state — baca ini dulu

Per **2026-09-11**:

- planned platform/production **Batch 1–12 CLOSED**;
- remaining planned batch di roadmap itu: **0**;
- production/self-host baseline: **READY** sesuai boundary yang didokumentasikan;
- real laptop rehearsal: **PASS / LOCAL BOUNDARY CLOSED**;
- real Historical Ledger + ECX traffic/integrity checkpoint: **PASS / LOCAL CHECKPOINT CLOSED**;
- PR #37 merged ke `main` sebagai `88d588bbe4a5f005652c20f3409dd72093439f56`;
- comparative ECX harness PR #38 merged sebagai `c1849cd0c67712e40ea4e5c90587283900859cdb`;
- comparative harness docs closure PR #39 merged sebagai `5437c1ea5d8ee168dbbe09de688a23c39089c7aa`;
- PR #38 exact-head CI `34557147546` + MCP External HTTPS `34557147583`: **PASS**;
- PR #38 post-merge CI `34557297702` + MCP External HTTPS `34557297803`: **PASS**;
- comparative harness implementation: **CLOSED / VERIFIED**;
- first real Gemma comparative smoke: **FAIL / CACHE-ISOLATION HARNESS DEFECT FOUND**;
- comparative cache-isolation fix: **IN REVIEW / RERUN REQUIRED**;
- real Gemma comparative ECX efficiency evidence: **ACTIVE / NOT CLOSED**;
- real compute-host/VPS + Cloudflare deployment: **DEFERRED BY OPERATOR DECISION**;
- Fase 6+ tetap **OPEN-ENDED / evidence-driven**;
- Fase 5 AutoClick tetap **DEFERRED BY DESIGN**;
- **tidak ada Batch 13 implisit**.

Agent yang tidak punya histori chat **WAJIB mulai dari `docs/current-state-and-next-steps.md`**, lalu file ini. Jangan memakai `docs/blueprint.md` atau `docs/final-audit-2026-09-09.md` sebagai current-state source; keduanya punya nilai historis/planning dan tidak menggantikan tracker terbaru.

Recommended reading order saat ini:

1. `docs/current-state-and-next-steps.md`
2. `AGENTS.md`
3. `docs/comparative-ecx-evidence.md`
4. `docs/verification/comparative-harness-implementation-2026-09-11.md`
5. `docs/verification/historical-ledger-ecx-local-evidence-2026-09-11.md`
6. `docs/verification/local-production-rehearsal-2026-09-10.md`
7. `docs/EXECUTION-PROGRESS.md`
8. docs operations/ADR yang relevan dengan scope
9. `docs/prd.md` + `docs/research.md`
10. `docs/blueprint.md` sebagai historical execution blueprint

## Next work posture

Setelah Batch 12, kerja berikutnya adalah **scope baru**, bukan otomatis Batch 13. Operator sudah memilih local-first evidence sebelum VPS. Harness comparative sudah merged/verified; first real smoke menemukan cross-invocation exact-cache contamination. Urutan aktif sekarang:

1. selesaikan `fix/comparative-cache-namespace-20260911` tanpa mengubah threshold evidence;
2. exact-head verify → merge → post-merge verify → sync laptop;
3. rerun comparative Gemma smoke dan wajibkan measured `cacheHit=false` + non-zero token telemetry;
4. jika smoke sehat, jalankan closure-grade paired benchmark;
5. local persistence/restart drill;
6. local backup/restore drill;
7. local observability baseline;
8. product/UX validation;
9. immutable local model identity hardening;
10. compute-host/VPS + Cloudflare deployment **hanya jika operator secara eksplisit melanjutkan**;
11. hosted-provider comparative validation bila operator menyediakan kredensial + budget;
12. maintenance/dependency/security/DR evidence dan feature baru hanya jika evidence membenarkan.

Comparative protocol: `docs/comparative-ecx-evidence.md`. Harness implementation verification: `docs/verification/comparative-harness-implementation-2026-09-11.md`.

Untuk future Cloudflare Free/VPS deployment, baca `docs/production-activation.md` dan `docs/cloudflare-free-deployment.md`. Cloudflare adalah edge/tunnel, **bukan** pengganti compute/storage/Temporal ECORIONE.

## Perintah

```bash
pnpm install
pnpm verify
pnpm test
pnpm test:watch
pnpm typecheck
pnpm secret-scan
pnpm run acceptance:production-ops

# local comparative evidence, only with synchronized Phase 4 runtime running
pnpm evidence:comparative:smoke
pnpm evidence:comparative
```

`pnpm verify` harus hijau sebelum PR dibuka. Production build dan acceptance yang relevan tetap release-blocking sesuai workflow/closure rules.

`evidence:comparative` adalah runtime evidence command, bukan CI unit test. Jangan membuat CI bergantung pada Ollama/model lokal. Harness helper/gate logic harus punya deterministic test terpisah.

## Comparative evidence rules

1. Jangan menyebut packet/hydration count sebagai savings proof.
2. Current ECX `/v1/exchange/hydrate` menerima `refIndexes` dari caller. Jadi `ecx-selective-oracle` hanya mengukur benefit ketika reference yang benar **sudah diketahui**; itu bukan automatic selector evidence.
3. `full-inline`, `ecx-all`, dan `ecx-selective-oracle` harus memakai task/facts/model yang sama. Jangan memberi satu lane jawaban lebih mudah.
4. Exact-cache tidak boleh menguntungkan lane tertentu. Measured `cacheHit=true` adalah failure. Cache-buster benchmark harus terisolasi **antar invocation**, bukan cuma unik di dalam satu invocation; smoke lalu full run pada Connect process yang sama tidak boleh saling reuse measured entries.
5. Tetapkan gate sebelum melihat hasil. Jangan melemahkan threshold sesudah failure hanya agar benchmark hijau.
6. Quality harus dinilai dengan deterministic expected facts ketika fixture memungkinkan. Jangan menambahkan AI judge hanya untuk menaikkan skor.
7. Local provider-token `actualUsd=0` bukan hosted cost-saving evidence.
8. Simpan raw evidence lokal di path yang gitignored (contoh `.ecorione/evidence/`). Commit hanya sanitized summary setelah hasil diverifikasi.
9. Negative result adalah evidence yang valid. Jangan membangun selector/optimizer baru hanya untuk mempertahankan hipotesis awal.
10. Real comparative result hanya boleh diklaim dari run pada laptop yang sudah sinkron ke merged harness revision; jangan memakai moving PR branch sebagai closure evidence.
11. Cache-hit runs boleh membuktikan bahwa cache bekerja, tetapi **tidak boleh** dipakai sebagai model-compute token/latency evidence; zero token telemetry pada exact-cache hit bukan selective-context savings.

## Aturan yang tidak bisa dinegosiasikan

Ini bukan preferensi gaya — ini invarian yang kalau dilanggar merusak klaim inti produk. Nomor ADR merujuk ke `docs/adr/`.

1. **Prefix stabil harus byte-identik** (ADR-01). Segala yang berubah tiap panggilan — timestamp, UUID, hasil retrieval, jam — **tidak boleh** masuk system prompt, definisi tool, atau blok memori inti. Cache provider dicocokkan lewat hash prefix. Clock produksi harus diinjeksi dari boundary yang eksplisit, bukan dibuat di pure/core logic.
2. **Jangan pernah menyimpan instruksi sebagai memori** (ADR-07, PRD). Memori menyimpan fakta/preferensi. Semua memori tersimpan diperlakukan sebagai **data tak-tepercaya** dan dirender sebagai data, bukan instruksi.
3. **Tulisan dari model hosted masuk karantina** (ADR-07). `memory_propose`, bukan trusted write langsung. Promosi mengikuti jalur lokal/governed.
4. **Jangan hapus fakta — invalidate** (ADR-06). Gunakan temporal invalidation/supersession; retrieval aktif memfilter state invalid.
5. **Idempotency key wajib pada setiap efek samping** (ADR-12), dipaksakan di boundary runtime/tool, bukan diminta lewat prompt.
6. **Setiap panggilan model mencatat biaya aktual/kontrafaktual sesuai boundary yang tersedia** (ADR-13). Jangan membuat savings claim yang tidak didukung telemetry nyata.
7. **Gerbang sensitivitas/authority dievaluasi sebelum egress/biaya.** Tidak ada downgrade/silent fallback tersembunyi.
8. **Pin versi/model identity eksplisit** (ADR-14). Alias yang dapat drift seperti `-latest` dilarang di config/code yang diaudit. `gemma4:latest` yang muncul pada rehearsal adalah evidence runtime sementara, bukan durable production identity.
9. **Kredensial tidak pernah masuk konteks reasoning AI.** Connect tetap credential owner dan production secret berada di Vault/encrypted boundary yang disetujui.
10. **Jangan sentuh repo/ekosistem lama sebagai side effect.** Referensi lama tetap read-only kecuali user membuat scope eksplisit terpisah.
11. **Tidak ada cross-service database access.** Setiap owner data diakses lewat contract/API owner service.
12. **Historical Ledger dan Context L0 adalah ground truth append-only/immutable secara semantik.** Rebuild/migration tidak boleh convenience-rewrite ground truth.
13. **Hub tetap policy/approval authority.** Connect/MCP/Cloudflare/tunnel/provider bukan pengganti Hub governance.
14. **External MCP public acceptance tetap public-network test.** Jangan menggantinya dengan localhost-only pass demi membuat CI hijau.
15. **Jangan melemahkan security/release gate karena provider/tunnel flake.** Pisahkan provider availability dari product correctness tanpa menghapus acceptance.
16. **AutoClick/RPA tetap deferred** sampai use case non-API konkret lolos review arsitektur.

## Arsitektur singkat

- **Hub** = supervisor/coordinator + policy/approval/audit/authority + Historical Ledger/ECX. Bukan swarm.
- **Connect** = outbound provider/local model + cache/routing/cost telemetry + credential/spend + inbound/outbound MCP + runtime settings.
- **Context** = memory owner L0–L2 dan L3 metadata binding.
- **Sync** = pairing/self-host bridge dan public MCP bridge boundary.
- **Artifact** = content-addressed L3 bytes.
- **Sandbox** = bounded execution tiers.
- **Space** = notes/block workspace tanpa menggandakan Context source of truth.
- **Flow** = Temporal durable workflow.
- **RnD** = traces, eval foundation, dataset governance.
- **Ai** = user/operator UI; bukan authority/database owner untuk service lain.

ECX selective hydration berada di Hub, tetapi pemilihan `refIndexes` saat ini berasal dari caller. Jangan mendokumentasikan Hub/Connect seolah sudah punya semantic/autonomous reference selector jika belum ada implementasinya.

## Konvensi kode

- TypeScript strict, ESM, Node >=22. Gunakan `import type` untuk type-only import sesuai project config.
- Nama modul internal: `Ai`, `Hub`, `Connect`, `Context`, `Sync`, `Space`, `Flow`, `Artifact`, `Sandbox`, `RnD`, `AutoClick`.
- Folder/package `kebab-case`; package npm `@ecorione/<nama>`.
- Shared schema didefinisikan sekali di `packages/shared-schema`; jangan duplikasi kontrak antar service.
- Test mengikuti struktur existing dan harus menguji owner/runtime boundary yang relevan.
- Jangan menambahkan temporary helper/workflow ke final merge tree.
- Evidence harness boleh mengorkestrasi public/internal service API yang sudah ada, tetapi tidak boleh membuka DB owner service secara langsung.

## Mengubah arsitektur

Keputusan besar dicatat di `docs/DECISIONS.md`. Perubahan yang mengubah invariant, ownership, authority, durable state, security boundary, deployment contract, atau release claim membutuhkan ADR baru/updated ADR yang eksplisit.

Current comparative harness dan cache-isolation fix **bukan architecture change**: keduanya memakai API Artifact, Hub ECX, dan Connect yang sudah ada. Automatic selector baru akan menjadi scope terpisah dan harus direview jika evidence membenarkannya.

Setelah scope selesai:

- update `docs/current-state-and-next-steps.md` bila current state berubah;
- update `docs/EXECUTION-PROGRESS.md` dengan evidence nyata;
- update workstream/operations docs yang terpengaruh;
- untuk comparative evidence, commit sanitized verification note setelah real run, bukan raw local evidence;
- jangan rewrite historical verification/audit hanya untuk membuat sejarah terlihat lebih bersih.

## Yang sengaja tidak dibangun/dipaksakan

Jangan menambahkan tanpa evidence + keputusan arsitektur baru:

- semantic caching generik;
- automatic semantic ECX reference selector hanya karena benchmark oracle terlihat bagus;
- graph database hanya karena tren;
- swarm/multi-agent orchestration tanpa kebutuhan nyata;
- durable execution engine buatan sendiri yang menduplikasi Temporal;
- microVM/vLLM sebagai dependency wajib tanpa kebutuhan hardware/use case;
- autonomous L4 claim;
- agent polling always-on;
- AutoClick/RPA generik.
