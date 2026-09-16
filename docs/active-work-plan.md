# ECORIONE — Active Work Plan

Last updated: **2026-09-16**

Status: **ACTIVE / canonical execution log**

Current code + current evidence + dokumen ini adalah source of truth pekerjaan aktif. `DONE — REPO SIDE` tidak menggantikan browser, Windows, local-model runtime, credential, atau hosted-spend evidence yang memang harus dijalankan operator.

## 1. Current repository checkpoint

```text
current main repo-verified baseline: 62e0d4b64b41cfa0b3038461bc376d67b1a2cbb8
PR #117: merged — canonical W17 closure/work-plan sync
post-merge CI: 35101030030 (#922) — SUCCESS
post-merge Product Eval: 35101029926 (#161) — SUCCESS
W17 formal local closure: PASS
formal runtime evidence baseline: 90bc800649b02be1de752d8c67c365c65a9d21a6
raw evidence sha256: a76a6a195aea6e117651f948e41b3fdcbbd2532cbdf556c14a2437fa50483fb3
W17 measured calls: 100 (5 tasks × 5 repeats × 4 lanes)
```

W16 remains merged and green on `main`. W17 is now closed on top of that selector: the formal fail-closed local run completed 100 measured calls across full-inline, all-ref, automatic no-oracle, and oracle-control lanes with 5/5 task gates, selector recall 1, zero cache hits, and verified immutable `qwen3.5:9b` identity. Automatic-selector evidence remains bounded and does not establish hosted billed-cost or end-to-end network savings.

Post-W17 cleanup removed the temporary bounded-generation values `ECORIONE_LOCAL_REASONING_EFFORT`, `ECORIONE_LOCAL_MAX_TOKENS`, and `ECORIONE_LOCAL_TEMPERATURE` from the operator `.env`, restoring normal local-model behavior. On that normal behavior, source-workstation `pnpm engine:doctor` can still time out its optional local generation canary at the current 20-second probe boundary while the ECORIONE service fleet remains healthy and the canary request reaches Connect. This is retained as a **non-blocking diagnostic/performance limitation**; it does not reopen W09/W10 or W17 and is separate from W11 packaged-installer acceptance.

The final real-Windows W09/W10 run remains synchronized to its verified runtime baseline `4ea5b942ec705b61fe51c4b47a75bc59ac6019b8`. Ai resolved to `127.0.0.1:17020`; the protected foreign listener on port `3000` survived start and cleanup; the full fixed owner fleet was healthy; duplicate start failed closed; cleanup released the ECORIONE application ports; and doctor remained usable after shutdown. Local AI was `UNAVAILABLE` in that run and remains intentionally outside the W09/W10 core process-readiness gate because immutable local-model evidence is governed by W13/W15/W17.

`main` remains the green baseline. GitHub `main` still does not have required status-check branch protection; that governance gap remains separate from W09/W10/W16/W17.

## 2. Work queue

| ID | Pekerjaan | Status | Boundary |
|---|---|---:|---|
| W01 | Reconcile system analysis | **DONE** | Temuan valid/outdated sudah dipisahkan. |
| W02 | Vitest `*.test.tsx` discovery | **DONE** | TSX tests masuk normal CI. |
| W03 | UX/Product Validation current main | **DONE — REAL-LAPTOP VERIFIED** | Responsive + Flow redesign integrated; Windows inventory, desktop checks, 390–430 px recheck, clean-console Local chat, Flow wiring/validation/save/run, and Condition true/false branching all passed. |
| W04 | Partial/full stack behavior | **DONE — REPO SIDE** | Human-readable service-down/proxy failures. |
| W05 | Provider Settings foundation | **DONE — REPO SIDE** | Provider catalog + Settings/Vault authority. |
| W06 | Credential Vault integration | **DONE WITH LIMITATIONS — REPO SIDE** | Test/save/replace/remove; no browser plaintext persistence. |
| W07 | Provider health/status | **DONE WITH LIMITATIONS — REPO SIDE** | Real external credential validity tetap operator-owned. |
| W08 | Default AI selection | **DONE — REPO SIDE** | Durable Local/Hosted default; no auto-router claim. |
| W09 | One-command startup | **DONE — WINDOWS RUNTIME VERIFIED** | Exact-current-main Windows harness passed cold start, port-3000 isolation, duplicate-start guard, and process-tree cleanup. |
| W10 | `ecorione doctor` | **DONE — WINDOWS RUNTIME VERIFIED** | Core pre-start/running/post-stop doctor phases passed on real Windows; current optional local generation canary may exceed the 20s diagnostic probe without reopening W10. |
| W11 | Installer/Launcher | **STARTED — HARNESS READY / REAL INSTALLER RUN PENDING** | Packaging + isolated Windows installer acceptance harness siap; real Setup artifact + operator run masih wajib. |
| W12 | Attachment composer backend path | **DONE — REPO SIDE** | File/foto → Artifact → Context pointer → hydration. |
| W13 | Immutable local model identity | **DONE WITH LIMITATIONS — RUNTIME VERIFIED** | Current operator runtime berhasil memverifikasi selector + immutable digest; perubahan model/runtime tetap harus diverifikasi ulang. |
| W14 | Product eval foundation | **DONE — REPO SIDE** | 12 task/bug-derived deterministic regressions + dedicated gate. |
| W15 | Agentic local-model eval v1 | **DONE — VERIFIED LOCAL MODEL PASS^3** | 4/4 real cases pass^3 dengan immutable digest verified; claim hanya bounded eval harness, bukan autonomous product chat. |
| W16 | Automatic semantic reference selector | **DONE — REPO SIDE** | `selection: semantic-v1` memilih bounded refs otomatis; explicit `refIndexes` tetap backward-compatible; post-merge CI/Product Eval/MCP green. |
| W17 | ECX no-oracle validation | **DONE — VERIFIED LOCAL MODEL PASS (100 CALLS)** | 5 tasks × 5 repeats × 4 lanes; 5/5 task gates; auto selector recall 1; cache hits 0; immutable `qwen3.5:9b` verified; bounded local evidence only. |
| W18 | Hosted economic validation | TODO | Real bounded hosted token/cost evidence. |
| W19 | Release/security governance follow-up | **DONE — REPO SIDE** | History secret scan + naming/model-alias gate di CI; branch protection gap terpisah. |
| W20 | Final current-state sync | **STARTED** | Continue after the remaining W11/W18 evidence. |

## 3. W03 final closure evidence

Status: **DONE — REAL-LAPTOP VERIFIED**.

Canonical detailed evidence lives in `docs/verification/w03-responsive-flow-implementation-2026-09-15.md`; the reusable procedure remains `docs/ux-runtime-walkthrough-checklist.md`.

Final operator evidence on Windows established:

```text
tracked worktree: clean
HEAD == origin/main at runtime baseline: 746dc0705e12d419f93d3592bc6c7bdb55e4b76e
ECORIONE_COST_KILL_SWITCH=1
pnpm engine:start: READY
Temporal local dev-server: READY
all required Phase 4 owners: healthy
pnpm evidence:ux:inventory: PASS
Hosted effective state: OFF
local model: qwen3.5:9b
local model digest: sha256:6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7
mutable model alias: false
```

Desktop/runtime acceptance covered navigation, Local exact-string replies, same-session continuity, memory readability, Local/Hosted route state, Operations refresh/Auto 5s, Settings workspace/local canary behavior, Space switching, Flow dirty/save/load/Validate behavior, and safe invalid-config handling. UX-05 remained `NOT_EXERCISED` because no disposable recalled fact was available; the checklist explicitly allows that disposition.

The responsive defects found in the first pass were fixed through PR #93, PR #95, PR #96, and PR #97. Final ~430 CSS px real-laptop checks then passed for Ai, Space, Operations, Settings, Flow Stack, and contained Flow Canvas. Settings long values no longer expanded the page, Space hierarchy was usable without the previous dead space, and Flow lifecycle controls/catalog/connect affordances were usable on mobile.

Final Flow functional proof:

```text
Trigger → AI
workflow: COMPLETED
Trigger: SUCCEEDED
AI: SUCCEEDED
```

Because Flow execution authority is fail-closed, the operator granted `node.execute` through the normal `POLICY_ADMIN` approval path for the exact node definitions used by the test; no governance bypass or auto-grant was introduced.

Final branching proof used the saved graph:

```text
4 nodes / 3 connections
Trigger [out] → Condition / Switch
Condition / Switch [true] → AI
Condition / Switch [false] → Artifact
```

With truthy input, the real Temporal run completed as:

```text
workflow: COMPLETED
Trigger: SUCCEEDED
Condition / Switch: SUCCEEDED
AI: SUCCEEDED
Artifact: SKIPPED — no active incoming edge
```

The same graph was rechecked in mobile Stack mode at ~430 CSS px, where the true/false connection summaries and `Edit / connect` affordances remained visible and usable. Clean-console Local chat also passed with the exact response `UX_CONSOLE_OK`; the previously observed `VM... / reportAllChanges / startTime` exception was tooling/browser-injected noise and was not reproducible as an application-owned error in the clean-console check.

Closure defect disposition:

```text
S0 open: 0
S1 open: 0
S2 open/unaccepted: 0
W03 closure: PASS
```

## 4. Security / runtime boundaries

Sudah ada di `main`: same-origin mutation guard, CSP/security headers, stricter hosted-spend guard, private/loopback `localBaseUrl` default, mutable model-alias gate, runtime provenance resolver dengan digest mismatch fail-closed, full-history secret scan, dan W16 automatic ECX selector yang tetap melewati owner authorization + hydration policy/budget boundary.

Known limitation: CSP masih membutuhkan `'unsafe-inline'` pada current Next App Router bootstrap. Required status checks/branch protection juga belum aktif.

Developer bridge:

```text
pnpm engine:start
pnpm engine:doctor
pnpm engine:stop-temporal
```

Temporal CLI local path, Windows `pnpm.cmd` handling, collision-safe Ai port selection, required-service readiness, Connect Windows startup, dan spawned-process-tree cleanup sudah terbukti pada real Windows. W09/W10 closed sebagai **DONE — WINDOWS RUNTIME VERIFIED**. The local generation line in `engine:doctor` is an optional canary: a timeout there does not negate healthy service readiness, but remains useful performance diagnostics for future hardening.

## 5. ECX claim boundary

Historical Ledger + ECX local evidence tetap CLOSED/PASS. Historical comparative ECX oracle-control evidence tetap retained sebagai:

```text
5 tasks × 5 repeats × 3 lanes = 75 measured calls
cache hits = 0
passed task gates = 5/5
median selective transport reduction = 73.6379379246037%
median selective input-token reduction = 77.8580814717477%
median selective/full latency ratio = 0.8672873729681319
```

Angka di atas adalah evidence lama untuk `ecx-selective-oracle`; jangan dibaca sebagai hasil automatic selector.

W16 sekarang sudah menghapus kebutuhan caller/oracle-supplied index untuk lane otomatis. W17 harness menambahkan lane keempat `ecx-selective-auto` dengan `selection: { mode: "semantic-v1", maxRefs: 3 }`, sementara fixture `relevantRefIndexes` hanya dipakai untuk evaluasi recall dan oracle-control.

Preparation W17 menemukan defect recall nyata pada `incident-triage` (0.5), lalu selector diperbaiki agar `maxRefs` menjadi bounded top-K positive semantic budget tanpa cutoff relatif yang membuang secondary evidence. Focused validation setelah fix:

```text
comparative helper tests = 9/9 PASS
no-oracle selector fixture tests = 5/5 PASS
total focused = 14/14 PASS
```

Formal W17 real local-model evidence is now closed. The fail-closed runner completed:

```text
runtime evidence baseline: 90bc800649b02be1de752d8c67c365c65a9d21a6
5 tasks × 5 repeats × 4 lanes = 100 measured model calls
+ one excluded warm-up completion
passed task gates = 5/5
failed tasks = 0
cache hits = 0
median automatic selector recall = 1.0
median automatic selector precision = 0.6666666666666666
median automatic selected-hydration transport reduction = 46.089385474860336%
median automatic input-token reduction = 50.80489375402447%
median automatic/full latency ratio = 0.9839322301085884
automatic known-transport-floor beat task count = 0/5
closureEligible = true
raw evidence sha256 = a76a6a195aea6e117651f948e41b3fdcbbd2532cbdf556c14a2437fa50483fb3
```

The `0/5` known-transport-floor result is intentional evidence, not a failed gate: automatic selection currently scans bounded authorized candidate text before hydration, so W17 proves model-context/input-token and selected-hydration reductions but **does not** claim end-to-end automatic-selection network savings.

W17 juga memisahkan selected-hydration savings dari selector candidate scanning. Karena W16 saat ini membaca bounded authorized text candidates untuk ranking, `packet + selected hydration` tidak boleh disebut end-to-end transport savings tanpa menghitung candidate scan. Harness merekam conservative known transport floor secara terpisah.

Local/no-oracle evidence tidak boleh menjadi universal public-savings claim. Hosted dollar economics tetap belum tervalidasi dan merupakan W18.

## 6. W14 / W15 retained claim boundaries

W14 remains **DONE — REPO SIDE** with bounded deterministic product regressions and dedicated Product Eval CI.

W15 remains **DONE — VERIFIED LOCAL MODEL PASS^3** for the immutable local identity `qwen3.5:9b` with digest `6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7`. Its evidence proves the bounded evaluation agent loop, not that the normal product chat is an autonomous tool-calling agent.

Historical verification documents remain the detailed source of truth for W14/W15 metrics and run IDs.

## 7. Immediate next action

With W03, W09/W10, W16, and W17 closed, priority is:

```text
1. W11 — complete real Setup/launcher acceptance on clean Windows
2. W18 — collect bounded real hosted token/cost evidence (explicit spend authorization required)
3. W20 — final current-state sync after W11/W18 close
```

Do not reopen W03, W09/W10, W16, or W17 unless a new reproducible regression appears on product code newer than the verified baselines. The current 20-second source-doctor local-canary timeout is explicitly tracked as diagnostic performance behavior, not as such a regression.

## 8. Historical note

PR #76 sempat masuk `main` dengan formatting regression. PR #77 menutupnya. PR #80 menyinkronkan W14. PR #81–#85 membangun dan menutup W15 evidence. PR #86/#88/#89 mengeraskan Windows runtime flow. PR #90 memperbaiki Settings feedback/action stacking. PR #93 mengintegrasikan responsive + Flow redesign. PR #95 memperbaiki Flow inventory marker drift. PR #96 dan PR #97 menyelesaikan mobile Settings/Space/Flow corrections. PR #98 menyinkronkan progress real-laptop sebelum final functional closure. PR #100–#106 membangun, memperbaiki, dan menutup real-Windows W09/W10 acceptance sampai final PASS pada `4ea5b942ec705b61fe51c4b47a75bc59ac6019b8`. PR #112 mengimplementasikan dan menutup repo-side W16 automatic semantic ECX reference selector pada merge baseline `504e6aef86092d6f398ff290a40f77593c8882ca` dengan post-merge CI/Product Eval/MCP acceptance green. PR #113 menambahkan four-lane no-oracle harness; PR #114 menambahkan fail-closed local closure runner; PR #115 menambahkan bounded local generation controls untuk menutup runaway reasoning pada evidence run; PR #116 merekam formal 100-call W17 PASS sekaligus menyelaraskan doctor canary latency ceiling dengan probe timeout; dan PR #117 menyinkronkan canonical work plan setelah runtime closure. PR #117 merged sebagai `62e0d4b64b41cfa0b3038461bc376d67b1a2cbb8`, dengan post-merge CI #922 dan Product Eval #161 SUCCESS.

`DONE` hanya dipakai bila implementation/evidence aktual mendukung. Historical verification docs tetap source of truth untuk evidence lama; dokumen ini menyatakan current execution state.
