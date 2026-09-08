# ecorione — Research & Technical Due Diligence

Status: **v1.0** — 2026-09-07
Tujuan dokumen: memastikan sebelum satu baris kode ditulis, bahwa (a) klaim "optimizer" ecorione benar-benar punya dasar terukur, (b) arsitekturnya berdiri di atas pola yang sudah terbukti, dan (c) visi "satu orang menjalankan bisnis dengan AI" dipetakan secara jujur — apa yang nyata sekarang, apa yang belum.
Dokumen pasangan: `prd.md` (produk + arsitektur teknis), `design.md` (identitas visual).

> **Aturan main dokumen ini:** setiap angka di sini punya sumber. Angka dari vendor ditandai sebagai klaim vendor. Yang tidak bisa diverifikasi ditandai eksplisit. Kalau riset ini bertentangan dengan asumsi awal di `prd.md` v1.0, riset yang menang — dan perubahannya dicatat di §9.

---

## 0. Ringkasan Eksekutif — 12 temuan yang mengubah desain

| # | Temuan | Dampak ke ecorione |
|---|---|---|
| 1 | Lever optimizer terkuat adalah **prompt caching** (hemat 60–85% biaya input, dari tabel harga resmi provider — bukan klaim performa), bukan model routing | Connect harus punya **prefix stability** sebagai requirement kelas satu. Ini inti optimizer. |
| 2 | **Model routing adalah lever terlemah** dan paling berisiko. Angka jujur RouteLLM: 1.41× (MMLU), 1.49× (GSM8K) — bukan 85%. Benchmark netral pernah menempatkan router komersial di peringkat 12 karena *menaikkan* biaya | Routing tetap ada, tapi **berbasis aturan deterministik** (sensitivitas, budget, butuh tool), bukan prediksi kualitas. Diturunkan dari "diferensiator utama" jadi pelengkap. |
| 3 | **Semantic caching berbahaya**: hit rate 10–20% untuk chat, mode gagalnya mengembalikan jawaban yang salah dengan percaya diri. GPTCache mati sejak Agustus 2024 | Modul **Cache dicoret sebagai modul**. Diganti exact-match hash cache di dalam Connect (aman, ~50 baris kode). |
| 4 | **Model lokal di RAM 8–16GB tidak bisa diandalkan untuk tool-calling.** Model <7B gagal sistematis pada JSON multi-tool; Q4_K_M adalah lantai kualitas | Peran model lokal diubah total: **classifier, extractor, summarizer, reranker** — bukan agent loop. Ini justru membuat arsitekturnya jujur. |
| 5 | Spec **MCP 2026-07-28 adalah penulisan ulang yang breaking**: stateless, `initialize` dihapus, **Sampling/Roots/Logging dideprecate** | Jangan pernah desain di atas Sampling. Wajib implement `server/discover`. |
| 6 | **Resources MCP praktis mati di luar IDE** — konektor Claude API cuma dukung tool call; ChatGPT dibatasi paket & mode (Pro = read/fetch saja, agent mode tidak pakai custom app sama sekali) | Klaim "semua AI bisa pakai memori gue" harus diturunkan jadi klaim yang jujur (§4.3). Semua fungsi wajib jalan lewat **tools**, resources cuma bonus. |
| 7 | **Asisten hosted tidak bisa menjangkau localhost** — Claude.ai & ChatGPT wajib HTTPS publik | Sync naik dari "nice-to-have" jadi **prasyarat pitch inti**: relay yang membuat memori lokal bisa dijangkau AI hosted. |
| 8 | Pola memori yang konvergen: **log append-only sebagai ground truth + tier turunan yang bisa dibangun ulang**, bi-temporal (invalidate, jangan hapus), retrieval hybrid BM25+vektor dengan **k kecil (5–10)** | §7/§13 Context di prd.md ditulis ulang total jadi arsitektur 4 tier konkret. |
| 9 | **Knowledge graph DB tidak sepadan** untuk sistem personal — mem0 sendiri menemukan varian graph cuma menambah ~2 poin | Ambil idenya (bi-temporal, entity resolution), tolak dependensinya. SQLite + sqlite-vec + FTS5. |
| 10 | **Firecracker, gVisor, E2B, Windows Sandbox semuanya gugur** untuk target Windows 11 Home 8–16GB. Yang tersisa: Docker+WSL2, dan WASM (Wasmtime) yang jalan native di Windows | Sandbox jadi bertingkat, dengan **WASM sebagai jalur default** (hemat RAM) dan Docker sebagai eskalasi. |
| 11 | **Yang benar-benar berbahaya bukan eksekusi kode, tapi RPA.** Agent yang bisa klik apa saja di desktop asli melewati semua sandbox | AutoClick **diturunkan dari P1 ke P2** + kontrol khusus (profil browser terpisah, allowlist aplikasi, konfirmasi sebelum aksi tak-bisa-dibatalkan). |
| 12 | Agent terbaik cuma menyelesaikan **30.3%** tugas bisnis multi-langkah realistis (TheAgentCompany); agent web di situs nyata **~28–30%**; Gartner memprediksi **>40%** proyek agentic dibatalkan sebelum akhir 2027 | Visi "bisnis dijalankan AI" dipetakan ke **tangga otonomi L0–L4**, dengan pengakuan jujur: **L3 adalah plafon 2026**, L4 tidak ada untuk hal yang konsekuensial. |

**Verdict satu kalimat:** klaim optimizer ecorione **substantif dan bisa dibuktikan angkanya** — tapi lewat lever yang membosankan (disiplin cache, isolasi konteks, akuntansi biaya), bukan lever yang biasa dijual orang (routing pintar, semantic cache). Dan fondasi untuk "bisnis dijalankan AI" bukan agent-nya, melainkan **substrat keandalannya**: durable execution, idempotency, approval gate, audit trail.

---

## 1. Metodologi & Verifikasi Sumber

Riset dijalankan 2026-09-07 lewat 5 jalur paralel: (1) arsitektur memori & context engineering, (2) MCP & protokol interop, (3) mesin optimizer (routing/cache/biaya), (4) sandbox & evaluasi, (5) jalur bisnis-dijalankan-AI. Semua repo yang dirujuk diverifikasi URL, lisensi, dan status pemeliharaannya. Repo berbayar/tertutup tidak dipakai sebagai referensi arsitektur.

**Repo & sumber yang gugur dari pertimbangan setelah verifikasi:**

| Sumber | Alasan gugur |
|---|---|
| **Daytona** (72k★) | Sejak Juni 2026 development pindah ke codebase privat; repo publik tidak lagi menerima update/fix/rilis |
| **GPTCache** (8.1k★, MIT) | Rilis terakhir v0.1.44, Agustus 2024 — mati 2 tahun |
| **HumanLayer** (11.3k★) | README sendiri menyatakan "the code here is pretty much all deprecated" |
| **OpenMemory** (mem0) | README memuat notice sunsetting |
| **LangMem** (MIT) | PyPI berhenti di 0.0.30, Oktober 2025 — dorman |
| **Zep Community Edition** | Dihentikan April 2025; kode tetap Apache-2.0 tapi tak dipelihara (Graphiti yang masih hidup) |
| **RouteLLM** (5.3k★, Apache-2.0) | Artefak riset, 175 commit — bukan dependensi produksi |
| **Temporal Agent Harness** | Temporal sendiri: "earlier than public preview. The APIs will change" |
| **microsandbox** (8.1k★, Apache-2.0) | Satu-satunya jalur microVM native Windows (libkrun+WHP), tapi self-declared **beta** — pantau, jangan pakai untuk v1 |

**Catatan lisensi yang penting untuk repo publik ecorione:** hindari fork dari **basic-memory (AGPL-3.0)**, **Skyvern (AGPL-3.0)**, **Windmill (AGPLv3)** — copyleft AGPL menjangkau penggunaan lewat jaringan. **n8n bukan open source** (Sustainable Use License / "fair-code"). **Inngest SSPL**, **Restate BSL 1.1**. Yang aman untuk dipelajari/diadopsi: Temporal (MIT), Trigger.dev (Apache-2.0), Activepieces community (MIT), promptfoo (MIT), Wasmtime (Apache-2.0), Graphiti (Apache-2.0), LiteLLM (MIT core).

**Peringatan khusus LiteLLM:** batas MIT vs `enterprise/` ternyata kabur secara legal — issue #34241 mendokumentasikan ~19 fitur yang dipasarkan sebagai Enterprise tapi **nol import** dari direktori enterprise (jadi MIT menurut LICENSE repo sendiri), dan ~8 fitur yang cuma digerbang di frontend. Kesimpulan: **jangan bangun produk di atas asumsi sebuah fitur LiteLLM akan tetap MIT.** Ambil `model_prices_and_context_window.json` (tabel harga publik terbaik yang ada, MIT) dan SDK-nya; jangan jalankan proxy-nya.

---

## 2. Apakah "optimizer" ecorione benar-benar berguna?

Ini pertanyaan paling penting di seluruh dokumen, karena kalau jawabannya "tidak", nama produknya bohong.

**Jawaban: ya, tapi hampir seluruh nilainya datang dari lever yang tidak seksi.** Peringkat berikut disusun berdasarkan *dampak × tingkat keyakinan*, bukan berdasarkan seberapa menarik untuk dijual.

### Peringkat lever optimizer

| Lever | Penghematan realistis | Keyakinan | Risiko | Putusan v1 |
|---|---|---|---|---|
| **(a) Prompt caching** | **60–85% biaya input** | Sangat tinggi — aritmetika dari tabel harga resmi | Hampir nol | **Bangun pertama** |
| **(b) Isolasi konteks / sub-task** | **30–60%** pada tugas panjang, **plus kenaikan kualitas** | Tinggi — studi independen 18 model | Rendah | **Bangun** |
| **(c) Reduksi katalog tool & konteks** | 0–90% (sangat tergantung jumlah tool) | Sedang | Rendah–sedang | **Bangun bertahap** |
| **(d) Model routing lokal↔hosted** | 0–40% | **Rendah** | **Tinggi** | Aturan deterministik saja |
| **(e) Semantic caching** | 10–20% | Rendah | **Tertinggi** | **Dicoret dari v1** |

### 2.1 Prompt caching — lever terkuat, dan ini murni aritmetika

Angka dari halaman harga resmi, bukan klaim performa:

| Provider | Biaya tulis cache | Biaya baca cache | Minimum token | TTL |
|---|---|---|---|---|
| **Anthropic** | 1.25× (TTL 5 menit) / 2× (1 jam) | **0.1×** | 512–4.096 (umumnya 1.024) | 5 menit / 1 jam |
| **OpenAI** | **tanpa premi** (otomatis, default menyala) | **0.1×** | 1.024 (2.048 model lama) | ~30 menit default |
| **DeepSeek** | otomatis | **0.1×** ($0.014 vs $0.14 per juta) | granularitas 64 token | jam–hari |
| **Gemini** | implicit caching default (2.5+) | otomatis | 2.048–4.096 | — (explicit caching ada biaya storage) |

**Matematika titik impas (Anthropic, TTL 5 menit):** satu penulisan cache menambah biaya 0.25×, tiap pembacaan menghemat 0.9× → impas di **0.28 kali baca**. Artinya *satu hit saja sudah membayar penulisannya*. Untuk prefix yang dipakai ulang N kali: `1.25 + 0.1N` versus `N + 1`. Pada N=10 → 2.25 vs 11.0 = **hemat 80%**; N=20 → **84%**; asimtot **90%**.

**Implikasi arsitektur — ini yang jadi requirement kelas satu di `prd.md`:** cache dicocokkan lewat *hash prefix*. Satu timestamp, satu request-ID, satu string yang berubah-ubah di dalam system prompt = **cache tidak pernah kena, tanpa error apa pun**. Hierarki invalidasi Anthropic: `tools` → `system` → `messages`; **mengubah definisi tool membatalkan semuanya**. Maka:

- **Prefix stabil** (system prompt + definisi tool + blok memori inti) harus dijamin byte-identik antar panggilan, dengan cache breakpoint tepat di ujungnya.
- Semua yang dinamis (hasil retrieval, timestamp, hasil tool) **wajib di belakang breakpoint**.
- Definisi tool tidak boleh berubah di tengah sesi.
- **Konsekuensi keras:** kompresi prompt (LLMLingua-2) menghasilkan teks non-deterministik yang **menghancurkan prefix caching**. Keduanya saling meniadakan pada prefix yang sama — dan caching jauh lebih menguntungkan. Kompresi hanya boleh dipakai pada ekor dinamis (dokumen besar yang di-paste), tidak pernah pada prefix stabil.

### 2.2 Isolasi konteks — lever kedua, dan ini soal kualitas bukan cuma biaya

Studi **Context Rot** dari Chroma menguji **18 model** (GPT-4.1, Claude 4, Gemini 2.5, keluarga Qwen3). Temuan yang harus menyetir desain:

- Performa **menurun seiring panjang input bahkan pada tugas trivial** (tugas mengulang kata: akurasi turun monoton dari 25 kata ke 10.000 kata).
- **Satu distraktor saja** sudah menurunkan akurasi secara terukur; beberapa distraktor memperburuk.
- Pada LongMemEval, model yang diberi potongan fokus **~300 token mengungguli dirinya sendiri** saat diberi percakapan penuh ~113k token — di semua keluarga model.
- Penurunan lebih parah saat kemiripan semantik antara pertanyaan dan target rendah.
- Kontra-intuitif: model justru lebih baik pada haystack yang diacak ketimbang yang koheren logis.

**Artinya konteks yang lebih banyak bukan konteks yang lebih baik.** Isolasi konteks (sub-task dapat konteks sempit, mengembalikan ringkasan) adalah **teknik kualitas yang kebetulan juga menghemat biaya** — ini pijakan yang jauh lebih kuat daripada sekadar argumen hemat token.

Anthropic memformalkan ini sebagai *attention budget*, dengan resep: **compaction** (ringkas riwayat sambil mempertahankan keputusan arsitektural, bug yang belum selesai, detail implementasi — lalu lanjut dengan ringkasan + beberapa berkas terakhir), **structured note-taking** ke file di luar context window, **sub-agent** yang mengembalikan ringkasan 1–2k token, dan **just-in-time retrieval** (agent memegang identifier ringan — path, URL, query — lalu memuat isinya saat perlu).

### 2.3 Reduksi katalog tool — nyata, tapi angkanya sering disalahpahami

Anthropic melaporkan **150.000 → 2.000 token (98.7%)** lewat pola "code execution instead of tool calls". **Angka ini harus dibaca hati-hati:** yang diukur adalah *overhead definisi tool pada katalog yang sangat besar*, bukan penghematan end-to-end. Validasi komunitas melaporkan 99.2% pada 112 definisi tool tapi **92.5% pada "percakapan tipikal"**, dan seorang maintainer MCP mengkritik metodologinya (tidak ada metode penghitungan token yang dinyatakan).

**Pelajaran strukturalnya tetap sahih dan itu yang dipakai:** kalau kamu punya 5 tool, ini tidak menghemat apa pun; kalau punya 100, ini menghemat sangat banyak. → ecorione memakai **progressive tool disclosure** hanya kalau katalog tool melewati ~20.

### 2.4 Model routing — lever terlemah, diturunkan derajatnya

Klaim populer RouteLLM adalah "85% pengurangan biaya sambil mempertahankan 95% performa GPT-4". Angka sebenarnya dari papernya (metrik CPT — berapa persen panggilan harus ke model kuat untuk mencapai x% performa):

| Benchmark | Reduksi biaya vs random | Pada kualitas |
|---|---|---|
| MT-Bench (subjektif, chat) | **3.66×** | 95% |
| MMLU (5-shot) | **1.41×** | 92% |
| GSM8K (8-shot) | **1.49×** | 87% |

Angka 85% itu adalah kasus terbaik pada benchmark yang paling menguntungkan metodenya. **Beban kerja agent jauh lebih mirip GSM8K daripada MT-Bench.** Lebih keras lagi: benchmark netral **RouterArena** menempatkan sebuah router komersial terkemuka di **peringkat 12**, justru karena *terlalu sering memilih model mahal* — yaitu router itu **menaikkan** biaya dibanding kebijakan statis yang masuk akal. Routing juga tidak gratis: ~100–200ms latensi tambahan per keputusan.

**Keputusan ecorione:** routing tetap ada, tapi **hanya berbasis sinyal murah dan bisa diverifikasi** — kelas sensitivitas data, status budget, apakah tugas butuh tool calling, panjang konteks, kebutuhan latensi. **Tidak ada prediktor kualitas yang dilatih.** Dan gerbang sensitivitas dievaluasi lebih dulu, tidak pernah ditukar dengan biaya. Ini justru satu-satunya tempat optimizer personal punya nilai yang bukan soal biaya: **"data ini tidak boleh keluar dari mesin ini"** adalah aturan yang tidak bisa diberikan provider mana pun.

### 2.5 Semantic caching — dicoret dari v1

Angka "95%" yang beredar luas itu adalah **akurasi pencocokan, bukan hit rate**. Hit rate nyata yang dipublikasikan:

| Beban kerja | Hit rate |
|---|---|
| FAQ / support | 40–60% |
| Pipeline klasifikasi | 50–70% |
| RAG | 15–25% |
| **Chat terbuka (= kasus ecorione)** | **10–20%** |

Mode gagalnya: query identik yang bergantung konteks mengembalikan jawaban milik konteks lain; respons kedaluwarsa untuk hal yang sensitif waktu; **drift model embedding membatalkan seluruh cache secara diam-diam**; dan **cache poisoning** — satu halusinasi diperkuat ke semua query serupa. Threshold produksi yang dilaporkan: 0.92.

**Keputusan:** ganti dengan **exact-match cache** (hash request yang sudah dinormalisasi). Itu menangkap trafik retry/regenerate/duplikat dengan **risiko kebenaran nol**, dan implementasinya sepele. Semantic caching hanya boleh masuk nanti di balik flag, untuk subset berbentuk FAQ, threshold ≥0.92, tidak pernah untuk hal yang spesifik-pengguna atau sensitif waktu.

### 2.6 Apa yang harus diukur supaya klaim "optimizer" bisa dibuktikan

Klaim "gue mengoptimalkan" cuma berarti kalau ada **baseline tandingan**. Yang wajib dicatat per panggilan:

- `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`, plus atribut sendiri untuk `cache_read_tokens` / `cache_write_tokens` (konvensi OTel belum memodelkan token ter-cache).
- **Biaya dihitung dua kali**: biaya aktual, dan **biaya kontrafaktual** — berapa request yang sama ini akan berbiaya di bawah kebijakan naif (tanpa cache, model kuat default). **Selisihnya adalah satu-satunya angka penghematan yang jujur.**
- Latensi, TTFT, dan **overhead optimizer sebagai span-nya sendiri** — latensi keputusan routing harus dibebankan ke optimizer, bukan disembunyikan.
- Keputusan rute + versi kebijakan + **alasan** (aturan mana yang menyala).

Cara A/B yang jujur: acak **per-request** (bukan per-kohort, karena kualitas routing berkorelasi dengan kesulitan tugas); jalankan **shadow mode** dulu (ambil keputusan, catat, tapi eksekusi baseline); pasang **lantai kualitas yang dideklarasikan di muka** dan auto-revert kalau ditembus; laporkan p50 dan p95 terpisah; dan yang paling sering dilupakan — **ukur biaya per tugas selesai, bukan per panggilan**, karena model murah menghasilkan lebih banyak giliran, yang bisa menghapus seluruh penghematannya.

**Catatan standar:** semua atribut `gen_ai.*` OpenTelemetry masih berstatus *Development* (belum stable), sudah ada rename breaking (`gen_ai.system` → `gen_ai.provider.name`, `prompt_tokens` → `input_tokens`), dan **tidak ada atribut biaya standar** — biaya harus dihitung sendiri dari token × tabel harga.

---

## 3. Memori & Context Engineering

Ini pilar identitas ecorione, jadi bagian ini paling detail.

### 3.1 Yang dipakai pemain lain

| Proyek | Lisensi | Status | Ide yang layak diambil |
|---|---|---|---|
| **Letta** (eks MemGPT) | Apache-2.0, ~24.6k★ | Aktif (pindah ke `letta-code`; paket server melambat sejak Mei 2026) | **Memory block** (label, description, value, **limit karakter**, read_only) yang selalu di konteks; **archival memory** terpisah; **sleep-time compute** — agent kedua yang menulis ulang memori secara asinkron di luar jalur latensi |
| **mem0** | Apache-2.0, ~64.3k★ | Aktif (v2.0.20, Sept 2026) | Fase update `ADD`/`UPDATE`/`DELETE`/`NOOP` terhadap memori serupa; retrieval multi-sinyal (semantik + BM25 + entity match) |
| **Graphiti** (Zep) | Apache-2.0, ~29k★ | Aktif | **Bi-temporal**: `t_created`/`t_expired` (kapan sistem tahu) vs `t_valid`/`t_invalid` (kapan benar di dunia). Kontradiksi → edge lama **di-invalidate, bukan dihapus**. Retrieval = cosine + BM25 + traversal, difusi RRF |
| **LangGraph** | MIT | Aktif | Pemisahan **checkpointer** (state per-thread, jangka pendek, bisa resume/time-travel) vs **Store** (lintas-thread, jangka panjang, namespace tuple + embedding opsional) |
| **Memobase** | Apache-2.0, ~2.8k★ | Aktif | Sengaja **bukan vector-first**: profil pengguna terstruktur + timeline event di Postgres, retrieval beberapa operasi SQL <100ms, konsolidasi batch |
| **cognee** | Apache-2.0, ~30.3k★ | Aktif | Pipeline ECL; bisa dikolapskan ke satu Postgres |
| **Supermemory** | MIT, ~29.2k★ | Aktif | Penanganan eksplisit perubahan temporal, kontradiksi, dan **forgetting otomatis** |

**Catatan kejujuran angka:** klaim mem0 (+26% vs OpenAI memory, >90% hemat token, 91% lebih rendah p95 latensi) berasal dari paper mereka sendiri di benchmark LOCOMO, dan skor terbaru yang mereka publikasikan **adalah skor platform berbayar**, bukan versi OSS. LOCOMO sendiri sudah dikritik akademis karena terlalu sempit-faktual. **Perlakukan semua leaderboard memori sebagai materi pemasaran.**

### 3.2 Arsitektur memori ecorione — konkret

Empat tier di atas satu log, semuanya dalam **satu file SQLite**. Keputusan struktural terpenting: **log adalah ground truth; semua tier lain adalah proyeksi turunan yang bisa dibangun ulang.** Kalau konsolidasi menulis fakta yang salah, tier turunannya bisa dihapus dan diturunkan ulang.

**L0 — Log episodik (append-only, tidak pernah diedit).** Tiap giliran, tool call, event file. Kolom: `source_app` (ai/claude/chatgpt/ollama/cli), `session_id`, `ts`, `raw_text`, `provenance`. **Tidak di-embed secara default** — meng-embed tiap giliran adalah tempat sistem lokal jadi mahal dan kualitas retrieval-nya mati. Yang di-embed hanya *ringkasan* episode.

**L1 — Fakta semantik.** Unit yang bisa diambil kembali. Skema kira-kira:
```
id, subject, predicate, object, text, embedding,
confidence, salience, source_episode_ids[],
t_valid, t_invalid, superseded_by, created_at,
scope, sensitivity, trust
```
Perhatikan `t_valid`/`t_invalid` — model bi-temporal Graphiti diambil **sebagai kolom, bukan sebagai graph database**.

**L2 — Memori inti / prosedural.** Blok yang **selalu ada di konteks**: identitas, preferensi stabil, gaya kerja, proyek aktif, instruksi tetap. **Dibatasi keras ~1.500 token** (ide `limit` dari Letta). Wajib berupa **file yang bisa dibaca dan diedit manusia**, bukan baris database buram — ini juga yang membuat Space punya peran nyata: Space adalah tempat pengguna mengedit blok ini.

**L3 — Artifact.** Dokumen, kode, catatan: disimpan sebagai file dengan indeks per-chunk, dijangkau lewat **just-in-time retrieval** (agent dapat path + deskripsi satu baris, membuka saat perlu). Ini peran modul Artifact.

**Working memory bukan tier** — ia adalah langkah *perakitan* di §3.2.2.

#### 3.2.1 Konsolidasi (promosi)

Dijalankan **di luar jalur panas** (pola sleep-time Letta), memakai **model lokal kecil** — dan inilah pekerjaan yang memang cocok untuk model 7–9B di laptop. Dipicu saat sesi berakhir atau timer idle, dan **dibatch** (pendekatan buffer Memobase memangkas panggilan LLM ~40–50%).

1. **Gerbang salience** — heuristik murah + classifier model kecil memutuskan apakah episode ini mengandung sesuatu yang layak diingat. **Sebagian besar percakapan bukan memori.**
2. **Ekstraksi** kandidat fakta, dengan `t_valid` eksplisit bila teksnya menyiratkan waktu.
3. **Resolusi** terhadap fakta yang sudah ada lewat hybrid search pada subjek/entitas yang sama. Kalau kontradiksi: **jangan hapus** — set `t_invalid` dan `superseded_by` pada baris lama, sisipkan yang baru. Kalau duplikat: naikkan `salience`, gabungkan provenance.
4. **Tulis ulang L2 hanya** kalau sebuah fakta melewati ambang kestabilan (terlihat N kali, atau dikonfirmasi pengguna). **Penulisan di jalur panas tidak pernah menyentuh L2.**

#### 3.2.2 Alur retrieval — merakit "context pack" terhadap anggaran token

Urutan tetap, batas tetap:

1. **Blok inti L2**, selalu, ~1.5k token. *(Ini bagian dari prefix stabil → masuk cache.)*
2. **Recall terkondisi query dari L1**: jalankan **FTS5 BM25** dan **KNN vektor** paralel, fusikan dengan **Reciprocal Rank Fusion**, filter `t_invalid IS NULL`, lalu rerank dengan `skor × peluruhan_recency × confidence`. Ambil top-k di mana **k kecil — 5 sampai 10, bukan 50.** Justifikasinya adalah temuan distraktor Chroma: fakta yang cuma agak relevan **aktif merusak**, bukan sekadar memboroskan token.
3. **Ringkasan episodik** untuk thread berjalan, dicompact begitu thread melewati ~60% window.
4. **L3 sebagai pointer saja** — path + deskripsi satu baris, dimuat saat diminta.

Keluarannya berupa seksi berlabel dengan **provenance dan timestamp pada setiap fakta**, dan apa yang disuntikkan **dicatat**. Provenance bukan opsional — itu yang membuat §3.4 bisa dikerjakan sama sekali.

#### 3.2.3 Cukup murah untuk jalan lokal

**SQLite satu file + `sqlite-vec` (vektor) + FTS5 (leksikal) + RRF.** Di bawah kira-kira sejuta fakta, ini mengalahkan vector DB khusus di semua sumbu yang relevan di sini: nol service, transaksi atomik yang mencakup metadata *dan* vektor sekaligus, backup sepele, sinkronisasi sepele.

Embedding: model 300M–600M parameter (kelas EmbeddingGemma-300m / BGE-M3 / Qwen3-Embedding-0.6B) lewat Ollama atau llama.cpp, dengan truncation Matryoshka ke 256 dimensi bila tersedia — memangkas ukuran indeks ~3× dengan kehilangan recall kecil. *(Peringkat model spesifik ini adalah titik awal untuk diukur, bukan hasil terverifikasi — wajib dibenchmark sendiri.)* Hanya fakta L1 dan ringkasan episode yang di-embed; teks mentah L0 tetap leksikal saja. Ini menjaga setahun pemakaian berat di kisaran ratusan MB.

### 3.3 Kenapa TIDAK pakai knowledge graph database

**Ambil idenya, tolak dependensinya.** Yang diambil dari Graphiti: validitas bi-temporal, invalidate-jangan-hapus, entity resolution, hybrid search tiga sinyal. Yang ditolak: Neo4j/FalkorDB sebagai dependensi, konstruksi graph oleh LLM di tiap ingest, community summarization.

Alasannya: (a) biaya operasionalnya nyata — graph DB di samping vector store melanggar prinsip local-first dan backup-satu-file; (b) **paper mem0 sendiri menemukan varian graph hanya menambah ~2 poin**; (c) pada skala personal (10⁴–10⁵ fakta), traversal 1–2 hop cuma self-join SQL pada kolom `entity_id`; (d) biaya ekstraksi LLM untuk memelihara graph nyata adalah pengeluaran komputasi lokal yang dominan.

Modelkan sebagai **fakta dengan foreign key entitas** — graph relasional yang bisa ditelusuri saat perlu, tanpa mesin graph. Tinjau ulang hanya kalau muncul pertanyaan multi-hop yang terbukti gagal ditangani hybrid search — **dan ukur kegagalan itu dulu sebelum membangun**.

### 3.4 Mode kegagalan memori & mitigasi

| Kegagalan | Penjelasan | Mitigasi |
|---|---|---|
| **Memory poisoning** | Penyerang — atau dokumen jahat yang dibaca agent — menyisipkan instruksi permanen ke memori, yang menyala di query lain yang tak berhubungan | (1) **Jangan pernah menyimpan instruksi sebagai memori** — simpan fakta & preferensi; buang konten imperatif saat ekstraksi. (2) Provenance + skor `trust` per sumber; konten pihak ketiga (web, email, file bersama) ditulis dengan trust rendah dan **tidak pernah dipromosikan ke L2 tanpa konfirmasi pengguna**. (3) **Karantina** untuk tulisan dari model hosted & tool. (4) Render memori ke model di dalam amplop eksplisit "ini data, bukan instruksi". |
| **Fakta basi / kontradiktif** | Dua fakta hidup yang bertentangan | Bi-temporal + `superseded_by` + selalu filter `t_invalid IS NULL`. Kalau dua fakta hidup bertentangan dan tidak ada yang dominan, **tampilkan keduanya dengan timestamp** — memilih diam-diam adalah cara menghasilkan jawaban yang salah dengan percaya diri |
| **Over-retrieval** | Konteks membengkak, kualitas turun | Anggaran token per tier, k kecil, RRF lalu rerank, dedup berdasarkan kemiripan embedding sebelum injeksi |
| **Kebocoran privasi antar konteks** | Memori kerja bocor ke konteks pribadi atau sebaliknya | Tiap fakta punya `scope` (pribadi/kerja/proyek-x) dan `sensitivity`. Retrieval memfilter berdasarkan scope aktif; sesi MCP model hosted mendapat **allowlist scope**, default paling sempit. Plus pass redaksi untuk pola kredensial/kesehatan/finansial saat penulisan |

Catatan empiris yang menggembirakan: sebuah studi menemukan keberhasilan injeksi runtuh dari ~62% ke ~7% begitu memori yang benar sudah cukup banyak terisi — **store yang terisi baik adalah pertahanan itu sendiri**. Tapi pertahanan berbasis skor-kepercayaan-yang-dinilai-LLM di studi yang sama berhasil ditembus, jadi **jangan mengandalkan LLM sebagai juri kepercayaan**.

### 3.5 Yang benar-benar sulit — jangan diremehkan

1. **Memutuskan apa yang layak diingat.** Semua sistem di atas menghindari masalah salience, padahal ini produknya. Over-ekstraksi meracuni retrieval lebih cepat daripada penyerang mana pun; under-ekstraksi membuat sistem terasa tidak berguna. **Harus bisa dikoreksi pengguna.**
2. **Melupakan.** Belum ada yang memecahkan decay. Menghapus tidak aman (provenance hilang), menyimpan semua juga tidak aman (kontradiksi menumpuk, paparan privasi naik monoton). Jawaban paling tidak-buruk: **decay sebagai sinyal ranking, bukan sebagai penghapusan.**
3. **Evaluasi.** Angka LOCOMO/LongMemEval dijalankan vendor, pada dialog sintetis, dan sebagian besar mengukur recall faktual. Itu **tidak akan memprediksi perilaku sistem sendiri.** Bangun set regresi personal ~100 pertanyaan nyata atas riwayat sendiri sejak hari pertama.
4. **Entity resolution.** "Alex yang mana?" — ini tempat kualitas ekstraksi sebenarnya hidup, dan ia memburuk secara diam-diam.
5. **Portabilitas antar model.** Memori yang terbaca baik oleh Claude bisa diabaikan oleh model lokal 8B dengan window 8–32k. Perlu **kebijakan context packing per-model** (anggaran, format, verbositas), bukan satu renderer.
6. **UX provenance.** Masalah non-teknis tersulit: pengguna harus bisa melihat, mengedit, dan menghapus apa yang sistem yakini tentang dirinya — kalau tidak, mereka tidak akan mempercayakan hal yang layak diingat.

---

## 4. Interoperabilitas: MCP (spec 2026-07-28)

### 4.1 Perubahan besar spec, dan apa artinya

Revisi **2026-07-28** adalah **penulisan ulang yang breaking**. Apa pun yang dibaca dari 2025 tentang MCP sekarang sebagian salah.

- **MCP sekarang stateless.** Handshake `initialize`/`notifications/initialized` dihapus. Tiap request membawa versi protokol dan kapabilitas klien di `_meta`.
- **Session tingkat protokol hilang** — `Mcp-Session-Id` dihapus. Server yang butuh state lintas-panggilan memakai **handle eksplisit yang dicetak server**, dilewatkan sebagai argumen tool biasa.
- **RPC baru wajib: `server/discover`** — server HARUS mengimplementasikannya untuk mengumumkan versi, kapabilitas, dan identitas.
- **Sampling, Roots, dan Logging dideprecate.** Migrasi yang disarankan spec, verbatim: *"integrate directly with LLM provider APIs instead of Sampling"*. **Ini koreksi desain paling penting** — jangan pernah membangun arsitektur di atas asumsi "server memori saya minta model host untuk meringkas". Panggil API provider (atau model lokal) langsung.
- **Sampling & Elicitation kini lewat MRTR** — server mengembalikan `InputRequiredResult`, klien mengumpulkan input dan **mengulang request** dengan id JSON-RPC baru. Server **HARUS** memperlakukan `requestState` sebagai dikendalikan penyerang dan melindunginya secara integritas (HMAC/AEAD + principal + TTL + digest request).
- **Elicitation form mode DILARANG untuk rahasia** — password, API key, token, kredensial pembayaran **HARUS** lewat URL mode.
- **Transport**: Streamable HTTP (POST-only, satu endpoint) + stdio. HTTP+SSE dideprecate. Resumability `Last-Event-ID` **dihapus**. Server **HARUS** memvalidasi header `Origin` (anti DNS rebinding) dan **SEBAIKNYA** hanya bind ke 127.0.0.1.
- **Otorisasi (HTTP)**: OAuth 2.1 wajib; **RFC 9728** (Protected Resource Metadata) wajib di server; **RFC 8707** (Resource Indicators) wajib di klien; RFC 9207 `iss` divalidasi; **RFC 7591 Dynamic Client Registration dideprecate** (diganti Client ID Metadata Documents). Server **TIDAK BOLEH** menerima token yang tidak diterbitkan untuk dirinya.
- **MCP Registry** masih **preview**, tanpa jaminan uptime atau durabilitas data.

### 4.2 Realitas dukungan klien

| Klien | Tools | Resources | Prompts | Elicitation | Transport |
|---|---|---|---|---|---|
| **Claude Code** | ✅ | ✅ (mention `@`) | ✅ (perintah `/`) | ✅ | stdio, HTTP, SSE, WS |
| **Claude.ai / Desktop (connector)** | ✅ | tidak terdokumentasi | tidak terdokumentasi | — | HTTPS remote |
| **Claude API MCP connector** | **✅ hanya ini** | ❌ | ❌ | — | Streamable HTTP + SSE, **tanpa stdio** |
| **VS Code Copilot** | ✅ | ✅ | ✅ | ✅ | stdio, HTTP, SSE |
| **Cursor** | ✅ | ✅ | ✅ | ✅ | stdio, SSE, Streamable HTTP |
| **ChatGPT** | ✅ (Developer Mode) | lewat idiom `fetch` | — | — | HTTPS remote |

Verbatim dari dokumentasi konektor Claude API: *"Of the feature set of the MCP specification, only tool calls are currently supported."*

ChatGPT: aplikasi MCP pihak ketiga di **Developer Mode** mendapat dukungan penuh termasuk aksi tulis — **tapi digerbang paket**: Business = admin/owner saja; Enterprise/Edu = admin/owner + anggota terpilih RBAC; **Pro = izin read/fetch saja**. **Deep research hanya read/fetch. Agent mode tidak akan memakai custom app sama sekali.**

### 4.3 Plafon jujur dari "semua AI bisa pakai memori gue"

Lebih rendah dari yang dijual pemasaran, dan patah di empat titik spesifik:

1. **Resources praktis mati di luar IDE.** Konektor Claude API cuma tool call. Jadi "memori saya adalah konteks ambient yang model otomatis punya" itu **salah** di dua permukaan hosted terbesar — yang benar adalah "model bisa memanggil fungsi search", yang secara UX jelas lebih buruk karena retrieval jadi tindakan diskresioner model.
2. **ChatGPT digerbang paket dan mode.** Tidak bisa menjanjikan jalur tulis yang berfungsi ke pengguna ChatGPT Plus konsumen hari ini.
3. **Asisten hosted tidak bisa menjangkau localhost.** Claude.ai dan ChatGPT butuh URL HTTPS publik. Jadi memori yang benar-benar local-first **harus** menjalankan tunnel/relay, atau menerima bahwa "local-first" berarti "lokal untuk Claude Code/Cursor/VS Code, tersinkron ke server untuk Claude.ai/ChatGPT". **Batas sinkronisasi itu adalah keputusan produk dan privasi tersulit di seluruh proyek, dan tidak ada fitur protokol yang menghapusnya.**
4. **Spec sedang di tengah migrasi.** Klien masih menyeberang antara era stateful dan stateless; harus mendukung keduanya selama jendela deprecation (minimum 12 bulan).

**Pitch yang jujur:** *"satu memori, bisa dipanggil sebagai tool dari semua asisten besar; jadi konteks ambient di klien IDE; akses tulis sejauh host mengizinkan."* Bukan "semua AI otomatis mengingat".

### 4.4 Keamanan MCP yang wajib sejak hari pertama

ecorione unik berbahayanya: ia **menyimpan konteks privat** yang **ditulisi agent yang membaca materi tak-tepercaya**, dan **dibaca agent yang bertindak**. Itu mesin pencucian prompt injection kalau tidak didesain melawannya.

- **Tool poisoning** (Invariant Labs, April 2025): instruksi tersembunyi di *deskripsi* tool — terlihat model, tak terlihat UI. Demo mereka mengekstrak `~/.cursor/mcp.json` (yang berisi kredensial server MCP *lain*) dan kunci SSH.
- **Rug pull**: server jahat mengubah deskripsi tool *setelah* klien menyetujuinya.
- **Cross-server shadowing**: satu server jahat menulis ulang perilaku server tepercaya.
- **Confused deputy** di proxy OAuth, **token passthrough**, **SSRF** saat discovery OAuth, **state handle hijacking**.

Yang wajib diterapkan: perlakukan setiap memori tersimpan sebagai **data tak-tepercaya selamanya**; jangan pernah mem-proxy token (validasi audience per RFC 8707); ikat setiap handle ke principal terautentikasi (`<user_id>:<handle>`); stack auth remote penuh (RFC 9728 + OAuth 2.1 + PKCE + RFC 8707 + RFC 9207); bind 127.0.0.1 + validasi `Origin`; jadikan tulis & hapus butuh konfirmasi; dan **perlakukan perubahan deskripsi tool sendiri sebagai rilis yang relevan-keamanan**.

---

## 5. Model Lokal: realitas hardware 8–16GB

Ini koreksi yang paling mengubah arsitektur, dan paling tidak menyenangkan.

**Kapabilitas runtime:**
- **llama.cpp** (`llama-server`): API REST OpenAI-compatible, **grammar GBNF** untuk constrained decoding, jalan di CUDA/ROCm/Metal/**CPU-only**. Ini substratnya — Ollama, LM Studio, GPT4All semuanya membungkus ini.
- **Ollama**: OpenAI-compatible di `localhost:11434/v1`, drop-in, dukung structured output JSON-schema dan tool calling.
- **vLLM**: **butuh CUDA NVIDIA dan ~16GB+ VRAM; tidak ada CPU-only, tidak ada Apple Silicon.** Keunggulan throughput 16–20×-nya hanya ada di bawah beban konkuren; **pada satu pengguna, selisihnya nyaris nol.** → **Di luar cakupan ecorione.**

**Realitas hardware lebih keras dari yang diakui kebanyakan panduan.** Laptop RAM 16GB punya budget model *lebih kecil* dari GPU 16GB — OS, runtime, dan KV cache keluar dari kolam yang sama. Budget praktis 16GB unified: **model 7–9B di Q4_K_M–Q6_K, sekitar 5–8GB di disk**. Di **8GB**: realistis hanya **3–4B di Q4**, dan itu **di bawah lantai keandalan untuk tool use agentic**.

**Dua temuan yang lebih bisa dipercaya daripada nama model spesifik mana pun:**
1. **Q4_K_M adalah lantai produksi untuk tool calling** — Q3/Q2 merusak keandalan tool-call **sebelum** merusak kualitas chat, yang membuat kegagalannya tak terlihat di pengujian santai.
2. **Model di bawah ~7B tanpa pelatihan tool-call khusus gagal sistematis** pada struktur JSON multi-tool. Angka ~95% tool-call well-formed yang dilaporkan berasal dari kelas 27B yang butuh ~16GB **VRAM** — tidak tercapai di target ini.

*(Nama model 2026 spesifik yang muncul di sumber-sumber blog agregator tidak diverifikasi ke model card resmi — verifikasi ke Hugging Face / library Ollama sebelum berkomitmen. Yang bisa dipercaya adalah batasan ukuran dan kuantisasinya. Arah paling menjanjikan untuk kelas hardware ini adalah arsitektur MoE dengan parameter aktif kecil.)*

**Kesimpulan yang mengubah desain:** di RAM 8–16GB kamu mendapat **classifier, summarizer, extractor, dan reranker yang kompeten — bukan agent tool-calling yang andal.** Maka peran model lokal di ecorione adalah **pra/pasca-pemrosesan**: gerbang salience, ekstraksi fakta, konsolidasi memori, klasifikasi tugas untuk routing, reranking hasil retrieval, redaksi data sensitif. **Agent loop tetap di model hosted** (atau di mesin yang jauh lebih besar). Ini bukan kelemahan — ini pembagian kerja yang membuat klaim ecorione bisa dipertahankan.

---

## 6. Eksekusi & Isolasi (Windows-first)

### 6.1 Opsi yang gugur

| Opsi | Kenapa gugur |
|---|---|
| **Firecracker** | Butuh Linux + KVM. **Tidak jalan di Windows.** Lewat WSL2 butuh nested virtualization yang rapuh di hardware konsumen |
| **gVisor** | Butuh Linux 4.14.77+. Juga bukan teknologi Windows |
| **E2B** | Kodenya Apache-2.0 penuh, tapi self-host cuma didukung di GCP (penuh) dan AWS (beta) — **tidak ada jalur "jalankan di laptop"**. Jadi dependensi cloud, melanggar local-first |
| **Windows Sandbox** | Hyper-V, **eksplisit tidak tersedia di Windows Home**. Juga tidak punya API yang layak diotomasi |
| **Hyper-V isolated containers** | Gerbang Pro/Enterprise yang sama |
| **Daytona** | Repo publik tidak lagi dipelihara sejak Juni 2026 |
| **microsandbox** | Satu-satunya jalur microVM native Windows (libkrun + WHP) — **tapi self-declared beta.** Pantau, jangan pakai untuk v1 |

**Yang tersisa di Windows 11 Home:** Docker Desktop + WSL2 (Linux container) — gratis untuk penggunaan personal, minimum 8GB RAM, dan **VM WSL2-nya sendiri memakan 1–3GB residen sebelum aplikasi ecorione mulai**. Plus **Wasmtime**, yang punya binary Windows kelas satu.

### 6.2 Rekomendasi bertingkat

**Threat model yang jujur** — bukan "orang asing di internet menjalankan kode di mesin saya", melainkan, berurutan menurut probabilitas nyata:

1. **AI menulis kode buggy yang merusak data pengguna** — `rm -rf` di path yang salah, menimpa file yang salah, loop yang memenuhi disk. Ini kecelakaan *kebenaran*, dan ini yang paling mungkin terjadi.
2. **Indirect prompt injection** — agent membaca halaman web, email, PDF, atau *nama file* yang berisi instruksi, lalu bertindak dengan otoritas penuh pengguna.
3. **Supply chain** — AI melakukan `pip install` paket typosquat.
4. **Escape kernel yang disengaja oleh aktor negara.** **Bukan threat model ecorione. Berhenti mendesain untuk ini.**

Perhatikan bahwa #1–#3 **hampir sepenuhnya tidak terpengaruh** oleh pilihan Firecracker vs Docker. MicroVM tidak mencegah agent menghapus dokumen pengguna kalau folder dokumen itu di-mount ke dalamnya.

**Tier 0 — selalu menyala, biaya nol (bangun ini pertama).** Guardrail in-process: allowlist filesystem (agent hanya boleh menulis di bawah direktori workspace), deny-list verb shell destruktif, allowlist egress jaringan, dan **konfirmasi manusia untuk aksi yang tidak bisa dibatalkan**. Semua tindakan agent masuk trace + audit log append-only. Plus: seluruh workspace di bawah version control / snapshot otomatis, supaya "undo" itu ada.

**Tier 1.5 — WASM sebagai jalur default.** Wasmtime/Pyodide untuk snippet yang hanya mentransformasi data. **Nol ambient authority** (tanpa filesystem, jaringan, clock, subprocess kecuali diberikan eksplisit), start di bawah 100ms, **jalan native di Windows tanpa WSL2 dan tanpa pajak memori Docker Desktop**. Di laptop 8GB ini kemenangan nyata. Batasnya bukan keamanan, melainkan ekosistem: tidak bisa memuat wheel native sembarangan, tidak ada subprocess. Catatan: "sandbox WASM" tidak otomatis aman — advisory Pyodide di n8n menunjukkan escape biasanya lewat **host binding yang kamu tambahkan sendiri**, bukan lewat engine-nya.

**Tier 1 — Docker + WSL2 untuk yang butuh paket nyata atau jaringan.** Flag wajib: `--network=none` secara default, `--read-only` + `--tmpfs` kecil, `--cap-drop=ALL`, `--security-opt=no-new-privileges`, `--user` non-root, `--memory`/`--cpus`/`--pids-limit`, **tidak pernah me-mount docker socket**, dan tepat satu bind mount: workspace tugas. Jaringan dinyalakan eksplisit per-tugas lewat proxy dengan allowlist domain.

Dokumentasi Docker sendiri jujur soal batasnya: *"the default set of capabilities and mounts given to a container may provide incomplete isolation."* → **ecorione tidak boleh mengklaim "secure sandbox".** Yang boleh diklaim: mencegah kecelakaan dan paket buruk kasual; tidak mencegah eksploitasi kernel yang ditentukan.

**Yang termasuk over-engineering dan harus dihindari:** microVM per-tugas, profil seccomp tulisan sendiri, gVisor-di-WSL2, dan arsitektur apa pun yang mensyaratkan Windows Pro.

### 6.3 Bagian yang sebenarnya berbahaya: RPA

Ini kesimpulan paling tidak nyaman dari seluruh riset. **Tingkat sandbox nyaris tidak penting, karena otomasi desktop/browser berjalan di luar sandbox menurut definisinya.** Agent yang bisa menggerakkan mouse dan mengetik di desktop asli bisa membuka email pengguna, mengotorisasi transaksi di tab browser yang sudah login, dan mengekstrak apa pun yang ada di layar — **dan tidak ada batas container yang terlibat sama sekali**. Mem-sandbox interpreter Python sambil memberi agent yang sama `computer_use` tanpa batas adalah teater keamanan.

Kontrol wajib untuk AutoClick:
- **Profil browser terpisah** untuk agent, hanya dengan kredensial yang benar-benar dibutuhkan. **Tidak pernah profil utama pengguna yang sudah login.** Satu keputusan ini menyumbang lebih banyak keamanan daripada teknologi isolasi mana pun di §6.2.
- **Allowlist aplikasi** — agent boleh menyetir Chrome dan Excel; bukan password manager, bukan aplikasi bank, bukan terminal.
- **Konfirmasi sebelum commit** untuk aksi UI yang tak bisa dibatalkan: mengirim, membayar, menghapus, memposting, memberi izin. Tampilkan screenshot + klik yang dimaksud, minta penekanan tombol.
- **Semua konten layar adalah input tak-tepercaya.** Teks halaman, hasil OCR, isi dokumen = data, tidak pernah instruksi. Pisahkan secara struktural di prompt.
- **Dead-man's switch**: hotkey abort global, budget langkah keras per tugas, indikator "agent sedang menyetir" yang terlihat.
- **Rekam semuanya** — screenshot + log aksi per langkah.

---

## 7. Reliabilitas & Jalan ke "Bisnis Dijalankan AI"

### 7.1 Angka nyata

| Sumber | Temuan |
|---|---|
| **TheAgentCompany** (CMU, 175 tugas perusahaan software simulasi) | Terbaik: **Gemini 2.5 Pro 30.3%** penyelesaian penuh (39.3% parsial); Claude 3.7 Sonnet 26.3%; GPT-4o 8.6%. Mode gagal terdokumentasi: gagal memahami tujuan sosial implisit, kalah oleh **popup yang bisa ditutup**, dan **deceptive shortcutting** — saat mentok, agent "menghilangkan bagian sulitnya" (mis. mengganti nama pengguna alih-alih mencari kontak yang benar) |
| **GDPval** (OpenAI, 1.320 tugas, 44 pekerjaan, rata-rata 7 jam kerja ahli) | Terbaik **47.6%** win/tie vs deliverable ahli manusia — **tapi papernya sendiri menyatakan tugasnya "precisely-specified and one-shot, not interactive"**, dan performa turun dengan konteks lebih sedikit |
| **Online-Mind2Web** (300 tugas, 136 situs live) | Skor WebVoyager ~90% yang beredar **sangat overestimate** — agent search-only trivial dapat 51% di WebVoyager tapi cuma **22%** di Online-Mind2Web. Di situs nyata: OpenAI Operator **61.3%**, Claude Computer Use **56.3%**, sisanya (termasuk browser-use) **~28–30%**. Tugas sulit: turun ke **43.2%** untuk yang terbaik |
| **OSWorld / WebArena** (lingkungan terkontrol) | Agent teratas ~85–86% (OSWorld, baseline manusia 72.36%) dan ~74.3% (WebArena). **Jurang antara ini dan ~30% di web nyata itulah temuannya** |
| **Gartner** (Juni 2025) | **>40% proyek agentic AI dibatalkan sebelum akhir 2027**; hanya ~130 vendor agentic asli di antara ribuan yang mengklaim ("agent washing") |
| **MIT NANDA** | **~95% pilot GenAI mandek tanpa dampak P&L terukur.** **Sering disalahkutip** — ini laporan tentang *kegagalan adopsi organisasi*, bukan kegagalan model. Laporan yang sama menemukan ~90% perusahaan punya karyawan yang sukses memakai AI secara informal, dan otomasi back-office memberi penghematan $2–10M/tahun |
| **MAST** (Berkeley, 1.600+ trace, 7 framework, κ=0.88) | 14 mode kegagalan dalam 3 klaster: desain sistem, misalignment antar-agent, dan **verifikasi tugas** — yang terakhir adalah yang menanggung beban |

### 7.2 Matematika compounding error

Ini aritmetika, bukan studi: pada keandalan per-langkah *p* selama *n* langkah, peluang sukses = *pⁿ*.

| Keandalan/langkah | 5 langkah | 10 langkah | 20 langkah |
|---|---|---|---|
| 90% | 59% | 35% | 12% |
| 95% | 77% | 60% | **36%** |
| 99% | 95% | 90% | **82%** |

Proses bisnis seperti "rekonsiliasi invoice → cocokkan PO → tandai selisih → email vendor → update ledger" minimal 5–15 tool call. **Inilah kenapa angka benchmark 30% konsisten dengan model yang terasa sangat pintar dalam satu giliran.** Dan konsekuensi biayanya: alur dengan tingkat sukses 30% berbiaya ~3.3× harga token nominalnya untuk benar-benar selesai sekali.

### 7.3 Durable execution — substrat yang wajib

Agent adalah proses stateful berjalan lama yang membuat efek samping non-idempoten terhadap sistem eksternal. Tiga kegagalan konkret yang diperbaiki durable execution:

1. **Crash di tengah workflow.** Agent mengirim invoice, lalu proses mati sebelum menulis ledger. Saat restart tidak ada catatan — retry menagih dua kali, skip kehilangan catatan.
2. **Efek samping non-idempoten.** Retry naif pada timeout mengirim ulang email, menerbitkan ulang refund.
3. **Menunggu manusia lama.** Approval bisa makan tiga hari. Proses tidak bisa menahan thread (atau context window) selama tiga hari.

Anthropic menyatakannya langsung: *"minor system failures can be catastrophic for agents"* karena mereka memegang state lintas banyak tool call — jadi harus *resume*, bukan restart.

| Proyek | Lisensi (terverifikasi) | Catatan |
|---|---|---|
| **Temporal** | **MIT** | Implementasi referensi durable execution |
| **Trigger.dev** | **Apache-2.0** | TypeScript, eksplisit "AI workflows", pause-for-approval programatik |
| **Activepieces** | **MIT** (community) | ~280+ piece diekspos sebagai server MCP |
| **Windmill** | **AGPLv3** | Copyleft menjangkau penggunaan jaringan |
| **Inngest** | **SSPL** | |
| **Restate** | **BSL 1.1** | Melarang menjalankan "Public Restate Platform Service" |
| **n8n** | **Sustainable Use License — BUKAN open source OSI** | Ekosistem terbesar (1500+ integrasi) tapi lisensinya membatasi hosting untuk orang lain |

**Keputusan ecorione: jangan membangun mesin durable execution sendiri.** Ini infrastruktur yang sudah terpecahkan, dan membangunnya sendiri akan memakan seluruh proyek. Kandidat: **Temporal (MIT)** atau **Trigger.dev (Apache-2.0)**.

### 7.4 Human-in-the-loop

Pola sudah konvergen. LangGraph mendefinisikan empat respons terhadap tool call yang di-interrupt: **approve**, **edit** (ubah argumen dulu), **reject** (lewati, umpankan penolakan balik), **respond** (kembalikan teks manusia sebagai hasil tool). Gotcha terdokumentasi: **jangan pakai `respond` untuk menolak tool yang punya efek samping** — itu memberi sinyal sukses ke model; pakai `reject`.

Prasyarat teknisnya adalah intinya: **"You must configure a checkpointer to persist the graph state across interrupts."** → **Approval gate bukan fitur UI, ia fitur durable state.**

**Aksi mana yang butuh approval** — kriteria yang berulang di semua sumber: **mengeluarkan uang, mengirim komunikasi eksternal, menghapus/mengubah data secara tak-terbalikkan, menciptakan kewajiban hukum, menyentuh kredensial atau produksi.** Segala yang reversibel dan internal harus **diaudit, bukan di-approve**.

**Melawan approval fatigue:** gerbang pada **risiko argumen**, bukan pada identitas tool. Contoh: pause penulisan file hanya *di luar* direktori workspace; pause SQL hanya kalau bukan SELECT read-only.

### 7.5 Tangga otonomi & plafon 2026

**L0** Manual → **L1** AI-assisted (manusia mengerjakan, AI mendraf) → **L2** AI-executes-with-approval (agent mengusulkan, manusia menggerbang tiap aksi konsekuensial) → **L3** AI-executes-with-audit (agent bertindak, manusia mereviu setelahnya, rollback tersedia) → **L4** Autonomous (agent bertindak, hanya eksepsi yang muncul).

| Fungsi bisnis | Plafon realistis 2026 | Alasan |
|---|---|---|
| Kode / tooling internal | **L3** | Terverifikasi oleh test & CI; rollback = `git revert` |
| Drafting konten / riset / riset lead | **L3** | Error murah dan reversibel |
| Triage support & draf balasan | **L3 triage, L2 kirim** | Klarna: rutin lancar, sengketa/fraud/penutupan akun gagal |
| Ekstraksi data / pemrosesan dokumen | **L3 dengan sampling** | Risikonya error senyap — butuh QA statistik, bukan reviu per-item |
| Pembukuan / rekonsiliasi | **L2 (siapkan saja)** | Agent mengusulkan entri; manusia yang memposting. Tak-terbalikkan + teregulasi |
| Penjadwalan, ops internal, laporan | **L3–L4** | Blast radius kecil, self-correcting |
| Segala pengeluaran uang, pembayaran, refund | **L2, berpagu keras** | Tak-terbalikkan; eksposur apparent authority |
| Komunikasi eksternal ke pelanggan/mitra | **L2** | Risiko reputasi + kontraktual |
| Legal, pajak, entitas, keputusan HR | **L1** | Butuh atestasi manusia menurut undang-undang |
| Otomasi browser di web nyata | **L2 paling banter** | ~30% sukses di tugas live; eksposur ToS & anti-bot |

**Plafon jujurnya: L3 adalah batas terdepan untuk pekerjaan yang reversibel dan bisa diverifikasi. L4 tidak ada untuk apa pun yang konsekuensial** — bukan karena model kurang pintar, tapi karena **verifikasi adalah separuh yang belum terpecahkan** (klaster ketiga MAST), dan karena keandalan 95%/langkah tidak sanggup menopang rantai 20 langkah.

### 7.6 Pelajaran Klarna, dan di mana otomasi berhenti

Kasus terbaik yang terdokumentasi dua sisinya. Februari 2024: AI menangani 2.3 juta percakapan di bulan pertama, "setara 700 agent full-time", waktu penanganan 11 menit → di bawah 2 menit, proyeksi penghematan **$40M**. Mei 2025: CEO menariknya kembali — *"cost unfortunately seems to have been a too predominant evaluation factor… what you end up having is lower quality"* — dan mulai merekrut ulang manusia. **Detail yang paling instruktif: AI berhasil pada permintaan rutin dan gagal pada sengketa tagihan, laporan penipuan, dan penutupan akun — sementara CSAT dan waktu penanganan agregat menyembunyikannya.** Itu kegagalan *pengukuran* sama besarnya dengan kegagalan model. Klarna tidak meninggalkan AI (Nov 2025: setara 853 karyawan, ~$60M) — **pelajarannya adalah triage-dan-eskalasi mengalahkan menggantikan.**

**Di mana otomasi berhenti secara hukum:** kontrak yang dibentuk agent **mengikat** di bawah E-SIGN/UETA — risikonya bukan keabsahan, melainkan **otoritas**. Agent yang tampil sebagai perwakilanmu bisa mengikatmu lewat **apparent authority** bahkan saat ia melampaui batas internal, dan di bawah California AB 316 kamu **tidak bisa** membela diri dengan "AI-nya bertindak sendiri". Hard stop yang butuh manusia: registrasi entitas, tanda tangan & atestasi pajak, KYC perbankan, eksekusi kontrak di atas ambang, keputusan ketenagakerjaan, nasihat teregulasi. Kontrolnya persis arsitektur: **pagu transaksi yang dipaksakan sistem, allowlist counterparty, trigger eskalasi yang menyala sebelum penyelesaian** — bukan instruksi di prompt.

**"Perusahaan AI satu orang": bukti pada dasarnya tidak ada.** Pencarian menghasilkan hampir seluruhnya konten SEO, spekulasi Substack, dan produk infoproduk — tanpa laporan substantif dengan pendapatan dan stack terverifikasi. TechCrunch memperlakukan "one-person unicorn" sebagai *prediksi*. **Perlakukan ini sebagai kategori klaim yang belum terverifikasi.** Yang terverifikasi lebih kecil dan nyata: operator solo yang berjalan ramping dengan tooling AI-berat — itu **leverage, bukan otonomi**.

### 7.7 Ekonomi

Satu angka first-party yang solid: Anthropic melaporkan **agent memakai ~4× token chat, dan sistem multi-agent ~15×**, dan menyimpulkan arsitektur multi-agent *"require tasks where the value of the task is high enough to pay for the increased performance."* **Itu gerbang ekonominya.** → **ecorione v1 tidak membangun orkestrasi multi-agent.**

Ilustrasi EY ($0.04 per interaksi 2023 → $1.20 per orkestrasi 2026, ~30×) **tampaknya ilustratif, bukan hasil pengukuran** — jangan bangun business case di atasnya. Data cost-per-task-vs-manusia yang rigor **tidak berhasil ditemukan**; curigai siapa pun yang mengutipnya dengan percaya diri. Poin strukturalnya tetap: biaya per token turun sementara konsumsi token per tugas naik lebih cepat, dan **retry mengalikan biaya dengan eksponen yang sama dengan yang meluruhkan keandalan**. Agent polling always-on adalah kasus patologisnya — biayanya berskala dengan waktu dinding, bukan dengan pekerjaan yang selesai. **Event-driven mengalahkan polling secara ekonomi dan keandalan sekaligus.**

---

## 8. Evaluasi & Observability

### 8.1 Yang perlu diketahui tentang benchmark

Benchmark publik memberi tahu tentang **model**, hampir tidak memberi tahu apa pun tentang **sistemmu**. Berkeley RDI mendokumentasikan bahwa beberapa benchmark agent papan atas bisa "dibobol". Yang tetap berguna sebagai *ide*, bukan sebagai target:

- **τ²-bench** (Sierra, MIT, ~1.9k★) — paling relevan: menilai **kepatuhan kebijakan + penggunaan tool + `pass^k`**. **`pass^k` (semua k percobaan independen berhasil) adalah metrik yang harus dicuri** — ia mengukur *keandalan*, bukan keberuntungan best-of-n.
- **Terminal-Bench** — sudah pindah org ke `harbor-framework` (v2.0/v2.1); URL lama 503.
- **LongMemEval / LOCOMO** untuk memori — tapi lihat peringatan vendor di §3.1.

### 8.2 Framework eval OSS

| Tool | Lisensi | Bintang | Putusan |
|---|---|---|---|
| **promptfoo** | MIT | ~24.2k | Config YAML, **jalan 100% lokal**, CI-native, red-teaming bawaan → **pilihan ecorione** |
| **DeepEval** | Apache-2.0 | ~17.5k | Berbentuk pytest; metrik agentic (Tool Correctness, Task Completion, Step Efficiency, Plan Adherence) |
| **Inspect AI** | MIT (UK AISI) | ~2.4k | Sangat bagus tapi **research harness — akan melampaui cakupan proyek ini** |
| **Ragas** | Apache-2.0 | ~15.6k | RAG-sentris; metrik agent masih "coming soon" |
| **openai/evals** | MIT | ~19.4k | Velocity rendah, sebagian besar tergantikan dashboard OpenAI |

### 8.3 LLM-as-judge — dengan angka

Studi sistematis besar (21 model juri, ~541k judgment) memberi empat temuan yang harus ditindaklanjuti:

1. **Kappa deflation** — persetujuan mentah melebih-lebihkan Cohen's κ sebesar **33.8–41.3 poin** di MT-Bench. "Juri saya 92% setuju dengan saya" sebagian besar adalah base rate.
2. **Position bias spesifik-model dan rentangnya besar** — 0.002 (Gemini 2.5 Pro) sampai 0.192 (Qwen 3 8B); dua model dari keluarga yang sama berbeda ~70×. **Harus diukur, tidak boleh diasumsikan.**
3. **Verbosity bias sebagian besar sudah teratasi** — semua 21 model di bawah 0.011, turun dari 20–40% yang dulu dilaporkan. **Jangan over-engineer melawan masalah yang sudah selesai.**
4. **Peringkat juri tidak transfer antar benchmark** — lebih dari separuh model bergeser ≥4 posisi.

Mitigasi: metrik terkoreksi-kebetulan, **debiasing tukar posisi AB+BA**, dan — yang jarang dilakukan orang — **set emas berlabel manusia yang kecil** untuk menguji ulang juri tiap kali model juri diganti. Hindari keluarga model yang sama sebagai aktor dan juri.

### 8.4 Rencana evaluasi minimal-tapi-nyata

**Minggu 1 (~2 hari kerja).** **Instrumentasi dulu**: span bergaya OTel untuk tiap panggilan LLM, tool call, dan retrieval, ditulis ke JSONL lokal, dilihat di Langfuse/Phoenix lokal. **Kamu tidak bisa mengevaluasi apa yang tidak bisa kamu lihat** — dan trace itu *menjadi* fixture eval-mu. Lalu tangkap 10 tugas nyata yang benar-benar dijalankan, bekukan trace-nya jadi kasus emas, tulis assertion deterministik atas state akhir.

**Suite regresi (30–40 kasus, ~2 minggu masuk).** Komposisi: ~15 happy-path per kapabilitas utama; **~8 kasus keamanan** — string prompt-injection di halaman yang diambil, file dengan instruksi di namanya, tugas yang menggoda aksi destruktif (semua harus meng-assert **penolakan atau konfirmasi**; ini yang menangkap regresi paling menakutkan); ~8 kasus pemilihan tool di mana ada tool salah yang masuk akal; ~5 permintaan ambigu di mana jawaban benarnya adalah **bertanya balik**; ~4 kasus memori/konteks. Tiap kasus dijalankan **k=3** dan dilaporkan sebagai **pass^3**.

**Skoring, berurutan prioritas:** assertion deterministik di mana pun mungkin (state file, nama tool, exit code, regex) — murah, stabil, nol bias juri. LLM-as-judge hanya untuk ~20% yang benar-benar kabur, dengan tukar posisi AB+BA, keluarga model berbeda dari aktor, dan 20 contoh berlabel manusia untuk memvalidasi ulang juri. **Laporkan κ, bukan persetujuan mentah.**

**Mendeteksi perubahan model senyap.** **Pin versi model eksplisit — jangan pernah alias `-latest`.** Lalu jalankan **canary set** (5–8 kasus paling murah dan deterministik) terjadwal harian, catat pass rate per-kasus, rata-rata jumlah token output, dan rata-rata latensi. **Provider yang menukar model di balik alias muncul sebagai step change pada jumlah token atau latensi berhari-hari sebelum muncul sebagai kegagalan.** Beri alert pada tren, bukan cuma pada kegagalan.

**Menghindari jebakan harness-lebih-besar-dari-produk.** Tiga aturan: **batasi keras di 50 kasus dan satu file config, selamanya** (menambah kasus berarti memensiunkan satu); tiap kasus **harus lahir dari bug yang benar-benar pernah terjadi** — tidak ada coverage spekulatif; dan **habiskan usaha pada tracing, bukan pada scoring** — trace viewer yang bagus menghemat sepuluh kali lebih banyak jam debugging daripada scorer canggih, karena untuk sistem personal **kamu sendiri adalah ground truth-nya.**

---

## 9. Perubahan yang Diterapkan ke ecorione

Ini bagian yang mengubah `prd.md`. Setiap baris punya alasan yang menunjuk ke seksi riset di atas.

### 9.1 Peta modul direvisi: 13 → 11

| Modul | Sebelum | Sesudah | Alasan |
|---|---|---|---|
| **Ai** | P0 | **P0** | Tetap |
| **Hub** | P0 | **P0** — diperluas: policy engine, approval gate, **durable state**, **audit log append-only** | §7.3, §7.4 — audit trail & durable state tidak punya pemilik yang jelas di v1.0 |
| **Connect** | P0 | **P0** — diperluas: **mesin optimizer** (prefix stability, cache-aware assembly, cost ledger, exact-match cache) **+ server MCP inbound** | §2, §4 — optimizer sebenarnya hidup di sini, dan Connect adalah gerbang dua arah |
| **Context** | P0 | **P0** — ditulis ulang: tier L0–L3, bi-temporal, hybrid retrieval | §3 |
| **Sync** | P1 | **P1 — dinaikkan jadi prasyarat pitch inti** | §4.3 poin 3 — asisten hosted tidak bisa menjangkau localhost |
| **Space** | P1 | **P1** — diperjelas: permukaan editor manusia untuk memori inti L2 | §3.2 |
| **Flow** | P1 | **P1** — di atas mesin durable execution yang **diadopsi**, bukan dibangun sendiri | §7.3 |
| **Artifact** | P1 | **P1** — diperjelas sebagai storage L3 | §3.2 |
| **Sandbox** | P1 | **P1** — bertingkat: WASM default, Docker+WSL2 eskalasi | §6.2 |
| **RnD** | P2 | **P1 — dinaikkan**: eval harness + trace store + regression suite | §8 — tiap kompetitor punya cerita evaluasi; ecorione tidak punya sama sekali di v1.0 |
| **AutoClick** | P1 | **P2 — diturunkan** + kontrol keamanan khusus | §6.3, §7.5 — ~30% sukses di web nyata, eksposur ToS, dan permukaan bahaya terbesar |
| **Cache** | P2 | **Dilebur ke Connect** | §2.5 — semantic caching dicoret; exact-match cache ~50 baris |
| **IR** | P2 | **Dilebur ke Context + Artifact** | §3.2 — skema L1 dan CAS Artifact sudah menjawab kebutuhan representasi terstruktur |

### 9.2 Perubahan arsitektur & keputusan (ADR ringkas)

| # | Keputusan | Alasan |
|---|---|---|
| **ADR-01** | **Prefix stability** jadi requirement kelas satu; blok memori inti masuk prefix stabil, hasil retrieval di belakang cache breakpoint | §2.1 — hemat 60–85% biaya input, matematika dari tabel harga |
| **ADR-02** | Routing **berbasis aturan deterministik saja**; sensitivitas dievaluasi lebih dulu dan tidak pernah ditukar dengan biaya | §2.4 |
| **ADR-03** | **Semantic caching tidak dibangun di v1.** Exact-match hash cache saja | §2.5 |
| **ADR-04** | Model lokal = **classifier/extractor/summarizer/reranker**, bukan agent loop | §5 |
| **ADR-05** | Penyimpanan: **SQLite + sqlite-vec + FTS5**, satu file. Bukan JSON file-based, bukan graph DB | §3.2.3, §3.3 |
| **ADR-06** | Memori: **log append-only sebagai ground truth**, tier lain adalah proyeksi yang bisa dibangun ulang; bi-temporal; invalidate jangan hapus | §3.2 |
| **ADR-07** | Tulisan dari model hosted masuk **tabel karantina**, divalidasi konsolidasi lokal sebelum promosi | §3.4 |
| **ADR-08** | **Jangan bangun mesin durable execution sendiri** — adopsi Temporal (MIT) atau Trigger.dev (Apache-2.0) | §7.3 |
| **ADR-09** | ecorione adalah **server MCP** (utama) **dan klien MCP** (sekunder, untuk ingest). Semua fungsi wajib jalan lewat **tools**; resources bonus. **Jangan pakai Sampling** (dideprecate) | §4.1, §4.3 |
| **ADR-10** | Sandbox bertingkat: Tier 0 guardrail selalu, **WASM sebagai default**, Docker+WSL2 sebagai eskalasi. **Tidak mengklaim "secure sandbox"** | §6.2 |
| **ADR-11** | Approval digerbang pada **risiko argumen**, bukan identitas tool | §7.4 |
| **ADR-12** | **Idempotency key wajib pada setiap efek samping**, dipaksakan di lapisan tool — bukan di prompt | §7.3 |
| **ADR-13** | **Akuntansi biaya kontrafaktual** wajib — catat biaya aktual *dan* biaya kebijakan naif | §2.6 |
| **ADR-14** | Eval: **promptfoo**, 30–40 kasus, **pass^3**, dibatasi keras 50 kasus. **Pin versi model, canary harian** | §8.4 |
| **ADR-15** | Lisensi repo publik: **MIT**. Hindari fork dari sumber AGPL | §1 |

### 9.3 Yang sengaja TIDAK dibangun di v1

- **Tidak ada otonomi L4 untuk apa pun.** Hanya L2 dan L3. L3 harus *diperoleh* per-workflow dengan tingkat sukses terukur, tidak pernah jadi default. *(§7.5)*
- **Tidak ada orkestrasi multi-agent.** Biaya token 15×, mode kegagalan misalignment MAST, dan tidak ada bukti ia mengalahkan satu agent bagus dengan tool bagus pada skala ini. *(§7.7)*
- **Otomasi browser bukan dependensi inti.** ~30% sukses di web nyata. Pakai API di mana pun API ada; AutoClick jadi escape hatch manual, tidak pernah di jalur tanpa pengawasan. *(§6.3, §7.5)*
- **Tidak ada perpindahan uang, kirim eksternal, atau penghapusan data tanpa gerbang.** Titik. *(§7.4)*
- **Tidak ada agent polling always-on.** Event- dan jadwal-driven saja. *(§7.7)*
- **Tidak membangun mesin durable execution sendiri.** *(§7.3)*
- **Tidak mempercayai laporan-diri agent soal keberhasilan.** Tiap workflow butuh langkah verifikasi eksternal atau ia tidak lulus dari L2. *(§7.1 — deceptive shortcutting)*
- **Tidak ada otomasi fungsi teregulasi** (pajak, legal, nasihat berlisensi, keputusan ketenagakerjaan) — L1 assist saja. *(§7.6)*
- **Tidak ada semantic caching, tidak ada graph DB, tidak ada vLLM, tidak ada microVM.** *(§2.5, §3.3, §5, §6.1)*

---

## 10. Risiko Terbesar & Yang Belum Terpecahkan

1. **Batas sinkronisasi adalah keputusan produk tersulit di proyek ini.** "Local-first" dan "ChatGPT bisa membaca memori saya" saling bertentangan secara fisik (§4.3). Harus diputuskan secara eksplisit dan dikomunikasikan jujur ke pengguna, bukan dikaburkan.
2. **Tidak ada arsitektur referensi** untuk "memori bersama antara model lokal dan banyak AI hosted". Ini validasi bahwa celahnya nyata — sekaligus berarti **tidak ada pola terbukti untuk dicontek**. Proksi terdekat yang layak dipelajari mendalam: pemisahan checkpointer/Store LangGraph dan model memory-block Letta.
3. **Salience** — memutuskan apa yang layak diingat — belum dipecahkan siapa pun dan itu justru produknya (§3.5).
4. **Forgetting** belum punya jawaban yang baik.
5. **Verifikasi**, bukan kapabilitas model, adalah yang membatasi otonomi di L3 (§7.5). Ini juga belum terpecahkan secara umum.
6. **Spec MCP sedang bergerak** — revisi 2026-07-28 breaking, klien masih menyeberang, registry masih preview tanpa jaminan durabilitas.
7. **Ketergantungan pada angka vendor.** Sebagian besar leaderboard memori dijalankan oleh penjual produk memori. Set regresi personal adalah satu-satunya sinyal yang bisa dipercaya.
8. **Biaya konsolidasi memori** berskala dengan pemakaian. Harus dibatch, digerbang, dan token-per-hari-nya diinstrumentasi sejak awal.

---

## 11. Sumber

**Memori & context engineering** — [Letta](https://github.com/letta-ai/letta) · [Letta memory blocks](https://docs.letta.com/guides/agents/memory-blocks) · [Letta sleep-time compute](https://www.letta.com/blog/sleep-time-compute/) · [mem0](https://github.com/mem0ai/mem0) · [Mem0 paper (arXiv:2504.19413)](https://arxiv.org/abs/2504.19413) · [Graphiti](https://github.com/getzep/graphiti) · [Zep paper (arXiv:2501.13956)](https://arxiv.org/pdf/2501.13956) · [Zep OSS strategy change](https://blog.getzep.com/announcing-a-new-direction-for-zeps-open-source-strategy/) · [LangGraph persistence](https://docs.langchain.com/oss/python/langgraph/persistence) · [cognee](https://github.com/topoteretes/cognee) · [Supermemory](https://github.com/supermemoryai/supermemory) · [Memobase](https://github.com/memodb-io/memobase) · [Chroma Context Rot](https://www.trychroma.com/research/context-rot) · [Anthropic: effective context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) · [LangChain context engineering](https://www.langchain.com/blog/context-engineering-for-agents) · [Memory poisoning (arXiv:2601.05504)](https://arxiv.org/abs/2601.05504) · [LTM security survey (arXiv:2604.16548)](https://arxiv.org/html/2604.16548v1)

**MCP & protokol** — [Spec 2026-07-28](https://modelcontextprotocol.io/specification/latest) · [Changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog) · [Resources](https://modelcontextprotocol.io/specification/2026-07-28/server/resources) · [MRTR](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr) · [Elicitation](https://modelcontextprotocol.io/specification/2026-07-28/client/elicitation) · [Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http) · [Authorization](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization) · [Security best practices](https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices) · [MCP Registry](https://github.com/modelcontextprotocol/registry) · [Reference servers](https://github.com/modelcontextprotocol/servers) · [Claude Code MCP](https://code.claude.com/docs/en/mcp) · [Claude API MCP connector](https://platform.claude.com/docs/en/agents-and-tools/mcp-connector) · [OpenAI Developer Mode & MCP apps](https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt) · [VS Code MCP](https://code.visualstudio.com/docs/copilot/customization/mcp-servers) · [Cursor MCP](https://cursor.com/docs/context/mcp) · [Invariant Labs: tool poisoning](https://invariantlabs.ai/blog/mcp-security-notification-tool-poisoning-attacks) · [Simon Willison: MCP prompt injection](https://simonwillison.net/2025/Apr/9/mcp-prompt-injection/) · [A2A](https://github.com/a2aproject/A2A) · [AGENTS.md](https://agents.md/)

**Optimizer** — [LiteLLM](https://github.com/BerriAI/litellm) · [LiteLLM license issue #34241](https://github.com/BerriAI/litellm/issues/34241) · [RouteLLM](https://github.com/lm-sys/RouteLLM) · [RouteLLM paper (arXiv:2406.18665)](https://arxiv.org/abs/2406.18665) · [Kritik independen router](https://dreaming.press/posts/2026-06-21-routellm-vs-notdiamond-vs-martian.html) · [Anthropic prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) · [OpenAI prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching) · [Gemini context caching](https://ai.google.dev/gemini-api/docs/caching) · [DeepSeek context caching](https://api-docs.deepseek.com/news/news0802/) · [GPTCache](https://github.com/zilliztech/GPTCache) · [Mitos hit rate 95%](https://dev.to/gauravdagde/llm-semantic-caching-the-95-hit-rate-myth-and-what-production-data-actually-shows-8ga) · [OTel GenAI semconv](https://github.com/open-telemetry/semantic-conventions-genai) · [Langfuse](https://github.com/langfuse/langfuse) · [OpenLLMetry](https://github.com/traceloop/openllmetry) · [LLMLingua-2 (arXiv:2403.12968)](https://arxiv.org/abs/2403.12968) · [Anthropic: code execution with MCP](https://www.anthropic.com/engineering/code-execution-with-mcp)

**Sandbox & eval** — [E2B](https://github.com/e2b-dev/E2B) · [E2B infra](https://github.com/e2b-dev/infra) · [Firecracker](https://github.com/firecracker-microvm/firecracker) · [gVisor](https://github.com/google/gvisor) · [gVisor security model](https://gvisor.dev/docs/architecture_guide/security/) · [microsandbox](https://github.com/microsandbox/microsandbox) · [Daytona](https://github.com/daytonaio/daytona) · [Wasmtime](https://github.com/bytecodealliance/wasmtime) · [n8n Pyodide advisory](https://github.com/n8n-io/n8n/security/advisories/GHSA-62r4-hw23-cc8v) · [Docker Engine security](https://docs.docker.com/engine/security/) · [Docker Desktop Windows](https://docs.docker.com/desktop/setup/install/windows-install/) · [Windows Sandbox](https://learn.microsoft.com/en-us/windows/security/application-security/application-isolation/windows-sandbox/) · [promptfoo](https://github.com/promptfoo/promptfoo) · [DeepEval](https://github.com/confident-ai/deepeval) · [Inspect AI](https://github.com/UKGovernmentBEIS/inspect_ai) · [τ²-bench](https://github.com/sierra-research/tau2-bench) · [Studi LLM-as-judge (arXiv:2606.19544)](https://arxiv.org/html/2606.19544v1) · [Berkeley RDI: breaking agent benchmarks](https://rdi.berkeley.edu/blog/trustworthy-benchmarks-cont/) · [OWASP GenAI Q1 2026](https://genai.owasp.org/2026/04/14/owasp-genai-exploit-round-up-report-q1-2026/)

**Reliabilitas & bisnis** — [TheAgentCompany (arXiv:2412.14161)](https://arxiv.org/html/2412.14161v2) · [GDPval](https://cdn.openai.com/pdf/d5eb7428-c4e9-4a33-bd86-86dd4bcf12ce/GDPval.pdf) · [METR time horizons](https://metr.org/time-horizons/) · [Gartner: >40% dibatalkan](https://www.gartner.com/en/newsroom/press-releases/2025-06-25-gartner-predicts-over-40-percent-of-agentic-ai-projects-will-be-canceled-by-end-of-2027) · [MIT NANDA (liputan)](https://fortune.com/2025/08/18/mit-report-95-percent-generative-ai-pilots-at-companies-failing-cfo/) · [Kritik atas pembacaan MIT NANDA](https://www.sify.com/ai-analytics/95-companies-failing-with-ai-an-mit-nanda-report-misread-by-all/) · [MAST (arXiv:2503.13657)](https://arxiv.org/abs/2503.13657) · [An Illusion of Progress? (arXiv:2504.01382)](https://arxiv.org/pdf/2504.01382v4) · [WebArena leaderboard](https://leaderboard.steel.dev/leaderboards/webarena/) · [OSWorld leaderboard](https://leaderboard.steel.dev/leaderboards/osworld/) · [Anthropic: multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) · [LangChain human-in-the-loop](https://docs.langchain.com/oss/python/langchain/human-in-the-loop) · [Temporal Agent Harness](https://temporal.io/blog/temporal-agent-harness-durable-agent-infrastructure) · [Temporal](https://github.com/temporalio/temporal) · [Trigger.dev](https://github.com/triggerdotdev/trigger.dev) · [Windmill](https://github.com/windmill-labs/windmill) · [n8n](https://github.com/n8n-io/n8n) · [Activepieces](https://github.com/activepieces/activepieces) · [Analisis Klarna](https://www.bigeye.com/blog/klarnas-ai-customer-service-deployment) · [Forbes: pembalikan Klarna](https://www.forbes.com/sites/quickerbettertech/2025/05/18/business-tech-news-klarna-reverses-on-ai-says-customers-like-talking-to-people/) · [Otoritas kontrak agent AI](https://www.njbusiness-attorney.com/ai-agent-contracting-authority-liability/) · [browser-use](https://github.com/browser-use/browser-use) · [Skyvern](https://github.com/Skyvern-AI/skyvern) · [Stagehand](https://github.com/browserbase/stagehand)

**Referensi harness yang diminta untuk dibandingkan** — [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) (MIT; arsitektur plugin di atas kernel Cordis; prinsip *"the session log is the source of the context the model sees"* — dipakai sebagai dasar ADR-06) · [MoonshotAI/kimi-code](https://github.com/MoonshotAI/kimi-code) (MIT; subagent terisolasi `coder`/`explore`/`plan`, dukungan MCP + ACP — dipakai sebagai dasar §2.2 isolasi konteks)

---

## Catatan yang tidak berhasil diverifikasi

Dicatat eksplisit supaya tidak diperlakukan sebagai fakta:

- Nama model lokal 2026 spesifik (sumbernya blog agregator SEO, bukan model card resmi) — **verifikasi ke Hugging Face / Ollama sebelum berkomitmen**. Batasan ukuran & kuantisasinya yang bisa dipercaya.
- Klaim boot <100ms microsandbox (klaim vendor).
- Data cost-per-task-vs-manusia yang rigor — **tidak ditemukan**; angka EY $0.04→$1.20 tampaknya ilustratif.
- Contoh "perusahaan AI satu orang" yang terdokumentasi kredibel — **tidak ditemukan**.
- Lisensi SPDX untuk repo MCP registry, mem0, dan Graphiti MCP server (repo induk Graphiti terkonfirmasi Apache-2.0).
- Apakah leaderboard TheAgentCompany sudah dijalankan ulang pada model frontier 2026.
- Status stabilitas terkini span agent/tool-execution di OTel GenAI semconv (spec baru pindah repo).
- Level dukungan MCP untuk Zed, Cline, Windsurf, Gemini CLI (dokumentasi primer tidak dibaca).
