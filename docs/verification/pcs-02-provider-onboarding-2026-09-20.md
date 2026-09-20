# PCS-02 — AI Provider Onboarding + Hosted Model Choice Closure

Date: **2026-09-20**

Status: **CLOSED / PASS**

## Scope

PCS-02 simplifies the normal hosted-AI setup flow while preserving Connect as the sole provider credential/runtime/model authority.

## Delivered behavior

- Settings primary surface is now **AI & Connections** rather than an operator-first Control Center.
- Supported hosted providers are shown as provider cards with connection state and direct Connect/Use/Test actions.
- Provider onboarding follows the intended flow: API key -> transient real-provider test -> encrypted save -> route activation.
- A transient credential test can run before the durable hosted route is enabled when the process-level operator gate permits hosted calls.
- API key plaintext remains inside the Connect credential boundary and is not returned to Ai after save.
- Default hosted provider and model are user-selectable from a Connect-owned verified catalog.
- **Governed / Recommended** remains the default model preference.
- A user-selected verified model applies to normal hosted requests.
- `RESTRICTED` requests remain policy-governed and can override the user selection to the provider's stronger pinned model.
- Changing hosted provider resets a stale model preference to Governed unless a compatible model is supplied explicitly.
- Runtime URL/digest, manual Vault management, and MCP JSON are kept behind **Advanced settings**.

## Verified hosted model catalog at closure

The product exposes only provider/model pairs already backed by explicit Connect adapters and pricing/evidence identities:

- Anthropic: Claude Sonnet 4.5, Claude Opus 4.1.
- OpenRouter: Claude Sonnet 4.5, Claude Opus 4.1.
- OpenAI: GPT-5.6 Terra, GPT-5.6 Sol.

The roadmap may mention Gemini, Qwen, Kimi, DeepSeek, and other families as future candidates, but PCS-02 does **not** expose them as usable hosted choices until exact adapter/model/pricing support is verified.

## Preserved architecture/security boundaries

- Connect remains provider credential, runtime settings, model-routing, hosted spend, and kill-switch owner.
- no second provider configuration database or Ai-owned secret store was introduced.
- no silent provider fallback was added.
- cross-provider model pairs fail closed.
- provider/model identity, cache identity, cost accounting, and evidence metadata remain pinned/traceable.
- Hub/Context/Historical Ledger/Flow owner boundaries are unchanged.
- local-runtime reachability/discovery remains PCS-03.
- integrated live-browser acceptance remains PCS-06.
- no SumoPod/public production/Cloudflare/AutoClick/L4 scope was added.

## Regression coverage

PCS-02 added deterministic coverage for:

- verified hosted model catalog membership;
- durable `hostedModel` preference;
- provider-switch reset to Governed;
- selected-model routing for non-RESTRICTED requests;
- RESTRICTED governed override;
- cross-provider model rejection;
- transient test-before-enable onboarding semantics;
- Settings primary-vs-Advanced source contract;
- Product Eval inclusion of the PCS-02 regressions.

## Closure evidence

```text
implementation PR          #193
reviewed exact head        45dbe9365b23dfa3398a4726a26f9a245bd09e9d
CI                         #1516 PASS
Product Eval               #755 PASS
merge main                 0fba6842f4c39f2742eb6d518e63c90d1a4883db
```

CI #1516 passed format, lint, typecheck, normal tests, Phase 4 real-process acceptance, production-operations acceptance, secret scan, dependency/toolchain/container/release-security review, and production build.

## Acceptance

PCS-02 acceptance is satisfied at the repository implementation/regression boundary:

1. a supported provider can be connected without editing `.env` or manually operating Vault internals;
2. credential test precedes encrypted save and durable route activation;
3. hosted model choices come only from the verified Connect catalog;
4. Governed / Recommended remains available and policy can override user choice where required;
5. exact-head CI and Product Eval passed.

The next roadmap scope is **PCS-03 — Local AI resilience and runtime discovery**.
