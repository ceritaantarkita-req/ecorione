# Log keputusan

Satu baris per keputusan. Pengganti "closure verdict" formal ekosistem lama — dan
pengganti commit terpisah untuk tiap keputusan kecil, yang dulu membanjiri git history.

Keputusan yang mengubah invarian di [`../AGENTS.md`](../AGENTS.md) butuh ADR di
[`adr/`](adr/), bukan baris di sini.

| Tanggal | Keputusan | Referensi |
|---|---|---|
| 2026-09-07 | Konsolidasi ekosistem InMy jadi satu sistem bernama ecorione | `prd.md` §1 |
| 2026-09-07 | Arsitektur hybrid: local-first + sync opsional | `prd.md` §3 |
| 2026-09-07 | Prefix "InMy" dilepas dari semua nama modul | `prd.md` §19 |
| 2026-09-07 | Identitas visual: gelap sebagai identitas utama, terang putih penuh | `design.md` |
| 2026-09-07 | Toggle tema 2 opsi (Terang/Gelap); opsi "Sistem" dihapus | `design.md` §9 |
| 2026-09-07 | Riset teknis dijalankan sebelum implementasi; 15 ADR lahir dari situ | `research.md` |
| 2026-09-07 | Modul 13 → 11: Cache dilebur ke Connect, IR ke Context + Artifact | ADR-03, ADR-05 |
| 2026-09-07 | RnD naik P2 → P1 (trace store + eval harness) | `research.md` §9.1 |
| 2026-09-07 | AutoClick turun P1 → P2 (escape hatch, bukan jalur utama) | ADR-11 |
| 2026-09-07 | Sync naik jadi prasyarat pitch inti (jembatan HTTPS untuk AI hosted) | ADR-09 |
| 2026-09-08 | Brand ID pakai properti fantom, bukan `unique symbol` — `unique symbol` tidak bisa dinamai saat declaration emit (TS4023) | `packages/shared-schema/src/ids.ts` |
| 2026-09-08 | `scopes` dijaga di runtime, bukan cuma di tipe — tool MCP menerima JSON tanpa tipe | `services/context/src/retrieval.ts` |
| 2026-09-08 | Vector index punya fallback brute-force; test berjalan di jalur itu supaya tidak bergantung ekstensi | ADR-05 |
| 2026-09-08 | Fase 1 selesai: `rnd`/`context` HTTP/`connect`/`hub`/`ai` terhubung end-to-end, `pnpm dev` + `test/chat-loop.test.ts` (8 kasus emas) menguji loop sungguhan, bukan cuma unit test per service | `docs/api-fase1.md`, `test/chat-loop.test.ts` |
| 2026-09-08 | Default path DB tiap service dijangkarkan ke lokasi modul (`import.meta.dirname`), bukan `process.cwd()` — `pnpm --filter` mengubah cwd ke folder paket, default relatif-ke-cwd diam-diam mencar `data/` ke tiap `services/*/` alih-alih satu `./data/` di akar repo | `services/{rnd,context,hub}/src/main.ts` |
| 2026-09-08 | `better-sqlite3` tidak membuat direktori induk sendiri — tiap `openXDatabase` sekarang `mkdirSync(dirname(path), {recursive:true})` sebelum membuka, supaya `pnpm dev` di clone baru tidak crash karena `./data/` belum ada | `services/{rnd,context,hub}/src/db.ts` |
| 2026-09-08 | Import relatif produksi di `apps/ai` tidak boleh pakai akhiran `.js` — `tsc`/vitest (resolusi `bundler`) menerimanya, tapi webpack `next dev` tidak bisa meresolusinya sama sekali (beda dari NodeNext di paket/service lain, yang mewajibkan `.js`) | `apps/ai/{app,lib}/**` |
| 2026-09-08 | `Hub POST /v1/memory/forget` membedakan Context menjawab 4xx (fakta tidak ada/sudah di-invalidate — diteruskan apa adanya) dari Context sungguhan tidak bisa dihubungi (tetap 502 UPSTREAM_UNAVAILABLE) — sebelumnya keduanya disamakan jadi 502, menyesatkan pengguna yang mengklik "lupakan" pada fakta yang sudah lupa | `services/hub/src/http.ts` (`forwardOrUpstreamError`) |
| 2026-09-08 | Model bisnis: open core. Ai/Hub/Connect/Context/RnD (semua modul Fase 1) MIT selamanya; Sync/Space/Flow/Sandbox (belum dibangun) kandidat tier berbayar di repo privat terpisah, tidak pernah masuk repo publik ini | `docs/LICENSING.md` |
| 2026-09-08 | Rencana Fase 2 ditulis sebelum implementasi (gaya sama dengan `api-fase1.md`): server MCP (Connect inbound, stdio dulu baru HTTP) + Sync (relay device + jembatan HTTPS). Reachability publik Sync sengaja belum diputuskan — butuh ADR-0016 sebelum kode `services/sync` ditulis | `docs/fase2.md` |
| 2026-09-08 | Cetak biru lengkap Fase 0–6+ ditulis satu dokumen supaya AI mana pun yang lanjut mengerjakan repo ini tidak perlu histori percakapan — per-fase: modul yang dibangun, urutan, keputusan wajib (mesin durable execution Flow, dll), kriteria selesai | `docs/blueprint.md` |
| 2026-09-09 | Reachability Sync Fase 2 v1 memakai tunnel pihak ketiga/self-hosted bridge; Connect dan Sync bridge tetap loopback. Kontrak lokal tetap transport-agnostik agar relay terkelola dapat ditambah kemudian tanpa mengubah format lokal | ADR-16 |
| 2026-09-09 | Batas lisensi Sync diperjelas: protocol/client/bridge lokal self-hosted adalah MIT; hanya managed public relay/cloud yang kandidat private/paid. Ini menggantikan baris 2026-09-08 yang terlalu luas memasukkan seluruh Sync ke kandidat privat | `docs/LICENSING.md`, ADR-16 |
| 2026-09-09 | Connect inbound memakai MCP 2026-07-28 stateless dengan lima tool memory; seluruh tool lewat Hub, data memory tetap untrusted, dan tulisan hosted selalu quarantine | `docs/api-fase2.md`, ADR-09 |
| 2026-09-09 | CI closure diperketat: selain format/lint/typecheck/test/secret-scan, production build seluruh project references + Next.js Ai wajib lolos sebelum fase ditutup | `.github/workflows/ci.yml` |
| 2026-09-09 | Artifact Fase 3 dedup satu blob fisik berdasarkan SHA-256, tetapi binding klasifikasi tetap terpisah; scope/sensitivity/syncClass tidak boleh terangkat atau tertimpa hanya karena bytes identik | `docs/api-fase3.md`, `services/context/src/artifact-routes.ts` |
| 2026-09-09 | Space v1 memakai route `/space` di app Ai yang sama, sementara backend dan DB notes tetap service Space terpisah. Core memory L2 tidak disalin ke Space; editor menulis endpoint Context yang sama | `docs/api-fase3.md`, `services/space/` |
| 2026-09-09 | Batas lisensi Fase 3 mengikuti prinsip open-core: backend self-hosted Artifact/Space/Sandbox yang sudah dirilis di repo publik tetap MIT; hanya layanan managed/advanced yang dapat menjadi kandidat komersial | `docs/LICENSING.md` |
| 2026-09-09 | Fase 3 final strict closure adalah run 34301124513 pada commit `6117e8a528b52aef2351dd63b45b1fd980a8dc74`; run 34300859602 adalah runtime evidence sebelumnya, bukan final frozen/read-only gate | `docs/api-fase3.md`, `.github/workflows/ci.yml` |
| 2026-09-09 | Flow Fase 4 memilih Temporal self-hosted; SDK TypeScript dipin `1.23.0`. Flow tidak membuat scheduler/database durability kedua; timer, retry, signal, state, dan worker recovery berada di Temporal | ADR-17, `docs/api-fase4.md` |
| 2026-09-09 | Flow approval selalu commit ke Hub sebelum Temporal signal; execution diverifikasi dari RnD trace independen dan mismatch gagal non-retryable | `services/flow/src/{http,workflows,activities}.ts` |
| 2026-09-09 | Candidate runtime Fase 4 lulus forced worker crash/replacement + Hub/Connect/Sandbox/RnD vertical slice pada run 34304296140, 51 files / 328 tests | `test/phase4-temporal-runtime.test.ts`, `docs/api-fase4.md` |
| 2026-09-09 | Fase 4 CLOSED setelah strict code run `34304885390`; docs closure HEAD kemudian juga lulus strict run `34305530219` dengan frozen lockfile, format read-only, lint, typecheck, forced recovery tests, secret scan, dan production build | `docs/api-fase4.md`, `.github/workflows/ci.yml` |
| 2026-09-09 | Fase 5 AutoClick DEFERRED BY DESIGN karena belum ada use case non-API konkret; membuat runtime RPA generik sekarang akan melanggar ADR-11 dan PRD §24.10 | `docs/fase5.md`, ADR-11 |
| 2026-09-09 | Fase 6+ hardening menambahkan `ECORIONE_COST_KILL_SWITCH=1` di boundary Connect untuk memblokir target hosted tanpa silent fallback; ini emergency switch, bukan cumulative spend budget | `services/connect/src/{complete,http,main}.ts`, `.env.example` |
| 2026-09-09 | Runtime orchestration diperjelas: `pnpm dev` tetap core P0; `dev:phase2`, `dev:phase3`, dan `dev:phase4` tersedia untuk stack bertahap. Flow tetap membutuhkan Temporal eksternal/localhost yang eksplisit | `package.json`, `README.md` |
| 2026-09-09 | Connect production/self-host credential storage memakai AES-256-GCM file vault dengan master key out-of-band; vault menjadi source authoritative ketika aktif dan raw provider key `.env` tetap dev-only | ADR-20, `services/connect/src/credential-vault.ts` |
| 2026-09-09 | Hosted cumulative spend memakai durable pre-dispatch reservation di Connect; daily/monthly state bertahan restart, process concurrency diserialisasi, ambiguous failure tetap dihitung konservatif | ADR-21, `services/connect/src/spend-budget.ts` |
| 2026-09-09 | Connect hosted provider framework mendukung Anthropic/OpenRouter/OpenAI dengan provider-scoped vault, explicit pinned model mapping, provider-aware cache/spend accounting; OpenRouter `usage.cost` dipakai sebagai billed actual cost ketika valid; local inference memakai OpenAI-compatible runtime sehingga Ollama bukan dependency wajib | ADR-22, `services/connect/src/{provider-types,complete}.ts`, `services/connect/src/providers/` |
| 2026-09-09 | MCP external reachability dibuktikan lewat public HTTPS tunnel nyata dengan Connect tetap loopback, Sync sebagai bridge, public OAuth/JWKS, Protected Resource Metadata discovery, scoped Bearer challenge, dan negative-path fail-closed; Quick Tunnel hanya acceptance transport, bukan managed relay ecorione | ADR-16, `docs/verification/mcp-external-https-2026-09-09.md` |
