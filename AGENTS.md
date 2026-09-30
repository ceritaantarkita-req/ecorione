# AGENTS.md — repository working rules

ECORIONE is a local-first shared-memory and governed-execution layer for local and hosted AI.

## Read order

Before changing the repo:

1. `docs/README.md`
2. `docs/current-state-and-next-steps.md`
3. `docs/active-work-plan.md`
4. `docs/ai-provider-model-ux-contract.md` before any Session 4E / Ai provider-model work
5. this file
6. relevant accepted ADR/runbook
7. dated verification/evidence only when the active scope requires it

Dated audits, WIP checkpoints, closure records, and `docs/verification/` are evidence. They are **not current work queues**.

## Current compatibility baseline — 2026-09-30

Latest audited **runtime-changing** repository/staging baseline:

```text
runtime baseline = 15dc2a131778c2fe1249dda34e3291f9a3c8beae
image            = staging-15dc2a131778
CI               = #2597 PASS
Product Eval     = #1836 PASS
MCP HTTPS        = #1201 PASS
Staging Deploy   = #1942 PASS
Operations       = healthy
services         = 15/15 running
free disk        = 27.33 GiB stabilized
```

Docs-only checkpoint commits may advance live Git revision identity without changing this runtime compatibility baseline. Session 4E is **ACTIVE / PARTIAL**. Four runtime slices are now CLOSED / PASS / STAGING VERIFIED: PR #407 closed compatible OpenRouter auto-execution + pricing, PR #409 closed the canonical provider/model selector surface, PR #411 closed direct `+ Tambah AI` onboarding, and PR #415 closed the multi-credential AI Connection foundation. Exact PR #415 head `83f0481b84b705ee8a310c2aa8df798353d49e7a` passed CI #2595, Product Eval #1834, MCP HTTPS #1199, and PCS-06 #370; merged `main` `15dc2a131778c2fe1249dda34e3291f9a3c8beae` passed CI #2597, Product Eval #1836, MCP HTTPS #1201, and actual Staging Deploy #1942. Do **not** treat these slices as full Session 4E closure.

Current overall safe-resume pointer:
`docs/verification/session4e-multi-credential-safe-checkpoint-2026-09-30.md`.

NVIDIA API Catalog / NIM is now a verified first-class hosted provider under Connect:

- provider id `nvidia`;
- Vault scope `nvidia/messages`;
- endpoint `https://integrate.api.nvidia.com/v1`;
- pinned model `z-ai/glm-5.3`;
- no silent fallback;
- cost kill switch and durable spend controls remain authoritative;
- the staging **operator hosted kill switch is open** under a finite spend policy; the persisted runtime toggle is still activated through normal Settings/provider activation.

Current NVIDIA credential/canary validation uses 60-second default deadlines, caps NVIDIA health probes at 1024 output tokens with low reasoning effort, and returns `PROVIDER_TEST_TIMEOUT` on deadline. The user's actual key is still not claimed validated.

The user's actual NVIDIA secret has not been stored or validated by repository work. Do not claim a real user-key GLM-5.3 completion until the operator enters the key in Settings, passes the bounded credential test, saves/activates it, and observes a real Ai completion.

Latest NVIDIA test/runtime checkpoint:
`docs/verification/nvidia-connection-test-session1-safe-checkpoint-2026-09-28.md`.

Underlying provider rollout checkpoint:
`docs/verification/nvidia-hosted-provider-safe-checkpoint-2026-09-28.md`.

Use `docs/verification/session4e-multi-credential-safe-checkpoint-2026-09-30.md` as the overall handoff pointer for the active Session 4E scope.

Closed roadmap families:

- original Batch 1–12 / W / F6 baseline — **CLOSED**;
- Product Evolution PE-00..PE-08 — **CLOSED / PASS**;
- PCS-00..PCS-10 — **CLOSED / PASS**;
- original Off-host DR — **CLOSED / PASS at documented boundary**;
- audit follow-ups through A-11 — **CLOSED / PASS at bounded scopes**;
- ECX Recipient Execution Batch 1–7 — **CLOSED / PASS**;
- NVIDIA hosted-provider trial implementation + staging activation + Docker build hardening — **CLOSED / PASS**;
- NVIDIA connection-test Session 1 hardening — **CLOSED / PASS**;
- OpenRouter model-registry Session 2 — **CLOSED / PASS**;
- OpenRouter live-discovery Session 3 — **CLOSED / PASS / STAGING VERIFIED**;
- OpenRouter model-family Session 4A — **CLOSED / PASS / STAGING VERIFIED**;
- OpenRouter automatic-admission Session 4B — **CLOSED / PASS / STAGING VERIFIED**;
- OpenRouter Settings model-picker Session 4C — **CLOSED / PASS / STAGING VERIFIED**;
- OpenRouter Ai chat quick-switch Session 4D — **CLOSED / PASS / STAGING VERIFIED**;
- Session 4E slice 1 — compatible OpenRouter auto-execution + visible catalog pricing — **CLOSED / PASS / STAGING VERIFIED** through PR #407;
- Session 4E slice 2 — canonical provider/source + provider-specific model selectors — **CLOSED / PASS / STAGING VERIFIED** through PR #409;
- Session 4E slice 3 — direct `+ Tambah AI` onboarding — **CLOSED / PASS / STAGING VERIFIED** through PR #411;
- Session 4E slice 4 — multi-credential AI Connections + bounded failover — **CLOSED / PASS / STAGING VERIFIED** through PR #415.

Session 4E is **ACTIVE / PARTIAL**. The current bounded implementation slice is `+ Tambah AI → Lainnya`: custom OpenAI-compatible provider onboarding with Connect-owned validation, credential storage, and execution authority. There is no implicit Batch 8, PE-09, PCS-11, Batch 13, or next A-series item. The accepted Session 4E product contract is `docs/ai-provider-model-ux-contract.md`.

Open Issue #277 remains the deferred DR-2 tracker.

## OpenRouter registry + discovery + Session 4E working boundary

Before changing OpenRouter/Ai provider-model UX, read `docs/ai-provider-model-ux-contract.md`. The canonical selectors, OpenRouter pricing/selection, direct onboarding, and multi-credential provider foundation are implemented. The next bounded product slice is `+ Tambah AI → Lainnya` custom OpenAI-compatible provider onboarding.

Sessions 2, 3, 4A, 4B, 4C, and 4D are **CLOSED / PASS**. Session 4E is **ACTIVE / PARTIAL**; its auto-execution/pricing slice is **CLOSED / PASS / STAGING VERIFIED** through PR #407 and its canonical provider/model selector slice is **CLOSED / PASS / STAGING VERIFIED** through PR #409.

Current invariants:

- hosted model preferences remain extensible strings, but execution authority is always Connect-owned;
- static provider/model entries still resolve through the governed executable registry;
- fresh compatible dynamic OpenRouter selections may execute through the trusted Session 4E activation path without normal-user model-by-model certification;
- generic runtime PATCH cannot mint dynamic OpenRouter execution authority;
- before each paid dynamic OpenRouter dispatch, Connect must re-resolve the exact selected model from a fresh catalog snapshot and require the model to remain selectable with valid input/output pricing;
- mutable aliases, stale catalog entries, invalid runtime ids, incompatible text-I/O/`max_tokens` candidates, and missing/invalid pricing remain fail-closed;
- Connect owns the canonical target-family vocabulary: GPT, Gemini, Qwen, DeepSeek, Kimi, GLM;
- family classification is descriptive metadata, not by itself execution authority;
- unrelated models sharing an author namespace remain `other` / discovery-only unless independently admitted;
- catalog input/output pricing may be shown to the user and used for bounded pre-dispatch planning, but provider-reported OpenRouter billed cost remains authoritative when supplied;
- spend budget, kill switch, credential/Vault, sensitivity, Project/history, and no-silent-fallback boundaries remain unchanged.

Do **not** hard-code newly discovered GPT, DeepSeek, Qwen, GLM, Kimi, Gemini, Llama, or other catalog models into the static verified registry merely to make them executable. Use the dynamic Connect-owned admission/activation path and preserve fresh dispatch-time validation.

Current checkpoint:
`docs/verification/session4e-multi-credential-safe-checkpoint-2026-09-30.md`.

Prior Ai quick-switch checkpoint:
`docs/verification/openrouter-ai-chat-quick-switch-session4d-safe-checkpoint-2026-09-29.md`.

Underlying Settings-selection checkpoint:
`docs/verification/openrouter-settings-model-picker-session4c-safe-checkpoint-2026-09-29.md`.

Underlying admission checkpoint:
`docs/verification/openrouter-auto-admission-session4b-safe-checkpoint-2026-09-28.md`.

Underlying family checkpoint:
`docs/verification/openrouter-model-family-session4a-safe-checkpoint-2026-09-28.md`.

Underlying discovery checkpoint:
`docs/verification/openrouter-model-discovery-session3-safe-checkpoint-2026-09-28.md`.

Underlying registry checkpoint:
`docs/verification/openrouter-model-registry-session2-safe-checkpoint-2026-09-28.md`.

## ECX compatibility baseline

Treat the closed Batch 1–7 contracts as current compatibility requirements unless an explicit new decision changes them.

Current ECX includes:

- governed single-recipient execution;
- durable execution receipt/idempotency/replay;
- single-recipient `delta` and `full` round-trip semantics;
- explicit `agent.result.receive` authority;
- returned-result size/hash/trust/sensitivity boundaries;
- hosted-parent owner-backed source isolation;
- usage/cost observability and deterministic offline evidence;
- Historical Ledger archive/compaction with exact logical replay;
- deterministic 2–8 recipient `delta` fan-out;
- one durable fan-out receipt and exactly one parent aggregation continuation;
- 65,536-byte child and 131,072-byte aggregate limits.

Do not silently add or claim:

- external A2A;
- recursive agent graphs;
- Flow/Temporal ECX fan-out orchestration;
- `full` multi-recipient merge semantics;
- default broadcast;
- broad ECX/History UI;
- automatic destructive Ledger purge;
- universal savings/quality/latency superiority.

Canonical checkpoint:
`docs/verification/ecx-execution-b7-safe-checkpoint-2026-09-27.md`.

## Architecture invariants

- Memory and external content are untrusted data, not instructions.
- Historical Ledger and Context L0 remain durable semantic source material.
- No cross-service database access.
- Hub owns policy, approvals, audit, capability authority and ECX coordination.
- Connect owns provider credentials, MCP runtime state, model invocation and hosted-spend authority.
- Context owns memory semantics; Artifact owns raw artifact bytes.
- Flow uses Temporal for workflow durability, retry, timers, signals and recovery.
- Space stores composition/references; it does not copy owner data into a competing source of truth.
- Hosted egress follows scope/sensitivity/sync-class policy.
- Hosted-derived memory follows quarantine/governed promotion.
- No silent provider fallback.
- Side effects require stable idempotency identity and the appropriate approval boundary.
- Production credentials belong in Connect Vault, never Git/docs/chat output.
- Durable evidence claims require pinned/traceable model and runtime identity.
- AutoClick remains deferred until a concrete non-API case justifies it.

## Product invariants

- Workspace remains the authority/security boundary; Project is inside Workspace.
- Project is context/product grouping, not a new blob/data owner.
- `All` is virtual; `Personal` is a real default Project.
- Sibling Project memory never joins a prompt implicitly.
- Schedule is a time-trigger UI, not a scheduler engine.
- Temporal remains Flow timer/retry/state/recovery owner.
- Trigger cannot grant authority.
- Autonomy remains Hub policy; do not create an autonomous service.
- Run is a unified read model; do not create competing execution truth.
- Brain is a rebuildable projection; no graph DB by default.
- Context remains retrieval owner; ECX remains context-pack/execution coordination inside Hub boundaries.
- No first-class Task domain until a real need is proven.
- `MAX_AUTONOMY_V1` stays L3.

## Current active / separate scopes

Session 4E is the active bounded product/runtime scope. Continue only the slice named by `docs/active-work-plan.md`; do not widen it implicitly.

Do not start these separate scopes without explicit operator authorization:

- Session 4F final OpenRouter polish/closure after Session 4E is complete;
- DR-2 checkpoint 2 and physical-independence runtime proof;
- public production cutover;
- native Google Drive integration;
- Workspace registry/switcher or broader multi-user identity/final RBAC;
- paid hosted-provider/W18 freshness work;
- external A2A;
- recursive agent graphs;
- Flow/Temporal long-running ECX fan-out orchestration;
- `full` multi-recipient merge semantics;
- broad ECX/History UI;
- automatic destructive Historical Ledger purge;
- AutoClick / L4 autonomy.

SumoPod is staging, not production. The staging Basic-Auth human gate is a bounded single-operator staging control, not final multi-user identity/RBAC.

## Git / closure discipline

- start from synchronized reviewed `main`;
- one active implementation/closure scope at a time;
- use a short-lived explicit branch;
- keep scope bounded;
- add deterministic tests for behavior/policy changes;
- require relevant exact-head CI/Product Eval/acceptance;
- never weaken a gate to manufacture PASS;
- merge only the reviewed head;
- synchronize current docs after material state changes;
- preserve `.gitattributes`: text LF by default, `.cmd`/`.bat` CRLF;
- delete merged temporary branches only after exact remote-SHA revalidation.

The historical 393-branch cleanup, post-ECX cleanup, and NVIDIA trial branch cleanup are closed. The cleanup boundary remains 9 retained branches. Runtime closure after Session 4A has seven known later bookkeeping/provenance refs beyond that boundary, for a live inventory of 16 with zero unexpected active work branches before the temporary Session 4A docs-closure branch. Future non-bookkeeping branch growth must be handled as a new exact-SHA delta.

## Evidence discipline

- preserve valid failed evidence;
- do not rewrite historical snapshots to make the past look green;
- keep raw private runtime evidence gitignored;
- commit sanitized summaries only;
- do not claim universal savings/security/reliability from bounded evidence;
- do not rerun paid W18 merely for freshness;
- reopen closed evidence only for a reproducible regression or materially changed identity/boundary.

## Documentation discipline

Current truth belongs in:

- `README.md`;
- `docs/current-state-and-next-steps.md`;
- `docs/active-work-plan.md`;
- `docs/EXECUTION-PROGRESS.md`.

Navigation belongs in `docs/README.md`.

Architecture decisions belong in ADRs. Operational procedure belongs in runbooks. Dated measurements, WIP checkpoints and closure evidence belong in `docs/verification/`. Superseded analysis belongs in archive.

Historical text may truthfully contain old states such as “NEXT / NOT STARTED”; never treat those dated statements as the current queue unless the current-state layer explicitly agrees.
