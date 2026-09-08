# ecorione — Cetak biru lengkap: Fase 0 sampai Fase 6+

Status: **v1.0** — 2026-09-08. Ini dokumen tunggal yang menjelaskan **seluruh** rencana
build ecorione dari awal sampai konsep produk selesai — bukan cuma fase berikutnya.
Ditulis supaya siapa pun (manusia atau AI lain — ChatGPT, dst) yang membuka repo ini
tanpa histori percakapan sebelumnya tetap tahu persis apa yang sedang dan akan dibangun,
tanpa harus menyimpulkan sendiri dari `prd.md` yang ditulis untuk audiens berbeda (§0).

## 0. Cara pakai dokumen ini

`docs/prd.md` menjawab **apa & kenapa** (produk) dan **bagaimana** (arsitektur) secara
lengkap — dokumen ini **tidak menggantikannya**, dokumen ini adalah **rencana eksekusi**
di atasnya: per fase, apa modul yang dibangun, urutan langkahnya, keputusan yang harus
diambil, dan kapan sesuatu boleh disebut "selesai". Kalau ada detail arsitektur yang
tidak dijelaskan ulang di sini, cari nomor bagian PRD yang dirujuk.

Baca dalam urutan ini kalau baru pertama kali di repo ini:

1. `README.md` — status saat ini, satu paragraf apa ecorione.
2. `AGENTS.md` — 10 aturan tidak bisa dinegosiasikan. **Berlaku penuh di semua fase
   di bawah, tanpa pengecualian**, meskipun tidak diulang di tiap bagian.
3. `docs/prd.md` §6–§9 — 11 modul, requirement fungsional, arsitektur.
4. Dokumen ini, dari fase yang sedang berjalan (lihat §2 untuk status tiap fase).
5. `docs/DECISIONS.md` — histori keputusan aktual, satu baris per baris.

**Kalau kamu AI yang ditugaskan mengerjakan satu fase**: baca §0–§2 dulu (konteks
lengkap), lalu bagian fase kamu secara penuh, lalu `docs/api-fase1.md` (kontrak yang
sudah jalan — jangan diubah tanpa alasan eksplisit). Jangan mulai menulis kode dari
bagian fase saja tanpa §0–§2 — kamu akan kehilangan alasan *kenapa* urutannya begini.

## 1. Apa itu ecorione — satu paragraf

Satu memori bersama untuk semua AI yang dipakai orang — lokal maupun hosted (Claude,
ChatGPT, model lokal) — plus lapisan yang bikin tiap panggilan ke model jauh lebih
murah lewat prompt caching yang byte-stabil. Prinsipnya: **local-first** (data di
mesin sendiri secara default), **tidak ada fallback diam-diam** (routing/biaya/gerbang
selalu terlihat pengguna), **tulisan dari AI hosted dikarantina** sebelum masuk memori
inti, dan **tiap klaim penghematan diukur** lewat cost ledger kontrafaktual, bukan
diasumsikan. Detail lengkap: `docs/prd.md` §1–§5.

## 2. Peta fase

| Fase | Isi | Status | Modul yang disentuh |
|---|---|---|---|
| **0** | Monorepo, konvensi, CI, LICENSE | ✅ Selesai | — (fondasi) |
| **1** | Loop chat inti P0 end-to-end | ✅ Selesai | Ai, Hub, Connect (outbound), Context, RnD |
| **2** | Server MCP + Sync | 📋 Rencana ditulis (`docs/fase2.md`) | Connect (inbound), Sync (baru) |
| **3** | P1 sisanya | 📋 Rencana di §6 dokumen ini | Space (baru), Artifact (baru), Sandbox (baru) |
| **4** | Automation | 📋 Rencana di §7 | Flow (baru, di atas durable execution) |
| **5** | RPA escape hatch | 📋 Rencana di §8 | AutoClick (baru, P2) |
| **6+** | Operasi bisnis | 📋 Arah di §9 (evidence-driven, bukan pra-rencana rinci) | Semua modul, tingkat otonomi naik per-fungsi |

**Aturan urutan:** jangan mulai fase N+1 sebelum kriteria "selesai" fase N terpenuhi
(§10.3) — ini yang mencegah "foundation-first tanpa integrasi nyata", kesalahan
ekosistem lama yang `prd.md` §24 eksplisit melarang diulang.

## 3. Fase 0 — Fondasi (SELESAI)

Monorepo pnpm workspaces, TypeScript strict ESM (`NodeNext`, `verbatimModuleSyntax`),
`packages/shared-schema` (ID bertipe, `Scope`/`Sensitivity`/`Trust`/`SyncClass`),
`packages/shared-telemetry` (cost ledger), `packages/shared-ui` (design system),
`packages/context-assembly` (prefix stability), skema memori SQLite di Context,
`LICENSE`/`CONTRIBUTING.md`/`AGENTS.md`, CI (lint+test+secret-scan). Tidak ada modul
yang tersambung end-to-end di fase ini — itu memang bukan tujuannya (fondasi
dulu, vertical slice belakangan, lihat `prd.md` §24 poin 1).

## 4. Fase 1 — Loop inti (SELESAI)

`services/rnd` (trace store), lapisan HTTP `services/context`, `services/connect`
(**outbound saja**), `services/hub` (policy engine, approval gate, audit log,
orkestrasi), `apps/ai` (chat UI) — lima proses terhubung lewat HTTP asli. 285 test,
`test/chat-loop.test.ts` (8 kasus emas dengan proses sungguhan, bukan mock internal).
Kontrak lengkap: `docs/api-fase1.md`. **Jangan ubah kontrak ini di fase manapun di
bawah kecuali disebut eksplisit** — modul baru memanggil endpoint yang sudah ada,
tidak menulis ulang.

## 5. Fase 2 — Server MCP (Connect inbound) + Sync

**Rencana lengkap dan rinci: `docs/fase2.md`.** Ringkasan supaya alur baca dari sini
tidak putus — detail teknis (skema tool, endpoint Hub baru, stack auth, urutan build)
**ada di sana, tidak diulang di sini** (`AGENTS.md`: jangan duplikasi).

- **Connect inbound** — server MCP (spec 2026-07-28, stateless). 5 tools:
  `memory_search`/`get`/`propose`/`recent`/`open`. stdio dulu (Claude Code/Cursor/VS
  Code, tanpa auth), baru Streamable HTTP (Claude.ai/ChatGPT, lewat Sync).
- **Sync** (modul baru, belum ada kode) — dua tanggung jawab: relay lintas device
  untuk data `SyncClass: "SYNC_ENCRYPTED"`, dan jembatan HTTPS publik untuk server MCP
  (asisten hosted tidak bisa menjangkau `localhost`).
- **Keputusan yang harus diambil sebelum kode Sync ditulis**: bagaimana mesin lokal
  dijangkau publik — `docs/fase2.md` §2 memberi 3 opsi dengan trade-off, butuh
  ADR-0016. **Ini prasyarat keras**, bukan detail yang bisa ditunda.
- Kriteria selesai, urutan build 9 langkah, target suite regresi 30–40 kasus: semua
  di `docs/fase2.md` §5–§7.

## 6. Fase 3 — Space, Artifact, Sandbox

Tiga modul P1 yang belum ada kode sama sekali, disambung **sesuai use case nyata**
(`prd.md` §23) — bukan dibangun penuh lalu dicari pemakainya (`prd.md` §24 poin 1,
pelajaran paling mahal dari ekosistem lama). Urutan disarankan di bawah: **Artifact
dulu** (dependency Context sudah menunggu — lihat §6.2), **Sandbox kedua** (berdiri
sendiri, tidak butuh Space/Artifact), **Space terakhir** (paling mudah divalidasi
manfaatnya begitu Artifact ada untuk dirujuk dari catatan).

### 6.1 Sandbox — eksekusi terisolasi bertingkat

Lokasi baru: `services/sandbox/`. Detail tier & threat model lengkap: `prd.md` §13
(**baca penuh sebelum mulai** — ini bagian PRD paling rinci soal Sandbox, tidak
diulang di sini), ADR-10.

**Threat model yang harus dipegang** (urut probabilitas, bukan urut ketakutan): AI
menulis kode buggy yang merusak data pengguna (paling mungkin) → indirect prompt
injection dari konten yang dibaca agent → supply chain (`pip install` typosquat).
**Bukan** threat model: escape kernel oleh aktor negara. **ecorione tidak pernah
mengklaim "secure sandbox"** — nyatakan di dokumentasi user-facing juga, bukan cuma
di sini.

Tiga tier, **bangun berurutan, jangan loncat**:

1. **Tier 0 — selalu menyala, biaya nol.** Allowlist filesystem (tulis hanya di
   bawah workspace), deny-list verb shell destruktif, allowlist egress jaringan,
   **konfirmasi manusia untuk aksi tak-terbalikkan** (lewat Hub — pakai
   `POST /v1/actions/evaluate` yang **sudah ada** dari Fase 1, jangan bikin gerbang
   kedua), semua aksi ke trace (RnD) + audit log (Hub), workspace di bawah version
   control supaya "undo" ada. **Ini yang wajib jalan duluan** — Tier 1.5/1 tidak
   berarti apa-apa kalau Tier 0 belum menyala.
2. **Tier 1.5 — WASM, default.** Wasmtime/Pyodide untuk snippet transformasi data
   saja. Nol ambient authority, start <100ms, jalan native di Windows tanpa WSL2.
   Batasnya ekosistem (tidak ada wheel native, tidak ada subprocess), bukan
   keamanan. **Catatan keamanan penting**: escape biasanya lewat host binding yang
   *kita* tambahkan sendiri ke sandbox WASM, bukan lewat bug di engine-nya — audit
   tiap fungsi host yang diekspos ke WASM secara eksplisit.
3. **Tier 1 — Docker+WSL2, eskalasi untuk paket nyata/jaringan.** Flag wajib
   (semua, tidak ada yang opsional): `--network=none` default, `--read-only` +
   `--tmpfs` kecil, `--cap-drop=ALL`, `--security-opt=no-new-privileges`, `--user`
   non-root, `--memory`/`--cpus`/`--pids-limit`, **tidak pernah mount docker
   socket**, tepat satu bind mount (workspace tugas). Jaringan dinyalakan eksplisit
   per-tugas lewat proxy allowlist domain — tidak ada opsi "izinkan semua".

**Ditolak, jangan dipertimbangkan ulang tanpa ADR baru yang eksplisit membatalkan
alasan ini**: Firecracker/gVisor (butuh Linux+KVM, tidak jalan Windows native), E2B
(self-host cuma GCP/AWS), Windows Sandbox/Hyper-V (tidak ada di Windows Home),
Daytona (tidak dipelihara sejak Juni 2026), microsandbox (beta, pantau saja).

Receipt + log per eksekusi (skema baru, `sandbox_executions` — kolom minimal:
`id`, `tier` (`"tier0"|"tier1.5"|"tier1"`), `command`/`snippet`, `exitCode`,
`durationMs`, `operationId`, `recordedAt`) — dikirim ke RnD sebagai span, bukan
tabel terpisah yang tidak pernah dibaca ulang, kecuali receipt butuh field yang
tidak muat di `GenAiSpan.attributes` (mis. `stdout`/`stderr` penuh) — kalau begitu,
tabel lokal Sandbox untuk isi lengkap, span RnD untuk ringkasan + pointer.

**Test**: satu test per flag Docker (verifikasi flag benar-benar terpasang di
command yang di-exec, bukan cuma "container jalan"), satu test yang mencoba
menembus tiap batas Tier 0 (tulis di luar workspace, verb shell destruktif) dan
memverifikasi ditolak.

### 6.2 Artifact — content-addressed storage

Lokasi baru: `services/artifact/`. **Context sudah punya separuh ini** —
`artifact_pointers` table (`services/context/src/repository.ts`) dan
`ArtifactPointerSchema` (`packages/shared-schema/src/memory.ts`, field `id`, `path`,
`description`, `mimeType`, `sizeBytes`, `scope`, `sensitivity`) sudah ada sejak Fase
0/1 — **tapi belum ada yang benar-benar menyimpan bytes di balik `path`-nya.**
Artifact modul mengisi celah itu, **bukan** menulis ulang skema pointer yang sudah ada.

- CAS berbasis SHA-256: `POST /v1/artifacts` (body: bytes + `mimeType` + `scope` +
  `sensitivity` + `description`) → hash konten, simpan ke
  `<data-dir>/artifacts/<sha256[0:2]>/<sha256>` (sharding 2-karakter supaya satu
  direktori tidak meledak), dedup otomatis (hash sama → tidak ditulis ulang,
  langsung balas pointer yang sudah ada), balas `id: art_<sha256>` **memakai
  `ArtifactId` yang sudah ada di `shared-schema/src/ids.ts`, prefix `art`**.
- Setelah tersimpan, **daftarkan pointer-nya lewat Context** (`POST` ke
  endpoint pointer Context yang setara — Fase 1 belum punya endpoint tulis untuk
  `artifact_pointers`, cuma baca (`GET /v1/artifacts`) — **tambahkan
  `POST /v1/artifacts` di Context** yang menerima `ArtifactPointerSchema` dan
  insert ke tabel yang sudah ada. Artifact modul sendiri **tidak menyentuh DB
  Context** — panggil API-nya, sesuai prinsip "tidak ada modul membuka DB modul
  lain" (`AGENTS.md`).
- **Just-in-time retrieval**: `GET /v1/artifacts/:id/content` → bytes mentah +
  `Content-Type` dari `mimeType` tersimpan. Agent memegang pointer (path +
  deskripsi satu baris dari `GET {Context}/v1/artifacts`, sudah ada sejak Fase 1) —
  **tidak pernah** memuat isi ke context pack secara spekulatif; isi dimuat cuma
  saat agent eksplisit memanggil ini (`research.md` §3.2).
- Sensitivity/scope filter berlaku di titik pengambilan **content**, bukan cuma di
  listing pointer — pointer boleh terlihat (`description` cukup buat tahu ada apa),
  tapi `GET :id/content` tetap gerbang `maxSensitivity` yang sama seperti
  `/v1/retrieve` Context.

**Test**: dedup (dua upload konten identik → satu file fisik, dua pointer kalau
scope beda, satu pointer kalau sama — putuskan semantiknya eksplisit sebelum nulis
kode, jangan biarkan ambigu), penolakan `content` yang melebihi `maxSensitivity`
allowlist pemanggil, integritas hash (konten yang diambil balik cocok hash-nya).

### 6.3 Space — permukaan editor memori

Lokasi baru: `services/space/` (data structured notes) + **keputusan terbuka**:
apakah UI-nya route baru di `apps/ai` atau app Next.js terpisah — ini keputusan
produk/UX (satu permukaan chat+notes vs dua aplikasi terpisah), **tanyakan
pengguna sebelum membangun UI-nya**, dokumen ini cuma menjamin backend-nya jelas.

- Dua fungsi berbeda, jangan dicampur jadi satu skema:
  1. **Catatan/dokumen terstruktur** (halaman & blok) — data milik Space
     sepenuhnya, skema baru (`pages`, `blocks` — blok bertipe teks/heading/list
     minimal untuk v1, tidak perlu meniru Notion penuh). DB sendiri
     (`ECORIONE_SPACE_DB_PATH`), **bukan** dicampur ke DB Context.
  2. **Editor blok memori inti L2** — ini **bukan** data Space, ini **UI** di atas
     data Context yang sudah ada (`GET /v1/core-memory`,
     `PUT /v1/core-memory/:label`, **sudah lengkap sejak Fase 1**). Space cuma
     memanggil endpoint itu, tidak menyimpan salinan core memory sendiri —
     duplikasi state di sini adalah sumber bug "mana yang benar" yang nyata.
- Requirement produk yang eksplisit di `prd.md` §7: pengguna **harus bisa
  membuka, membaca, dan mengedit** apa yang sistem yakini tentang dirinya **sebagai
  teks biasa** — bukan form terstruktur yang menyembunyikan representasi
  sebenarnya. Ini prinsip kepercayaan, bukan preferensi UX.

**Test**: CRUD halaman/blok dasar, dan — yang lebih penting — test yang memverifikasi
edit lewat Space benar-benar memanggil `PUT {Context}/v1/core-memory/:label` yang
sama (bukan jalur tulis kedua yang menyimpang dari kontrak Fase 1).

### 6.4 Kriteria selesai Fase 3

Sandbox: satu tugas nyata (bukan simulasi) dieksekusi lewat ketiga tier dan
menghasilkan receipt yang bisa dilihat pengguna. Artifact: satu file nyata
di-upload, di-dedup-kan (upload dua kali, verifikasi cuma satu salinan fisik), dan
diambil balik lewat pointer dari sesi chat sungguhan. Space: pengguna mengedit satu
blok core memory lewat Space dan perubahannya langsung terlihat di panel "memori
yang dipakai" Ai pada giliran chat berikutnya — bukti dua permukaan itu benar-benar
satu sumber data.

## 7. Fase 4 — Flow (automation di atas durable execution)

Lokasi baru: `services/flow/`. **Prasyarat keras, urut**: ADR-08 sudah mengunci
keputusan "adopsi mesin durable execution, jangan bangun sendiri" — kandidat
**Temporal (MIT)** atau **Trigger.dev (Apache-2.0)**. **Pilih salah satu dan tulis
ADR baru yang mengunci pilihannya sebelum baris kode `services/flow/src/` pertama**
— PRD sengaja tidak memutuskan ini di muka (butuh evaluasi hands-on kedua kandidat
terhadap kebutuhan nyata saat itu, `research.md` §7.3 tidak merekomendasikan satu
secara definitif).

- Flow **tidak** membangun executor/scheduler sendiri — semua durability (crash
  recovery mid-workflow, retry, checkpoint) didelegasikan ke mesin yang diadopsi.
  Kode Flow adalah **definisi workflow + node handler**, bukan runtime durability.
- Wajib didukung: crash recovery mid-workflow, efek samping idempoten (pakai
  idempotency key yang **sudah** wajib di seluruh sistem — ADR-12, jangan bikin
  mekanisme kedua), **tunggu-approval berhari-hari tanpa konsumsi compute** — ini
  yang membuktikan approval gate Hub benar-benar "durable state, bukan fitur UI"
  (`prd.md` §7 Hub, sudah dibangun Fase 1 — Flow adalah pemakai pertamanya yang
  menguji itu sungguhan lewat rentang waktu nyata, bukan cuma unit test yang restart
  instan).
- Lima jenis node minimal: **transform** (murni fungsi, tidak ada efek samping),
  **delay**, **human-approval** (tersambung `POST {Hub}/v1/approvals/:id/decide`,
  **sudah ada**), **node AI** (lewat `POST {Connect}/v1/complete`, **sudah ada**),
  **node eksekusi** (lewat Sandbox Fase 3 — kalau Fase 3 belum selesai, Flow **tidak
  bisa** punya node eksekusi yang aman; ini salah satu alasan urutan fase di §2
  tidak boleh dibalik).
- **Event- dan jadwal-driven saja. Tidak ada agent polling always-on** — biaya
  harus berskala dengan pekerjaan yang selesai, bukan waktu dinding (ADR-08).
- **Setiap workflow butuh langkah verifikasi eksternal** sebelum boleh naik dari L2
  ke L3 di tangga otonomi (`prd.md` §22, §9 dokumen ini) — verifikasi terpisah dari
  aktor yang mengeksekusi, bukan agent yang menilai pekerjaannya sendiri.

**Test**: satu workflow yang benar-benar crash mid-eksekusi (bunuh proses secara
paksa) dan terbukti resume dari checkpoint, bukan mulai ulang dari nol atau hilang.
Satu workflow yang menunggu approval lebih dari satu siklus restart proses
(matikan-nyalakan proses Flow, approval tetap tertunda dengan benar, bukan hilang
atau ter-approve otomatis).

### Kriteria selesai Fase 4

Satu workflow nyata (bukan "hello world") berjalan dari trigger sampai selesai
lewat kelima jenis node, termasuk melewati human-approval sungguhan dan node
eksekusi Sandbox sungguhan, tercatat penuh di audit log Hub dan trace RnD.

## 8. Fase 5 — AutoClick (RPA, escape hatch P2)

Lokasi baru: `services/autoclick/` — **runtime Python terpisah**, bukan TypeScript
(`prd.md` §10 struktur monorepo mencatat ini eksplisit — ekosistem automation
desktop/browser Python lebih matang). ADR-11 sudah mengunci keputusan ini turun
dari P1 ke P2 — **baca ADR-11 penuh sebelum mulai**, ini bagian PRD dengan
kesimpulan paling tidak nyaman dari seluruh riset proyek: tingkat sandbox nyaris
tidak berarti kalau AutoClick berjalan tanpa batas, karena RPA **berjalan di luar
sandbox menurut definisinya** — agent yang bisa menggerakkan mouse asli bisa
membuka email pengguna dan mengotorisasi apa pun di tab yang sudah login, tanpa
satu pun batas container terlibat.

**Prasyarat produk sebelum baris kode pertama**: ada kebutuhan nyata yang **tidak
bisa dijawab API** (`prd.md` §7: "selalu pakai API kalau API-nya ada; otomasi
browser adalah pilihan terakhir"). Kalau belum ada kebutuhan konkret seperti itu,
**Fase 5 belum boleh mulai** — ini bukan modul yang dibangun karena kelihatan
penting (`prd.md` §24 poin 10, kesalahan yang sama yang menenggelamkan Cache & IR
di ekosistem lama).

Kontrol wajib, **semua**, tidak ada yang opsional:

- **Profil browser terpisah** — tidak pernah profil utama pengguna yang sudah
  login. Satu keputusan ini menyumbang lebih banyak keamanan daripada teknologi
  isolasi mana pun (ADR-11).
- **Allowlist aplikasi** eksplisit — mulai dari Chrome & Excel saja; **tidak
  boleh** password manager, aplikasi bank, terminal — daftar ini dikonfigurasi,
  bukan hardcode, tapi defaultnya *deny*, bukan *allow*.
- **Konfirmasi sebelum commit** untuk aksi tak-terbalikkan: kirim, bayar, hapus,
  posting, beri izin. Tampilkan screenshot + klik yang dimaksud lewat Hub approval
  gate yang **sudah ada** (`POST /v1/approvals/:id/decide`) — **jangan** bikin
  mekanisme approval kedua.
- **Semua konten layar adalah input tak-tepercaya** — teks halaman, hasil OCR,
  isi dokumen = data, tidak pernah instruksi. Sama prinsipnya dengan memori
  (`AGENTS.md` aturan 2), diterapkan ke domain baru.
- **Dead-man's switch**: hotkey abort global, budget langkah keras per sesi,
  indikator "agent sedang menyetir" yang terlihat pengguna sepanjang waktu.
- Rekam screenshot + log aksi tiap langkah → RnD (trace, sama pola dengan Sandbox
  receipt).

**Plafon otonomi**: **L2 paling banter, tidak pernah lebih tinggi** (`prd.md`
§22, tabel baris "Otomasi browser di web nyata") — angka riset mendukung ini keras:
skor WebVoyager ~90% ternyata sangat overestimate; di situs live (Online-Mind2Web,
300 tugas/136 situs), agent terbaik cuma 61.3%, kebanyakan ~28–30%.

**Test**: verifikasi allowlist aplikasi benar-benar diterapkan (coba buka aplikasi
di luar daftar, harus ditolak sebelum aksi apa pun terjadi), verifikasi aksi
tak-terbalikkan tidak pernah commit tanpa approval tercatat, verifikasi dead-man's
switch benar-benar menghentikan eksekusi saat dipicu (bukan cuma UI yang berubah).

### Kriteria selesai Fase 5

Satu kebutuhan nyata (bukan demo) yang sebelumnya tidak bisa dijawab API
terselesaikan lewat AutoClick, dengan approval tercatat untuk tiap aksi
tak-terbalikkan di dalamnya, dan dead-man's switch terbukti berfungsi lewat
pengujian nyata (bukan cuma dibaca kodenya).

## 9. Fase 6+ — Perluasan ke operasi bisnis

**Ini bukan daftar tugas seperti fase 2–5** — `prd.md` §22 dan §24 poin 10
eksplisit: fase ini **evidence-driven**, bukan pra-rencana rinci. Modul apa yang
diperluas, dan seberapa jauh, ditentukan angka nyata dari pemakaian Fase 1–5, bukan
diasumsikan sekarang. Yang dokumen ini **bisa** kunci di muka adalah **prasyarat
dan batasan** yang berlaku untuk perluasan apa pun di fase ini.

**Sembilan prasyarat arsitektur** (`prd.md` §22) — 1–4 adalah fondasi, tanpa
salah satunya ini bukan platform operasi bisnis. **Semua sudah dibangun** di
Fase 1–5 di atas kalau urutan diikuti — Fase 6+ tidak menambah infrastruktur baru,
cuma memakai yang sudah ada lebih jauh:

1. Durable state / eksekusi ter-checkpoint (Flow, Fase 4)
2. Idempotency key pada setiap efek samping (ADR-12, Fase 1)
3. Seam eksekusi tool dengan kebijakan di kode, bukan di prompt (Hub policy engine,
   Fase 1)
4. Audit trail dengan trajektori penuh (Hub audit log, Fase 1)
5. Approval gate berjenjang risiko & terkondisi argumen (Hub, Fase 1)
6. Rollback/kompensasi — aksi tanpa aksi pembatalan **permanen L2**, tidak pernah
   naik ke L3 (berlaku selamanya, bukan cuma Fase 6+)
7. Kontrol biaya dengan kill switch (cost ledger, Fase 1 — kill switch aktual
   belum dibangun, ini salah satu kandidat kerja nyata Fase 6+)
8. Scoping kredensial least-privilege (Connect, Fase 1 — perlu diperluas per-fungsi
   bisnis saat fungsi baru ditambah)
9. **Verifikasi hasil terpisah dari aktor** — ini yang mengubah L2 jadi L3, dan ini
   yang paling sering belum ada untuk fungsi bisnis baru manapun. **Tidak ada
   fungsi baru boleh naik ke L3 tanpa langkah verifikasi independen yang
   terpasang sebelum otonominya dinaikkan** — bukan janji "akan ditambah nanti".

**Plafon per fungsi** (tabel lengkap `prd.md` §22) — batas ini **tidak berubah**
sampai ada bukti terukur yang membenarkan naik, bukan optimisme: kode/tooling
internal L3, drafting/riset L3, ekstraksi dokumen L3-dengan-sampling, pembukuan L2,
penjadwalan/ops internal L3–L4, **pembayaran/refund L2 berpagu keras selamanya**
sampai ada bukti kuat, komunikasi eksternal L2, legal/pajak/HR L1 (butuh atestasi
manusia menurut hukum, bukan keputusan teknis), otomasi browser **L2 paling
banter** (Fase 5).

**Framing yang benar untuk fase ini** (`prd.md` §22, kutip langsung): *"satu orang
menjalankan bisnis pada skala tim, karena substrat keandalannya membuat tingkat
kegagalan AI bisa ditanggung — substratnya adalah produknya, bukan agent-nya."*
Fase 6+ tidak pernah tentang membangun agent yang lebih otonom secara mendadak; ia
tentang menaikkan plafon **satu fungsi pada satu waktu**, tiap kenaikan didukung
angka dari suite regresi RnD (yang mestinya sudah di 30–50 kasus sejak Fase 2), tidak
pernah didukung "kelihatannya sudah cukup pintar".

## 10. Yang berlaku di semua fase, tidak berubah

### 10.1 Sepuluh aturan `AGENTS.md`

Berlaku identik di Fase 2 sampai 6+ — tidak diulang di sini, baca file itu.
Pelanggaran salah satu aturan ini bukan bug biasa, itu merusak klaim inti produk.

### 10.2 Prinsip arsitektur yang tidak boleh dilanggar modul baru manapun

- **Tidak ada modul yang mengakses database modul lain secara langsung** — semua
  lewat API, Hub sebagai penjaga otorisasi. Ini sudah dilanggar-godaan tiga kali di
  rencana atas (Artifact→Context, Space→Context) — **selalu selesaikan lewat
  endpoint baru di pemilik data, jangan lewat akses langsung**, meski "cuma baca".
- **Prefix stability** (ADR-01) berlaku ke **setiap** panggilan model baru yang
  ditambahkan fase manapun — node AI di Flow, ekstraksi di Artifact/Sandbox kalau
  ada, semuanya lewat `POST {Connect}/v1/complete` yang sudah menegakkan ini,
  jangan panggil provider langsung dari modul baru.
- **Tidak ada fallback diam-diam** — kegagalan upstream modul baru manapun balas
  error eksplisit (`UPSTREAM_UNAVAILABLE` atau setara), tidak pernah terlihat
  seperti sukses dengan data kosong/default.

### 10.3 Definisi "selesai" — sama untuk semua fase

Sesuai standar yang sudah dipakai Fase 1 (`README.md` §Status) dan diulang eksplisit
tiap fase di atas: **"test-nya lulus" bukan "selesai"**. Selesai berarti **bisa
dipakai end-to-end**, dibuktikan lewat satu pemakaian nyata (bukan simulasi/demo),
dengan bukti yang bisa diperiksa ulang (log, audit trail, trace) — bukan laporan
diri. Ini pelajaran paling mahal dari ekosistem lama (`prd.md` §24 poin 2) dan
alasan `docs/DECISIONS.md` + audit log append-only ada sejak Fase 1.

## 11. Referensi

`docs/prd.md` (seluruhnya — terutama §6 peta modul, §7 requirement per modul, §9
arsitektur, §13 Sandbox, §22 tangga otonomi, §23 roadmap, §24 pelajaran ekosistem
lama) · `docs/research.md` (alasan riset di balik tiap ADR) · `docs/adr/` (15 ADR,
semua masih berlaku) · `docs/api-fase1.md` (kontrak yang sudah jalan) ·
`docs/fase2.md` (rencana rinci Fase 2 — Connect inbound + Sync) ·
`docs/LICENSING.md` (model open-core — relevan kalau modul baru di fase manapun
di atas masuk kategori kandidat tier berbayar) · `AGENTS.md` (konvensi kode & 10
aturan tidak bisa dinegosiasikan) · `docs/DECISIONS.md` (histori keputusan aktual).
