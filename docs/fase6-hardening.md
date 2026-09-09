# Fase 6+ — evidence-driven hardening baseline

**Status:** ACTIVE / OPEN-ENDED · baseline 2026-09-09

Fase 6+ bukan fase yang boleh diberi label CLOSED permanen. `docs/blueprint.md` §9 mendefinisikannya sebagai perluasan operasi bisnis berdasarkan evidence pemakaian. Dokumen ini hanya mencatat hardening baseline yang dikerjakan setelah Fase 4 CLOSED dan Fase 5 sengaja deferred.

## Hardening yang sudah dilakukan

### 1. Emergency hosted-cost kill switch

Connect membaca `ECORIONE_COST_KILL_SWITCH=1`. Jika aktif, target hosted ditolak di boundary Connect sebelum provider dipanggil; tidak ada silent fallback ke local; HTTP mengembalikan `503 COST_KILL_SWITCH_ACTIVE`; target local tetap berjalan. Kill switch adalah emergency control yang berbeda dari cumulative budget ADR-21.

### 2. Runtime orchestration per fase

Root package membedakan `pnpm dev`, `dev:phase2`, `dev:phase3`, dan `dev:phase4`. Flow tetap membutuhkan Temporal nyata melalui `ECORIONE_TEMPORAL_ADDRESS`; runtime tidak diam-diam menyediakan managed Temporal.

### 3. Dokumentasi sesuai state aktual

README, env example, API docs, ADR, decision log, dan hardening docs harus mengikuti implementasi nyata. Klaim production hanya boleh mengikuti evidence closure gate.

### 4. AutoClick tidak dipaksakan

Fase 5 tetap `DEFERRED BY DESIGN`. Tidak ada `services/autoclick/` sampai use case non-API nyata memenuhi ADR-11.

### 5. Production credential vault di Connect

ADR-20 menyediakan AES-256-GCM file vault, master key out-of-band, provider/purpose scope, provider-secret rotation, master-key rotation, atomic replacement, tamper/wrong-key fail-closed, dan CLI operator. Ketika vault aktif, raw provider key dari env tidak menjadi fallback.

### 6. Durable cumulative spend budget

ADR-21 menambahkan daily/monthly hosted spend budget di Connect provider boundary. State bertahan restart, reservation dibuat sebelum provider dispatch, uncertain reservation tetap dihitung konservatif, writer diserialisasi dengan exclusive lock + atomic replacement, dan actual overrun tetap tersimpan. Budget exceeded menjadi `429 SPEND_BUDGET_EXCEEDED`; store/lock failure menjadi `503 SPEND_BUDGET_UNAVAILABLE`.

Implementation file ditujukan untuk single-host/self-host. Managed multi-host deployment harus memakai transactional shared store tanpa memindahkan admission keluar dari Connect.

### 7. Provider framework + OpenRouter/OpenAI + local runtime abstraction

ADR-22 memperluas Connect tanpa memindahkan provider boundary:

- hosted provider baseline: `anthropic`, `openrouter`, `openai`;
- provider dipilih secara eksplisit lewat process configuration, bukan model output;
- Credential Vault tetap provider-scoped (`<provider>/messages`);
- cache key memasukkan provider identity;
- spend reservation mencatat provider dan berlaku pada semua hosted provider;
- OpenRouter/OpenAI memakai explicit pinned mapping; alias/auto-router yang dapat drift tetap dilarang;
- OpenRouter provider-reported `usage.cost` menjadi actual billed cost untuk ledger dan spend settlement ketika tersedia; malformed billed cost fail-closed;
- OpenAI direct memakai pinned GPT-5.6 identity yang ada di pricing snapshot;
- local runtime memakai contract `openai-compatible`, sehingga Ollama hanyalah salah satu implementation dan bukan dependency arsitektural wajib;
- tidak ada silent fallback antar-provider atau hosted→local.

Pricing snapshot tetap evidence yang harus diverifikasi ulang sebelum public billing/savings claim.

## Gap hardening/platform yang masih terbuka

Urutan rekomendasi berdasarkan dependency dan risiko:

1. **External MCP acceptance** melalui tunnel/HTTPS nyata, bukan hanya local/stateless protocol tests.
2. **Outbound MCP client/manager** untuk memasang dan mengelola MCP eksternal dengan permission/capability scope.
3. **Plugin/extension framework + security gate** termasuk GitHub-origin extension, manifest, pin revision, sandbox, permission, rollback.
4. **Native multimodal pipeline**: image/document first-class input, OCR, STT/TTS Indonesia+Inggris, lalu realtime voice.
5. **Data refactor/rebuild + dataset governance**: authoritative-vs-derived separation, migration, reindex/rebuild, validation, lineage/versioning.
6. **Unified capability/permission registry + Node Registry** sebagai dasar visual Flow Canvas, core node pack, custom node SDK, dan reusable subflow.
7. **Space block runtime** ala block workspace tanpa menggandakan source of truth Context/Artifact.
8. **Data maintenance center + backup/restore/disaster recovery** dengan integrity verification.
9. **Managed/self-host deployment recipe** untuk Temporal + seluruh service tanpa mengubah local-first default.
10. **Provider canary harian** dengan provider nyata dan quality floor; deterministic CI tetap external-credential-free.
11. **Full-history secret scan** sebelum public release; working-tree scan saat ini belum cukup.
12. **Next.js ESLint integration warning** pada production build.
13. **Cumulative operational metrics + distributed trace** per hari/task/provider/node (cost, quality, p50/p95, errors).
14. **ECX production efficiency validation** menggunakan traffic metrics nyata sebelum savings claim.
15. **Chaos/failure + full cross-service E2E acceptance**.
16. **Final security audit, Settings/Control Center, SDK/docs, installer/upgrade/release closure**.
17. **AutoClick/RPA** tetap conditional/deferred sampai use case non-API nyata lolos design gate.

Tidak satu pun gap dianggap selesai hanya karena ada ADR, rencana, mock, atau unit test. Setiap workstream harus lolos exact-head closure gate dan post-merge `main` smoke sebelum statusnya berubah menjadi implemented/closed baseline.
