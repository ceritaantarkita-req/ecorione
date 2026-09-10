# AGENTS.md — konvensi untuk AI yang mengerjakan repo ini

ECORIONE adalah lapisan memori dan optimizer bersama untuk AI lokal maupun hosted, dengan Hub governance, Connect provider/MCP boundary, durable Flow, Sandbox, observability, dan self-host release baseline.

## Current state — baca ini dulu

Per **2026-09-10**:

- planned platform/production **Batch 1–12 CLOSED**;
- remaining planned batch di roadmap itu: **0**;
- production/self-host baseline: **READY** sesuai boundary yang didokumentasikan;
- closure PR #30 merged ke `main` sebagai `783a4ae8a2c90b3c696b3d619fb0c03581f675b2`;
- final post-closure CI `34490006960`: PASS;
- Fase 6+ tetap **OPEN-ENDED / evidence-driven**;
- Fase 5 AutoClick tetap **DEFERRED BY DESIGN**;
- **tidak ada Batch 13 implisit**.

Agent yang tidak punya histori chat **WAJIB mulai dari `docs/current-state-and-next-steps.md`**, lalu file ini. Jangan memakai `docs/blueprint.md` atau `docs/final-audit-2026-09-09.md` sebagai current-state source; keduanya punya nilai historis/planning dan tidak menggantikan tracker terbaru.

Recommended reading order:

1. `docs/current-state-and-next-steps.md`
2. `AGENTS.md`
3. `docs/EXECUTION-PROGRESS.md`
4. `docs/verification/batch12-closure-2026-09-10.md`
5. docs operations/ADR yang relevan dengan scope
6. `docs/prd.md` + `docs/research.md`
7. `docs/blueprint.md` sebagai historical execution blueprint

## Next work posture

Setelah Batch 12, kerja berikutnya adalah **scope baru**, bukan otomatis Batch 13. Urutan rekomendasi saat ini:

1. production deployment;
2. real provider validation;
3. durable production observability;
4. host/account/backup security hardening;
5. product validation;
6. RnD/evaluation + ECX/optimizer validation;
7. UX/Control Center improvement;
8. ecosystem integration lewat contract/API;
9. maintenance/dependency/security/DR drills;
10. feature baru hanya jika evidence membenarkan.

Untuk Cloudflare Free/VPS deployment, baca `docs/cloudflare-free-deployment.md`. Cloudflare adalah edge/tunnel, **bukan** pengganti compute/storage/Temporal ECORIONE.

## Perintah

```bash
pnpm install
pnpm verify
pnpm test
pnpm test:watch
pnpm typecheck
pnpm secret-scan
pnpm run acceptance:production-ops
```

`pnpm verify` harus hijau sebelum PR dibuka. Production build dan acceptance yang relevan tetap release-blocking sesuai workflow/closure rules.

## Aturan yang tidak bisa dinegosiasikan

Ini bukan preferensi gaya — ini invarian yang kalau dilanggar merusak klaim inti produk. Nomor ADR merujuk ke `docs/adr/`.

1. **Prefix stabil harus byte-identik** (ADR-01). Segala yang berubah tiap panggilan — timestamp, UUID, hasil retrieval, jam — **tidak boleh** masuk system prompt, definisi tool, atau blok memori inti. Cache provider dicocokkan lewat hash prefix. Clock produksi harus diinjeksi dari boundary yang eksplisit, bukan dibuat di pure/core logic.
2. **Jangan pernah menyimpan instruksi sebagai memori** (ADR-07, PRD). Memori menyimpan fakta/preferensi. Semua memori tersimpan diperlakukan sebagai **data tak-tepercaya** dan dirender sebagai data, bukan instruksi.
3. **Tulisan dari model hosted masuk karantina** (ADR-07). `memory_propose`, bukan trusted write langsung. Promosi mengikuti jalur lokal/governed.
4. **Jangan hapus fakta — invalidate** (ADR-06). Gunakan temporal invalidation/supersession; retrieval aktif memfilter state invalid.
5. **Idempotency key wajib pada setiap efek samping** (ADR-12), dipaksakan di boundary runtime/tool, bukan diminta lewat prompt.
6. **Setiap panggilan model mencatat biaya aktual/kontrafaktual sesuai boundary yang tersedia** (ADR-13). Jangan membuat savings claim yang tidak didukung telemetry nyata.
7. **Gerbang sensitivitas/authority dievaluasi sebelum egress/biaya.** Tidak ada downgrade/silent fallback tersembunyi.
8. **Pin versi/model identity eksplisit** (ADR-14). Alias yang dapat drift seperti `-latest` dilarang di config/code yang diaudit.
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
- **Connect** = outbound provider/local model + optimizer + credential/spend + inbound/outbound MCP + runtime settings.
- **Context** = memory owner L0–L2 dan L3 metadata binding.
- **Sync** = pairing/self-host bridge dan public MCP bridge boundary.
- **Artifact** = content-addressed L3 bytes.
- **Sandbox** = bounded execution tiers.
- **Space** = notes/block workspace tanpa menggandakan Context source of truth.
- **Flow** = Temporal durable workflow.
- **RnD** = traces, eval foundation, dataset governance.
- **Ai** = user/operator UI; bukan authority/database owner untuk service lain.

## Konvensi kode

- TypeScript strict, ESM, Node >=22. Gunakan `import type` untuk type-only import sesuai project config.
- Nama modul internal: `Ai`, `Hub`, `Connect`, `Context`, `Sync`, `Space`, `Flow`, `Artifact`, `Sandbox`, `RnD`, `AutoClick`.
- Folder/package `kebab-case`; package npm `@ecorione/<nama>`.
- Shared schema didefinisikan sekali di `packages/shared-schema`; jangan duplikasi kontrak antar service.
- Test mengikuti struktur existing dan harus menguji owner/runtime boundary yang relevan.
- Jangan menambahkan temporary helper/workflow ke final merge tree.

## Mengubah arsitektur

Keputusan besar dicatat di `docs/DECISIONS.md`. Perubahan yang mengubah invariant, ownership, authority, durable state, security boundary, deployment contract, atau release claim membutuhkan ADR baru/updated ADR yang eksplisit.

Setelah scope selesai:

- update `docs/current-state-and-next-steps.md` bila current state berubah;
- update `docs/EXECUTION-PROGRESS.md` dengan evidence nyata;
- update operations docs yang terpengaruh;
- jangan rewrite historical verification/audit hanya untuk membuat sejarah terlihat lebih bersih.

## Yang sengaja tidak dibangun/dipaksakan

Jangan menambahkan tanpa evidence + keputusan arsitektur baru:

- semantic caching generik;
- graph database hanya karena tren;
- swarm/multi-agent orchestration tanpa kebutuhan nyata;
- durable execution engine buatan sendiri yang menduplikasi Temporal;
- microVM/vLLM sebagai dependency wajib tanpa kebutuhan hardware/use case;
- autonomous L4 claim;
- agent polling always-on;
- AutoClick/RPA generik.
