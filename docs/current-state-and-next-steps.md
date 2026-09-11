# ECORIONE — Current State & Next Steps

Last updated: **2026-09-11**

Status: **CURRENT / canonical handoff for humans and AI agents**

This document is the shortest current-state handoff after the Batch 1–12 platform/production roadmap closure and the real laptop Production Activation rehearsal. Historical plans and audits remain useful evidence, but they must not be used as the source of current implementation status.

## 1. Current verdict

**ECORIONE production/self-host repository baseline READY; real local laptop rehearsal CLOSED for the local boundary.**

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

The post-merge CI for PR #34 (`34515179325`) passed Naming, Format, Lint, Typecheck, Test, Phase 4 real-process acceptance, Production Operations acceptance, Secret Scan and Production Build.

### Progress snapshot

| Area | Current state | Meaning |
|---|---:|---|
| Defined platform/production implementation roadmap | **12/12 batches = 100% CLOSED** | Planned repository implementation scope is finished and verified on `main`. |
| Production/self-host repository baseline | **READY** | Compose/Caddy/release/security baseline passed repository evidence. |
| Real laptop production rehearsal | **PASS / LOCAL BOUNDARY CLOSED** | Phase 4, Temporal worker, Connect→Ollama→Gemma, direct Ai API, browser Local chat, sourced-env verification and Git synchronization were exercised on the real laptop. |
| Historical Ledger + ECX local evidence | **ACTIVE NEXT CHECKPOINT** | Deterministic coverage exists; next inspect the real local browser traffic just generated for chronology/integrity and ECX/model/token/cache/cost evidence. |
| Real compute-host/VPS production deployment | **READY AFTER LOCAL EVIDENCE CHECKPOINT** | Production Activation tooling exists; real host mutation still requires target-host evidence. |
| Cloudflare Free named Tunnel cutover | **TOOLING READY / account+host execution pending** | Cloudflare remains DNS/TLS/tunnel edge in front of the compute host. |
| Real hosted-provider validation | **TOOLING READY / credentials+live run pending** | Provider matrix canary validates Anthropic/OpenRouter/OpenAI through Connect Vault and restores runtime settings. |
| Durable external production telemetry | **TOOLING READY / live snapshots pending** | Process metrics/traces can be checked and snapshotted; long-term retention remains external. |
| Product/R&D optimization evidence | **LOCAL EVIDENCE STARTED / PRODUCTION TRAFFIC PENDING** | Local model traffic is real; public savings claims still require representative evidence. |

Do not collapse these rows into one percentage. **100% refers only to the defined Batch 1–12 implementation roadmap**, not to the never-ending operational maturity of a live production system.

### Real local rehearsal closure

Sanitized evidence lives in `docs/verification/local-production-rehearsal-2026-09-10.md`.

The final local checkpoint includes:

- Temporal/PostgreSQL real containers with the Flow worker `RUNNING`;
- Ollama reachable from WSL through mirrored networking while remaining loopback-bound;
- local provider canary reporting `model=gemma4:latest`, `responseModel=gemma4:latest`, `pricingModel=local/provider-token-zero`;
- direct `POST /api/chat` with `target=local` returning a Gemma response with provider-token cost `0`;
- refreshed browser UI showing `Route: Local`, locking the route after the first turn, and completing a real Local chat with `Model: gemma4:latest`;
- laptop/GitHub tracked trees synchronized before the final documentation closure;
- final sourced-env `pnpm verify`: **104/104 test files, 540 passed, 2 skipped, secret scan clean, production build PASS**.

The browser initially showed a stale client bundle without the Route selector even though server HTML already contained it. A hard refresh loaded the current UI; no repository code change was required for that browser-cache condition.

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

`CLOSED` means the planned Batch 1–12 implementation scope passed closure evidence and is present on `main`. The local-rehearsal closure means the documented laptop boundary was exercised successfully.

It does **not** mean:

- security work ends forever;
- VPS persistence/restart/backup is proven by laptop evidence;
- Cloudflare named-Tunnel operation is proven on the real account/host;
- hosted provider quality/latency/cost is proven by local Gemma;
- off-host backup durability exists automatically;
- ECX savings may be claimed from one local turn or counterfactual UI accounting;
- AutoClick should now be built automatically.

## 4. Next execution order

Future work is a **new scope**, not Batch 13. Current recommended order:

1. **Historical Ledger + ECX local evidence closure**
   - inspect the real Local browser chat session and operation records;
   - verify Ledger event order, parent links, integrity/replay expectations and local sync class;
   - verify ECX/model/token/cache/cost telemetry without turning counterfactual savings into a public claim;
   - record only sanitized evidence in Git.

2. **Production deployment**
   - deploy the synchronized baseline to a real compute host/VPS/server;
   - validate persistence, restart behavior, backups, restore, networking, domain and TLS;
   - execute `docs/production-activation.md`;
   - recommended public edge: Cloudflare Free + Cloudflare Tunnel; see `docs/cloudflare-free-deployment.md`.

3. **Real hosted-provider validation**
   - run Anthropic/OpenRouter/OpenAI canaries using operator-owned credentials through Connect Vault;
   - measure latency, errors, quality, token usage and actual billed cost;
   - keep model identities pinned and no silent fallback.

4. **Production observability and security hardening**
   - collect durable external metrics from process metrics/trace surfaces;
   - establish p50/p95, error, provider latency, cost, cache, MCP, Flow and ECX baselines;
   - harden host patching, firewall, SSH, Cloudflare account security and off-host backups.

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
4. `docs/verification/local-production-rehearsal-2026-09-10.md` — real laptop runtime evidence and findings;
5. `docs/EXECUTION-PROGRESS.md` — detailed implementation/closure history;
6. `docs/verification/batch12-closure-2026-09-10.md` — final Batch 12 evidence;
7. `docs/production-operations.md` and `docs/release-operations.md` — production/release procedures;
8. `docs/cloudflare-free-deployment.md` — recommended free public-edge deployment;
9. `docs/prd.md`, `docs/research.md`, `docs/blueprint.md` — rationale and historical planning context;
10. relevant ADR/API/operations docs for the exact subsystem being changed.

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
- local runtime evidence: `docs/verification/local-production-rehearsal-2026-09-10.md`
- detailed closed-roadmap progress: `docs/EXECUTION-PROGRESS.md`
- final closure evidence: `docs/verification/batch12-closure-2026-09-10.md`
- final release decision: `docs/adr/0033-final-security-release-closure.md`
- open-ended hardening posture: `docs/fase6-hardening.md`
- production operations: `docs/production-operations.md`
- Cloudflare Free deployment: `docs/cloudflare-free-deployment.md`
