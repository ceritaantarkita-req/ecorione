# Comparative ECX / optimizer evidence

Status: **CLOSED / PASS WITH LIMITATIONS — LOCAL SYNTHETIC COMPARATIVE CHECKPOINT**
Date: 2026-09-11

This workstream measures whether the current ECORIONE pointer-first exchange can reduce transported/model context without hiding quality loss. The local checkpoint is now closed on the corrected merged runtime revision, with the claim boundary below kept explicit.

Real compute-host/VPS and Cloudflare deployment remain **operator-deferred** and were not prerequisites for this evidence work.

## Closure summary

Repository/runtime progression:

- comparative harness PR #38 merged as `c1849cd0c67712e40ea4e5c90587283900859cdb`;
- comparative harness docs closure PR #39 merged as `5437c1ea5d8ee168dbbe09de688a23c39089c7aa`;
- cache-isolation fix PR #40 merged as `197627dc04689dea94bf7957e18b2699f8fb9213`;
- release fixture delimiter correction PR #41 merged as `4d5ee560a3b6cef024b0d7ed7bbec53a17f32675`;
- PR #41 exact-head CI `34565244451`: PASS;
- PR #41 post-merge `main` CI `34565539119`: PASS;
- corrected targeted `release-readiness` rerun: PASS;
- corrected full closure-grade run: 5 tasks × 5 repeats × 3 lanes = 75 measured model calls, 5/5 task gates PASS;
- final sanitized runtime verification: `docs/verification/comparative-closure-grade-final-2026-09-11.md`.

The raw final JSON stays local/gitignored:

```text
.ecorione/evidence/comparative-local-2026-09-11-v2.json
bytes: 94654
sha256: 189795c71dc72acfd3d1533490a002d87e68421682868eb2b8b830c6fbdab439
```

## Why this exists

The Historical Ledger + ECX checkpoint already proved that real Local→Gemma traffic can be recorded, handed off through ECX, selectively hydrated, and verified through `pnpm production:data-evidence`.

That proof established traffic, integrity, and provenance. It did **not** establish that ECX or the wider optimizer saves tokens, latency, or money.

This comparative checkpoint asked a narrower question:

> For the same task, same local model, and same underlying facts, what changes when context is transported inline, hydrated through ECX in full, or hydrated selectively?

## Critical claim boundary

The current ECX API does not autonomously choose which references to hydrate. The caller supplies `refIndexes` to `/v1/exchange/hydrate`.

Therefore the third benchmark lane remains **`ecx-selective-oracle`**. Its relevant reference indexes are declared in the synthetic fixture. It measures the upper-bound/potential benefit of correct selective hydration. It is **not evidence that ECORIONE already has an automatic production reference selector**.

Likewise, local provider-token cost is USD 0. Local runs can establish byte/token/latency/quality evidence, but they cannot establish real hosted-provider billed-cost savings.

## Benchmark lanes

Every task is run through three paired lanes:

| Lane | Context transport | Model context | What it controls/measures |
|---|---|---|---|
| `full-inline` | Full fixture context is assembled directly | All fixture documents | Baseline |
| `ecx-all` | Real ECX packet + real Artifact-reference hydration | All fixture documents | Control for ECX transport when no context is removed |
| `ecx-selective-oracle` | Same real ECX packet, but hydrate only fixture-declared relevant refs | Relevant documents only | Upper bound for correct selective hydration |

`ecx-all` is required so a lower token count in the selective lane is not incorrectly attributed to ECX transport itself. `full-inline` and `ecx-all` should have approximately the same model input token count because both deliver the same semantic document set.

## Workloads

The harness contains five synthetic evidence-extraction tasks:

1. incident triage;
2. procurement award;
3. release readiness;
4. retention policy;
5. customer escalation.

Each fixture contains a small authoritative subset plus larger unrelated/noise documents. Required answers are explicit structured fields. Quality is scored deterministically by exact field/value equality; no second AI judge is used.

Synthetic fixtures make relevance and correctness knowable in advance. Representative real product workloads are still required before broad product claims.

## Runtime boundaries

The harness uses existing owner-service APIs:

```text
Synthetic fixture
  -> Artifact POST /v1/artifacts (LOCAL_ONLY, INTERNAL)
  -> Hub POST /v1/exchange/plan
  -> Hub POST /v1/exchange/hydrate
  -> Connect POST /v1/complete target=local
  -> configured local runtime/model
```

No provider credentials are printed by the harness. `ECORIONE_INTERNAL_TOKEN` is used only for internal service authentication.

## Cache control

Measured exact-cache hits invalidate a model-compute comparison.

PR #40 introduced one random cache namespace per benchmark invocation. Every measured lane appends a fixed-shape marker containing that namespace plus numeric task/pair/mode coordinates. Any measured `cacheHit=true` remains a hard task failure.

A single warm-up completion is performed before measurements and excluded from results.

## Predeclared task gates

A task passes only when all of these are true:

1. deterministic ECX recipient matches the exact-capability benchmark reviewer;
2. no measured completion is served from exact cache;
3. model + response-model identity stays constant across paired lanes;
4. median deterministic quality score is 100% in all three lanes;
5. `ecx-all` median input tokens stay within 5% (minimum absolute tolerance 2 tokens) of `full-inline`;
6. selective hydration bytes are lower than all-reference hydration bytes;
7. `packetBytes + selectiveHydratedBytes` is lower than full-inline context bytes;
8. selective median input tokens are lower than full-inline median input tokens;
9. selective median latency does not exceed full-inline median latency by more than the configured tolerance; default ratio is `1.35`.

These gates were declared before the final run and were not weakened after failures.

## Evidence progression

### First real smoke — valid FAIL / cache-isolation finding

The first real Gemma smoke reached Artifact, Hub ECX and Connect, but all measured lanes were served from exact cache. The hard cache gate rejected the run. Finding:

- `docs/verification/comparative-smoke-cache-defect-2026-09-11.md`.

### Corrected smoke after PR #40 — PASS

After PR #40 and laptop synchronization, the `incident-triage` smoke passed with all three measured lanes uncached, non-zero token telemetry, stable model identity, 100% task quality, aligned `full-inline`/`ecx-all` tokens, and lower selective bytes/tokens.

### First full 5× run — valid FAIL / fixture ambiguity

The first complete 75-call run on `197627dc04689dea94bf7957e18b2699f8fb9213` passed 4/5 tasks. `release-readiness` failed exact quality equally in baseline, ECX-all and selective lanes because authoritative source values had sentence-final punctuation that conflicted with the fixed exact-string answer key.

This was recorded rather than rewritten:

- `docs/verification/comparative-closure-grade-first-run-2026-09-11.md`.

PR #41 removed only the ambiguous release source delimiters. It did not change the expected answer, scorer, or thresholds.

### Targeted corrected `release-readiness` — PASS

After PR #41 merged and the laptop synchronized to `4d5ee560a3b6cef024b0d7ed7bbec53a17f32675`, the targeted one-repeat check passed:

- all three lanes uncached;
- quality `1.0` in all three lanes;
- `full-inline` input tokens `1394`;
- `ecx-all` input tokens `1394`;
- selective input tokens `461`;
- transport reduction `58.7594%`;
- input-token reduction `66.9297%`;
- selective/full latency ratio `0.8054`.

### Final corrected 5× run — formal harness PASS

Revision: `4d5ee560a3b6cef024b0d7ed7bbec53a17f32675`.

Run shape:

- 5 tasks;
- 5 repeats;
- 3 lanes;
- 75 measured model calls;
- all measured cache hits: `0`;
- model identity stable as `gemma4:latest` / `gemma4:latest`;
- 5/5 task gates PASS.

Aggregate task-level result:

- median selective transport reduction: `73.6379379246037%`;
- median selective input-token reduction: `77.8580814717477%`;
- median selective/full latency ratio: `0.8672873729681319`.

Per-task medians:

| Task | Full input | ECX-all input | Selective input | Transport reduction | Input-token reduction | Latency ratio | Gate |
|---|---:|---:|---:|---:|---:|---:|---:|
| `incident-triage` | 1553 | 1553 | 351 | 74.1928% | 77.3986% | 0.8673 | PASS |
| `procurement-award` | 1884 | 1884 | 393 | 75.6462% | 79.1401% | 0.9084 | PASS |
| `release-readiness` | 1392 | 1392 | 459 | 58.7594% | 67.0259% | 0.9740 | PASS |
| `retention-policy` | 1595 | 1595 | 338 | 73.6379% | 78.8088% | 0.7663 | PASS |
| `customer-escalation` | 1522 | 1522 | 337 | 73.5568% | 77.8581% | 0.8456 | PASS |

## Why the closure verdict is PASS WITH LIMITATIONS

The formal predeclared task gates passed. A post-run audit of all 75 individual completions, however, found one exact-string mismatch:

- `retention-policy`;
- `ecx-selective-oracle`;
- repeat `2/5`;
- quality `1/3` because the model returned `ap-southeast.` and `Data Steward.` with sentence-final periods.

The other four selective repeats and all baseline/control repeats for that task scored `3/3`, so the **median** selective quality remained `1.0` and the task gate passed exactly as defined.

This means the checkpoint may be closed under the declared protocol, but it must not be described as “75/75 completions had perfect exact-string quality.” Future benchmark hardening should remove remaining exact-string delimiter ambiguity and may adopt a stricter all-repeats quality gate before broader optimizer claims.

Negative/intermediate findings remain preserved. They are not rewritten away to make the final history appear cleaner.

## What the final checkpoint verifies

Within these five synthetic local fixtures and the declared median-based gates:

- real ECX pointer transport worked end-to-end;
- `ecx-all` preserved the full-inline median input-token baseline;
- fixture-declared selective hydration reduced transported context;
- the selective lane reduced median model input tokens on every task;
- task-level median deterministic quality stayed at `1.0` in every lane;
- selective median latency stayed inside the predeclared tolerance;
- all measured model calls were uncached.

## What it does not verify

The result does **not** establish:

- automatic reference-selection accuracy;
- universal optimizer effectiveness;
- general production workload quality;
- hosted-provider cost savings;
- public percentage-savings marketing claims;
- VPS/Cloudflare behavior beyond already-closed repository/local boundaries.

The measured aggregate percentages may be cited only as results from this specific local synthetic benchmark and only with the oracle-selector and per-run-quality limitations attached.

## Commands

Prerequisite: synchronize the laptop to the intended merged `main` and run Phase 4 with the known local environment.

```bash
cd ~/projects/ecorione
set -a
source .env
set +a

# Fast smoke
pnpm evidence:comparative:smoke

# Normal development run
pnpm evidence:comparative

# Targeted task
pnpm evidence:comparative \
  --tasks release-readiness \
  --repeats 1

# Closure-grade local run
pnpm evidence:comparative \
  --repeats 5 \
  --output .ecorione/evidence/comparative-local-2026-09-11-v2.json
```

Do **not** insert an extra `--` between `pnpm evidence:comparative` and the script arguments; the parser rejects it as `Unknown argument: --`.

Raw evidence remains local/gitignored. Commit only sanitized verified summaries.

## Next evidence-driven decision

The Comparative ECX local checkpoint is no longer the active blocker. The next operator-approved sequence is:

```text
local persistence/restart drill
  -> local backup/restore drill
  -> local observability baseline
  -> UX/product validation
  -> immutable local model identity hardening
  -> compute-host/VPS deployment only when the operator explicitly resumes it
```

Automatic reference selection is **not** automatically next. If a selector is proposed later, it must be a separate explicit scope and be evaluated against the oracle lane and full-inline baseline on held-out workloads.

Hosted cost evidence, if ever requested, remains a separate future checkpoint using operator-owned credentials through Connect Vault, equivalent paired tasks, explicit spend limits, and actual provider billing telemetry where available.

Canonical current-state status: `docs/current-state-and-next-steps.md`.
Final sanitized evidence: `docs/verification/comparative-closure-grade-final-2026-09-11.md`.
