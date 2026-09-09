# Fase 6+ — evidence-driven hardening baseline

**Status:** ACTIVE / OPEN-ENDED · baseline 2026-09-09

Fase 6+ bukan fase yang boleh diberi label CLOSED permanen. `docs/blueprint.md` §9 mendefinisikannya sebagai perluasan operasi bisnis berdasarkan evidence pemakaian. Dokumen ini hanya mencatat hardening baseline yang dikerjakan setelah Fase 4 CLOSED dan Fase 5 sengaja deferred.

## Hardening yang sudah dilakukan

### 1. Emergency hosted-cost kill switch

PRD §22 mewajibkan kontrol biaya dengan kill switch. Connect membaca:

```text
ECORIONE_COST_KILL_SWITCH=1
```

Jika aktif:

- target hosted ditolak di boundary Connect sebelum provider dipanggil;
- tidak ada silent fallback ke model lokal;
- respons HTTP Connect adalah `503` dengan type `COST_KILL_SWITCH_ACTIVE`;
- target lokal tetap dapat berjalan;
- semua caller masa kini/future yang memakai Connect ikut terkena gate yang sama.

Kill switch tetap emergency control yang berbeda dari cumulative budget ADR-21.

### 2. Runtime orchestration per fase

Root package sekarang membedakan:

- `pnpm dev` — core P0;
- `pnpm dev:phase2` — core + MCP HTTP + Sync;
- `pnpm dev:phase3` — core + Artifact + Sandbox + Space;
- `pnpm dev:phase4` — Phase 3 + Flow HTTP + Flow worker.

`dev:phase4` tidak diam-diam menyediakan managed Temporal. `ECORIONE_TEMPORAL_ADDRESS` harus menunjuk Temporal yang benar-benar tersedia.

### 3. Dokumentasi dibuat sesuai state aktual

README tidak lagi mengklaim repo berhenti di Fase 1 atau memakai satu SQLite global. `.env.example` membedakan provider key development-only dari credential storage produksi/self-host.

### 4. AutoClick tidak dipaksakan

Fase 5 dicatat `DEFERRED BY DESIGN`. Tidak ada `services/autoclick/` sampai use case non-API nyata memenuhi gate ADR-11.

### 5. Production credential vault di Connect

Requirement PRD §14 bahwa raw provider credential hanya dimiliki Connect dan terenkripsi at-rest sekarang punya implementasi konkret di ADR-20:

- vault file hanya menyimpan AES-256-GCM ciphertext + metadata;
- master key 32 byte dipasok out-of-band dan tidak disimpan bersama ciphertext;
- provider + purpose + generation diikat sebagai authenticated metadata;
- provider-secret rotation menaikkan generation dan dibaca Connect tanpa restart;
- master-key rotation re-encrypt seluruh vault sebagai atomic replacement;
- wrong key, malformed vault, atau ciphertext tamper gagal tertutup;
- ketika vault aktif, raw provider key dari `.env` tidak menjadi fallback;
- administrasi credential memakai CLI operator, bukan HTTP endpoint yang memperlebar exposure raw secret.

Storage ini memenuhi requirement encryption at-rest aplikasi; ia bukan hardware-backed keystore dan tidak mengklaim melindungi secret dari OS/process yang sudah sepenuhnya dikompromikan.

### 6. Durable cumulative spend budget

ADR-21 menambahkan cumulative hosted-spend admission langsung di Connect provider boundary:

- limit daily dan monthly opsional;
- state bertahan restart di `ECORIONE_SPEND_BUDGET_PATH`;
- hosted cache-miss harus mendapat reservation sebelum provider dispatch;
- reservation/uncertain entry tetap dihitung konservatif;
- exclusive file lock + atomic replacement mencegah dua process mengadmit terhadap snapshot lama yang sama;
- provider success disettle ke actual cost;
- actual overrun tetap dicatat dan mengurangi headroom call berikutnya;
- budget exceeded menjadi `429 SPEND_BUDGET_EXCEEDED`;
- store/lock failure menjadi `503 SPEND_BUDGET_UNAVAILABLE` dan fail-closed;
- cache hit internal dan target local tidak memakai hosted spend budget.

File implementation ini ditujukan untuk single-host/self-host. Managed multi-host deployment harus mengganti storage dengan transactional shared store tanpa memindahkan admission keluar dari Connect.

## Gap hardening yang masih terbuka

Urutan rekomendasi berdasarkan risiko/kejujuran produk:

1. **External interoperability acceptance** untuk MCP HTTP melalui tunnel/HTTPS nyata, bukan hanya local/stateless protocol tests.
2. **Managed/self-host deployment recipe** untuk Temporal + seluruh service tanpa mengubah local-first default.
3. **Provider canary harian** dengan model/provider nyata dan quality floor; CI saat ini deterministic dan tidak membutuhkan kredensial eksternal.
4. **Full-history secret scan sebelum public release**; current `secret-scan` memindai working tree, bukan seluruh git history.
5. **Next.js ESLint integration warning** pada production build: build hijau, tetapi plugin Next belum diintegrasikan ke flat ESLint config.
6. **Cumulative operational metrics** per hari/tugas (cost, quality, p50/p95) agar kenaikan otonomi Fase 6+ benar-benar evidence-driven.

Roadmap platform tambahan setelah hardening baseline dicatat terpisah di blueprint: provider framework/OpenRouter, external MCP/plugin manager, native multimodal, data-refactor/rebuild, dan visual node/block runtime. Masing-masing wajib punya ADR sebelum mengubah invariant lintas service.

Tidak satu pun gap di atas dianggap selesai hanya karena ada rencana atau unit test.
