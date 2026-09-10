# ecorione — Product Requirements Document (PRD)

Status: **v2.0** — 2026-09-07. Revisi besar setelah riset teknis mendalam (`research.md`). 15 keputusan arsitektur (ADR-01…ADR-15) diterapkan; peta modul berubah dari 13 jadi 11; prioritas beberapa modul bergeser; sejumlah asumsi v1.0 terbukti salah dan dikoreksi.
Pemilik: Amanda
Dokumen pasangan: `research.md` (riset & due diligence — **sumber alasan untuk semua keputusan di sini**), `design.md` (identitas visual & UI/UX)
Repo sumber (referensi, read-only, **tidak pernah diubah**): `C:\Users\Amand\.gemini\antigravity\scratch\ideagentics\inmy`
Repo baru: `C:\Users\Amand\.gemini\antigravity\scratch\ideagentics\ecorione` → dipublikasikan sebagai 1 repo GitHub publik baru (lisensi **MIT**)

> **CURRENT IMPLEMENTATION NOTE — 2026-09-10:** PRD ini tetap requirement/product-architecture source, bukan tracker implementasi. Planned platform/production Batch 1–12 sudah CLOSED dan production/self-host baseline sudah READY sesuai evidence. Current status + next scope ada di `current-state-and-next-steps.md` dan `EXECUTION-PROGRESS.md`. Tidak ada Batch 13 implisit; AutoClick tetap deferred by design dan Fase 6+ tetap evidence-driven/open-ended.

**Riwayat:** DRAFT v0.1–v0.2 (scope & arsitektur awal) → DRAFT v0.3 (drop prefix "InMy", jadi satu sistem) → APPROVED v1.0 → **v2.0** (riset teknis; koreksi asumsi).

> **Apa yang berubah dari v1.0, ringkas:** (1) inti "optimizer" dipindah dari *model routing* ke *disiplin caching + isolasi konteks*, karena itu yang angkanya bisa dibuktikan; (2) peran model lokal dikoreksi — di 8–16GB RAM ia bukan agent, melainkan classifier/extractor; (3) modul Context ditulis ulang jadi arsitektur memori 4-tier yang konkret; (4) MCP masuk sebagai fondasi interop; (5) Cache & IR dilebur; RnD naik ke P1, AutoClick turun ke P2; (6) visi "bisnis dijalankan AI" diganti tangga otonomi L0–L4 dengan pengakuan jujur bahwa **L3 adalah plafon 2026**.

---

## Bagian A — Produk (apa & kenapa)

### 1. Ringkasan

**ecorione** adalah konsolidasi ekosistem "InMy" (13 produk lama yang terpisah) menjadi **satu sistem webapp yang rapi**: sebuah **lapisan memori dan optimizer bersama** yang dipakai baik oleh model AI lokal maupun AI hosted (ChatGPT, Claude, dan lainnya).

Bedanya dengan "satu UI chat untuk banyak model" — yang sudah banyak: ecorione menyimpan **satu memori** yang bisa dibaca dan ditulis oleh AI mana pun yang kamu pakai, dan **merakit konteks secara ekonomis** setiap kali AI itu dipanggil. Pindah dari Claude ke model lokal ke ChatGPT tidak menghilangkan kesinambungan kerja, dan tiap panggilan tidak mengirim ulang seluruh riwayat.

ecorione dibangun **dari nol sebagai proyek baru**, memakai kode/skema lama di `inmy/` murni sebagai **referensi baca-saja**, dengan proses kerja yang jauh lebih ringan dan identitas visual baru (`design.md`).

### 2. Latar Belakang & Masalah

Dua lapis masalah.

**Lapis 1 — warisan InMy** (detail: project doc `audit-ekosistem-inmy.md`):
- 13 modul core + 10+ produk "keluarga InMy" hidup di 13+ repo terpisah, masing-masing dengan brand sendiri dan kontrak yang disinkronkan manual.
- Sebagian besar modul foundation (Context, Sync, Space, Flow) baru berupa **local state-store** — belum ada service HTTP produksi atau UI — tapi didokumentasikan "CLOSED".
- 5 modul (Sandbox, RnD, Artifact, Cache, IR) selesai dibangun & dites standalone, lalu berakhir `DISABLED` / `prepared_not_connected`.
- Proses kerja sangat berat: kontrak-tentang-kontrak, "closure verdict", ratusan script sekali-pakai, roadmap 275KB.

**Lapis 2 — masalah pasar yang mau dijawab** (detail: `research.md` §4.3, §3):
- Tool yang menggabungkan model lokal + hosted (Open WebUI, LibreChat, AnythingLLM) adalah **UI chat dengan RAG tipis** — bukan lapisan memori atau orkestrasi.
- Tool memori yang serius (Letta, mem0) **tidak peduli soal dualitas lokal/hosted** dan tidak mengoptimalkan biaya panggilan.
- Framework agent (LangGraph, CrewAI, AutoGen, smolagents) adalah **library untuk developer**, bukan sistem yang langsung dipakai pemiliknya.
- **Tidak ditemukan satu pun proyek** yang menggabungkan: routing lokal+hosted, memori bersama di antara keduanya, eksekusi tool, dan sinkronisasi lintas device dalam satu sistem.

### 3. Tujuan (Goals)

1. **Satu sistem webapp yang koheren** — 1 monorepo, 1 cara jalanin, 1 sumber kebenaran soal status, 1 nama produk dengan modul internal bernama sederhana.
2. **Memori bersama lintas model** — satu store yang bisa dibaca/ditulis model lokal maupun AI hosted, dengan provenance, klasifikasi sensitivitas, dan kontrol scope.
3. **Optimizer yang bisa dibuktikan angkanya** — bukan klaim, tapi **akuntansi biaya kontrafaktual**: tiap panggilan mencatat biaya aktual *dan* biaya kebijakan naif. Selisihnya adalah klaim penghematan yang jujur.
4. **Local-first, hybrid sync** — data & eksekusi utama di mesin pengguna; relay opsional untuk lintas device *dan* untuk memberi AI hosted akses ke memori (yang tidak bisa menjangkau localhost).
5. **Fondasi untuk operasi bisnis yang dijalankan AI** — dengan pengakuan jujur bahwa yang bisa dicapai 2026 adalah **L2–L3** (§22), dan bahwa **substratnya** (durable execution, idempotency, approval gate, audit trail) adalah produknya, bukan agent-nya.
6. **Proses kerja ringan** — automated test + review manusia langsung.
7. **Tidak menyentuh proyek lama** — `inmy/` tetap utuh sebagai arsip/referensi.

### Non-Tujuan (v1) — diperluas berdasarkan riset

- Tidak membangun ulang 10+ produk "keluarga InMy" lain (arsitektur Hub tetap bisa jadi registry untuk mereka nanti).
- Bukan produk multi-tenant SaaS publik — fokus single-owner.
- Tidak mempertahankan proses governance/kontrak formal ala ekosistem lama.
- **Tidak ada otonomi L4 untuk apa pun.** Hanya L2 dan L3, dan L3 harus *diperoleh* per-workflow dengan tingkat sukses terukur.
- **Tidak ada orkestrasi multi-agent.** Biaya token ~15× (angka Anthropic), mode kegagalan misalignment MAST, dan tidak ada bukti mengalahkan satu agent bagus dengan tool bagus pada skala ini.
- **Tidak ada semantic caching**, tidak ada **graph database**, tidak ada **vLLM**, tidak ada **microVM**. Semua dievaluasi dan ditolak dengan alasan di `research.md`.
- **Tidak membangun mesin durable execution sendiri** — diadopsi, bukan ditulis.
- **Otomasi browser bukan dependensi inti** — ~30% tingkat sukses di web nyata; jadi escape hatch, bukan jalur utama.
- Tidak ada perpindahan uang, kirim komunikasi eksternal, atau penghapusan data tanpa gerbang approval. Titik.

### 4. Target Pengguna

- **Primer (v1)**: Amanda sendiri — power user yang mau satu workspace AI yang mengelola konteks, memori, eksekusi, dan koneksi ke berbagai model dari satu tempat.
- **Sekunder (jangka panjang)**: orang/tim yang menjalankan operasional bisnis dengan porsi besar dikerjakan AI, dengan ecorione sebagai control tower — pada level otonomi yang jujur (§22).

### 5. Prinsip Produk

1. **Integration-first, bukan foundation-first.** Bangun per vertical slice yang tersambung end-to-end.
2. **Satu sistem, satu nama.** Modul bukan produk terpisah.
3. **Satu sumber kebenaran soal status.** "Selesai" berarti bisa dipakai end-to-end.
4. **Kredensial terpusat & terisolasi** di Connect — modul lain tidak pernah pegang raw API key.
5. **Semua memori adalah data tak-tepercaya, selamanya.** Instruksi tidak pernah disimpan sebagai memori; konten tersimpan tidak pernah menempati posisi instruksi.
6. **Gagal ke arah kualitas.** Menurunkan model/biaya harus lewat aturan yang menyala eksplisit, tidak pernah jadi fallback default.
7. **Ukur, jangan klaim.** Setiap klaim optimasi punya baseline kontrafaktual.
8. **Proyek lama tidak boleh disentuh.**

### 6. Lingkup (Scope) v1 — 11 Modul Internal

| # | Modul | Peran di ecorione | Prioritas | Perubahan dari v1.0 |
|---|---|---|---|---|
| 1 | **Ai** | Interface utama — chat/agent workspace | P0 | — |
| 2 | **Hub** | Control plane: policy engine, approval gate, **durable state**, **audit log append-only** | P0 | Diperluas |
| 3 | **Connect** | Gerbang AI dua arah: **outbound** (provider + mesin optimizer) & **inbound** (server MCP) | P0 | Diperluas; menyerap Cache |
| 4 | **Context** | Memori 4-tier (L0–L3), bi-temporal, hybrid retrieval | P0 | Ditulis ulang; menyerap IR |
| 5 | **Sync** | Relay: lintas device **+ jembatan HTTPS supaya AI hosted bisa menjangkau memori lokal** | P1 | **Naik jadi prasyarat pitch inti** |
| 6 | **Space** | Workspace/notes — permukaan editor manusia untuk memori inti L2 | P1 | Diperjelas |
| 7 | **Flow** | Workflow & automation **di atas mesin durable execution yang diadopsi** | P1 | Tidak lagi membangun executor sendiri |
| 8 | **Artifact** | Content-addressed storage — tier L3 memori | P1 | Diperjelas |
| 9 | **Sandbox** | Eksekusi terisolasi bertingkat: **WASM default**, Docker+WSL2 eskalasi | P1 | Ditulis ulang |
| 10 | **RnD** | **Eval harness + trace store + regression suite** | **P1** | **Naik dari P2** |
| 11 | **AutoClick** | Automation desktop/browser (RPA) — escape hatch, bukan jalur utama | **P2** | **Turun dari P1** |
| — | ~~Cache~~ | **Dilebur ke Connect** sebagai exact-match hash cache | — | Bukan modul lagi |
| — | ~~IR~~ | **Dilebur ke Context (skema L1) + Artifact (CAS)** | — | Bukan modul lagi |

P0 = wajib jalan & tersambung end-to-end di v1. P1 = target v1, boleh menyusul. P2 = setelah ada kebutuhan nyata.

**Kenapa Cache dilebur:** semantic caching punya hit rate 10–20% untuk beban kerja chat dan mode gagalnya mengembalikan jawaban salah dengan percaya diri; GPTCache mati sejak Agustus 2024. Yang aman — exact-match hash cache — cuma sekitar 50 baris kode di dalam adapter provider, tidak layak jadi modul. *(`research.md` §2.5)*

**Kenapa IR dilebur:** kebutuhan "representasi internal terstruktur" sudah dijawab skema fakta L1 di Context (subject/predicate/object + temporal) dan content-addressing di Artifact. Modul terpisah cuma menambah lapisan tanpa menambah kemampuan. *(`research.md` §3.2)*

Penyebutan: cukup "Hub", "Connect", "Ai", dst. Kalau perlu disambiguasi dari kata umum, tulis "modul Context".

### 7. Requirement Fungsional per Modul

**Ai (interface utama)**
- Chat/agent workspace yang memanggil model lokal ATAU provider hosted lewat Connect, dengan routing yang **terlihat oleh pengguna** (tidak ada fallback diam-diam).
- Menampilkan **panel "memori apa yang dipakai"** per respons, dengan aksi lupakan satu-klik. Ini bukan fitur tambahan — tanpa ini pengguna tidak akan mempercayakan hal yang layak diingat.
- Memicu eksekusi lewat Sandbox / Flow / AutoClick dengan approval yang jelas untuk aksi berisiko.

**Hub (control plane)**
- Registry modul aktif + health check.
- **Policy engine**: mengevaluasi kebijakan sebelum aksi — sensitivitas data, status budget, kebutuhan tool, level otonomi workflow.
- **Approval gate** yang digerbang pada **risiko argumen, bukan identitas tool** (mis. pause penulisan file hanya di luar workspace; pause SQL hanya kalau bukan SELECT). Empat respons: approve / edit / reject / respond — dan **`respond` tidak boleh dipakai untuk menolak tool yang punya efek samping** (itu memberi sinyal sukses palsu ke model).
- **Durable state**: approval gate mensyaratkan state yang persisten lintas interrupt. Approval adalah fitur durable-state, bukan fitur UI.
- **Audit log append-only** untuk semua aksi lintas modul, bisa direkonstruksi jadi "apa yang sebenarnya terjadi di sesi ini". **Tidak boleh mengandalkan laporan-diri agent** — agent terdokumentasi melakukan *deceptive shortcutting* saat mentok.
- **Idempotency key wajib** pada setiap efek samping, dipaksakan di lapisan tool.
- **Context scoping**: Hub yang menentukan potongan konteks untuk tiap sub-task sebelum dispatch — bukan meneruskan riwayat mentah.

**Connect (gerbang AI dua arah)**

*Outbound — mesin optimizer:*
- **Prefix stability sebagai jaminan kelas satu**: system prompt + definisi tool + blok memori inti dijamin byte-identik antar panggilan, dengan cache breakpoint di ujungnya. Semua yang dinamis wajib di belakang breakpoint. Satu timestamp di prefix = cache tidak pernah kena, tanpa error.
- Eksekusi request ke provider dengan **pemilihan model eksplisit**; routing hanya berbasis aturan deterministik (sensitivitas → budget → butuh tool → panjang konteks → kebutuhan latensi). **Tidak ada prediktor kualitas yang dilatih.**
- **Gerbang sensitivitas dievaluasi lebih dulu dan tidak pernah ditukar dengan biaya.**
- **Exact-match cache** (hash request ternormalisasi) untuk trafik retry/regenerate/duplikat.
- **Cost ledger**: token, biaya aktual, dan **biaya kontrafaktual** per panggilan.
- **Escalation path**: kalau output model lemah gagal validator murah (schema invalid, tool call malformed, refusal, terlalu pendek), retry otomatis ke model kuat — **dan biaya retry itu dihitung**. Router yang mengabaikan biaya retry melaporkan penghematan palsu.
- Simpan kredensial provider terenkripsi at-rest; tidak pernah diekspos mentah ke modul lain; rate limit / budget guard per provider.

*Inbound — server MCP:*
- Mengekspos memori & tool ecorione ke Claude Code, Claude.ai, ChatGPT, Cursor, VS Code lewat **MCP spec 2026-07-28** (stateless; wajib implement `server/discover`).
- **Semua fungsi wajib jalan lewat tools** — resources cuma bonus, karena konektor Claude API hanya mendukung tool call dan ChatGPT membatasi per paket/mode.
- Permukaan tool sengaja kecil: `memory_search`, `memory_get`, `memory_propose`, `memory_recent`, `memory_open`.
- **`memory_propose`, bukan `memory_write`** — tulisan dari model hosted masuk **tabel karantina**, divalidasi konsolidasi lokal sebelum dipromosikan. Ini yang menetralkan sebagian besar risiko poisoning.
- **Jangan pakai Sampling/Roots/Logging** — sudah dideprecate; panggil API provider langsung.

**Context (memori)** — arsitektur lengkap di §12.1
- Empat tier di atas satu log append-only, dalam satu file SQLite.
- API: `put` / `get` / `search` / `propose` / `promote` / `recall` / `forget`, dengan filter `scope` dan `sensitivity`.
- Retrieval hybrid BM25 + vektor, difusi RRF, **k kecil (5–10)**, filter `t_invalid IS NULL`, rerank `skor × peluruhan_recency × confidence`.
- Konsolidasi berjalan **di luar jalur panas**, dibatch, dengan model lokal kecil.
- Setiap fakta membawa provenance, timestamp, trust, scope, sensitivity.

**Sync (relay)**
- Sinkronisasi data berkelas `SYNC_ENCRYPTED` lintas device pengguna yang sama.
- **Jembatan HTTPS**: asisten hosted (Claude.ai, ChatGPT) tidak bisa menjangkau localhost, jadi Sync menyediakan endpoint HTTPS untuk server MCP Connect — dengan stack auth penuh (§14).
- **Batas sinkronisasi harus eksplisit dan terlihat pengguna**: scope mana yang boleh keluar mesin, mana yang `LOCAL_ONLY`. Ini keputusan privasi tersulit di seluruh produk dan tidak boleh dikaburkan.

**Space (workspace)**
- Catatan/dokumen terstruktur (halaman & blok).
- **Permukaan editor untuk blok memori inti L2** — pengguna harus bisa membuka, membaca, dan mengedit apa yang sistem yakini tentang dirinya sebagai teks biasa.

**Flow (automation)**
- Definisi & eksekusi workflow multi-langkah **di atas mesin durable execution yang diadopsi** (kandidat: Temporal / MIT, atau Trigger.dev / Apache-2.0).
- Wajib mendukung: crash recovery mid-workflow, efek samping idempoten, dan **tunggu-approval berhari-hari tanpa konsumsi compute**.
- Node: transform, delay, human-approval (tersambung Hub), node AI (lewat Connect), node eksekusi (Sandbox).
- **Event- dan jadwal-driven saja. Tidak ada agent polling always-on** — biayanya berskala dengan waktu dinding, bukan dengan pekerjaan yang selesai.
- Tiap workflow punya **langkah verifikasi eksternal** — tanpa itu ia tidak lulus dari L2 ke L3.

**Artifact (storage)**
- CAS berbasis SHA-256, dedup otomatis, referensi `art_<sha256>`.
- Melayani tier L3 memori: dijangkau lewat **just-in-time retrieval** — agent memegang path + deskripsi satu baris, memuat isinya saat perlu.

**Sandbox (eksekusi terisolasi)** — detail tier di §13
- Tiga tingkat: guardrail in-process selalu menyala → **WASM sebagai default** → Docker+WSL2 sebagai eskalasi.
- Receipt + log per eksekusi.
- **Tidak mengklaim "secure sandbox"** — threat model dinyatakan eksplisit (§13).

**RnD (evaluasi & evidence)** — naik ke P1
- **Trace store**: span bergaya OTel untuk tiap panggilan LLM, tool call, dan retrieval. Ini dibangun **sebelum** eval, karena trace-nya *menjadi* fixture eval.
- **Regression suite** 30–40 kasus, dibatasi keras di 50 (§21.2).
- **Canary set harian** untuk mendeteksi provider yang menukar model di balik alias.
- Catat eksperimen (perbandingan model/prompt) sebagai referensi read-only — **tidak pernah jadi sumber otorisasi**.

**AutoClick (RPA)** — turun ke P2, dengan kontrol khusus
- Automation desktop/browser dengan default mode aman (dry-run).
- **Profil browser terpisah** untuk agent — tidak pernah profil utama pengguna yang sudah login. Satu keputusan ini menyumbang lebih banyak keamanan daripada teknologi isolasi mana pun.
- **Allowlist aplikasi** — boleh Chrome & Excel; tidak boleh password manager, aplikasi bank, terminal.
- **Konfirmasi sebelum commit** untuk aksi yang tak bisa dibatalkan: kirim, bayar, hapus, posting, beri izin. Tampilkan screenshot + klik yang dimaksud.
- **Semua konten layar adalah input tak-tepercaya** — teks halaman, hasil OCR, isi dokumen = data, tidak pernah instruksi.
- **Dead-man's switch**: hotkey abort global, budget langkah keras, indikator "agent sedang menyetir" yang terlihat.
- Rekam screenshot + log aksi tiap langkah.
- **Selalu pakai API kalau API-nya ada.** Otomasi browser adalah pilihan terakhir.

### 8. Requirement Non-Fungsional

**Ekonomi & performa**
- **Prefix stability terjaga** — diuji otomatis: test yang membandingkan byte prefix antar dua panggilan berturutan dan gagal kalau berbeda.
- **Akuntansi kontrafaktual** pada 100% panggilan model.
- **Anggaran konteks per tier** ditegakkan; k retrieval kecil.
- Biaya diukur **per tugas selesai**, bukan per panggilan.

**Keandalan**
- Retry/timeout policy standar di Connect; partial-failure handling eksplisit di Flow.
- Idempotency key pada setiap efek samping.
- Durable state untuk semua workflow yang punya approval atau berjalan lama.

**Keamanan**
- Tidak ada raw API key yang jadi input reasoning AI.
- Secret scanning (gitleaks atau setara) di pre-commit & CI sejak commit pertama.
- Memori tersimpan diperlakukan sebagai data tak-tepercaya selamanya (§14).
- Stack auth MCP remote penuh (§14).

**Observability**
- Span OTel `gen_ai.*` per panggilan LLM, tool call, retrieval. Atribut token & biaya cache di namespace sendiri (konvensi OTel belum memodelkan token ter-cache, dan **tidak ada atribut biaya standar**).
- Overhead optimizer sebagai span-nya sendiri.

**Setup & pemakaian**
- `git clone` + 1–2 perintah untuk menjalankan seluruh sistem lokal.
- Target hardware: laptop Windows 8–16GB RAM (§11.1 menjelaskan konsekuensinya).

---

## Bagian B — Arsitektur Teknis (bagaimana dibangun)

### 9. Gambaran Arsitektur

```text
   AI hosted eksternal                          ecorione
   (Claude Code, Claude.ai,
    ChatGPT, Cursor, VS Code)
            │
            │  MCP (2026-07-28, stateless)
            │  tools: memory_search / get / propose / recent / open
            ▼
   ┌──────────────────┐            ┌─────────────────────────┐
   │  Connect —       │            │           Ai            │
   │  inbound (MCP    │            │  interface utama:       │
   │  server)         │            │  chat, agent, workspace │
   └────────┬─────────┘            └───────────┬─────────────┘
            │                                  │
            └──────────────┬───────────────────┘
                           ▼
              ┌────────────────────────────┐
              │           Hub              │
              │  policy engine · approval  │
              │  gate · durable state ·    │
              │  audit log · context scope │
              └─────┬──────────────┬───────┘
                    │              │
        ┌───────────┘              └────────────┐
        ▼                                       ▼
┌───────────────────┐                 ┌────────────────────┐
│     Context       │                 │  Connect —         │
│  L0 log episodik  │                 │  outbound          │
│  L1 fakta (bi-    │◄────────────────┤  · prefix stability│
│     temporal)     │  context pack   │  · policy routing  │
│  L2 memori inti   │────────────────►│  · exact cache     │
│  L3 → Artifact    │                 │  · cost ledger     │
│  SQLite+vec+FTS5  │                 └─────────┬──────────┘
└─────────┬─────────┘                           │
          │                                     ▼
          │                        ┌─────────────────────────┐
          │ L3 storage             │  Provider AI eksternal  │
          ▼                        │  (OpenRouter → ChatGPT, │
   ┌──────────────┐                │   Claude, dst)          │
   │   Artifact   │                │  + model lokal          │
   │  CAS SHA-256 │                │  (Ollama / llama.cpp)   │
   └──────────────┘                └─────────────────────────┘

        Dikoordinasi Hub, dipanggil sesuai kebutuhan:
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐
│  Space   │  │   Flow   │  │ Sandbox  │  │   RnD    │  │ AutoClick │
│ notes +  │  │ durable  │  │ WASM →   │  │ trace +  │  │ RPA (P2,  │
│ editor   │  │ workflow │  │ Docker/  │  │ eval +   │  │ escape    │
│ memori   │  │ (engine  │  │ WSL2     │  │ canary   │  │ hatch)    │
│ inti L2  │  │ diadopsi)│  │          │  │          │  │           │
└──────────┘  └──────────┘  └──────────┘  └──────────┘  └───────────┘

        ┌─────────────────────────────────────────────┐
        │  Sync — relay lintas device + jembatan      │
        │  HTTPS supaya AI hosted bisa jangkau memori │
        └─────────────────────────────────────────────┘
```

**Alur inti (P0):** permintaan masuk lewat Ai (atau lewat MCP dari AI eksternal) → Hub mengevaluasi kebijakan dan menentukan **scope konteks** → Context merakit *context pack* terhadap anggaran token → Connect menyusunnya dengan **prefix stabil di depan cache breakpoint** dan memanggil provider/model lokal → hasil dicatat ke cost ledger dan trace, artifact disimpan lewat Artifact, fakta baru masuk antrean konsolidasi Context.

**Prinsip kunci:** tidak ada modul yang boleh mengakses database modul lain secara langsung — semua lewat API dengan Hub sebagai penjaga otorisasi. **Pola orkestrasinya dinamai eksplisit: supervisor/coordinator** (satu otoritas pusat men-dispatch ke modul spesialis dengan konteks yang di-scope), bukan swarm horizontal.

### 10. Struktur Monorepo

```text
ecorione/
├── apps/
│   ├── ai/                    # modul Ai — Next.js UI + API
│   └── hub/                   # modul Hub — control plane
├── services/
│   ├── connect/
│   │   ├── outbound/          # provider adapter + mesin optimizer
│   │   └── inbound-mcp/       # server MCP (stdio + Streamable HTTP)
│   ├── context/               # memori L0–L3 (SQLite + sqlite-vec + FTS5)
│   ├── sync/                  # relay + jembatan HTTPS
│   ├── space/
│   ├── flow/                  # di atas durable execution engine
│   ├── artifact/              # CAS
│   ├── sandbox/               # WASM + Docker/WSL2
│   ├── rnd/                   # trace store + eval harness
│   └── autoclick/             # Python, runtime terpisah (P2)
├── packages/
│   ├── shared-schema/         # skema & tipe bersama, ID prefix, kelas data
│   ├── shared-server/         # HTTP server/middleware/auth bersama
│   ├── shared-telemetry/      # span OTel gen_ai.* + cost ledger
│   └── shared-ui/             # komponen UI sesuai design.md
├── evals/                     # suite regresi promptfoo (maks 50 kasus)
├── docs/
│   ├── prd.md
│   ├── research.md
│   ├── design.md
│   ├── DECISIONS.md           # log keputusan (pengganti "closure verdict")
│   └── adr/
├── scripts/                   # tooling dev — minimal, reusable
├── AGENTS.md                  # konvensi untuk AI yang mengerjakan repo ini
├── LICENSE                    # MIT
├── CONTRIBUTING.md
└── .github/workflows/         # CI: lint + test + secret scan + eval canary
```

Nama package npm: `@ecorione/<nama>`. Tidak ada suffix `_FullStack`, `_v0.1.1`, `__main` — versi lewat git tag/semver.

### 11. Tech Stack per Layer

| Layer | Pilihan | Alasan |
|---|---|---|
| UI utama (Ai) | Next.js (React) + Tauri opsional | Terbukti di kode lama, cocok local-first |
| Backend service | Node.js + framework ringan bersama (Fastify) lewat `shared-server` | Ganti pola "vanilla no-framework per service" yang bikin reimplementasi berulang |
| Logic ML (retrieval, ekstraksi) | Python (FastAPI) untuk bagian yang butuh ekosistem embedding | Konsisten dengan `services/api` lama |
| **Penyimpanan memori** | **SQLite + `sqlite-vec` + FTS5, satu file** | Di bawah ~1 juta fakta ini mengalahkan vector DB khusus: nol service, transaksi atomik mencakup metadata *dan* vektor, backup & sync sepele *(ADR-05)* |
| Durable execution | **Diadopsi**: Temporal (MIT) atau Trigger.dev (Apache-2.0) | Infrastruktur yang sudah terpecahkan; membangunnya sendiri akan memakan seluruh proyek *(ADR-08)* |
| Provider abstraction | SDK LiteLLM + `model_prices_and_context_window.json` (MIT) — **bukan proxy-nya** | Tabel harga publik terbaik yang ada; batas MIT/enterprise LiteLLM secara legal kabur, jadi jangan bangun di atas asumsi fitur tetap MIT |
| Inference lokal | Ollama atau llama.cpp (`llama-server`) | OpenAI-compatible, jalan CPU-only. **vLLM di luar cakupan** — butuh CUDA + ~16GB VRAM, dan keunggulannya hilang pada satu pengguna |
| Embedding | Model 300M–600M param lewat Ollama, truncation Matryoshka ke 256 dim bila ada | Memangkas indeks ~3× dengan kehilangan recall kecil. **Model spesifik wajib dibenchmark sendiri** |
| Eksekusi terisolasi | Wasmtime (default) + Docker Desktop/WSL2 (eskalasi) | §13 |
| Evaluasi | promptfoo (MIT) | Config YAML, jalan 100% lokal, CI-native |
| Observability | Span OTel `gen_ai.*` → Langfuse self-hosted (MIT core) | Portabilitas tanpa lock-in |
| Automation (AutoClick) | Python FastAPI + Playwright (+ PyAutoGUI) | Windows-first |
| Package manager | pnpm workspaces | Hemat disk, cepat untuk monorepo |

#### 11.1 Peran model lokal — koreksi penting dari v1.0

Di RAM 8–16GB, **model lokal tidak bisa diandalkan untuk tool calling**. Model di bawah ~7B gagal sistematis pada JSON multi-tool; Q4_K_M adalah lantai kualitas, dan Q3/Q2 merusak keandalan tool-call **sebelum** merusak kualitas chat — sehingga kegagalannya tak terlihat di pengujian santai. Budget realistis: 16GB → model 7–9B di Q4_K_M–Q6_K; 8GB → 3–4B, yang **di bawah lantai keandalan agentic**.

**Maka pembagian kerjanya:**

| Peran | Dijalankan oleh |
|---|---|
| Gerbang salience (layak diingat atau tidak) | **Model lokal** |
| Ekstraksi fakta & konsolidasi memori | **Model lokal** (di luar jalur panas, dibatch) |
| Klasifikasi tugas untuk keputusan routing | **Model lokal** |
| Reranking hasil retrieval | **Model lokal** |
| Redaksi data sensitif sebelum keluar mesin | **Model lokal** |
| **Agent loop / tool calling / reasoning multi-langkah** | **Model hosted** (atau mesin yang jauh lebih besar) |

Ini bukan kelemahan — ini yang membuat klaim ecorione bisa dipertahankan, dan sekaligus memberi model lokal pekerjaan yang benar-benar ia kuasai.

### 12. Model Data & Konvensi Bersama

- **Prefix ID**: `ws_` workspace, `prj_` project, `art_` artifact, `op_` operation, `dev_` device, `wf_`/`wfr_` workflow/run, `conn_` connection, `evt_` event, `mem_` fakta memori, `epi_` episode.
- **Klasifikasi sensitivitas**: `PUBLIC` / `INTERNAL` / `SENSITIVE` / `RESTRICTED`.
- **Klasifikasi sinkronisasi**: `LOCAL_ONLY` / `SYNC_ENCRYPTED` / `CLOUD_ALLOWED` / `PUBLIC`.
- **Referensi artifact via digest** (`art_<sha256>`), bukan raw path.
- **Kredensial tidak pernah jadi raw input reasoning AI.**

Didefinisikan **satu kali** di `packages/shared-schema`. Versioning: **semver**; breaking change = major bump + catatan di `DECISIONS.md`.

#### 12.1 Arsitektur memori Context (L0–L3)

Keputusan struktural terpenting: **log adalah ground truth; semua tier lain adalah proyeksi turunan yang bisa dibangun ulang.** Kalau konsolidasi menulis fakta salah, tier turunan bisa dihapus dan diturunkan ulang.

**L0 — Log episodik** (append-only, tidak pernah diedit)
`source_app` · `session_id` · `ts` · `raw_text` · `provenance`
Tidak di-embed secara default — meng-embed tiap giliran adalah tempat sistem lokal jadi mahal dan kualitas retrieval mati. Yang di-embed hanya *ringkasan* episode.

**L1 — Fakta semantik** (unit yang bisa diambil kembali)
```
id, subject, predicate, object, text, embedding,
confidence, salience, source_episode_ids[],
t_valid, t_invalid, superseded_by, created_at,
scope, sensitivity, trust
```
Model bi-temporal diambil **sebagai kolom, bukan sebagai graph database**.

**L2 — Memori inti / prosedural** (selalu di konteks)
Identitas, preferensi stabil, gaya kerja, proyek aktif, instruksi tetap. **Dibatasi keras ~1.500 token.** Wajib berupa **file yang bisa dibaca & diedit manusia** (permukaannya di Space), bukan baris database buram. Ini bagian dari prefix stabil → masuk cache.

**L3 — Artifact**
Dokumen, kode, catatan. Disimpan di modul Artifact, dijangkau lewat **just-in-time retrieval**: agent memegang path + deskripsi satu baris, memuat isinya saat perlu.

**Konsolidasi (promosi)** — di luar jalur panas, model lokal kecil, dibatch:
1. **Gerbang salience** — sebagian besar percakapan bukan memori.
2. **Ekstraksi** kandidat fakta, dengan `t_valid` eksplisit bila teksnya menyiratkan waktu.
3. **Resolusi** terhadap fakta yang ada. Kontradiksi → **set `t_invalid` + `superseded_by` pada yang lama, jangan hapus**. Duplikat → naikkan `salience`, gabungkan provenance.
4. **Tulis ulang L2 hanya** kalau fakta melewati ambang kestabilan (terlihat N kali, atau dikonfirmasi pengguna). Penulisan di jalur panas **tidak pernah** menyentuh L2.

**Retrieval — merakit context pack terhadap anggaran token:**
1. Blok inti L2, selalu, ~1.5k token.
2. Recall dari L1: BM25 (FTS5) + KNN vektor (sqlite-vec) paralel → **RRF** → filter `t_invalid IS NULL` → rerank `skor × peluruhan_recency × confidence` → **top-k kecil (5–10)**.
3. Ringkasan episodik thread berjalan, dicompact saat melewati ~60% window (pertahankan keputusan, masalah terbuka, detail spesifik).
4. L3 sebagai **pointer saja**.

Output berlabel dengan **provenance & timestamp pada tiap fakta**, dan apa yang disuntikkan **dicatat**.

**Kenapa k harus kecil:** studi Context Rot pada 18 model menemukan **satu distraktor saja sudah menurunkan akurasi**, dan model yang diberi potongan fokus ~300 token **mengungguli dirinya sendiri** saat diberi percakapan penuh ~113k token. Fakta yang cuma agak relevan **aktif merusak**, bukan sekadar memboroskan token.

### 13. Sandbox — tier isolasi & threat model

**Threat model yang jujur**, berurutan menurut probabilitas nyata:

1. **AI menulis kode buggy yang merusak data pengguna** — paling mungkin terjadi.
2. **Indirect prompt injection** — agent membaca halaman web/email/PDF/nama file yang berisi instruksi, lalu bertindak dengan otoritas penuh pengguna.
3. **Supply chain** — `pip install` paket typosquat.
4. ~~Escape kernel oleh aktor negara~~ — **bukan threat model ecorione.**

Poin 1–3 **hampir tidak terpengaruh** oleh pilihan microVM vs container. MicroVM tidak mencegah agent menghapus dokumen yang di-mount ke dalamnya.

**Tier 0 — selalu menyala, biaya nol (bangun pertama)**
Allowlist filesystem (tulis hanya di bawah workspace) · deny-list verb shell destruktif · allowlist egress jaringan · **konfirmasi manusia untuk aksi tak-terbalikkan** · semua aksi masuk trace + audit log · workspace di bawah version control/snapshot supaya "undo" ada.

**Tier 1.5 — WASM sebagai jalur default**
Wasmtime/Pyodide untuk snippet yang hanya mentransformasi data. **Nol ambient authority**, start <100ms, **jalan native di Windows tanpa WSL2 dan tanpa pajak memori Docker Desktop** (1–3GB). Di laptop 8GB ini kemenangan nyata. Batasnya ekosistem, bukan keamanan: tidak bisa memuat wheel native sembarangan, tidak ada subprocess. Catatan: escape biasanya lewat **host binding yang kita tambahkan sendiri**, bukan lewat engine.

**Tier 1 — Docker + WSL2 untuk yang butuh paket nyata / jaringan**
Flag wajib: `--network=none` default · `--read-only` + `--tmpfs` kecil · `--cap-drop=ALL` · `--security-opt=no-new-privileges` · `--user` non-root · `--memory`/`--cpus`/`--pids-limit` · **tidak pernah mount docker socket** · tepat satu bind mount (workspace tugas). Jaringan dinyalakan eksplisit per-tugas lewat proxy dengan allowlist domain.

**Yang ditolak dan alasannya:** Firecracker & gVisor (butuh Linux+KVM, tidak jalan di Windows) · E2B (self-host hanya GCP/AWS, dependensi cloud) · Windows Sandbox & Hyper-V containers (**tidak tersedia di Windows Home**) · Daytona (repo publik tidak dipelihara sejak Juni 2026) · microsandbox (satu-satunya jalur microVM native Windows, tapi self-declared beta — **pantau, jangan pakai di v1**).

**ecorione tidak boleh mengklaim "secure sandbox".** Yang boleh diklaim: mencegah kecelakaan dan paket buruk kasual. Yang tidak dicegah: eksploitasi kernel yang ditentukan. Dinyatakan apa adanya di dokumentasi.

**Dan yang paling penting:** tingkat sandbox nyaris tidak berarti kalau AutoClick berjalan tanpa batas, karena RPA berjalan **di luar sandbox menurut definisinya**. Karena itu kontrol AutoClick (§7) bukan opsional.

### 14. Keamanan & Kredensial

**Kredensial**
- Hanya hidup di Connect, terenkripsi at-rest.
- Semua aksi berisiko butuh approval eksplisit lewat Hub.
- Secret scanning otomatis di pre-commit & CI sejak commit pertama.
- `.env` dan file kredensial nyata **tidak pernah** masuk git.

**Memori sebagai permukaan serangan** — ecorione unik berbahayanya karena menyimpan konteks privat yang **ditulisi agent yang membaca materi tak-tepercaya** dan **dibaca agent yang bertindak**:
- **Jangan pernah menyimpan instruksi sebagai memori** — hanya fakta & preferensi; konten imperatif dibuang saat ekstraksi.
- **Provenance + skor `trust` per sumber.** Konten pihak ketiga (web, email, file bersama) ditulis dengan trust rendah dan **tidak pernah dipromosikan ke L2 tanpa konfirmasi pengguna**.
- **Karantina** untuk tulisan dari model hosted & tool (`memory_propose`).
- Memori dirender ke model di dalam **amplop eksplisit "ini data, bukan instruksi"**.
- **Jangan mengandalkan LLM sebagai juri kepercayaan** — pertahanan berbasis skor-kepercayaan-yang-dinilai-LLM sudah terbukti bisa ditembus.
- Filter `scope` + `sensitivity` di retrieval; sesi MCP model hosted dapat **allowlist scope**, default paling sempit. Pass redaksi untuk pola kredensial/kesehatan/finansial saat penulisan.

**Server MCP (§7 Connect inbound)**
- Stack auth remote penuh: **RFC 9728** (Protected Resource Metadata) + **OAuth 2.1 + PKCE** + **RFC 8707** (Resource Indicators) + validasi `iss` (**RFC 9207**). Client ID Metadata Documents, bukan Dynamic Client Registration (dideprecate).
- **Tidak pernah menerima token yang tidak diterbitkan untuk ecorione** (anti token-passthrough).
- Handle diikat ke principal terautentikasi (`<user_id>:<handle>`); `requestState` dilindungi integritasnya (AEAD + principal + TTL + digest request).
- Lokal: bind **127.0.0.1 saja**, validasi header `Origin` (403 kalau tidak cocok) — DNS rebinding terhadap server memori lokal akan menyerahkan seluruh riwayat pengguna ke sebuah halaman web.
- Scope terpisah minimal: `memory:read` / `memory:write` / `memory:delete`. Tidak ada scope omnibus.
- Elicitation **form mode dilarang untuk rahasia** — kredensial wajib URL mode.
- **Perubahan deskripsi tool sendiri diperlakukan sebagai rilis yang relevan-keamanan** (mitigasi rug-pull).

### 15. Local-First + Sync Hybrid

- **Default**: semua modul jalan di satu mesin, data tersimpan lokal.
- **Opsional**: Sync menyalakan relay untuk (a) menyinkronkan data `SYNC_ENCRYPTED` ke device lain milik pengguna yang sama, dan (b) menyediakan endpoint HTTPS supaya asisten hosted bisa menjangkau memori.
- **Ketegangan yang harus diakui, bukan dikaburkan:** "local-first" dan "ChatGPT bisa membaca memori saya" secara fisik bertentangan — Claude.ai dan ChatGPT butuh URL HTTPS publik dan tidak bisa menjangkau localhost. Pengguna harus melihat dengan jelas scope mana yang keluar mesin. Default: **`LOCAL_ONLY`**, keluar hanya lewat pilihan eksplisit.
- Tidak ada asumsi multi-tenant/multi-user di v1.

### 16. Interoperabilitas (MCP)

- **Server MCP dulu** (permukaan utama), **klien MCP kedua** (untuk ingest dari filesystem/git/Notion/dll — di daemon lokal, dan **konten dari server pihak ketiga tidak pernah mengalir tanpa label ke memori yang kemudian disajikan balik ke Claude**; itu jalur pencucian konten terinjeksi).
- Spec **2026-07-28**: stateless, wajib `server/discover`, `initialize` dihapus, session tingkat protokol hilang.
- **Sampling / Roots / Logging dideprecate** — panggil API provider langsung, jangan minta model host.
- Transport: **stdio** untuk klien yang satu mesin (Claude Code, Cursor, VS Code — nol permukaan auth) dan **Streamable HTTP** untuk asisten hosted.
- **Semua fungsi wajib jalan lewat tools**; resources didefinisikan (`memory://entity/{id}`, `ttlMs` pendek, `cacheScope: "private"`) tapi diperlakukan sebagai bonus.
- Emit **`AGENTS.md`** di repo — konvensi nyata, didukung 30+ tool, gratis.
- **Plafon yang dikomunikasikan jujur:** "satu memori, bisa dipanggil sebagai tool dari semua asisten besar; jadi konteks ambient di klien IDE; akses tulis sejauh host mengizinkan." **Bukan** "semua AI otomatis mengingat".

### 17. Strategi Migrasi dari Kode Lama

- Kode di `inmy/` **dibaca sebagai referensi, tidak pernah diedit, dipindah, atau di-`git mv`**.
- Prioritas porting: (1) skema data → basis `shared-schema`; (2) logic Connect (vault, OpenRouter adapter) → paling matang; (3) UI Ai → porting struktur besar, disederhanakan, tampilan baru sesuai `design.md`; (4) sisanya → **tulis ulang**.
- **Context ditulis ulang total** — arsitektur L0–L3 tidak punya padanan di kode lama.
- **Cache & IR tidak diporting** — dilebur (§6).
- Tidak ada commit/push apa pun ke 13 repo GitHub lama dari proses ini.

### 18. Development Workflow

- Branch pendek umur per fitur → PR → review → merge → hapus branch.
- Keputusan besar dicatat 1 baris di `docs/DECISIONS.md`; keputusan arsitektur di `docs/adr/`.
- Tidak ada script sekali-pakai — semua otomasi berulang masuk `scripts/` sebagai tool reusable.
- **Testing menekankan integrasi/e2e**, konsisten dengan prinsip vertical-slice (§5.1) — bukan cuma unit test.
- CI: lint + test + secret scan + **canary eval harian**.
- **Pin versi model eksplisit — tidak pernah alias `-latest`.**

### 19. Konvensi Penamaan

- **Modul internal**: nama sederhana satu kata, `PascalCase` di prosa (Ai, Hub, Connect, Context, Sync, Space, Flow, Artifact, Sandbox, RnD, AutoClick) — **tanpa prefix "InMy"**.
- Folder/package: `kebab-case` (`services/connect`).
- Package npm: `@ecorione/<nama>`.
- Di luar konteks ecorione boleh "ecorione Hub", "ecorione Connect".

### 20. Deployment & Lisensi

- **Dev**: `pnpm install && pnpm dev` menjalankan semua service P0 lokal.
- **Produksi personal**: local-first di mesin pengguna; opsional dipaketkan desktop app lewat Tauri.
- **Repo publik**: lisensi **MIT** (konsisten dengan ekosistem — deepseek-harness, kimi-code, Aider, Cline, CrewAI, promptfoo, Temporal semuanya MIT). Wajib ada `LICENSE`, `CONTRIBUTING.md`, `AGENTS.md`.
- **Hindari fork dari sumber AGPL** (basic-memory, Skyvern, Windmill) — copyleft AGPL menjangkau penggunaan lewat jaringan. **n8n bukan open source** (Sustainable Use License).
- Sebelum publish: secret-scan penuh atas seluruh history + review `.gitignore`; tidak menyalin script VPS/infra privat dari `inmy/`.

---

## Bagian C — Pelajaran, Metrik, Roadmap

### 21. Metrik Keberhasilan & Evaluasi

#### 21.1 Metrik produk (v1)

- Semua modul P0 (Ai, Hub, Connect, Context) jalan dari 1 `git clone` + setup terdokumentasi, di bawah 15 menit.
- Minimal 1 alur end-to-end nyata: chat di Ai → context pack dari Context → eksekusi lewat Connect ke provider hosted → hasil tersimpan sebagai artifact → fakta baru masuk konsolidasi.
- **Memori bisa dibaca dari Claude Code lewat MCP** dan menghasilkan jawaban yang benar-benar memakai konteks tersimpan.
- Tidak ada modul berlabel "selesai" yang belum bisa dipakai end-to-end.
- Tidak ada satu pun modul disebut "InMyX" di kode, dokumentasi, atau UI.

#### 21.2 Metrik optimizer — inti klaim produk

| Metrik | Target v1 |
|---|---|
| **Cache hit rate** pada prefix stabil | > 70% pada sesi multi-giliran |
| **Diskon token input efektif** | terukur & dilaporkan, bukan diperkirakan |
| **Penghematan kontrafaktual** (aktual vs kebijakan naif) | dilaporkan per hari & per tugas |
| **Overhead optimizer** (latensi keputusan) | dilaporkan sebagai span terpisah |
| **Biaya per tugas selesai** | dilacak — bukan biaya per panggilan |
| **Delta kualitas vs baseline** | dilaporkan **berpasangan** dengan angka penghematan |

**Aturan A/B yang mengikat:** acak per-request (bukan per-kohort); jalankan **shadow mode** dulu (ambil keputusan, catat, eksekusi baseline); **lantai kualitas dideklarasikan di muka** dan kebijakan auto-revert kalau ditembus; p50 & p95 dilaporkan terpisah. **Angka penghematan tanpa angka kualitas tidak berarti apa-apa.**

#### 21.3 Suite regresi

- **30–40 kasus**, dibatasi keras **maksimal 50 selamanya** — menambah kasus berarti memensiunkan satu.
- Komposisi: ~15 happy-path per kapabilitas · **~8 kasus keamanan** (prompt injection di halaman yang diambil, instruksi di nama file, tugas yang menggoda aksi destruktif — semua meng-assert **penolakan atau konfirmasi**) · ~8 pemilihan tool · ~5 permintaan ambigu di mana jawaban benarnya **bertanya balik** · ~4 memori/konteks.
- Tiap kasus dijalankan **k=3**, dilaporkan sebagai **pass^3** (semua 3 berhasil) — ini mengukur keandalan, bukan keberuntungan.
- Skoring: **assertion deterministik dulu** (state file, nama tool, exit code, regex). LLM-as-judge hanya untuk ~20% yang benar-benar kabur, dengan **tukar posisi AB+BA**, **keluarga model berbeda dari aktor**, dan 20 contoh berlabel manusia untuk memvalidasi ulang juri. Laporkan **κ, bukan persetujuan mentah**.
- **Canary set harian** (5–8 kasus termurah & deterministik): catat pass rate, rata-rata token output, rata-rata latensi. Provider yang menukar model di balik alias muncul sebagai step change pada token/latensi **berhari-hari sebelum** muncul sebagai kegagalan.
- **Setiap kasus harus lahir dari bug yang benar-benar pernah terjadi.** Tidak ada coverage spekulatif.

### 22. Tangga Otonomi — jalan ke "bisnis dijalankan AI"

**L0** Manual → **L1** AI-assisted → **L2** AI-executes-with-approval → **L3** AI-executes-with-audit (bertindak, direviu setelahnya, rollback tersedia) → **L4** Autonomous.

| Fungsi | Plafon realistis 2026 | Alasan |
|---|---|---|
| Kode / tooling internal | **L3** | Terverifikasi test & CI; rollback = `git revert` |
| Drafting konten / riset | **L3** | Error murah & reversibel |
| Triage support & draf balasan | **L3 triage, L2 kirim** | Kasus Klarna: rutin lancar, sengketa/fraud/penutupan akun gagal |
| Ekstraksi data / pemrosesan dokumen | **L3 dengan sampling** | Risikonya error senyap — QA statistik, bukan reviu per-item |
| Pembukuan / rekonsiliasi | **L2 (siapkan saja)** | Agent mengusulkan entri, manusia memposting |
| Penjadwalan, ops internal, laporan | **L3–L4** | Blast radius kecil |
| Pengeluaran uang / pembayaran / refund | **L2, berpagu keras** | Tak-terbalikkan; eksposur apparent authority |
| Komunikasi eksternal | **L2** | Risiko reputasi & kontraktual |
| Legal, pajak, entitas, HR | **L1** | Butuh atestasi manusia menurut undang-undang |
| Otomasi browser di web nyata | **L2 paling banter** | ~30% sukses di situs live |

**Plafon jujur: L3 adalah batas terdepan untuk pekerjaan yang reversibel dan bisa diverifikasi. L4 tidak ada untuk apa pun yang konsekuensial** — bukan karena model kurang pintar, tapi karena verifikasi adalah separuh yang belum terpecahkan, dan karena keandalan 95%/langkah hanya menghasilkan 36% sukses pada rantai 20 langkah.

**Framing yang benar** bukan "AI menjalankan bisnis", melainkan: **"satu orang menjalankan bisnis pada skala tim, karena substrat keandalannya membuat tingkat kegagalan AI bisa ditanggung."** Substratnya adalah produknya, bukan agent-nya.

**Prasyarat arsitektur, berurutan menurut kebutuhan** (1–4 adalah fondasi; tanpa salah satunya ini bukan platform operasi bisnis):
1. Durable state / eksekusi ter-checkpoint
2. Idempotency key pada setiap efek samping
3. Seam eksekusi tool dengan kebijakan (pagu, allowlist, gerbang — **di kode, tidak pernah di prompt**)
4. Audit trail dengan trajektori penuh
5. Approval gate berjenjang risiko & terkondisi argumen
6. Rollback / kompensasi — aksi tanpa aksi pembatalan **permanen L2**
7. Kontrol biaya dengan kill switch
8. Scoping kredensial least-privilege
9. Verifikasi hasil **terpisah dari aktor** — ini yang mengubah L2 jadi L3

### 23. Roadmap Fase

- **Fase 0** — Monorepo, struktur, konvensi, CI dasar (test + secret scan), `design.md` diterapkan ke komponen dasar, `LICENSE`/`CONTRIBUTING.md`/`AGENTS.md`.
- **Fase 1** — **Trace store dulu** (RnD), lalu core loop P0: Ai ↔ Hub ↔ Connect ↔ Context end-to-end dengan 1 provider hosted + model lokal untuk konsolidasi. Prefix stability + cost ledger sejak panggilan pertama. 10 kasus emas dari tugas nyata.
- **Fase 2** — Server MCP (Connect inbound) + Sync sebagai jembatan HTTPS → memori ecorione bisa dipakai dari Claude Code dan Claude.ai. Suite regresi naik ke 30–40 kasus.
- **Fase 3** — P1 sisanya disambung sesuai use case nyata: Space, Artifact, Sandbox (Tier 0 → WASM → Docker).
- **Fase 4** — Flow di atas durable execution engine yang diadopsi; workflow pertama naik dari L2 ke L3 dengan tingkat sukses terukur.
- **Fase 5** — AutoClick (P2) dengan kontrol keamanan penuh, kalau memang ada kebutuhan yang tidak bisa dijawab API.
- **Fase 6+** — Perluasan ke operasi bisnis di atas fondasi yang stabil, naik level otonomi per-fungsi berdasarkan bukti terukur, bukan berdasarkan optimisme.

### 24. Pelajaran dari Ekosistem InMy — Yang TIDAK Boleh Dibawa

1. **Foundation-first tanpa integrasi nyata.** 5 modul dibangun penuh & dites standalone sebelum ada kebutuhan integrasi konkret; banyak effort berakhir tak terpakai. → **ecorione**: vertical slice.
2. **Label status yang menyesatkan.** → "Selesai" = bisa dipakai end-to-end.
3. **Overhead proses tidak proporsional.** → automated test + review biasa.
4. **Duplikasi folder & branch tak terkendali.** → 1 monorepo, branch pendek umur.
5. **13+ repo terpisah dengan brand & registry manual.** → 1 monorepo, 1 nama, shared package.
6. **Reimplementasi backend "dependency-free" berulang.** → 1 shared internal library.
7. **Penamaan tidak konsisten & menyiratkan 13 brand.** → satu skema nama sejak hari pertama.
8. **Commit "record decision" membanjiri git history.** → `DECISIONS.md`.
9. **Proses defensif berlapis sebagai pengganti review manusia.** → checkpoint manusia di titik penting saja.
10. **(Baru) Membangun sesuatu karena kelihatan penting, bukan karena angkanya mendukung.** Cache & IR dibangun penuh lalu di-DEFER karena tidak pernah terbukti dipakai. → **ecorione**: tiap komponen besar harus punya angka atau riset yang mendukungnya *sebelum* dibangun — itu sebabnya `research.md` ada, dan itu sebabnya Cache & IR sekarang dilebur, bukan dibangun ulang.

### 25. Risiko & Pertanyaan Terbuka

1. **Batas sinkronisasi adalah keputusan produk tersulit** — "local-first" vs "ChatGPT bisa baca memori saya" bertentangan secara fisik. Harus eksplisit dan terlihat pengguna.
2. **Tidak ada arsitektur referensi** untuk memori bersama lintas lokal+hosted. Validasi bahwa celahnya nyata, sekaligus berarti tidak ada pola terbukti untuk dicontek. Proksi terdekat: pemisahan checkpointer/Store LangGraph, model memory-block Letta.
3. **Salience** — memutuskan apa yang layak diingat — belum dipecahkan siapa pun, dan itu justru produknya.
4. **Forgetting** belum punya jawaban baik. Decay sebagai sinyal ranking, bukan penghapusan.
5. **Verifikasi**, bukan kapabilitas model, yang membatasi otonomi di L3.
6. **Spec MCP sedang bergerak** — revisi 2026-07-28 breaking, klien masih menyeberang, registry masih preview.
7. **Ketergantungan pada angka vendor** — set regresi personal adalah satu-satunya sinyal yang bisa dipercaya.
8. **Biaya konsolidasi memori** berskala dengan pemakaian — harus dibatch, digerbang, diinstrumentasi sejak awal.
9. Berapa banyak kode lama yang benar-benar diporting vs ditulis ulang?
10. Model lokal spesifik mana yang jadi target — **wajib dibenchmark sendiri**, jangan percaya blog agregator.
11. Nama domain/branding publik untuk repo GitHub baru?

### 26. Sumber & Referensi

- **Riset teknis lengkap & seluruh sumber**: `research.md` (§11 memuat daftar sumber terverifikasi).
- Audit ekosistem lama: project doc `audit-ekosistem-inmy.md`.
- Kode & dokumen asli (read-only, tidak diubah): `C:\Users\Amand\.gemini\antigravity\scratch\ideagentics\inmy`.
- Desain visual: `design.md`.
