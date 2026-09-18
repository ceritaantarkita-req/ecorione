# F6-E01 — Held-out ECX Selector Eval + Eval-Budget Governance

Date: **2026-09-18**

Status: **IMPLEMENTED / IN REVIEW**

## Scope

F6-E01 is a new explicit Fase 6+ evidence scope after W20 closure. It does not reopen W16–W20 and is not an implicit Batch 13.

The implementation adds:

- `evals/ecx-selector-heldout.json` — 10 deterministic held-out `semantic-v1` selector cases;
- `evals/ecx-selector-heldout.test.ts` — manifest/provenance/budget/selector assertions;
- `evals/eval-inventory.test.ts` — repository-wide governed eval inventory ceiling;
- `pnpm eval:selector:heldout` — focused local command;
- Product Eval workflow coverage for both new deterministic test files.

## Provenance boundary

Every held-out case cites a real repository bug or task:

```text
F6-E01-001  STATIC-009  workspace-aware MCP routing
F6-E01-002  STATIC-018  bearer redirect fail-closed
F6-E01-003  STATIC-023  realtime voice SSE/no-store/redirect boundary
F6-E01-004  S1-3        public localBaseUrl rejection
F6-E01-005  S2-4        immutable local-model digest requirement
F6-E01-006  single-attempt W18 duplicate-execution governance incident
F6-E01-007  W04         required-vs-optional Operations degradation
F6-E01-008  STATIC-003  authoritative memory Forget/invalidation path
F6-E01-009  W06         transient provider credential test path
F6-E01-010  W08         explicit Local chat routing
```

The suite deliberately excludes W17/W18 benchmark fixtures so this is a separate held-out regression surface rather than a replay of the five synthetic extraction tasks.

## No-oracle selector rule

The manifest stores `relevant` labels only for evaluation. The test strips those labels before calling `selectEcxReferenceIndexes`.

The selector receives only:

- packet intent;
- task;
- need;
- descriptor index/text;
- `maxRefs`.

Expected relevant indexes are computed only after descriptor inputs are prepared and are used solely for assertions.

## Current deterministic expectations

- cases: **10**;
- selector mode: `semantic-v1`;
- per-case `maxRefs`: **1–2**, always <= 3;
- each case has at least one distractor beyond its ref budget;
- every expected relevant ref must be selected;
- selected ref count must stay within budget;
- selected refs must remain unique.

## Repository-wide eval budget

Governed manifests after this change:

```text
W14 product regressions = 12
W15 agentic cases = 4
F6-E01 held-out selector cases = 10
total governed cases = 26
permanent ceiling = 50
```

The inventory test also requires globally unique case IDs across those manifests.

## Provider/spend boundary

F6-E01 is deterministic repository-side evaluation. It makes:

- no local model inference call;
- no hosted provider call;
- no W18 rerun;
- no provider spend;
- no VPS/Cloudflare mutation.

## Claim boundary

A PASS supports only deterministic `semantic-v1` selector regression coverage over these 10 real bug/task-derived held-out cases plus eval inventory governance.

It does **not** prove:

- model answer quality;
- hosted billed-cost savings;
- production workload representativeness;
- universal optimizer effectiveness;
- production SLA/SLO;
- future provider/model behavior.

Closure requires exact-head CI and Product Eval PASS, guarded merge, then post-merge current-state sync.
