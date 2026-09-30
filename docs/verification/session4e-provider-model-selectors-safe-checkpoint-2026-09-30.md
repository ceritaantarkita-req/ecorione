# Session 4E Provider + Model Selectors Safe Checkpoint — 2026-09-30

**Status:** CLOSED / PASS / STAGING VERIFIED FOR THIS SLICE · SESSION 4E REMAINS ACTIVE / PARTIAL

## Scope closed by this checkpoint

This checkpoint closes the Session 4E canonical Ai selector slice:

- the composer now uses adjacent `[Provider / Source ▼] [Model ▼]` controls instead of a technical Local/Hosted route selector;
- Local plus first-class hosted providers are represented in the provider selector;
- connected providers are usable while providers without a stored credential remain visible but disabled;
- the model selector is provider-specific;
- provider/model changes apply to the next message inside the same conversation;
- compatible OpenRouter catalog models continue to use the trusted Connect-owned activation path and show provider-published input/output pricing;
- existing credential, spend, sensitivity, Project/history, fail-closed execution, and no-silent-fallback boundaries remain intact;
- selector presentation was extracted from the orchestration page, preserving the A-09 frontend decomposition guard.

This checkpoint does **not** close all of Session 4E.

## Reviewed PR head

```text
PR                  = #409
reviewed head       = 2efc0b56b9cc97f7ccdd11a13f7a4b979204945b
merged main         = e21f6f943fff9c0c2afdc71a45b05d6ab38eff76
staging image       = staging-e21f6f943fff
```

Exact PR-head proof:

- CI #2571 — PASS;
- Product Eval #1810 — PASS;
- PCS-06 Integrated Browser Acceptance #354 — PASS.

Merged-main proof:

- CI #2572 — PASS;
- Product Eval #1811 — PASS.

## Actual staging proof

Staging Deploy #1892 was gate-only and skipped its deploy job. It is not deployment proof.

Staging Deploy #1893 performed the real exact-SHA deployment and passed:

- target SHA `e21f6f943fff9c0c2afdc71a45b05d6ab38eff76`;
- host HEAD matched expected SHA exactly;
- clean detached staging worktree;
- image `staging-e21f6f943fff`;
- public boundary smoke PASS;
- Operations `healthy: true`;
- configured services: 15;
- running services: 15;
- non-running services: 0;
- host evidence free disk: 23.91 GiB;
- stale staging image cleanup completed;
- stabilized free disk: 25.26 GiB.

SumoPod remains staging, not production.

## Product behavior now proven

The normal Ai composer control is now:

```text
[ Provider / Source ▼ ]   [ Model ▼ ]
```

Proven behavior:

1. Local is a first-class source, not a technical route-mode label.
2. Anthropic, OpenAI, NVIDIA, and OpenRouter can appear as first-class hosted sources from the existing provider catalog.
3. Providers without stored credentials remain visible but disabled rather than silently disappearing or being auto-selected.
4. Selecting an available hosted provider activates it through the existing Connect runtime boundary.
5. Selecting a provider refreshes the model choices to that provider.
6. Selecting an OpenRouter dynamic model still goes through the trusted OpenRouter selection/activation path rather than generic runtime authority.
7. Provider/model switching does not create a new conversation; it changes the route for the next message.
8. OpenRouter catalog input/output pricing remains visible in the model selector.
9. Local unavailable state remains fail-closed; there is no silent fallback to Hosted.
10. The orchestration page remains below the audited A-09 40,000-character concentration guard after selector presentation extraction.

## Session 4E remains open

The accepted product contract is:
[../ai-provider-model-ux-contract.md](../ai-provider-model-ux-contract.md).

Still open:

- direct `+ Tambah AI` onboarding from the Ai page so normal connection setup does not require Settings;
- bounded Local↔Cloud context-handoff product behavior without silently uploading all local-only history;
- multi-credential AI Connections with priority/failover beneath one logical provider;
- the `Lainnya` / custom OpenAI-compatible connection path tied into normal Ai onboarding.

## Next bounded implementation slice

Implement **direct `+ Tambah AI` onboarding from the Ai page** only:

1. expose `+ Tambah AI` from the provider/source control;
2. open a lightweight Ai-page connection flow for first-class providers;
3. validate the credential through the existing Connect-owned provider test boundary;
4. save only after successful validation where the current provider contract requires it;
5. make the provider immediately available in the composer after successful connection;
6. keep Settings as management/Advanced, not a required detour;
7. do not introduce multi-credential persistence/failover or broad Local↔Cloud context-handoff redesign in this slice.

## Safe resume order

1. `docs/current-state-and-next-steps.md`;
2. `docs/active-work-plan.md`;
3. `docs/ai-provider-model-ux-contract.md`;
4. this checkpoint;
5. `AGENTS.md`;
6. inspect exact current `main` and current CI/deploy state before coding.

Do not redo the selector slice merely for freshness.
