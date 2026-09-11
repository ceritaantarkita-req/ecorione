# ECORIONE — Current State & Next Steps

Last updated: **2026-09-11**

Status: **CURRENT / canonical handoff for humans and AI agents**

This document is the shortest current-state handoff after the Batch 1–12 platform/production roadmap closure, the real laptop Production Activation rehearsal, and the real local Historical Ledger + ECX evidence closure. Historical plans and audits remain useful evidence, but they must not be used as the source of current implementation status.

## 1. Current verdict

**ECORIONE production/self-host repository baseline READY; real local laptop rehearsal and Historical Ledger + ECX evidence CLOSED for the local boundary.**

The planned platform/production roadmap remains complete:

- Batch 1–12: **CLOSED**
- remaining planned batch inside that roadmap: **0**
- Fase 0–4: **CLOSED baseline**
- Fase 5 AutoClick: **DEFERRED BY DESIGN**
- Fase 6+: **OPEN-ENDED / evidence-driven**
- there is **no implicit Batch 13**

Key post-closure merges now on `main` include:

- implementation PR #29: `ad67b68290a41e69e18dfa49caefed0090bd9635`
- closure PR #30: `783a4ae8a2c90b3c696b3d619fb0c03581f675b2`
- documentation synchronization PR #31: `aa360b81a6ef5cd41f466d7ada239b4e461c60ee`
- Production Activation tooling + local-rehearsal runtime fixes PR #32: `a6cc17530b4e4540d710fa449c93844a8dad7981`
- sourced-env proxy-test isolation PR #33: `eac26497aa868e448c5fa4e48c3331abf585d5cf`
- secret-scan Git-boundary correction PR #34: `a95e5e20bb30d4828288f6bba230860bc65e631f`
- real local rehearsal documentation closure PR #35: `7b1d50630e21a14413f73e2ca4a0934de042dcdf`
- browser/Historical-Ledger session hydration identity fix PR #36: `8b93b346a11cc4293af2b8e75e2ec6af48348e60`

The post-merge CI for PR #36 (`34551995621`) passed Naming, Format, Lint, Typecheck, Test, Phase 4 real-process acceptance, Production Operations acceptance, Secret Scan and Production Build.

### Progress snapshot

| Area | Current state | Meaning |
|---|---:|---|
| Defined platform/production implementation roadmap | **12/12 batches = 100% CLOSED** | Planned repository implementation scope is finished and verified on `main`. |
| Production/self-host repository baseline | **READY** | Compose/Caddy/release/security baseline passed repository evidence. |
| Real laptop production rehearsal | **PASS / LOCAL BOUNDARY CLOSED** | Phase 4, Temporal worker, Connect→Ollama→Gemma, direct Ai API, browser Local chat, sourced-env verification and Git synchronization were exercised on the real laptop. |
| Historical Ledger + ECX local evidence | **PASS / LOCAL CHECKPOINT CLOSED** | A real Local Gemma browser session was verified in the hash-chained Ledger; a real pointer-first ECX plan appended `agent.handoff`, hydrated the exact local history range and made `production:data-evidence` PASS. |
| Real compute-host/VPS production deployment | **ACTIVE NEXT CHECKPOINT** | Local evidence gates are closed; production mutation still requires target-host evidence. |
| Cloudflare Free named Tunnel cutover | **TOOLING READY / account+host execution pending** | Cloudflare remains DNS/TLS/tunnel edge in front of the compute host. |
| Real hosted-provider validation | **TOOLING READY / credentials+live run pending** | Provider matrix canary validates Anthropic/OpenRouter/OpenAI through Connect Vault and restores runtime settings. |
| Durable external production telemetry | **TOOLING READY / live snapshots pending** | Process metrics/traces can be checked and snapshotted; long-term retention remains external. |
| Product/R&D optimization evidence | **LOCAL TRAFFIC EVIDENCE PASS / COMPARATIVE SAVINGS PENDING** | Local model/Ledger/ECX traffic is real; public efficiency or savings claims still require representative comparative evidence. |

Do not collapse these rows into one percentage. **100% refers only to the defined Batch 1–12 implementation roadmap**, not to the never-ending operational maturity of a live production system.

### Real local rehearsal and data-evidence closure

Sanitized runtime evidence lives in:

- `docs/verification/local-production-rehearsal-2026-09-10.md`;
- `docs/verification/historical-ledger-ecx-local-evidence-2026-09-11.md`.

The final local checkpoints include:

- Temporal/PostgreSQL real containers with the Flow worker `RUNNING`;
- Ollama reachable from WSL through mirrored networking while remaining loopback-bound;
- local provider canary reporting `model=gemma4:latest`, `responseModel=gemma4:latest`, `pricingModel=local/provider-token-zero`;
- direct `POST /api/chat` with `target=local` returning a Gemma response with provider-token cost `0`;
- refreshed browser UI showing `Route: Local`, locking the route after the first turn, and completing a real Local chat with `Model: gemma4:latest`;
- browser-visible session identity verified to equal the `LOCAL_ONLY` Historical Ledger session after PR #36;
- real Ledger chronology `user.message → model.called → agent.message → agent.handoff` with an intact hash chain;
- real ECX plan selecting the exact-capability reviewer, one pointer-first packet of 478 bytes, and one local-only history hydration of 1,725 bytes;
- `pnpm production:data-evidence` PASS with 8 sessions / 15 Ledger events, 1 ECX plan, 1 packet, 1 hydration, 1 real provider call, 210 input tokens, 350 output tokens and provider-token actual cost USD 0 at the captured local snapshot;
- laptop/GitHub tracked trees synchronized before the data-evidence run;
- final sourced-env `pnpm verify` before the data-evidence checkpoint: **104/104 test files, 540 passed, 2 skipped, secret scan clean, production build PASS**.

The browser initially showed a stale client bundle without the Route selector even though server HTML already contained it. A hard refresh loaded the current UI; no repository code change was required for that browser-cache condition.

A separate real finding was the header/session hydration mismatch: server render and client hydration could generate different random session IDs while `suppressHydrationWarning` hid the mismatch. PR #36 changed the header to a deterministic pre-hydration placeholder and makes the displayed client session identical to the session sent to `/api/chat`; the real post-fix browser session then resolved directly in Historical Ledger.

The ECX evidence is a traffic/integrity proof, **not a savings proof**. The counterfactual `naiveUsd`/UI savings display does not establish comparative ECX or optimizer savings.

## 2. What is already in the baseline

The current baseline includes:

- Ai chat with explicit Local/Hosted routing, `/space`, `/ops`, and `/settings` Control Center;
- Hub orchestration, policy, approval, audit, Historical Ledger, ECX, capability/permission authority;
- Connect provider gateway, local OpenAI-compatible runtime, Anthropic/OpenRouter/OpenAI boundaries, credential vault, spend budget, inbound/outbound MCP, runtime settings;
- Context L0–L2 memory plus L3 metadata binding;
- Sync local/self-host relay and MCP HTTPS bridge;
- Artifact content-addressed storage;
- Sandbox Tier 0, WASM, and hardened Docker boundary;
- Space block/note runtime;
- Flow durable orchestration using Temporal;
- RnD traces/evaluation foundation and dataset governance;
- multimodal/realtime voice baseline;
- data rebuild/governance/DR tooling;
- production observability, provider canaries, self-host Compose, release/upgrade/rollback tooling;
- full-history + Git commit-boundary secret scanning and release security acceptance;
- real public HTTPS MCP acceptance with provider-resilient tunnel testing.

## 3. What CLOSED does and does not mean

`CLOSED` means the planned Batch 1–12 implementation scope passed closure evidence and is present on `main`. The local-rehearsal and Historical Ledger + ECX local closures mean those documented laptop boundaries were exercised successfully.

It does **not** mean:

- security work ends forever;
- VPS persistence/restart/backup is proven by laptop evidence;
- Cloudflare named-Tunnel operation is proven on the real account/host;
- hosted provider quality/latency/cost is proven by local Gemma;
- off-host backup durability exists automatically;
- ECX or optimizer savings may be claimed from the local packet/hydration counts or counterfactual UI accounting;
- an ECX-selected recipient has necessarily executed a second model call;
- AutoClick should now be built automatically.

## 4. Next execution order

Future work is a **new scope**, not Batch 13. Current recommended order:

1. **Production deployment**
   - deploy the synchronized baseline to a real compute host/VPS/server;
   - validate persistence, restart behavior, backups, restore, networking, domain and TLS;
   - execute `docs/production-activation.md`;
   - recommended public edge: Cloudflare Free + Cloudflare Tunnel; see `docs/cloudflare-free-deployment.md`.

2. **Real hosted-provider validation**
   - run Anthropic/OpenRouter/OpenAI canaries using operator-owned credentials through Connect Vault;
   - measure latency, errors, quality, token usage and actual billed cost;
   - keep model identities pinned and no silent fallback.

3. **Production observability and security hardening**
   - collect durable external metrics from process metrics/trace surfaces;
   - establish p50/p95, error, provider latency, cost, cache, MCP, Flow and ECX baselines;
   - harden host patching, firewall, SSH, Cloudflare account security and off-host backups.

4. **Comparative ECX/optimizer evidence**
   - design representative paired tasks/workloads;
   - compare equivalent ECX/pointer-first and non-ECX/full-context paths where meaningful;
   - measure bytes/tokens/latency/cost/quality and only make savings claims supported by comparable telemetry.

5. **Product validation / RnD / UX / ecosystem integration**
   - use real workflows and task/eval datasets;
   - compare provider/model/routing choices;
   - improve Control Center from observed friction;
   - integrate other projects only through explicit contracts/APIs and never cross-service DB access.

6. **Maintenance and new features from evidence only**
   - dependency/security updates, backup/restore drills, provider model/pricing review, incident evidence;
   - AutoClick/RPA remains deferred until a concrete non-API use case passes architecture review.

## 5. AI-agent reading order

An agent starting without chat history should read:

1. `docs/current-state-and-next-steps.md` — current state and next work;
2. `AGENTS.md` — invariants and repo rules;
3. `docs/production-activation.md` — active post-closure operational execution and evidence gates;
4. `docs/verification/historical-ledger-ecx-local-evidence-2026-09-11.md` — real Local Ledger + ECX traffic closure;
5. `docs/verification/local-production-rehearsal-2026-09-10.md` — real laptop runtime evidence and findings;
6. `docs/EXECUTION-PROGRESS.md` — detailed implementation/closure history;
7. `docs/verification/batch12-closure-2026-09-10.md` — final Batch 12 evidence;
8. `docs/production-operations.md` and `docs/release-operations.md` — production/release procedures;
9. `docs/cloudflare-free-deployment.md` — recommended free public-edge deployment;
10. `docs/prd.md`, `docs/research.md`, `docs/blueprint.md` — rationale and historical planning context;
11. relevant ADR/API/operations docs for the exact subsystem being changed.

## 6. Rules for the next agent

Before implementing new work:

- start from current `main`;
- state the new scope explicitly; do not call it Batch 13 by default;
- preserve owner-service boundaries and existing invariants;
- do not rewrite Historical Ledger or Context L0 ground truth;
- keep provider/credential authority in Connect and policy/approval authority in Hub;
- preserve external MCP as real public-network acceptance;
- do not weaken release gates to make CI green;
- create/update ADRs when architecture changes;
- update this file, `docs/production-activation.md`, and relevant verification docs when current state materially changes;
- keep historical audits/verification files as historical evidence unless a file explicitly describes itself as current/canonical.

## 7. Canonical status references

- active production continuation: `docs/production-activation.md`
- local Ledger + ECX evidence: `docs/verification/historical-ledger-ecx-local-evidence-2026-09-11.md`
- local runtime evidence: `docs/verification/local-production-rehearsal-2026-09-10.md`
- detailed closed-roadmap progress: `docs/EXECUTION-PROGRESS.md`
- final closure evidence: `docs/verification/batch12-closure-2026-09-10.md`
- final release decision: `docs/adr/0033-final-security-release-closure.md`
- open-ended hardening posture: `docs/fase6-hardening.md`
- production operations: `docs/production-operations.md`
- Cloudflare Free deployment: `docs/cloudflare-free-deployment.md`
