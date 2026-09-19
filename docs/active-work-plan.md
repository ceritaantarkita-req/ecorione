# ECORIONE — Active Work Plan

Last updated: **2026-09-19**

Status: **PE-07 ACTIVE / BRAIN + CONTEXT + ECX**

## Latest closed item

**PE-06 — Brain V1**

```text
PR #176
reviewed implementation head 66c7909572a1410095916843f8f46a385ecb628b
closure evidence head 25508dd1cef5d8ebb8846448c7732ddde7866a59
implementation CI 35444095549 PASS
implementation Product Eval 35444095553 PASS
implementation MCP External HTTPS Acceptance 35444095552 PASS
closure-head CI 35444433296 PASS
closure-head Product Eval 35444433240 PASS
closure-head MCP External HTTPS Acceptance 35444433249 PASS
merge main d54ad62c303847b23634ba33aead4749f21bf1d0
```

Acceptance: [product-evolution-pe06-acceptance.md](product-evolution-pe06-acceptance.md).  
Closure evidence: [verification/pe-06-brain-v1-closure-2026-09-19.md](verification/pe-06-brain-v1-closure-2026-09-19.md).

## Active item

**PE-07 — Brain + Context + ECX**

Implementation branch: `pe/pe-07-brain-context-ecx-20260919`, created from synchronized `main` `ffa1531a12a1149d3dfceaea8f82e53619e938d4` after PR #177 merged.

Architecture boundary: [adr/0038-brain-derived-projection.md](adr/0038-brain-derived-projection.md).  
Acceptance: [product-evolution-pe07-acceptance.md](product-evolution-pe07-acceptance.md).

Current boundary:

- target path is Project -> Brain neighborhood -> Context retrieval -> ECX `semantic-v1` -> context pack;
- Brain supplies bounded deterministic candidate narrowing only;
- Context remains memory/retrieval owner and still enforces Project, sensitivity, syncClass, trust, quarantine, invalidation, provenance, and ranking rules;
- ECX remains context-pack selection/optimization owner;
- Connect remains provider/model/spend boundary;
- preserve an explicit no-Brain baseline/control path;
- Brain failure must not silently widen to sibling Projects;
- comparative evaluation must measure candidate count, selected refs, context/input size, deterministic quality/retention, provenance retention, latency, cache state, and exact model identity where applicable;
- thresholds must be declared before closure-grade measurement and must not be weakened after failures;
- oracle/reference-known lanes must stay labeled as oracle/upper-bound evidence;
- no graph database, second retriever/vector owner, broad LLM extraction, or full Brain graph prompt dump;
- no paid hosted/provider calls without explicit operator authorization.

Implementation checkpoint:

- bounded Brain neighborhood schema/query is implemented over the PE-06 derived graph;
- URL Source nodes may emit an exact bounded `sourceUris` constraint;
- Context applies that optional constraint only after its existing authorization/policy candidate set is built;
- omitted constraint is the explicit baseline; an explicit empty constraint is fail-closed and returns zero candidates;
- the PE-07 integration path sends only Context retrieval hits to ECX as `memoryFact` refs, then uses existing `semantic-v1` selection;
- no model/provider call is part of authorization or the first deterministic evidence lane;
- predeclared closure thresholds are frozen in the PE-07 acceptance contract before the first evidence run.

Dependency gate:

```text
PE-06  CLOSED / PASS
PE-07  ACTIVE — Brain + Context + ECX
PE-08  BLOCKED BY PE-07
```

PE-08 remains blocked until PE-07 closes on an exact reviewed and merged head.

## Non-negotiable boundaries

- no second scheduler/retry database;
- Temporal remains durability/timer/retry owner;
- Trigger never grants authority;
- no always-on LLM polling;
- MAX_AUTONOMY_V1 stays L3;
- Workspace remains the authority boundary;
- Context remains retrieval owner;
- ECX remains context-pack optimizer;
- VPS/Cloudflare, AutoClick, and paid W18 rerun remain out of scope.
