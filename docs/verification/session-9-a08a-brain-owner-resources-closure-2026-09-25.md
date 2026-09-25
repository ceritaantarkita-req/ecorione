# Session 9 — A-08a Brain owner-resource projection closure — 2026-09-25

Status: **CLOSED / PASS**

Exact implementation main and proven staging runtime:

```
461a9665584b5e3a47396663cd4220f21c62027c
```

## Closed scope

PR **#333 — `feat: add first-class Brain Artifact and Page resources`** was squash-merged into main as:

```
461a9665584b5e3a47396663cd4220f21c62027c
```

A-08a is the first narrow richer-owner projection slice after A-07.

It adds first-class Brain nodes for canonical owner resources already authorized through Project Source views:

- **Artifact** — canonical Artifact ID, owner `Artifact`;
- **Page** — canonical Space page ID, owner `Space`.

The existing **Source** node remains the Project binding/reference. Brain adds deterministic `REFERENCES` edges from Source to the first-class owner resource and `BELONGS_TO` edges from the owner resource to Project.

## Architecture preserved

A-08a does **not** create a graph database or copy owner state.

The projection remains rebuildable from canonical owners:

- Hub authorizes the exact Workspace/Project first;
- Hub Project Source views supply the authorized resource binding and bounded owner metadata;
- Artifact/Page canonical IDs remain their owner identities;
- Brain stores no canonical resource state;
- no model/LLM call creates canonical edges;
- no direct Context/Space/Artifact database read was introduced;
- no owner mutation was introduced.

Unavailable Project Source bindings remain explicit through Brain availability metadata.

## Exact-head evidence

Reviewed PR head:

```
dcb6d133cfdffda990201a986ff3f768e2243200
```

PASS:

- CI **`36141048119`**
- Product Eval **`36141048146`**
- PCS-06 Integrated Browser Acceptance **`36141048129`**
- MCP External HTTPS Acceptance **`36141048157`**

Rendered PCS-06 proves first-class **Artifact** and **Page** nodes are visible and selectable while the Brain graph remains contained.

## Merged-main evidence

Merged main:

```
461a9665584b5e3a47396663cd4220f21c62027c
```

PASS:

- CI **`36141655282`**
- Product Eval **`36141655343`**
- MCP External HTTPS Acceptance **`36141655291`**

## Exact staging proof

Automatic Staging Deploy **`36142092154`**:

- gate — PASS
- deploy — PASS
- `Deploy exact reviewed main SHA` — PASS

Therefore exact implementation main `461a9665584b5e3a47396663cd4220f21c62027c` is the proven staging runtime revision at this checkpoint.

## Remaining A-08 scope

A-08 is **not globally closed**.

Remaining intended richer Brain projection includes owner-backed memory/facts and other hierarchy classes only where stable authorized owner identity exists. Embedded Brain AI/chat remains separable and must not be used to invent canonical relationships.

### Audited next candidate — A-08b Context Facts

Current Context contracts provide a safe candidate for the next narrow slice:

- `MemoryFactSchema.id` is a stable canonical `MemoryFactId`;
- facts are Project-scoped through `projectId`;
- Context exposes `GET /v1/facts` as the owner read API;
- the API supports bounded `limit` and `maxSensitivity`;
- live facts are the default list behavior;
- Project authorization can remain Hub-first before Brain queries Context.

A-08b may therefore add first-class **Fact** nodes by reading the Context owner API **after exact Hub Project authorization**. It must not read Context DB directly.

Recommended safety boundary for A-08b:

- add `Fact` to Brain node types and `Context` to Brain owners;
- bounded owner fetch, default internal HTTP deadline;
- exact Project filter;
- cap sensitivity at `RESTRICTED`;
- bounded count;
- canonical ID = `MemoryFact.id`;
- deterministic Project relationship only from owner-returned Project facts;
- no fact mutation;
- no LLM-generated relationships;
- no graph store;
- no hosted inference;
- deterministic source/unit/browser coverage before merge.

Core-memory blocks, connector folder/resource hierarchy, and embedded Brain AI/chat remain separate later slices and must not be bundled into A-08b.

## Safe resume rule

1. verify current `main` is still at or descends cleanly from `461a9665584b5e3a47396663cd4220f21c62027c`;
2. do not reopen A-07;
3. open A-08b as a narrow Context-Fact projection branch only;
4. preserve Hub-first Project authorization;
5. use Context HTTP owner contract, never Context DB access;
6. fail closed on Context owner failure or mismatched Project data;
7. merge only after exact-head CI/Product Eval/PCS-06 gates are green;
8. verify merged-main gates + exact-SHA staging before closure.

