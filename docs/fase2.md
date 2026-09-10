# Fase 2 — Server MCP (Connect inbound) + Sync

Status: **draft v1.0** — 2026-09-08. Ditulis sebelum implementasi, gaya sama dengan
`docs/api-fase1.md`: kontrak dulu, supaya siapa pun (manusia atau AI lain) yang
mengerjakan ini tidak perlu menebak bentuk request/respons. Pasangan:
`docs/prd.md` §7 (Connect, Sync), §9 (arsitektur), §14 (keamanan), §15 (local-first
hybrid), §16 (MCP), §23 (roadmap), `docs/research.md` §4 (MCP lengkap), ADR-09.

> **HISTORICAL PLANNING NOTICE — 2026-09-10:** Fase 2 sudah diimplementasikan dan ditutup. Dokumen ini dipertahankan sebagai rencana pra-implementasi, bukan daftar pekerjaan aktif. Kontrak implementasi ada di `api-fase2.md`; current overall state ada di `current-state-and-next-steps.md` dan `EXECUTION-PROGRESS.md`. Jangan membangun ulang item di dokumen ini hanya karena status header historis masih menyebut draft.

## 0. Cara pakai dokumen ini

Kalau kamu (manusia atau AI) baru pertama kali buka repo ini: **jangan mulai dari
sini.** Baca dulu, dalam urutan ini:

1. `README.md` — apa ecorione, status saat ini.
2. `AGENTS.md` — aturan yang tidak bisa dinegosiasikan (nomor 1–10). **Setiap
   aturan di situ berlaku penuh di Fase 2, tidak ada pengecualian.**
3. `docs/api-fase1.md` — kontrak HTTP yang sudah jalan (Ai/Hub/Connect/Context/RnD).
   Fase 2 **menambah** ke ini, tidak mengubah kontrak yang sudah ada, kecuali
   disebutkan eksplisit di §4 dokumen ini.
4. `docs/DECISIONS.md` — histori keputusan, satu baris per baris.

Dokumen ini mengasumsikan kamu sudah paham keempatnya. Kalau ada istilah yang tidak
dijelaskan di sini (`ActionRequest`, `Scope`, `Sensitivity`, `Trust`, dst) — cari di
`packages/shared-schema/src/*.ts`, semuanya sudah didefinisikan dan diuji, jangan
didefinisikan ulang.

## 1. Apa yang sudah ada, apa yang Fase 2 tambahkan

**Sudah jalan (Fase 1, jangan diubah kecuali disebut eksplisit):** `apps/ai` ↔
`services/hub` ↔ `services/context` + `services/connect` (outbound saja) +
`services/rnd`. Loop chat lokal end-to-end, 285 test, `pnpm verify` hijau. Lihat
`README.md` §Status.

**Fase 2 menambah dua kemampuan baru** (`prd.md` §23, baris roadmap Fase 2):

- **Connect inbound** — server MCP. ecorione jadi bisa dipanggil sebagai *tool* dari
  Claude Code, Claude.ai, ChatGPT, Cursor, VS Code.
- **Sync** — modul baru (belum ada baris kode sama sekali). Dua tanggung jawab:
  (a) relay data `SYNC_ENCRYPTED` lintas device milik pengguna yang sama, (b)
  jembatan HTTPS supaya server MCP Connect bisa dijangkau asisten hosted (yang
  tidak bisa menjangkau `localhost`).

**Kenapa dua hal ini satu fase, bukan dipisah:** server MCP lewat `stdio` (untuk
Claude Code/Cursor/VS Code, klien yang jalan di mesin yang sama) **tidak butuh**
Sync sama sekali — itu bisa dan **harus** dibangun serta diuji duluan. Tapi begitu
targetnya Claude.ai atau ChatGPT (yang butuh URL HTTPS publik — `research.md` §4.3
poin 3), server MCP itu tidak bisa dijangkau tanpa Sync. Sync tanpa server MCP
Connect tidak ada tool untuk direlay. Keduanya couple di titik itu, itu sebabnya satu
fase — tapi **urutan build di dalamnya tetap linear**, lihat §6.

## 2. Keputusan yang HARUS diambil sebelum menulis kode Sync

`prd.md` §25 poin 1 sudah menandai ini sebagai risiko produk tersulit di seluruh
proyek, dan `research.md` §4.3 poin 3 menyatakan eksplisit: **tidak ada fitur
protokol yang menghapus masalah ini.** Ini bukan detail implementasi — ini butuh
keputusan produk sebelum baris kode pertama `services/sync` ditulis. Kalau kamu AI
yang mengerjakan ini dan pertanyaan ini belum dijawab manusia, **berhenti dan
tanya**, jangan menebak.

Mesin lokal pengguna tidak punya IP publik/port terbuka secara default. Server MCP
Connect butuh dijangkau lewat HTTPS publik. Tiga cara nyata untuk itu, dengan
trade-off:

| Opsi | Cara kerja | Plus | Minus |
|---|---|---|---|
| **A. Tunnel pihak ketiga** (Cloudflare Tunnel, ngrok, dst) | Pengguna jalankan tunnel sendiri, arahkan ke Sync lokal | Nol infra dikelola ecorione, murni local-first | Setup manual, tergantung layanan pihak ketiga, UX buruk untuk pengguna awam |
| **B. Relay yang dioperasikan ecorione** | Sync lokal **membuka koneksi keluar** (bukan port masuk) ke relay milik ecorione; relay cuma neruskan byte terenkripsi, tidak pernah lihat isi | UX terbaik, tidak perlu buka port/DNS, cocok jadi produk | Ecorione sekarang punya infra untuk dioperasikan & dibiayai — **ini pas jadi kandidat tier berbayar di `docs/LICENSING.md`**, bukan kebetulan |
| **C. Expose langsung** (port-forward + dynamic DNS + TLS sendiri) | Pengguna urus router & sertifikat sendiri | Paling "murni" local-first | Beban dukungan tertinggi, hampir tidak ada pengguna non-teknis yang akan berhasil |

**Rekomendasi kerja (bukan keputusan final — butuh ADR):** bangun **Opsi A** dulu
sebagai jalur v1 yang bisa dites & dipakai sekarang (dokumentasikan sebagai
"self-hosted bridge" di README, konsisten dengan nada jujur proyek ini), sambil
mendesain Sync API-nya supaya **Opsi B bisa ditambahkan nanti tanpa mengubah
kontrak** — Sync lokal cukup butuh satu koneksi keluar yang dipertahankan (long-lived
HTTP/WebSocket), tidak peduli ujung satunya tunnel pihak ketiga atau relay
ecorione sendiri. Ini juga yang membuat Opsi B, kalau nanti dibangun, otomatis
menjadi bagian repo **privat** terpisah (`docs/LICENSING.md`), bukan kode di repo
publik ini — repo publik cukup tahu cara *bicara* ke sebuah relay, tidak perlu tahu
cara *menjadi* satu.

**Sebelum kode Sync ditulis:** buat `docs/adr/0016-sync-reachability.md` yang
mengunci pilihan ini dengan konteks → keputusan → konsekuensi, seperti 15 ADR
lainnya. Jangan mulai `services/sync/src/` sebelum ADR itu ada.

## 3. Bagian A — Connect inbound: server MCP

### 3.1 Lokasi & struktur baru

Menambah ke `services/connect` yang sudah ada (bukan service baru — Connect
memang "gerbang dua arah" per `prd.md` §6):

```
services/connect/src/mcp/
  server.ts        # entry: bootstrap MCP server, daftar tools, transport
  discover.ts       # implementasi server/discover (WAJIB, spec 2026-07-28)
  tools.ts          # 5 tool handler: memory_search/get/propose/recent/open
  auth.ts           # stack auth untuk transport HTTP (§3.5) — tidak dipakai stdio
  handle.ts         # pencetak & validasi handle (requestState AEAD, §3.6)
```

Env baru (**sudah dicadangkan** di `.env.example`, belum dipakai kode manapun):
`ECORIONE_MCP_HOST=127.0.0.1`, `ECORIONE_MCP_PORT=17010`.

### 3.2 `server/discover` — wajib, spec 2026-07-28

RPC ini menghapus handshake `initialize` lama. Balasannya mengumumkan versi
protokol, kapabilitas (`tools` saja — **tidak** `sampling`/`roots`/`logging`,
`research.md` §4.1), dan identitas server (`"ecorione-connect"`, versi dari
`package.json`).

### 3.3 Lima tool — permukaan sengaja kecil (`prd.md` §7, ADR-09)

Semua tool call, **dari asisten manapun**, wajib lewat Hub — bukan langsung ke
Context. Alasan: Hub adalah "penjaga otorisasi" tunggal (`AGENTS.md` §Arsitektur
singkat), dan setiap akses memori dari luar mesin **harus** masuk `audit_events`
serta digerbang `policy-engine.ts` yang sudah ada — MCP call dari model hosted
bukan pengecualian, itu justru kasus yang paling butuh audit trail (ADR-07: tulisan
model hosted tidak dipercaya begitu saja).

Ini berarti **Hub butuh endpoint baru** sebelum tool MCP bisa jalan:

- `POST /v1/mcp/memory/search` — body `{ query, scopes, k?, maxSensitivity? }` →
  proxy ke `POST {Context}/v1/retrieve` **setelah** `evaluatePolicy` (`actionClass:
  "READ"`) dan catat `AuditEvent` (`type: "MCP_TOOL_CALLED"` — baris baru di enum
  `AuditEvent.type`, `packages/shared-schema/src/policy.ts` atau file terkait —
  **jangan** pakai ulang `"ACTION_REQUESTED"` untuk ini, ini butuh terlihat beda di
  audit log dari aksi Ai biasa).
- `POST /v1/mcp/memory/get` — body `{ factId | episodeId }` → proxy ke Context yang
  sesuai (`GET /v1/facts?...` atau baca satu episode — Context saat ini tidak punya
  `GET /v1/episodes/:id`, **perlu ditambah** kalau `memory_get` harus bisa ambil
  episode tunggal, bukan cuma fakta).
- `POST /v1/mcp/memory/propose` — body `{ text, scope, sourceApp }` → **wajib**
  masuk karantina (ADR-07): panggil `POST {Context}/v1/facts/propose` dengan
  `trust: "HOSTED_AGENT"` (bukan `LOCAL_AGENT` — beda sumber, beda level
  kepercayaan, `packages/shared-schema/src/classification.ts` sudah punya rank-nya),
  **tidak pernah** `promote` otomatis dari jalur ini.
- `GET /v1/mcp/memory/recent` — body/query `{ scopes, limit? }` → proxy ke
  `GET {Context}/v1/episodes`.
- `POST /v1/mcp/memory/open` — body `{ artifactPointer }` → proxy ke Artifact
  (**belum ada di Fase 1/2** — kalau dipanggil sebelum Artifact dibangun, balas 501
  eksplisit dengan pesan "Artifact belum tersedia", **jangan** 500 generik atau
  respons kosong yang terlihat sukses).

`allowlist scope` per sesi MCP (`prd.md` §14) disimpan di mana handle MCP itu
dicetak (§3.6) — bukan di Hub secara global — supaya satu sesi Claude.ai yang
diizinkan scope `work` tidak bisa diam-diam membaca scope `personal`.

### 3.4 Transport: stdio dulu, baru Streamable HTTP

**Bangun & uji stdio duluan.** Tidak butuh auth stack (klien di mesin yang sama —
`research.md` tabel §4.2, kolom Claude Code/Cursor/VS Code), tidak butuh Sync,
dan langsung bisa dites manual dengan Claude Code hari itu juga. Ini juga urutan
yang ditegaskan ADR-09 ("server MCP dulu").

**Streamable HTTP** (POST-only, satu endpoint, `research.md` §4.1) baru setelah
stdio jalan dan diuji. Ini yang dipakai lewat Sync untuk Claude.ai/ChatGPT.
HTTP+SSE lama **dideprecate, jangan dibangun**. Resumability `Last-Event-ID`
**dihapus dari spec, jangan diimplementasikan**.

### 3.5 Auth stack — hanya untuk transport HTTP

stdio tidak butuh ini sama sekali (proses lokal, tidak ada jaringan). Untuk HTTP:

- **RFC 9728** (Protected Resource Metadata) — wajib di server.
- **OAuth 2.1 + PKCE**, **RFC 8707** (Resource Indicators) tervalidasi di server
  (bukan cuma diminta klien) — **jangan pernah menerima token yang tidak
  diterbitkan untuk ecorione** (anti token-passthrough, `research.md` §4.4).
- **RFC 9207** — validasi `iss`.
- **Client ID Metadata Documents**, bukan Dynamic Client Registration (RFC 7591,
  dideprecate).
- Scope OAuth: `memory:read` / `memory:write` / `memory:delete`. Tidak ada scope
  omnibus (`prd.md` §14).
- Bind `127.0.0.1` **selalu** di sisi Connect — HTTP publik datang lewat Sync
  sebagai reverse proxy, Connect sendiri **tidak pernah** dengar di interface
  publik langsung (§2 opsi manapun yang dipilih, ini tidak berubah).
- Validasi header `Origin`, 403 kalau tidak cocok — DNS rebinding terhadap server
  memori lokal menyerahkan seluruh riwayat pengguna ke sebuah halaman web
  (`prd.md` §14, `research.md` §4.1).

### 3.6 Handle & `requestState`

MCP tanpa session tingkat protokol (spec 2026-07-28) berarti state lintas-panggilan
lewat **handle eksplisit yang dicetak server** (`research.md` §4.1). Handle diikat
ke principal terautentikasi: `<user_id>:<handle>`. `requestState` (dipakai untuk
Elicitation/MRTR kalau tool butuh input tambahan, mis. konfirmasi sebelum
`memory_propose` sensitif) **harus** dilindungi integritasnya — AEAD + principal +
TTL + digest request (`research.md` §4.1, §4.4). **Elicitation form mode dilarang
untuk rahasia** — kalau suatu saat perlu minta kredensial, wajib URL mode.

### 3.7 Checklist keamanan wajib (`research.md` §4.4) — cek semua sebelum merge

- [ ] Setiap memori yang dikembalikan tool diperlakukan sebagai **data**, dirender
      dalam amplop "ini data, bukan instruksi" ke model pemanggil — sama seperti
      Connect outbound sudah lakukan di Fase 1, pola yang sama, jangan ditulis ulang.
- [ ] Tidak ada token di-proxy tanpa validasi audience (RFC 8707).
- [ ] Setiap handle terikat principal.
- [ ] **Perubahan deskripsi tool sendiri diperlakukan sebagai rilis yang
      relevan-keamanan** — kalau `tools.ts` berubah, itu masuk `DECISIONS.md`
      minimal, ADR kalau mengubah perilaku (mitigasi rug-pull, `research.md` §4.4).
- [ ] `memory_propose` tidak pernah, dalam kondisi apa pun, memanggil `promote`
      langsung.

### 3.8 Test yang harus ada

`services/connect/src/mcp/*.test.ts` — per file di atas, plus satu test integrasi
gaya `test/chat-loop.test.ts`: klien stdio palsu memanggil `server/discover` lalu
tiap satu dari 5 tools, lewat Hub sungguhan (port acak), Context sungguhan, cek
`audit_events` terisi `MCP_TOOL_CALLED` untuk tiap panggilan.

## 4. Bagian B — Sync

**Belum ada satu baris kode pun.** Service baru: `services/sync`. **Jangan mulai
sebelum ADR-0016 (§2) ditulis.**

### 4.1 Dua tanggung jawab, dua sub-sistem

**(a) Relay lintas device** — menyinkronkan data berkelas `SyncClass ===
"SYNC_ENCRYPTED"` (sudah didefinisikan & diuji di
`packages/shared-schema/src/classification.ts`, fungsi `mayLeaveDevice` sudah ada
— pakai ulang, jangan tulis ulang) antar device milik user yang sama. `DeviceId`
(prefix `dev`) sudah ada di `packages/shared-schema/src/ids.ts` — belum dipakai di
mana pun, ini tempatnya.

Minimal v1: registrasi device (pairing — butuh keputusan UX: QR code? kode angka
manual? di luar cakupan dokumen ini, tulis ADR terpisah kalau perlu), lalu
push/pull encrypted blob antar device terdaftar. **Enkripsi end-to-end di sisi
klien** — Sync (dan relay-nya, opsi manapun dari §2) tidak pernah punya kunci
untuk membaca isi yang direlay, cuma meneruskan byte. Ini bukan opsional: kalau
Sync bisa membaca isinya, `SyncClass` jadi tidak berarti apa-apa secara keamanan.

**(b) Jembatan HTTPS untuk server MCP** — Sync membuka endpoint HTTPS publik
(bentuknya tergantung opsi §2 yang dipilih) yang mem-*forward* request Streamable
HTTP ke `services/connect` yang bind `127.0.0.1` saja. Sync **tidak**
mengimplementasikan ulang logika MCP — ia murni reverse-proxy + auth-termination
untuk request masuk, meneruskan yang sudah tervalidasi ke Connect.

### 4.2 Batas privasi harus terlihat pengguna (`prd.md` §15)

Default **`LOCAL_ONLY`** (`DEFAULT_SYNC_CLASS`, sudah ada di kode). Data keluar
mesin **hanya** lewat pilihan eksplisit pengguna — tidak pernah karena field lupa
diisi. `apps/ai` perlu UI untuk ini di Fase 2 atau Fase 3 (belum ditentukan mana —
**ini keputusan scope terbuka, tanyakan ke pengguna sebelum membangun UI-nya**,
dokumen ini cuma menjamin backend Sync menghormati flag yang sudah ada).

### 4.3 Test yang harus ada

- Unit: pairing device, push/pull blob terenkripsi, penolakan blob dari device
  tidak terdaftar.
- Integrasi: `services/connect` (stdio-only, in-process) dipanggil lewat
  Streamable HTTP **lewat** Sync (port acak, mensimulasikan opsi §2 sebagai
  reverse proxy langsung tanpa tunnel sungguhan — tunnel pihak ketiga sungguhan
  di luar cakupan test otomatis, catat itu di komentar test).

## 5. Urutan build — linear, jangan diloncat

1. **ADR-0016** (§2) — kunci pendekatan reachability Sync.
2. **Connect inbound, transport stdio** (§3.1–3.3, §3.8 minus bagian HTTP) —
   bisa dites dengan Claude Code asli hari itu juga, tidak butuh apa pun dari
   langkah lain.
3. **Hub: endpoint `/v1/mcp/memory/*`** (§3.3) — prasyarat untuk langkah 2 bisa
   benar-benar memanggil sesuatu, jadi dalam praktiknya dikerjakan bersamaan
   dengan langkah 2, bukan setelahnya.
4. **Connect inbound, auth stack + transport HTTP** (§3.4–§3.6).
5. **Sync — sub-sistem (b) jembatan HTTPS dulu** (lebih sederhana, dan langkah 4
   butuh sesuatu untuk mem-forward-nya supaya bisa diuji ujung ke ujung).
6. **Sync — sub-sistem (a) relay lintas device.**
7. **Suite regresi RnD naik ke 30–40 kasus** (§6).
8. **`docs/api-fase2.md`** — tulis kontrak final (gaya `api-fase1.md`) dari apa
   yang *benar-benar* dibangun, bukan dari dokumen ini — dokumen ini adalah
   rencana sebelum kode, `api-fase2.md` adalah kebenaran sesudahnya, persis
   seperti hubungan `api-fase1.md` ke Fase 1.
9. Update `README.md` §Status, `docs/DECISIONS.md`, jalankan `pnpm verify`.

## 6. Suite regresi RnD — 30–40 kasus (`prd.md` §21.2, batas keras 50)

Fase 1 punya 8 kasus emas (`test/chat-loop.test.ts`) untuk loop chat. Fase 2
menambah kasus untuk permukaan baru — perkiraan pembagian (sesuaikan saat
implementasi, angka totalnya yang mengikat, bukan pembagiannya):

- ~8 kasus MCP tools (satu per tool minimal, plus jalur error: scope ditolak,
  sensitivity ditolak, propose masuk karantina bukan langsung promote).
- ~6 kasus Sync (pairing sukses/gagal, relay blob terenkripsi, penolakan device
  asing, jembatan HTTPS meneruskan request valid, menolak request tanpa auth).
- ~8 kasus canary harian (`prd.md` §21.2 — deteksi provider menukar model di
  balik alias; **baru masuk cakupan Fase 2** kalau RnD belum punya canary set,
  cek dulu sebelum menulis ulang).
- Sisanya dari kasus Fase 1 yang sudah ada (8) tetap dihitung ke total.

**Jangan lewati 50** — `prd.md` §21.2 membatasi ini keras supaya suite tetap bisa
dijalankan tiap commit, bukan jadi beban yang dihindari.

## 7. Kriteria "selesai" — jangan ulangi kesalahan `prd.md` §24 poin 2

"Test-nya lulus" bukan "selesai". Sesuai standar yang sama dipakai Fase 1
(`README.md` §Status): sebuah bagian Fase 2 selesai kalau **bisa dipakai
end-to-end**, dibuktikan lewat pemakaian sungguhan, bukan cuma test hijau:

- **Connect inbound stdio**: Claude Code asli (bukan simulasi) berhasil memanggil
  ke-5 tool lewat sesi sungguhan, hasilnya benar, audit log tercatat.
- **Connect inbound HTTP + Sync jembatan**: satu klien HTTP asli (bisa `curl`
  dengan token OAuth yang diperoleh manual dulu, tidak harus Claude.ai
  sungguhan) berhasil memanggil lewat endpoint publik Sync, sampai ke Connect,
  sampai ke Hub, sampai ke Context, dan balik.
- **Sync relay**: dua proses Sync (mensimulasikan dua device) benar-benar
  bertukar blob terenkripsi lewat relay/tunnel yang dipilih di ADR-0016 — bukan
  cuma unit test fungsi enkripsi.

## 8. Eksplisit TIDAK termasuk Fase 2

Supaya tidak ada scope creep atau kebingungan — ini semua **Fase 3+**
(`prd.md` §23), jangan disentuh di Fase 2: **Space** (workspace/editor), **Flow**
(workflow engine), **Artifact** (CAS penuh — `memory_open` boleh balas 501 dulu,
lihat §3.3), **Sandbox** (eksekusi terisolasi), **AutoClick** (RPA). MCP sebagai
**klien** (ingest dari filesystem/git/dll, `prd.md` §16) juga bukan Fase 2 — Fase
2 cuma server MCP (inbound).

## 9. Referensi

`docs/prd.md` §7 (Connect, Sync), §9, §14, §15, §16, §23 · `docs/research.md` §4
(lengkap) · `docs/adr/0009-mcp-server-first.md` · `docs/adr/0007-quarantine.md`
(untuk `memory_propose`) · `docs/api-fase1.md` (kontrak yang sudah jalan, jangan
diubah tanpa alasan eksplisit) · `AGENTS.md` (aturan tidak bisa dinegosiasikan) ·
`packages/shared-schema/src/classification.ts` (`SyncClass`, `Sensitivity`,
`Trust` — semua sudah ada, pakai ulang) · `packages/shared-schema/src/ids.ts`
(`DeviceId` sudah ada, belum dipakai).
