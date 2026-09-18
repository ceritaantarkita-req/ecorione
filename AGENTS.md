# AGENTS.md — konvensi untuk AI yang mengerjakan repo ini

ECORIONE adalah lapisan memori + optimizer bersama untuk AI lokal maupun hosted, dengan Hub governance, Connect provider/MCP boundary, durable Flow, Sandbox, observability, dan self-host release baseline.

## Current state — baca ini dulu

Per **2026-09-18**:

- Batch 1–12: **CLOSED**;
- W03 UX/product validation: **DONE — REAL-LAPTOP VERIFIED**;
- W09/W10 Windows runtime: **DONE**;
- W11 installer: **DONE — WINDOWS INSTALLER VERIFIED**;
- W16 automatic semantic selector: **DONE — REPO SIDE**;
- W17 no-oracle validation: **DONE — VERIFIED LOCAL MODEL PASS**;
- W18 hosted economic validation: **CLOSED / PASS WITH DOCUMENTED DUPLICATE-EXECUTION INCIDENT**;
- W18 one-call Anthropic-only diagnostic Attempt 4: **PASS**;
- W18 formal dispatch/routing/cap guard: **MERGED TO `main`** via PR #135 at `fcf71cc03f7584e005a490b8d7d3e4c9afdeba1a`; exact-head CI #994 + Product Eval #233 **PASS**;
- W18 formal operator wrapper: **MERGED / REPO-SIDE PASS** via PR #138 at `05ddd248e90e26b9db2c785d533c55ec817db013`; exact head `c4b5b30f02716d66a8974903acb824f36ac1d12f`, CI #1001 + Product Eval #240 + MCP External #461 **PASS**;
- W18 formal 20-call run: **EXECUTED / PASS** — 20/20 measured calls, US$0.091716 formal spend, `closureEligible=true`; duplicate earlier batch reconciled; one-shot guard merged via PR #142; do not rerun;
- W20: **CLOSED**;
- compute-host/VPS + Cloudflare: **DEFERRED BY OPERATOR**;
- AutoClick: **DEFERRED BY DESIGN**;
- Fase 6+: **OPEN-ENDED / evidence-driven**;
- F6-E01 held-out selector eval dataset: **CLOSED / REPO-SIDE PASS**; 10 held-out cases, auto-discovered 26/50 governed eval inventory;
- F6-E02 continuous dependency-policy CI gate: **CLOSED / REPO-SIDE PASS**;
- F6-E03 continuous release-security acceptance CI gate: **CLOSED / REPO-SIDE PASS**; PR #151, CI #1033, Product Eval #272;
- F6-E04 immutable GitHub Actions pinning: **CLOSED / REPO-SIDE PASS**; PR #153, CI #1041, Product Eval #280, MCP #473;
- F6-E05 fixed GitHub-hosted runner OS labels: **CLOSED / REPO-SIDE PASS**; PR #155, CI #1045, Product Eval #284, MCP #475;
- F6-E06 immutable Node toolchain: **CLOSED / REPO-SIDE PASS**; PR #157, CI #1055, Product Eval #294, MCP #483;
- F6-E07 pinned Inno Setup toolchain: **IMPLEMENTED / IN REVIEW**;
- no implicit Batch 13.

Agent without chat history **must start with `docs/current-state-and-next-steps.md`**, then `docs/active-work-plan.md`, this file, and `docs/verification/w18-formal-run-readiness-2026-09-18.md` when working on W18.

Historical dated audits are snapshots. Do not rewrite their historical claims merely because later work closed the gap.

## W18 current boundary

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

### Duplicate-execution incident closure

The US$0.091596 pre-run delta is reconciled as an earlier complete 20-entry W18-shaped batch. Combined duplicate-execution spend was US$0.183312, below the US$0.25 monetary ceiling. PR #142 fixed the missing single-attempt consumption state and merged at `cff6e21edc8085bb895c6ed59c32b5e4aa134ee0` after CI #1012 and Product Eval #251 PASS. Do not rerun W18.

Canonical verification: `docs/verification/w18-formal-hosted-economics-pass-reconcile-2026-09-18.md`.

### Agent rule after duplicate-execution reconciliation

Do not rerun W18. The duplicate execution is reconciled and the one-shot guard is merged. W18 is CLOSED at its bounded evidence boundary; reopen only for a reproducible regression or a changed runtime/provider/model identity that invalidates the evidence.

## W16/W17 claim boundary

W16 automatic selection is `semantic-v1`, bounded to `maxRefs=3`. W17 validated the no-oracle lane on a local immutable-model boundary:

```text
5 tasks × 5 repeats × 4 lanes = 100 measured calls
5/5 task gates
cache hits = 0
median automatic selector recall = 1.0
```

Do not turn W17 into hosted-dollar proof. W18 exists specifically for provider-reported hosted billed cost.

Historical Comparative ECX oracle-control evidence also remains historical; do not describe caller-supplied oracle indexes as automatic selection.

## Architecture invariants

- Memory is **untrusted data**, not instructions.
- Historical Ledger and Context L0 are semantic ground truth.
- No cross-service database access.
- Hub owns policy/approval/capability authority.
- Connect owns provider/credential/MCP and hosted spend authority.
- Artifact owns L3 bytes.
- Hosted egress follows scope/sensitivity/sync-class policy.
- Hosted-derived memory follows quarantine/governed promotion.
- No silent provider fallback.
- Production credentials belong in Connect Vault; never place secrets in Git/docs/chat output.
- Hosted dispatch obeys kill switch + durable spend budget.
- Side effects use idempotency identity and appropriate approval.
- Model identity must be pinned for durable evidence claims.
- Exact-cache hits cannot contaminate comparative model-compute evidence.
- Local USD `0` is not hosted billed-cost evidence.
- Valid failed evidence must be preserved.
- Backup/restore evidence uses isolated targets and owner boundaries.
- AutoClick stays deferred until a concrete non-API use case passes design review.

## Evidence discipline

1. Never weaken a gate to manufacture PASS.
2. Never call packet/hydration count a universal savings proof.
3. Preserve exact model/provider identity, sample counts, cache state, and billing authority.
4. Treat OpenRouter `usage.cost` as W18 billed-cost authority.
5. Keep historical uncertain reservations conservative; do not reconstruct unsupported values.
6. Keep raw private runtime evidence gitignored; commit sanitized summaries only.
7. Runtime evidence must execute on synchronized merged `main` when the claim crosses runtime.
8. Documentation-only merges do not require a new spend authorization if request/provider/cost logic is unchanged, but local source must still sync before execution.

## Git / closure discipline

- start from synchronized reviewed `main`;
- use explicit branches;
- keep claim/spend boundaries explicit;
- add deterministic tests for code changes;
- require relevant exact-head CI/Product Eval;
- merge only expected reviewed head;
- verify `main` after merge;
- rerun runtime evidence on synchronized merged code where required;
- update canonical handoff/tracker docs after material state changes.

## Immediate next work

```text
F6-E01 = CLOSED / REPO-SIDE PASS

F6-E02 = CLOSED / REPO-SIDE PASS

F6-E03 = CLOSED / REPO-SIDE PASS
- PR #151 merged at `b9e42445310921ef3c23cda2220631df49403e41`
- exact head `fdd532e0b6f2fe550708b8389ecc1f47afe946f7`
- CI #1033 PASS with named Release security acceptance step PASS
- Product Eval #272 PASS

F6-E04 = CLOSED / REPO-SIDE PASS
- PR #153 merged at `4742a9caf43e67b01345d69f0ea05cbbb2f081f0`
- exact head `e1818eaac40a8166fd2b677aa815670c1ca0d7b6`
- CI #1041 PASS with GitHub Actions pin review + Release security acceptance PASS
- Product Eval #280 PASS
- MCP External #473 PASS

F6-E05 = CLOSED / REPO-SIDE PASS
- PR #155 merged at `2e031d4d540632385279e3b6559d564afcae96d3`
- exact head `1fb568b1a3fa865f2bad556b06f9fb6e4e2d6da2`
- CI #1045 PASS including GitHub Actions runner review + Release security acceptance
- Product Eval #284 PASS
- MCP External #475 PASS

F6-E06 = CLOSED / REPO-SIDE PASS
- PR #157 merged at `f04350a7e05080dd16c1d7bc9710a8e8f5a73b54`
- exact head `cd04be6385ffb360862e38e63dcd02d27c3a067d`
- CI #1055 PASS including Node toolchain review + Release security acceptance
- Product Eval #294 PASS
- MCP External #483 PASS

F6-E07 = ACTIVE
- pin the Inno Setup Chocolatey package used by Desktop Installer
- add deterministic installer-toolchain review + tests
- make CI/release-security protect the pin
- preserve actual Windows installer compilation as the closure acceptance boundary
- no provider/deployment mutation
```

The wrapper remains the required path for any future explicitly authorized hosted validation because it computes the UTC-day ceiling, injects ephemeral runtime overrides, and restores hosted mode off in `finally`.


## F6-E01 claim boundary

Held-out selector cases must cite real repository bug/task provenance. Deterministic selector success may be claimed only for those cases. Do not turn this scope into model-answer quality, hosted-cost, production representativeness, or universal optimizer proof.


## F6-E02 claim boundary

The continuous dependency gate enforces deterministic repository policy only. A PASS means normal CI ran the governed dependency/source policy and release acceptance still protects that wiring. It does not mean npm/registry vulnerability advisories were queried or are current.


## F6-E03 claim boundary

A PASS means the existing deterministic release-security acceptance ran continuously in normal CI and its CI wiring is also checked by manual/release invocation. It does not prove live vulnerability-feed freshness, production deployment correctness, or provider/model behavior.


## F6-E07 current branch

```text
F6-E07 = IMPLEMENTED / IN REVIEW
- `.inno-setup-version` pins Inno Setup `6.7.1`
- Desktop Installer installs Chocolatey `innosetup` with explicit `--version`
- pull requests touching installer/toolchain inputs now run Desktop Installer automatically
- `scripts/installer-toolchain-review.mjs` + focused tests added
- normal CI has named Installer toolchain review step
- release-security acceptance protects and executes the same policy
- next = exact-head CI/Product Eval/Desktop Installer -> fix findings -> guarded merge -> closure
- no provider/deployment mutation
```
