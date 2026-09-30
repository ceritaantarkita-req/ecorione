# Session 4E Direct + Tambah AI Safe Checkpoint — 2026-09-30

**Status:** CLOSED / PASS / STAGING VERIFIED FOR THIS SLICE · SESSION 4E REMAINS ACTIVE / PARTIAL

## Scope closed by this checkpoint

This checkpoint closes the bounded Session 4E direct provider-onboarding slice from the accepted AI provider/model UX contract:

- `+ Tambah AI` is available directly from the Ai `Provider / Source` selector;
- the user can choose an unconnected first-class hosted provider and enter its API key without leaving the conversation;
- the single `Connect` action validates the credential through the existing Connect provider-test boundary before persistence;
- the credential is saved only after a passing validation through the existing Connect credential endpoint / Vault ownership boundary;
- successful onboarding activates the provider through the existing trusted runtime/OpenRouter activation paths;
- provider/model choices refresh immediately and the same conversation remains active;
- already-connected providers are not replaced from the lightweight onboarding surface; replacement/advanced management remains in Settings;
- the normal flow does not expose a separate user-facing `Test API key` step;
- `Lainnya` / custom-provider onboarding remains explicitly deferred rather than being partially generalized in this slice;
- credential plaintext, spend, sensitivity, Project/history, no-silent-fallback, and Connect/Hub authority boundaries remain unchanged.

This checkpoint does **not** close all of Session 4E.

## Reviewed PR head

```text
PR                  = #411
reviewed head       = 011ac87b07d12608c7da3906ccbbc064d7701b3c
merged main         = 2c223ea8c54045de3dc5e6b15971bdb2a898e2fe
staging image       = staging-2c223ea8c540
```

Exact PR-head proof:

- CI #2585 — PASS;
- Product Eval #1824 — PASS;
- PCS-06 Integrated Browser Acceptance #365 — PASS.

Merged-main proof:

- CI #2586 — PASS;
- Product Eval #1825 — PASS.

## Actual staging proof

Staging Deploy #1921 was gate-only and skipped its deploy job. It is not deployment proof.

Staging Deploy #1922 performed the real exact-SHA deployment and passed:

- target SHA `2c223ea8c54045de3dc5e6b15971bdb2a898e2fe`;
- host HEAD matched expected SHA exactly;
- clean detached staging worktree;
- image `staging-2c223ea8c540`;
- public boundary smoke PASS;
- Operations `healthy: true`;
- configured services: 15;
- running services: 15;
- non-running services: 0;
- host evidence free disk before stale-image cleanup: 26.03 GiB;
- stale staging image cleanup retained the new and previous rollback-set images;
- stabilized free disk: 27.35 GiB.

SumoPod remains staging, not production.

## Product behavior now proven

The normal onboarding path is now:

```text
Ai
 → Provider / Source
 → + Tambah AI
 → choose first-class provider
 → paste API key
 → Connect
 → validate
 → encrypt/save in Connect Vault
 → activate provider
 → refreshed provider/model choices
 → continue the same conversation
```

PCS-06 browser acceptance proves the direct flow using an unconnected OpenAI fixture:

1. `+ Tambah AI` exists inside the provider/source selector;
2. an already-connected OpenRouter option remains unavailable for replacement in this flow;
3. no separate `Test API key` control is shown;
4. `Connect` validates before persistence;
5. the OpenAI credential becomes present in the Connect-owned credential snapshot;
6. OpenAI becomes the active provider in the existing chat;
7. its provider-specific model list refreshes;
8. the active conversation/session id does not change;
9. narrow viewport and broader PCS-06 regression acceptance remain PASS.

The browser fixture proves product wiring and ordering; it does not claim a real user OpenAI secret was entered or a paid live completion was performed.

## Session 4E remains open

Accepted product contract:
[../ai-provider-model-ux-contract.md](../ai-provider-model-ux-contract.md).

Still open:

- bounded Local↔Cloud context handoff without silently uploading the full local-only conversation;
- multi-credential AI Connections with priority/failover beneath one logical provider;
- `Lainnya` / custom OpenAI-compatible provider onboarding;
- broader live cross-provider completion evidence where real credentials/providers are available.

## Next bounded implementation slice

Implement **bounded Local↔Cloud context handoff** only:

1. preserve same-conversation switching while preventing silent upload of the entire local-only transcript;
2. make Project/sensitivity/policy boundaries explicit in the handoff decision;
3. use the existing Historical Ledger + Context/Brain/ECX ownership path for bounded relevant context instead of creating a second memory system;
4. preserve per-response provider/model/cost provenance;
5. fail closed or require explicit confirmation when policy does not permit a cloud handoff;
6. do not combine multi-credential persistence/failover or custom-provider generalization into this slice unless a failing invariant requires it.

Broader live-provider proof can be added when suitable real credentials are available, but it is not a reason to block the next repository-owned implementation slice.

## Safe resume order

1. `docs/current-state-and-next-steps.md`;
2. `docs/active-work-plan.md`;
3. `docs/ai-provider-model-ux-contract.md`;
4. this checkpoint;
5. `AGENTS.md`;
6. inspect exact current `main` and current CI/deploy state before coding.

Do not redo the auto-execution, canonical-selector, or direct-onboarding slices merely for freshness.
