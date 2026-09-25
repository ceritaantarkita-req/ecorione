# Session 9 — post-A-08c safe checkpoint

Date: **2026-09-25**

Status: **SAFE / RESUMABLE — A-06 CLOSED / A-07 CLOSED / A-08a+b+c CLOSED / NEXT A-08 SLICE UNSELECTED**

Exact canonical repository main and staging revision:

```
807b6f42683a910d106a3176f95442145807cf97
```

Last product-code-changing main:

```
0a36a041a4077e185cbc934723d7ca195c5f5fc5
```

The difference between those two revisions is documentation convergence only. Product/runtime semantics at this checkpoint therefore come from `0a36a041...`, while the complete canonical documentation set is at `807b6f42...`.

There are **no open pull requests** and no implementation work in flight at this checkpoint.

## 1. Closed roadmap sequence

### A-06 Schedule — CLOSED / PASS

A-06a calendar/navigation:

- PR #327
- merge `3b1abefd18263f7441d139e3435b064f83b142ea`

A-06b Project picker + Schedule assistant:

- PR #329
- merge `d182c5ec06be14de068b7c3911a0decffcc94d41`

A-06 now has searchable Project selection, inline Project creation, day/week/month/year calendar navigation, and a governed local natural-language Schedule drafting path. Explicit Save remains the mutation point through existing Trigger -> Flow -> Temporal authority.

### A-07 Brain scalable layout — CLOSED / PASS

- PR #331
- merge `13775e3903a74732162658292a8dd350a068de6b`

Brain now has deterministic scalable layout plus contained pan/drag/zoom/reset behavior and rendered-browser proof at the allowed dense Run boundary.

### A-08a Brain owner resources — CLOSED / PASS

- PR #333
- merge `461a9665584b5e3a47396663cd4220f21c62027c`

Brain promotes authorized Project-bound Artifact and Space Page owners as first-class nodes while Source remains the binding/reference view.

### A-08b Brain Context Facts — CLOSED / PASS

- PR #335
- merge `bc5601602e401bb0f4d19f567b4dd10c6388f94d`

Brain projects bounded Context-owned Fact nodes using stable `MemoryFact.id` identities after exact Hub Project authorization.

### A-08c Fact provenance — CLOSED / PASS

Implementation:

- PR #338
- reviewed head `653b8b5f650907bd60e4987b36beae164b872715`
- merge `0a36a041a4077e185cbc934723d7ca195c5f5fc5`

Canonical deterministic relationship:

```
Context Fact --GENERATED_FROM--> Artifact
```

The edge exists only for schema-valid exact `artifact:<ArtifactId>` Fact provenance when the corresponding Artifact is already visible in the authorized Project Brain projection. No model inference, semantic guessing, graph database, or owner mutation creates this relationship.

A-08c implementation evidence:

- exact-head CI `36156486474` — PASS
- Product Eval `36156486661` — PASS
- MCP External HTTPS `36156486439` — PASS
- PCS-06 rendered browser `36156486530` — PASS
- merged-main CI `36157146397` — PASS
- merged-main Product Eval `36157146459` — PASS
- merged-main MCP `36157146498` — PASS
- Staging Deploy `36157615400` — PASS

Closure docs:

- PR #339
- docs merge `807b6f42683a910d106a3176f95442145807cf97`
- PR-head CI `36158389801` — PASS
- PR-head Product Eval `36158389762` — PASS
- merged-main CI `36160149549` — PASS
- merged-main Product Eval `36160149558` — PASS
- automatic Staging Deploy `36160532772` — gate PASS / deploy PASS / `Deploy exact reviewed main SHA` PASS

Therefore the canonical docs-convergence revision `807b6f42...` is also proven on staging.

## 2. Cleanup performed for a genuinely safe checkpoint

Two obsolete/stale PRs were closed **without merge**:

### PR #337 — selected-node grounded Brain assistant

- old head: `9b591b28349c18a49c0057076a739cae8c50f29b`
- authored from pre-A-08c base `52331b408135bcbb0a99bec871c873710f047c2d`
- diverged from current main
- latest CI verify was red
- branch remains implementation-reference material only

It must **not** be revived or merged directly. If Brain grounded chat is selected next, port the useful design onto a fresh branch from current reviewed main and preserve A-08c provenance.

### PR #310 — old Session 4 docs closure

- 153 commits behind current main
- content already superseded by later merged canonical docs/checkpoints
- closed without merge

After this cleanup, GitHub reports zero open PRs.

## 3. Architecture invariants to preserve

- Brain remains a deterministic, rebuildable read projection.
- Hub remains Project authorization/policy authority.
- Context remains canonical Fact/memory owner.
- Artifact remains canonical raw artifact owner.
- Flow remains Trigger/graph owner.
- Temporal remains schedule/runtime truth.
- Connect remains provider/model/MCP/credential/spend boundary.
- Ai remains the browser/product surface and may compose owner APIs, not become a new canonical store.
- No cross-service database reads.
- No second scheduler.
- No second chat/history system.
- No model-created canonical graph relationships.
- No provider credential copied into Ai/Brain/Project storage.
- No sensitivity downgrade to make a feature easier.

## 4. Next discussion boundary

Do **not** start A-09 or A-10 yet. First decide how to close the remaining A-08 boundary.

The remaining independent candidates are:

1. **Brain grounded assistant**
   - reuse existing Ai -> Hub -> Context -> Connect chat path;
   - selected-node / authorized-neighborhood constraints only;
   - no second chat backend or conversation store;
   - old PR #337 may be studied as a prototype, but implementation must restart from current main.

2. **Connector/resource hierarchy**
   - only if Connect/MCP exposes stable canonical resource identities and authorization for parent/child relationships;
   - do not synthesize folder trees or mirror external filesystems merely for visualization.

3. **Core Memory representation**
   - only if current Context contract exposes a stable canonical identity suitable for a first-class Brain node;
   - do not invent IDs from labels/text.

A valid next decision may also be to explicitly **defer** one or more of these and close A-08 at the currently proven owner-backed boundary.

## 5. Safe resume rule

When discussion resumes:

1. verify `main` still equals or descends cleanly from `807b6f42683a910d106a3176f95442145807cf97`;
2. verify there is no new open PR/implementation that supersedes this checkpoint;
3. choose exactly one A-08 candidate or explicitly defer the remainder;
4. create a fresh narrow branch from current main;
5. preserve all owner/security boundaries above;
6. require deterministic tests plus rendered acceptance where the surface is user-visible;
7. merge only after exact-head gates are green;
8. prove merged-main and exact-SHA staging before declaring closure;
9. only after A-08 is closed/deferred may A-09 maintainability or A-10 Compose readiness become the next roadmap scope.

## 6. Separate deferred scopes

This checkpoint does not authorize:

- native Google Drive OAuth/provider integration;
- recursive external-folder mirroring;
- DR-2 checkpoint 2;
- production/public cutover;
- hosted-provider spend;
- L4 autonomy / AutoClick;
- broad frontend refactoring unrelated to the selected slice.
