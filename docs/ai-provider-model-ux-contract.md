# AI Provider + Model UX Contract — Session 4E

**Status:** ACCEPTED + FULFILLED PRODUCT CONTRACT · closed 2026-10-01
**Scope:** Ai provider/model UX, OpenRouter execution entry, multi-credential direction, custom OpenAI-compatible onboarding, and Local↔Hosted context handoff.
**Implementation state:** **CLOSED / PASS / STAGING VERIFIED**. PRs #407, #409, #411, and #415 delivered the staged foundations; PR #417 closed the remaining custom-provider, Local↔Hosted, and final provider/model UX contract.

## Implementation progress — closed 2026-10-01

Closed / staging-verified through PR #417:

- fresh compatible OpenRouter catalog models can be selected and used without normal-user per-model `Test & Enable`;
- catalog input/output pricing is visible in the Ai OpenRouter model picker;
- Connect re-checks fresh catalog identity, compatibility, and pricing before paid dynamic dispatch;
- the composer uses adjacent `[Provider / Source ▼] [Model ▼]` controls;
- Local plus first-class hosted providers are represented directly, with unavailable providers disabled/fail-closed;
- model choices are provider-specific;
- provider/model changes apply to the next message inside the same conversation;
- `+ Tambah AI` opens a lightweight Ai-owned onboarding flow without requiring a Settings detour;
- one `Connect` action performs the existing Connect credential test before persistence;
- successful onboarding persists through Connect Vault, activates the provider, refreshes choices, and preserves the same conversation;
- one logical provider can own multiple encrypted AI Connections/API keys with stable ids, labels, enabled state, and explicit priority;
- Settings can enable/disable, make-primary, and remove individual AI Connections;
- hosted dispatch uses priority order and bounded invalid-credential/unreachable failover without changing the requested provider/model or bypassing policy/spend/sensitivity/operator denial;
- successful completion preserves non-secret credential-connection provenance;
- bounded `Lainnya / Custom OpenAI-compatible` onboarding is implemented with Connect-owned validation/Vault persistence and public-HTTPS/SSRF protections;
- Local↔Hosted continuity preserves Project-scoped hosted-eligible context without silently uploading local-only history;
- final provider/model selector, loading/error, and connection feedback contracts are closed;
- arbitrary custom-provider success-path proof remains dependent on a real user-controlled endpoint/credential and is not unfinished product code;
- final Session 4E/4F runtime baseline `6170ee5d67ee4b105771d8ce2c348afba6cce896` passed merged-main CI #2601, Product Eval #1840, and actual Staging Deploy #1950.

Canonical closure evidence:
[verification/session4ef-closure-2026-10-01.md](verification/session4ef-closure-2026-10-01.md).

## 1. Why this contract exists

The current product exposes too much provider governance to a normal user. The accepted direction is:

> **Simple in front, governed underneath.**

A normal user should be able to connect an AI provider, pick a model, and chat without understanding model admission, certification, executable authority, Vault internals, runtime identities, or operator-only controls.

Session 4E must follow this product contract rather than extending a user-facing per-model certification workflow.

## 2. Canonical Ai composer control

The Ai page uses **two adjacent selectors**:

```text
[ Provider / Source ▼ ]   [ Model ▼ ]
```

Examples:

```text
[ Local ▼ ]        [ Qwen 3.5 9B ▼ ]
[ OpenRouter ▼ ]   [ DeepSeek 4 Pro ▼ ]
[ OpenAI ▼ ]       [ GPT-5.6 ▼ ]
[ Claude ▼ ]       [ Claude Sonnet 4.5 ▼ ]
[ NVIDIA ▼ ]       [ GLM ... ▼ ]
```

### Provider/source selector

The first selector lists the available AI sources:

```text
Local
Claude
OpenAI
NVIDIA
OpenRouter
────────────
+ Tambah AI
```

The first selector is the **provider/source choice**. It is not a Local/Hosted technical-mode selector.

### Model selector

The second selector shows the models available from the provider/source selected in the first selector.

Changing the provider refreshes the model list for that provider. Changing the model does not require creating a new conversation.

## 3. Add AI from the Ai page

`+ Tambah AI` lives in the provider selector and opens a lightweight connection flow from the Ai page.

Normal flow:

```text
Ai
 → + Tambah AI
 → choose provider
 → paste API key / connection details
 → Connect
 → credential is validated
 → provider models become available
 → return to Ai
```

Supported first-class choices:

- OpenRouter;
- OpenAI;
- Claude / Anthropic;
- NVIDIA;
- Lainnya.

The normal flow must **not require navigating to Settings**.

`Connect` performs the normal credential check. A separate user-facing `Test connection` step is not required in the primary flow.

Settings remains available for management and advanced controls.

## 4. OpenRouter model behavior

The normal OpenRouter experience should expose **all currently compatible catalog models for the requested ECORIONE mode/capabilities** without requiring the end user to manually test and approve every model first.

Normal user flow:

```text
OpenRouter catalog
 → capability + metadata filtering
 → model appears in model selector
 → user selects model
 → model is used for the next message
```

The primary UI must not require the user to understand or operate labels such as:

- `Selectable`;
- `Certified`;
- `Executable`;
- `Test & Enable`;
- model-by-model approval.

These may remain internal implementation/evidence concepts where needed, but they are not the normal product workflow.

### Compatibility boundary

"All OpenRouter models" means all models that ECORIONE can use for the current request/mode. The system may hide or mark incompatible models when required capabilities are absent, for example text, image, tools, or other request-specific requirements.

The system must not silently claim that every OpenRouter catalog entry supports every ECORIONE feature.

## 5. Pricing presentation

For hosted catalog models, the user should be able to see provider-published pricing before use.

At minimum show or make readily inspectable:

- input price per 1M tokens;
- output price per 1M tokens.

Example:

```text
DeepSeek 4 Pro
$0.xx / 1M input
$0.xx / 1M output
```

Actual billed/provider-reported usage remains authoritative when the provider supplies it. Catalog pricing is planning/display metadata, not proof of final billed cost.

Spend budget and kill-switch governance remain enforced underneath the simplified UX.

## 6. Model/provider switching inside one conversation

A conversation is **not bound to one model or one provider**.

The provider/model selection applies to the **next message and subsequent messages until the user changes it again**.

Valid single-session behavior:

```text
turn 1 → Local / Qwen
turn 2 → OpenRouter / Claude
turn 3 → OpenAI / GPT
turn 4 → Local / Qwen
```

A model/provider change must not force a new session.

Historical Ledger / response metadata should preserve which provider/model handled each assistant response, together with usage/cost information when available.

The chat UI may expose lightweight response metadata such as:

```text
GPT-5.6 · OpenAI
```

with additional details available progressively.

## 7. Local ↔ Cloud context handoff

Changing from Local to a Cloud provider must **not silently upload the entire previously local-only conversation** merely to preserve continuity.

Target path:

```text
Historical Ledger
 → Project boundary
 → Context / Brain / ECX selection
 → bounded relevant context handoff
 → selected model
```

Context handoff must preserve existing scope, sensitivity, Project isolation, and provider policy.

The implementation may use explicit user confirmation when policy requires it. The important invariant is that provider/model switching remains seamless without weakening privacy boundaries.

## 8. Multi-credential AI Connections

The current one-slot-per-provider credential model is not the target product model.

A provider may have multiple user connections/API keys:

```text
OpenRouter
 ├─ OR-1
 ├─ OR-2
 ├─ OR-3
 ├─ OR-4
 └─ OR-5

OpenAI
 ├─ OA-1
 ├─ OA-2
 └─ OA-3
```

Target connection identity is conceptually:

```text
AI Connection
- connectionId
- provider
- label
- encrypted credential reference
- status
- createdAt
- lastUsedAt
- priority
- optional connection-level policy/budget metadata
```

The main Ai provider selector still shows one logical provider such as `OpenRouter`, not five separate API-key rows.

### Default credential routing

Initial target behavior:

- **Automatic**: use the highest-priority healthy connection;
- if that credential is rate-limited/unavailable, fail over to another healthy credential for the **same provider/model**;
- record which connection handled the request;
- do not silently change the requested model;
- **Manual** selection may exist as an advanced option.

Round-robin is not required for the first implementation.

## 9. "Lainnya" / custom provider

`+ Tambah AI → Lainnya` supports providers that are not first-class presets.

Normal fields:

```text
Name
Base URL
API Key
Model / model discovery
```

Default protocol target is **OpenAI-compatible**.

Advanced fields such as custom headers, auth type, or custom discovery endpoints remain progressive disclosure.

This path is intended to support providers such as Groq, Together, Fireworks, Cerebras, internal endpoints, and future providers without hardcoding a new top-level implementation for every vendor.

## 10. Settings role

Settings is no longer the required onboarding path for normal AI use.

Normal user:

```text
Ai → + Tambah AI → Connect → choose model → chat
```

Settings becomes the management/advanced surface for:

- AI Connections;
- multiple credentials and priority;
- budgets;
- Local runtime;
- privacy/policy;
- advanced connection details;
- operator/governance diagnostics.

Vault internals, immutable identity evidence, raw provider admission state, and similar operator concepts should remain behind Advanced surfaces unless a normal user needs them to resolve a concrete problem.

## 11. Governance that remains underneath

This UX simplification does **not** remove governance.

Existing ownership remains:

- Connect owns provider connections, credentials, model invocation, provider metadata and spend controls;
- Hub owns policy/authority/audit;
- Context owns memory semantics;
- Historical Ledger remains canonical conversation history;
- Project remains the context boundary inside Workspace.

The system may automatically perform capability checks, metadata checks, health checks, budget admission, provider error handling, usage recording, and model identity recording.

The key product change is:

> **the machine performs routine governance; the normal user does not approve models one-by-one.**

## 12. Session 4E/4F implementation boundary

Final implementation state as of 2026-10-01:

1. **SATISFIED** — post-#402 stabilization is closed through PR #405;
2. **SATISFIED** — compatible OpenRouter auto-execution + visible catalog pricing is closed/staging-verified through PR #407;
3. **SATISFIED** — canonical adjacent `[Provider / Source ▼] [Model ▼]` controls, provider-specific model lists, and same-conversation next-message switching are closed/staging-verified through PR #409;
4. **SATISFIED** — direct `+ Tambah AI` onboarding from Ai using Connect-owned credential validation/Vault authority is closed/staging-verified through PR #411;
5. **SATISFIED** — multi-credential AI Connections beneath one logical provider, explicit priority, bounded failover, Settings management, and non-secret connection provenance are closed/staging-verified through PR #415;
6. **SATISFIED** — `+ Tambah AI → Lainnya` custom OpenAI-compatible provider onboarding is closed/staging-verified through PR #417 with bounded public-HTTPS/SSRF/DNS-rebinding protections and Connect-owned validation/Vault persistence;
7. **SATISFIED** — bounded Local↔Hosted continuity preserves the existing Project-scoped hosted-eligible context boundary and does not silently replay local-only history into hosted prompts;
8. **SATISFIED** — final provider/model selector, loading/error, connection feedback, and custom-provider presentation are closed through Session 4F in PR #417.

Final Session 4E/4F runtime proof:

```text
PR #417 reviewed head = 93c3230b552e479194b756135a5458d8a6fd001e
PR-head CI            = #2600 PASS
PR-head Product Eval  = #1839 PASS
PR-head PCS-06        = #371 PASS
merged main           = 6170ee5d67ee4b105771d8ce2c348afba6cce896
merged-main CI        = #2601 PASS
merged-main Eval      = #1840 PASS
Staging Deploy        = #1950 PASS
image                 = staging-6170ee5d67ee
services              = 15/15 running
Operations            = healthy
stabilized free disk  = 29.95 GiB
```

The multi-credential product abstraction is implemented: the user chooses one logical provider/model while Connect selects among that provider's enabled AI Connections in priority order. Bounded failover does not bypass policy, spend, sensitivity, operator denial, or requested model identity.

The custom-provider path remains bounded and must not be broadened into unrestricted credential-bearing network egress.

Canonical closure evidence:
[verification/session4ef-closure-2026-10-01.md](verification/session4ef-closure-2026-10-01.md).

## 13. Explicit boundary after closure

Closing this contract does **not** claim:

- arbitrary custom-provider success without a real user-controlled endpoint and credential;
- universal availability of every OpenRouter catalog model for every ECORIONE capability;
- removal of Hub/Connect authority, spend limits, sensitivity policy, or Vault boundaries;
- final multi-user identity/RBAC;
- public production promotion;
- external A2A interoperability or recursive agent graphs;
- any new provider/agentic roadmap automatically starts after Session 4F.

Those remain separate evidence or future-scope decisions. Do not reopen Session 4E/4F merely for freshness.
