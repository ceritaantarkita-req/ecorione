# Fase 6+ — evidence-driven hardening baseline

**Status:** ACTIVE / OPEN-ENDED · reconciled through final local Comparative ECX closure on 2026-09-11

Fase 6+ bukan fase yang boleh diberi label CLOSED permanen. Yang sudah CLOSED adalah **planned platform/production roadmap Batch 1–12** dan beberapa checkpoint evidence lokal yang eksplisit. Dokumen ini mencatat hardening baseline yang sudah masuk `main` dan area evidence-driven yang masih bisa berkembang.

Current canonical handoff: `docs/current-state-and-next-steps.md`.

## Current closure state

- Batch 1–12: **CLOSED**
- production/self-host repository baseline: **READY** sesuai boundary yang didokumentasikan
- local laptop rehearsal: **PASS / LOCAL BOUNDARY CLOSED**
- local Historical Ledger + ECX traffic/integrity evidence: **PASS / LOCAL CHECKPOINT CLOSED**
- Historical Ledger + ECX evidence merge: `88d588bbe4a5f005652c20f3409dd72093439f56`
- Comparative ECX harness implementation: **PASS / CLOSED**
- comparative harness PR #38 merge: `c1849cd0c67712e40ea4e5c90587283900859cdb`
- comparative harness docs closure PR #39 merge: `5437c1ea5d8ee168dbbe09de688a23c39089c7aa`
- comparative cache-isolation fix PR #40 merge: `197627dc04689dea94bf7957e18b2699f8fb9213`
- comparative release fixture correction PR #41 merge: `4d5ee560a3b6cef024b0d7ed7bbec53a17f32675`
- PR #41 exact-head CI `34565244451`: **PASS**
- PR #41 post-merge CI `34565539119`: **PASS**
- first cached Gemma comparative smoke: **FAIL / VALID CACHE FINDING**
- corrected uncached smoke after PR #40: **PASS**
- first full 75-call run: **FAIL / VALID RELEASE FIXTURE FINDING**
- targeted corrected `release-readiness`: **PASS**
- final corrected full 75-call run: **5/5 TASK GATES PASS**
- final local Comparative ECX checkpoint: **CLOSED / PASS WITH LIMITATIONS**
- active next checkpoint: **LOCAL PERSISTENCE/RESTART EVIDENCE**
- compute-host/VPS + Cloudflare deployment: **DEFERRED BY OPERATOR DECISION**
- AutoClick: **DEFERRED BY DESIGN**
- no implicit Batch 13

Comparative references:

- `docs/comparative-ecx-evidence.md`
- `docs/verification/comparative-harness-implementation-2026-09-11.md`
- `docs/verification/comparative-smoke-cache-defect-2026-09-11.md`
- `docs/verification/comparative-closure-grade-first-run-2026-09-11.md`
- `docs/verification/comparative-closure-grade-final-2026-09-11.md`

## Hardening/platform baseline already present

### Cost + credential control

- emergency hosted-cost kill switch in Connect;
- production credential vault AES-256-GCM with master key out-of-band;
- durable daily/monthly hosted spend reservation/settlement;
- provider-aware actual/naive cost accounting;
- no silent provider fallback.

### Provider/runtime framework

- Anthropic, OpenRouter, OpenAI hosted boundaries;
- local OpenAI-compatible runtime abstraction;
- explicit provider/model mapping;
- model identity pinning contract;
- provider-scoped Vault credentials;
- provider-aware spend/cache telemetry.

`gemma4:latest` used in local rehearsal/benchmark is temporary runtime evidence. The mutable alias is not a durable production identity and remains a later local hardening checkpoint.

### MCP + extension + permission plane

- inbound MCP HTTP/stdio;
- public HTTPS MCP proof through Sync;
- provider-resilient external tunnel acceptance;
- outbound MCP manager with workspace-scoped registry/credential refs/tool policy;
- Plugin/Extension Framework with immutable source/digest provenance and no arbitrary host execution;
- Hub-owned unified capability/permission authority;
- side-effect reservation/uncertain semantics;
- policy/approval/audit remains Hub-owned.

### Multimodal + voice

- multimodal input pipeline baseline;
- realtime voice session/order plane;
- STT/TTS remains Connect/provider boundary;
- final transcript/reply stays in governed chat/memory path;
- raw live audio remains transient according to the documented boundary.

### Data rebuild / governance / DR

- owner-service rebuild/migration boundaries;
- Context L0 and Historical Ledger ground truth are not convenience-rewritten;
- dry-run/digest/receipt patterns;
- dataset governance through RnD;
- owner-scoped backup/restore procedures;
- Temporal/Flow persistence treated according to its owner/runtime boundary.

### Production operations / observability

- Docker Compose self-host baseline;
- Caddy-only public ports in repository baseline;
- pinned infrastructure images;
- owner-scoped persistent volumes;
- process metrics + W3C-compatible trace propagation;
- Ai `/ops` aggregation;
- provider canary mechanism;
- Production Operations acceptance in CI;
- install/upgrade/rollback scripts;
- release/security acceptance;
- working-tree + full-history secret scanning;
- dependency review and production build release gate;
- Ai `/settings` Control Center and Connect-owned runtime settings.

### Historical Ledger + ECX real local evidence

A real local browser session was verified in a `LOCAL_ONLY` hash chain, a real ECX plan appended `agent.handoff`, the referenced range was hydrated, and `pnpm production:data-evidence` passed.

This proves local traffic/integrity/provenance, not comparative savings by itself.

Verification: `docs/verification/historical-ledger-ecx-local-evidence-2026-09-11.md`.

### Comparative harness implementation

The comparative harness is merged and repository-verified. It uses existing Artifact, Hub ECX and Connect owner APIs rather than a database/filesystem shortcut.

Merged scope includes:

- `full-inline`, `ecx-all`, `ecx-selective-oracle` lanes;
- five fixed-answer synthetic workloads with relevant + noise docs;
- deterministic exact-field quality scoring;
- warm-up exclusion;
- hard failure on measured cache hits;
- median aggregation and predeclared quality/bytes/token/latency gates;
- optional mode-0600 raw JSON output under gitignored `.ecorione/`;
- deterministic helper/gate regression coverage;
- per-invocation cache namespace isolation after PR #40.

Verification: `docs/verification/comparative-harness-implementation-2026-09-11.md`.

## Closed Comparative ECX local evidence

Protocol/results: `docs/comparative-ecx-evidence.md`.

The benchmark uses:

- `full-inline` — full synthetic context;
- `ecx-all` — real ECX packet + all refs hydrated;
- `ecx-selective-oracle` — same packet + fixture-declared relevant refs only.

The oracle suffix remains mandatory because current ECX does **not** autonomously choose `refIndexes`.

### Evidence progression

#### First real smoke — valid FAIL / cache isolation

The first real Gemma smoke reached the real owner APIs but all measured completions were exact-cache hits. The gate correctly rejected it.

#### Corrected smoke after PR #40 — PASS

The corrected rerun was uncached with non-zero token telemetry, stable model identity, aligned baseline/control input tokens, 100% task quality, and lower selective bytes/tokens.

#### First full 75-call run — valid FAIL / release fixture ambiguity

The first 5× run passed 4/5 tasks. `release-readiness` failed exact quality in all three lanes because the source fixture placed sentence punctuation immediately after authoritative string values.

This was preserved as evidence rather than normalized away.

#### PR #41 targeted correction — PASS

PR #41 removed only the ambiguous release source delimiters, leaving answer key/scorer/gates unchanged. Targeted real Gemma `release-readiness` then passed in all three uncached lanes.

#### Final corrected 75-call run — PASS WITH LIMITATIONS

Runtime revision:

`4d5ee560a3b6cef024b0d7ed7bbec53a17f32675`

Run shape/result:

- 5 tasks;
- 5 repeats;
- 3 lanes;
- 75 measured calls;
- measured cache hits: `0`;
- 5/5 task gates PASS;
- median selective transport reduction: `73.6379379246037%`;
- median selective input-token reduction: `77.8580814717477%`;
- median selective/full latency ratio: `0.8672873729681319`.

Raw local receipt:

```text
.ecorione/evidence/comparative-local-2026-09-11-v2.json
bytes: 94654
sha256: 189795c71dc72acfd3d1533490a002d87e68421682868eb2b8b830c6fbdab439
```

Post-run audit limitation:

- one `retention-policy` `ecx-selective-oracle` repeat scored `1/3` exact fields because two returned strings retained sentence-final periods;
- the other four selective repeats and all baseline/control repeats for that task scored `3/3`;
- the predeclared gate uses the median over five repeats, so the task still formally passed.

Therefore the checkpoint is **CLOSED / PASS WITH LIMITATIONS**. It supports task-level median benchmark claims only. It does not support “75/75 perfect outputs”, automatic-selector claims, universal optimizer claims, hosted billed-cost savings, or public/general percentage-savings marketing.

Final verification: `docs/verification/comparative-closure-grade-final-2026-09-11.md`.

## Active next evidence scope — local persistence/restart

The next checkpoint is local persistence/restart evidence. It is a new explicit scope, not Batch 13.

Target evidence should include:

1. synchronized reviewed `main` baseline;
2. inventory of ECORIONE/Temporal/PostgreSQL runtime state;
3. baseline receipts/identifiers for Historical Ledger, Context, Artifact and durable Flow state;
4. controlled restart of relevant ECORIONE boundaries only;
5. no global Docker prune/stop affecting unrelated workloads;
6. post-restart health checks;
7. verification that owner data persists according to each owner contract;
8. Temporal/Flow recovery verification;
9. explicit documentation of intentionally ephemeral state;
10. sanitized verification note before closure.

## What remains open-ended after Batch 12

Current operator-approved order:

1. local persistence/restart drill;
2. isolated local backup/restore drill;
3. local observability baseline;
4. product/UX validation from real use;
5. immutable local model identity hardening;
6. resume compute-host/VPS + Cloudflare only when operator explicitly chooses;
7. validate hosted providers/cost only with operator credentials + explicit spend intent;
8. consider automatic reference selection only as a separate held-out-evaluation scope;
9. build representative evaluation datasets before broad optimizer claims;
10. improve UX/Control Center/approval/error surfaces based on observed friction;
11. integrate other ecosystem projects only through explicit APIs/contracts;
12. keep dependency/security/model/pricing reviews current;
13. add features only when evidence justifies them.

## Deployment direction — currently deferred

If the operator later resumes production activation, the future public-edge topology remains:

```text
Cloudflare Free DNS/TLS/WAF/DDoS
  -> Cloudflare Tunnel
  -> ECORIONE compute host
  -> Caddy
  -> Ai + Sync/MCP
  -> internal services
```

Cloudflare does **not** replace ECORIONE compute, Docker services, owner databases, Temporal, Vault, Artifact storage or Sandbox.

Detailed future procedure:

- `docs/production-activation.md`
- `docs/cloudflare-free-deployment.md`

Do not infer target-host readiness from laptop evidence. The production workstream is deferred, not completed.

## Evidence rule for future work

Future work may only become part of a new READY/VERIFIED claim when relevant evidence exists. At minimum:

- dedicated branch/scope;
- owner-service architecture preserved;
- focused deterministic tests/acceptance when code changes;
- format/lint/typecheck/test/secret scan/build gates where applicable;
- runtime/public-network acceptance when applicable;
- docs/ADR update when architecture or claim boundary changes;
- exact-head evidence;
- guarded merge;
- post-merge main verification;
- synchronized runtime rerun when the claim depends on machine/runtime behavior.

For comparative benchmarks specifically:

- define lanes/answer keys/gates before real runs;
- record cache state and reject cache-contaminated measurements;
- isolate cache markers across separate invocations;
- compare equivalent task/fact/model sets;
- use unambiguous exact-string source delimiters;
- do not normalize scoring after failures merely to recover PASS;
- distinguish task-level median quality from per-run quality;
- preserve raw evidence locally in gitignored storage;
- commit only sanitized verified summaries;
- distinguish ECX transport, selective hydration, automatic selection, routing/cache, and actual provider cost as separate claims.

Do not reopen Batch 12 merely because Fase 6+ continues. Create a new explicit scope instead.
