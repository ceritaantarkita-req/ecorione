# ECORIONE — Active Work Plan

Last updated: **2026-09-15**

Status: **ACTIVE / canonical execution log**

Current code + current evidence + dokumen ini adalah source of truth pekerjaan aktif. `DONE — REPO SIDE` tidak menggantikan browser, Windows, local-model runtime, credential, atau hosted-spend evidence yang memang harus dijalankan operator.

## 1. Current repository checkpoint

```text
main: 558c8f0ecfecc23655afe0c5951622265efc1449
PR #86: merged
post-merge CI: 34917269145 / CI #803 — SUCCESS
post-merge Product Eval: 34917269095 / Product Eval #42 — SUCCESS
```

`main` adalah green baseline. GitHub `main` belum memiliki required status-check branch protection; governance gap ini tetap terbuka.

## 2. Work queue

| ID | Pekerjaan | Status | Boundary |
|---|---|---:|---|
| W01 | Reconcile system analysis | **DONE** | Temuan valid/outdated sudah dipisahkan. |
| W02 | Vitest `*.test.tsx` discovery | **DONE** | TSX tests masuk normal CI. |
| W03 | UX/Product Validation current main | **READY — OPERATOR RUNTIME** | Repo-side Windows/PowerShell hardening selesai; butuh fresh exact-head inventory + rendered UX-01–UX-12, no S0/S1 open. |
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

## 7. W03 UX/Product Validation

Status: **READY — OPERATOR RUNTIME**.

PR #86 menutup friction repo-side sebelum fresh rendered walkthrough:

- canonical W03 flow sekarang memakai cross-platform `pnpm engine:start`, bukan manual Bash/WSL env sourcing;
- UX inventory dapat mengambil hanya `ECORIONE_INTERNAL_TOKEN` dari root `.env` bila shell belum memilikinya, tanpa pernah mencetak token;
- kill switch **tidak** diambil dari `.env`; operator tetap wajib menetapkan `ECORIONE_COST_KILL_SWITCH=1` di shell dan inventory tetap memverifikasi Hosted efektif OFF dari runtime settings;
- regression tests melindungi token hydration dan memastikan shell token tidak ditimpa;
- App Router icon ditambahkan untuk menutup application-owned `favicon.ico 404` noise;
- runtime defect ledger disinkronkan: PR #71 exact-string framing/cache fix sudah merged, tetapi UX-RUNTIME-005 dan UX-RUNTIME-006 masih membutuhkan fresh browser recheck.

PR #86 evidence:

```text
head: bc626370c3a8c0b255b4a04f581c829eefe67073
PR CI: 34917070928 / CI #802 — SUCCESS
PR Product Eval: 34917070937 / Product Eval #41 — SUCCESS
merge: 558c8f0ecfecc23655afe0c5951622265efc1449
post-merge CI: 34917269145 / CI #803 — SUCCESS
post-merge Product Eval: 34917269095 / Product Eval #42 — SUCCESS
```

W03 belum DONE. Closure masih membutuhkan pada exact current main yang sama:

```text
1. clean/synchronized tracked tree
2. ECORIONE_COST_KILL_SWITCH=1
3. pnpm engine:start pada Windows operator
4. pnpm evidence:ux:inventory — PASS
5. rendered UX-01..UX-12 dengan DevTools Console
6. UX-02/UX-03 exact-string Local chat recheck
7. no application-owned favicon 404 / framework console errors
8. no open S0/S1; S2 fixed atau explicitly accepted
```

Raw screenshots/logs yang mengandung detail mesin tetap lokal; hanya sanitized findings yang boleh di-commit.

## 8. Immediate next action

Prioritas langsung adalah menjalankan **W03 operator checkpoint pada current main**. Setelah W03 closure:

```text
1. W09/W10 — clean-Windows one-command startup + doctor matrix
2. W11 — real Setup/launcher + clean-Windows acceptance
3. W16 — automatic semantic reference selector
4. W17 — ECX no-oracle validation
5. W18 — bounded hosted economic validation
6. W20 — final current-state sync/closure
```

Repo-side item independen boleh maju lebih dulu, tetapi runtime/browser/hosted claim boundaries tidak boleh dihapus atau diganti dengan asumsi.

## 9. Historical note

PR #76 sempat masuk `main` dengan formatting regression. PR #77 menutupnya dan post-merge CI `34858779881` SUCCESS. PR #80 menyinkronkan W14. PR #81 menambahkan W15 harness. PR #82 menyinkronkan canonical W15 state. PR #83 memperbaiki W15 runtime observability. PR #84 memperbaiki W15 verify assertions. PR #85 mencatat W15 closure evidence. PR #86 mengeraskan W03 Windows runtime flow dan menutup repo-side favicon/token-hydration friction.

`DONE` hanya dipakai bila implementation/evidence aktual mendukung. Historical verification docs tetap source of truth untuk evidence lama; dokumen ini menyatakan current execution state.
