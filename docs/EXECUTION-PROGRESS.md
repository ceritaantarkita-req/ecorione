# ECORIONE — Execution Progress & Remaining Roadmap

Last updated: **2026-09-11**

Status: **ACTIVE — canonical execution tracker**

This file is the source of truth for **current execution status** after the defined Batch 1–12 roadmap. Detailed Batch 1–12 chronology remains archived at:

- `docs/archive/execution-progress-through-batch12-2026-09-10.md`

Start from `docs/current-state-and-next-steps.md`, then this file.

> **Maintenance rule:** a workstream may be marked `CLOSED` only when its applicable evidence exists, exact-head gates are green, the intended merge is verified, post-merge verification is complete, and runtime evidence is rerun on the synchronized merged tree when the claim crosses a runtime boundary.

---

## 1. Status legend

| Status | Meaning |
|---|---|
| `CLOSED` | Scope finished and relevant closure evidence satisfied |
| `PASS WITH LIMITATIONS` | Declared gates passed, but bounded limitations must stay attached to the result |
| `IMPLEMENTED / CLOSURE PENDING` | Implementation exists, but exact-head/runtime/merge/post-merge evidence is incomplete |
| `IN PROGRESS` | Active workstream |
| `PLANNED` | Agreed but not started |
| `DEFERRED` | Intentionally postponed until operator/prerequisite/use case reactivates it |
| `OPEN-ENDED` | Hardening/evidence area that is never permanently finished |

---

## 2. Closed planned roadmap

- Batch 1–12: **12/12 CLOSED**
- remaining planned batch in that roadmap: **0**
- Fase 5 AutoClick: **DEFERRED BY DESIGN**
- Fase 6+: **OPEN-ENDED / evidence-driven**
- **no implicit Batch 13**

`100%` refers only to the defined Batch 1–12 repository implementation roadmap, not live-production operational maturity.

Historical detailed tracker: `docs/archive/execution-progress-through-batch12-2026-09-10.md`.

---

## 3. Verified repository/local baseline

Key post-closure progression:

- Batch 12 implementation PR #29: `ad67b68290a41e69e18dfa49caefed0090bd9635`
- closure PR #30: `783a4ae8a2c90b3c696b3d619fb0c03581f675b2`
- docs/Cloudflare reconciliation PR #31: `aa360b81a6ef5cd41f466d7ada239b4e461c60ee`
- Production Activation tooling + local runtime fixes PR #32: `a6cc17530b4e4540d710fa449c93844a8dad7981`
- sourced-env proxy-test isolation PR #33: `eac26497aa868e448c5fa4e48c3331abf585d5cf`
- secret-scan Git-boundary correction PR #34: `a95e5e20bb30d4828288f6bba230860bc65e631f`
- local rehearsal docs closure PR #35: `7b1d50630e21a14413f73e2ca4a0934de042dcdf`
- browser/Historical-Ledger session identity fix PR #36: `8b93b346a11cc4293af2b8e75e2ec6af48348e60`
- Historical Ledger + ECX local evidence closure PR #37: `88d588bbe4a5f005652c20f3409dd72093439f56`
- Comparative ECX harness PR #38: `c1849cd0c67712e40ea4e5c90587283900859cdb`
- comparative harness docs closure PR #39: `5437c1ea5d8ee168dbbe09de688a23c39089c7aa`
- comparative cache-isolation fix PR #40: `197627dc04689dea94bf7957e18b2699f8fb9213`
- release fixture delimiter correction PR #41: `4d5ee560a3b6cef024b0d7ed7bbec53a17f32675`

PR #41 evidence:

- exact-head CI `34565244451`: **PASS**;
- merge `4d5ee560a3b6cef024b0d7ed7bbec53a17f32675`;
- post-merge CI `34565539119`: **PASS**;
- synchronized laptop targeted `release-readiness`: **PASS**;
- synchronized laptop final full 5× Comparative ECX run: **5/5 task gates PASS**.

Closed local evidence before comparative measurement includes:

- real Phase 4 process stack + Temporal worker RUNNING;
- WSL→Windows Ollama loopback path;
- real Connect→Ollama→Gemma local calls;
- real browser Local chat;
- browser session identity equal to actual `LOCAL_ONLY` Historical Ledger session after PR #36;
- real Ledger chronology/hash chain;
- real ECX pointer-first plan + `agent.handoff` + hydration;
- `pnpm production:data-evidence` PASS.

Verification sources:

- `docs/verification/local-production-rehearsal-2026-09-10.md`
- `docs/verification/historical-ledger-ecx-local-evidence-2026-09-11.md`

Those prove local traffic/integrity/provenance. They do **not** by themselves prove optimizer savings.

---

## 4. Comparative ECX efficiency evidence — CLOSED / PASS WITH LIMITATIONS

Status: **CLOSED / PASS WITH LIMITATIONS — LOCAL SYNTHETIC CHECKPOINT**

Protocol/results:

- `docs/comparative-ecx-evidence.md`
- `docs/verification/comparative-closure-grade-final-2026-09-11.md`

Historical findings retained:

- `docs/verification/comparative-smoke-cache-defect-2026-09-11.md`
- `docs/verification/comparative-closure-grade-first-run-2026-09-11.md`

### 4.1 Experiment lanes

1. `full-inline`
   - all fixture documents assembled directly into model context;
   - baseline for bytes/tokens/latency/quality.

2. `ecx-all`
   - documents become LOCAL_ONLY Artifact pointers;
   - Hub creates a real ECX packet;
   - all refs are hydrated through Hub;
   - same semantic document set reaches the model as the baseline;
   - control lane so ECX transport is not confused with selective-context benefit.

3. `ecx-selective-oracle`
   - same ECX packet;
   - only fixture-declared relevant reference indexes are hydrated;
   - measures potential/upper bound of correct selective hydration.

**Critical boundary:** current `/v1/exchange/hydrate` receives `refIndexes` from the caller. ECORIONE does not yet have a verified autonomous semantic reference selector.

### 4.2 Harness scope

Merged harness scope includes:

- five synthetic fixed-answer workloads;
- real Artifact upload through owner API;
- real Hub ECX plan/hydrate calls;
- real Connect `target=local` completion calls;
- warm-up excluded from measurement;
- measured cache contamination as hard failure;
- deterministic exact-field quality scoring;
- median aggregation;
- predeclared task gates;
- optional local JSON evidence output under gitignored `.ecorione/`;
- explicit output claim boundary;
- per-invocation measured cache namespace isolation after PR #40.

### 4.3 Predeclared task gates

A task passes only when:

1. ECX selects the exact-capability benchmark reviewer;
2. no measured lane has `cacheHit=true`;
3. model + response-model identity stays constant across paired lanes;
4. median deterministic quality is 100% in every lane;
5. `ecx-all` median input tokens remain within 5% of `full-inline` (minimum tolerance 2 tokens);
6. selective hydration bytes are lower than all-ref hydration bytes;
7. `packetBytes + selectiveHydratedBytes` is lower than full-inline context bytes;
8. selective median input tokens are lower than full-inline;
9. selective median latency does not exceed full-inline by more than default ratio `1.35`.

No gate was weakened after a failure.

### 4.4 Evidence progression

#### First real smoke — valid FAIL / cache finding

The first synchronized real Gemma smoke reached Artifact, Hub ECX and Connect, but all measured completions were exact-cache hits. The cache gate correctly rejected the run.

#### Corrected smoke after PR #40 — PASS

After PR #40, the rerun was uncached with real token telemetry, stable model identity, 100% task-level quality, aligned baseline/control tokens, and lower selective bytes/tokens.

#### First full 75-call run — valid FAIL / release fixture ambiguity

The first complete 5-task × 5-repeat run on `197627dc04689dea94bf7957e18b2699f8fb9213` passed 4/5 tasks. `release-readiness` failed exact quality equally in all three lanes because authoritative source values had sentence-final punctuation adjacent to values while the predeclared expected strings did not.

This was a fixture-design finding, not selective-ECX-specific quality loss. It remains preserved historically.

#### PR #41 targeted correction — PASS

PR #41 changed only ambiguous release source delimiters. It kept the expected answer, scorer and all task thresholds unchanged.

Targeted `release-readiness` after the merge:

- all three lanes uncached;
- quality `1.0` in all lanes;
- `full-inline` input tokens `1394`;
- `ecx-all` input tokens `1394`;
- selective input tokens `461`;
- task gate PASS.

#### Final corrected 75-call run — formal harness PASS

Runtime revision:

`4d5ee560a3b6cef024b0d7ed7bbec53a17f32675`

Run shape:

- 5 tasks;
- 5 repeats;
- 3 lanes;
- 75 measured model calls;
- all measured cache hits: `0`;
- 5/5 task gates PASS.

Raw local evidence:

```text
.ecorione/evidence/comparative-local-2026-09-11-v2.json
bytes: 94654
sha256: 189795c71dc72acfd3d1533490a002d87e68421682868eb2b8b830c6fbdab439
```

Aggregate:

- median selective transport reduction: `73.6379379246037%`;
- median selective input-token reduction: `77.8580814717477%`;
- median selective/full latency ratio: `0.8672873729681319`.

Task-level medians:

| Task | Full input | ECX-all input | Selective input | Transport reduction | Input-token reduction | Latency ratio | Gate |
|---|---:|---:|---:|---:|---:|---:|---:|
| `incident-triage` | 1553 | 1553 | 351 | 74.1928% | 77.3986% | 0.8673 | PASS |
| `procurement-award` | 1884 | 1884 | 393 | 75.6462% | 79.1401% | 0.9084 | PASS |
| `release-readiness` | 1392 | 1392 | 459 | 58.7594% | 67.0259% | 0.9740 | PASS |
| `retention-policy` | 1595 | 1595 | 338 | 73.6379% | 78.8088% | 0.7663 | PASS |
| `customer-escalation` | 1522 | 1522 | 337 | 73.5568% | 77.8581% | 0.8456 | PASS |

### 4.5 Limitation discovered in post-run audit

One individual completion did not have perfect exact-string quality:

- task `retention-policy`;
- lane `ecx-selective-oracle`;
- repeat `2/5`;
- quality `1/3` because two returned strings retained sentence-final periods.

The other four selective repeats and all baseline/control repeats for that task were `3/3`, so the predeclared **median quality** gate remained `1.0` and the task formally passed.

Therefore the checkpoint is recorded as **PASS WITH LIMITATIONS**, not “75/75 perfect outputs”. This does not invalidate the task-level gate result or byte/token control relationship, but it limits the quality claim and should inform future harness hardening.

### 4.6 Closed claim boundary

This workstream verifies only that, for these five synthetic local fixtures under the declared median-based gates:

- real ECX transport/hydration worked;
- baseline/control model input remained aligned;
- oracle-selective hydration reduced transported context;
- oracle-selective hydration reduced median model input tokens;
- median task quality remained `1.0`;
- median selective latency stayed inside tolerance;
- measurements were uncached.

It does **not** verify:

- automatic semantic reference selection;
- universal optimizer effectiveness;
- production workload quality;
- hosted-provider billed-cost savings;
- public/general percentage-savings claims.

---

## 5. Current operator-approved execution order

1. **Local persistence/restart drill — ACTIVE NEXT CHECKPOINT**
2. **Local backup/restore drill — PENDING**
3. **Local observability baseline — PENDING**
4. **UX/product validation — PENDING**
5. **Immutable local model identity hardening — PENDING**
6. **Compute-host/VPS + Cloudflare production activation — DEFERRED BY OPERATOR**
7. **Hosted-provider comparative validation — OPTIONAL/FUTURE; credentials + spend intent required**
8. **Automatic selector/optimizer — no automatic start; explicit evidence-driven scope only**
9. **Maintenance/security/dependency/DR evidence — OPEN-ENDED**
10. **New features — evidence-driven only**

Production deployment is not a blocker for current local R&D. It resumes only on an explicit operator decision.

---

## 6. Active next workstream — local persistence/restart evidence

The next scope should be opened explicitly and should not be called Batch 13.

Minimum intended evidence:

1. start from synchronized reviewed `main`;
2. inventory current ECORIONE + Temporal/PostgreSQL runtime state;
3. avoid stopping/pruning unrelated Docker workloads;
4. record baseline identifiers/receipts for Historical Ledger, Context, Artifact and a durable Flow item;
5. restart the relevant ECORIONE service/process/container boundaries in a controlled sequence;
6. verify owner data survives according to each service contract;
7. verify Temporal-backed Flow durability/recovery;
8. identify state that is intentionally ephemeral;
9. run focused health/integrity checks after restart;
10. write sanitized verification evidence before closure.

Architecture/ownership must not change merely to make the drill easier.

---

## 7. Production activation status

Status: **DEFERRED BY OPERATOR DECISION / TOOLING READY**

No VPS, Cloudflare named Tunnel, domain cutover, origin-firewall mutation or hosted-provider spending should be initiated from the current local workstream.

When explicitly resumed, use:

- `docs/production-activation.md`
- `docs/production-operations.md`
- `docs/cloudflare-free-deployment.md`
- `docs/release-operations.md`

Cloudflare remains an external DNS/TLS/tunnel edge; it never owns Hub policy, Connect credentials, databases, Temporal, Artifact or Sandbox.

---

## 8. Persistent architecture/evidence rules

- Historical Ledger and Context L0 remain semantic ground truth; no convenience rewrite.
- No cross-service database access.
- Hub remains policy/approval authority.
- Connect remains provider/credential/MCP owner.
- Artifact owns L3 bytes.
- Memory is untrusted data, never instructions.
- Hosted-derived memory follows quarantine/governed promotion.
- Exact cache must not contaminate paired model-compute comparisons.
- Benchmark cache isolation must hold across separate invocations.
- Exact-match source values should use unambiguous delimiters.
- Median task PASS must not be described as every individual completion PASS if per-run audit says otherwise.
- Model identity must be pinned for durable production claims; `gemma4:latest` is current local runtime evidence only.
- ECX packet/hydration count alone is not a savings metric.
- `ecx-selective-oracle` is not automatic selector evidence.
- Local USD 0 provider-token cost is not hosted billed-cost evidence.
- No public/general savings claim without representative comparable telemetry.
- External MCP public-network acceptance must remain genuinely public-network when relevant.
- Do not weaken CI/security/evidence gates to manufacture closure.
- AutoClick remains deferred until a concrete non-API use case passes architecture review.

---

## 9. Definition of Done for post-closure workstreams

A post-closure workstream may be marked `CLOSED` only after all applicable items are satisfied:

1. dedicated branch/scope;
2. baseline SHA and architecture boundary explicit;
3. relevant implementation complete;
4. deterministic regression tests exist when code changes;
5. real runtime/E2E evidence exists when the claim crosses a runtime boundary;
6. Format PASS;
7. Lint PASS;
8. Typecheck PASS;
9. Test PASS;
10. Secret Scan PASS;
11. Production Build PASS where relevant;
12. architecture/naming/production acceptance gates PASS where relevant;
13. docs/current tracker updated;
14. no temporary helper artifacts remain;
15. exact final branch head verified;
16. PR merge uses expected-head guard when available;
17. `main` points to intended merge;
18. post-merge `main` verification passes;
19. machine/local evidence is rerun on the synchronized merged tree when required;
20. claim boundaries do not exceed measured evidence.

For comparative/model evidence specifically also require explicit cache state, quality measurement, equivalent task/fact/model controls, raw evidence kept local/gitignored, and separate claims for transport/selective hydration/automatic selection/actual provider cost.

---

## 10. Progress update protocol

Every active workstream update should record:

1. current `main` baseline;
2. active branch if any;
3. exact implementation status;
4. bugs/findings discovered;
5. focused verification evidence;
6. exact-head CI/run IDs;
7. PR + merge SHA;
8. post-merge evidence;
9. real runtime evidence where required;
10. remaining blockers and next checkpoint.

Architecture changes require ADR/decision updates. Measurement or operations evidence using existing owner APIs does not automatically constitute an architecture change.

---

## 11. Immediate next action

**Open and execute the local persistence/restart evidence scope from synchronized `main`.** Do not restart/prune unrelated Docker workloads, and do not mutate VPS/Cloudflare state.

Canonical handoff: `docs/current-state-and-next-steps.md`.
