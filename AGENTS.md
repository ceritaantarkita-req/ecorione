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
- W18 hosted economic validation: **FORMAL RUN READY / NOT CLOSED**;
- W18 one-call Anthropic-only diagnostic Attempt 4: **PASS**;
- W18 formal dispatch/routing/cap guard: **MERGED TO `main`** via PR #135 at `fcf71cc03f7584e005a490b8d7d3e4c9afdeba1a`; exact-head CI #994 + Product Eval #233 **PASS**;
- W18 formal 20-call run: **authorized once up to US$0.25, not yet executed at this documentation checkpoint**;
- W20: **BLOCKED ON W18**;
- compute-host/VPS + Cloudflare: **DEFERRED BY OPERATOR**;
- AutoClick: **DEFERRED BY DESIGN**;
- Fase 6+: **OPEN-ENDED / evidence-driven**;
- no implicit Batch 13.

Agent without chat history **must start with `docs/current-state-and-next-steps.md`**, then `docs/active-work-plan.md`, this file, and `docs/verification/w18-formal-run-readiness-2026-09-18.md` when working on W18.

Historical dated audits are snapshots. Do not rewrite their historical claims merely because later work closed the gap.

## W18 current boundary

Formal experiment:

```text
provider gateway = OpenRouter
pricing identity = claude-sonnet-4-5-20250929
runtime model = anthropic/claude-sonnet-4.5
provider.only = ["anthropic"]
allow_fallbacks = false
modes = full-inline, ecx-selective-auto
5 tasks × 2 repeats × 2 modes = 20 measured calls
warmups = 0
cost authority = OpenRouter usage.cost
```

Attempt chronology:

- Attempt 1 failed after 8/20; known billed `$0.027000`.
- Attempt 2 failed on intended call 5; four successful calls billed `$0.019266`; one historical uncertain reservation `$0.107157` remains.
- Attempt 3 one-call diagnostic failed with `content_filter`, `routingProvider=Amazon Bedrock`, authoritative billed cost `$0`; ledger remained `$0.153423` committed.
- Attempt 4 one-call diagnostic used Anthropic-only routing with fallback disabled and **PASSed**: quality `1`, 2002 input tokens, 45 output tokens, billed `$0.006681`, settlement `settled`, no cache hit.

Latest postflight:

```text
dailyCommittedUsd = 0.160104
monthlyCommittedUsd = 0.160104
unsettledReservations = 1
dailyHeadroomUsd = 0.839896
monthlyHeadroomUsd = 9.839896
hostedCallsEnabled = false
costKillSwitch = 1
```

The ledger day/month keys are UTC-based. Never assume the historical daily committed value remains current after UTC rollover or other hosted activity.

## Formal W18 authorization rules

Current authorization: **one formal W18 attempt, max US$0.25**.

This is not standing permission and cannot be reused for a retry after a partial/failed formal run.

Before starting Connect for the formal run:

1. derive current UTC-day committed spend from the durable ledger;
2. set temporary `ECORIONE_SPEND_DAILY_USD = currentCommitted + 0.25`;
3. start Connect/engine with `ECORIONE_COST_KILL_SWITCH=0`;
4. start Connect/engine with `ECORIONE_OPENROUTER_PROVIDER_ONLY=anthropic`;
5. set current-run `ECORIONE_W18_ALLOW_SPEND=YES`;
6. set current-run `ECORIONE_W18_MAX_SPEND_USD=0.25`;
7. enable runtime hosted calls only for the bounded run;
8. require zero-spend preflight PASS before the formal command.

Connect's durable reservation happens before provider dispatch and is the hard admission boundary. The formal harness additionally rejects the next call before dispatch when cumulative actual spend plus the next conservative reservation would exceed the explicit W18 cap. Do not weaken either boundary or manually edit historical ledger entries.

## Formal failure behavior

If any formal call fails, produces unusable completion, non-positive billed cost, unsettled accounting, quality failure, selector recall failure, unexpected cache hit, or any aggregate gate failure:

- stop the run;
- disable hosted mode;
- restore kill switch/default environment;
- stop the engine launched with kill switch `0`;
- preserve raw local evidence/logs and sanitized facts;
- inspect ledger;
- do **not** rerun without a new explicit spend authorization.

## Canonical W18 evidence

- `docs/verification/w18-hosted-economics-preflight-2026-09-17.md`
- `docs/verification/w18-hosted-economics-attempt-1-2026-09-17.md`
- `docs/verification/w18-hosted-economics-attempt-2-2026-09-17.md`
- `docs/verification/w18-hosted-diagnostic-attempt-3-2026-09-17.md`
- `docs/verification/w18-hosted-diagnostic-attempt-4-2026-09-17.md`
- `docs/verification/w18-formal-run-readiness-2026-09-18.md`
- `docs/verification/w18-formal-guard-merge-2026-09-18.md`

Raw `.ecorione/evidence/` artifacts remain local/gitignored. Commit only sanitized verification summaries.

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
1. merge current documentation sync
2. sync operator laptop to merged main
3. execute one authorized formal W18 attempt (max US$0.25)
4. if PASS: merge W18 closure summary and continue W20
5. if FAIL: preserve evidence, diagnose, obtain fresh authorization before retry
```
