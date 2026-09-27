# Repository Truth Reconciliation — 2026-09-27

Status: **CLOSED / PASS — CURRENT DOC LAYER RECONCILED / POST-ECX BRANCH CLEANUP READY-PENDING-DELETION**

## Purpose

Reconcile ECORIONE's current/canonical documentation and post-ECX Git branch inventory with the repository and staging state that actually exists after ECX Recipient Execution Batch 1–7.

This is not Batch 8, PE-09, PCS-11, Batch 13, a new A-series feature, DR-2 runtime work, or production cutover.

## Final reconciliation delivery

Canonical documentation PR:

```text
PR                    = #378
reviewed head          = 6601644cb32a4b75d09957eb1e8f289c52b438a5
exact-head CI          = #2353 / run 36335547946 — PASS
exact-head Product Eval= #1592 / run 36335548005 — PASS
merge                  = 5b43ab8494c2104ca4e325843e33554d8ed3f1f1
merged-main CI         = #2354 / run 36335782557 — PASS
merged-main Product Eval = #1593 / run 36335782544 — PASS
```

Governed staging delivery after merge:

```text
Staging Deploy #1478 / run 36335841204 — gate PASS, deploy skipped
Staging Deploy #1479 / run 36335964138 — gate PASS, deploy PASS
deployed SHA = 5b43ab8494c2104ca4e325843e33554d8ed3f1f1
image        = staging-5b43ab8494c2
```

Runtime evidence from #1479:

- MCP protected-resource metadata PASS;
- MCP unauthenticated challenge PASS;
- Operations `healthy: true`;
- unhealthy services: none;
- expected host SHA matched;
- configured services: 15;
- running services: 15;
- non-running services: none;
- pre-cleanup available disk: 23.87 GiB;
- final stabilized free disk: **29.87 GiB**;
- final staging deploy verdict: PASS.

The reconciliation changed documentation only; application/service/package runtime ownership and behavior were not changed.

Post-merge remote branch inventory is **25 branches** because GitHub retains merged branches by repository policy and the reconciliation branch itself remains present.

The 15 pre-reconciliation ECX cleanup candidates were revalidated after merge against live remote refs:

```text
checked        = 15
exact matches  = 15
moved/missing  = 0
deleted        = 0
```

Therefore the cleanup allowlist remains valid, but deletion is still pending. Do not claim branch cleanup complete until the exact-SHA delete operation actually executes.

## Audited repository identity

Before this reconciliation branch was created:

```text
repository                    = ceritaantarkita-req/ecorione
default branch                = main
audited main                  = 2c2e3c8ad1b4a961251d57ff1e0a7d8f2414e370
open pull requests            = 0
open issues                   = 1 (#277 DR-2)
remote branches               = 24
tracked files                 = 1,011
docs files                    = 269
docs/verification files       = 161
```

The previous branch-hygiene checkpoint remains historically correct for its execution time: it ended at 9 remote branches. Fifteen ECX implementation/closure branches were created after that checkpoint, so the old 9-branch inventory must not be presented as current repository state.

## Current runtime/staging truth

The final Batch 7 closure merge is current repository `main`:

```text
main = 2c2e3c8ad1b4a961251d57ff1e0a7d8f2414e370
```

Post-merge gates:

```text
CI            #2352 / run 36332919084 — PASS
Product Eval  #1591 / run 36332919111 — PASS
```

Actual governed staging delivery:

```text
Staging Deploy #1474 / run 36332973603 — gate-only PASS
Staging Deploy #1475 / run 36333137433 — actual deploy PASS
deployed SHA = 2c2e3c8ad1b4a961251d57ff1e0a7d8f2414e370
image        = staging-2c2e3c8ad1b4
```

Runtime evidence from #1475:

- public/auth bootstrap PASS;
- protected application boundaries PASS;
- MCP protected-resource metadata PASS;
- MCP unauthenticated challenge PASS;
- Operations `healthy: true`;
- unhealthy services: none;
- expected SHA matched the host SHA;
- configured services: 15;
- running services: 15;
- non-running services: none;
- final stabilized free disk: **26.31 GiB**.

Therefore GitHub `main` and governed SumoPod staging are converged on the same exact revision at this audit boundary.

## ECX implementation truth

ECX Recipient Execution Batch 1–7 is **CLOSED / PASS** at the documented boundaries.

The current code contains the actual Batch 7 fan-out runtime, not only documentation:

- `POST /v1/exchange/fanout-round-trip`;
- bounded 2–8 recipient `delta` fan-out;
- child execution through the existing recipient primitive;
- `agent.result.receive` authority;
- 65,536-byte per-child returned-result bound;
- 131,072-byte aggregate bound;
- aggregate SHA-256 evidence;
- durable `ecx_fanout_receipts`;
- deterministic one-parent continuation;
- bounded Historical Ledger aggregate provenance.

Batch 6 Historical Ledger compaction/archive semantics are also present in current runtime and tests.

Canonical ECX checkpoint:
[ecx-execution-b7-safe-checkpoint-2026-09-27.md](ecx-execution-b7-safe-checkpoint-2026-09-27.md).

No Batch 8 is implicitly opened.

## Documentation finding

The runtime implementation and verification evidence are materially healthier than the current-document layer.

Observed drift before reconciliation:

- root `README.md` still described the intermediate branch-hygiene state with 39 cleanup-ready branches;
- `AGENTS.md` carried the same stale branch snapshot and did not expose ECX Batch 1–7 as the latest compatibility baseline;
- `docs/README.md` still pointed to A-11 as the latest safe product/audit checkpoint;
- `current-state-and-next-steps.md` and `active-work-plan.md` mixed current truth with hundreds of lines of historical closure narrative;
- `EXECUTION-PROGRESS.md` still presented the historical 9-branch inventory as if it were current;
- dated verification/WIP files themselves are intentionally historical and generally already carry supersession markers.

The correction policy is therefore: **simplify the current layer; preserve historical evidence**.

## Post-ECX branch delta

The 15 pre-reconciliation ECX branches are classified as bounded safe-delete candidates in:

[post-ecx-branch-cleanup-allowlist-2026-09-27.json](post-ecx-branch-cleanup-allowlist-2026-09-27.json)

The classification includes:

- merged implementation/closure PR heads;
- one closed-unmerged Batch 5 alternate branch superseded by canonical PR #371;
- one Batch 4 closure branch with no unique content beyond current main;
- one Batch 6 implementation branch whose only post-PR delta is an intentionally excluded prettier diagnostic commit that would force `format:check` to fail.

Deletion is **not claimed by this document**. The existing cleanup script must still exact-SHA revalidate each remote ref before deletion:

```powershell
./scripts/cleanup-merged-branches.ps1 \
  -AllowlistPath docs/verification/post-ecx-branch-cleanup-allowlist-2026-09-27.json
```

Then, only after reviewing the dry-run:

```powershell
./scripts/cleanup-merged-branches.ps1 \
  -AllowlistPath docs/verification/post-ecx-branch-cleanup-allowlist-2026-09-27.json \
  -Apply
```

The reconciliation branch itself is not part of that 15-branch pre-audit delta and should be cleaned separately after merge when tooling is available.

## Current documentation model

After this reconciliation, current truth should be read in this order:

1. current code + tests;
2. `docs/current-state-and-next-steps.md`;
3. `docs/active-work-plan.md`;
4. `AGENTS.md`;
5. accepted ADRs and owner runbooks;
6. `docs/EXECUTION-PROGRESS.md`;
7. dated verification/evidence;
8. archive.

Historical verification is evidence, not an active queue. Historical statements such as “Batch 7 NEXT / NOT STARTED” remain valid only inside the dated checkpoint where they were true.

## Explicit current deferred/separate scopes

No active implementation scope is opened by this reconciliation.

Still separate/deferred unless explicitly authorized:

- DR-2 checkpoint 2 external-target selection and physical-independence proof;
- public production promotion/cutover;
- native Google Drive integration;
- broader Workspace registry / multi-user identity / final RBAC;
- hosted-provider paid reruns / W18 freshness work;
- external A2A interoperability;
- arbitrary recursive agent graphs;
- Flow/Temporal long-running ECX fan-out orchestration;
- `full` multi-recipient merge semantics;
- broad ECX/History UI;
- automatic destructive Historical Ledger purge scheduling;
- AutoClick / L4 autonomy.

## Non-goals

This reconciliation does not:

- modify runtime code;
- change service ownership;
- alter database schemas;
- rerun paid providers;
- reinterpret old failed evidence;
- delete or rewrite historical verification records merely because they contain old state;
- claim branch deletion before exact-SHA cleanup actually executes;
- promote staging to production.

## Resume rule

Future agents should start from the current-state files, then inspect exact current `main`.

Do not restart ECX Batches 1–7, A-00..A-11, PE-00..PE-08, PCS-00..PCS-10, original Off-host DR, or the original 393-branch hygiene classification unless a new reproducible regression or explicitly authorized boundary requires it.
