# ECORIONE — Current State & Next Steps

Last updated: **2026-09-12**

Status: **CURRENT / canonical handoff for humans and AI agents**

This is the shortest current-state source after the Batch 1–12 implementation closure, real laptop rehearsal, Historical Ledger + ECX evidence, Comparative ECX measurement, local persistence/restart closure, isolated local backup/restore closure, and bounded local observability closure.

Historical plans/audits remain useful evidence but are not the current implementation-status source.

## 1. Current verdict

**ECORIONE production/self-host repository baseline READY; real local runtime + Historical Ledger/ECX evidence CLOSED; final corrected local Comparative ECX checkpoint CLOSED / PASS WITH LIMITATIONS; local persistence/restart CLOSED / PASS; isolated local backup/restore CLOSED / PASS WITH EXPLICIT ABSENT-OWNER LIMITATIONS; local observability baseline CLOSED / PASS WITH BOUNDED LOCAL LIMITATIONS; UX/product validation is IN PROGRESS with repository-side static/frontend + owner-boundary hardening complete and the rendered local walkthrough pending; compute-host/VPS + Cloudflare remains DEFERRED BY OPERATOR.**

Roadmap framing remains:

- Batch 1–12: **12/12 CLOSED**;
- remaining planned batch inside that roadmap: **0**;
- Fase 5 AutoClick: **DEFERRED BY DESIGN**;
- Fase 6+: **OPEN-ENDED / evidence-driven**;
- there is **no implicit Batch 13**.

## 2. Current status table

| Area | Current state | Meaning |
|---|---:|---|
| Defined platform/production implementation roadmap | **12/12 CLOSED** | Planned repository implementation scope is finished. |
| Production/self-host repository baseline | **READY** | Compose/Caddy/release/security baseline exists and repository gates pass. |
| Real laptop rehearsal | **PASS / LOCAL BOUNDARY CLOSED** | Phase 4, Temporal worker, local model path, Ai/browser surfaces and Git synchronization exercised. |
| Historical Ledger + ECX local evidence | **PASS / CLOSED** | Real chronology/hash chain, pointer-first handoff and hydration verified. |
| Comparative ECX | **PASS WITH LIMITATIONS / CLOSED** | 5/5 task gates passed over 75 uncached calls; one individual exact-string punctuation mismatch remains attached to the result. |
| Automatic semantic ref selector | **NOT PROVEN** | `refIndexes` remain caller-supplied; oracle lane is not autonomous selection. |
| Local persistence/restart | **PASS / CLOSED** | Owner processes + Temporal + PostgreSQL container restart boundary passed after path/bootstrap fixes. |
| Isolated local backup/restore | **PASS / CLOSED WITH LIMITATIONS** | Existing durable owner state restored into isolated targets; Temporal/PostgreSQL logical restore verified; absent optional Sync/Connect source state is not claimed as runtime-restored. |
| Local observability baseline | **PASS / CLOSED WITH BOUNDED LOCAL LIMITATIONS** | Representative owner reads, ECX hydration, uncached local-model calls, trace continuity and owner-process resource deltas measured on the tested laptop. |
| UX/product validation | **IN PROGRESS — STATIC HARDENING COMPLETE / RUNTIME WALKTHROUGH PENDING** | Repository-side static/frontend + audited Ai owner-boundary hardening is merged through PR #65 at `f3f5fca3d20ddd35e1a4c4a7fbd6983a33db85ca`; exact-head, public HTTPS and post-merge CI are green, while the real local inventory/browser walkthrough remains required. |
| Immutable local model identity hardening | **PENDING** | Replace mutable rehearsal aliases before durable production model-identity claims. |
| Compute-host/VPS + Cloudflare | **DEFERRED BY OPERATOR** | Resume only on explicit operator decision. |
| Hosted-provider comparative validation | **OPTIONAL/FUTURE** | Requires operator-owned credentials and explicit spend intent. |
| Fase 6+ hardening | **OPEN-ENDED** | Evidence-driven, never permanently closed. |

Do not collapse these into one percentage. `100%` refers only to the defined Batch 1–12 implementation roadmap.

## 3. Key post-closure progression

Important merged progression includes:

- Historical Ledger + ECX local evidence closure PR #37;
- Comparative ECX harness/fixes PR #38–#41;
- persistence harness/gates/readiness PR #43–#45;
- repo-root runtime-path fix PR #46;
- first-drill failure documentation PR #47;
- compiled runtime-dependency bootstrap fix PR #48 (`673af91642ea1b9440079e396675c69f53647951`);
- persistence/restart closure PR #49;
- isolated backup/restore implementation PR #50 → `4e6bcd94776fc7dd75440ee35dd8fddf0b602233`;
- local observability implementation PR #52 → `bbd9c1aeed0c0aaffc39b6f912c35e96b73702b6`;
- UX/frontend hardening continued through PR #56, #58, #59, #60 and #62;
- generic owner-proxy follow-up PR #63 → `6ea63f570b3e764154837bc2ad7ca2c1123f06bc`, fixing the Settings MCP workspace-query mismatch and strengthening Ai → owner proxy path/redirect boundaries;
- canonical UX handoff synchronization PR #64 → `662808f7fb1e2ac76cf0c961b2850b6778801466`;
- dedicated Ai realtime voice SSE owner-boundary follow-up PR #65 → `f3f5fca3d20ddd35e1a4c4a7fbd6983a33db85ca`, closing the remaining audited direct Hub redirect gap and adding deterministic normal/release regression coverage. Exact-head, public HTTPS and post-merge gates are green.

Valid failed evidence remains preserved rather than rewritten away.

## 4. Comparative ECX closure

Canonical protocol/results:

- `docs/comparative-ecx-evidence.md`
- `docs/verification/comparative-closure-grade-final-2026-09-11.md`

Final corrected run:

- 5 tasks × 5 repeats × 3 lanes = 75 measured calls;
- measured cache hits: `0`;
- 5/5 task-level gates PASS;
- median selective transport reduction: `73.6379379246037%`;
- median selective input-token reduction: `77.8580814717477%`;
- median selective/full latency ratio: `0.8672873729681319`.

Limitation that must stay attached: one `retention-policy` `ecx-selective-oracle` repeat scored `1/3` exact fields because two values retained sentence-final periods. The median task gate still passed. Therefore this is **PASS WITH LIMITATIONS**, not “75/75 outputs perfect”.

`ecx-selective-oracle` measures the benefit when relevant references are already known; it does not prove automatic semantic selection. The aggregate percentages are local synthetic benchmark results, not universal/public savings claims.

## 5. Local persistence/restart closure

Canonical docs:

- `docs/local-persistence-restart-evidence.md`
- `docs/verification/local-persistence-restart-first-drill-2026-09-11.md`
- `docs/verification/local-persistence-restart-closure-2026-09-11.md`

The first strict drill found a real defect: relative durable paths reopened under package-local cwd after restart. Temporal-backed Flow survived, while Hub/Context/Artifact/approval reads reopened the wrong storage location.

PR #46 anchored relative runtime paths to repo root. PR #48 ensured compiled workspace runtime dependencies are rebuilt before local dev entrypoints.

A fresh strict baseline on `673af91642ea1b9440079e396675c69f53647951` then survived controlled restart of:

1. Phase 4 process group;
2. exact `ecorione-temporal` container;
3. exact `ecorione-temporal-db` container;
4. while retaining `ecorione_temporal_db`.

Strict post verified exact Ledger, Context, Artifact, Flow and approval identities; cleanup terminalized the probe.

Closed claim: **controlled local owner-storage + process + Temporal-container + PostgreSQL-container restart persistence**.

## 6. Isolated local backup/restore closure

Canonical docs:

- `docs/local-backup-restore-evidence.md`
- `docs/verification/local-backup-restore-closure-2026-09-11.md`

Implementation baseline:

```text
4e6bcd94776fc7dd75440ee35dd8fddf0b602233
```

Real-laptop run ID:

```text
backup-20260911154453-f4ac8743
```

Terminal phase:

```text
restore-verified
```

Runtime backups:

- Context: `backed-up`;
- Hub: `backed-up`;
- RnD: `backed-up`;
- Space: `backed-up`;
- Flow graph registry: `backed-up`;
- Artifact: `backed-up`;
- Sandbox receipts: `backed-up`;
- Sync: `missing` optional source state;
- Connect: `missing` optional source state.

The harness logically dumped and restored both Temporal PostgreSQL databases into a temporary isolated stack:

- `temporal`: 39 restored tables;
- `temporal_visibility`: 3 restored tables.

Through isolated restored owner APIs it re-verified the known closed persistence identities:

- Ledger session `sess_persist_4dea234b52f349608b4f`, `nextSeq=1`, exact head hash;
- Context episode `epi_bc883574927246858c0e9e0e`, expected text;
- Artifact `art_6c60...`, 75 bytes, exact SHA-256;
- Flow `wf_f603...` in expected post-cleanup `FAILED` state;
- approval `op_5114...` in expected `REJECT` state.

Post-run safety check confirmed:

```text
NO_EVIDENCE_CONTAINERS
NO_EVIDENCE_NETWORKS
NO_ISOLATED_LISTENERS
PASS backup/restore inventory: repo, owners, isolated ports and Temporal boundary are ready
```

The active owners remained healthy and the tracked working tree remained clean.

### Backup/restore limitation

This checkpoint does **not** prove:

- off-host/cross-machine DR;
- survival of laptop/disk loss while backup bytes remain on the same laptop;
- encrypted remote backup scheduling;
- runtime restore of absent Sync or Connect durable source state;
- Connect Vault master-key recovery;
- hard power-loss/fsync guarantees;
- arbitrary corruption recovery;
- PITR;
- transactionally atomic cross-owner snapshots;
- VPS/Cloudflare behavior.

Sync/Connect `missing` is intentional evidence honesty: the harness did not seed active durable state merely to manufacture a backup claim.

## 7. Local observability baseline closure

Canonical docs:

- `docs/local-observability-evidence.md`
- `docs/verification/local-observability-closure-2026-09-12.md`

Exact tested merged revision:

```text
bbd9c1aeed0c0aaffc39b6f912c35e96b73702b6
```

Real-laptop run:

```text
runId: obs-20260912020700-00fbd7e5
owner reads: 8 per lane
ECX: 5 samples
local model: 5 measured cache-miss samples
workload errors: 0
ECX Hub→Artifact trace coverage: 5/5
```

Measured local model identity:

```text
runtime: openai-compatible
model: gemma4:latest
hosted calls: disabled
cache hits: 0
cache misses: 5
actual cost USD: 0
```

Representative p50/p95 client latency facts from this small local run:

- Hub read: `5.981 / 26.439 ms`;
- Context read: `4.436 / 17.534 ms`;
- Artifact read: `12.150 / 62.738 ms`;
- Flow read: `11.997 / 142.314 ms`;
- ECX plan: `5.349 / 14.645 ms`;
- ECX hydrate: `18.623 / 57.065 ms`;
- local-model end-to-end: `1145.401 / 9109.495 ms`;
- provider-reported model latency: `1138.240 / 9104.578 ms`;
- client-minus-provider residual: `6.711 / 7.161 ms`.

The harness also captured bounded before/after Node-process RSS/heap and CPU deltas for all eight owner services.

### Observability limitation

This checkpoint establishes only a **bounded laptop baseline**. It does not prove production SLA/SLO, peak host/GPU/resource utilization, concurrency/load capacity, leak freedom, hosted-provider behavior, or VPS/Cloudflare behavior.

`gemma4:latest` remains a mutable alias. Its presence in this measurement proves what runtime identity was reported, not an immutable production model identity.

## 8. Baseline already present

Current platform baseline includes:

- Ai chat with explicit Local/Hosted routing, `/space`, `/ops`, `/settings`;
- Hub orchestration, policy, approval, audit, Historical Ledger, ECX and capability authority;
- Connect local/hosted provider gateway, Vault, spend budget, MCP and runtime settings;
- Context L0–L2 memory + L3 metadata binding;
- Sync relay + MCP HTTPS bridge;
- Artifact CAS;
- Sandbox Tier 0/WASM/hardened Docker boundary;
- Space notes/block runtime;
- Flow durable orchestration using Temporal;
- RnD trace/evaluation + dataset governance;
- multimodal/realtime voice baseline;
- owner-scoped backup/restore primitives and strict isolated local evidence harness;
- production observability surfaces, strict bounded local observability evidence harness, provider canaries, Compose/Caddy, release/upgrade/rollback tooling;
- full-history + Git-boundary secret scanning;
- real public HTTPS MCP acceptance.

## 9. Next execution order

Future work remains a new explicit scope, not Batch 13.

Current operator-approved local-first order:

1. **Local persistence/restart — CLOSED / PASS**
2. **Isolated local backup/restore — CLOSED / PASS WITH EXPLICIT ABSENT-OWNER LIMITATIONS**
3. **Local observability baseline — CLOSED / PASS WITH BOUNDED LOCAL LIMITATIONS**
4. **UX/product validation — IN PROGRESS; STATIC HARDENING COMPLETE / RUNTIME WALKTHROUGH PENDING**
5. **Immutable local model identity hardening — PENDING**
6. **Compute-host/VPS + Cloudflare — DEFERRED BY OPERATOR**
7. **Hosted-provider comparative validation — OPTIONAL/FUTURE**
8. **Automatic selector/optimizer — evidence-driven explicit scope only**
9. **Maintenance/security/dependency/DR evidence — OPEN-ENDED**
10. **New features — evidence-driven only**

Production deployment is not a blocker for current local R&D.

## 10. Active checkpoint — UX/product validation

Repository-side frontend/static hardening is complete through PR #62, followed by generic owner-proxy hardening in PR #63, canonical handoff synchronization in PR #64, and the dedicated realtime voice SSE owner-boundary follow-up in PR #65. The current merged repository-side baseline is `f3f5fca3d20ddd35e1a4c4a7fbd6983a33db85ca`; exact-head CI, external MCP/public HTTPS acceptance, and post-merge CI are green for that baseline. Canonical static evidence is `docs/verification/frontend-static-hardening-2026-09-12.md`, `docs/verification/frontend-static-audit-final-2026-09-12.md`, `docs/verification/frontend-static-proxy-followup-2026-09-12.md`, and `docs/verification/frontend-static-defect-ledger-2026-09-12.md`; the exact laptop/browser procedure is `docs/ux-runtime-walkthrough-checklist.md` under the governing protocol `docs/ux-product-validation.md`.

The repository audit found no remaining known redirect gap in the audited direct Ai API → owner fetches after PR #65: Ops was already fail-closed and the dedicated voice SSE path is now covered. This is a bounded repository-side statement, not a general security certification.

The remaining scope crosses the real browser/runtime boundary. It must validate real user journeys on the already-closed local technical baseline before adding new infrastructure or production deployment work.

Minimum remaining work:

- synchronize clean local `main` to the current merged baseline and restart Phase 4 with `ECORIONE_COST_KILL_SWITCH=1`;
- run `pnpm evidence:ux:inventory`, including the Settings MCP workspace proxy check added after the static follow-up;
- exercise representative Local-mode chat flows through the actual Ai surface rather than service-only probes;
- validate continuity/memory behavior and user-visible state transitions without rewriting Historical Ledger or Context ground truth;
- exercise `/space`, `/flow`, `/ops`, and `/settings` navigation and critical actions that are safe for the local checkpoint;
- validate Local/Hosted routing clarity while keeping hosted calls disabled;
- exercise approval/error/recovery states where existing safe fixtures or local flows make them available;
- check desktop and one narrow/mobile viewport;
- record browser console errors/warnings plus functional defects, confusing UX, missing feedback, broken navigation, stale state, and severity;
- distinguish product/UX defects from performance observations already covered by the observability baseline;
- preserve raw screenshots/logs locally when they contain machine/user-specific detail and commit only sanitized evidence;
- fix or explicitly bound every observed defect before closure; S0/S1 cannot remain open and S2 must be fixed or explicitly accepted.

No VPS/Cloudflare/provider-account mutation belongs to this checkpoint. Realtime voice runtime/browser behavior is not part of the minimum UX-01–UX-12 closure claim unless separately exercised.

## 11. Rules for the next agent

Before implementing new work:

- start from synchronized reviewed `main`;
- read this file first, then `AGENTS.md`;
- preserve owner-service boundaries;
- do not rewrite Historical Ledger or Context L0 ground truth;
- keep Hub as policy/approval authority and Connect as provider/credential/MCP owner;
- do not weaken CI/security/evidence gates to manufacture PASS;
- preserve valid historical failures;
- keep backup/restore evidence isolated from active owner state;
- benchmark cache namespaces must remain isolated across invocations;
- do not represent fixture-declared `refIndexes` as an autonomous optimizer;
- do not convert local benchmark percentages into universal/public savings claims;
- do not convert the small observability sample into a production SLA/SLO;
- keep the mutable local model alias limitation attached until immutable identity hardening is explicitly completed;
- create/update ADRs only when architecture/ownership/authority/invariants change;
- keep VPS/Cloudflare deferred until explicit operator instruction.

## 12. Recommended reading order

1. `docs/current-state-and-next-steps.md`
2. `AGENTS.md`
3. `docs/ux-product-validation.md`
4. `docs/ux-runtime-walkthrough-checklist.md`
5. `docs/verification/frontend-static-defect-ledger-2026-09-12.md`
6. `docs/verification/frontend-static-proxy-followup-2026-09-12.md`
7. `docs/verification/frontend-static-audit-final-2026-09-12.md`
8. `docs/verification/frontend-static-hardening-2026-09-12.md`
9. `docs/verification/local-observability-closure-2026-09-12.md`
10. `docs/local-observability-evidence.md`
11. `docs/verification/local-backup-restore-closure-2026-09-11.md`
12. `docs/local-backup-restore-evidence.md`
13. `docs/verification/local-persistence-restart-closure-2026-09-11.md`
14. `docs/local-persistence-restart-evidence.md`
15. `docs/verification/local-persistence-restart-first-drill-2026-09-11.md`
16. `docs/verification/comparative-closure-grade-final-2026-09-11.md`
17. `docs/comparative-ecx-evidence.md`
18. `docs/verification/historical-ledger-ecx-local-evidence-2026-09-11.md`
19. `docs/verification/local-production-rehearsal-2026-09-10.md`
20. `docs/EXECUTION-PROGRESS.md`
21. relevant operations/ADR docs
22. `docs/prd.md`, `docs/research.md`, `docs/blueprint.md` for rationale/history

## 13. Canonical references

- current handoff: `docs/current-state-and-next-steps.md`
- current repository-side UX/static baseline: PR #65 / `f3f5fca3d20ddd35e1a4c4a7fbd6983a33db85ca`
- UX runtime protocol: `docs/ux-product-validation.md`
- UX laptop/browser checklist: `docs/ux-runtime-walkthrough-checklist.md`
- UX static S0–S3 ledger: `docs/verification/frontend-static-defect-ledger-2026-09-12.md`
- UX generic owner-proxy follow-up: `docs/verification/frontend-static-proxy-followup-2026-09-12.md`
- UX final static audit: `docs/verification/frontend-static-audit-final-2026-09-12.md`
- UX static hardening baseline evidence: `docs/verification/frontend-static-hardening-2026-09-12.md`
- next-checkpoint design only: `docs/immutable-local-model-identity-plan.md`
- observability closure: `docs/verification/local-observability-closure-2026-09-12.md`
- observability protocol: `docs/local-observability-evidence.md`
- backup/restore closure: `docs/verification/local-backup-restore-closure-2026-09-11.md`
- persistence closure: `docs/verification/local-persistence-restart-closure-2026-09-11.md`
- Comparative ECX final evidence: `docs/verification/comparative-closure-grade-final-2026-09-11.md`
- detailed tracker: `docs/EXECUTION-PROGRESS.md`
