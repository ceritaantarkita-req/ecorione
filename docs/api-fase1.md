# API Fase 1 — kontrak antar-service

Status: **v1.0** — 2026-09-08. Ditulis sebelum implementasi supaya `services/rnd`,
`services/context` (lapisan HTTP), `services/connect`, `services/hub`, dan `apps/ai`
bisa dibangun paralel tanpa menyimpang bentuk request/respons satu sama lain.
Pasangan: `docs/prd.md` §9 (arsitektur), §23 (roadmap Fase 1).

> **CONTRACT-SNAPSHOT NOTICE — 2026-09-10:** dokumen ini menjelaskan kontrak Fase 1 dan tetap berguna untuk boundary tersebut, tetapi bukan source current status atau seluruh hardening yang datang setelahnya. Planned Batch 1–12 sudah CLOSED. Untuk current state/release/security/deployment, baca `current-state-and-next-steps.md`, `EXECUTION-PROGRESS.md`, dan operations/ADR terbaru sebelum mengubah kontrak lama.

Semua service pakai `@ecorione/shared-server` (`createServer`): bind `127.0.0.1`
default, auth `Authorization: Bearer <ECORIONE_INTERNAL_TOKEN>` (nonaktif kalau token
tidak diisi — dev only), `/healthz` otomatis, error `{ error: { type, message, detail? }, requestId }`.
Semua body divalidasi Zod lewat `parseOrBadRequest` — input tidak valid selalu 400,
tidak pernah 500.

Port & URL dari `.env.example`:

| Service | Port | Env URL |
|---|---|---|
| RnD (trace store) | 17021 | `ECORIONE_RND_URL` |
| Context (HTTP) | 17022 | `ECORIONE_CONTEXT_URL` |
| Connect (outbound) | 17023 | `ECORIONE_CONNECT_URL` |
| Hub | 17024 | `ECORIONE_HUB_URL` |
| Ai (Next.js) | 3000 | — |

Panggilan antar-service pakai `httpJson` dari `@ecorione/shared-server` dengan
`token: process.env.ECORIONE_INTERNAL_TOKEN`.

**Clock**: ESLint melarang `Date.now()`/`new Date()` di seluruh kode produksi (bukan
cuma context-assembly — lihat `AGENTS.md` aturan 1, `eslint.config.js`). Setiap
service punya persis satu `src/clock.ts` berisi `export function nowIso(): Timestamp`
— satu-satunya tempat yang boleh menyentuh clock nyata. Route handler memanggil
`nowIso()` sekali di awal request lalu meneruskan hasilnya sebagai `now` ke semua
fungsi di baliknya (repository, context-assembly, dsb). Jangan panggil `nowIso()`
lebih dari sekali dalam satu request — itu yang membuat "waktu perakitan" dan
"waktu simpan" bisa berbeda dalam satu giliran yang sama.

---

## RnD — trace store (`services/rnd`)

DB sendiri: `ECORIONE_RND_DB_PATH` (default `./data/rnd.db`). Skema: satu tabel
`spans` — kolom `id` (PK, `evt_`-style via `makeId("event")` atau UUID biasa — bebas,
trace store bukan bagian dari model data bersama), `name`, `attributes` (JSON text),
`recorded_at` (ISO, disuntik pemanggil — bukan `Date.now()` di dalam handler bisnis;
boleh di route handler HTTP paling luar karena ini I/O boundary, bukan jalur perakitan
prefix), `operation_id` (nullable, index), `trace_id` (nullable — pengelompokan giliran
chat kalau ada). Append-only secara konvensi (tidak perlu trigger DB seperti L0 Context
— trace store bukan sumber kebenaran privasi).

Bentuk `attributes` = `GenAiSpan["attributes"]` dari `@ecorione/shared-telemetry`
(`buildGenAiSpan`). RnD **tidak menghitung ulang biaya** — ia cuma menyimpan apa yang
dikirim Connect/Hub.

- `POST /v1/traces`
  Body: `{ name: string; attributes: Record<string, string|number|boolean|string[]>; operationId?: string; traceId?: string; recordedAt: string (ISO) }`
  201 → `{ id: string }`
- `GET /v1/traces?operationId=...&traceId=...&limit=50`
  200 → `{ traces: Array<{ id, name, attributes, operationId, traceId, recordedAt }> }`
- `GET /v1/traces/:id`
  200 → satu trace, atau 404.
- `GET /v1/traces/summary?operationId=...`
  200 → `{ callCount, totalActualUsd, totalNaiveUsd, totalSavedUsd }` — dihitung dari
  atribut `ecorione.cost.*` di span yang cocok, dipakai Ai untuk menampilkan ringkasan
  biaya per giliran chat.

---

## Context — lapisan HTTP (`services/context`)

Membungkus `ContextRepository` + `ContextRetriever` yang sudah ada (Fase 0), **tidak**
menulis ulang logikanya. Satu proses per DB (`ECORIONE_DB_PATH`), semua route
memanggil repository yang sama secara langsung — tidak ada modul lain yang membuka
file DB ini.

- `POST /v1/episodes` — `AppendEpisodeInput` (tanpa `id`, di-generate server pakai
  `makeId("episode")`) → 201 `Episode`
- `GET /v1/episodes?sessionId=...&scope=...&limit=20` → `{ episodes: Episode[] }`
  (terbaru dulu; dipakai Hub untuk ringkasan episodik thread berjalan — Fase 1 belum
  menjalankan ringkasan otomatis, jadi `text` yang dikirim ke context-assembly untuk
  sementara adalah `rawText` dipotong ke ~300 karakter, ditandai jelas sebagai
  penyederhanaan sementara di komentar kode, bukan diam-diam).
- `POST /v1/facts/propose` — `ProposeFactInput` (tanpa `id`) → 201 `{ id: MemoryFactId }`
- `POST /v1/facts/:id/promote` — body `{ resolution?: "insert" | { supersedes: MemoryFactId }, now: string }` → 200 `MemoryFact`
- `POST /v1/facts` (insert langsung, trust `USER`/`LOCAL_AGENT` yang tidak butuh
  karantina — dipakai konsolidasi setelah validasi) — `InsertFactInput` (tanpa `id`) → 201 `MemoryFact`
- `GET /v1/facts?scopes=personal&maxSensitivity=INTERNAL&limit=200` → `{ facts: MemoryFact[] }`
- `POST /v1/facts/:id/forget` — body `{ now: string }` → 200 `MemoryFact` (panggil
  `repo.forgetFact`). 404 kalau tidak ada, 409 kalau sudah di-invalidate
  (`FactAlreadyInvalidatedError`).
- `GET /v1/core-memory` → `CoreMemory`
- `PUT /v1/core-memory/:label` — body `{ description, value, readOnly?, now }` → 200 `CoreMemoryBlock`
- `POST /v1/retrieve` — body `RetrievalQuery`-ish: `{ query, scopes, k?, maxSensitivity?, now }`
  → 200 `{ hits: RetrievalHit[], diagnostics: RetrievalDiagnostics }`
  (embedding query **tidak** dikirim di Fase 1 — retrieval jalan leksikal saja lewat
  BM25/FTS5; jalur vektor aktif begitu ada layanan embedding, itu bukan blocker untuk
  loop inti karena `ContextRetriever` sudah sah jalan tanpa `queryEmbedding`).
- `GET /v1/artifacts?scope=personal&limit=20` → `{ pointers: ArtifactPointer[] }`
- `POST /v1/consolidate/run` — body `{ limit?: number, now: string }` → 200
  `{ processed: number, promoted: number, quarantined: number, rejected: number }`.
  Lihat "Konsolidasi" di bawah.

Semua error `ContextError` (dan turunannya) dipetakan di route handler ke `HttpError`
yang sesuai: `FactNotFoundError`→404, `FactAlreadyInvalidatedError`→409,
`QuarantineRequiredError`→409, `ScopeEscalationError`→400, `CoreMemoryLimitError`→400,
lainnya→400.

### Konsolidasi (model lokal, di luar jalur panas)

`POST /v1/consolidate/run` memproses episode dengan `consolidatedAt IS NULL`, dibatch
(`limit`, default 20):

1. **Gerbang salience** + **ekstraksi** dalam satu panggilan ke Connect
   (`POST {ECORIONE_CONNECT_URL}/v1/complete` dengan `target: "local"`): prompt minta
   model mengembalikan JSON array `{ subject, predicate, object, confidence, worthRemembering }`
   per episode. Respons **divalidasi ketat pakai Zod** (`z.array(...)`) — kalau parse
   gagal, batch itu ditandai `consolidatedAt` = now dengan `summary` berisi catatan
   error dan diskip (skema tidak valid **tidak boleh** membuat proses berhenti untuk
   seluruh batch, tapi juga tidak boleh diam-diam diperlakukan seolah "tidak ada fakta").
2. Untuk tiap kandidat dengan `worthRemembering === true`:
   - Tolak (skip, catat di hasil `rejected`) kalau lolos `containsImperative(text)`
     (heuristik sederhana dari kata kerja imperatif/pola instruksi — lihat
     `stripImperativeContent` di `@ecorione/context-assembly` untuk pola yang sudah
     ada, pakai ulang lewat re-export kalau memungkinkan, jangan duplikasi daftar pola).
   - `repo.proposeFact({ proposedText, trust: "LOCAL_AGENT", scope, provenance })`
     (masuk karantina — ADR-07 berlaku untuk `LOCAL_AGENT` juga, lihat
     `requiresQuarantine`).
   - Langsung `repo.promoteFromQuarantine(id, { resolution: "insert", ... }, now)` —
     ini **adalah** langkah validasi-lalu-promosi yang dimaksud `prd.md` §12.1, bukan
     jalan pintas melewati karantina: proposal singgah di tabel `quarantine` dulu
     (baris 1), baru dipromosikan di baris ini setelah lolos pemeriksaan imperatif.
3. `repo.markEpisodeConsolidated(id, summary, now)` untuk setiap episode yang diproses,
   berhasil atau tidak.

Biaya panggilan model lokal ke Connect **tetap dicatat** ke cost ledger (akan Rp0 di
`actualUsd` karena `pricing.ts` memberi harga 0 untuk model lokal, tapi `naiveUsd`
tetap dihitung — itu bagian dari akuntansi kontrafaktual yang jujur, ADR-13).

---

## Connect — outbound (`services/connect`)

Satu endpoint inti:

- `POST /v1/complete`
  Body:
  ```
  {
    target: "hosted" | "local",
    prefix: StablePrefix,               // dari @ecorione/context-assembly
    dynamicText: string,                 // hasil renderContextPack(...).dynamicText
    userMessage: string,
    sensitivity: Sensitivity,            // gerbang dievaluasi sebelum biaya (ADR-02)
    operationId: string,
    now: string,                          // ISO, dipakai untuk konsistensi span/ledger
  }
  ```
  200:
  ```
  {
    reply: string,
    model: string,             // model terpilih (pinned)
    cacheHit: boolean,          // exact-match hash cache
    usage: TokenUsage,
    cost: CallCostRecord,       // dari recordCall() shared-telemetry
    routeReason: string,        // PolicyRule.id yang menyala
  }
  ```

### Routing deterministik (`routing.ts`, bukan predictor terlatih — ADR-02)

Urutan aturan, berhenti di yang pertama menyala:

1. `target === "local"` → selalu `local/qwen3-8b-instruct-q4_k_m` lewat
   `ECORIONE_LOCAL_BASE_URL` + `ECORIONE_LOCAL_MODEL`. Tidak pernah dieskalasi ke
   hosted otomatis (peran model lokal = classifier/extractor, bukan agent loop —
   ADR-04; kalau lokal gagal, itu kegagalan konsolidasi yang dilaporkan, bukan
   alasan diam-diam memanggil hosted dan membebankan biaya tanpa keputusan eksplisit).
2. `sensitivity === "RESTRICTED"` → `claude-opus-4-1-20250805` (kualitas tertinggi;
   gerbang sensitivitas tidak pernah ditukar dengan biaya — ADR-02). *(Catatan:
   Fase 1 tidak mengekspos jalur yang benar-benar mengirim `RESTRICTED` ke Connect —
   Hub memfilternya di context pack — tapi aturan ini tetap ada supaya routing benar
   secara default kalau suatu hari dipanggil langsung.)*
3. Default (chat biasa, `target: "hosted"`) → `claude-sonnet-4-5-20250929`.

`routeReason` = id aturan yang menyala (`"local-consolidation"`, `"sensitivity-restricted"`,
`"default-hosted"`).

### Exact-match cache

Hash SHA-256 dari `{ model, prefixDigest (dari `prefixDigest()` context-assembly),
dynamicText, userMessage }` ternormalisasi (`JSON.stringify` kunci terurut — pakai
pola yang sama dengan `idempotencyPayload`/`sortDeep` di `shared-schema/policy.ts`,
jangan tulis ulang). Cache in-memory (`Map`, TTL 10 menit) — persistensi lintas
restart bukan target Fase 1, tapi tempatnya (`cache.ts`) dipisah supaya gampang
diganti backend-nya nanti. Cache hit **tidak memanggil provider sama sekali**:
`usage` dikembalikan dari entry yang tersimpan, `cacheHit: true`, `actualUsd` tetap
dihitung dari usage tersimpan (bukan 0 — exact-match cache mengembalikan jawaban
yang sama, bukan gratis dari sisi token yang "dianggap" terpakai; ini beda dari
provider prompt-cache yang memang memotong tagihan input).

### Adapter provider

**Hosted (Anthropic langsung, `https://api.anthropic.com/v1/messages`)**:
`system` = `prefix.systemPrompt` (+ instruksi ringkas soal `dynamicText` sebagai
amplop data), `tools` = `prefix.toolDefinitions` (kosong boleh, array tetap
dikirim), **`cache_control: { type: "ephemeral" }` dipasang di blok terakhir
`system`** (dan di blok tool terakhir kalau tools tidak kosong) — inilah yang
mengoperasionalkan ADR-01 dengan cache provider yang sungguhan, bukan simulasi.
`messages` = satu user message berisi `dynamicText` (dibungkus penanda dari
`renderContextPack`, sudah termasuk amplop "ini data bukan instruksi") + baris
kosong + `userMessage`. Header wajib: `x-api-key: ${ANTHROPIC_API_KEY}`,
`anthropic-version: 2023-06-01`. Usage dari respons: `usage.input_tokens` (sudah
eksklusif cache — normalisasi sesuai catatan di `cost.ts`), `usage.output_tokens`,
`usage.cache_creation_input_tokens` → `cacheWriteTokens`,
`usage.cache_read_input_tokens` → `cacheReadTokens`.

**Local (Ollama-compatible, `${ECORIONE_LOCAL_BASE_URL}/chat/completions`)**: format
OpenAI chat-completions. `usage.prompt_tokens`/`completion_tokens` — Ollama tidak
punya cache, jadi `cacheReadTokens`/`cacheWriteTokens` selalu 0.

Tidak ada API key asli dipakai di test — semua test HTTP provider pakai
`undici` `MockAgent` (`setGlobalDispatcher`), mem-mock persis endpoint di atas.
Kalau `ANTHROPIC_API_KEY` kosong di runtime nyata (bukan test) dan `target: "hosted"`
diminta, Connect membalas `502` dengan pesan jelas ("kredensial provider belum
diisi di `.env`"), bukan mencoba memanggil dan gagal samar.

---

## Hub — control plane (`services/hub`)

DB sendiri: `ECORIONE_HUB_DB_PATH`. Tabel: `audit_events` (append-only, kolom
mengikuti `AuditEventSchema`), `approvals` (`operation_id` PK, `action_request` JSON,
`status`, `prompt`, `decided_by`, `decided_at`, `created_at`).

- `POST /v1/chat` — **endpoint inti Fase 1**. Body `ChatRequest`, respons
  `ChatResponse` (`@ecorione/shared-schema/chat`). Langkah di dalamnya:
  1. `operationId = makeId("operation")`.
  2. Bangun `ActionRequest` (`actionClass: "READ"`, `tool: "chat.reply"`,
     `idempotencyKey: null` — `READ` tidak punya efek samping).
  3. `evaluatePolicy(actionRequest)` (`policy-engine.ts`, aturan deterministik —
     lihat di bawah) → catat `AuditEvent` `ACTION_REQUESTED` lalu `POLICY_EVALUATED`.
     Untuk `READ`, verdict harus `ALLOW` (`alwaysRequiresApproval` cuma menyala untuk
     4 kelas lain) — kalau bukan `ALLOW`, itu bug policy engine, lempar 500 dengan
     pesan eksplisit, jangan diam-diam lanjut.
  4. Panggil Context: `GET /v1/core-memory`, `POST /v1/retrieve`
     (`query: message`, `scopes: [scope]`, `maxSensitivity`, `now`),
     `GET /v1/episodes?sessionId=...&limit=6`, `GET /v1/artifacts?scope=...&limit=5`.
  5. Rakit `StablePrefix` (system prompt tetap — konstanta di Hub, **bukan** dibuat
     dinamis dari input — dan `coreMemory` dari langkah 4) lalu
     `assembleContextPack` (`@ecorione/context-assembly`, `now` dari langkah 1)
     dan `renderContextPack` untuk dapat `dynamicText`.
  6. `POST {Connect}/v1/complete` dengan `target: "hosted"`.
  7. Catat `AuditEvent` `MODEL_CALLED` (detail = `cost` dari respons Connect).
  8. `POST {Context}/v1/episodes` dua kali (giliran user, giliran assistant) —
     `trust: "USER"` untuk pesan pengguna, `trust: "LOCAL_AGENT"` untuk balasan
     (balasan model **hosted** tidak otomatis `USER`-trust; ditandai asalnya apa
     adanya — ini kenapa `Provenance.sourceApp` diisi `"connect:claude-sonnet-4-5"`,
     bukan disamarkan jadi seolah pengguna sendiri yang menulis).
  9. `POST {RnD}/v1/traces` dengan span dari `buildGenAiSpan` (operation `"chat"`).
  10. Respons `ChatResponse` ke Ai, termasuk `memoryUsed` (dari hasil langkah 4) dan
      `cost` (dari langkah 6).

  Kegagalan di langkah 4/6/9 (Context/Connect/RnD tidak bisa dihubungi) → 502 dengan
  `type: "UPSTREAM_UNAVAILABLE"` dan nama service yang gagal — **tidak** fallback
  diam-diam ke jawaban tanpa konteks (itu melanggar prinsip "tidak ada fallback
  diam-diam" `prd.md` §7 Ai).

- `POST /v1/memory/forget` — body `{ factId, reason }`
  (`ForgetFactRequest`) → evaluasi policy (`actionClass: "REVERSIBLE_WRITE"`, selalu
  `ALLOW` di Fase 1 karena tidak masuk `ALWAYS_GATED`), panggil
  `POST {Context}/v1/facts/:id/forget`, catat `AuditEvent` `MEMORY_INVALIDATED`
  (detail berisi `reason`), balas `MemoryFact` yang sudah di-invalidate.

- `POST /v1/actions/evaluate` — body `ActionRequest` → `PolicyVerdict`. Primitif
  umum untuk aksi bergerbang yang akan dipakai Flow/Sandbox/AutoClick di fase
  berikutnya — di Fase 1 cukup diuji lewat aturan-aturan yang sudah ada, tidak perlu
  executor nyata di baliknya.

- `POST /v1/approvals/:operationId/decide` — body `{ decision: ApprovalDecision, note?: string }`
  → validasi `decision !== "RESPOND"` untuk approval bertipe efek-samping (lihat
  gotcha di `policy.ts`), update baris `approvals`, catat `AuditEvent`
  `APPROVAL_DECIDED`. Eksekusi nyata di balik `APPROVE` **belum** ada executor
  (Sandbox/Flow adalah Fase 3/4) — dicatat statusnya `APPROVED`, tidak berpura-pura
  mengeksekusi apa pun.

- `GET /v1/audit?operationId=...` → `{ events: AuditEvent[] }`.

### Policy engine (`policy-engine.ts`)

Aturan deterministik bernomor (`PolicyRule.id`), dievaluasi berurutan, berhenti di
yang pertama menyala:

1. `id: "always-gated"`, versi `"1"` — kalau `alwaysRequiresApproval(actionClass)` →
   `REQUIRE_APPROVAL`.
2. `id: "autonomy-ceiling"`, versi `"1"` — kalau `autonomyExceeds(req.autonomy, MAX_AUTONOMY_V1)` → `DENY`.
3. `id: "read-always-allowed"`, versi `"1"` — kalau `actionClass === "READ"` → `ALLOW`.
4. `id: "default-allow-l1-l3"`, versi `"1"` — sisanya (reversible write dalam plafon
   otonomi) → `ALLOW`. *(Fase 1 hanya benar-benar melatih jalur 1 dan 3 lewat chat +
   forget; aturan 2/4 ditulis lengkap dan diuji unit supaya Fase 3+ tidak mulai dari
   nol, bukan spekulasi tak teruji — tulis test untuk tiap aturan.)*

---

## Ai (`apps/ai`, Next.js)

- Satu halaman chat (`app/page.tsx`), App Router, komponen minimal sesuai
  `@ecorione/shared-ui` (tokens/css/components — pakai `renderButton`/`renderStatusChip`
  polanya kalau cocok, atau styling langsung dengan token warna yang sama; **jangan**
  bikin design system kedua).
- State sesi: `sessionId` dibuat sekali per tab (`makeId("session")`-style di client —
  boleh pakai `crypto.randomUUID()` lalu format `sess_<hex>`, tidak perlu impor
  `@ecorione/shared-schema` ke browser bundle kalau merepotkan; validitasnya toh
  diperiksa ulang oleh Zod di Hub).
- Kirim `POST {ECORIONE_HUB_URL}/v1/chat` lewat **route handler Next.js**
  (`app/api/chat/route.ts`) — bukan langsung dari browser — supaya
  `ECORIONE_INTERNAL_TOKEN` tidak pernah sampai ke client bundle.
- Tampilkan: balasan, **routing yang dipakai** (`cost.model`, `cost.cacheHit` —
  "tidak ada fallback diam-diam", `prd.md` §7), panel "memori yang dipakai"
  (`memoryUsed.recalledFacts`/`coreMemoryBlocks`/`episodicSummaries`) dengan tombol
  "lupakan" satu-klik per fakta yang memanggil `app/api/forget/route.ts` →
  `POST {Hub}/v1/memory/forget`.
- Test: minimal test komponen/route handler pakai Vitest (bukan Playwright — di luar
  cakupan Fase 1), mock `fetch` ke Hub.

---

## Test integrasi lintas-service (root, task terpisah)

`test/chat-loop.test.ts` — menjalankan Hub secara in-process (`app.inject`, **bukan**
listen port sungguhan) dengan Context/Connect/RnD **juga in-process** (masing-masing
`createServer()` lalu `app.inject`, dihubungkan lewat fetch yang di-stub ke
`app.inject` masing-masing, atau — lebih sederhana — jalankan Context/Connect/RnD di
port acak (`listen({ port: 0 })`) sungguhan untuk durasi test lalu `close()` di
`afterAll`. Provider hosted **selalu** di-mock lewat `undici` `MockAgent` — tidak ada
test yang butuh `ANTHROPIC_API_KEY` asli. ~10 kasus (lihat task "Wire dev orchestration
+ 10 golden integration tests" untuk daftar lengkap).
