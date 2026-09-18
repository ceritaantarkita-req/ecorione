# PE-01 acceptance contract

Last updated: **2026-09-19**

Status: **REQUIRED FOR PE-01 CLOSURE**

PE-01 is not complete because pages render. It closes only when the following behaviors are proven.

## Schema and migration

1. clean database boot creates `prj_personal` exactly once;
2. existing baseline DB migrates without deleting Ledger events or Context L0 content;
3. migration can restart safely after normal reopen;
4. existing personal Chat works after migration without user action;
5. ambiguous non-personal legacy data is not silently assigned.

## Workspace / Project authority

1. Project always belongs to one Workspace;
2. Project from Workspace B cannot be used in Workspace A request;
3. archived/nonexistent Project fails clearly;
4. `All` is not accepted as a Project ID.

## Chat / Ledger

1. new Ai request sends explicit `ws_personal + prj_personal`;
2. compatibility request with both omitted normalizes to Personal;
3. non-personal workspace without Project is rejected;
4. History session exposes effective Workspace + Project;
5. append/read/integrity tests prove Ledger hash chain still valid;
6. session list can filter by Project.

## Context isolation

Fixture:

```text
Project A: fact "A_ONLY"
Project B: fact "B_ONLY"
Global:    fact "GLOBAL_OK"
```

A retrieval must include A + authorized global and must not return B. B is symmetric.

Also test intersection with sensitivity/syncClass and hostedEligible filtering.

## Core memory

1. same label can exist globally and in two Projects;
2. Project retrieval resolves authorized global + current Project only;
3. read-only/trust rules remain unchanged;
4. sibling Project label never shadows/leaks into current Project.

## Flow linkage

1. `ws_personal` migrated Flow graph resolves to `prj_personal`;
2. cross-workspace Project/Flow combination is rejected;
3. graph version immutability remains unchanged.

## UI

1. Projects surface can create/open/archive Project;
2. real `Personal` appears;
3. virtual `All` appears only as aggregate navigation;
4. project switch changes Chat context;
5. recent conversations are Project-scoped;
6. desktop + narrow viewport navigation remains usable.

## Gates

Minimum closure gates:

```text
focused schema/repository tests
migration/reopen tests
Project A/B isolation tests
Ledger integrity tests
pnpm verify / normal CI
Product Eval
relevant browser/runtime product acceptance
```

No PE-02 work starts until all required PE-01 evidence is green on the reviewed head.
