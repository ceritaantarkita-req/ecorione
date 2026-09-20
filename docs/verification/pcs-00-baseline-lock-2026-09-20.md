# PCS-00 — Baseline Lock

Date: **2026-09-20**

Status: **CANDIDATE / AWAITING EXACT-HEAD GATES**

## Purpose

Lock the reproducible starting point for the post-closure PCS-00..PCS-10 roadmap before product behavior changes begin.

This is a baseline/evidence batch. It does not add product features, reopen Product Evolution, activate production, or weaken existing owner/security boundaries.

## Locked starting point

```text
repository                 ceritaantarkita-req/ecorione
baseline branch            main
baseline commit            93c5312d73289305d3e16ff79c5457a5010d0b19
roadmap PR                 #188
roadmap reviewed head      c4088bd04298d42809b7b012b353d2e977e7a931
roadmap CI                 #1490 PASS
roadmap Product Eval       #729 PASS
```

The locked commit is the merge of the operator-approved PCS roadmap. Product work after PCS-00 must branch from synchronized reviewed `main` and preserve the repository closure discipline.

## Preserved architecture/security boundaries

PCS work must preserve all closed owner boundaries, including:

- Workspace remains the authority/security boundary.
- Hub remains policy, approval, audit, and capability authority.
- Connect remains provider credential, MCP runtime, and hosted-spend owner.
- Context remains retrieval/memory-semantics owner; Artifact remains raw-byte owner.
- Temporal remains Flow durability/timer/retry/state/recovery owner.
- Brain remains derived/rebuildable rather than a canonical graph store.
- ECX remains the context-pack optimizer.
- No second scheduler/retry database.
- No silent provider fallback.
- No secret is committed to Git.
- Local inference remains OpenAI-compatible; Ollama remains optional.
- SumoPod is staging/remote development, not production.
- Public production cutover, AutoClick, and L4 autonomy remain outside this baseline.

## Verification contract for PCS product changes

Before merge, a PCS implementation head must pass the relevant repository gates without weakening them to manufacture PASS. The normal baseline includes:

- canonical formatting / `format:check`;
- lint;
- typecheck;
- deterministic automated tests;
- secret scan;
- production build;
- Product Eval;
- any scope-specific acceptance workflow required by the changed subsystem.

Behavioral/policy changes require deterministic regression coverage. Browser/runtime claims require browser/runtime evidence and must not be inferred only from source tests.

## Git and closure contract

```text
synchronized reviewed main
  -> short-lived explicit PCS branch
  -> bounded implementation + tests
  -> PR
  -> exact-head required gates
  -> reviewed head only
  -> squash/approved merge
  -> current docs/evidence synchronized
  -> next PCS batch
```

GitHub `main` remains the source of truth. A live SumoPod working tree must not become an unmanaged development source.

## PCS-00 acceptance

PCS-00 can close only when:

1. the exact starting `main` commit is recorded;
2. the PCS roadmap head is confirmed green on CI and Product Eval;
3. the preserved architecture/security boundaries are explicit;
4. the required verification and merge discipline for PCS work are explicit;
5. current status docs point to this baseline;
6. this PCS-00 exact head passes CI + Product Eval.

Until item 6 passes, status remains **CANDIDATE**.
