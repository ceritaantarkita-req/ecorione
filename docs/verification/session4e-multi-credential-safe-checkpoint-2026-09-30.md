# Session 4E Multi-Credential AI Connections Safe Checkpoint — 2026-09-30

**Status:** CLOSED / PASS / STAGING VERIFIED FOR THIS SLICE · SESSION 4E REMAINS ACTIVE / PARTIAL

## Scope closed by this checkpoint

This checkpoint closes the multi-credential AI Connection foundation requested for one logical provider with multiple API keys.

Implemented behavior:

- Connect Vault schema advances from v1 singleton provider slots to a backward-compatible v2 multi-connection model for AI providers;
- legacy v1 vault entries are normalized as the `default` / `Primary` connection instead of being discarded;
- every AI Connection has a stable non-secret `connectionId`, label, enabled state, priority, generation, and updated timestamp;
- lower numeric priority means earlier dispatch preference;
- one logical provider can own multiple encrypted API keys;
- the Ai provider selector remains one logical provider row rather than exposing one row per key;
- `+ Tambah AI` can add another key to an already-connected first-class provider instead of replacing its existing key;
- Settings exposes per-provider AI Connections with enable/disable, make-primary, and remove actions;
- hosted dispatch tries enabled connections in priority order;
- bounded failover is permitted only for explicit provider `invalid-credential` and `unreachable` errors, with no retry when the caller signal is already aborted;
- `ProviderResponseError` does not fail over, preserving conservative billing/ambiguity handling;
- policy, spend, sensitivity, operator kill-switch, and requested model boundaries remain outside credential failover and cannot be bypassed;
- successful completion records non-secret `credentialConnectionId` provenance through Connect/Hub/ECX evidence;
- token-purpose credentials such as MCP/webhook remain on their legacy single-slot path.

## Reviewed PR head

```text
PR                  = #415
reviewed head       = 83f0481b84b705ee8a310c2aa8df798353d49e7a
merged main         = 15dc2a131778c2fe1249dda34e3291f9a3c8beae
staging image       = staging-15dc2a131778
```

Exact PR-head proof:

- CI #2595 — PASS;
- Product Eval #1834 — PASS;
- MCP External HTTPS Acceptance #1199 — PASS;
- PCS-06 Integrated Browser Acceptance #370 — PASS.

Merged-main proof:

- CI #2597 — PASS;
- Product Eval #1836 — PASS;
- MCP External HTTPS Acceptance #1201 — PASS.

## Actual staging proof

Staging Deploy #1941 was gate-only and skipped its deploy job. It is not deployment proof.

Staging Deploy #1942 performed the real exact-SHA deployment and passed:

- target SHA `15dc2a131778c2fe1249dda34e3291f9a3c8beae`;
- host HEAD matched expected SHA exactly;
- clean detached staging worktree;
- image `staging-15dc2a131778`;
- public boundary smoke PASS;
- Operations `healthy: true`;
- configured services: 15;
- running services: 15;
- non-running services: 0;
- sanitized host evidence free disk before cleanup: 26 GiB;
- rollback-set cleanup retained the new and previous rollback images;
- stabilized free disk: 27.33 GiB.

SumoPod remains staging, not production.

## Product behavior now proven

A user can configure multiple keys beneath the same provider without turning them into separate provider choices.

Example:

```text
OpenRouter
  OR-1  priority 0    enabled
  OR-2  priority 100  enabled
  OR-3  priority 200  disabled

Ai still shows:
[ OpenRouter ▼ ] [ selected model ▼ ]
```

Dispatch uses the highest-priority enabled connection first. If the provider explicitly reports an invalid credential, or the adapter reports an unreachable provider and the request was not caller-aborted, Connect may try the next enabled connection for the same provider/model. It does not silently change models or bypass governance.

## Session 4E remains open

The accepted product contract is:
[../ai-provider-model-ux-contract.md](../ai-provider-model-ux-contract.md).

Still open:

- `Lainnya` / custom OpenAI-compatible provider onboarding;
- bounded Local↔Cloud context handoff without silently uploading all local-only history;
- broader real-provider completion evidence where valid credentials/providers are available.

## Next bounded implementation slice

Implement **`+ Tambah AI → Lainnya` custom OpenAI-compatible provider onboarding**:

1. collect Name, Base URL, API key, and model/model-discovery information from Ai;
2. keep secrets exclusively in Connect Vault;
3. validate endpoint/credential/model through a bounded Connect-owned probe before activation;
4. do not allow private-network/public-network boundary bypasses or credential-bearing URLs;
5. preserve spend controls and require explicit pricing/admission metadata when final billed cost cannot be supplied by the provider;
6. surface the custom provider as one logical provider/source choice after successful onboarding;
7. preserve multiple AI Connections beneath that custom provider where the connection model applies;
8. keep advanced custom headers/auth/discovery configuration behind progressive disclosure.

Do not combine broad Local↔Cloud handoff redesign into this custom-provider slice unless a failing invariant requires it.

## Safe resume order

1. `docs/current-state-and-next-steps.md`;
2. `docs/active-work-plan.md`;
3. `docs/ai-provider-model-ux-contract.md`;
4. this checkpoint;
5. `AGENTS.md`;
6. inspect exact current `main` and current CI/deploy state before coding.

Do not redo the auto-execution, selector, direct-onboarding, or multi-credential slices merely for freshness.
