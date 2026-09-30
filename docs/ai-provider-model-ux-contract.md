# AI Provider + Model UX Contract — pre-Session 4E

**Status:** ACCEPTED PRODUCT CONTRACT · 2026-09-30  
**Scope:** Ai provider/model UX, OpenRouter execution entry, multi-credential direction, and Local↔Cloud context handoff.  
**Implementation state:** documentation only. This file does **not** claim that the behavior below is implemented yet.

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

## 12. Session 4E implementation boundary

Pre-4E readiness as of 2026-09-30:

1. **SATISFIED** — the post-#402 repository state was stabilized by PR #405 and merged to `main` as `d32527cb21e3b7209b28b109083be00671464b2b`;
2. **SATISFIED** — PR #405 head `32daed745625c9ede012912a19b8b77d5f89ec90` passed CI #2539, Product Eval #1778, and PCS-06 #328; merged-main CI #2540, Product Eval #1779, and actual Staging Deploy #1835 also passed for `d32527cb...`;
3. **STILL REQUIRED** — Session 4E must be explicitly opened before runtime implementation;
4. **STILL REQUIRED** — Session 4E must use this document as the product contract.

Staging Deploy #1835 proved exact SHA `d32527cb...`, image `staging-d32527cb21e3`, public smoke PASS, Operations healthy, 15/15 configured services running, and 27.41 GiB free disk.

Session 4E should **not** merely expand the current `Search → Test & Enable → Certified` end-user workflow to more model families.

Session 4E should instead move OpenRouter toward the accepted model-selector behavior while preserving internal safety, pricing transparency, spend controls, and auditability.

Multi-credential AI Connections may require its own bounded implementation sub-scope if it is too large to complete safely inside the first 4E execution slice. The target data model and UX are nevertheless locked here so 4E must not deepen the existing single-slot credential assumption.

## 13. Explicit non-goals of this docs checkpoint

This documentation change does not:

- implement Session 4E;
- change the credential Vault schema;
- remove Hub/Connect authority;
- enable arbitrary incompatible OpenRouter models;
- disable spend limits;
- implement multi-key failover;
- implement custom providers;
- deploy anything to staging/production;
- treat PR #402 or PR #405 as Session 4E closure or as the accepted final end-user UX.

Those require runtime work and verification.
