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
- local persistence harness PR #43: `47ebb8b5430396dc2968445dfb56998f98e009b3`
- strict persistence gate PR #44: `3319f140379c455446bade50c80aadcca5b0ecc7`
- persistence readiness docs PR #45: `0a5e585d53e01d819027c602a2ac69f7dc130723`
- repo-root runtime-path fix PR #46: `778e7eb19a0e2f528c64e68459d8ff6e6ecbe1ce`
- first persistence-drill failure documentation PR #47: historical finding preserved
- compiled local runtime-dependency bootstrap fix PR #48: `673af91642ea1b9440079e396675c69f53647951`

Closed local evidence now includes:

- real Phase 4 process stack + Temporal worker `RUNNING`;
- WSL→Windows Ollama loopback path;
- real Connect→Ollama→Gemma local calls;
- real browser Local chat;
- browser session identity equal to actual `LOCAL_ONLY` Historical Ledger session;
- real Ledger chronology/hash chain;
- real ECX pointer-first plan + `agent.handoff` + hydration;
- `pnpm production:data-evidence` PASS;
- strict local persistence/restart PASS across the tested owner-process + Temporal + PostgreSQL-container boundary.

Verification sources:

- `docs/verification/local-production-rehearsal-2026-09-10.md`
- `docs/verification/historical-ledger-ecx-local-evidence-2026-09-11.md`
- `docs/verification/local-persistence-restart-first-drill-2026-09-11.md`
- `docs/verification/local-persistence-restart-closure-2026-09-11.md`

---

## 4. Comparative ECX efficiency evidence — CLOSED / PASS WITH LIMITATIONS

Status: **CLOSED / PASS WITH LIMITATIONS — LOCAL SYNTHETIC CHECKPOINT**

Canonical protocol/results:

- `docs/comparative-ecx-evidence.md`
- `docs/verification/comparative-closure-grade-final-2026-09-11.md`

Historical findings retained:

- `docs/verification/comparative-smoke-cache-defect-2026-09-11.md`
- `docs/verification/comparative-closure-grade-first-run-2026-09-11.md`

### 4.1 Experiment lanes

1. `full-inline` — all fixture documents inline to the same local model.
2. `ecx-all` — real Artifact pointers + ECX plan + all refs hydrated.
3. `ecx-selective-oracle` — same packet with only fixture-declared relevant refs hydrated.

**Critical boundary:** current `/v1/exchange/hydrate` receives `refIndexes` from the caller. ECORIONE does not yet have a verified autonomous semantic reference selector.

### 4.2 Final corrected 75-call run

Runtime revision:

`4d5ee560a3b6cef024b0d7ed7bbec53a17f32675`

Run shape:

- 5 tasks;
- 5 repeats;
- 3 lanes;
- 75 measured model calls;
- all measured cache hits: `0`;
- 5/5 task gates PASS.

Aggregate:

- median selective transport reduction: `73.6379379246037%`;
- median selective input-token reduction: `77.8580814717477%`;
- median selective/full latency ratio: `0.8672873729681319`.

One `retention-policy` `ecx-selective-oracle` repeat scored `1/3` exact fields because two strings retained sentence-final periods. The other four selective repeats and all baseline/control repeats for that task scored `3/3`, so the predeclared median task quality gate remained `1.0`.

Therefore the checkpoint remains **PASS WITH LIMITATIONS**, not “75/75 perfect outputs”. The percentages are benchmark-specific and are not universal/public savings claims.

---

## 5. Local persistence/restart evidence — CLOSED / PASS

Status: **CLOSED / PASS — REAL LOCAL PROCESS + TEMPORAL + POSTGRESQL-CONTAINER RESTART BOUNDARY**

Canonical docs:

- `docs/local-persistence-restart-evidence.md`
- `docs/verification/local-persistence-restart-closure-2026-09-11.md`

Historical valid failure:

- `docs/verification/local-persistence-restart-first-drill-2026-09-11.md`

### 5.1 First drill — valid failure

The first strict baseline passed on `0a5e585d53e01d819027c602a2ac69f7dc130723`. After controlled Phase 4 + Temporal + PostgreSQL restart, strict post failed because Hub Ledger returned 404; Context, Artifact and Hub approval also returned 404 while the same Temporal-backed Flow remained `RUNNING`.

Diagnosis showed restarted owner services resolving relative values such as `./data/hub.db` from package-local cwd, opening `services/<service>/data/...` rather than repository-root `data/...`.

This remained a valid failed persistence attempt; no gate was weakened.

### 5.2 Path/bootstrap fixes

PR #46 fixed the durable local path contract by anchoring relative runtime filesystem paths to the ECORIONE repository root while preserving absolute production paths.

A subsequent restart exposed stale compiled workspace `dist` after source updates. PR #48 added `build:runtime-deps` before local dev entrypoints and deterministic regression coverage.

After both fixes, runtime file-descriptor inspection confirmed Hub, Context and Flow opened repository-root durable files even though their process cwd values remained service-local.

### 5.3 Recovery of the historical first probe

Before creating the second baseline, the preserved first-drill state was re-read through owner APIs:

- Ledger: 200 with original head hash;
- Context: 200 with original episode identity/content;
- Artifact: 200 with original SHA-256;
- Flow: 200 / `RUNNING`;
- Hub approval: 200 / `PENDING` with original operation identity.

That recovery confirmed wrong-path reopening rather than data deletion/corruption. The old dedicated Flow was then cleaned up and reached terminal state.

### 5.4 Fresh second strict baseline

A fresh strict baseline passed on merged revision:

`673af91642ea1b9440079e396675c69f53647951`

The probe recorded exact Ledger hash identity, Context digest, Artifact digest, Flow identity and pending Hub approval operation identity.

### 5.5 Successful controlled restart

Only the reviewed ECORIONE boundary was stopped:

1. Phase 4 process group;
2. exact `ecorione-temporal`;
3. exact `ecorione-temporal-db`.

`ecorione_temporal_db` remained present. No unrelated Docker workload was stopped/pruned and no owner database/Artifact/volume was deleted.

Dependency-safe restart order was PostgreSQL → Temporal → `pnpm dev:phase4`. Required owner services returned healthy and the Flow worker returned `RUNNING`.

### 5.6 Strict post + cleanup

Strict post passed with:

- Ledger same event/head hash and `nextSeq=1`;
- Context same episode ID/SHA;
- Artifact same ID/SHA;
- same Flow ID still `RUNNING`;
- same Hub approval still `PENDING` with same operation identity.

Strict cleanup then terminalized the dedicated probe (`FAILED`) and both cleanup gates passed.

### 5.7 Closed claim boundary

Verified:

> local owner storage + Phase 4 process restart + Temporal-container restart + PostgreSQL-container restart persistence on the real laptop boundary.

Not verified by this checkpoint:

- backup/restore correctness;
- off-host disaster recovery;
- host-loss recovery;
- hard power-loss/fsync semantics beyond controlled stop/start;
- arbitrary corruption recovery;
- VPS/Cloudflare durability;
- hosted-provider behavior.

---

## 6. Current operator-approved execution order

1. **Local persistence/restart drill — CLOSED / PASS**
2. **Isolated local backup/restore drill — ACTIVE NEXT CHECKPOINT**
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

## 7. Active next workstream — isolated local backup/restore evidence

The next scope is explicit and is not Batch 13.

Minimum intended evidence:

1. start from synchronized reviewed `main`;
2. inventory existing owner-scoped backup/restore tooling and current durable paths;
3. keep active runtime state untouched until backup inputs/outputs are explicit;
4. produce owner backup receipts/digests using existing supported contracts/tooling;
5. keep Hub, Context, Artifact, Flow/Temporal/PostgreSQL ownership semantics separate;
6. restore only into isolated targets, never directly overwrite active owner state during the drill;
7. verify restored byte/database integrity and expected identities;
8. where service-level restore startup is required, bind isolated paths/ports and prove owner API readability without colliding with the active runtime;
9. distinguish backup correctness from off-host DR/failure-domain claims;
10. preserve raw evidence locally/gitignored and commit only sanitized closure evidence.

Architecture/ownership must not change merely to make the drill easier.

---

## 8. Production activation status

Status: **DEFERRED BY OPERATOR DECISION / TOOLING READY**

No VPS, Cloudflare named Tunnel, domain cutover, origin-firewall mutation or hosted-provider spending should be initiated from the current local workstream.

When explicitly resumed, use:

- `docs/production-activation.md`
- `docs/production-operations.md`
- `docs/cloudflare-free-deployment.md`
- `docs/release-operations.md`

Cloudflare remains an external DNS/TLS/tunnel edge; it never owns Hub policy, Connect credentials, databases, Temporal, Artifact or Sandbox.

---

## 9. Persistent architecture/evidence rules

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
- Preserve valid failed evidence rather than rewriting history after a fix.
- Backup/restore evidence must use isolated restore targets and must not overwrite active durable state merely to make the drill convenient.
- AutoClick remains deferred until a concrete non-API use case passes architecture review.

---

## 10. Definition of Done for post-closure workstreams

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

For backup/restore evidence specifically also require explicit source snapshot identity, backup receipt/digest, isolated restore target, restore verification and a statement of whether the backup leaves the original failure domain.

---

## 11. Progress update protocol

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

## 12. Immediate next action

**Open and execute the isolated local backup/restore evidence scope from synchronized reviewed `main`.** Restore into isolated targets, preserve owner boundaries, do not overwrite active durable state, do not restart/prune unrelated Docker workloads, and do not mutate VPS/Cloudflare state.

Canonical handoff: `docs/current-state-and-next-steps.md`.
