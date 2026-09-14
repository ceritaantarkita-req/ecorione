# ECORIONE — Active Work Plan

Last updated: **2026-09-14**

Status: **ACTIVE / canonical execution log for current work**

Dokumen ini adalah living document untuk pekerjaan aktif ECORIONE setelah Phase 4. Setiap pekerjaan yang dilakukan terhadap repository **wajib memperbarui dokumen ini sebelum pekerjaan dianggap selesai**.

## 1. Aturan kerja aktif

1. **Visual current di-freeze.** Jangan redesign sidebar, layout, warna, composer, atau bahasa visual yang sudah ada kecuali ada defect nyata atau kebutuhan fungsi yang tidak bisa diselesaikan tanpa perubahan visual.
2. Perubahan UX harus mengikuti desain existing. Fokus sekarang adalah fungsi, onboarding, reliability, observability, dan usability.
3. Jangan menambah modul besar baru sebelum gap aktif ditutup atau ada evidence nyata yang membenarkannya.
4. Fase 5 AutoClick tetap **DEFERRED BY DESIGN** sampai ada use case nyata yang tidak dapat diselesaikan melalui API/MCP.
5. Fase 6+ tetap **OPEN-ENDED / evidence-driven**. Tidak ada implicit Batch 13 atau urutan phase tambahan yang diasumsikan otomatis.
6. Source of truth teknis: current code + current evidence + canonical current-state docs.
7. **Setiap selesai satu pekerjaan, update dokumen ini terlebih dahulu** dengan status, hasil, evidence, commit/PR, limitation, dan next step.
8. Status `DONE` repo-side tidak boleh dipakai untuk menyamarkan checkpoint yang masih membutuhkan operator laptop/runtime.

## 2. Target aktif

Tujuan tahap ini adalah mengubah ECORIONE dari sistem yang terutama nyaman bagi developer menjadi produk yang dapat dipasang, dinyalakan, dikonfigurasi, dan digunakan user awam tanpa harus memahami Git, pnpm, Docker, Temporal, atau struktur service internal.

Empat blok utama:

- **A. Stabilkan produk** — UX runtime, testing, attachment, health/error handling.
- **B. Sederhanakan onboarding** — provider credentials, default AI, one-command startup, installer/launcher.
- **C. Stabilkan AI** — immutable model identity, real product eval, agentic local-model validation.
- **D. Buktikan optimizer** — automatic semantic reference selector, ECX tanpa oracle, hosted cost validation.

## 3. Work queue aktif

| ID | Pekerjaan | Status | Definition of done |
|---|---|---:|---|
| W01 | Reconcile `system-analysis-2026-09-13.md` | **DONE** | Temuan valid/outdated dipisahkan dan blocker lama tidak lagi dianggap current tanpa evidence. |
| W02 | Tutup gap Vitest `*.test.tsx` | **DONE** | TSX tests masuk discovery normal/CI dan hydration test benar-benar berjalan. |
| W03 | Audit UX/Product Validation current `main` | **BLOCKED — OPERATOR RUNTIME** | Full rendered Phase 4 walkthrough current main; tidak ada S0/S1 terbuka. |
| W04 | Rapikan partial-stack vs full-stack behavior | **DONE — REPO SIDE** | Raw HTTP/proxy errors tidak menjadi UX normal; service-down state manusiawi. |
| W05 | Provider Settings foundation | **DONE — REPO SIDE** | Baseline provider dapat dikonfigurasi tanpa edit `.env`; execution support hanya diklaim bila adapter/model/pricing contract nyata tersedia. |
| W06 | Credential Vault integration | **STARTED — BACKEND CONTRACT DONE** | Paste → test → save → metadata/masked display → replace/remove; plaintext tidak disimpan browser. |
| W07 | Provider health/status | **DONE WITH LIMITATIONS — REPO SIDE** | Connected / Invalid key / Unreachable / Disabled / routing-unavailable dipetakan dari backend evidence; real external key validation tetap membutuhkan operator credential. |
| W08 | Default AI selection | **DONE — REPO SIDE** | User dapat memilih default Local atau configured Hosted; fail-safe ke Local bila hosted tidak siap; auto-router tidak diklaim. |
| W09 | One-command full-system startup | **STARTED — NEEDS OPERATOR RUNTIME** | Satu command menyalakan full required stack dan menunggu readiness; real clean Windows proof masih wajib. |
| W10 | `ecorione doctor` diagnostics | **STARTED — NEEDS OPERATOR RUNTIME** | Dependency/service health/ports/Temporal/local runtime didiagnosis manusiawi; operator matrix belum selesai. |
| W11 | Installer/Launcher | TODO | Normal user: install → open/start → use; Git clone/pnpm bukan requirement. |
| W12 | Attachment composer real backend path | TODO | File/foto → Artifact → Context pointer → controlled hydration, bukan label-only. |
| W13 | Immutable local model identity | TODO | Runtime/evidence memakai identity/version/digest reproducible; mutable alias tidak dipakai untuk durable claims. |
| W14 | Product eval foundation | TODO | Eval berasal dari tugas/bug nyata dan tumbuh menuju 30–40 cases tanpa synthetic filler. |
| W15 | Agentic local-model eval v1 | TODO | Local model diuji reason/choose-tool/execute/observe/verify dengan failure modes terukur. |
| W16 | Automatic semantic reference selector | TODO | Auto-selective path tidak lagi membutuhkan caller/oracle `refIndexes`. |
| W17 | ECX end-to-end tanpa oracle | TODO | Full-context vs auto-selective vs oracle dibandingkan pada task set sama. |
| W18 | Hosted economic validation | TODO | Actual hosted token/cost dibandingkan secara bounded dengan explicit operator spend intent. |
| W19 | Release/security governance follow-up | TODO | Full-history secret scan benar-benar menjadi gate dan governance `main` diperketat sesuai keputusan operator. |
| W20 | Final current-state sync | TODO | Canonical docs, implementation, evidence, limitations, dan next checkpoint sinkron. |

## 4. Prioritas eksekusi

Urutan kerja selama tidak ada temuan baru:

1. **W06** — selesaikan UI `Paste → Test → Save` di atas backend transient credential-test yang sudah green.
2. **W09–W10** — repo-side refinement boleh lanjut; closure menunggu operator runtime.
3. **W11** — installer/launcher path agar normal user tidak menyentuh source tooling.
4. **W12** — real attachment pipeline.
5. **W13** — immutable model identity.
6. **W14–W15** — real product eval + agentic local-model validation.
7. **W16–W18** — semantic selector, ECX no-oracle, hosted economics.
8. **W19–W20** — governance + final synchronization.

W03 tetap dibuka sampai rendered operator walkthrough selesai dan tidak boleh dipalsukan menjadi DONE melalui CI/static inspection saja.

## 5. Provider onboarding boundary

Normal user tidak boleh diwajibkan mengedit `.env` untuk menghubungkan model/provider.

Target flow:

```text
Settings → AI Provider → Paste API key → Test → Save → Choose route/model
```

Provider baseline:

- OpenAI / ChatGPT API
- Anthropic / Claude API
- OpenRouter
- Kimi / Moonshot
- Google Gemini
- Qwen
- GLM
- Custom OpenAI-compatible

Current implementation boundary:

- Connect-owned **Provider Catalog** adalah source of truth metadata onboarding provider untuk Settings dan Credential Vault.
- Credential Vault mengenali Anthropic, OpenAI, OpenRouter, Kimi, Gemini, Qwen, GLM, custom OpenAI-compatible, dan MCP token.
- **Anthropic, OpenAI, OpenRouter** adalah routing-ready dan connection-test-ready karena adapter/model/pricing contract existing tersedia.
- **Kimi, Gemini, Qwen, GLM, custom OpenAI-compatible** saat ini **credential-ready only**. Jangan klaim execution/test support sebelum endpoint/model identity/pricing/adapters selesai.
- Credential authority tetap Connect / Credential Vault; UI hanya membaca metadata dan tidak dapat mengambil plaintext kembali.
- `POST /v1/settings/credentials/:provider/test` menguji secret secara transient untuk routing-ready provider tanpa menyimpannya ke Vault; provider credential-only ditolak oleh schema hosted-provider.
- Provider health detail dikeluarkan melalui **provider canary boundary**, bukan mengubah kontrak normal `/v1/complete`.
- Provider canary dan transient credential test memakai cache terisolasi sehingga health result tidak dapat PASS hanya karena exact-match cache lama.
- Normal completion tetap backward-compatible dan tetap memakai exact-match cache normal; generic provider failure tetap `UPSTREAM_UNAVAILABLE`.
- Canary dapat membedakan `PROVIDER_CREDENTIAL_MISSING`, `PROVIDER_INVALID_CREDENTIAL`, `PROVIDER_UNREACHABLE`, dan `PROVIDER_UPSTREAM_ERROR`.
- Local runtime network failure juga diklasifikasikan `unreachable` sehingga health semantics konsisten dengan hosted providers.

## 6. Default AI boundary

`defaultChatTarget` sekarang merupakan durable runtime setting dengan nilai:

```text
local | hosted
```

Rules:

- default untuk file/settings lama adalah **Local**;
- Settings current mempunyai `Default AI route` tanpa redesign layout/theme;
- Chat membaca runtime setting dan credential metadata saat startup;
- default Hosted hanya dipakai bila hosted calls aktif **dan** credential untuk selected hosted provider tersedia;
- bila gate/credential tidak siap atau Settings tidak dapat dibaca, chat fail-safe ke **Local**;
- operator hosted kill switch memaksa `hostedCallsEnabled=false` **dan** `defaultChatTarget=local`;
- route tetap dapat dipilih manual sebelum pesan pertama dan dikunci untuk sesi setelah percakapan mulai;
- **Auto routing belum diimplementasikan atau diklaim.**

## 7. Startup/onboarding boundary

### Normal user target

```text
Install ECORIONE → Open → Start/auto-start → Use
```

Normal user tidak boleh diwajibkan memahami Git, Node, pnpm, Docker command, Temporal command, atau internal service ports.

### Advanced/developer bridge saat ini

```text
pnpm engine:start
pnpm engine:doctor
pnpm engine:stop-temporal
```

`engine:start`:

- membuat `.env` dari `.env.example` bila belum ada;
- membuat local internal token dan Vault master key;
- memastikan Temporal lokal tersedia;
- menjalankan full `dev:phase4`;
- baru menyatakan ready setelah Ai + RnD + Context + Connect + Hub + Artifact + Sandbox + Space + Flow sehat;
- browser dibuka best-effort.

`engine:doctor` memeriksa Node, pnpm, `.env`, Docker, Temporal, required service health, dan Ai. Real Windows/operator proof tetap diperlukan sebelum W09/W10 ditutup.

## 8. Visual freeze boundary

Yang boleh berubah tanpa membuka redesign:

- provider/settings controls;
- onboarding wizard;
- service/provider health status;
- human-readable errors;
- attachment functional state;
- installer/launcher surface;
- accessibility/responsiveness defect fixes.

Yang **tidak** dikerjakan sekarang tanpa alasan produk baru yang kuat:

- redesign sidebar/navigation;
- theme/color overhaul;
- typography overhaul;
- composer visual overhaul;
- decorative UI refactor tanpa functional value.

## 9. Execution log

### 2026-09-14 — W00/W01 — DONE

Living work plan dibuat dan `system-analysis-2026-09-13.md` direconcile dengan real current state. Credential Vault, durable spend ledger, external MCP acceptance, dan existing history scanner tidak lagi salah dibaca sebagai blocker yang belum pernah ada. Kritik yang masih valid dipertahankan: product-use proof, mutable model identity, attachment label-only, hosted-dollar validation, eval suite, dan current rendered UX validation.

Evidence: `docs/active-work-plan.md`, commit W01 `89592d7ed4c5508e8fa1031bdc9197162ae4ad67`.

### 2026-09-14 — W02 — DONE

Vitest discovery mencakup `*.test.tsx`; React automatic JSX transform disamakan dengan runtime Next/React. Hydration test yang sebelumnya silent-skip sekarang benar-benar berjalan.

Evidence: CI `34796812823` **SUCCESS**, 120 test files saat closure W02.

### 2026-09-14 — W03 — BLOCKED — OPERATOR RUNTIME

Static repo audit selesai, tetapi official UX-01..UX-12 membutuhkan full Phase 4 rendered/browser walkthrough pada operator laptop/current code. Tidak ada klaim closure tanpa evidence tersebut.

### 2026-09-14 — W04 — DONE — REPO SIDE

Shared client-response parser dipakai untuk human-readable structured failures. Space/Operations tidak lagi menjadikan raw `HTTP 502: {...}` sebagai UX normal. Tidak ada visual redesign.

Evidence: CI `34800259393` **SUCCESS**; MCP External HTTPS `34800259408` **SUCCESS**.

### 2026-09-14 — W05 — DONE — REPO SIDE

**Changed:**

- Connect-owned Provider Catalog menjadi source of truth metadata provider untuk Settings/Vault;
- Settings membaca provider catalog dari Connect, bukan hardcode provider metadata sendiri;
- Vault provider namespace/purpose memakai catalog yang sama sehingga tidak ada duplicate provider list untuk onboarding;
- Anthropic/OpenAI/OpenRouter tetap satu-satunya routing-ready + connection-test-ready baseline;
- Kimi/Gemini/Qwen/GLM/custom OpenAI-compatible tetap credential-ready only dan tidak dipalsukan sebagai executable provider;
- settings proxy membatasi namespace/path tetapi membiarkan Connect menjadi authority validasi provider ID.

**Evidence:**

- catalog regression closure commit `6bd8947c05efd8cfa50a0d53c2a38841ba53b502`;
- CI `34804967775`: **SUCCESS** — format, lint, typecheck, tests, Phase 4 real-process acceptance, production operations acceptance, secret scan, production build, naming;
- MCP External HTTPS Acceptance `34804967763`: **SUCCESS**.

**Claim boundary:** menambahkan credential slot tidak sama dengan menambahkan model execution. Provider baru baru boleh `routingReady=true` setelah adapter, pinned runtime/model identity, dan cost/pricing semantics dapat diaudit.

### 2026-09-14 — W06 — STARTED — BACKEND CONTRACT DONE

**Changed:**

- secure save/replace/remove tetap memakai Connect Credential Vault; plaintext tidak dikembalikan dari Vault API;
- `POST /v1/settings/credentials/:provider/test` menambahkan test credential transient untuk provider routing-ready tanpa persistence;
- transient test memakai provider adapter + pinned model/pricing + spend boundary yang sama dengan real completion;
- provider credential-only seperti Kimi sengaja ditolak dari transient execution test sampai adapter contract benar-benar ada;
- provider canary sekarang memakai cache fresh terisolasi, sehingga repeat health check selalu menyentuh provider/runtime dan tidak dapat false-positive dari exact-match cache lama;
- regression test membuktikan dua local canary menghasilkan dua provider calls dan selalu `cacheHit=false`;
- regression test membuktikan OpenAI transient secret diteruskan ke adapter tetapi tidak muncul sebagai persisted credential;
- Settings proxy mendukung path `/credentials/:provider/test` dengan path normalization/allowlist existing.

**Evidence:**

- backend/proxy hardening head `89ac7d5bbbebdd497494290549e44c9df9d950b6`;
- CI `34805318105`: **SUCCESS** — format, lint, typecheck, tests, Phase 4 real-process acceptance, production operations acceptance, secret scan, production build, naming;
- MCP External HTTPS Acceptance `34805318063`: **SUCCESS**.

**Remaining limitation:** current Settings page masih melakukan save langsung. UI `Paste → transient Test → Save`, reset test-state ketika provider/key berubah, dan masked confirmation belum selesai di branch karena write frontend terakhir tidak diterapkan. W06 tidak boleh dinyatakan DONE sebelum wiring tersebut masuk dan full CI kembali hijau.

### 2026-09-14 — W07 — DONE WITH LIMITATIONS — REPO SIDE

**Changed:**

- `ProviderError` memiliki taxonomy `unreachable | invalid-credential | upstream`;
- OpenAI/OpenRouter/Anthropic network errors dan 401/403 diklasifikasikan secara explicit;
- local model network failure sekarang juga `unreachable`;
- canary HTTP boundary mengekspos machine-readable health codes;
- normal completion tetap memakai backward-compatible generic upstream failure;
- Settings current memetakan state menjadi Not connected / Credential stored / Disabled / Connected / Invalid key / Unreachable / Routing unavailable;
- structured client errors membawa `error.code` tanpa raw HTTP payload UX;
- regression tests mengunci hosted dan local health taxonomy.

**Evidence:**

- latest implementation head sebelum docs update: `571ce60e610d0c700586e10d2c88e4e777728bc2`;
- CI run `34802392193`: **SUCCESS** — format, lint, typecheck, tests, Phase 4 real-process acceptance, production operations acceptance, secret scan, production build, naming;
- MCP External HTTPS Acceptance `34802392287`: **SUCCESS**;
- test suite pada final W07/W08 head: **123 test files**, seluruh test step PASS.

**Limitation:** tidak ada real external provider credential yang digunakan pada repo CI. Karena itu status ini adalah closure behavior/contract repo-side, bukan bukti bahwa suatu API key milik operator saat ini valid.

**Next:** real provider canary hanya saat operator memberikan credential + explicit spend intent; lanjut W06 UI credential onboarding.

### 2026-09-14 — W08 — DONE — REPO SIDE

**Changed:**

- menambahkan durable `defaultChatTarget = local | hosted`;
- legacy settings v1 tanpa field baru otomatis dibaca sebagai `local`;
- Control Center dapat menyimpan preference tersebut;
- current Settings Runtime form mempunyai `Default AI route` dengan style/layout existing;
- Chat memakai default Hosted hanya bila hosted gate aktif dan credential selected hosted provider tersedia;
- fallback selalu Local bila provider belum siap atau settings fetch gagal;
- operator kill switch memaksa default kembali Local;
- tidak ada auto-router dan tidak ada perubahan visual besar.

**Evidence:**

- persistence, control API, operator gate, Settings, Chat startup, dan regression tests seluruhnya terdapat pada head `571ce60e610d0c700586e10d2c88e4e777728bc2`;
- CI `34802392193`: **SUCCESS**;
- relevant tests termasuk runtime settings migration, Control Center runtime update, operator gate, hydration, provider-health, dan canary taxonomy PASS.

**Limitation:** `Hosted` berarti configured hosted provider existing; ini bukan arbitrary model selector dan bukan automatic model router. Provider credential-only masih menunggu executable adapter contract.

**Next:** W06 UI credential onboarding, lalu W09/W10 repo-side refinement.

### 2026-09-14 — W09 — STARTED — NEEDS OPERATOR RUNTIME

`pnpm engine:start` tersedia dan menunggu full required Phase 4 fleet sebelum menyatakan ready. Repository CI/engine helper tests sudah berjalan, tetapi clean Windows/operator-laptop startup belum dibuktikan.

### 2026-09-14 — W10 — STARTED — NEEDS OPERATOR RUNTIME

`pnpm engine:doctor` tersedia untuk dependency/service checks. Closure memerlukan operator matrix nyata (Docker mati, Temporal mati, healthy full stack, local model identity).

## 10. Claim boundary

Dokumen ini adalah active execution plan + work log. `DONE` hanya boleh diberikan bila implementation/evidence aktual mendukungnya. `DONE — REPO SIDE` tidak menggantikan runtime/browser/operator evidence yang secara eksplisit masih dibutuhkan.

Canonical historical evidence dan current-state documents tetap berlaku untuk claim lama yang sudah ditutup; dokumen ini tidak menghapus evidence tersebut.