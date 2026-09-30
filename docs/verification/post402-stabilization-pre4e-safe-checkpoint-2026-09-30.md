# Post-#402 Stabilization / Pre-4E Safe Checkpoint — 2026-09-30

**Status:** SAFE REPOSITORY HANDOFF · SESSION 4E NOT YET OPENED

## Repository state

```text
main                 = d32527cb21e3b7209b28b109083be00671464b2b
source stabilization = PR #405
exact PR head        = 32daed745625c9ede012912a19b8b77d5f89ec90
```

PR #405 stabilized the repository state left by merged PR #402. It did not implement the accepted Session 4E product UX.

## Exact-head proof for PR #405

The final PR #405 head passed:

- CI #2539 — PASS;
- Product Eval #1778 — PASS;
- PCS-06 Integrated Browser Acceptance #328 — PASS.

The fixes included the post-#402 formatting/lint/test drift, browser acceptance drift, Local AI source-contract drift, dynamic OpenRouter runtime-slug expectations, Settings concentration/decomposition regression, and related browser mock expectations.

## Merged-main follow-up

After merge to `main` as `d32527cb...`:

- Product Eval #1779 — PASS;
- CI #2540 — PASS;
- Staging Deploy #1835 — PASS.

Staging Deploy #1835 deployed exact SHA `d32527cb21e3b7209b28b109083be00671464b2b` as image `staging-d32527cb21e3`. Public smoke passed, Operations reported `healthy: true`, all **15/15** configured services were running, the host SHA matched exactly, and capacity stabilized at **27.41 GiB free**.

The current actual staging-verified runtime baseline is therefore `d32527cb...`.

## Product direction after stabilization

PR #402's `Search → Test & Enable → Ready` path is a stable **interim implementation**, not the accepted final normal-user experience.

The accepted product contract is:

[../ai-provider-model-ux-contract.md](../ai-provider-model-ux-contract.md)

Normal Ai UX target:

```text
[ Provider / Source ▼ ]   [ Model ▼ ]
```

with:

- direct `+ Tambah AI` onboarding from Ai;
- provider/model switching within the same conversation;
- compatible OpenRouter catalog models available without normal-user per-model certification;
- input/output token price visibility;
- bounded Local↔Cloud context handoff;
- multiple credentials represented underneath one logical provider connection.

## Session 4E boundary

The repository-stability prerequisite is satisfied.

Session 4E is still **not implicitly active**. Runtime implementation begins only when explicitly opened, and it must follow the accepted AI provider/model UX contract rather than scaling the interim `Test & Enable` workflow.

## Safe resume order

1. `docs/current-state-and-next-steps.md`;
2. `docs/active-work-plan.md`;
3. `docs/ai-provider-model-ux-contract.md`;
4. this checkpoint;
5. `AGENTS.md`;
6. inspect exact live `main` and current CI/deploy evidence before coding.
