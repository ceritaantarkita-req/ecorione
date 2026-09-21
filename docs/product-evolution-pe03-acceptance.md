# PE-03 acceptance contract

Last updated: **2026-09-21**

Status: **CLOSED / PASS**

PE-03 adds the Trigger control plane without creating another scheduler, retry engine, or autonomous polling service. Flow owns Trigger metadata; Temporal owns time-schedule runtime truth; Hub remains authority/policy owner.

## V1 Trigger model

Stable kinds:

```text
manual
time
event
webhook
condition
```

PE-03 may activate only:

```text
manual
time
```

`event` and `webhook` remain PE-05. `condition` remains reserved and must not become LLM polling.

Every Trigger definition must carry:

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

Time Trigger additionally stores an explicit Temporal schedule identity and schedule configuration.

## Project / Flow validation

Before create/update/fire:

1. active Project must resolve in the same Workspace through Hub;
2. exact Flow graph version must exist;
3. graph Workspace must equal Trigger Workspace;
4. graph Project must equal Trigger Project in PE-03 V1;
5. graph version must be valid/compilable;
6. Trigger cannot silently follow a later graph version.

Cross-Project Flow reuse through Project Sources remains a reference/product feature in PE-03; runtime Trigger reuse across Project ownership is deferred until an explicit execution authorization contract exists.

## Autonomy and authority

1. `MAX_AUTONOMY_V1` remains L3;
2. requested Trigger autonomy cannot exceed Project `autonomyCeiling`;
3. create/update/enable/disable mutations pass Hub policy;
4. every Trigger dispatch passes Hub policy before Temporal start;
5. node/tool execution continues to pass existing Hub capability/policy checks;
6. Trigger never grants permissions or capability;
7. manual fire is not an authority bypass.

## Manual Trigger

Manual dispatch must:

1. require enabled manual Trigger;
2. accept a stable caller request/idempotency identity;
3. execute the exact pinned Flow version;
4. prevent retry from creating a second logical dispatch;
5. return Trigger + Flow + run/operation identity sufficient for later Run projection;
6. fail before Temporal execution if Project/Flow/policy validation fails.

## Time Trigger / Temporal

Time Trigger must use **Temporal Schedule API**.

Forbidden:

```text
setInterval
setTimeout loop as scheduler
cron daemon
custom durable scheduler state machine
scheduler occurrence database
always-on LLM polling
```

Time configuration must include:

```text
IANA timezone
cron/calendar schedule
catchupWindow
overlap = SKIP | QUEUE_ONE
```

Defaults:

```text
catchupWindow = 60 seconds
maximum       = 24 hours
overlap       = SKIP
```

Mapping:

```text
SKIP      -> Temporal SKIP
QUEUE_ONE -> Temporal BUFFER_ONE
```

Schedule create/update/pause/resume/delete behavior must be idempotent against the Trigger definition and survive Flow service/worker restart.

## Pinned Flow version

V1 = **PINNED ONLY**.

- Trigger points to one exact `graphId + graphVersion`.
- Updating a Flow does not mutate existing Trigger target.
- Updating Trigger to another version is explicit and audited/policy-checked.
- `FOLLOW_LATEST` is not accepted in PE-03.

## Concurrency / misfire

Deterministic tests must cover:

- overlap SKIP;
- overlap QUEUE_ONE;
- explicit catch-up window;
- disabled Trigger dispatch suppression;
- duplicate manual request;
- schedule re-sync after service restart;
- schedule disabled/paused state.

## Persistence / recovery

1. Flow DB reopen preserves Trigger definitions;
2. Trigger metadata is not Temporal runtime truth;
3. Temporal schedule can be reconciled from Trigger metadata after service restart without duplicate schedule creation;
4. losing/rebuilding Trigger metadata does not rewrite Flow graph versions;
5. no second occurrence ledger is introduced.

## API

Minimum control API:

```text
GET    /v1/triggers
POST   /v1/triggers
GET    /v1/triggers/:id
PATCH  /v1/triggers/:id
POST   /v1/triggers/:id/enable
POST   /v1/triggers/:id/disable
POST   /v1/triggers/:id/fire
```

PE-04 owns the polished Work/Schedule/Runs product UI. PE-03 may expose only the minimal control/API surface needed for verification.

## Required tests

```text
Trigger schema validation
manual/time only activation
repository create/list/get/update/reopen
optimistic revision conflict
Project/Workspace/Flow version validation
Project autonomy ceiling
disabled Trigger no dispatch
manual idempotency
pinned Flow version remains stable after Flow update
Temporal Schedule create/update/pause/reconcile
SKIP / BUFFER_ONE mapping
IANA timezone
catchup bounds/default
worker/service restart durability
Hub policy negative paths
normal CI
Product Eval
Phase 4 / Temporal runtime acceptance
```

PE-03 closed on PR #172 exact head `74730e26321cac06c31243baeeafe29d5f4d75f0` and merged as `c739c09014d8aa20ca8e1b83c5b6be39b4ee649c`. See [verification/pe-03-trigger-control-plane-closure-2026-09-19.md](verification/pe-03-trigger-control-plane-closure-2026-09-19.md). PE-04 through PE-08 and PCS-00..PCS-10 subsequently closed; no Product Evolution batch is active.
