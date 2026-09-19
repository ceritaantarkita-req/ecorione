# ECORIONE — Active Work Plan

Last updated: **2026-09-19**

Status: **PE-06 ACTIVE / BRAIN V1**

## Latest closed item

**PE-05 — Event + Webhook automation**

```text
PR #174
reviewed implementation head b3fa55e689548b5a72c47b331682285eb8fb6eb2
closure evidence head 3d082f555a0c701eb9911d5caa71f7cf250f5710
implementation CI 35439232165 PASS
implementation Product Eval 35439232138 PASS
implementation MCP External HTTPS Acceptance 35439232130 PASS
implementation Desktop Installer 35439232123 PASS
closure-head CI 35440554953 PASS
closure-head Product Eval 35440554918 PASS
closure-head MCP External HTTPS Acceptance 35440554867 PASS
closure-head Desktop Installer 35440554959 PASS
merge main 84defe934bf6b7d0b8868bd04c8c113e70193fc6
```

Acceptance: [product-evolution-pe05-acceptance.md](product-evolution-pe05-acceptance.md).  
Closure evidence: [verification/pe-05-event-webhook-closure-2026-09-19.md](verification/pe-05-event-webhook-closure-2026-09-19.md).

## Active item

**PE-06 — Brain V1**

Implementation branch: `pe/pe-06-brain-v1-20260919`, created from synchronized `main` (`ace7ca9f5450c390e104b75e6a2559879b339fa0`).

Architecture decision: [adr/0038-brain-derived-projection.md](adr/0038-brain-derived-projection.md).  
Acceptance: [product-evolution-pe06-acceptance.md](product-evolution-pe06-acceptance.md).

Current boundary:

- Brain is a Project-scoped deterministic relationship projection;
- query canonical owner APIs/contracts only; no cross-service DB reads;
- no graph database and no new Brain source-of-truth;
- start with stable IDs, provenance, Project bindings, Trigger/Flow/Run/operation links, and other deterministic owner facts;
- authorization happens before any node or edge is returned;
- sibling Project node/edge existence must not leak;
- bounded queries/traversal with deterministic ordering;
- canonical owner links remain navigable from Brain;
- projection is disposable/rebuildable without canonical data loss;
- no broad LLM/entity extraction merely to populate Brain;
- Context retrieval and ECX behavior remain unchanged in PE-06;
- PE-07 Brain -> Context -> ECX optimization remains blocked.

Dependency gate:

```text
PE-06  ACTIVE — Brain V1
PE-07  BLOCKED BY PE-06
PE-08  BLOCKED BY PE-07
```

PE-07 remains blocked until PE-06 closes; PE-08 remains blocked until PE-07 closes.

## Non-negotiable boundaries

- no second scheduler/retry database;
- Temporal remains durability/timer/retry owner;
- Trigger never grants authority;
- no always-on LLM polling;
- MAX_AUTONOMY_V1 stays L3;
- Workspace remains the authority boundary;
- VPS/Cloudflare, AutoClick, and paid W18 rerun remain out of scope.
