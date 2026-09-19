# PE-05 Event/Webhook automation closure evidence

Last updated: **2026-09-19**

Status: **CLOSURE CANDIDATE / IMPLEMENTATION GATES PASS**

## Reviewed implementation

```text
PR                              #174
branch                          pe/pe-05-event-webhook-automation-20260919
reviewed implementation head    b3fa55e689548b5a72c47b331682285eb8fb6eb2
CI workflow run                 35439232165 PASS
Product Eval workflow run       35439232138 PASS
MCP External HTTPS workflow run 35439232130 PASS
Desktop Installer workflow run  35439232123 PASS
```

The reviewed implementation head passed the required exact-head repository gates before this closure record was added.

## Delivered boundary

PE-05 activates non-time Trigger delivery without introducing a new scheduler, queue, polling daemon, or execution authority.

Delivered:

- `event` and `webhook` Trigger kinds are active; `manual` and `time` behavior remains intact;
- `condition` remains reserved/inactive;
- normalized event envelope with explicit Workspace/Project, source/kind selector, timestamps, stable dedupe identity, bounded payload, and bounded metadata;
- Flow-owned Trigger matching, pinned Flow validation, Project routing, Hub policy evaluation, deterministic operation/workflow identity, and bounded restart-safe delivery receipts;
- Connect-owned generic webhook ingress with root secret in Connect Vault and deterministic per-hook derived token;
- public webhook callers cannot choose Workspace, Project, Flow, version, or autonomy;
- missing/wrong webhook token fails before Flow forwarding;
- public and internal event ingress have explicit HTTP body ceilings;
- duplicate delivery resolves to the same logical dispatch;
- conflicting reuse of the same dedupe identity fails closed;
- `PENDING -> STARTED` delivery state allows restart-safe recovery without creating an execution queue;
- exact pinned Flow execution remains Temporal-owned;
- Run projection preserves Trigger/Project/Flow/version/operation correlation;
- existing external-send, spend, credential, irreversible-write, policy, capability, and approval gates remain authoritative;
- webhook root secret and derived token are not stored in Trigger configuration.

Operations: [../webhook-operations.md](../webhook-operations.md).  
Acceptance contract: [../product-evolution-pe05-acceptance.md](../product-evolution-pe05-acceptance.md).

## Data and migration proof

The existing PE-03 Trigger SQLite table is migrated from:

```text
manual | time
```

to:

```text
manual | time | event | webhook
```

without losing existing Trigger definitions or manual-fire receipts.

The Flow DB adds only bounded Trigger delivery metadata required for idempotency. It is not a durable work queue, scheduler, or execution source of truth.

Tests cover:

- PE-03 data preservation during migration;
- unique webhook `hookId`;
- event delivery receipt persistence across DB reopen;
- restart-safe `PENDING` recovery;
- `STARTED` duplicate suppression;
- conflicting dedupe reuse rejection.

## HTTP / security proof

Connect:

```text
POST /v1/webhooks/:hookId
GET  /v1/settings/webhooks/:hookId/token
```

The public POST route is explicitly exempted from the internal bearer mechanism only because it performs its own hook-scoped token verification. The token-derivation settings route remains behind the normal internal bearer boundary.

Security behavior covered:

- no webhook root secret configured -> fail closed;
- missing token -> 401;
- wrong token -> 401;
- valid hook-scoped token -> internal Flow forwarding;
- different `hookId` derives a different token;
- external payload cannot provide Workspace/Project/Flow/autonomy;
- oversized body/payload/metadata is rejected;
- Connect forwards to Flow using the internal bearer token.

## Trigger / dispatch proof

Flow tests cover:

- event/webhook schema activation;
- `condition` remains inactive;
- disabled Trigger suppression;
- sibling-Project mismatch fails closed;
- Project autonomy ceiling remains binding;
- missing/invalid pinned Flow version fails closed;
- Hub policy denial prevents Temporal dispatch;
- event selector mismatch fails closed;
- duplicate event delivery deduplicates;
- conflicting reuse of delivery identity fails closed;
- unique webhook routing identity;
- Trigger identity is passed into graph execution;
- retry with a new receive timestamp remains the same logical delivery.

## Real Temporal vertical proof

The normal unit-test suite intentionally skips the process-gated PE-05 Temporal vertical. CI then runs the dedicated real-process command with:

```text
ECORIONE_PHASE4_PROCESS_ACCEPTANCE=1
pnpm run acceptance:phase4:process
```

The command explicitly executes:

```text
test/phase4-temporal-runtime.test.ts
test/pe05-webhook-temporal-runtime.test.ts
```

Result on CI run `35439232165`:

```text
test/pe05-webhook-temporal-runtime.test.ts
PASS

PE-05 webhook -> Temporal runtime acceptance
verifies public delivery, deduplicates it, executes pinned Flow,
and rebuilds Run evidence
PASS

Test Files  2 passed
Tests       3 passed
```

That vertical proves:

```text
public webhook delivery
-> Connect per-hook authentication
-> Flow internal ingress
-> configured Project-scoped webhook Trigger
-> exact pinned Flow version
-> Hub policy/authority boundary
-> real Temporal graph workflow
-> duplicate retry returns same workflowId/operationId
-> operationId-keyed Run projection
-> preserved triggerId / Project / graphVersion / output evidence
```

## Full exact-head CI proof

CI run `35439232165` passed:

```text
Format                         PASS
Lint                           PASS
Typecheck                      PASS
Test                           PASS
Phase 4 real-process acceptance PASS
Production operations acceptance PASS
Secret scan                    PASS
Dependency policy review       PASS
GitHub Actions pin review      PASS
GitHub Actions runner review   PASS
Node toolchain review          PASS
Installer toolchain review     PASS
Container image digest review  PASS
Release security acceptance    PASS
Production build               PASS
```

Normal test suite result before the process-gated acceptance:

```text
Test Files  178 passed | 1 skipped
Tests       954 passed | 2 skipped
```

The PE-05 process-gated test is the expected skipped test in the normal suite and is then executed successfully by the dedicated real-process acceptance step.

## Non-regression gates

```text
Product Eval                   35439232138 PASS
MCP External HTTPS Acceptance  35439232130 PASS
Desktop Installer              35439232123 PASS
```

## Boundary confirmation

PE-05 does **not** introduce:

- a Task domain;
- a second execution database;
- a second scheduler;
- a durable polling service;
- an always-on LLM monitor;
- a second queue;
- a credential store outside Connect;
- public caller authority to select Workspace/Project/Flow/autonomy;
- `condition` Trigger activation;
- L4 autonomy.

## Final merge gate

This closure evidence is added after implementation head `b3fa55e689548b5a72c47b331682285eb8fb6eb2` passed all required gates.

The resulting documentation-only exact PR head must also pass CI, Product Eval, MCP External HTTPS Acceptance, and any automatically triggered release/installer regression before PR #174 is marked ready and merged.

PE-06 remains blocked until PR #174 merges.
