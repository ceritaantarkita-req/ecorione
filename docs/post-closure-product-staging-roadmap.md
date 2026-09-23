# ECORIONE — Post-Closure Product + Remote Staging Roadmap

Last updated: **2026-09-21**

Status: **CLOSED / PASS — PCS-00..PCS-10**

This roadmap records the completed post-Product-Evolution scope after PE-00..PE-08 and repository portability/reproducibility hardening. PCS-00..PCS-10 are CLOSED / PASS. It is **not PE-09, not Batch 13, and not a claim that production is live**.

The operator approved two connected goals:

1. make ECORIONE materially easier and cleaner to use from a normal browser; and
2. move the primary runtime from an operator laptop to an operator-owned SumoPod VPS used as **remote development/staging**, with GitHub remaining the source of truth.

## Historical browser findings that motivated this roadmap

Real local browser use on 2026-09-20 confirmed that the core stack can start and that the hosted OpenRouter path can answer successfully, but it also exposed product gaps that are now explicit work:

- the Local/Hosted selector is visually hard to read in the current dark theme;
- fresh local configuration still points at an OpenAI-compatible endpoint on `127.0.0.1:11434`, so Local chat fails when no local runtime is actually running;
- Ollama is **not** an architectural dependency, but the current default makes it look like one;
- provider/API-key onboarding exposes too many operator concepts at once (vault, canary, hosted enablement, runtime route, kill switch, budget);
- OpenRouter is currently used as a governed gateway with pinned model identities rather than a user-facing model marketplace;
- Ai chat state is component-local: leaving the page creates a new session view instead of reopening the active conversation/history;
- visual hierarchy, spacing, typography, control sizing, empty states, disabled states, and advanced/basic separation are not yet product-grade;
- one real Flow execution exposed a query-state error and an incomplete node-authority grant path that must be closed before Flow is treated as end-user ready.

These observations did not invalidate the closed PE baseline; they defined the now-completed post-closure product scope.

## Product direction

> **Simple in front, governed underneath.**

Normal users should see provider connection, model choice, chat/history, projects, work, and clear status. Vault internals, SHA-256 model identity, raw base URLs, spend controls, MCP JSON, and other operator controls belong under Advanced surfaces unless explicitly needed.

The visual direction is calm, premium, and high-readability: dark charcoal rather than near-black-on-black, stronger hierarchy, larger readable type, restrained warm accent, consistent panels/controls, and fewer developer-facing labels in primary flows.

## Completed workstreams

### PCS-00 — Baseline lock

State: **CLOSED / PASS**. Locked starting commit: `93c5312d73289305d3e16ff79c5457a5010d0b19`. PR #189 exact head `f58311ae30beef877f0c38962bcf4b1aefe91917` passed CI #1492 + Product Eval #731 and merged as `12fae37e901e4cbfbb7e4cb6cf9b8e9a2ec4e764`. Evidence: [verification/pcs-00-baseline-lock-2026-09-20.md](verification/pcs-00-baseline-lock-2026-09-20.md).

- start from synchronized clean `main`;
- preserve the closed architecture/owner boundaries;
- record the exact starting commit;
- require normal verification before product changes are merged.

Acceptance: the baseline remains reproducible and no closed PE owner/security rule is silently weakened.

### PCS-01 — Chat continuity and history

State: **CLOSED / PASS**. PR #191 exact head `9445b30c659628e1d551191219d0b7cd5ccf2f7c` passed CI #1505 + Product Eval #744 and merged as `ee363c055944b27b549a2f061105eea35fa25f9e`. Evidence: [verification/pcs-01-chat-continuity-2026-09-20.md](verification/pcs-01-chat-continuity-2026-09-20.md).

- preserve an active `sessionId` across navigation;
- load existing Hub history into the chat UI;
- add explicit **New chat** and conversation/history navigation;
- keep Project binding consistent when reopening a conversation.

Acceptance: a user can send a message, visit another ECORIONE page, return to Ai, and continue the same conversation; a new session is created only by an explicit new-chat action or defined project/session transition.

### PCS-02 — AI provider onboarding and model choice

State: **CLOSED / PASS**. PR #193 exact head `45dbe9365b23dfa3398a4726a26f9a245bd09e9d` passed CI #1516 + Product Eval #755 and merged as `0fba6842f4c39f2742eb6d518e63c90d1a4883db`. Evidence: [verification/pcs-02-provider-onboarding-2026-09-20.md](verification/pcs-02-provider-onboarding-2026-09-20.md).

Primary setup should become approximately:

```text
AI Providers
OpenRouter   [Connect]
Anthropic    [Connect]
OpenAI       [Connect]
Local AI     [Set up]

Default provider/model
OpenRouter · <model>
```

- provider connect flow: provider -> API key -> test -> encrypted save -> enable route;
- hide vault generation/runtime plumbing from the normal setup flow;
- keep secrets in Connect Vault and never Git;
- show connection status and actionable errors;
- add hosted model selection where the provider and ECORIONE policy support it;
- for OpenRouter, expose a verified model catalog rather than forcing one visible Claude choice;
- keep a **Governed/Recommended** route that can pin a model when reproducibility, sensitivity, cost, or evidence policy requires it;
- preserve provider/model identity, cost accounting, cache semantics, and evidence metadata.

Candidate user-facing families include Claude, GPT, Gemini, Qwen, Kimi, DeepSeek, and others **only after exact route/model identifiers and ECORIONE policy support are verified**. This document does not claim every OpenRouter model is immediately compatible.

Acceptance: an ordinary user can connect a supported hosted provider without editing `.env`, understanding vault internals, or manually toggling multiple runtime gates.

### PCS-03 — Local AI resilience and runtime discovery

State: **CLOSED / PASS**. PR #195 exact head `5be1c68f7b345d5e7d433a9eed302000ffe552a1` passed CI #1525 + Product Eval #764 and merged as `4e2407af7240c9ca3b94ffbfb0a1c239c6a4ddae`. Evidence: [verification/pcs-03-local-ai-resilience-2026-09-20.md](verification/pcs-03-local-ai-resilience-2026-09-20.md).

- preserve `openai-compatible` as the local-runtime abstraction;
- do not make Ollama mandatory;
- detect whether the configured local endpoint/model is reachable;
- show **Local AI — Not connected** rather than allowing a predictable 502 path;
- provide guided setup for supported OpenAI-compatible runtimes;
- retain an Advanced path for manual base URL/model identity/digest configuration;
- do not silently fall back from local to hosted or vice versa.

Acceptance: absence of Ollama or any other local runtime is a normal supported state, not a broken default.

### PCS-04 — Product visual and information-architecture cleanup

State: **CLOSED / PASS**. PR #197 exact head `ec4ed1508cb7ab72fb9d86f15ec3541c2caf80f5` passed CI #1529 + Product Eval #768 and merged as `8a328ae0c0abeb039866ac40068a9053c4796659`. Evidence: [verification/pcs-04-visual-ia-closure-2026-09-20.md](verification/pcs-04-visual-ia-closure-2026-09-20.md).

Apply one coherent system across Ai, Projects, Work, Brain, Space, Flow, Operations, and Settings:

- improve typography scale and contrast;
- fix dropdown readability in dark mode;
- normalize spacing, panel widths, button sizes, borders, focus, hover, disabled, warning, success, and empty states;
- reduce uncontrolled empty space;
- make primary and advanced navigation visually distinct;
- simplify user-facing terminology;
- move technical/operator settings into Advanced sections;
- preserve responsive behavior and accessibility expectations.

The redesign should improve hierarchy before decorative styling. It must not change backend ownership merely to simplify the UI.

### PCS-05 — Flow runtime defect closure

State: **CLOSED / PASS**. PR #199 exact head `d7eb37e8b5e97da07895fcd050621e563a47359b` passed CI #1537 + Product Eval #776 and merged as `f58923b8261104c8aec331f506a68f8cf5fe5e7e`. Evidence: [verification/pcs-05-flow-runtime-closure-2026-09-20.md](verification/pcs-05-flow-runtime-closure-2026-09-20.md).

Closed the real-browser Flow failures observed on 2026-09-20, including:

- `graphRunState` query timing/registration behavior;
- incomplete authority grant for executable graph nodes;
- user-facing run state and failure explanation;
- deterministic authorization-before-execution semantics.

Acceptance: a minimal authorized graph can validate, save, run, expose its state, and complete end-to-end without the observed 500/authority failure; negative authorization paths remain fail-closed.

### PCS-06 — Integrated browser/regression acceptance

State: **CLOSED / PASS**. PR #201 exact head `0dfdda92e0bef800ca9a7563223b7423aa9b1299` passed CI #1553 + Product Eval #792 + PCS-06 Integrated Browser Acceptance #13 and merged as `0a8f7619567500acaec0758c400d529367baf0e5`. Evidence: [verification/pcs-06-integrated-browser-closure-2026-09-20.md](verification/pcs-06-integrated-browser-closure-2026-09-20.md).

Verified the changed product as a user through deterministic rendered-browser acceptance: Ai hosted chat, local-unavailable state, provider onboarding, model selection/governed route, persistent conversation/history, Projects, Work/Schedule/Runs, Brain, Space, Flow, Operations, Settings basic/advanced, and supported responsive/theme behavior.

Normal format/lint/typecheck/tests/secret scan/build remain required.

### PCS-07 — SumoPod remote staging deployment

State: **CLOSED / PASS**.

The operator-approved SumoPod Ubuntu VPS is now running the first remote staging deployment. The live runtime was deployed from exact reviewed main `99523b0bb29ce11a74ec61c0e364ef5b6dd543ae`; actual-host inventory, isolated services/volumes, HTTPS reachability, operator protection, `/api/ops` health, and MCP auth-challenge reachability pass at the documented boundary. PR #208 corrected the public-smoke verifier after the real host exposed a malformed MCP smoke request; it merged as `59430c4b72a704d1fd6c6176d12b13fa27ddf674` after CI #1581 + Product Eval #820. Evidence: [verification/pcs-07-sumopod-host-closure-2026-09-20.md](verification/pcs-07-sumopod-host-closure-2026-09-20.md). The final real rendered-browser governed Flow journey passed on the staging hostname: explicit authority preparation/approval produced an active `core/trigger/v1` grant, the Trigger-only v2 graph reached `SUCCEEDED`, and the run reached `COMPLETED` without a paid provider call. PCS-07 is CLOSED / PASS.

```text
GitHub main
   -> reviewed/verified revision
   -> SumoPod ECORIONE staging
   -> browser access
```

Rules:

- this is **staging**, not production;
- GitHub is the source of truth;
- do not develop by editing arbitrary live VPS files;
- ECORIONE owner data, Temporal, Connect Vault, Artifact, Flow, etc. use persistent server-side storage;
- internal ECORIONE service ports are not exposed directly to the public Internet;
- hosted AI is the preferred first staging path; a local GPU/model runtime is optional and not required;
- OpenRouter/other provider keys enter through Connect Vault, not Git or deployment docs;
- no public IP address, password, API key, vault key, or token is committed to the repository.

Use the existing self-host tooling as the starting point and validate the actual host before mutation:

```bash
pnpm production:preflight
pnpm production:host-audit
scripts/self-host-install.sh --apply
```

The production compose/runbooks are reusable infrastructure, but staging evidence must not be mislabeled as production evidence.

### PCS-08 — GitHub-to-staging continuous deployment

State: **CLOSED / PASS**. PR #210 exact head `4a5fa9d9d776eae3895a8e0b8e6b73013e3f476f` passed CI #1613 + Product Eval #852 and merged as `652588e00dca5a04c8b39081fb6574a3db508ba1`. Runbook: [staging-continuous-deployment.md](staging-continuous-deployment.md). Repository-preparation evidence: [verification/pcs-08-repository-preparation-2026-09-20.md](verification/pcs-08-repository-preparation-2026-09-20.md).

Target workflow:

```text
feature branch / PR
  -> CI + required gates
  -> merge main
  -> deploy reviewed main revision to SumoPod
  -> health/smoke check
  -> mark deployment healthy or roll back
```

Requirements:

- no polling-based blind `git pull` loop;
- deployment uses a least-privilege mechanism;
- revision deployed to staging is recorded;
- secrets remain host-side / GitHub secret store as appropriate, never in tracked files;
- failed health/smoke checks must not be reported as a successful release;
- rollback to the previous known-good revision must be documented and tested.

### PCS-09 — Staging access, persistence, backup, and observability

State: **CLOSED / PASS**.

PR #216 exact head `0bf1414859d4bf573f1ebc46ad6286b125ca1f38` passed CI #1664 + Product Eval #903 and merged as `acd050139f8d5db0dcdadeb8c072ab6432100f0f`; exact merged-main CI #1665 + Product Eval #904 also passed. Exact reviewed `main` `0f332c73dc7b363bffecdeecae921d805d5ae131` was then governed-deployed to SumoPod. Real-host evidence now passes key-only SSH hardening, strict inventory, full-VPS reboot persistence, 12-volume same-host cold backup with isolated content verification, and final Operations/host-resource checks. At PCS-09 closure, Off-host DR and production promotion were explicit non-claims. The original Off-host DR workstream later CLOSED / PASS for total SumoPod staging-host loss at its documented boundary; production promotion remains a non-claim, and DR-2 physical independence is now the separate active follow-up scope. Closure PR #218 exact head `ece59440d742f59252046562cf3ba86e7911b46f` passed CI #1678 + Product Eval #917 and merged as `3db9e4854afbaccb9790638243fa98048c1a4f78`; merged-main CI #1679 + Product Eval #918 passed. Staging Deploy #135/#136 gate PASSed with deploy skipped, preserving the proven runtime.

- establish HTTPS and operator authentication;
- verify restart persistence on the actual VPS;
- verify Connect runtime settings and encrypted credentials persist as intended;
- create and verify backups;
- add off-host backup later before any disaster-recovery claim;
- expose useful health/error/model/cost/Flow telemetry through the governed Operations surface;
- verify disk/memory/service health on the actual staging host.

Cloudflare Tunnel remains an optional edge choice until the operator selects the final staging/public hostname strategy.

### PCS-10 — Closure and documentation convergence

State: **CLOSED / PASS**.

PCS-10 converges current-state, active-work, runbooks, deployment/recovery, documentation navigation, repository rules, and decision records onto the verified PCS-09 staging boundary. Stale statements that staging is deferred or that PCS-08/PCS-09 remain active are removed, while the staging-versus-production distinction and explicit non-claims remain intact.

Closure PR #219 exact head `c84f76face60d203592d8bc6e1a51acccfec5004` passed CI #1684 + Product Eval #923 and merged as `6058aa0ff294218147a91ee0fc7b77f32d1be80d`. Post-merge bookkeeping PR #220 passed CI #1686 + Product Eval #925 and merged as `fa55e530615e9eb3a35d646e39bbbb3bf34d8a07`.

No production promotion is implied. The next decision, if any, must explicitly authorize a new scope or production-promotion path; there is no implicit PCS-11, PE-09, or Batch 13.

## Target operating model

```text
discussion / implementation
        |
        v
GitHub branch + PR
        |
        v
automated verification
        |
        v
merge main
        |
        v
SumoPod staging deploy
        |
        v
browser validation
```

The operator laptop becomes a client and optional local-development machine, **not a required always-on ECORIONE runtime**.

## Architecture boundaries that remain unchanged

- Workspace remains the authority boundary.
- Hub remains policy/approval authority.
- Connect remains provider/credential/MCP owner.
- Context remains retrieval owner.
- Temporal remains Flow durability/timer/retry owner.
- Brain remains derived/rebuildable rather than a canonical graph database.
- ECX remains the context-pack optimizer.
- No second scheduler/retry database.
- No silent provider fallback.
- No secret is committed to Git.
- Local inference remains OpenAI-compatible and Ollama remains optional.
- Public production cutover is not implied by remote staging.
- AutoClick and L4 autonomy remain outside this roadmap unless separately authorized.

## Completed sequencing

```text
PCS-00 baseline lock
 -> PCS-01 chat continuity
 -> PCS-02 provider/model experience
 -> PCS-03 local AI resilience
 -> PCS-04 visual/IA cleanup
 -> PCS-05 Flow defects
 -> PCS-06 integrated acceptance
 -> PCS-07 SumoPod staging
 -> PCS-08 GitHub -> staging CD
 -> PCS-09 remote hardening/backup/observability
 -> PCS-10 closure/docs
```

Small independent fixes may be implemented in parallel only when they do not weaken the acceptance order or create conflicting owner/runtime changes.