# ECORIONE — Active Work Plan

Last updated: **2026-09-15**

Status: **ACTIVE / canonical execution log**

Current code + current evidence + dokumen ini adalah source of truth pekerjaan aktif. `DONE — REPO SIDE` tidak menggantikan browser, Windows, local-model runtime, credential, atau hosted-spend evidence yang memang harus dijalankan operator.

## 1. Current repository checkpoint

```text
main: d0bf34ae1ec8b0ab4f2052863f3057f7a98254e1
PR #90: merged
post-merge CI: exact-main retry — SUCCESS
post-merge Product Eval: SUCCESS
```

`main` adalah green baseline. GitHub `main` belum memiliki required status-check branch protection; governance gap ini tetap terbuka.

## 2. Work queue

| ID | Pekerjaan | Status | Boundary |
|---|---|---:|---|
| W01 | Reconcile system analysis | **DONE** | Temuan valid/outdated sudah dipisahkan. |
| W02 | Vitest `*.test.tsx` discovery | **DONE** | TSX tests masuk normal CI. |
| W03 | UX/Product Validation current main | **IN PROGRESS — RESPONSIVE/FLOW REDESIGN** | Exact-head inventory + major walkthrough gates sudah terbukti, tetapi real-laptop evidence menemukan mobile layout failure dan Flow discoverability/connection UX yang harus diperbaiki sebelum closure. |
| W04 | Partial/full stack behavior | **DONE — REPO SIDE** | Human-readable service-down/proxy failures. |
| W05 | Provider Settings foundation | **DONE — REPO SIDE** | Provider catalog + Settings/Vault authority. |
| W06 | Credential Vault integration | **DONE WITH LIMITATIONS — REPO SIDE** | Test/save/replace/remove; no browser plaintext persistence. |
| W07 | Provider health/status | **DONE WITH LIMITATIONS — REPO SIDE** | Real external credential validity tetap operator-owned. |
| W08 | Default AI selection | **DONE — REPO SIDE** | Durable Local/Hosted default; no auto-router claim. |
| W09 | One-command startup | **STARTED — NEEDS OPERATOR RUNTIME** | Windows startup berhasil pada current operator laptop; clean-Windows acceptance matrix belum lengkap. |
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

Temporal CLI local path, Windows `pnpm.cmd` handling, required-service readiness, Connect Windows startup, dan spawned-process-tree cleanup sudah repo-side. W09/W10 tetap terbuka sampai clean-Windows proof lengkap.

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

Status: **IN PROGRESS — RESPONSIVE/FLOW REDESIGN REQUIRED**.

The real-laptop walkthrough on current main established the following verified checkpoints before redesign:

```text
- synchronized tracked-clean current main
- ECORIONE_COST_KILL_SWITCH=1
- pnpm engine:start on Windows: READY
- Temporal local dev-server: READY
- all eight required Phase 4 owners: healthy
- pnpm evidence:ux:inventory: PASS
- immutable local model qwen3.5:9b digest: verified/pinned
- UX-02 exact-string Local reply: PASS
- UX-03 same-session continuity: PASS
- UX-04 memory state readability: PASS
- UX-05: NOT_EXERCISED (no disposable recalled fact)
- UX-06 Local route / Hosted OFF: PASS
- UX-07 Operations refresh/Auto 5s: PASS
- UX-08 MCP empty workspace + Local canary feedback: functionally exercised
- UX-09 Space two-page switching: PASS
- UX-10 Flow dirty/Validate/Save/Load behavior: PASS
- UX-11 invalid config safe failure: PASS
```

The walkthrough also exposed new S2 findings that block W03 closure:

1. narrow/mobile management views are still materially compressed and inconsistent; Flow is unusable as a normal mobile interaction model;
2. Flow node insertion is not self-explanatory enough for a first-time user;
3. Flow connection creation relies on a hidden mental model (`Mulai koneksi` then click target) instead of visible connection ports;
4. permanent right-side inspector reduces canvas space and makes the builder feel more technical than necessary;
5. common node configuration needs progressive disclosure instead of forcing users toward raw JSON too early.

The approved redesign is specified in `docs/flow-responsive-ux-redesign.md` and is now part of W03 closure scope.

PRs already produced during the runtime checkpoint include:

```text
#88 Connect Windows startup hardening
#89 Windows spawned-process-tree cleanup
#90 Settings async-feedback visibility + narrow action stacking
```

W03 cannot be marked DONE until the redesigned current main passes a fresh rendered recheck, especially narrow viewport acceptance and first-use Flow connection discoverability.

Raw screenshots/logs that expose machine/user-specific detail stay local; sanitized findings and dispositions are committed.

## 8. Immediate next action

Priority is now:

```text
1. implement app-wide responsive cleanup
2. implement Flow collapsible left builder/config panel
3. add discoverable node insertion affordances
4. add visible port-based node connections
5. add node quick-settings + advanced-config handoff
6. add Flow mobile Stack/List mode
7. run repo CI/Product Eval
8. fresh operator W03 rendered recheck and defect-ledger closure
9. resume W09/W10, W11, W16, W17, W18, W20
```

Repo-side implementation may advance autonomously, but browser/runtime/hosted claim boundaries remain evidence-driven.

## 9. Historical note

PR #76 sempat masuk `main` dengan formatting regression. PR #77 menutupnya dan post-merge CI `34858779881` SUCCESS. PR #80 menyinkronkan W14. PR #81 menambahkan W15 harness. PR #82 menyinkronkan canonical W15 state. PR #83 memperbaiki W15 runtime observability. PR #84 memperbaiki W15 verify assertions. PR #85 mencatat W15 closure evidence. PR #86 mengeraskan W03 Windows runtime flow. PR #88 memperbaiki Connect startup pada Windows. PR #89 memperbaiki cleanup process tree Windows. PR #90 memperbaiki feedback Settings dan action stacking narrow viewport.

`DONE` hanya dipakai bila implementation/evidence aktual mendukung. Historical verification docs tetap source of truth untuk evidence lama; dokumen ini menyatakan current execution state.
