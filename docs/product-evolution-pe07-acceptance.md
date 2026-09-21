# PE-07 acceptance contract

Last updated: **2026-09-21**

Status: **CLOSED / SATISFIED — PR #178**

PE-07 connects the already-closed Brain V1 projection to the existing Context retrieval and ECX optimization path. The purpose is to test whether deterministic Project/Brain neighborhoods can reduce the candidate set before Context + ECX without weakening retrieval quality, provenance, authorization, or owner boundaries.

PE-07 is an optimization/evaluation batch. It is not authorization to create a second retrieval engine, graph database, canonical Brain store, paid benchmark run, or new model/provider boundary.

## Product path

The target path is:

```text
Question
-> Workspace + Project boundary
-> Brain neighborhood
-> Context retrieval
-> ECX semantic-v1
-> bounded context pack
-> model
```

Ownership remains unchanged:

- Brain owns deterministic relationship/neighborhood projection only;
- Context owns memory semantics, authorization-sensitive retrieval, provenance, trust, invalidation, and ranking inputs;
- ECX owns context-pack selection/optimization;
- Connect owns provider/model routing, credentials, spend controls, and model identity;
- Hub remains policy/authority/audit owner.

## Brain neighborhood contract

PE-07 may add a bounded neighborhood-selection contract over the PE-06 Brain graph.

Required:

- explicit Workspace + Project;
- deterministic seed identity;
- explicit supported node/edge filters;
- deterministic ordering;
- explicit maximum nodes/edges/hops;
- no sibling-Project disclosure;
- no unbounded traversal;
- no hidden LLM/entity inference to decide canonical neighborhood membership.

A Brain neighborhood is a candidate constraint, not final retrieval authority.

## Context integration contract

Context remains retrieval owner.

Brain-derived narrowing may be supplied to Context only through an explicit, validated request contract. Context must still apply its existing rules for:

- Workspace/Project scope;
- global + current-Project memory precedence;
- sensitivity;
- syncClass;
- trust;
- quarantine/promotion;
- invalidation;
- provenance;
- retrieval scoring/ranking.

Brain narrowing must never permit a record that Context would otherwise reject.

The no-Brain path must remain available as a control/baseline and for safe fallback. A Brain failure must not silently widen to sibling Projects.

## ECX integration contract

ECX remains the context-pack optimizer after Context retrieval.

PE-07 may pass the Brain-narrowed Context candidate set into existing `semantic-v1` selection/hydration behavior, but Brain must not replace ECX ranking/selection.

Do not rename an oracle/reference-known lane into an automatic selector. If relevance labels are supplied by a fixture, results must remain identified as oracle/upper-bound evidence.

## Evaluation design

PE-07 must measure whether Brain narrowing actually helps.

Use a bounded evaluation set derived from real repository/product tasks or explicitly documented fixtures. The evaluation must compare at least:

```text
baseline
  Project -> Context -> ECX

brain-narrowed
  Project -> Brain neighborhood -> Context -> ECX
```

Where useful, include an oracle/reference-known lane only as a labeled upper bound.

Record per-case and aggregate:

- candidate count before/after Brain narrowing;
- selected reference IDs;
- retrieved/context bytes;
- model input tokens when a measured local model call is part of the authorized test;
- deterministic task quality/retention;
- provenance/required-reference retention;
- latency;
- cache state;
- exact model/runtime identity when model execution occurs;
- hosted billed cost only if separately authorized.

## Quality and safety gates

A lower candidate/token count is not a PASS by itself.

PE-07 must fail the optimization claim when narrowing causes unacceptable loss of required evidence or deterministic task quality.

Required negative/security checks:

- Project A cannot retrieve or infer Project B candidates;
- cross-Workspace requests fail closed;
- Brain unavailable/degraded path does not fabricate candidate membership;
- invalid/revoked Context records remain excluded;
- sensitivity/syncClass/trust rules remain binding;
- provenance is preserved through Context + ECX;
- Brain cannot inject raw graph data as trusted prompt instructions;
- Context/ECX authorization cannot be bypassed by a Brain node ID.

## Claim boundary

PE-07 evidence is workload-bounded.

Do not claim:

- universal token savings;
- universal latency improvement;
- universal quality improvement;
- hosted-provider billed-cost savings from local-only runs;
- automatic semantic relevance when the test used oracle/reference-known labels;
- that deeper graph complexity is justified merely because Brain exists.

If measured benefit is absent or inconsistent, preserve that result and keep the simpler architecture.

## Cost boundary

No paid provider call is authorized by PE-07 merely because cost is a metric.

Default evaluation should use deterministic non-model checks and/or the existing local runtime. Any hosted/provider billed-cost measurement requires separate explicit operator authorization for scope and budget.

## Predeclared closure-grade thresholds

Declared on **2026-09-19 before the first PE-07 closure-grade evidence run**. These gates must not be loosened in response to a failing result.

Safety/retention gates:

- required/authoritative reference retention: **100% per case**;
- unauthorized sibling-Project or cross-Workspace references: **0**;
- invalidated, over-sensitivity, disallowed syncClass, or otherwise Context-rejected facts admitted by Brain narrowing: **0**;
- ECX-selected memory-fact refs outside the Context-authorized result set: **0**;
- Brain failure/unknown seed fallback that widens to baseline automatically: **0**;
- provenance retained for every selected Context fact: **100%**.

Optimization gates:

- narrowed candidate count must be **<= baseline authorized candidate count in every measured case**;
- an `optimization-positive` conclusion requires a **median candidate-count reduction >= 25%** and strict reduction in **at least 2/3 measured cases**;
- if the safety/retention gates pass but the optimization gate does not, PE-07 evidence must say **NO MEASURED BENEFIT / DO NOT ENABLE BRAIN NARROWING BY DEFAULT** rather than weakening the threshold.

Measurement boundary for the first closure-grade lane:

- deterministic local repository fixtures, no hosted/provider call;
- model input tokens/model quality: **N/A unless a separately authorized local-model lane is added**;
- provider billed cost: **N/A / not authorized**;
- cache state: **N/A for the deterministic no-model lane**;
- latency is reported as observed evidence, not used as a universal performance claim.

## Required implementation tests

```text
bounded Brain neighborhood contract
deterministic neighborhood ordering
Project A/B isolation
cross-Workspace fail closed
Context request validates Brain narrowing input
Context still applies scope/sensitivity/syncClass/trust/invalidation
baseline path remains available
Brain failure does not widen scope
ECX receives only Context-authorized candidates
provenance survives narrowing + selection
no entire Brain graph dumped into prompt
no model call required for authorization
no graph DB / second retrieval database
normal CI
Product Eval
relevant owner/security acceptance
```

## Required measurement

PE-07 cannot close on integration tests alone.

Closure evidence must include a bounded comparative run that reports both benefit and retention/quality, with the exact dataset/task set, code revision, cache policy, and runtime/model identity where applicable.

At minimum, closure must answer:

1. how many Context candidates existed before Brain narrowing?
2. how many remained after Brain narrowing?
3. were all required/authoritative references retained?
4. did deterministic answer quality stay within the predeclared gate?
5. what happened to input/context size and latency?
6. were any regressions hidden by aggregate medians?
7. does the evidence justify keeping Brain narrowing in the product path?

Thresholds must be declared before the closure-grade run and must not be weakened after observing failures.

## Non-goals

PE-07 does not authorize:

- a new graph database;
- persistent Brain canonical state;
- a replacement Context retriever;
- a replacement ECX selector;
- a second vector/FTS owner;
- broad LLM graph extraction;
- autonomous polling;
- new Trigger semantics;
- a Task domain;
- L4 autonomy;
- production VPS/Cloudflare activation;
- paid hosted evidence without explicit authorization.

## Implementation evidence checkpoint

Reviewed implementation head: `892726c20ac95dded26fdc3fd2000ad4bb56363d`.

```text
CI                              35447877629 / #1457 PASS
Product Eval                    35447877612 / #696  PASS
MCP External HTTPS Acceptance   35447877592 / #855  PASS
```

The closure-grade deterministic/no-model lane passed the predeclared gates:

- 3 measured cases;
- baseline candidates = 3 and narrowed candidates = 1 in every case;
- median candidate reduction = **66.67%**;
- strict reduction = **3/3 cases**;
- required-reference retention = **100%**;
- provenance retention = **100%**;
- unauthorized references = **0**;
- sibling-Project leaks = **0**;
- restricted-data leaks = **0**.

Evidence: [verification/pe-07-brain-context-ecx-closure-2026-09-19.md](verification/pe-07-brain-context-ecx-closure-2026-09-19.md).

Documentation closure head `e443a6e9d10b24b7c1de7bcb315b038cf6425a45` then passed CI #1462, Product Eval #701, and MCP #860. PR #178 merged to `main` as `15e31ed4b03f5be5bc6a7104fc14bb1dd0917743`. PE-07 is CLOSED / SATISFIED.

## End-to-end closure proof

PE-07 must prove one real bounded Project path:

```text
authorized Project question
-> deterministic Brain neighborhood
-> Context retrieval under existing policy
-> ECX semantic-v1 context pack
-> deterministic quality/provenance check
-> comparative baseline vs narrowed metrics
```

Historical sequencing gate: the exact reviewed PE-07 head had to pass CI, Product Eval, and every relevant acceptance gate before PE-08 could begin. That gate was satisfied; PE-08 and PCS-00..PCS-10 subsequently closed.
