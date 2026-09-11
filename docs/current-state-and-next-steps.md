# ECORIONE — Current State & Next Steps

Last updated: **2026-09-11**

Status: **CURRENT / canonical handoff for humans and AI agents**

This document is the shortest current-state handoff after the Batch 1–12 platform/production roadmap closure, real laptop Production Activation rehearsal, Historical Ledger + ECX local evidence closure, and the local Comparative ECX measurement checkpoint.

Historical plans/audits remain useful evidence, but they must not be used as the current implementation-status source.

## 1. Current verdict

**ECORIONE production/self-host repository baseline READY; real local laptop rehearsal and Historical Ledger + ECX traffic/integrity evidence CLOSED for the local boundary; Comparative ECX harness implementation CLOSED/VERIFIED; final corrected local Comparative ECX checkpoint CLOSED / PASS WITH LIMITATIONS; compute-host/VPS + Cloudflare deployment remains DEFERRED BY OPERATOR.**

The planned platform/production roadmap remains complete:

- Batch 1–12: **CLOSED**
- remaining planned batch inside that roadmap: **0**
- Fase 0–4: **CLOSED baseline**
- Fase 5 AutoClick: **DEFERRED BY DESIGN**
- Fase 6+: **OPEN-ENDED / evidence-driven**
- there is **no implicit Batch 13**

### Key post-closure merges

- implementation PR #29: `ad67b68290a41e69e18dfa49caefed0090bd9635`
- closure PR #30: `783a4ae8a2c90b3c696b3d619fb0c03581f675b2`
- documentation synchronization PR #31: `aa360b81a6ef5cd41f466d7ada239b4e461c60ee`
- Production Activation tooling + local runtime fixes PR #32: `a6cc17530b4e4540d710fa449c93844a8dad7981`
- sourced-env proxy-test isolation PR #33: `eac26497aa868e448c5fa4e48c3331abf585d5cf`
- secret-scan Git-boundary correction PR #34: `a95e5e20bb30d4828288f6bba230860bc65e631f`
- local rehearsal docs closure PR #35: `7b1d50630e21a14413f73e2ca4a0934de042dcdf`
- browser/Historical-Ledger session identity fix PR #36: `8b93b346a11cc4293af2b8e75e2ec6af48348e60`
- Historical Ledger + ECX local evidence closure PR #37: `88d588bbe4a5f005652c20f3409dd72093439f56`
- Comparative ECX harness PR #38: `c1849cd0c67712e40ea4e5c90587283900859cdb`
- comparative harness docs closure PR #39: `5437c1ea5d8ee168dbbe09de688a23c39089c7aa`
- comparative cache-isolation fix PR #40: `197627dc04689dea94bf7957e18b2699f8fb9213`
- release fixture delimiter correction PR #41: `4d5ee560a3b6cef024b0d7ed7bbec53a17f32675`

### PR #41 verification

- exact-head CI `34565244451`: PASS all repository gates;
- merge: `4d5ee560a3b6cef024b0d7ed7bbec53a17f32675`;
- post-merge `main` CI `34565539119`: PASS all repository gates;
- laptop tracked tree synchronized to the merge revision before corrected runtime verification.

## 2. Progress snapshot

| Area | Current state | Meaning |
|---|---:|---|
| Defined platform/production implementation roadmap | **12/12 = 100% CLOSED** | Planned repository implementation scope is finished and verified on `main`. |
| Production/self-host repository baseline | **READY** | Compose/Caddy/release/security baseline passed repository evidence. |
| Real laptop production rehearsal | **PASS / LOCAL BOUNDARY CLOSED** | Phase 4, Temporal worker, Connect→Ollama→Gemma, direct Ai API, browser Local chat, sourced-env verification and Git synchronization were exercised on the real laptop. |
| Historical Ledger + ECX local traffic/integrity evidence | **PASS / LOCAL CHECKPOINT CLOSED** | Real Local Gemma browser session, hash-chained Ledger, pointer-first ECX handoff/hydration, and `production:data-evidence` were verified. |
| Comparative ECX harness implementation | **PASS / IMPLEMENTATION CLOSED** | Three-lane local benchmark harness, deterministic scoring/gates, regression coverage and docs were merged and repository-verified. |
| Comparative cache isolation | **PASS / RUNTIME VERIFIED** | PR #40 introduced per-invocation cache namespaces; corrected runtime measurements are uncached. |
| First Comparative ECX 5× run | **FAIL / VALID FINDING** | 4/5 task gates passed; `release-readiness` exposed an exact-string source-delimiter ambiguity. Historical finding preserved. |
| Release fixture correction | **PASS / VERIFIED** | PR #41 removed only ambiguous release source delimiters; targeted real Gemma rerun passed. |
| Final corrected Comparative ECX run | **PASS WITH LIMITATIONS / LOCAL CHECKPOINT CLOSED** | 5/5 task gates passed over 75 uncached calls. Aggregate median transport reduction 73.6379%, median input-token reduction 77.8581%, median selective/full latency ratio 0.8673. One individual selective retention repeat had an exact-string punctuation mismatch, so this is not a claim of 75/75 perfect per-call quality. |
| Automatic reference selection / general optimizer claim | **NOT PROVEN** | Current ECX hydration receives caller-selected `refIndexes`; the oracle lane measures selective-hydration potential, not an autonomous selector. |
| Real compute-host/VPS production deployment | **DEFERRED BY OPERATOR** | Tooling is ready; no target-host mutation until explicit resume. |
| Cloudflare Free named Tunnel cutover | **DEFERRED WITH COMPUTE-HOST DEPLOYMENT** | Documented future edge option only. |
| Hosted-provider comparative validation | **OPTIONAL / FUTURE** | Requires operator credentials and explicit spend intent. |
| Fase 6+ hardening | **OPEN-ENDED** | Future work is evidence-driven and never considered permanently complete. |

Do not collapse these rows into one percentage. **100% refers only to the defined Batch 1–12 implementation roadmap.**

## 3. Closed local evidence before comparative measurement

Sanitized runtime evidence:

- `docs/verification/local-production-rehearsal-2026-09-10.md`
- `docs/verification/historical-ledger-ecx-local-evidence-2026-09-11.md`

Closed local checkpoints include:

- real Phase 4 process stack + Temporal/PostgreSQL with the Flow worker `RUNNING`;
- WSL→Windows Ollama loopback path;
- real Connect→Ollama→Gemma local calls;
- direct Ai API + real browser Local chat;
- browser-visible session identity equal to the actual `LOCAL_ONLY` Historical Ledger session after PR #36;
- real Ledger chronology `user.message → model.called → agent.message → agent.handoff` with intact hash chain;
- real pointer-first ECX plan and local-only hydration;
- `pnpm production:data-evidence` PASS.

Those checkpoints prove traffic/integrity/provenance. They do **not** by themselves prove savings.

## 4. Comparative ECX final local evidence

Canonical protocol:

- `docs/comparative-ecx-evidence.md`

Evidence history:

- `docs/verification/comparative-harness-implementation-2026-09-11.md`
- `docs/verification/comparative-smoke-cache-defect-2026-09-11.md`
- `docs/verification/comparative-closure-grade-first-run-2026-09-11.md`
- `docs/verification/comparative-closure-grade-final-2026-09-11.md`

### Lanes

- `full-inline` — all fixture context sent directly to the same local model;
- `ecx-all` — real Artifact pointers + ECX plan + all refs hydrated;
- `ecx-selective-oracle` — same packet with only fixture-declared relevant refs hydrated.

The `oracle` suffix is mandatory. Current `/v1/exchange/hydrate` receives `refIndexes` from the caller; ECORIONE has **not** proven automatic semantic reference selection.

### Final corrected closure-grade run

Runtime revision:

`4d5ee560a3b6cef024b0d7ed7bbec53a17f32675`

Run shape:

- 5 tasks;
- 5 repeats;
- 3 lanes;
- 75 measured calls;
- measured cache hits: `0`;
- 5/5 task gates PASS.

Raw local evidence receipt:

```text
.ecorione/evidence/comparative-local-2026-09-11-v2.json
bytes: 94654
sha256: 189795c71dc72acfd3d1533490a002d87e68421682868eb2b8b830c6fbdab439
```

Aggregate task-level result:

- median selective transport reduction: `73.6379379246037%`;
- median selective input-token reduction: `77.8580814717477%`;
- median selective/full latency ratio: `0.8672873729681319`.

Every task had zero median input-token delta between `full-inline` and `ecx-all`, which is the expected control behavior.

### Limitation that must stay attached to the result

A post-run audit found one individual exact-string mismatch among the 75 measured completions:

- task: `retention-policy`;
- lane: `ecx-selective-oracle`;
- repeat: `2/5`;
- quality: `1/3` because the model returned two string values with sentence-final periods.

The other four selective repeats and all baseline/control repeats for that task scored `3/3`, so the predeclared **median** quality gate remained `1.0` and the task formally passed.

Therefore the checkpoint is **PASS WITH LIMITATIONS**, not a claim that all 75 individual completions had perfect exact-string quality.

The aggregate reduction percentages may be cited only as results of this specific local synthetic benchmark and only with the oracle-selector and per-run-quality limitations attached.

## 5. What CLOSED does and does not mean

The Comparative ECX local checkpoint is now closed under its declared task-level gates. That does **not** mean:

- security work ends forever;
- an autonomous reference selector exists;
- a general optimizer quality claim is proven;
- hosted-provider quality/latency/cost is proven;
- local provider-token USD 0 implies hosted savings;
- VPS persistence/restart/backup is proven;
- Cloudflare named-Tunnel behavior is proven on a real account/host;
- a public/general “73%/77% savings” claim is justified;
- one ECX recipient selection means a second agent/model executed;
- AutoClick should be built automatically.

## 6. Baseline already present

The current baseline includes:

- Ai chat with explicit Local/Hosted routing, `/space`, `/ops`, `/settings`;
- Hub orchestration, policy, approval, audit, Historical Ledger, ECX, capability/permission authority;
- Connect provider gateway, local OpenAI-compatible runtime, Anthropic/OpenRouter/OpenAI boundaries, Vault, spend budget, inbound/outbound MCP, runtime settings;
- Context L0–L2 memory plus L3 metadata binding;
- Sync self-host relay and MCP HTTPS bridge;
- Artifact content-addressed storage;
- Sandbox Tier 0, WASM and hardened Docker boundary;
- Space notes/block runtime;
- Flow durable orchestration using Temporal;
- RnD traces/evaluation foundation and dataset governance;
- multimodal/realtime voice baseline;
- data rebuild/governance/DR tooling;
- production observability, provider canaries, Compose, release/upgrade/rollback tooling;
- full-history + Git-boundary secret scanning and release security acceptance;
- real public HTTPS MCP acceptance;
- merged Comparative ECX harness using owner APIs.

## 7. Next execution order

Future work is a **new explicit scope**, not Batch 13.

Current operator-approved local-first order:

1. **Local persistence/restart drill — ACTIVE NEXT CHECKPOINT**
   - exercise ECORIONE/Temporal/PostgreSQL boundaries in a controlled restart sequence;
   - verify Historical Ledger, Context, Artifact and durable Flow state survive according to their owner contracts;
   - record intentionally ephemeral state explicitly;
   - do not prune/stop unrelated global Docker workloads.

2. **Local backup/restore drill**
   - generate owner-scoped backups with existing tooling;
   - restore into an isolated target rather than overwriting active state;
   - verify receipts/integrity and service health after restore.

3. **Local observability baseline**
   - capture `/ops` and model/ECX/Flow metrics during representative local workloads;
   - establish latency/error/resource baselines only where sample size supports them.

4. **UX/product validation**
   - exercise Local/Hosted routing surfaces, history/session behavior, settings, approval/error states and recovery paths;
   - create improvements only from observed friction.

5. **Immutable local model identity hardening**
   - replace mutable rehearsal alias usage with an operator-controlled immutable local identity before treating model identity as durable production evidence;
   - revalidate cache/telemetry identity after the change.

6. **Compute-host/VPS + Cloudflare deployment — DEFERRED**
   - resume only when the operator explicitly chooses to deploy;
   - then follow `docs/production-activation.md` and `docs/cloudflare-free-deployment.md`.

7. **Hosted-provider comparative validation — optional/future**
   - only with operator-owned credentials through Connect Vault and explicit spend limits;
   - measure actual billed cost where available.

8. **Automatic selector / optimizer work — evidence-driven only**
   - do not build automatically from the oracle result;
   - if proposed, evaluate against oracle + full-inline on held-out workloads and measure false omission/quality regression.

## 8. AI-agent reading order

An agent starting without chat history should read:

1. `docs/current-state-and-next-steps.md`
2. `AGENTS.md`
3. `docs/verification/comparative-closure-grade-final-2026-09-11.md`
4. `docs/comparative-ecx-evidence.md`
5. `docs/verification/comparative-closure-grade-first-run-2026-09-11.md`
6. `docs/verification/comparative-smoke-cache-defect-2026-09-11.md`
7. `docs/verification/comparative-harness-implementation-2026-09-11.md`
8. `docs/verification/historical-ledger-ecx-local-evidence-2026-09-11.md`
9. `docs/verification/local-production-rehearsal-2026-09-10.md`
10. `docs/EXECUTION-PROGRESS.md`
11. operations/ADR docs relevant to the next scope
12. `docs/prd.md`, `docs/research.md`, and `docs/blueprint.md` for rationale/historical planning

## 9. Rules for the next agent

Before implementing new work:

- start from current synchronized `main`;
- state the new scope explicitly; do not call it Batch 13 by default;
- preserve owner-service boundaries and current invariants;
- do not rewrite Historical Ledger or Context L0 ground truth;
- keep provider/credential authority in Connect and policy/approval authority in Hub;
- preserve external MCP as a real public-network acceptance when that gate is relevant;
- do not weaken release/evidence gates to manufacture PASS;
- benchmark cache namespaces must remain isolated across separate invocations;
- exact-match fixtures should use unambiguous value delimiters;
- do not represent fixture-declared `refIndexes` as an autonomous optimizer;
- do not convert the final synthetic benchmark percentages into universal/public savings claims;
- create/update ADRs only when architecture/ownership/authority/invariants change;
- update this file, `AGENTS.md`, `docs/EXECUTION-PROGRESS.md`, and relevant workstream/verification docs when current state materially changes;
- keep historical verification files historical rather than rewriting them to erase findings.

## 10. Canonical status references

- current handoff: `docs/current-state-and-next-steps.md`
- final Comparative ECX local evidence: `docs/verification/comparative-closure-grade-final-2026-09-11.md`
- Comparative ECX protocol + claim boundary: `docs/comparative-ecx-evidence.md`
- first full-run finding: `docs/verification/comparative-closure-grade-first-run-2026-09-11.md`
- first smoke cache finding: `docs/verification/comparative-smoke-cache-defect-2026-09-11.md`
- comparative harness implementation closure: `docs/verification/comparative-harness-implementation-2026-09-11.md`
- local Ledger + ECX evidence: `docs/verification/historical-ledger-ecx-local-evidence-2026-09-11.md`
- local runtime evidence: `docs/verification/local-production-rehearsal-2026-09-10.md`
- detailed progress: `docs/EXECUTION-PROGRESS.md`
- open-ended hardening: `docs/fase6-hardening.md`
- deferred production continuation: `docs/production-activation.md`
- future Cloudflare option: `docs/cloudflare-free-deployment.md`
- archived Batch 1–12 execution history: `docs/archive/execution-progress-through-batch12-2026-09-10.md`
