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

### 8. External MCP HTTPS acceptance

External reachability ADR-16 sekarang punya dedicated acceptance nyata, bukan hanya localhost/reverse-proxy simulation:

- Connect tetap bind loopback;
- Sync menjadi bridge yang diekspos lewat public HTTPS edge sementara;
- OAuth/JWKS juga diakses lewat public HTTPS sehingga signature/issuer/audience benar-benar melewati network boundary;
- 401/403 `WWW-Authenticate` mengiklankan Protected Resource Metadata dan scope minimum;
- `server/discover`, `tools/list`, dan `tools/call memory_search` dibuktikan end-to-end melalui HTTPS -> Sync -> Connect -> Hub;
- malformed JWT, insufficient scope, Origin terlarang, dan MCP routing-header mismatch fail closed;
- cloudflared dipin dan checksum diverifikasi;
- network/tunnel failure tetap workflow failure, bukan skip/pass.

Ini adalah **transport acceptance**, bukan klaim bahwa ecorione mengoperasikan managed public relay atau production authorization server.

### 9. Outbound MCP client + manager

ADR-23 menambahkan outbound MCP boundary di Connect tanpa membuat jalur governance kedua:

- official `@modelcontextprotocol/client@2.0.0` dipin exact;
- protocol negotiation modern/legacy diaktifkan eksplisit (`versionNegotiation.mode = "auto"`);
- Streamable HTTP wajib HTTPS kecuali explicit loopback, dan stdio command harus ada di comma-separated allowlist;
- server registry durable, workspace-scoped, atomic, mode `0600`, dan menolak secret-looking plaintext env;
- named MCP credentials disimpan terenkripsi melalui Connect Vault `mcp/tokens`;
- discovery tidak auto-enable tool; tool harus punya local enable + `ActionClass`;
- Hub tetap owner policy, approval, dan audit melalui service API;
- connection/cache partition dan side-effect identity dipisahkan per workspace;
- non-READ call membuat durable `reserved`/`uncertain`/`settled` provenance sebelum dispatch;
- known ambiguous retry ditolak sebelum reconnect/discovery, sementara atomic reserve tetap race barrier sebelum remote dispatch;
- remote success tidak dibuat retryable karena settlement/audit bookkeeping lokal gagal.

Code candidate sebelum docs lulus full CI `34357212048` dan inbound public HTTPS regression acceptance `34357212042`. Ini adalah evidence candidate, bukan closure final; exact docs head, merge, dan post-merge main verification tetap wajib. Arbitrary plugin/repository execution tetap tidak termasuk baseline ini.

## Gap hardening/platform yang masih terbuka

Urutan rekomendasi berdasarkan dependency dan risiko:

1. **Plugin/extension framework + security gate** termasuk GitHub-origin extension, manifest, pin revision, sandbox, permission, rollback.
2. **Native multimodal pipeline**: image/document first-class input, OCR, STT/TTS Indonesia+Inggris, lalu realtime voice.
3. **Data refactor/rebuild + dataset governance**: authoritative-vs-derived separation, migration, reindex/rebuild, validation, lineage/versioning.
4. **Unified capability/permission registry + Node Registry** sebagai dasar visual Flow Canvas, core node pack, custom node SDK, dan reusable subflow.
5. **Space block runtime** ala block workspace tanpa menggandakan source of truth Context/Artifact.
6. **Data maintenance center + backup/restore/disaster recovery** dengan integrity verification.
7. **Managed/self-host deployment recipe** untuk Temporal + seluruh service tanpa mengubah local-first default.
8. **Provider canary harian** dengan provider nyata dan quality floor; deterministic CI tetap external-credential-free.
9. **Full-history secret scan** sebelum public release; working-tree scan saat ini belum cukup.
10. **Next.js ESLint integration warning** pada production build.
11. **Cumulative operational metrics + distributed trace** per hari/task/provider/node (cost, quality, p50/p95, errors).
12. **ECX production efficiency validation** menggunakan traffic metrics nyata sebelum savings claim.
13. **Chaos/failure + full cross-service E2E acceptance**.
14. **Final security audit, Settings/Control Center, SDK/docs, installer/upgrade/release closure**.
15. **AutoClick/RPA** tetap conditional/deferred sampai use case non-API nyata lolos design gate.

Tidak satu pun gap dianggap selesai hanya karena ada ADR, rencana, mock, atau unit test. Setiap workstream harus lolos exact-head closure gate dan post-merge `main` smoke sebelum statusnya berubah menjadi implemented/closed baseline.
