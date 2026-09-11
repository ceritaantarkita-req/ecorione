# ECORIONE — Current State & Next Steps

Last updated: **2026-09-11**

Status: **CURRENT / canonical handoff for humans and AI agents**

This document is the shortest current-state handoff after the Batch 1–12 platform/production roadmap closure, the real laptop Production Activation rehearsal, the real local Historical Ledger + ECX evidence closure, the merged comparative harness, the cache-isolation runtime fix, and the first closure-grade Comparative ECX run. Historical plans and audits remain useful evidence, but they must not be used as the source of current implementation status.

## 1. Current verdict

**ECORIONE production/self-host repository baseline READY; real local laptop rehearsal and Historical Ledger + ECX traffic/integrity evidence CLOSED for the local boundary; Comparative ECX harness implementation CLOSED/VERIFIED; cache isolation VERIFIED in real runtime; first 5× closure-grade run executed 75 measured calls and passed 4/5 tasks, but `release-readiness` exposed an exact-value fixture delimiter ambiguity, so comparative efficiency evidence remains ACTIVE / NOT YET CLOSED.**

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
- Historical Ledger + ECX local evidence closure PR #37: `88d588bbe4a5f005652c20f3409dd72093439f56`
- comparative ECX harness PR #38: `c1849cd0c67712e40ea4e5c90587283900859cdb`
- comparative harness docs closure PR #39: `5437c1ea5d8ee168dbbe09de688a23c39089c7aa`
- comparative cache-isolation fix PR #40: `197627dc04689dea94bf7957e18b2699f8fb9213`

PR #38 verification:

- final PR head `d3f1cbf4d0acbb2c92f340b952f2c42e6c9bef4a`;
- exact-head CI `34557147546`: PASS Naming, Format, Lint, Typecheck, Test, Phase 4 real-process acceptance, Production Operations acceptance, Secret Scan and Production Build;
- exact-head MCP External HTTPS Acceptance `34557147583`: PASS;
- post-merge `main` CI `34557297702`: PASS all repository gates;
- post-merge `main` MCP External HTTPS Acceptance `34557297803`: PASS.

PR #40 verification:

- exact-head CI: PASS all repository gates;
- squash merge: `197627dc04689dea94bf7957e18b2699f8fb9213`;
- post-merge CI `34561893817`: PASS all repository gates;
- corrected real Gemma smoke after laptop synchronization: PASS with all three measured lanes uncached and non-zero token telemetry.

### Progress snapshot

| Area | Current state | Meaning |
|---|---:|---|
| Defined platform/production implementation roadmap | **12/12 batches = 100% CLOSED** | Planned repository implementation scope is finished and verified on `main`. |
| Production/self-host repository baseline | **READY** | Compose/Caddy/release/security baseline passed repository evidence. |
| Real laptop production rehearsal | **PASS / LOCAL BOUNDARY CLOSED** | Phase 4, Temporal worker, Connect→Ollama→Gemma, direct Ai API, browser Local chat, sourced-env verification and Git synchronization were exercised on the real laptop. |
| Historical Ledger + ECX local traffic/integrity evidence | **PASS / LOCAL CHECKPOINT CLOSED** | A real Local Gemma browser session was verified in the hash-chained Ledger; a real pointer-first ECX plan appended `agent.handoff`, hydrated the exact local history range and made `production:data-evidence` PASS. |
| Comparative ECX harness implementation | **PASS / IMPLEMENTATION CLOSED** | Three-lane local benchmark harness, deterministic scoring/gates, regression coverage and docs were merged and repository-verified. |
| Comparative ECX cache isolation | **PASS / RUNTIME VERIFIED** | PR #40 added a unique per-invocation namespace; corrected smoke showed all measured lanes `cacheHit=false` with real token telemetry. |
| Comparative ECX first 5× closure run | **FAIL / VALID FINDING — 4/5 TASKS PASS** | 75 measured calls ran. `release-readiness` failed exact quality equally in baseline/control/selective lanes because two source values were sentence-punctuation ambiguous relative to the fixed exact answer key. |
| Comparative release fixture correction | **IN REVIEW / RERUN REQUIRED** | Follow-up keeps answer key, scorer, and all thresholds unchanged; only removes ambiguous source punctuation and adds regression coverage. |
| Comparative ECX real Gemma evidence | **ACTIVE / NOT CLOSED** | After the fixture correction merges, run targeted `release-readiness`, then rerun the full 5× benchmark on the corrected merged revision. |
| Automatic reference selection / general optimizer claim | **NOT YET PROVEN** | Current ECX hydration receives caller-selected `refIndexes`; the oracle lane measures selective-hydration potential, not an autonomous production selector. |
| Real compute-host/VPS production deployment | **DEFERRED BY OPERATOR DECISION** | Tooling remains ready, but no target-host mutation should be performed until the operator explicitly resumes deployment. |
| Cloudflare Free named Tunnel cutover | **DEFERRED WITH COMPUTE-HOST DEPLOYMENT** | Cloudflare remains the documented DNS/TLS/tunnel edge option; no current account/host execution is requested. |
| Real hosted-provider validation | **TOOLING READY / credentials+live run pending** | Provider matrix canary exists; local R&D does not require hosted credentials or spending. |
| Durable external production telemetry | **TOOLING READY / PRODUCTION RUN PENDING** | Process metrics/traces can be checked and snapshotted; long-term production retention remains future work. |

Do not collapse these rows into one percentage. **100% refers only to the defined Batch 1–12 implementation roadmap**, not to the never-ending operational maturity of a live production system.

### Real local rehearsal and data-evidence closure

Sanitized runtime evidence lives in:

- `docs/verification/local-production-rehearsal-2026-09-10.md`;
- `docs/verification/historical-ledger-ecx-local-evidence-2026-09-11.md`.

The closed local checkpoints include:

- Temporal/PostgreSQL real containers with the Flow worker `RUNNING`;
- Ollama reachable from WSL through mirrored networking while remaining loopback-bound;
- local provider canary reporting `model=gemma4:latest`, `responseModel=gemma4:latest`, `pricingModel=local/provider-token-zero`;
- direct `POST /api/chat` with `target=local` returning a Gemma response with provider-token cost `0`;
- refreshed browser UI showing `Route: Local`, locking the route after the first turn, and completing a real Local chat with `Model: gemma4:latest`;
- browser-visible session identity verified to equal the `LOCAL_ONLY` Historical Ledger session after PR #36;
- real Ledger chronology `user.message → model.called → agent.message → agent.handoff` with an intact hash chain;
- real ECX plan selecting the exact-capability reviewer, one pointer-first packet of 478 bytes, and one local-only history hydration of 1,725 bytes;
- `pnpm production:data-evidence` PASS with 8 sessions / 15 Ledger events, 1 ECX plan, 1 packet, 1 hydration, 1 real provider call, 210 input tokens, 350 output tokens and provider-token actual cost USD 0 at the captured local snapshot;
- laptop/GitHub tracked trees synchronized at the Historical Ledger + ECX closure commit.

The ECX closure above is a traffic/integrity proof, **not a savings proof**. The counterfactual `naiveUsd`/UI savings display does not establish comparative ECX or optimizer savings.

### Comparative runtime progression

Verification sources:

- `docs/verification/comparative-harness-implementation-2026-09-11.md`;
- `docs/verification/comparative-smoke-cache-defect-2026-09-11.md`;
- `docs/verification/comparative-closure-grade-first-run-2026-09-11.md`.

PR #38 merged the controlled three-lane harness:

- `full-inline` — all fixture context goes directly to the same local model;
- `ecx-all` — real Artifact pointers + ECX plan + all-ref hydration, preserving the same semantic document set;
- `ecx-selective-oracle` — same ECX packet with only fixture-declared relevant refs hydrated.

The first real smoke exposed a cross-invocation exact-cache namespace defect. PR #40 corrected that without weakening any gate. The corrected real smoke then passed on `197627dc04689dea94bf7957e18b2699f8fb9213`: all measured lanes were uncached, model identity stayed `gemma4:latest`, deterministic quality was 100%, and selective context/token measurements were lower for the smoke fixture.

The first complete 5-task × 5-repeat run then executed 75 measured model calls. Aggregate observations were 4/5 tasks passed, median selective transport reduction `73.6379379246037%`, median selective input-token reduction `77.70491803278688%`, and median selective/full latency ratio `0.8387964882197358`. These numbers are **provisional because the overall run failed the predeclared quality gate**.

The failed task was `release-readiness`. All three lanes had the same median quality failure (`1/3`), while their token/transport/latency gates still behaved as expected. The model copied sentence-final periods from two authoritative source lines, but the fixed expected values excluded those punctuation marks. Because the baseline/control/selective lanes failed identically, this is not evidence of ECX-specific quality loss. The follow-up fixture correction removes only the ambiguous sentence punctuation; it does not normalize `scoreReply`, change the expected answer, or lower any threshold.

Protocol: `docs/comparative-ecx-evidence.md`.

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
- real public HTTPS MCP acceptance with provider-resilient tunnel testing;
- merged comparative ECX harness using existing Artifact/Hub/Connect owner APIs.

The comparative harness does not change the owner-service architecture or grant a new optimizer capability.

## 3. What CLOSED does and does not mean

`CLOSED` means the planned Batch 1–12 implementation scope passed closure evidence and is present on `main`. The local-rehearsal and Historical Ledger + ECX local closures mean those documented laptop boundaries were exercised successfully. The comparative-harness implementation closure means the measurement tooling itself passed repository evidence and was merged; real comparative evidence remains a separate runtime gate.

It does **not** mean:

- security work ends forever;
- VPS persistence/restart/backup is proven by laptop evidence;
- Cloudflare named-Tunnel operation is proven on the real account/host;
- hosted provider quality/latency/cost is proven by local Gemma;
- off-host backup durability exists automatically;
- ECX or optimizer savings may be claimed from local packet/hydration counts or counterfactual UI accounting;
- `ecx-selective-oracle` proves automatic reference selection;
- the failed 4/5 closure run proves a general percentage savings claim;
- an ECX-selected recipient has necessarily executed a second model call;
- AutoClick should now be built automatically.

## 4. Next execution order

Future work is a **new scope**, not Batch 13. Current operator-approved order is local-first:

1. **Comparative ECX real Gemma efficiency evidence — ACTIVE**
   - finish repository verification of `fix/comparative-release-fixture-ambiguity-20260911`;
   - merge only after exact-head gates pass;
   - synchronize the laptop to the resulting `main`;
   - keep Phase 4 running if the service/runtime tree did not change;
   - run targeted `release-readiness` with one repeat using the corrected fixture;
   - require all three lanes to remain uncached and median quality to return to 100%;
   - if targeted verification is healthy, rerun the complete 5-task × 5-repeat closure benchmark;
   - preserve raw JSON locally/gitignored and commit only sanitized verified evidence;
   - do not convert oracle selective results into an automatic-selector or public-savings claim.

2. **Local persistence/restart drill**
   - restart relevant ECORIONE/Temporal/PostgreSQL boundaries in a controlled sequence;
   - verify Historical Ledger, Context, Artifact and durable Flow state survive according to their owner contracts;
   - document any state that is intentionally ephemeral.

3. **Local backup/restore drill**
   - generate owner-scoped backups using existing tooling;
   - restore into an isolated target rather than overwriting the active local state;
   - verify integrity/receipts and service health after restore.

4. **Local observability baseline**
   - capture `/ops` and model/ECX/Flow metrics during representative local workloads;
   - establish local p50/p95-style latency/error/resource baselines where the available sample size supports them;
   - investigate measured bottlenecks rather than assumed ones.

5. **UX/product validation**
   - exercise Local/Hosted routing surfaces, session/history behavior, settings, approval/error states and recovery paths as an operator/user;
   - create improvements only from observed friction.

6. **Immutable local model identity hardening**
   - replace mutable rehearsal alias usage with an operator-controlled immutable tag/alias before treating a local model identity as durable production evidence;
   - revalidate cache/telemetry identity after the change.

7. **Compute-host/VPS + Cloudflare deployment — DEFERRED**
   - resume only when the operator explicitly chooses to deploy;
   - then follow `docs/production-activation.md` and `docs/cloudflare-free-deployment.md` without treating earlier laptop evidence as target-host evidence.

8. **Hosted-provider comparative validation — optional/future**
   - only with operator-owned credentials through Connect Vault and explicit spend limits;
   - measure actual billed cost where the provider exposes it;
   - do not infer hosted savings from local USD 0 provider-token accounting.

## 5. AI-agent reading order

An agent starting without chat history should read:

1. `docs/current-state-and-next-steps.md` — current state and next work;
2. `AGENTS.md` — invariants and repo rules;
3. `docs/comparative-ecx-evidence.md` — active local comparative-evidence protocol and runtime findings;
4. `docs/verification/comparative-closure-grade-first-run-2026-09-11.md` — first 5× run and fixture ambiguity finding;
5. `docs/verification/comparative-smoke-cache-defect-2026-09-11.md` — first smoke cache-isolation finding;
6. `docs/verification/comparative-harness-implementation-2026-09-11.md` — merged harness implementation evidence;
7. `docs/verification/historical-ledger-ecx-local-evidence-2026-09-11.md` — real Local Ledger + ECX traffic closure;
8. `docs/verification/local-production-rehearsal-2026-09-10.md` — real laptop runtime evidence and findings;
9. `docs/production-activation.md` — operator-deferred production deployment procedure;
10. `docs/EXECUTION-PROGRESS.md` — detailed implementation/closure history;
11. `docs/verification/batch12-closure-2026-09-10.md` — final Batch 12 evidence;
12. `docs/production-operations.md` and `docs/release-operations.md` — production/release procedures;
13. `docs/cloudflare-free-deployment.md` — future free public-edge deployment option;
14. `docs/prd.md`, `docs/research.md`, `docs/blueprint.md` — rationale and historical planning context;
15. relevant ADR/API/operations docs for the exact subsystem being changed.

## 6. Rules for the next agent

Before implementing new work:

- start from current `main`;
- state the new scope explicitly; do not call it Batch 13 by default;
- preserve owner-service boundaries and existing invariants;
- do not rewrite Historical Ledger or Context L0 ground truth;
- keep provider/credential authority in Connect and policy/approval authority in Hub;
- preserve external MCP as real public-network acceptance;
- do not weaken release/evidence gates to make a benchmark or CI green;
- benchmark cache-busters must be isolated across separate invocations, not only within one invocation;
- for exact-match benchmark fixtures, authoritative values must have unambiguous delimiters; do not fix source ambiguity by normalizing the scorer after seeing results;
- do not represent fixture-declared `refIndexes` as an autonomous optimizer;
- create/update ADRs when architecture changes;
- update this file, `AGENTS.md`, `docs/EXECUTION-PROGRESS.md`, and the relevant workstream/verification docs when current state materially changes;
- keep historical audits/verification files as historical evidence unless a file explicitly describes itself as current/canonical.

## 7. Canonical status references

- current local comparative evidence: `docs/comparative-ecx-evidence.md`
- first closure-grade comparative run finding: `docs/verification/comparative-closure-grade-first-run-2026-09-11.md`
- first comparative smoke cache finding: `docs/verification/comparative-smoke-cache-defect-2026-09-11.md`
- comparative harness implementation closure: `docs/verification/comparative-harness-implementation-2026-09-11.md`
- local Ledger + ECX evidence: `docs/verification/historical-ledger-ecx-local-evidence-2026-09-11.md`
- local runtime evidence: `docs/verification/local-production-rehearsal-2026-09-10.md`
- operator-deferred production continuation: `docs/production-activation.md`
- detailed current progress: `docs/EXECUTION-PROGRESS.md`
- archived Batch 1–12 execution history: `docs/archive/execution-progress-through-batch12-2026-09-10.md`
- final closure evidence: `docs/verification/batch12-closure-2026-09-10.md`
- final release decision: `docs/adr/0033-final-security-release-closure.md`
- open-ended hardening posture: `docs/fase6-hardening.md`
- production operations: `docs/production-operations.md`
- Cloudflare Free deployment: `docs/cloudflare-free-deployment.md`
