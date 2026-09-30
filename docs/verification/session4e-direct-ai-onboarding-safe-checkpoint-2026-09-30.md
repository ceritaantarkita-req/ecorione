# Session 4E Direct Ai Onboarding Safe Checkpoint — 2026-09-30

**Status:** CLOSED / PASS / STAGING VERIFIED FOR THIS SLICE · SESSION 4E REMAINS ACTIVE / PARTIAL

## Scope closed by this checkpoint

This checkpoint closes the direct `+ Tambah AI` onboarding slice from the accepted Session 4E product contract:

- `+ Tambah AI` is available directly from the Ai `Provider / Source` selector;
- the normal connection flow stays inside Ai instead of forcing a Settings detour;
- one `Connect` action performs the existing Connect credential test first and persists only after PASS;
- credential storage still uses the existing Connect Vault boundary; Ai does not own a second credential store;
- successful activation refreshes provider/model choices and keeps the same conversation;
- Settings remains the management/Advanced surface;
- already-connected providers cannot be replaced through this first-time onboarding path;
- the custom `Lainnya` path remains visibly deferred in this slice;
- multi-credential storage/failover and Local↔Cloud handoff are not implemented by this slice.

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
- host evidence free disk before cleanup: 26.03 GiB;
- rollback-set cleanup retained the new image and previous rollback image;
- stabilized free disk: 27.35 GiB.

SumoPod remains staging, not production.

## Product behavior now proven

Normal onboarding can now be completed directly from Ai:

```text
[ Provider / Source ▼ ]
        ↓
    + Tambah AI
        ↓
choose provider
        ↓
paste API key
        ↓
      Connect
        ↓
Connect validates
        ↓
Connect Vault stores only after PASS
        ↓
provider activates + model choices refresh
        ↓
same conversation continues
```

The primary flow does not expose a separate `Test API key` step.

## Session 4E remains open

The accepted product contract is:
[../ai-provider-model-ux-contract.md](../ai-provider-model-ux-contract.md).

Still open:

- multi-credential AI Connections so one logical provider can own multiple API keys;
- deterministic priority + failover beneath one logical provider;
- bounded Local↔Cloud context handoff without silently uploading all local-only history;
- `Lainnya` / custom OpenAI-compatible provider onboarding;
- broader real-provider completion evidence where valid credentials are available.

## Next bounded implementation slice

Implement the **multi-credential provider foundation** only:

1. replace the one-slot-per-provider credential assumption with multiple named/identified AI Connections under one provider;
2. preserve Connect as the sole credential/Vault owner;
3. define explicit priority/order and enabled/disabled state;
4. select the highest-priority usable connection for dispatch;
5. allow failover only for bounded provider/credential availability failures, never for policy/spend/sensitivity denial;
6. record which connection handled each hosted attempt without exposing plaintext credentials;
7. keep the Ai provider selector logical — one provider row, not one row per key;
8. do not combine custom-provider generalization or broad Local↔Cloud context-handoff redesign into this foundation slice.

## Safe resume order

1. `docs/current-state-and-next-steps.md`;
2. `docs/active-work-plan.md`;
3. `docs/ai-provider-model-ux-contract.md`;
4. this checkpoint;
5. `AGENTS.md`;
6. inspect exact current `main` and CI/deploy state before coding.

Do not redo the auto-execution, canonical-selector, or direct-onboarding slices merely for freshness.
