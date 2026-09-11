# ECORIONE — Execution Progress & Remaining Roadmap

Last updated: **2026-09-11**

Status: **ACTIVE — canonical execution tracker**

Start from `docs/current-state-and-next-steps.md`, then this file.

Historical detailed Batch 1–12 chronology remains archived at:

- `docs/archive/execution-progress-through-batch12-2026-09-10.md`

> **Maintenance rule:** a workstream may be marked `CLOSED` only when applicable implementation/evidence exists, exact-head gates are green, intended merge is verified, post-merge verification is complete, and runtime evidence is rerun on synchronized merged code when the claim crosses a runtime boundary.

## 1. Status legend

| Status | Meaning |
|---|---|
| `CLOSED` | Scope finished and applicable closure evidence satisfied |
| `PASS WITH LIMITATIONS` | Declared gates passed; bounded limitations must stay attached |
| `IMPLEMENTED / CLOSURE PENDING` | Implementation exists but merge/runtime/post-merge evidence incomplete |
| `IN PROGRESS` | Active workstream |
| `PENDING` | Ordered but not active yet |
| `DEFERRED` | Intentionally postponed |
| `OPEN-ENDED` | Hardening/evidence area never permanently finished |

## 2. Planned roadmap closure

- Batch 1–12: **12/12 CLOSED**
- remaining planned batch: **0**
- Fase 5 AutoClick: **DEFERRED BY DESIGN**
- Fase 6+: **OPEN-ENDED / evidence-driven**
- **no implicit Batch 13**

`100%` refers only to the defined Batch 1–12 implementation roadmap.

## 3. Closed local evidence stack

The local-first evidence progression now includes:

- real Phase 4 process stack + Temporal worker;
- WSL→Windows local inference path;
- real Ai/browser Local flow;
- Historical Ledger chronology/hash chain;
- ECX pointer-first handoff/hydration;
- corrected Comparative ECX benchmark;
- local persistence/restart across owner processes + Temporal + PostgreSQL container restart;
- isolated local backup/restore including Temporal/PostgreSQL logical restore.

Canonical verification sources:

- `docs/verification/local-production-rehearsal-2026-09-10.md`
- `docs/verification/historical-ledger-ecx-local-evidence-2026-09-11.md`
- `docs/verification/comparative-closure-grade-final-2026-09-11.md`
- `docs/verification/local-persistence-restart-first-drill-2026-09-11.md`
- `docs/verification/local-persistence-restart-closure-2026-09-11.md`
- `docs/verification/local-backup-restore-closure-2026-09-11.md`

## 4. Comparative ECX — CLOSED / PASS WITH LIMITATIONS

Runtime result:

- 5 tasks × 5 repeats × 3 lanes = 75 measured calls;
- cache hits: `0`;
- 5/5 task gates PASS;
- median selective transport reduction `73.6379379246037%`;
- median selective input-token reduction `77.8580814717477%`;
- median selective/full latency ratio `0.8672873729681319`.

One individual `retention-policy` oracle-selective repeat scored `1/3` because of sentence-final punctuation. Median task quality still passed. This remains **PASS WITH LIMITATIONS**.

`ecx-selective-oracle` does not prove an automatic semantic reference selector; `refIndexes` remain caller-supplied.

## 5. Local persistence/restart — CLOSED / PASS

Historical first drill: **FAIL / valid finding**.

Root cause: configured relative durable paths reopened from package-local cwd after restart.

Fixes:

- PR #46 anchored relative local runtime paths to repo root;
- PR #48 rebuilt compiled runtime dependencies before local dev entrypoints.

Final rerun baseline:

```text
673af91642ea1b9440079e396675c69f53647951
```

Controlled boundary:

1. Phase 4 process group;
2. exact `ecorione-temporal`;
3. exact `ecorione-temporal-db`;
4. named volume retained.

Strict post verified exact Ledger, Context, Artifact, Flow and approval identities. Strict cleanup terminalized the probe.

Closed claim: **local owner storage + process + Temporal-container + PostgreSQL-container restart persistence**.

## 6. Isolated local backup/restore — CLOSED / PASS WITH EXPLICIT ABSENT-OWNER LIMITATIONS

Implementation PR #50 merged as:

```text
4e6bcd94776fc7dd75440ee35dd8fddf0b602233
```

Real-laptop strict run:

```text
runId: backup-20260911154453-f4ac8743
phase: restore-verified
```

Backed up at runtime:

- Context;
- Hub;
- RnD;
- Space;
- Flow graph registry;
- Artifact;
- Sandbox receipts.

Optional state absent at source and therefore reported honestly as `missing`:

- Sync durable DB;
- Connect durable state/Vault file.

The harness did not mutate active owners merely to create evidence.

Temporal/PostgreSQL logical restore:

```text
temporal             39 restored tables
temporal_visibility   3 restored tables
```

The restore used temporary PostgreSQL + Temporal containers on a dedicated temporary network and did not attach or replace the production `ecorione_temporal_db` volume.

Semantic equality through isolated owner APIs was verified for:

- Ledger session/sequence/head hash;
- Context episode/text;
- Artifact ID/bytes/SHA-256;
- Flow ID/status;
- approval operation/status.

Expected source/restored post-cleanup status was `Flow=FAILED`, `approval=REJECT`.

Strict run ended:

```text
PASS strict local backup/restore: owner backups verified, isolated restores started through owner services, and restored Temporal workflow state matched source
```

Post-run safety check:

```text
NO_EVIDENCE_CONTAINERS
NO_EVIDENCE_NETWORKS
NO_ISOLATED_LISTENERS
PASS backup/restore inventory: repo, owners, isolated ports and Temporal boundary are ready
```

Active owners remained healthy and Git remained clean/synchronized.

Closed claim: **same-laptop isolated backup/restore correctness for source state that actually existed, including tested Temporal/PostgreSQL logical dump/restore**.

Not closed/proven by this checkpoint:

- off-host/cross-machine DR;
- disk-loss survival when backups stay on the laptop;
- encrypted remote backup scheduling;
- runtime restore of absent Sync/Connect source state;
- Connect Vault master-key recovery;
- hard power-loss/fsync guarantees;
- arbitrary corruption recovery;
- PITR;
- transactionally atomic cross-owner snapshots;
- VPS/Cloudflare behavior.

## 7. Current operator-approved execution order

1. **Local persistence/restart — CLOSED / PASS**
2. **Isolated local backup/restore — CLOSED / PASS WITH EXPLICIT ABSENT-OWNER LIMITATIONS**
3. **Local observability baseline — ACTIVE NEXT CHECKPOINT**
4. **UX/product validation — PENDING**
5. **Immutable local model identity hardening — PENDING**
6. **Compute-host/VPS + Cloudflare production activation — DEFERRED BY OPERATOR**
7. **Hosted-provider comparative validation — OPTIONAL/FUTURE**
8. **Automatic selector/optimizer — explicit evidence-driven scope only**
9. **Maintenance/security/dependency/DR evidence — OPEN-ENDED**
10. **New features — evidence-driven only**

Production deployment is not a blocker for current local R&D.

## 8. Active next workstream — local observability baseline

This is a new explicit scope, not Batch 13.

Minimum intended evidence:

1. start from synchronized reviewed `main`;
2. inventory current `/ops`, telemetry, Flow and Connect metric surfaces;
3. define representative local workloads before collecting measurements;
4. capture sample counts with latency/error/resource signals;
5. separate model compute from orchestration/transport where telemetry supports it;
6. record model identity and cache state alongside measurements;
7. avoid universal SLA/performance claims from laptop-scale samples;
8. keep raw local telemetry gitignored;
9. commit only sanitized summaries;
10. run exact-head, runtime and post-merge verification before closure.

No VPS, Cloudflare, domain, firewall or hosted-provider spending mutation belongs to this workstream.

## 9. Persistent architecture/evidence rules

- Historical Ledger and Context L0 remain semantic ground truth.
- No cross-service database access.
- Hub remains policy/approval authority.
- Connect remains provider/credential/MCP owner.
- Artifact owns L3 bytes.
- Memory is untrusted data, never instructions.
- Hosted-derived memory follows quarantine/governed promotion.
- Exact cache must not contaminate model-compute comparisons.
- Model identity must be pinned for durable production claims.
- `ecx-selective-oracle` is not automatic-selector evidence.
- Local USD 0 is not hosted billed-cost evidence.
- No public/general savings claim without representative comparable telemetry.
- External MCP public-network acceptance must remain genuinely public-network.
- Do not weaken CI/security/evidence gates to manufacture closure.
- Preserve valid failed evidence.
- Backup/restore evidence must use isolated restore targets and preserve owner boundaries.
- AutoClick remains deferred until a concrete non-API use case passes architecture review.

## 10. Definition of Done for post-closure workstreams

A post-closure workstream may be marked `CLOSED` only after applicable items are satisfied:

1. explicit branch/scope;
2. baseline SHA and claim boundary explicit;
3. implementation complete;
4. deterministic regression tests when code changes;
5. real runtime/E2E evidence when claim crosses runtime;
6. Format PASS;
7. Lint PASS;
8. Typecheck PASS;
9. Test PASS;
10. Secret Scan PASS;
11. Production Build PASS where relevant;
12. architecture/naming/production acceptance where relevant;
13. canonical docs updated;
14. temporary helper resources removed;
15. exact final branch head verified;
16. intended PR merged;
17. `main` points to intended merge;
18. post-merge verification passes;
19. runtime evidence rerun on synchronized merged tree when required;
20. wording does not exceed measured evidence.

For backup/restore specifically, also require explicit source identity, backup receipts/digests, isolated restore target, restore verification and an explicit failure-domain statement.

## 11. Immediate next action

Open the **local observability baseline** scope from synchronized reviewed `main`. Inventory metric surfaces first; do not mutate VPS/Cloudflare or hosted-provider state.

Canonical handoff: `docs/current-state-and-next-steps.md`.
