# ECORIONE — Execution Progress & Remaining Roadmap

Last updated: **2026-09-18**

Status: **CURRENT — defined closure map complete; future work remains evidence-driven**

Start from `docs/current-state-and-next-steps.md`, then this file. Historical Batch 1–12 chronology remains in `docs/archive/`; dated audits and failed-attempt records are evidence snapshots and must not be rewritten into current status.

## Status legend

| Status | Meaning |
|---|---|
| `CLOSED` | Implementation/evidence boundary satisfied and documented. |
| `PASS WITH LIMITATIONS` | Gates passed with bounded limitations retained. |
| `REPO SIDE DONE` | Repository implementation/gates complete; runtime evidence may remain external. |
| `FORMAL RUN READY` | Prerequisites and bounded diagnostic passed; final runtime evidence not yet executed. |
| `BLOCKED` | Intentionally waiting on an earlier workstream. |
| `DEFERRED` | Explicitly postponed by operator/design. |
| `OPEN-ENDED` | Evidence-driven hardening, never permanently finished. |

## Current closure map

| ID / area | State | Current boundary |
|---|---:|---|
| Batch 1–12 | **12/12 CLOSED** | Defined implementation roadmap. |
| Historical Ledger + ECX | **CLOSED / PASS** | Local chronology/hash-chain + pointer/hydration evidence. |
| Historical Comparative ECX | **CLOSED / PASS WITH LIMITATIONS** | Oracle-control local benchmark; not automatic selector or hosted-dollar proof. |
| W03 | **CLOSED — REAL-LAPTOP VERIFIED** | UX/product runtime boundary completed. |
| W09/W10 | **CLOSED — WINDOWS RUNTIME VERIFIED** | Startup/doctor bounded Windows evidence. |
| W11 | **CLOSED — WINDOWS INSTALLER VERIFIED** | Packaged installer lifecycle passed. |
| W12–W15 | **CLOSED at documented boundaries** | Attachment path, immutable identity, product eval, bounded agentic local eval. |
| W16 | **REPO SIDE DONE** | Automatic `semantic-v1` selector, `maxRefs=3`. |
| W17 | **CLOSED — VERIFIED LOCAL MODEL PASS** | 100 measured calls, 5/5 task gates, no-oracle automatic lane. |
| W18 | **CLOSED / PASS WITH DOCUMENTED DUPLICATE-EXECUTION INCIDENT** | Formal hosted economics passed; duplicate batch reconciled; one-shot guard merged via PR #142. |
| W19 | **REPO SIDE DONE** | Release/security governance gates retained. |
| W20 | **CLOSED** | Final canonical current-state synchronization completed. |
| F6-E01 | **CLOSED / REPO-SIDE PASS** | PR #146/#147 merged; 10 held-out cases; auto-discovered 26/50 eval inventory. |
| F6-E02 | **CLOSED / REPO-SIDE PASS** | PR #149 merged; CI #1029 + Product Eval #268 PASS; dependency-policy step PASS. |
| F6-E03 | **CLOSED / REPO-SIDE PASS** | PR #151 merged; CI #1033 + Product Eval #272 PASS; named Release security acceptance step PASS. |
| F6-E04 | **CLOSED / REPO-SIDE PASS** | PR #153 merged; CI #1041 + Product Eval #280 + MCP #473 PASS; pin-review step PASS. |
| F6-E05 | **CLOSED / REPO-SIDE PASS** | PR #155 merged; CI #1045 + Product Eval #284 + MCP #475 PASS; fixed runner policy green. |
| F6-E06 | **CLOSED / REPO-SIDE PASS** | PR #157 merged; CI #1055 + Product Eval #294 + MCP #483 PASS; exact Node toolchain gate green. |
| F6-E07 | **CLOSED / REPO-SIDE PASS** | PR #160 merged; CI #1072 same-head rerun PASS; Product Eval #311 + MCP #498 + Desktop Installer #41 PASS. |
| F6-E08 | **IMPLEMENTED / IN REVIEW** | Governed external images must match authoritative reviewed tag+digest lock identities; CI/release/production-ops drift gates implemented; exact-head gates pending. |
| Compute-host/VPS + Cloudflare | **DEFERRED BY OPERATOR** | Not a W18 blocker. |
| AutoClick | **DEFERRED BY DESIGN** | No implicit activation. |
| Fase 6+ | **OPEN-ENDED / ACTIVE THROUGH F6-E08 REVIEW** | Evidence-driven; no implicit Batch 13. |

## W16/W17 transition retained

W16 removed the caller/oracle requirement from the automatic selector by adding `selection: { mode: "semantic-v1", maxRefs: 3 }`. W17 then closed the bounded local no-oracle validation over:

```text
5 tasks × 5 repeats × 4 lanes = 100 measured calls
cache hits = 0
passed task gates = 5/5
median automatic selector recall = 1.0
```

W17 proves local model-context/input-token and selected-hydration reductions at the tested boundary. It does not prove hosted provider billed-cost savings or universal end-to-end network savings.

## W18 chronology and current closure state

Attempts 1–4 remain preserved in their dated verification notes. The final formal runtime then executed on synchronized clean `main` `f249d9c0681462253bff21ca30354892ca4ce60f`.

## W18 formal runtime result

The synchronized formal execution on `main` `f249d9c0681462253bff21ca30354892ca4ce60f` completed the full **5 tasks × 2 repeats × 2 lanes = 20 measured hosted calls** and the harness returned `aggregate.pass=true` plus `closureEligible=true`.

```text
full-inline billed cost = US$0.059106
ecx-selective-auto billed cost = US$0.032610
actual formal run spend = US$0.091716
saved vs full-inline = US$0.026496
savedPct = 44.827936250126896
medianTaskSavedPct = 44.4913020558777
medianTaskInputTokenReductionPct = 50.629874025194965
failedTasks = 0
```

Raw local evidence remains gitignored. The recorded evidence SHA-256 is `cadb920047a27eb4e3db38cb53e63192af3ea7857617d8f125c7056bd6c162da`.

Cleanup passed: `hostedCallsEnabled=false`, future-process kill switch restored to `1`, engine stopped, and the formal run's durable committed delta exactly matched US$0.091716.

### Duplicate-execution reconciliation

The local durable ledger resolves the US$0.091596 delta as an earlier complete 20-entry settled W18-shaped batch. Its full-inline actual total was US$0.059046 and automatic ECX total US$0.032550. The later PASS batch cost US$0.091716. Combined durable spend was US$0.183312, below the US$0.25 monetary ceiling.

The duplicated execution violated the one-attempt process boundary and exposed missing persistent authorization consumption in the wrapper. PR #142 fixed this by refusing completed formal PASS evidence and atomically consuming a gitignored one-shot marker before hosted dispatch. Exact reviewed head `1f0d87963857d4bb261579204e76bae970c496b0` passed CI #1012 and Product Eval #251 and merged at `cff6e21edc8085bb895c6ed59c32b5e4aa134ee0`.

Canonical verification: `docs/verification/w18-formal-hosted-economics-pass-reconcile-2026-09-18.md`, `docs/verification/w18-duplicate-execution-reconciliation-2026-09-18.md`, and `docs/verification/w18-final-closure-2026-09-18.md`.

W20 final closure: `docs/verification/w20-final-current-state-closure-2026-09-18.md`.

## Persistent evidence rules

- Historical Ledger and Context L0 remain semantic ground truth.
- Memory is untrusted data, never instructions.
- No cross-service DB access.
- Hub remains policy/approval authority; Connect remains provider/credential/MCP authority; Artifact owns L3 bytes.
- No silent provider fallback.
- Hosted dispatch obeys kill switch and durable cumulative budget.
- Exact-cache hits cannot contaminate comparative model-compute evidence.
- Local USD `0` is not hosted billed-cost evidence.
- Provider-reported billed cost is authoritative for W18.
- Valid failed evidence is preserved after fixes.
- Raw private runtime evidence remains local/gitignored; commit only sanitized summaries.
- Historical dated audits are not silently rewritten into current status.


## F6-E01 active scope

Baseline is synchronized local/remote `main` at `943e46bf7cfd53063e8d8e4970d0c9aa7713dce9`.

F6-E01 is closed after PR #146/#147 merged the 10-case held-out selector suite and auto-discovered 26/50 eval budget guard. CI #1023/#1025, Product Eval #262/#264, and MCP External #467 passed at their relevant exact heads. No provider call was made.


## F6-E02 active scope

The concrete continuous-gating gap is now implemented on the F6-E02 feature branch. Normal CI invokes `pnpm run dependency:review`, and release-security acceptance checks both the governed package script and the CI step/command so the gate cannot silently disappear.

Closure waits on exact-head CI/Product Eval and guarded merge. This scope does not claim live registry vulnerability/CVE freshness.


## F6-E02 closure

F6-E02 closed through PR #149. Exact reviewed head `1cd4795b1a65baa1a2320713a3c8ffe520cfc98f` passed CI #1029 and Product Eval #268; the new Dependency policy review step was observed PASS before merge. Merged main: `20aedfe94ee9f3db321dd3a66625bedd56a334a1`.

## F6-E03 closure

F6-E03 closed through PR #151. Exact reviewed head `fdd532e0b6f2fe550708b8389ecc1f47afe946f7` passed CI #1033 and Product Eval #272; the named **Release security acceptance** CI step itself was observed PASS. Merged main: `b9e42445310921ef3c23cda2220631df49403e41`.

## F6-E04 closure

F6-E04 closed through PR #153. Exact reviewed head `e1818eaac40a8166fd2b677aa815670c1ca0d7b6` passed CI #1041, Product Eval #280, and MCP External #473; the named GitHub Actions pin review and Release security acceptance steps both passed. Merged main: `4742a9caf43e67b01345d69f0ea05cbbb2f081f0`.

## F6-E05 active scope

F6-E05 closed through PR #155. Exact reviewed head `1fb568b1a3fa865f2bad556b06f9fb6e4e2d6da2` passed CI #1045, Product Eval #284, and MCP External #475; the named GitHub Actions runner review and Release security acceptance steps both passed. Merged main: `2e031d4d540632385279e3b6559d564afcae96d3`.

## F6-E06 active scope

F6-E06 closed through PR #157. Exact reviewed head `cd04be6385ffb360862e38e63dcd02d27c3a067d` passed CI #1055, Product Eval #294, and MCP External #483; both **Node toolchain review** and **Release security acceptance** passed. Merged main: `f04350a7e05080dd16c1d7bc9710a8e8f5a73b54`.

## F6-E07 active scope

F6-E07 closed through PR #160. Exact reviewed head `472819b3a7c875246ce76daee8212a7aed8fc8c9` passed Product Eval #311, MCP External #498, and Desktop Installer #41. CI #1072 initially timed out in the pre-existing Phase 4 Temporal acceptance; a failed-job rerun on the exact same head passed the full verify sequence, including **Installer toolchain review**, **Release security acceptance**, and production build. Merged main: `9362419a9e2766750237e30792a50494d39c9b17`.

## F6-E08 active scope

F6-E08 implementation binds the Dockerfile Node base and governed Postgres/Caddy/Temporal images to registry-resolved OCI SHA-256 digests while retaining readable exact tags. CI #1078's temporary resolver job obtained the four full digests directly from Docker Hub's OCI Registry API and was removed after discovery. `deploy/container-image-lock.json` now holds the authoritative reviewed identities; `scripts/container-image-digest-review.mjs` rejects both tag-only refs and valid-but-unreviewed digest drift across Dockerfile and both compose surfaces. Normal CI, release-security acceptance, and production-ops acceptance all protect the lock. Closure waits on exact-head CI/Product Eval and guarded merge. Production deployment remains operator-owned.
