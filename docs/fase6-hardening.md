# Fase 6+ — evidence-driven hardening baseline

**Status:** ACTIVE / OPEN-ENDED · baseline 2026-09-09

Fase 6+ bukan fase yang boleh diberi label CLOSED permanen. `docs/blueprint.md` §9 mendefinisikannya sebagai perluasan operasi bisnis berdasarkan evidence pemakaian. Dokumen ini hanya mencatat hardening baseline yang dikerjakan setelah Fase 4 CLOSED dan Fase 5 sengaja deferred.

## Hardening yang sudah dilakukan

### 1. Emergency hosted-cost kill switch

PRD §22 mewajibkan kontrol biaya dengan kill switch. Baseline Fase 1 sudah mempunyai cost ledger, tetapi belum mempunyai sakelar yang benar-benar menghentikan spend hosted.

Sekarang Connect membaca:

```text
ECORIONE_COST_KILL_SWITCH=1
```

Jika aktif:

- target hosted ditolak di boundary Connect sebelum provider dipanggil;
- tidak ada silent fallback ke model lokal;
- respons HTTP Connect adalah `503` dengan type `COST_KILL_SWITCH_ACTIVE`;
- target lokal tetap dapat berjalan;
- semua caller masa kini/future yang memakai Connect ikut terkena gate yang sama.

Batas penting: ini **emergency kill switch**, bukan cumulative daily/monthly budget. Durable spend cap masih pekerjaan terpisah karena implementasi yang reset saat restart akan memberi rasa aman palsu.

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

## Gap hardening yang masih terbuka

Urutan rekomendasi berdasarkan risiko/kejujuran produk:

1. **Durable cumulative spend budget** di provider boundary; harus bertahan restart dan aman terhadap concurrent calls.
2. **External interoperability acceptance** untuk MCP HTTP melalui tunnel/HTTPS nyata, bukan hanya local/stateless protocol tests.
3. **Managed/self-host deployment recipe** untuk Temporal + seluruh service tanpa mengubah local-first default.
4. **Provider canary harian** dengan model/provider nyata dan quality floor; CI saat ini deterministic dan tidak membutuhkan kredensial eksternal.
5. **Full-history secret scan sebelum public release**; current `secret-scan` memindai working tree, bukan seluruh git history.
6. **Next.js ESLint integration warning** pada production build: build hijau, tetapi plugin Next belum diintegrasikan ke flat ESLint config.
7. **Cumulative operational metrics** per hari/tugas (cost, quality, p50/p95) agar kenaikan otonomi Fase 6+ benar-benar evidence-driven.

Tidak satu pun gap di atas dianggap selesai hanya karena ada rencana atau unit test.
