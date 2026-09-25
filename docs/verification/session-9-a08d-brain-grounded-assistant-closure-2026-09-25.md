# Session 9 — A-08d Embedded Brain grounded assistant closure

Date: **2026-09-25**

Status: **CLOSED / PASS**

## Scope closed

A-08d embeds a selected-node grounded assistant in the existing Brain product surface without creating a second chat, history, graph, or model-dispatch system.

The implemented path is:

```text
selected Brain node
-> authorized bounded Brain neighborhood
-> exact URL Source + Context Fact identities
-> existing Ai /api/chat
-> Hub policy + history orchestration
-> Context authorization/retrieval narrowing
-> Connect local model dispatch
```

For this slice the Brain assistant is intentionally **local-only**. It sends `target: "local"`, uses the selected node's authorized one-hop neighborhood, and resets its dedicated session when the Project or selected node changes.

## Security and ownership behavior

- Brain remains a rebuildable read-only projection.
- Hub remains Project/policy/chat-history authority.
- Context remains canonical Fact/retrieval owner.
- Connect remains model-dispatch authority.
- Brain does not call `/v1/complete` directly.
- Exact Fact IDs and URL Source URIs only narrow Context candidates **after** normal Project/scope/sensitivity authorization.
- A Brain-grounded turn suppresses wider Project Core Memory and broad Artifact pointers rather than silently falling back outside the selected Brain context.
- Existing chat history is reused through the canonical Hub path; no Brain-specific conversation database exists.
- No hosted-provider path, provider spend, graph database, model-created canonical edge, connector hierarchy, Core Memory Brain node, A-09/A-10 refactor, DR-2, or production-cutover scope was introduced.
- A-08c `Fact --GENERATED_FROM--> Artifact` provenance remains intact and is exercised in the same rendered Brain journey.

## Implementation

Fresh implementation branch from post-A-08c current main:

```text
a08d/brain-grounded-chat-20260925
```

PR:

```text
#341 — feat: add A-08d embedded grounded Brain assistant
reviewed head: 39f1b4f96ddb38bf97f9fb2011d609e73b5d5030
merge:        1f25f32cdbb0bfd6dc043491f7668df6bc1795cb
```

The stale pre-A-08c prototype PR #337 was not revived. Its useful design was ported onto fresh current main; the previous formatting defect was corrected and A-08c provenance was preserved.

## Exact-head evidence

PR #341 exact head `39f1b4f96ddb38bf97f9fb2011d609e73b5d5030`:

- CI run `36164818566` / #2199 — **PASS**
- Product Eval `36164818478` / #1438 — **PASS**
- PCS-06 Integrated Browser Acceptance `36164818366` / #155 — **PASS**
- MCP External HTTPS Acceptance `36164818474` / #1120 — **PASS**

The rendered browser journey selects the canonical Fact, preserves the exact A-08c `GENERATED_FROM` relationship, opens the embedded grounded assistant, sends a local-only request with the exact Brain constraint, and receives the expected grounded reply.

## Merged-main evidence

Merged main `1f25f32cdbb0bfd6dc043491f7668df6bc1795cb`:

- CI `36165367393` / #2200 — **PASS**
- Product Eval `36165367357` / #1439 — **PASS**
- MCP External HTTPS Acceptance `36165367387` / #1121 — **PASS**

All CI verify steps passed, including format, lint, typecheck, tests, Phase 4 real-process acceptance, production-operations acceptance, secret/dependency/toolchain/release checks, and production build. Secret-history also passed.

## Staging evidence

The first post-merge Staging Deploy run `36165463942` / #1171 is **not** counted as a deployment: its gate passed but its `deploy` job was skipped while the peer merged-main gate was still incomplete.

The actual governed deployment is:

```text
Staging Deploy 36165821947 / #1172 — PASS
Deploy exact reviewed main SHA — PASS
sha: 1f25f32cdbb0bfd6dc043491f7668df6bc1795cb
tag: staging-1f25f32cdbb0
```

Post-deploy evidence:

- public auth bootstrap and protected Ai/API negative paths — **PASS**
- MCP protected-resource metadata + unauthenticated OAuth challenge — **PASS**
- authenticated Operations: `healthy: true`, no unhealthy services — **PASS**
- exact host `headSha == expectedSha` — **PASS**
- clean detached staging worktree — **PASS**
- configured services: **15**
- running services: **15**
- non-running services: **0**
- capacity stabilization: **25.03 GiB free**

Therefore A-08d is closed at the reviewed repository + merged-main + exact-SHA staging boundary.

## Remaining A-08 boundary

Embedded Brain AI/chat is no longer an open candidate.

The remaining independent A-08 candidates are:

1. connector/resource hierarchy, only where the connector exposes stable authorized canonical parent/child resource identities;
2. Core Memory representation, only if Context exposes a stable canonical identity suitable for a first-class Brain node.

Neither is implicitly authorized by this closure. A valid next decision is to select one bounded slice or explicitly defer one/both before A-09/A-10.

## Safe resume rule

- Start from current reviewed `main`.
- Do not reopen PR #337.
- Preserve Brain as rebuildable projection and reuse canonical owner services.
- Do not invent external hierarchy or Core Memory IDs.
- Do not start A-09/A-10 until the remaining A-08 boundary is explicitly selected or deferred.
