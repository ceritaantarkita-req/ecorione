# ECORIONE — Current State & Next Steps

Last updated: **2026-09-19**

Status: **CURRENT / PE-08 ACTIVE / CLOSURE CANDIDATE**

## Current verdict

The original Batch/W/F6 baseline remains closed. Product Evolution is active.

**PE-00 through PE-07 are CLOSED / PASS. PE-08 Product closure is ACTIVE.**

## Product Evolution status

| Batch | State |
|---|---:|
| PE-00 Architecture lock | **CLOSED / PASS** |
| PE-01 Project foundation | **CLOSED / PASS** |
| PE-02 Project Sources | **CLOSED / PASS** |
| PE-03 Trigger control plane | **CLOSED / PASS** |
| PE-04 Work + Schedule + Runs | **CLOSED / PASS** |
| PE-05 Event/Webhook automation | **CLOSED / PASS** |
| PE-06 Brain V1 | **CLOSED / PASS** |
| PE-07 Brain + Context + ECX | **CLOSED / PASS** |
| PE-08 Product closure | **ACTIVE** |

## PE-02 delivered boundary

- Hub owns Project binding metadata only.
- Artifact sources are authorized through the existing Context/Artifact boundary.
- Space pages are validated in the same Workspace.
- Flow graphs are validated in the same Workspace and may be explicitly reused across Projects.
- outbound MCP servers must be visible to the same Workspace through Connect.
- URL sources are HTTPS references only; no remote content is copied.
- owner deletion/revocation produces an unavailable source state without deleting canonical owner data.
- attach/detach is audited.
- Ai Project detail includes Sources attach/list/detach UI.
- Project A/B and cross-Workspace negative paths are covered.

Acceptance: [product-evolution-pe02-acceptance.md](product-evolution-pe02-acceptance.md).

## PE-02 reviewed evidence

```text
PR #171
implementation head a6167df469cf491015b232aff8a192b32a25c569
CI #1223 PASS
Product Eval #462 PASS
MCP External HTTPS Acceptance #628 PASS
```

PR #171 is merged to `main` as `c734f00eaa791077c99557e6e89579534c43d651`; PE-02 remains CLOSED / PASS.

## PE-03 closed boundary

PE-03 closed on PR #172 exact head `74730e26321cac06c31243baeeafe29d5f4d75f0` and merged as `c739c09014d8aa20ca8e1b83c5b6be39b4ee649c`. Trigger metadata remains Flow-owned, Temporal remains schedule/runtime truth, and Hub remains authority/policy owner. See [verification/pe-03-trigger-control-plane-closure-2026-09-19.md](verification/pe-03-trigger-control-plane-closure-2026-09-19.md).

## PE-04 closed boundary

PE-04 closed on PR #173 after implementation head `c2cacbbcbee15f46ac4c5e9e43c955f5c952af43` and closure head `94936fa0704991d3536667bb8c947e9d751c813e` passed the required gates. It merged as `c08581a00a20dc6016c570a1fbb777d81e391699`. Work now exposes Project-scoped Schedule, Flow links, and an `operationId`-keyed Run read projection without a Task domain or second execution database. See [verification/pe-04-work-schedule-runs-closure-2026-09-19.md](verification/pe-04-work-schedule-runs-closure-2026-09-19.md).

## PE-05 closed boundary

PE-05 closed on PR #174 after implementation head `b3fa55e689548b5a72c47b331682285eb8fb6eb2` and closure head `3d082f555a0c701eb9911d5caa71f7cf250f5710` passed the required gates. It merged as `84defe934bf6b7d0b8868bd04c8c113e70193fc6`. Non-time Trigger delivery now uses Connect-verified webhook ingress, Flow-owned normalization/routing/dedupe, existing Hub authority, Temporal execution, and operationId-keyed Run evidence without a polling daemon, second queue, or second execution authority. See [verification/pe-05-event-webhook-closure-2026-09-19.md](verification/pe-05-event-webhook-closure-2026-09-19.md).

## PE-06 closed boundary

PE-06 closed on PR #176 after implementation head `66c7909572a1410095916843f8f46a385ecb628b` and closure head `25508dd1cef5d8ebb8846448c7732ddde7866a59` passed the required gates. It merged as `d54ad62c303847b23634ba33aead4749f21bf1d0`. Brain now exposes a Project-scoped deterministic projection over Project, Source, Flow, Trigger, and Run owner contracts with authorization-before-disclosure, sibling-Project isolation, rebuildability proof, and no graph database/canonical Brain store. See [verification/pe-06-brain-v1-closure-2026-09-19.md](verification/pe-06-brain-v1-closure-2026-09-19.md).

## PE-07 closed boundary

PE-07 closed on PR #178 after implementation head `892726c20ac95dded26fdc3fd2000ad4bb56363d` and closure head `e443a6e9d10b24b7c1de7bcb315b038cf6425a45` passed the required CI, Product Eval, and MCP gates. It merged as `15e31ed4b03f5be5bc6a7104fc14bb1dd0917743`. The bounded deterministic evidence measured 66.67% median candidate reduction across three fixtures while retaining 100% of required references/provenance and admitting zero unauthorized refs. See [verification/pe-07-brain-context-ecx-closure-2026-09-19.md](verification/pe-07-brain-context-ecx-closure-2026-09-19.md).

## Active: PE-08 Product closure

PE-08 is the final Product Evolution closure batch. Work is active on `pe/pe-08-product-closure-20260919` from main `82026c8a1948336b2da4e00ee4832180f68452f7`. The closure matrix explicitly covers migration/reopen behavior, Project isolation, Source binding persistence, Context policy intersections, Flow/Trigger Project boundaries, owner backup/restore, derived Brain rebuild, UX/navigation/responsive source guards, and Windows installer specification. A new integrated DR test restores Hub + Context + Flow canonical state after deliberate post-backup mutation and rebuilds Brain from the restored owners instead of persisting Brain.

Reviewed implementation head `33f9e891c3152a82304d5f1e31693604c855d94c` passed CI #1469 and Product Eval #708. Product Eval ran 36 files / 148 tests; normal CI ran 191 files PASS + 1 skipped and 991 tests PASS + 2 skipped, plus Phase 4 3/3, production-ops, security/toolchain/container reviews, and production build. PE-08 is now a closure candidate pending exact-head documentation gates and merge.

PE-08 is not a feature expansion batch. Production VPS/Cloudflare, rendered local browser walkthrough, AutoClick, paid hosted evidence, L4 autonomy, graph persistence, and unrelated redesign remain outside scope.

Acceptance: [product-evolution-pe08-acceptance.md](product-evolution-pe08-acceptance.md).

## Deferred

- VPS/Cloudflare activation — deferred by operator;
- AutoClick — deferred by design;
- paid W18 rerun — closed/not authorized.
