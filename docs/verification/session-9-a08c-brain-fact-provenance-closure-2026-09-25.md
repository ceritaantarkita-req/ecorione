# Session 9 — A-08c Brain Fact provenance closure

Date: **2026-09-25**

Status: **CLOSED / PASS — SAFE / RESUMABLE**

Exact product main and proven staging revision:

```
0a36a041a4077e185cbc934723d7ca195c5f5fc5
```

There is no unmerged A-08c implementation work at this checkpoint.

## Scope

PR **#338 — `feat: add owner-backed Brain Fact provenance edges`**

Reviewed exact head:

```
653b8b5f650907bd60e4987b36beae164b872715
```

Squash merge:

```
0a36a041a4077e185cbc934723d7ca195c5f5fc5
```

A-08c adds one deterministic canonical relationship:

```
Context Fact --GENERATED_FROM--> Artifact
```

The edge is created only when all of these are true:

1. the Context-owned Fact has provenance `sourceUri`;
2. the URI uses the exact `artifact:<ArtifactId>` format;
3. the identifier passes `ArtifactIdSchema`;
4. the corresponding Artifact node already exists in the authorized Project Brain projection from Hub Project Source state.

Malformed provenance, URL provenance, unknown artifact IDs, and artifacts not bound/visible in the authorized Project remain metadata-only and create no provenance edge.

## Ownership and security invariants

- Context remains the canonical Fact owner.
- Artifact remains the canonical Artifact owner.
- Hub Project authorization and Project Source state determine which Artifact nodes may exist in the Project graph.
- Brain remains read-only and rebuildable.
- No graph database was added.
- No Fact or Artifact owner mutation was added.
- No new external/provider egress was added.
- No LLM, embedding, semantic similarity, or inferred narrative creates canonical relationships.
- `GENERATED_FROM` reuses the relationship vocabulary already defined by the Product Evolution architecture rather than inventing a parallel edge type.

## Regression coverage

A-08c adds/extends:

- `apps/ai/lib/brain-projection.test.ts`
  - matching authorized bound Artifact creates `GENERATED_FROM`;
  - artifact-style provenance without an authorized Artifact node creates no edge.
- `apps/ai/app/api/brain/route.test.ts`
  - owner-backed API path proves Hub-authorized Artifact + Context Fact yields the exact relationship.
- `test/a08c-brain-fact-provenance-source-contract.test.ts`
  - locks schema-valid Artifact provenance, authorized-node membership, model-free behavior, and browser coverage.
- `scripts/pcs06-browser-acceptance.mjs`
  - rendered Brain selects the Fact and verifies the inspector relationship:
    `PCS-06 canonical fact · GENERATED_FROM · PCS-06 Artifact`.

## Exact PR-head evidence

Exact reviewed head `653b8b5f650907bd60e4987b36beae164b872715` passed:

- CI **`36156486474`** — PASS
- Product Eval **`36156486661`** — PASS
- MCP External HTTPS Acceptance **`36156486439`** — PASS
- PCS-06 Integrated Browser Acceptance **`36156486530`** — PASS

CI includes format, lint, typecheck, full tests, Phase 4 real-process acceptance, production operations acceptance, security/policy gates, production build, and secret-history.

## Merged-main evidence

Exact merged main `0a36a041a4077e185cbc934723d7ca195c5f5fc5` passed:

- CI **`36157146397`** — PASS
- Product Eval **`36157146459`** — PASS
- MCP External HTTPS Acceptance **`36157146498`** — PASS

## Exact staging proof

Automatic Staging Deploy **`36157615400`**:

- gate — PASS
- deploy — PASS
- `Deploy exact reviewed main SHA` — PASS

Therefore exact merged main `0a36a041a4077e185cbc934723d7ca195c5f5fc5` is the proven staging runtime revision for A-08c.

## Safe next boundary

A-08 remains partially closed. A-08c removes the explicit Fact-provenance candidate from the open list.

Remaining Brain candidates must remain independent bounded decisions:

1. connector/resource hierarchy only where Connect/MCP exposes stable, authorized canonical resource identities;
2. Core Memory representation only if a stable canonical owner identity exists;
3. embedded Brain AI/chat only by reusing the existing Ai/Context/ECX path rather than creating a second chat system.

Do not move to A-09/A-10 until the remaining A-08 scope is either implemented or explicitly deferred/closed.

## Separate deferred scopes

This closure does not authorize:

- native Google Drive OAuth/provider integration;
- recursive external-folder mirroring;
- a persistent graph database;
- production/public cutover;
- DR-2 checkpoint 2;
- hosted-provider spend;
- L4 autonomy / AutoClick.
