# ECORIONE — Current State & Next Steps

Last updated: **2026-09-10**

Status: **CURRENT / canonical handoff for humans and AI agents**

This document is the shortest current-state handoff after the Batch 1–12 platform/production roadmap closure. Historical plans and audits remain useful evidence, but they must not be used as the source of current implementation status.

## 1. Current verdict

**ECORIONE production/self-host baseline READY** for the documented repository and self-host deployment boundary.

The planned platform/production roadmap is complete:

- Batch 1–12: **CLOSED**
- remaining planned batch inside that roadmap: **0**
- Fase 0–4: **CLOSED baseline**
- Fase 5 AutoClick: **DEFERRED BY DESIGN**
- Fase 6+: **OPEN-ENDED / evidence-driven**
- there is **no implicit Batch 13**

Final closure state on `main`:

- implementation PR #29 merge: `ad67b68290a41e69e18dfa49caefed0090bd9635`
- closure PR #30 merge: `783a4ae8a2c90b3c696b3d619fb0c03581f675b2`
- final post-closure main CI: `34490006960` — PASS
- implementation exact-head MCP External HTTPS Acceptance: `34485292292` — PASS
- implementation post-merge MCP External HTTPS Acceptance: `34485575560` — PASS

The final CI passed Naming, Format, Lint, Typecheck, Test, Phase 4 real-process acceptance, Production Operations acceptance, Secret Scan, and Production Build.

## 2. What is already in the baseline

The current baseline includes:

- Ai chat, `/space`, `/ops`, and `/settings` Control Center;
- Hub orchestration, policy, approval, audit, Historical Ledger, ECX, capability/permission authority;
- Connect provider gateway, local OpenAI-compatible runtime, Anthropic/OpenRouter/OpenAI provider boundaries, credential vault, durable spend budget, inbound/outbound MCP, runtime settings;
- Context L0–L2 memory plus L3 metadata binding;
- Sync local/self-host relay and MCP HTTPS bridge;
- Artifact content-addressed storage;
- Sandbox Tier 0, WASM, and hardened Docker boundary;
- Space block/note runtime;
- Flow durable orchestration using Temporal;
- RnD traces/evaluation foundation and dataset governance;
- multimodal/realtime voice baseline;
- data rebuild/governance/DR tooling;
- production observability, provider canary mechanism, self-host Compose, release/upgrade/rollback tooling;
- full-history + working-tree secret scanning and release security acceptance;
- real public HTTPS MCP acceptance with provider-resilient tunnel testing.

## 3. What CLOSED does and does not mean

`CLOSED` means the planned Batch 1–12 implementation scope passed its closure evidence and is present on `main`.

It does **not** mean:

- security work ends forever;
- production provider quality/latency is proven by deterministic CI;
- off-host backup durability exists automatically;
- host OS/firewall/account hardening is handled by repository code;
- process-local rate limiting is a distributed global limiter;
- ECX savings may be claimed without real production telemetry;
- AutoClick should now be built automatically.

## 4. Next execution order

Future work is a **new scope**, not Batch 13. Recommended order:

1. **Production deployment**
   - deploy the current baseline to a real VPS/server;
   - validate persistence, restart behavior, backups, restore, networking, domain, and TLS;
   - recommended public edge: Cloudflare Free + Cloudflare Tunnel; see `docs/cloudflare-free-deployment.md`.

2. **Real provider validation**
   - run real Anthropic/OpenRouter/OpenAI canaries using operator-owned credentials;
   - measure latency, errors, quality, token usage, and actual billed cost;
   - keep model identities pinned and no silent fallback.

3. **Production observability**
   - collect durable external metrics from the existing process metrics/trace surfaces;
   - establish daily baselines for p50/p95, error rate, provider latency, costs, cache, MCP, Flow, and ECX traffic.

4. **Security hardening outside repository CI**
   - VPS/host patching;
   - firewall and SSH hardening;
   - Cloudflare account security;
   - backup separation/off-host copies;
   - distributed/global rate limiting only if deployment scale actually requires it.

5. **Product validation**
   - identify real workflows users repeatedly need;
   - prioritize product changes from evidence instead of adding generic features.

6. **RnD / evaluation**
   - build real task/eval datasets;
   - compare provider/model/routing choices;
   - validate whether ECX or optimizer choices actually improve cost/quality/latency.

7. **UX / Control Center improvement**
   - improve Settings, provider/MCP management, approval UX, operations views, and error explanation based on real use.

8. **Ecosystem integration**
   - connect other projects only through explicit contracts/APIs;
   - never introduce cross-service database access.

9. **Maintenance track**
   - dependency/security updates;
   - regression monitoring;
   - backup/restore drills;
   - provider model/pricing review;
   - production incident evidence.

10. **New features only from evidence**
   - AutoClick/RPA remains deferred until a concrete non-API use case passes architecture review.

## 5. AI-agent reading order

An agent starting without chat history should read:

1. `docs/current-state-and-next-steps.md` — current state and next work;
2. `AGENTS.md` — invariants and repo rules;
3. `docs/EXECUTION-PROGRESS.md` — detailed implementation/closure history;
4. `docs/verification/batch12-closure-2026-09-10.md` — final Batch 12 evidence;
5. `docs/production-operations.md` and `docs/release-operations.md` — production/release procedures;
6. `docs/cloudflare-free-deployment.md` — recommended free public-edge deployment;
7. `docs/prd.md`, `docs/research.md`, `docs/blueprint.md` — product rationale and historical planning context;
8. relevant ADR/API/operations docs for the exact subsystem being changed.

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
- update this file and `docs/EXECUTION-PROGRESS.md` when current state materially changes;
- keep historical audits/verification files as historical evidence unless a file explicitly describes itself as current/canonical.

## 7. Canonical status references

- detailed progress: `docs/EXECUTION-PROGRESS.md`
- final closure evidence: `docs/verification/batch12-closure-2026-09-10.md`
- final release decision: `docs/adr/0033-final-security-release-closure.md`
- open-ended hardening posture: `docs/fase6-hardening.md`
- production operations: `docs/production-operations.md`
- Cloudflare Free deployment: `docs/cloudflare-free-deployment.md`
