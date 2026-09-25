# Session 9 — A-08b Brain Context Fact projection closure

Date: **2026-09-25**

Status: **CLOSED / PASS — SAFE / RESUMABLE**

Exact implementation main and staging baseline:

```
bc5601602e401bb0f4d19f567b4dd10c6388f94d
```

## Scope closed

PR **#335 — `feat: project Context facts into Brain`**

Reviewed exact head:

```
c81674311587f6221331d73eb7baac02857b9d24
```

Squash merge:

```
bc5601602e401bb0f4d19f567b4dd10c6388f94d
```

A-08b adds first-class Brain `Fact` nodes using stable Context-owned `MemoryFact.id` values.

## Ownership and authorization boundary

The implementation preserves the canonical owner model:

- Hub authorizes the exact Workspace/Project first;
- Brain then reads bounded facts through Context's HTTP owner contract;
- Context remains canonical Fact owner;
- Brain remains a deterministic read-only projection;
- no Context database is opened from Ai/Brain;
- no graph database is introduced;
- no fact mutation path is introduced;
- no model-authored canonical relationship is introduced.

Context reads are bounded to:

- exact authorized `projectId`;
- `maxSensitivity=RESTRICTED`;
- at most **40** facts for the Brain projection.

If Context returns a Fact from a sibling Project, Brain fails closed instead of projecting it.

## Projection behavior

Fact nodes:

- use `MemoryFact.id` as `canonicalId`;
- use owner `Context`;
- preserve bounded fact metadata such as subject/predicate/object, confidence, salience, scope, sensitivity, syncClass, trust, provenance source URI, and validity timestamps;
- receive only the deterministic `BELONGS_TO -> Project` relationship in A-08b.

Fact provenance edges to Artifact/Page/URL are intentionally not inferred in this slice.

## Verification

Exact PR head `c81674311587f6221331d73eb7baac02857b9d24`:

- CI `36147793139` — PASS
- Product Eval `36147793105` — PASS
- PCS-06 Integrated Browser Acceptance `36147793042` — PASS
- MCP External HTTPS Acceptance `36147793068` — PASS

Merged implementation main `bc5601602e401bb0f4d19f567b4dd10c6388f94d`:

- CI `36148568175` — PASS
- Product Eval `36148568188` — PASS
- MCP External HTTPS Acceptance `36148568214` — PASS

Automatic Staging Deploy `36149034797`:

- gate — PASS
- deploy — PASS
- `Deploy exact reviewed main SHA` — PASS

Therefore exact implementation main `bc5601602e401bb0f4d19f567b4dd10c6388f94d` is proven on staging.

## Rendered and runtime evidence

Coverage proves:

- a Context Fact lane is rendered in Brain;
- PCS-06 finds the Fact filter and canonical Fact node;
- real-owner runtime rebuilds the Project graph from Hub/Flow/Context owners;
- sibling-Project Fact rows are not disclosed;
- sensitivity is explicitly bounded;
- detaching a Project Source does not mutate or remove independent Context Facts.

## Explicit non-scope

A-08b does not add:

- Core Memory nodes;
- connector folder/resource hierarchy;
- Fact provenance edges;
- embedded Brain AI/chat;
- a graph store;
- cross-service DB reads;
- DR-2 or production cutover;
- provider spend.

## Safe resume

A-08b is closed. Any next Brain slice must remain additive and owner-backed.

Before opening another A-08 slice:

1. verify current `main` still descends cleanly from this implementation baseline;
2. select exactly one remaining Brain gap;
3. reuse canonical owner HTTP contracts and stable IDs;
4. do not synthesize canonical edges with an LLM;
5. keep Brain rebuildable;
6. add deterministic + rendered acceptance;
7. merge only with exact-head green gates and prove exact-SHA staging.

