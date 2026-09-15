# ECORIONE — Active Work Plan

Last updated: **2026-09-15**

Status: **ACTIVE / canonical execution log**

Current code + current evidence + dokumen ini adalah source of truth pekerjaan aktif. `DONE — REPO SIDE` tidak menggantikan browser, Windows, local-model runtime, credential, atau hosted-spend evidence yang memang harus dijalankan operator.

## 1. Current repository checkpoint

```text
main: 00765be1c58198aaacdd867bada83e544fd9edd0
PR #84: merged
post-merge CI: 34882228907 / CI #796 — SUCCESS
post-merge Product Eval: 34882228970 / Product Eval #35 — SUCCESS
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
| W15 | Agentic local-model eval v1 | **DONE — VERIFIED LOCAL MODEL PASS^3** | 4/4 real cases pass^3 dengan immutable digest verified; claim hanya bounded eval harness, bukan autonomous product chat. |
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

W14 tidak membuktikan model reasoning/tool quality; itu tetap dipisahkan dari W15.

## 6. W15 Agentic Local-Model Eval

Status: **DONE — VERIFIED LOCAL MODEL PASS^3 / CLOSURE ELIGIBLE**.

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

Verified local model:

```text
baseUrl: http://127.0.0.1:11434/v1
model: qwen3.5:9b
digest: 6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7
modelsReachable: true
listed: true
resolvedDigestPresent: true
identityVerified: true
identityStatus: verified
```

Historical strict runs:

```text
run 1 baseline 88c6a19c...: 0/12; runner observability defect made 0 ms / 0 token ambiguous
run 2 baseline f54a11af...: W15-002 + W15-003 pass^3; W15-001 + W15-004 failed only brittle verify wording
```

PR #83 memperbaiki observability runtime. PR #84 memperbaiki deterministic verify assertions tanpa memakai LLM-as-judge dan menambah regression coverage agar paraphrase benar diterima sementara positive reproducibility claim yang salah tetap gagal.

Final strict closure run pada baseline `00765be1c58198aaacdd867bada83e544fd9edd0`:

```text
W15-001: 3/3 — PASS^3
W15-002: 3/3 — PASS^3
W15-003: 3/3 — PASS^3
W15-004: 3/3 — PASS^3
allPass3: true
closureEligible: true
trace: traces/w15-agentic-eval-2026-09-15T00-23-08-194Z.json
```

Observed final-run averages:

```text
W15-001 avgLatencyMs: 45325.57093333333 / avgOutputTokens: 218
W15-002 avgLatencyMs: 51400.95243333335 / avgOutputTokens: 278
W15-003 avgLatencyMs: 67915.01980000002 / avgOutputTokens: 370
W15-004 avgLatencyMs: 66684.78923333331 / avgOutputTokens: 357
```

Closure interpretation: W15 membuktikan model lokal immutable-identity `qwen3.5:9b` mampu melewati empat task/bug-derived cases secara `pass^3` dalam bounded evaluation agent loop saat diuji pada runtime operator tersebut. Evidence ini **tidak** membuktikan jalur chat produk ECORIONE sudah menjadi autonomous tool-calling agent; current product chat tetap completion pipeline dan claim boundary itu tetap berlaku.

## 7. Immediate next action

W15 sudah selesai. Urutan remaining evidence/work sekarang:

```text
1. W03 — full rendered UX/Product Validation current main
2. W09/W10 — clean-Windows one-command startup + doctor matrix
3. W11 — real Setup/launcher + clean-Windows acceptance
4. W16 — automatic semantic reference selector
5. W17 — ECX no-oracle validation
6. W18 — bounded hosted economic validation
7. W20 — final current-state sync/closure
```

Repo-side item independen boleh maju lebih dulu, tetapi runtime/browser/hosted claim boundaries tidak boleh dihapus atau diganti dengan asumsi.

## 8. Historical note

PR #76 sempat masuk `main` dengan formatting regression. PR #77 menutupnya dan post-merge CI `34858779881` SUCCESS. PR #80 menyinkronkan W14. PR #81 menambahkan W15 harness. PR #82 menyinkronkan canonical W15 state. PR #83 memperbaiki W15 runtime observability. PR #84 memperbaiki W15 verify assertions; post-merge CI #796 dan Product Eval #35 hijau sebelum final strict local-model closure run menghasilkan 12/12 PASS dan `closureEligible=true`.

`DONE` hanya dipakai bila implementation/evidence aktual mendukung. Historical verification docs tetap source of truth untuk evidence lama; dokumen ini menyatakan current execution state.
