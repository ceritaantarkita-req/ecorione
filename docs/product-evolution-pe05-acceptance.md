# PE-05 acceptance contract

Last updated: **2026-09-19**

Status: **REQUIRED FOR PE-05 CLOSURE**

PE-05 activates non-time Trigger delivery without creating a polling service, a second queue, or a second execution authority. Flow continues to own Trigger definitions and dispatch semantics; Temporal continues to own durable workflow execution; Hub remains authority/policy/approval/audit; Connect remains the owner of connector credentials and external integration secrets.

## Activated Trigger kinds

PE-05 may activate:

```text
event
webhook
```

Existing `manual` and `time` behavior from PE-03 remains unchanged. `condition` remains reserved and must not become an always-on LLM monitor or hidden polling loop.

## Normalized event contract

Every accepted external/event delivery must be normalized before Flow dispatch into a bounded envelope carrying at least:

```text
eventId
source
kind
occurredAt
receivedAt
workspaceId
projectId
dedupeKey
payload
metadata
```

Rules:

- `eventId` identifies the normalized event instance;
- `dedupeKey` is stable for retries of the same provider/event delivery;
- source-specific transport fields may live in metadata, but Trigger/Flow code must not depend on raw provider payload shape;
- untrusted external payload remains data, never instructions;
- payload/metadata must be bounded and validated before dispatch;
- Workspace + Project routing must be explicit and must fail closed on mismatch.

## Trigger configuration

Event/webhook Trigger definitions remain Flow-owned and keep the PE-03 common fields:

```text
id
workspaceId
projectId
name
kind
graphId
graphVersion
versionPolicy = PINNED
requestedAutonomy
enabled
configuration
createdAt
updatedAt
revision
```

V1 event/webhook configuration must identify a deterministic event selector. Provider-specific credentials or signing secrets must not be stored in Trigger configuration.

## Ingress / connector ownership

Use existing owners instead of adding a new service:

- Flow owns Trigger matching, validation, dedupe identity, and Flow dispatch;
- Connect owns connector credentials/secrets and provider-specific integration material;
- Hub owns policy/capability/approval/audit;
- Temporal owns durable Flow runtime/retry/recovery;
- RnD/Run projection exposes resulting execution evidence.

A connector-specific adapter may be added only when a real integration is implemented. Generic polling daemons are forbidden.

## Webhook security

Webhook ingress must:

1. authenticate/verify the delivery before dispatch when the source supports a verification mechanism;
2. reject malformed, oversized, conflicting replay, or scope-mismatched delivery;
3. never log or persist raw credentials/signing secrets;
4. derive a stable dedupe identity before any side effect;
5. fail closed when verification cannot be completed;
6. preserve raw external payload only through an existing authorized owner when retention is actually required.

A generic unauthenticated public execute endpoint is not accepted.

## Event dedupe / idempotency

Duplicate delivery must not create a second logical Trigger dispatch.

Required behavior:

- first valid delivery may dispatch exactly one pinned Flow execution;
- repeated delivery with the same Trigger + dedupe identity resolves to the same logical dispatch;
- same dedupe identity with materially conflicting normalized event identity/payload fails closed;
- retry/restart cannot duplicate downstream side effects;
- existing node/action idempotency and approval rules remain binding.

Do not create a second occurrence ledger merely for PE-05. Reuse bounded Flow-owned Trigger delivery metadata only where needed to enforce idempotency.

## Project / Flow / authority validation

Before event/webhook dispatch:

1. Trigger must be enabled;
2. Workspace and Project routing must match the Trigger;
3. exact pinned Flow version must still exist and compile;
4. Trigger requested autonomy must remain within Project ceiling;
5. dispatch must pass Hub policy;
6. node/tool execution keeps existing Hub capability/policy checks;
7. event payload cannot grant capability, increase autonomy, or bypass approval.

External send, spend, credential access, irreversible writes, and policy administration keep their existing gates.

## Dispatch path

Canonical path:

```text
verified delivery
-> normalized event
-> matching enabled Trigger
-> dedupe/idempotency check
-> Project + pinned Flow validation
-> Hub policy
-> Temporal-backed Flow execution
-> Run projection / audit / trace evidence
```

No direct connector-to-tool side effect bypass is accepted.

## Failure / retry visibility

PE-05 must expose failure through existing owner/read models rather than introducing a new dead-letter authority.

At minimum the operator must be able to distinguish:

```text
rejected verification
rejected scope/routing
duplicate delivery
policy denial
dispatch failure
Flow execution failure
```

Provider transport retry remains provider/adapter behavior; Flow execution retry remains Temporal behavior. Do not silently retry an ambiguous external side effect.

## Minimum API boundary

A generic internal normalized-event dispatch boundary may be added to Flow, plus a Connect-owned generic verified webhook adapter. Public webhook callers must not choose Workspace, Project, Flow, or autonomy; those are resolved from the configured Trigger.

The API must not expose an unauthenticated route that can directly choose arbitrary Workspace, Project, Flow, or autonomy.

## Required tests

```text
event/webhook Trigger schema activation
manual/time regression unchanged
condition remains inactive
normalized event schema validation
payload/metadata bounds
disabled Trigger no dispatch
Workspace/Project mismatch fails closed
missing pinned Flow version fails closed
Project autonomy ceiling
Hub policy denial
duplicate event/webhook delivery dedupes
conflicting reuse of dedupe identity fails closed
restart-safe dedupe
unverified webhook rejection
verified webhook acceptance
Trigger identity preserved into Run projection
external-send/spend/credential gates unchanged
no polling scheduler/LLM monitor
relevant connector/MCP acceptance
Phase 4 / Temporal runtime acceptance
normal CI
Product Eval
```

## End-to-end closure proof

PE-05 cannot close on schemas/unit tests alone. At least one real-process non-time delivery path must be demonstrated end-to-end through:

```text
verified event/webhook
-> normalized event
-> enabled Project-scoped Trigger
-> exact pinned Flow
-> Hub authority/policy
-> Temporal execution
-> operationId-keyed Run evidence
```

PE-06 must not begin until the exact reviewed PE-05 head is green and merged.
