# PE-07 Brain + Context + ECX closure evidence

Last updated: **2026-09-19**

Status: **CLOSED / PASS**

## Reviewed implementation

```text
PR                              #178
branch                          pe/pe-07-brain-context-ecx-20260919
reviewed implementation head    892726c20ac95dded26fdc3fd2000ad4bb56363d
CI workflow run                 35447877629 / #1457 PASS
Product Eval workflow run       35447877612 / #696 PASS
MCP External HTTPS workflow run 35447877592 / #855 PASS
closure evidence head           e443a6e9d10b24b7c1de7bcb315b038cf6425a45
closure-head CI                 35448099910 / #1462 PASS
closure-head Product Eval       35448099971 / #701 PASS
closure-head MCP HTTPS          35448099995 / #860 PASS
merge main                      15e31ed4b03f5be5bc6a7104fc14bb1dd0917743
```

The reviewed implementation head passed the required exact-head repository gates before this closure record was added.

Acceptance contract: [../product-evolution-pe07-acceptance.md](../product-evolution-pe07-acceptance.md).  
Architecture boundary: [../adr/0038-brain-derived-projection.md](../adr/0038-brain-derived-projection.md).

## Delivered boundary

PE-07 connects the PE-06 derived Brain projection to existing Context retrieval and ECX optimization without moving ownership.

```text
authorized Workspace + Project
-> bounded deterministic Brain neighborhood
-> exact Brain-derived sourceUri candidate constraint
-> Context authorization/policy + retrieval/ranking
-> Context-authorized memoryFact refs
-> existing ECX semantic-v1 selection/hydration
-> bounded context pack
```

Ownership remains:

- Brain = deterministic relationship/neighborhood projection;
- Context = memory/retrieval/policy/provenance owner;
- ECX = context-pack optimizer;
- Hub = Workspace/Project authority;
- Connect = provider/model/spend boundary.

No graph database, canonical Brain persistence, second FTS/vector owner, second retriever, or model-based authorization was added.

## Brain neighborhood proof

PE-07 adds a bounded neighborhood contract over the existing PE-06 graph.

The request requires:

- explicit Workspace + Project;
- one or more deterministic seed node IDs;
- max hops bounded to 0..2;
- max nodes bounded to 1..64;
- optional supported node/edge filters.

Unknown/unauthorized seeds fail closed. The neighborhood cannot silently fall back to a wider baseline.

For available URL Source nodes the neighborhood may emit a bounded, sorted `sourceUris` candidate constraint. Brain does not rank memory facts and does not inject raw graph content into the prompt.

## Context ownership proof

Context accepts optional `candidateSourceUris`.

Semantics are intentionally different:

```text
candidateSourceUris omitted   -> explicit no-Brain baseline
candidateSourceUris []        -> fail-closed zero candidates
candidateSourceUris [uris...] -> exact intersection
```

Context first builds its normal authorized candidate set under existing Project/global, sensitivity, syncClass, invalidation and retrieval rules. Only then is the Brain provenance constraint intersected.

The Brain constraint therefore cannot admit a record that Context policy would otherwise reject.

Diagnostics expose:

- authorized candidate count;
- narrowed candidate count;
- whether a constraint was applied.

## ECX ownership proof

The PE-07 integration path converts only Context retrieval hits into ECX `memoryFact` refs.

ECX then uses the existing `semantic-v1` selector/hydration contract. Brain does not replace ECX selection and cannot pass an unauthorized fact directly into ECX.

Integration/source-contract tests prove:

- baseline remains available without Brain traversal;
- narrowed mode passes the exact Brain source constraint to Context;
- only Context hits become ECX refs;
- unknown Brain seed fails before Context/ECX;
- no completion/model call is required for authorization;
- no entire Brain graph is dumped into a prompt.

## Predeclared measurement gates

The acceptance contract froze the closure-grade gates before the evidence run:

```text
required-reference retention      100% per case
unauthorized references           0
provenance retention              100%
narrowed candidates               <= baseline in every case
optimization-positive median      >= 25% candidate reduction
strict reduction                  >= 2/3 measured cases
```

No threshold was weakened after observing failures.

## Deterministic comparative evidence

Product Eval run `35447877612` / #696 executed the governed PE-07 evidence on reviewed implementation head `892726c20ac95dded26fdc3fd2000ad4bb56363d`.

Profile:

```text
cases             3
runtime lane      deterministic-no-model
model identity    N/A
cache state       N/A
hosted cost       N/A / not authorized
```

Aggregate result:

```text
required-reference retention 100%
provenance retention         100%
unauthorized references      0
median candidate reduction   66.67%
strict reduction cases       3 / 3
```

Per-case result:

| Case | Baseline candidates | Narrowed candidates | Reduction | Baseline context bytes | Narrowed context bytes | Required ref retained |
|---|---:|---:|---:|---:|---:|---:|
| routing | 3 | 1 | 66.67% | 1647 | 592 | yes |
| backup | 3 | 1 | 66.67% | 1672 | 600 | yes |
| release | 3 | 1 | 66.67% | 1664 | 594 | yes |

Each case also reported sibling-Project leak = false and restricted-data leak = false.

Observed local fixture latency was lower in the narrowed lane for all three cases, but latency is not used as a universal performance claim.

The bounded evidence therefore satisfies the predeclared optimization-positive threshold for this workload while preserving the required references and provenance.

## Eval-governance repair discovered during PE-07

During PE-07 verification, the repository-wide Vitest configuration was found not to include `evals/**/*.test.ts`. Explicit Product Eval commands named eval files, but Vitest discovery silently excluded them.

PE-07 repairs that defect by adding governed `evals/` discovery. Once enabled, stale provenance references in existing eval manifests were exposed and repaired from mutable `docs/active-work-plan.md` references to the stable F6-E01 verification record.

The exact implementation Product Eval subsequently executed and passed:

- product regressions;
- eval inventory budget;
- held-out ECX selector eval;
- PE-07 comparative evidence;
- PE-07 Brain/Context/ECX regressions.

This repair strengthens existing eval governance rather than changing PE-07 thresholds.

## Exact-head repository gates

Implementation head `892726c20ac95dded26fdc3fd2000ad4bb56363d`:

```text
CI                              35447877629 / #1457 PASS
Product Eval                    35447877612 / #696  PASS
MCP External HTTPS Acceptance   35447877592 / #855  PASS
```

CI `verify` passed the normal formatting, lint, typecheck, test, runtime acceptance, security/toolchain review, and production build chain. CI naming and secret-history jobs also passed.

## Claim boundary

This evidence supports a bounded repository conclusion only:

- Brain narrowing can materially reduce Context candidates on the measured fixtures;
- required references and provenance were retained on those fixtures;
- authorization isolation remained intact on the covered negative paths.

It does **not** establish universal token, latency, answer-quality, or hosted-cost improvement.

No hosted/provider billed call was authorized or executed for this PE-07 evidence.

## Closure

Documentation closure head `e443a6e9d10b24b7c1de7bcb315b038cf6425a45` passed:

```text
CI                              35448099910 / #1462 PASS
Product Eval                    35448099971 / #701  PASS
MCP External HTTPS Acceptance   35448099995 / #860  PASS
```

PR #178 was marked ready and merged to `main` as `15e31ed4b03f5be5bc6a7104fc14bb1dd0917743`.

PE-07 is CLOSED / PASS. PE-08 Product closure may proceed as the next and final Product Evolution batch.
