# Session 9 A-06b Schedule closure — 2026-09-25

Status: **CLOSED / PASS**

Current implementation main and proven staging runtime:

`d182c5ec06be14de068b7c3911a0decffcc94d41`

This checkpoint closes the bounded A-06b Schedule product scope opened after A-06a. It does not open Brain A-07/A-08 or any unrelated deferred roadmap item.

## 1. Closed scope

PR #329 — `feat: complete A-06b Project picker and Schedule assistant` — was squash-merged into main as `d182c5ec06be14de068b7c3911a0decffcc94d41`.

A-06b now provides:

- searchable/autocomplete Project selection on Work;
- inline `+ New Project` using the existing Project owner API;
- immediate selection of a newly created Project;
- AI-assisted natural-language Schedule create/edit drafting;
- explicit human review before Save;
- continued mutation through the existing Flow Trigger API and Temporal-backed scheduling path.

Together with the already closed A-06a calendar/navigation slice, Schedule A-06 is now **globally CLOSED / PASS** for this roadmap boundary.

## 2. Authority and ownership remain unchanged

The implementation deliberately does not introduce a second scheduler, task database, synthetic history domain, or direct scheduling side channel.

The preserved authority path is:

`Work UI -> Hub policy/assistant boundary -> existing Flow Trigger owner -> Temporal schedule truth`

More specifically:

- Project selection and creation continue through the existing Project owner API;
- the AI helper is a **draft compiler only**;
- assistant inference is authorized as `LOCAL_ONLY` and routed through Hub -> Connect with `target: "local"`;
- the assistant may choose only an existing Flow from the active Project;
- `graphVersion` is pinned from the Flow owner's current version, not invented by the model;
- existing governance values are preserved on edit:
  - `requestedAutonomy`;
  - `enabled`;
  - `catchupWindowMs`;
  - `overlap`;
- generated time configuration is revalidated against the canonical Trigger schema;
- the assistant route contains no direct Trigger mutation and no Temporal mutation;
- only the existing explicit Save path POST/PATCHes `/api/flow/triggers...`.

Manual editing remains available if local inference is unavailable or the user prefers not to use AI assistance.

## 3. Deterministic regression coverage

A-06b added or extended deterministic coverage for:

- Work schedule-assist proxy validation;
- searchable Project picker and inline Project creation;
- local-only Hub inference boundary;
- owner-pinned Flow version;
- preservation of Schedule governance fields;
- explicit-Save-only mutation;
- integrated rendered-browser Project search/create/select;
- rendered-browser natural-language Schedule draft population;
- proof that Trigger mutation count remains zero before explicit Save and becomes exactly one after Save.

## 4. Exact-head evidence before merge

Reviewed implementation head:

`f7e10c1d4fae957e7a9b52bbbc78805424f8da12`

PASS evidence:

- CI `36124634778` — format, lint, typecheck, full tests, Phase 4 real-process acceptance, production operations acceptance, secret scan, dependency/action/runner/toolchain/container/release gates, production build, and history-wide secret scan;
- Product Eval `36124634690` — PASS;
- PCS-06 Integrated Browser Acceptance `36124634717` — PASS;
- MCP External HTTPS Acceptance `36124634826` — PASS.

Rendered-browser evidence specifically exercised the new Project picker and inline create path, populated a Schedule draft from natural language, asserted no Trigger mutation before Save, and then verified the single explicit Trigger mutation after Save.

## 5. Merge and merged-main evidence

PR #329 was merged with the expected head locked to `f7e10c1d4fae957e7a9b52bbbc78805424f8da12`.

Merged implementation main:

`d182c5ec06be14de068b7c3911a0decffcc94d41`

Merged-main PASS evidence:

- CI `36125055447` — full verify job PASS plus naming and history-wide secret scan PASS;
- Product Eval `36125055440` — PASS;
- MCP External HTTPS Acceptance `36125055159` — PASS.

The first staging workflow-run triggered by Product Eval, `36125132944`, intentionally skipped deployment because peer CI was not yet green. This is expected fail-safe behavior rather than a deployment failure.

## 6. Exact-SHA staging deployment

After merged-main CI and Product Eval were both green, automatic Staging Deploy `36125427040` passed both gate and deploy jobs.

The deploy job executed:

`Deploy exact reviewed main SHA`

for:

`d182c5ec06be14de068b7c3911a0decffcc94d41`

Runtime evidence recorded:

- staging tag `staging-d182c5ec06be`;
- host `headSha` equals expected SHA;
- `expectedShaMatched: true`;
- clean detached runtime worktree;
- public production smoke PASS;
- representative human-auth protected routes remained protected;
- MCP protected-resource metadata and unauthenticated challenge behavior PASS;
- Operations snapshot reported `healthy: true`;
- `serviceCount: 9`;
- `unhealthyServices: []`;
- staging host evidence PASS;
- rollback-set retention preserved;
- final staging capacity stabilized at **27.69 GiB free**.

## 7. Closure decision

A-06a and A-06b are both closed. Therefore **Schedule A-06 is CLOSED / PASS**.

Brain A-07/A-08 was not modified by this scope. The previous blocker that required A-06b to be closed or explicitly deferred is now removed, but this checkpoint does **not** automatically authorize or start Brain work.

Current execution state after this closure:

- no A-06 implementation is in flight;
- no Brain implementation is in flight;
- A-07/A-08 may be considered only after an explicit next-scope decision;
- native Google Drive OAuth/onboarding remains separately deferred;
- recursive folder auto-ingestion remains outside the accepted A-05 boundary;
- frontend decomposition A-09, Compose readiness A-10, production cutover, paid-provider evidence, and DR-2 remain separate scopes.

## 8. Safe resume rule

A future agent should treat this document as the A-06 closure boundary.

Do not reopen the scheduler backend merely to continue product UX work. Do not create a second Schedule store. Do not bypass Flow Trigger ownership or Temporal schedule truth. Do not infer that Brain A-07/A-08 is authorized merely because its prior A-06 dependency is now satisfied.

The next implementation scope must be selected explicitly from the remaining findings/roadmap.
