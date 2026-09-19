# PE-01 acceptance contract

Last updated: **2026-09-19**

Status: **CLOSED / PASS**

PE-01 is closed at the documented boundary. The Project layer is first-class without becoming a second security/data plane.

## Schema and migration

Verified:

1. clean database boot creates `prj_personal` exactly once;
2. existing baseline DB migrates without deleting Ledger events or Context L0 content;
3. migration is reopen-safe;
4. existing personal Chat remains compatible when Workspace/Project are omitted;
5. ambiguous legacy Context rows remain unassigned instead of being silently reclassified.

## Workspace / Project authority

Verified:

1. every Project belongs to one Workspace;
2. cross-Workspace Project use is rejected;
3. archived/nonexistent Project fails clearly;
4. `All` remains a virtual UI aggregate and is not a persisted Project.

## Chat / Ledger

Verified:

1. Ai sends explicit `ws_personal + projectId` after resolving the active Project;
2. compatibility requests with both omitted normalize to Personal;
3. non-personal Workspace without explicit Project is rejected;
4. History sessions expose effective Workspace + Project;
5. append/read/integrity behavior remains covered by Ledger tests;
6. session listing filters by Project.

## Context isolation

The PE-01 isolation fixture is covered:

```text
Project A: fact "A_ONLY"
Project B: fact "B_ONLY"
Global:    fact "GLOBAL_OK"
```

Project A retrieval returns authorized global + A and never B; Project B is symmetric.

Sensitivity, syncClass, and hostedEligible filters are intersected with the Project boundary. Core-memory labels may coexist globally and per Project, with the current Project overriding the global label without sibling leakage.

Explicit forget of a visible global fact remains allowed, while a fact owned by a sibling Project cannot be mutated through the current Project.

## Flow linkage

Verified:

1. migrated `ws_personal` Flow graphs resolve to `prj_personal` without rewriting immutable historical graph-version JSON;
2. cross-Workspace Project/Flow combinations are rejected through Hub validation;
3. graph Project identity cannot move through a later graph version;
4. graph-version immutability remains intact.

## UI

Implemented and covered at the PE-01 boundary:

1. Projects surface can create/open/archive Project;
2. real `Personal` appears;
3. virtual `All` is an aggregate navigation item only;
4. opening a Project persists the active Project and Chat sends it explicitly;
5. recent conversations are Project-scoped;
6. Projects navigation is present in the existing responsive product shell.

## Closure evidence

Reviewed implementation head:

```text
PR #169
head e039df3ee57a5fdcc62e33a3a1a48d9f0d3a7944
CI #1189 PASS
Product Eval #428 PASS
MCP External HTTPS Acceptance #595 PASS
test suite: 902 tests evaluated on the preceding regression run; PE-01 regressions fixed and full Test step passed on #1189
```

Focused evidence includes Project registry/reopen tests, Context Project A/B isolation + filter tests, Context migration tests, Ledger migration/integrity coverage, Flow Project migration/linkage tests, Hub/Chat compatibility tests, and Ai Project API tests.

The closure-doc head must also pass the normal exact-head gates before PR #169 is merged.

PE-02 must not begin before that final exact-head revalidation is green.
