# ECORIONE — Active Work Plan

Last updated: **2026-09-15**

Status: **ACTIVE / canonical execution log**

Current code + current evidence + dokumen ini adalah source of truth pekerjaan aktif. `DONE — REPO SIDE` tidak menggantikan browser, Windows, local-model runtime, credential, atau hosted-spend evidence yang memang harus dijalankan operator.

## 1. Current repository checkpoint

```text
main: 88c6a19c931fb18d00e14ecd53df140754ed78f0
PR #82: merged
post-merge CI: 34872595763 — SUCCESS
post-merge Product Eval: 34872595817 — SUCCESS
```

`main` adalah green baseline. GitHub `main` belum memiliki required status-check branch protection; governance gap ini tetap terbuka.

## 2. Work queue

| ID | Pekerjaan | Status | Boundary |
|---|---|---:|---|
| W01 | Reconcile system analysis | **DONE** | Temuan valid/outdated sudah dipisahkan. |
| W02 | Vitest `*.test.tsx` discovery | **DONE** | TSX tests masuk normal CI. |
| W03 | UX/Product Validation current main | **BLOCKED — OPERATOR RUNTIME** | Full rendered walkthrough; no S0/S1 open. |
| W04 | Partial/full stack behavior | **DONE — REPO SIDE** | Human-readable service-down/proxy failures. |
| W05 | Provider Settings foundation | **DONE — REPO SIDE** | Provider catalog + Settings/Vault authority. |
| W06 | Credential Vault integration | **DONE WITH LIMITATIONS — REPO SIDE** | Test/save/replace/remove; no browser plaintext persistence. |
| W07 | Provider health/status | **DONE WITH LIMITATIONS — REPO SIDE** | Real external credential validity tetap operator-owned. |
| W08 | Default AI selection | **DONE — REPO SIDE** | Durable Local/Hosted default; no auto-router claim. |
| W09 | One-command startup | **STARTED — NEEDS OPERATOR RUNTIME** | Clean Windows proof belum selesai. |
| W10 | `ecorione doctor` | **STARTED — NEEDS OPERATOR RUNTIME** | Operator matrix belum selesai. |
| W11 | Installer/Launcher | **STARTED — REPO-SIDE PACKAGING READY** | Real Setup + clean-Windows acceptance belum ada. |
| W12 | Attachment composer backend path | **DONE — REPO SIDE** | File/foto → Artifact → Context pointer → hydration. |
| W13 | Immutable local model identity | **DONE WITH LIMITATIONS — RUNTIME VERIFIED** | Current operator runtime berhasil memverifikasi selector + immutable digest; perubahan model/runtime tetap harus diverifikasi ulang. |
| W14 | Product eval foundation | **DONE — REPO SIDE** | 12 task/bug-derived deterministic regressions + dedicated gate. |
| W15 | Agentic local-model eval v1 | **STARTED — VERIFIED MODEL; FIRST RUN FAILED; FIX IN PROGRESS** | Real verified-model run sudah terjadi tetapi belum `pass^3`; runner observability defect ditemukan. |
| W16 | Automatic semantic reference selector | TODO | `refIndexes` tidak lagi caller/oracle-supplied. |
| W17 | ECX no-oracle validation | TODO | full vs auto-selective vs oracle pada task set sama. |
| W18 | Hosted economic validation | TODO | Real bounded hosted token/cost evidence. |
| W19 | Release/security governance follow-up | **DONE — REPO SIDE** | History secret scan + naming/model-alias gate di CI; branch protection gap terpisah. |
| W20 | Final current-state sync | **STARTED** | Final closure setelah remaining evidence selesai. |

## 3. Security / runtime boundaries

Sudah ada di `main`: same-origin mutation guard, CSP/security headers, stricter hosted-spend guard, private/loopback `localBaseUrl` default, mutable model-alias gate, runtime provenance resolver dengan digest mismatch fail-closed, dan full-history secret scan.

Known limitation: CSP masih membutuhkan `'unsafe-inline'` pada current Next App Router bootstrap. Required status checks/branch protection juga belum aktif.

Developer bridge:

```text
pnpm engine:start
pnpm engine:doctor
pnpm engine:stop-temporal
```

Temporal CLI local path, Windows `pnpm.cmd` handling, required-service readiness, dan spawned-process cleanup sudah repo-side. W09/W10 tetap terbuka sampai clean Windows proof ada.

## 4. ECX claim boundary

Historical Ledger + ECX local evidence tetap CLOSED/PASS. Comparative ECX tetap PASS WITH LIMITATIONS:

```text
5 tasks × 5 repeats × 3 lanes = 75 measured calls
cache hits = 0
passed task gates = 5/5
median selective transport reduction = 73.6379379246037%
median selective input-token reduction = 77.8580814717477%
median selective/full latency ratio = 0.8672873729681319
```

Tetapi `ecx-selective-oracle` masih oracle/control, `refIndexes` masih caller-supplied, automatic semantic selector belum terbukti, dan hosted dollar economics belum tervalidasi. Angka local/oracle tidak boleh menjadi universal public-savings claim.

## 5. W14 Product Eval

Status: **DONE — REPO SIDE**.

- `evals/product-regressions.json`: bounded maksimal 50 kasus; seed 12 kasus nyata.
- setiap kasus punya provenance + deterministic target.
- `.github/workflows/product-eval.yml` menjalankan validator + regressions di PR dan push main.

Evidence:

```text
PR #79 head: 183b9f3281dbedc16e459a3f09dea000d6756ba1
PR CI: 34864902355 — SUCCESS
PR Product Eval: 34864902358 — SUCCESS
merge: 01efc87ef0409118ad0104a660f4d97f6a49f667
post-merge CI: 34865204054 — SUCCESS
post-merge Product Eval: 34865204071 — SUCCESS
```

W14 tidak membuktikan model reasoning/tool quality; itu tetap W15.

## 6. W15 Agentic Local-Model Eval

Status: **STARTED — VERIFIED MODEL; FIRST STRICT RUN FAILED; RUNTIME DIAGNOSTIC FIX IN PROGRESS**.

PR #81 menambahkan bounded evaluation loop terpisah dari normal product chat runtime:

- empat seed case nyata: Operations diagnosis, workspace-aware MCP lookup, public `localBaseUrl` rejection, immutable model identity;
- tiap kasus punya minimal dua tool dan dapat punya forbidden/trap tool;
- `evals/agentic-eval-core.mjs` menilai `reason → tool → execute → observe → verify`;
- deterministic fixture mencegah model mengarang tool result;
- `scripts/local-agentic-eval.mjs` memanggil real local OpenAI-compatible `/chat/completions`;
- setiap kasus dijalankan 3× dan closure membutuhkan `pass^3`;
- evidence lokal ditulis ke `traces/` dan tidak di-commit;
- strict closure hanya eligible bila immutable local model digest verified terhadap runtime provenance;
- `--allow-unverified-identity` hanya exploratory.

### Runtime evidence 2026-09-15

Operator clone tersinkron bersih pada `88c6a19c931fb18d00e14ecd53df140754ed78f0`.

Verified local model:

```text
baseUrl: http://127.0.0.1:11434/v1
model: qwen3.5:9b
digest: 6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7
modelsReachable: true
listed: true
resolvedDigestPresent: true
identityVerified: true
```

First strict run:

```text
4 cases × 3 repetitions = 12 runs
passed: 0/12
allPass3: false
closureEligible: false
trace: traces/w15-agentic-eval-2026-09-14T17-19-28-389Z.json
reported avgLatencyMs: 0
reported avgOutputTokens: 0
```

Temuan penting: runner awal hanya menambahkan metadata call setelah `parseAgentAction` sukses. Akibatnya respons HTTP yang sudah datang tetapi gagal diparse dapat salah terlihat sebagai `0 ms / 0 token`, sama seperti failure sebelum respons. Karena itu hasil pertama **tidak boleh** diinterpretasikan sebagai model-quality failure sebelum stage failure diketahui.

Branch `agent/w15-runtime-observability-fix-20260915` memperbaiki evidence boundary tanpa mengubah scoring: call metadata dicatat sebelum parse, failure stage `call|parse|execute` ditampilkan, parse failure menyimpan preview output terbatas, dan model inference memakai timeout terpisah/default 120 detik yang dapat diubah eksplisit.

Evidence PR #81:

```text
PR head: 36aafca593b7ce73166aa0ffbcd8f37e90041e6f
PR CI: 34869356356 — SUCCESS
PR Product Eval: 34869356361 — SUCCESS
PR MCP External HTTPS: 34869356334 — SUCCESS
merge: ca059202fc8b8f41ebf3731b2a07bb8a24431143
post-merge CI: 34869692122 — SUCCESS
post-merge Product Eval: 34869692186 — SUCCESS
post-merge MCP External HTTPS: 34869692114 — SUCCESS
```

Claim boundary: harness W15 adalah bounded evaluation agent loop. Normal product chat tetap completion pipeline dan belum boleh disebut autonomous tool-calling agent.

## 7. Immediate next action

Prioritas langsung adalah menyelesaikan **W15 runtime diagnostic fix** lalu mengulang exact verified-model run:

```text
1. branch fix → PR → CI/Product Eval → merge → post-merge green
2. sync operator clone ke current main
3. pertahankan ECORIONE_LOCAL_MODEL=qwen3.5:9b
4. pertahankan verified ECORIONE_LOCAL_MODEL_DIGEST
5. pnpm eval:agentic:inventory
6. pnpm eval:agentic:local
7. baca failure stage + output preview bila gagal
8. hanya perbaiki protocol/model interaction bila evidence membuktikannya
9. tutup W15 hanya jika seluruh case pass^3 dan closureEligible=true
```

Setelah W15: W03 → W09/W10 → W11 → W16/W17 → W18 → W20. Repo-side item independen boleh maju lebih dulu, tetapi tidak boleh menghapus runtime claim boundaries.

## 8. Historical note

PR #76 sempat masuk `main` dengan formatting regression. PR #77 menutupnya dan post-merge CI `34858779881` SUCCESS. PR #80 menyinkronkan W14. PR #81 menambahkan W15 harness. PR #82 menyinkronkan canonical W15 state dan post-merge CI/Product Eval hijau.

`DONE` hanya dipakai bila implementation/evidence aktual mendukung. Historical verification docs tetap source of truth untuk evidence lama; dokumen ini menyatakan current execution state.