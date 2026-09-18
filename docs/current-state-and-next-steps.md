# ECORIONE — Current State & Next Steps

Last updated: **2026-09-18**

Status: **CURRENT / canonical handoff for humans and AI agents**

Historical plans, audits, failed attempts, and older verification notes remain evidence snapshots. This file is the shortest current-state source and must not rewrite valid historical failures.

## Current verdict

ECORIONE's defined Batch 1–12 implementation roadmap remains closed. W03, W09/W10, W11, W16, and W17 remain closed at their documented boundaries. The formal W18 hosted benchmark has now completed successfully on synchronized clean `main`: 20 measured calls, zero failed tasks, US$0.091716 formal spend, and `closureEligible=true`.

The US$0.091596 pre-run delta is reconciled as an earlier complete 20-entry settled W18-shaped batch. Together with the later PASS run, total durable spend was US$0.183312, below the documented US$0.25 monetary ceiling. The duplicate execution violated the single-attempt governance boundary, but the missing persistent authorization-consumption state was fixed and merged through PR #142 at `cff6e21edc8085bb895c6ed59c32b5e4aa134ee0`; exact reviewed head `1f0d87963857d4bb261579204e76bae970c496b0` passed CI #1012 and Product Eval #251. W18 is now CLOSED at its documented bounded evidence boundary, and W20 final current-state sync is CLOSED.

The formal-PASS/reconciliation-hold state is now merged through PR #140 at `eba6cbf5b53ad9af4f61e4519ae1e3400f4fdf53`; exact reviewed head `7118e9e4887438ddbea3e56a787a9f4f910ec1b1` passed CI #1005 and Product Eval #244.

Final W18/W20 closure documentation merged through PR #143 at `65142fe14901c87a8e499710081492d4b77e1357`; exact reviewed head `97890b269e19c9c9b8eaa8a89b4a17bcfdd09e11` passed CI #1014 and Product Eval #253.

Final post-merge sync PR #144 merged at `943e46bf7cfd53063e8d8e4970d0c9aa7713dce9` after CI #1016 and Product Eval #255 PASS. The operator then synchronized the Windows clone and verified clean `main...origin/main` at exactly the same SHA. This is the local/remote baseline for the next explicit scope.

Compute-host/VPS + Cloudflare remains deferred by operator. AutoClick remains deferred by design. Fase 6+ remains evidence-driven/open-ended.

The next explicit non-deployment scope is **F6-E01 — bug/task-derived held-out ECX selector evaluation dataset + bounded eval governance**. It does not reopen W16–W20 and does not make a broad optimizer-generalization claim. The objective is to expand deterministic held-out selector coverage from real repository bugs/tasks, keep the repository-wide eval inventory within the permanent 50-case budget, and wire that evidence into Product Eval without provider calls.

## Current status table

| Area | Current state | Boundary |
|---|---:|---|
| Batch 1–12 repository roadmap | **12/12 CLOSED** | Defined implementation scope only. |
| Production/self-host repository baseline | **READY** | Repository gates/tooling exist; real target-host activation remains operator-owned. |
| Historical Ledger + ECX local evidence | **PASS / CLOSED** | Real chronology/hash chain and pointer-first handoff/hydration. |
| Historical Comparative ECX oracle-control | **PASS WITH LIMITATIONS / CLOSED** | Local controlled benchmark; not automatic-selector or hosted-dollar proof. |
| W03 UX/product validation | **DONE — REAL-LAPTOP VERIFIED** | Current detailed evidence remains in its verification docs. |
| W09/W10 runtime startup + doctor | **DONE — WINDOWS RUNTIME VERIFIED** | Bounded Windows runtime evidence. |
| W11 installer/launcher | **DONE — WINDOWS INSTALLER VERIFIED** | Clean Windows installer lifecycle passed. |
| W16 automatic semantic ref selector | **DONE — REPO SIDE** | `semantic-v1`, bounded `maxRefs=3`; no oracle indexes required by automatic lane. |
| W17 ECX no-oracle validation | **DONE — VERIFIED LOCAL MODEL PASS** | 5 tasks × 5 repeats × 4 lanes = 100 measured calls; bounded local evidence. |
| W18 hosted economic validation | **CLOSED / PASS WITH DOCUMENTED DUPLICATE-EXECUTION INCIDENT** | 20-call formal PASS; duplicate earlier batch reconciled; combined US$0.183312 < US$0.25; one-shot guard merged via PR #142. |
| W19 release/security governance | **DONE — REPO SIDE** | Full-history secret scan/naming/model-alias gates retained; branch-protection gap remains separate. |
| W20 final current-state sync | **CLOSED** | Canonical state synchronized after W18 closure; future work is separate evidence-driven scope. |
| F6-E01 held-out selector eval dataset | **CLOSED / REPO-SIDE PASS** | 10 bug/task-derived held-out cases; auto-discovered 26/50 eval inventory; CI/Product Eval passed and merged. |
| F6-E02 dependency policy CI gate | **ACTIVE — NEW EXPLICIT SCOPE** | Existing `dependency:review` policy is not executed by normal CI; make it a continuous gate without claiming registry CVE freshness. |

## W18 provider and experiment profile

Formal W18 is intentionally narrow:

```text
provider gateway: OpenRouter
pricing identity: claude-sonnet-4-5-20250929
runtime model: anthropic/claude-sonnet-4.5
OpenRouter routing: provider.only=["anthropic"]
provider fallback: disabled
lanes: full-inline, ecx-selective-auto
tasks: 5
repeats: 2
measured calls: 20
warm-up calls: 0
cost authority: OpenRouter usage.cost
```

Automatic selection is `semantic-v1` with `maxRefs=3`. Fixture relevance indexes are evaluation-only; they are not supplied to the automatic lane.

## W18 attempt chronology

- **Attempt 1 — failed after 8/20 calls.** Known provider-billed amount `$0.027000`. It exposed acceptance of unusable HTTP-success/zero-cost responses; later fixed fail-closed.
- **Attempt 2 — failed on call 5.** Four settled calls cost `$0.019266`; the rejected fifth call left one conservative historical `uncertain` reservation of `$0.107157`. That reservation must not be rewritten.
- **Attempt 3 — one-call diagnostic failed.** OpenRouter HTTP-success returned no usable completion, `finishReason=content_filter`, `routingProvider=Amazon Bedrock`, `inputTokens=2002`, `outputTokens=1`, authoritative `usage.cost=0`; reservation settled to `$0` and did not create another uncertain entry.
- **Attempt 4 — one-call diagnostic PASS.** OpenRouter request was pinned Anthropic-only with fallback disabled. `procurement-award/full-inline` returned quality `1` (`3/3`), `inputTokens=2002`, `outputTokens=45`, billed `$0.006681`, durable settlement `settled`, no cache hit.

Known settled provider actual across Attempts 1–4 is `$0.052947`. The durable committed amount after Attempt 4 is larger because it conservatively includes the historical Attempt 2 uncertain reservation.

## Formal guard repository verification

PR #135 merged the remaining formal safety/audit guard into `main` at `fcf71cc03f7584e005a490b8d7d3e4c9afdeba1a`. Exact reviewed head `1b6f5d631429eda53be734266a5f47e527390739` passed CI #994 and Product Eval #233.

The merged formal runner now requires Anthropic-only routing, records the sanitized selected routing provider, verifies the durable reservation against the formal conservative estimate, and blocks the next dispatch before provider execution if cumulative actual spend plus that next reservation would exceed the explicit W18 cap. This repository-side work made no hosted provider call, so it did not consume the single formal-run authorization.

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

The US$0.091596 pre-run delta was reconciled from the local ledger as an earlier complete 20-entry settled W18-shaped batch. Combined with the later recorded PASS run, same-day duplicate-execution spend was US$0.183312, below the US$0.25 monetary ceiling.

The duplicate run exposed missing persistent single-attempt consumption state. PR #142 fixed this fail-closed by refusing completed 20-call PASS evidence and atomically persisting a gitignored authorization-consumption marker before hosted dispatch. CI #1012 and Product Eval #251 passed, and the fix merged at `cff6e21edc8085bb895c6ed59c32b5e4aa134ee0`. Do not rerun the paid benchmark.

Canonical verification: `docs/verification/w18-formal-hosted-economics-pass-reconcile-2026-09-18.md`.

## Claim boundary

A formal W18 PASS supports only a bounded statement on the five synthetic extraction fixtures using the same pinned OpenRouter/Anthropic route. It does not establish universal workload savings, future prices, end-to-end network savings, production SLA/SLO, or public percentage-savings marketing claims.

## Immediate next action

F6-E01 is **CLOSED / REPO-SIDE PASS**. PR #146 merged the held-out selector suite after CI #1023, Product Eval #262, and MCP External #467 PASS. PR #147 then hardened the 50-case budget with automatic case-manifest discovery after CI #1025 and Product Eval #264 PASS.

The next explicit scope is **F6-E02 — dependency policy as a continuous CI gate**. The repository already has `pnpm dependency:review` and `scripts/dependency-security-review.mjs`, but normal `.github/workflows/ci.yml` does not execute it. F6-E02 will wire that deterministic policy into CI and add a release-acceptance assertion so the gate cannot silently disappear.

Claim boundary: this checks pinned dependency/source policy, Docker image tag policy, and lockfile presence. It is **not** a live registry vulnerability/CVE freshness claim. Do **not** rerun the paid W18 benchmark.

Canonical W18 verification sources:

- `docs/verification/w18-hosted-economics-preflight-2026-09-17.md`
- `docs/verification/w18-hosted-economics-attempt-1-2026-09-17.md`
- `docs/verification/w18-hosted-economics-attempt-2-2026-09-17.md`
- `docs/verification/w18-hosted-diagnostic-attempt-3-2026-09-17.md`
- `docs/verification/w18-hosted-diagnostic-attempt-4-2026-09-17.md`
- `docs/verification/w18-formal-run-readiness-2026-09-18.md`
- `docs/verification/w18-formal-guard-merge-2026-09-18.md`
- `docs/verification/w18-formal-operator-wrapper-2026-09-18.md`
- `docs/verification/w18-formal-hosted-economics-pass-reconcile-2026-09-18.md`
- `docs/verification/w18-duplicate-execution-reconciliation-2026-09-18.md`
- `docs/verification/w18-final-closure-2026-09-18.md`
- `docs/verification/w20-final-current-state-closure-2026-09-18.md`

Historical audits dated before this handoff remain historical snapshots and are not current status sources.


F6-E01 verification source: `docs/verification/f6-e01-heldout-selector-eval-2026-09-18.md`.
