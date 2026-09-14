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
| W06 | Credential Vault integration | **DONE WITH LIMITATIONS — REPO SIDE** | Paste → transient test → save → metadata/masked state → replace/remove; plaintext tidak dipersist oleh browser/UI test path. |
| W07 | Provider health/status | **DONE WITH LIMITATIONS — REPO SIDE** | Connected / Invalid key / Unreachable / Disabled / routing-unavailable dipetakan dari backend evidence; real external key validation tetap membutuhkan operator credential. |
| W08 | Default AI selection | **DONE — REPO SIDE** | User dapat memilih default Local atau configured Hosted; fail-safe ke Local bila hosted tidak siap; auto-router tidak diklaim. |
| W09 | One-command full-system startup | **STARTED — NEEDS OPERATOR RUNTIME** | Satu command menyalakan full required stack, menunggu readiness, dan fail-safe membersihkan child stack; real clean Windows proof masih wajib. |
| W10 | `ecorione doctor` diagnostics | **STARTED — NEEDS OPERATOR RUNTIME** | Dependency/service health/ports/Temporal/local runtime didiagnosis manusiawi; operator matrix belum selesai. |
| W11 | Installer/Launcher | **STARTED — REPO-SIDE PACKAGING READY** | Launcher, reproducible bundle, installer spec, dan manual packaging workflow tersedia; real `Setup.exe` + clean-Windows install/start proof masih wajib. |
| W12 | Attachment composer real backend path | **DONE — REPO SIDE** | File/foto → Artifact → Context pointer → controlled hydration; staged files remain removable before Send; partial upload failures remain retryable. |
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

1. **W11 operator/release proof** — repo-side packaging sudah siap; closure menunggu real installer artifact + clean Windows proof.
2. **W09–W10 operator proof** — tetap terbuka dan ditutup hanya melalui real clean Windows/operator-runtime evidence.
3. **W13** — immutable model identity.
4. **W14–W15** — real product eval + agentic local-model validation.
5. **W16–W18** — semantic selector, ECX no-oracle, hosted economics.
6. **W19–W20** — governance + final synchronization.

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
- Settings current memakai flow `Paste → Test key → Encrypt & save` untuk provider connection-test-ready. Save terkunci sampai test PASS untuk provider + secret revision yang sama.
- Mengubah provider atau secret langsung menginvalidasi test PASS sebelumnya; test stamp hanya menyimpan provider/revision/pass, bukan plaintext secret.
- Credential-only provider tetap dapat menyimpan credential dengan pesan eksplisit bahwa connection test dan model routing belum tersedia.
- Provider health detail dikeluarkan melalui **provider canary boundary**, bukan mengubah kontrak normal `/v1/complete`.
- Provider canary dan transient credential test memakai cache terisolasi sehingga health result tidak dapat PASS hanya karena exact-match cache lama.
- Normal completion tetap backward-compatible dan tetap memakai exact-match cache normal; generic provider failure tetap `UPSTREAM_UNAVAILABLE`.
- Canary dapat membedakan `PROVIDER_CREDENTIAL_MISSING`, `PROVIDER_INVALID_CREDENTIAL`, `PROVIDER_UNREACHABLE`, dan `PROVIDER_UPSTREAM_ERROR`.
- Local runtime network failure juga diklasifikasikan `unreachable` sehingga health semantics konsisten dengan hosted providers.
- Transient provider test adalah real hosted call dan tetap tunduk pada operator kill switch + spend guard. Tidak ada bypass safety hanya untuk membuat onboarding terlihat berhasil.

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

### Desktop installer/launcher path saat ini

- `desktop/` adalah **single source of truth** launcher normal-user; duplikasi launcher/compose yang sempat muncul selama W11 sudah dibersihkan.
- `Start-ECORIONE.cmd`, `Doctor-ECORIONE.cmd`, dan `Stop-ECORIONE.cmd` membungkus `desktop/ecorione.ps1` sehingga user tidak perlu menjalankan Git, Node, pnpm, atau command Docker manual.
- launcher membuat secret lokal saat first start dan menyimpan config di `%LOCALAPPDATA%\\ECORIONE`; plaintext secret tidak dikomit ke repository.
- launcher memakai prebuilt image `ecorione:desktop` dan dapat memuat `runtime/ecorione-image.tar` dari bundle resmi bila image belum ada.
- `desktop/compose.yml` menjalankan fleet Phase 4 + Temporal dan hanya publish browser UI ke loopback `127.0.0.1:3000`.
- persistent Docker volumes dipertahankan pada normal stop; launcher tidak memakai `down -v` atau `docker volume rm`.
- `pnpm desktop:bundle` membangun image, mengekspor `runtime/ecorione-image.tar`, menyalin launcher canonical, menulis `RELEASE-MANIFEST.json`, dan membuat `SHA256SUMS`.
- `desktop/installer.iss` adalah installer spec per-user/no-admin; installer hanya membawa prepared bundle, bukan source repository.
- `.github/workflows/desktop-installer.yml` adalah workflow **manual-only** (`workflow_dispatch`) untuk build bundle Linux x64 lalu compile Windows Setup via Inno Setup dan menghasilkan installer SHA-256.
- workflow tidak auto-publish GitHub Release dan tidak berjalan otomatis pada push/PR.
- Docker Desktop masih merupakan prerequisite runtime pada desain W11 saat ini. W11 belum membuktikan install/start pada clean Windows dan belum menghasilkan evidence real `Setup.exe` dari workflow yang sudah berada di default branch.

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
- browser dibuka best-effort;
- spawn error dilaporkan segera, bukan menunggu readiness timeout;
- bila readiness gagal, child Phase 4 stack dibersihkan dengan `SIGTERM` dan eskalasi `SIGKILL` bila perlu agar startup failure tidak sengaja meninggalkan partial child process.

`engine:doctor`:

- memeriksa Node, pnpm, `.env`, Docker, Temporal, required service health, dan Ai;
- melakukan local AI inference probe melalui Connect provider-canary sehingga diagnostic tetap vendor-neutral untuk runtime OpenAI-compatible;
- menampilkan model/latency ketika probe PASS atau machine-readable provider failure ketika runtime tidak reachable.

Real Windows/operator proof tetap diperlukan sebelum W09/W10 ditutup. Repo-side lifecycle cleanup tidak diklaim sebagai bukti bahwa seluruh Windows descendant process-tree sudah tervalidasi pada mesin operator.

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

### 2026-09-14 — W06 — DONE WITH LIMITATIONS — REPO SIDE

**Changed:**

- secure save/replace/remove memakai Connect Credential Vault; plaintext tidak dikembalikan dari Vault API;
- `POST /v1/settings/credentials/:provider/test` menguji credential transient untuk provider routing-ready tanpa persistence;
- transient test memakai provider adapter + pinned model/pricing + spend/operator boundary yang sama dengan real completion;
- provider credential-only sengaja tidak memiliki transient execution test sampai adapter contract benar-benar ada;
- provider canary memakai cache fresh terisolasi sehingga repeat health check tidak dapat false-positive dari exact-match cache lama;
- Settings current memiliki tombol `Test key` tanpa redesign visual;
- provider test-ready harus mendapat PASS sebelum `Encrypt & save` aktif;
- PASS terikat pada provider + secret revision yang sama; edit secret atau ganti provider menginvalidasi hasil lama;
- test stamp UI hanya menyimpan provider/revision/pass dan tidak menyimpan plaintext secret;
- credential-only provider tetap dapat disimpan dengan status jujur bahwa connection test/routing belum tersedia;
- Settings proxy mengizinkan transient credential-test path dengan path normalization/allowlist existing.

**Evidence:**

- backend/proxy hardening CI `34805318105`: **SUCCESS**;
- backend/proxy MCP External HTTPS `34805318063`: **SUCCESS**;
- final W06 UI/helper head sebelum docs sync: `a56ed8c05323e50338b0b6d29b00d484348311a6`;
- final W06 CI `34807658553`: **SUCCESS** — format, lint, typecheck, tests, Phase 4 real-process acceptance, production operations acceptance, secret scan, production build, naming;
- final W06 MCP External HTTPS Acceptance `34807658466`: **SUCCESS**.

**Limitation:** repo CI tidak memakai API key eksternal milik operator. Karena itu closure ini membuktikan contract/state/safety behavior, bukan validitas key tertentu atau real hosted spend. Real provider validation tetap membutuhkan operator credential + explicit spend intent.

### 2026-09-14 — W07 — DONE WITH LIMITATIONS — REPO SIDE

**Changed:**

- `ProviderError` memiliki taxonomy `unreachable | invalid-credential | upstream`;
- OpenAI/OpenRouter/Anthropic network errors dan 401/403 diklasifikasikan secara explicit;
- local model network failure juga `unreachable`;
- canary HTTP boundary mengekspos machine-readable health codes;
- normal completion tetap memakai backward-compatible generic upstream failure;
- Settings memetakan Not connected / Credential stored / Disabled / Connected / Invalid key / Unreachable / Routing unavailable;
- structured client errors membawa `error.code` tanpa raw HTTP payload UX.

**Evidence:** CI `34802392193` **SUCCESS**; MCP External HTTPS `34802392287` **SUCCESS**.

**Limitation:** real external provider credential tetap membutuhkan operator credential + explicit spend intent.

### 2026-09-14 — W08 — DONE — REPO SIDE

**Changed:**

- durable `defaultChatTarget = local | hosted`;
- legacy settings tanpa field baru dibaca sebagai `local`;
- Control Center dapat menyimpan preference tersebut;
- Settings Runtime form mempunyai `Default AI route` menggunakan style/layout existing;
- Chat memakai default Hosted hanya bila hosted gate aktif dan credential selected provider tersedia;
- fallback selalu Local bila provider belum siap atau settings fetch gagal;
- operator kill switch memaksa default kembali Local;
- tidak ada auto-router.

**Evidence:** CI `34802392193` **SUCCESS**.

**Limitation:** `Hosted` berarti configured hosted provider existing; bukan arbitrary model selector atau automatic model router.

### 2026-09-14 — W09 — STARTED — NEEDS OPERATOR RUNTIME

**Repo-side hardening:**

- `pnpm engine:start` menunggu full required Phase 4 fleet sebelum ready;
- spawn error sekarang terdeteksi langsung;
- readiness error membersihkan child Phase 4 process;
- cleanup mencoba `SIGTERM`, lalu `SIGKILL` bila child tidak berhenti;
- regression test mengunci spawn-error, graceful stop, dan forced-stop behavior.

**Evidence:** CI `34807198742` **SUCCESS**; MCP External HTTPS Acceptance `34807198794` **SUCCESS**.

**Remaining checkpoint:** clean Windows/operator-laptop startup, failure cleanup, dan descendant process behavior belum dibuktikan secara real. Karena itu W09 tetap STARTED.

### 2026-09-14 — W10 — STARTED — NEEDS OPERATOR RUNTIME

**Repo-side hardening:**

- `pnpm engine:doctor` memeriksa dependency/service baseline;
- doctor sekarang melakukan local model canary melalui Connect, bukan hardcode vendor runtime;
- successful probe menunjukkan response model/latency;
- runtime failure menunjukkan machine-readable provider health code;
- regression test mengunci success dan provider-unreachable path.

**Evidence:** CI `34806350853` **SUCCESS**; current W06 final CI `34807658553` juga tetap green dengan doctor changes terintegrasi.

**Remaining checkpoint:** operator matrix nyata — Docker mati, Temporal mati, healthy full stack, dan configured local model pada Windows/operator laptop. Karena itu W10 tetap STARTED.

### 2026-09-14 — W11 — STARTED — REPO-SIDE PACKAGING READY

**Changed:**

- mempertahankan `desktop/` sebagai single source of truth launcher normal-user dan membersihkan duplicate launcher/compose yang sempat dibuat selama iterasi W11;
- launcher canonical menyediakan double-click Start / Doctor / Stop, generated local secrets, user-local config, loopback-only UI, dan persistent volumes;
- `scripts/desktop-bundle.mjs` + `pnpm desktop:bundle` membangun prebuilt `ecorione:desktop`, mengekspor `runtime/ecorione-image.tar`, menulis versioned release metadata, dan `SHA256SUMS`;
- bundle staging hanya membawa launcher canonical + runtime image + license/manifest/checksum; source repo dan `desktop/installer.iss` tidak menjadi payload user;
- `desktop/installer.iss` mendefinisikan installer per-user/no-admin dengan shortcut Start / Doctor / Stop;
- `.github/workflows/desktop-installer.yml` menyediakan release packaging manual-only: Linux x64 build bundle → artifact handoff → Windows Inno Setup compile → installer SHA-256;
- static regression tests mengunci launcher/bundle/installer boundaries dan mencegah `git clone`, host pnpm/Node requirement, destructive volume removal, dan automatic push/PR installer builds.

**Evidence:**

- desktop bundle contract CI `34809623674`: **SUCCESS**;
- desktop bundle MCP External HTTPS `34809623637`: **SUCCESS**;
- final W11 repo-side CI `34811827567`: **SUCCESS** — format, lint, typecheck, tests, Phase 4 real-process acceptance, production operations acceptance, secret scan, production build, naming;
- final W11 MCP External HTTPS Acceptance `34811827677`: **SUCCESS**;
- final repo-side implementation head before this documentation sync: `eeb92901ecfebe9dd52c7d826658c8dbf9ace9d6`.

**Limitation / remaining checkpoint:**

- manual installer workflow baru bisa menjadi real release evidence setelah workflow tersedia pada default branch dan benar-benar dijalankan;
- real `ECORIONE-Setup-<version>.exe` belum dibuktikan pada checkpoint ini;
- clean-Windows install → launch → Docker prerequisite handling → runtime image load → full stack ready → browser open → stop → reinstall/uninstall preservation belum dijalankan pada operator machine;
- Docker Desktop masih prerequisite yang terlihat pada first-run failure/doctor path. W11 belum mencapai target final installer yang sepenuhnya menyembunyikan prerequisite/runtime complexity.

**Next step:** setelah merge/release checkpoint memungkinkan manual installer workflow dijalankan, build real Setup artifact dan lakukan clean-Windows operator acceptance. Sampai evidence itu ada, W11 tetap STARTED dan tidak boleh dinaikkan menjadi DONE.

### 2026-09-14 — W12 — DONE — REPO SIDE

**Changed:**

- composer file/foto/folder attachment sekarang staged di browser sampai user menekan Send; memilih file tidak lagi diam-diam membuat Context episode;
- saat Send, file di-ingest melalui Artifact lalu pointer/context episode dibuat melalui Context sebelum chat request dikirim;
- successful attachment menyimpan `artifactId` + `contextEpisodeId`, dan chat hanya membawa controlled pointer metadata, bukan raw bytes;
- staged/error attachment dapat dihapus; attachment yang sudah berhasil masuk Context tidak lagi menampilkan remove action palsu;
- partial batch failure mempertahankan attachment yang sudah berhasil dan hanya mengulang item yang belum punya `contextEpisodeId`;
- UI state `preparingAttachments` mencegah send/target/file mutation race selama ingest;
- helper/test coverage mengunci max attachment count, staged/removable semantics, upload → Artifact → Context order, controlled hydration pointer, partial failure, dan retry retention;
- real Temporal restart acceptance timeout dinaikkan dari 60s ke 120s setelah satu runner-heavy CI timeout tepat di hard limit; assertion dan test tetap aktif/tidak di-skip.

**Evidence:**

- staged-composer candidate CI `34830648734`: **SUCCESS**; MCP External HTTPS `34830648703`: **SUCCESS**;
- clean materialized W12 CI `34831383633`: **SUCCESS**; MCP External HTTPS `34831383606`: **SUCCESS**;
- timeout-hardening/full closure candidate CI `34832105529`: **SUCCESS** — format, lint, typecheck, 690 tests, Phase 4 real-process acceptance, production operations acceptance, secret scan, production build, naming.

**Limitation:** closure ini repo-side. Rendered browser/operator UX proof tetap bagian W03; tidak diklaim dari CI.

## 10. Claim boundary

Dokumen ini adalah active execution plan + work log. `DONE` hanya boleh diberikan bila implementation/evidence aktual mendukungnya. `DONE — REPO SIDE` tidak menggantikan runtime/browser/operator evidence yang secara eksplisit masih dibutuhkan.

Canonical historical evidence dan current-state documents tetap berlaku untuk claim lama yang sudah ditutup; dokumen ini tidak menghapus evidence tersebut.
