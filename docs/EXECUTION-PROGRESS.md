# ECORIONE — Execution Progress & Remaining Roadmap

Last updated: **2026-09-12**

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
- isolated local backup/restore including Temporal/PostgreSQL logical restore;
- bounded local observability across owner reads, ECX hydration, uncached local model calls, trace propagation and owner-process resource deltas.

Canonical verification sources:

- `docs/verification/local-production-rehearsal-2026-09-10.md`
- `docs/verification/historical-ledger-ecx-local-evidence-2026-09-11.md`
- `docs/verification/comparative-closure-grade-final-2026-09-11.md`
- `docs/verification/local-persistence-restart-first-drill-2026-09-11.md`
- `docs/verification/local-persistence-restart-closure-2026-09-11.md`
- `docs/verification/local-backup-restore-closure-2026-09-11.md`
- `docs/verification/local-observability-closure-2026-09-12.md`
- `docs/verification/frontend-static-hardening-2026-09-12.md`
- `docs/verification/frontend-static-audit-final-2026-09-12.md`
- `docs/verification/frontend-static-proxy-followup-2026-09-12.md` for the latest UX code-side owner-proxy follow-up; rendered UX closure is still pending.

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

## 7. Local observability baseline — CLOSED / PASS WITH BOUNDED LOCAL LIMITATIONS

Implementation PR #52 merged as:

```text
bbd9c1aeed0c0aaffc39b6f912c35e96b73702b6
```

Real-laptop strict run:

```text
runId: obs-20260912020700-00fbd7e5
owner reads: 8 per lane
ECX samples: 5
local model samples: 5
workload errors: 0
trace coverage: 5/5 Hub→Artifact hydrations
```

Measured model/cache identity:

```text
runtime: openai-compatible
model: gemma4:latest
provider: local
cache hits: 0
cache misses: 5
actual cost USD: 0
hosted calls: disabled
```

Representative client p50/p95 local facts:

```text
Hub read                 5.981 /   26.439 ms
Context read             4.436 /   17.534 ms
Artifact read           12.150 /   62.738 ms
Flow read               11.997 /  142.314 ms
ECX plan                 5.349 /   14.645 ms
ECX hydrate             18.623 /   57.065 ms
Local model           1145.401 / 9109.495 ms
Provider-reported     1138.240 / 9104.578 ms
Client-provider delta    6.711 /    7.161 ms
```

Metric deltas matched the workload: 5 local cache misses, 0 cache hits, 5 ECX plans and 5 ECX hydrations. Bounded before/after Node-process RSS/heap and cumulative CPU deltas were also captured for all eight owner services.

Closed claim: **a small-sample local observability baseline exists and the existing observability contract can attribute representative owner, ECX and local-model work without hosted spend**.

Not closed/proven by this checkpoint:

- production SLA/SLO;
- universal latency distributions;
- peak whole-host/GPU/model-server resource use;
- concurrency/load capacity;
- long-duration stability or leak freedom;
- immutable model identity (`gemma4:latest` remains mutable);
- hosted-provider behavior/cost;
- VPS/Cloudflare behavior.

## 8. Current operator-approved execution order

1. **Local persistence/restart — CLOSED / PASS**
2. **Isolated local backup/restore — CLOSED / PASS WITH EXPLICIT ABSENT-OWNER LIMITATIONS**
3. **Local observability baseline — CLOSED / PASS WITH BOUNDED LOCAL LIMITATIONS**
4. **UX/product validation — IN PROGRESS; STATIC HARDENING COMPLETE / RUNTIME WALKTHROUGH PENDING**
5. **Immutable local model identity hardening — PENDING**
6. **Compute-host/VPS + Cloudflare production activation — DEFERRED BY OPERATOR**
7. **Hosted-provider comparative validation — OPTIONAL/FUTURE**
8. **Automatic selector/optimizer — explicit evidence-driven scope only**
9. **Maintenance/security/dependency/DR evidence — OPEN-ENDED**
10. **New features — evidence-driven only**

Production deployment is not a blocker for current local R&D.

## 9. Active workstream — UX/product validation

This is a new explicit scope, not Batch 13.

Code-side/static hardening includes PR #56, #58, #59, #60 and #62 plus the owner-proxy follow-up in PR #63. Current merged repository-side baseline is `6ea63f570b3e764154837bc2ad7ca2c1123f06bc`; exact-head CI, external MCP acceptance and post-merge CI are green. The proxy follow-up fixed a real Settings MCP workspace-query mismatch and added bounded path/redirect regressions across Ai → owner boundaries.

This remains **code-side evidence only**. The repository-side merge/gate conditions are satisfied, but the operator must still rerun the strict local inventory and real rendered browser walkthrough on synchronized `main` before this workstream can close.

The remaining work now crosses the real browser/runtime boundary and therefore cannot be inferred from static review or CI. It requires:

1. synchronize local `main` to the current merged revision and verify a clean tracked tree;
2. restart Phase 4 from that synchronized code with `ECORIONE_COST_KILL_SWITCH=1`;
3. run `pnpm evidence:ux:inventory` and require PASS, including the Settings MCP workspace proxy contract;
4. exercise representative Local chat first-turn and same-session continuity through the real Ai surface;
5. verify visible memory/routing/cost state and keep Hosted effectively off;
6. walk Space, Flow, Operations and Settings through the real rendered product;
7. check at least desktop and one narrow/mobile viewport;
8. capture browser console errors/warnings and a severity/disposition defect ledger;
9. fix or explicitly bound every observed defect; S0/S1 cannot remain open and S2 must be fixed or explicitly accepted;
10. commit only sanitized closure evidence, then require exact-head CI, intended merge and post-merge verification before closing UX/product validation.

No VPS, Cloudflare, domain, firewall or hosted-provider spending mutation belongs to this workstream.

Canonical protocol: `docs/ux-product-validation.md`. Runtime checklist: `docs/ux-runtime-walkthrough-checklist.md`. Static evidence: `docs/verification/frontend-static-hardening-2026-09-12.md`, `docs/verification/frontend-static-audit-final-2026-09-12.md`, and `docs/verification/frontend-static-proxy-followup-2026-09-12.md`.

## 10. Persistent architecture/evidence rules

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
- Small local observability samples are not production SLA/SLO evidence.
- External MCP public-network acceptance must remain genuinely public-network.
- Do not weaken CI/security/evidence gates to manufacture closure.
- Preserve valid failed evidence.
- Backup/restore evidence must use isolated restore targets and preserve owner boundaries.
- AutoClick remains deferred until a concrete non-API use case passes architecture review.

## 11. Definition of Done for post-closure workstreams

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

## 12. Immediate next action

On the operator laptop, synchronize reviewed `main` to at least the merged PR #63 baseline `6ea63f570b3e764154837bc2ad7ca2c1123f06bc`, restart Phase 4 with the hosted-cost kill switch enabled, run `pnpm evidence:ux:inventory`, then execute `docs/ux-runtime-walkthrough-checklist.md`. Do not mutate VPS/Cloudflare or hosted-provider state.

Canonical handoff: `docs/current-state-and-next-steps.md`.
