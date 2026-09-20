# PCS-03 — Local AI Resilience and Runtime Discovery Closure

Date: **2026-09-20**

Status: **CLOSED / PASS**

## Scope

PCS-03 closes the predictable Local-AI failure path without making Ollama mandatory and without adding any silent Local/Hosted fallback.

Connect remains the local-runtime owner. The supported abstraction remains **OpenAI-compatible**.

## Delivered behavior

- Connect exposes bounded Local runtime discovery through the configured OpenAI-compatible model catalog.
- Local runtime states are explicit: connected, model missing, identity mismatch, unreachable, or reachable-but-not-discoverable.
- Settings shows **Local AI — Not connected** as a supported state instead of implying that a local runtime must exist.
- Basic Local setup probes the candidate endpoint/model before persisting it.
- Candidate discovery is transient and does not mutate saved runtime settings.
- Private/loopback URL policy is reused for discovery; public targets fail closed unless the existing explicit operator override is enabled.
- Ollama remains optional. When the existing provenance API is available, ECORIONE can resolve/pin a model digest automatically; other OpenAI-compatible runtimes remain supported without pretending they expose Ollama provenance.
- A declared digest mismatch is surfaced as not-ready rather than being silently downgraded.
- Ai chat disables a Local route already known to be unavailable and explains how to configure it.
- ECORIONE does **not** silently switch Local requests to Hosted.

## Preserved boundaries

- Connect remains local-runtime/model identity owner.
- Existing local model identity rules remain authoritative.
- No second local-provider configuration plane was created.
- No automatic Local -> Hosted or Hosted -> Local fallback was introduced.
- PCS-04 visual cleanup, PCS-05 Flow fixes, PCS-06 integrated browser acceptance, and PCS-07+ staging remain separate scopes.

## Regression coverage

PCS-03 added deterministic coverage for:

- OpenAI-compatible `/v1/models` discovery;
- connected/model-missing/unreachable/non-discoverable states;
- optional local provenance/digest resolution;
- declared digest mismatch;
- transient candidate discovery without persistence;
- public-target SSRF rejection before network access;
- Ai Settings proxy allowlist for the Local status endpoint;
- chat fail-closed behavior for known-unavailable Local AI;
- Product Eval inclusion of the new PCS-03 matrix.

Integrated live-browser user-journey acceptance remains scheduled for **PCS-06**.

## Closure evidence

```text
implementation PR          #195
reviewed exact head        5be1c68f7b345d5e7d433a9eed302000ffe552a1
CI                         #1525 PASS
Product Eval               #764 PASS
merge main                 4e2407af7240c9ca3b94ffbfb0a1c239c6a4ddae
```

CI #1525 passed format, lint, typecheck, normal tests, Phase 4 real-process acceptance, production-operations acceptance, secret scan, dependency/toolchain/container/release-security review, and production build.

## Acceptance

PCS-03 acceptance is satisfied at the repository implementation/regression boundary:

1. no local runtime is a supported explicit product state;
2. candidate Local setup is probed before persistence;
3. OpenAI-compatible remains the primary abstraction;
4. Ollama-specific provenance is optional rather than architectural;
5. known-unavailable Local chat is blocked before a predictable 502;
6. no silent Local/Hosted fallback was added;
7. exact-head CI and Product Eval passed.

The next roadmap scope is **PCS-04 — Visual + information-architecture cleanup**.
