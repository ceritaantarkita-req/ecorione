# Comparative ECX / optimizer evidence

Status: **ACTIVE LOCAL R&D CHECKPOINT — HARNESS MERGED/VERIFIED; REAL GEMMA EVIDENCE PENDING**
Date: 2026-09-11

This workstream measures whether the current ECORIONE pointer-first exchange can reduce transported/model context without hiding quality loss. It is intentionally local-first. Real compute-host/VPS and Cloudflare deployment are **operator-deferred** and are not prerequisites for this evidence work.

Harness implementation status:

- PR #38 merged as `c1849cd0c67712e40ea4e5c90587283900859cdb`;
- final PR head `d3f1cbf4d0acbb2c92f340b952f2c42e6c9bef4a`;
- exact-head CI `34557147546`: PASS;
- exact-head MCP External HTTPS Acceptance `34557147583`: PASS;
- post-merge `main` CI `34557297702`: PASS;
- post-merge MCP External HTTPS Acceptance `34557297803`: PASS;
- verification: `docs/verification/comparative-harness-implementation-2026-09-11.md`.

The **measurement result is not closed yet**. Next runtime checkpoint is laptop sync → real Gemma smoke → inspect/fix if needed → closure-grade paired benchmark.

## Why this exists

The local Historical Ledger + ECX checkpoint already proved that real Local→Gemma traffic can be recorded, handed off through ECX, selectively hydrated, and verified through `pnpm production:data-evidence`.

That proof established traffic, integrity, and provenance. It did **not** establish that ECX or the wider optimizer saves tokens, latency, or money.

The next question is narrower and measurable:

> For the same task, same local model, and same underlying facts, what changes when context is transported inline, hydrated through ECX in full, or hydrated selectively?

## Critical claim boundary

The current ECX API does not autonomously choose which references to hydrate. The caller supplies `refIndexes` to `/v1/exchange/hydrate`.

Therefore the third benchmark lane is named **`ecx-selective-oracle`**. Its relevant reference indexes are declared in the synthetic fixture. It measures the upper-bound/potential benefit of correct selective hydration. It is **not evidence that ECORIONE already has an automatic production reference selector**.

Do not rename this lane to imply an autonomous optimizer until such a selector exists and has its own evidence.

Likewise, local Ollama/provider-token cost is expected to be USD 0. Local runs can establish byte/token/latency/quality evidence, but they cannot establish real hosted-provider billed-cost savings.

## Benchmark lanes

Every task is run through three paired lanes:

| Lane | Context transport | Model context | What it controls/measures |
|---|---|---|---|
| `full-inline` | Full fixture context is assembled directly | All fixture documents | Baseline |
| `ecx-all` | Real ECX packet + real Artifact-reference hydration | All fixture documents | Control for ECX transport when no context is removed |
| `ecx-selective-oracle` | Same real ECX packet, but hydrate only fixture-declared relevant refs | Relevant documents only | Upper bound for correct selective hydration |

`ecx-all` is important. Without it, a lower token count in the selective lane could be incorrectly attributed to ECX transport itself. `full-inline` and `ecx-all` should have approximately the same model input token count because both deliver the same semantic document set.

## Workloads

The harness contains five synthetic evidence-extraction tasks:

1. incident triage;
2. procurement award;
3. release readiness;
4. retention policy;
5. customer escalation.

Each fixture contains a small authoritative subset plus larger unrelated/noise documents. Required answers are explicit structured fields. Quality is scored deterministically by exact field/value equality; no second AI judge is used.

Synthetic fixtures are deliberate for this stage: they make relevance and correctness knowable in advance and prevent the benchmark from quietly changing its answer key after results are seen. Representative real product workloads are still required before broad product claims.

## Runtime boundaries

The harness uses the existing owner services rather than bypassing them:

```text
Synthetic fixture
  -> Artifact POST /v1/artifacts (LOCAL_ONLY, INTERNAL)
  -> Hub POST /v1/exchange/plan
  -> Hub POST /v1/exchange/hydrate
  -> Connect POST /v1/complete target=local
  -> configured local runtime/model
```

Artifact uploads are content-addressed. Re-running identical fixtures should deduplicate the blob, though the local Context/Artifact stores still receive normal metadata/API traffic. This is expected local R&D state and must not be committed to Git.

No provider credentials are read or printed by the harness. `ECORIONE_INTERNAL_TOKEN` is required only for internal service authentication.

## Cache control

Connect exact-match cache keys include the model identity, stable prefix digest, dynamic context, and user message. A repeated identical measured request would therefore become a cache hit and invalidate a model-compute comparison.

The harness adds a unique same-shape benchmark cache-buster to each measured lane. Any measured `cacheHit=true` is a hard task failure.

A single warm-up completion is performed before measurements and excluded from results.

## Repository closure hygiene

The harness implementation was merged only after the final PR head passed the normal repository gates and MCP External HTTPS acceptance. Temporary formatter/helper workflows were removed before closure. The real Gemma smoke/full benchmark is intentionally run only after the verified harness is merged to `main` and synchronized to the laptop, so runtime evidence is tied to a stable repository revision rather than a moving PR branch.

Two implementation hygiene issues discovered before closure were fixed rather than waived:

- Prettier differences in the new script/test;
- Node `performance` usage was made explicit with `node:perf_hooks` to satisfy the repository lint environment.

## Measurements

For every measured completion the harness records:

- provider/model/response-model/pricing-model identity;
- cache state;
- model-context bytes;
- input/output/cache token usage;
- end-to-end completion latency measured by the harness;
- provider-token `actualUsd` and counterfactual/naive accounting returned by Connect;
- deterministic quality score.

For ECX it also records:

- packet bytes;
- full hydration bytes;
- selective hydration bytes;
- selected recipient;
- Artifact IDs used by the synthetic fixture.

The saved JSON contains no internal token or provider secret.

## Predeclared task gates

A task passes only when all of these are true:

1. deterministic ECX recipient matches the exact-capability benchmark reviewer;
2. no measured completion is served from exact cache;
3. model + response-model identity stays constant across the paired lanes;
4. median deterministic quality score is 100% in all three lanes;
5. `ecx-all` median input tokens stay within 5% (minimum absolute tolerance 2 tokens) of `full-inline`;
6. selective hydration bytes are lower than all-reference hydration bytes;
7. `packetBytes + selectiveHydratedBytes` is lower than full-inline context bytes;
8. selective median input tokens are lower than full-inline median input tokens;
9. selective median latency does not exceed full-inline median latency by more than the configured tolerance; default ratio is `1.35`.

These gates were declared before the real evidence run. Do not lower them after seeing a failure merely to obtain a green result. If a gate is inappropriate because the measurement design itself is wrong, document the reason and change the design in a separate reviewed commit before rerunning.

## Commands

Prerequisite: synchronize the laptop to the latest merged `main`, then run the local Phase 4 runtime with the known local `.env` configuration.

```bash
cd ~/projects/ecorione
set -a
source .env
set +a

# Fast wiring/quality smoke: first task, one measured repeat (3 model calls + warm-up)
pnpm evidence:comparative:smoke

# Normal development run: all 5 tasks, 3 repeats by default (45 measured calls + warm-up)
pnpm evidence:comparative

# Closure-grade local run: all 5 tasks x 5 paired repeats (75 measured calls + warm-up)
pnpm evidence:comparative -- --repeats 5 \
  --output .ecorione/evidence/comparative-local-2026-09-11.json
```

A narrower troubleshooting run can select task IDs:

```bash
pnpm evidence:comparative -- --tasks incident-triage,release-readiness --repeats 1
```

Useful environment controls:

```text
ECORIONE_CONNECT_URL                         default http://127.0.0.1:17023
ECORIONE_HUB_URL                             default http://127.0.0.1:17024
ECORIONE_ARTIFACT_URL                        default http://127.0.0.1:17025
ECORIONE_COMPARATIVE_REPEATS                 default 3
ECORIONE_COMPARATIVE_TIMEOUT_MS              default 120000
ECORIONE_COMPARATIVE_LATENCY_TOLERANCE_RATIO default 1.35
ECORIONE_COMPARATIVE_OUTPUT                  optional local JSON output
```

## Runtime execution order

Do not skip directly to the 75-call closure run. Use this order:

1. synchronize tracked laptop tree to the latest merged `main`;
2. restart Phase 4 if it is still running from an older tree;
3. verify the local model endpoint is reachable;
4. run `pnpm evidence:comparative:smoke`;
5. inspect all three lanes, model identity, cache state, quality and measurements;
6. if a real defect appears, fix it through a separate reviewed branch and rerun smoke;
7. only after smoke is healthy, run `--repeats 5` and save raw JSON locally;
8. create a sanitized verification note from the measured result;
9. update canonical status docs with `PASS`, `PASS WITH LIMITATIONS`, or `FAIL / NEEDS ITERATION` based on evidence.

A negative result is valid evidence. Do not change the gates or workload after seeing a failure merely to recover a positive result.

## How to interpret results

A PASS supports only the measured claims:

- real ECX pointer transport worked for the benchmark fixture;
- hydrating the fixture-declared relevant subset reduced transferred context;
- the selected subset reduced model input tokens while retaining the required synthetic facts;
- measured median latency stayed inside the predeclared tolerance for those runs.

It does **not** by itself support:

- automatic reference-selection accuracy;
- universal optimizer effectiveness;
- production workload quality;
- hosted-provider cost savings;
- public percentage-savings marketing claims;
- VPS/Cloudflare/production-readiness claims beyond already-closed repository/local boundaries.

## Evidence progression after this harness

If the oracle-selective lane shows a meaningful benefit, the next evidence-driven decision is whether an actual reference-selection mechanism is justified. If one is implemented, it must be evaluated against the oracle lane and the full-inline baseline on held-out workloads.

If the oracle lane does not show a useful benefit, do not build a selector merely to satisfy the original hypothesis. Record the negative result and redirect optimization effort to the measured bottleneck.

Hosted cost evidence, if ever requested, must use operator-owned credentials through Connect Vault, equivalent paired tasks, actual provider billing telemetry where available, and explicit spend limits. It remains separate from this local checkpoint.

## Relationship to deployment

Real compute-host/VPS deployment and Cloudflare cutover remain valid future operations work, but they are currently **DEFERRED BY OPERATOR DECISION**. Deferral is not a failure and does not reopen Batch 1–12.

The active order is now:

```text
comparative ECX real Gemma evidence
  -> local persistence/restart drill
  -> local backup/restore drill
  -> local observability baseline
  -> UX/product validation
  -> immutable local model identity hardening
  -> compute-host/VPS deployment only when the operator chooses to resume it
```

Canonical current-state status remains in `docs/current-state-and-next-steps.md`.
