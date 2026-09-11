# Comparative ECX / optimizer evidence

Status: **ACTIVE LOCAL R&D CHECKPOINT — CACHE FIX VERIFIED; FIRST 5× CLOSURE RUN 4/5 PASS; RELEASE FIXTURE CORRECTION + RERUN REQUIRED**
Date: 2026-09-11

This workstream measures whether the current ECORIONE pointer-first exchange can reduce transported/model context without hiding quality loss. It is intentionally local-first. Real compute-host/VPS and Cloudflare deployment are **operator-deferred** and are not prerequisites for this evidence work.

Harness implementation status:

- PR #38 merged as `c1849cd0c67712e40ea4e5c90587283900859cdb`;
- final PR head `d3f1cbf4d0acbb2c92f340b952f2c42e6c9bef4a`;
- exact-head CI `34557147546`: PASS;
- exact-head MCP External HTTPS Acceptance `34557147583`: PASS;
- post-merge `main` CI `34557297702`: PASS;
- post-merge MCP External HTTPS Acceptance `34557297803`: PASS;
- docs closure PR #39 merged as `5437c1ea5d8ee168dbbe09de688a23c39089c7aa`;
- cache-isolation fix PR #40 merged as `197627dc04689dea94bf7957e18b2699f8fb9213`;
- PR #40 exact-head and post-merge repository gates: PASS;
- verification: `docs/verification/comparative-harness-implementation-2026-09-11.md`;
- first cached-smoke finding: `docs/verification/comparative-smoke-cache-defect-2026-09-11.md`;
- first full 5× run finding: `docs/verification/comparative-closure-grade-first-run-2026-09-11.md`.

The **measurement result is not closed yet**. The corrected real Gemma smoke passed, then the first complete 5-task × 5-repeat run executed 75 measured calls with isolated cache namespaces. Four tasks passed. `release-readiness` failed the exact-match quality gate equally in `full-inline`, `ecx-all`, and `ecx-selective-oracle` because two authoritative source strings ended with sentence punctuation while the fixed expected values excluded those periods. The follow-up fixture correction keeps the answer key, scorer, and all thresholds unchanged and only removes the ambiguous source delimiters.

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

The `release-readiness` follow-up correction does **not** change its expected answer. It only removes sentence-final periods immediately adjacent to two authoritative string values so the source delimiter no longer conflicts with the predeclared exact-string answer key.

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

The original PR #38 harness used a marker derived from task id, paired-run index, and mode. That was unique **inside one invocation**, but not across two separate invocations. A smoke followed by another smoke/full run inside the Connect cache TTL could therefore reuse the prior measured entry. The first real Gemma smoke exposed exactly that defect and the predeclared `cacheHit=true` gate rejected the run.

PR #40 corrected this with one random 32-hex cache namespace per benchmark invocation. Every measured lane appends a fixed-shape marker containing that namespace plus numeric task/pair/mode coordinates. This preserves paired marker shape while making a later smoke/full invocation a distinct exact-cache namespace. Any measured `cacheHit=true` remains a hard task failure.

A single warm-up completion is performed before measurements and excluded from results. The warm-up itself is allowed to be cached because it is not a measured lane; measured calls are not.

## Real runtime findings — 2026-09-11

### First smoke: valid failure, cache-isolation defect

Laptop/main revision: `5437c1ea5d8ee168dbbe09de688a23c39089c7aa`.

Artifact upload, Hub ECX plan/hydration, recipient selection, and deterministic returned quality worked, but all three measured completion lanes reported `cacheHit=true` with zero token telemetry. The run failed as designed and is preserved in `docs/verification/comparative-smoke-cache-defect-2026-09-11.md`.

### Corrected smoke: PASS

After PR #40 merged and the laptop synchronized to `197627dc04689dea94bf7957e18b2699f8fb9213`, the corrected `incident-triage` smoke passed:

- all three measured lanes `cacheHit=false`;
- `full-inline` and `ecx-all`: 1553 input tokens in the captured smoke;
- `ecx-selective-oracle`: 351 input tokens;
- deterministic quality: 100% in all three lanes;
- packet: 1011 bytes;
- all-ref hydration: 8241 bytes;
- selective hydration: 1123 bytes;
- task gate: PASS.

This validated the cache-isolation correction but was still only one task × one repeat.

### First closure-grade 5× run: 4/5 PASS, fixture ambiguity found

Revision: `197627dc04689dea94bf7957e18b2699f8fb9213`.

Run shape:

- 5 tasks;
- 5 repeats;
- 3 lanes;
- 75 measured calls;
- raw JSON written to local gitignored evidence storage.

Aggregate observed result:

- passed tasks: `4/5`;
- failed task: `release-readiness`;
- median selective transport reduction across task measurements: `73.6379379246037%`;
- median selective input-token reduction: `77.70491803278688%`;
- median selective/full latency ratio: `0.8387964882197358`.

Those aggregate numbers are **provisional observations from a failed closure run**, not a final savings claim.

`release-readiness` had median quality `1/3` in all three lanes. The model commonly returned `R2026.09.11.` and `DB-188 migration checksum mismatch.` while the fixed expected values were `R2026.09.11` and `DB-188 migration checksum mismatch`. The original source lines themselves ended those values with sentence periods. Because the baseline, ECX-all control, and selective lane failed identically, this is not selective-hydration-specific quality loss.

Follow-up branch: `fix/comparative-release-fixture-ambiguity-20260911`.

The follow-up does **not** normalize punctuation in `scoreReply`, change the answer key, or weaken any quality/bytes/token/latency gate.

## Repository closure hygiene

The original harness implementation was merged only after the final PR head passed the normal repository gates and MCP External HTTPS acceptance. Temporary formatter/helper workflows were removed before closure. Real Gemma smoke/full benchmarks are intentionally run only against reviewed merged trees, so runtime evidence is tied to a stable repository revision rather than a moving PR branch.

Runtime findings are preserved as findings rather than rewritten away:

- first smoke: cross-invocation cache namespace defect;
- first full 5× run: exact-value fixture delimiter ambiguity.

Each correction is handled in a separate reviewed scope without lowering gates.

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

These gates were declared before the real evidence run. **Neither the cache failure nor the release fixture failure caused any gate to be weakened.** If measurement design is internally inconsistent, document that defect, correct the fixture/design in a separate reviewed commit, and rerun from the corrected merged revision.

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

# Targeted task verification after a fixture correction
pnpm evidence:comparative \
  --tasks release-readiness \
  --repeats 1

# Closure-grade local run: all 5 tasks x 5 paired repeats (75 measured calls + warm-up)
pnpm evidence:comparative \
  --repeats 5 \
  --output .ecorione/evidence/comparative-local-2026-09-11.json
```

Do **not** insert an extra `--` between `pnpm evidence:comparative` and the script arguments. In this repository/package-script setup that literal separator reaches `scripts/comparative-evidence.mjs`, whose parser rejects it as `Unknown argument: --`.

A narrower troubleshooting run can select multiple task IDs:

```bash
pnpm evidence:comparative \
  --tasks incident-triage,release-readiness \
  --repeats 1
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

Use this order:

1. merge only reviewed harness/fixture corrections with repository gates green;
2. synchronize tracked laptop tree to the resulting `main`;
3. restart Phase 4 only if the running services came from an older service/runtime tree;
4. verify the local model endpoint is reachable;
5. after a fixture-only correction, run the targeted corrected task first;
6. inspect all three lanes, model identity, cache state, quality and measurements;
7. if the targeted task is healthy, rerun the complete 5-task × 5-repeat closure benchmark on the corrected merged revision;
8. keep raw JSON local/gitignored;
9. create a sanitized verification note from the final measured result;
10. update canonical status docs with `PASS`, `PASS WITH LIMITATIONS`, or `FAIL / NEEDS ITERATION` based on evidence.

A negative result is valid evidence. Do not change the gates, answer key, or scorer merely to recover a positive result.

## How to interpret results

A final PASS supports only the measured claims:

- real ECX pointer transport worked for the benchmark fixtures;
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
