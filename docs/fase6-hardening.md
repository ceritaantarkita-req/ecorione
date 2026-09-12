# Fase 6+ — evidence-driven hardening baseline

**Status:** ACTIVE / OPEN-ENDED · reconciled through bounded local observability closure on 2026-09-12

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
- final local Comparative ECX checkpoint: **CLOSED / PASS WITH LIMITATIONS**
- first local persistence/restart drill: **FAIL / VALID PATH-CONTRACT FINDING**
- repo-root runtime-path fix PR #46 merge: `778e7eb19a0e2f528c64e68459d8ff6e6ecbe1ce`
- local runtime-dependency bootstrap fix PR #48 merge: `673af91642ea1b9440079e396675c69f53647951`
- final local persistence/restart rerun: **CLOSED / PASS**
- isolated local backup/restore implementation PR #50 merge: `4e6bcd94776fc7dd75440ee35dd8fddf0b602233`
- isolated local backup/restore runtime checkpoint: **CLOSED / PASS WITH EXPLICIT ABSENT-OWNER LIMITATIONS**
- local observability implementation PR #52 merge: `bbd9c1aeed0c0aaffc39b6f912c35e96b73702b6`
- local observability runtime checkpoint: **CLOSED / PASS WITH BOUNDED LOCAL LIMITATIONS**
- active next checkpoint: **UX/PRODUCT VALIDATION**
- compute-host/VPS + Cloudflare deployment: **DEFERRED BY OPERATOR DECISION**
- AutoClick: **DEFERRED BY DESIGN**
- no implicit Batch 13

Current evidence references:

- `docs/verification/local-observability-closure-2026-09-12.md`
- `docs/local-observability-evidence.md`
- `docs/verification/local-backup-restore-closure-2026-09-11.md`
- `docs/local-backup-restore-evidence.md`
- `docs/local-persistence-restart-evidence.md`
- `docs/verification/local-persistence-restart-first-drill-2026-09-11.md`
- `docs/verification/local-persistence-restart-closure-2026-09-11.md`
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

`gemma4:latest` used in local rehearsal/benchmark/observability is temporary runtime evidence. The mutable alias is not a durable production identity and remains a later local hardening checkpoint.

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
- Temporal/Flow persistence treated according to its owner/runtime boundary;
- isolated local restore evidence for owner state that existed at source;
- Temporal/PostgreSQL logical restore evidence into isolated temporary infrastructure.

### Production operations / observability

- Docker Compose self-host baseline;
- Caddy-only public ports in repository baseline;
- pinned infrastructure images;
- owner-scoped persistent volumes;
- process metrics + W3C-compatible trace propagation;
- Ai `/ops` aggregation;
- provider canary mechanism;
- bounded Node-process resource snapshots;
- strict local observability evidence harness;
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

Final corrected 75-call result on `4d5ee560a3b6cef024b0d7ed7bbec53a17f32675`:

- 5 tasks × 5 repeats × 3 lanes;
- 75 measured calls;
- measured cache hits: `0`;
- 5/5 task gates PASS;
- median selective transport reduction: `73.6379379246037%`;
- median selective input-token reduction: `77.8580814717477%`;
- median selective/full latency ratio: `0.8672873729681319`.

Post-run audit found one `retention-policy` `ecx-selective-oracle` repeat at `1/3` exact fields because two returned strings retained sentence-final periods. The other four selective repeats and all baseline/control repeats for that task scored `3/3`; the predeclared median gate still passed.

Therefore the checkpoint remains **CLOSED / PASS WITH LIMITATIONS**. It does not support “75/75 perfect outputs”, automatic-selector claims, universal optimizer claims, hosted billed-cost savings, or public/general percentage-savings marketing.

## Closed local persistence/restart evidence

Status: **CLOSED / PASS**.

The first strict runtime drill failed validly after restart because owner services reopened relative durable paths under package-local cwd. Temporal/PostgreSQL retained the same Flow execution, while Hub/Context/Artifact/approval reads hit the wrong filesystem locations.

PR #46 anchored configured relative runtime paths to the ECORIONE repository root while preserving absolute production paths. A second bounded bootstrap issue then appeared: local compiled shared-package `dist` could remain stale after `git pull`. PR #48 made local dev entrypoints build compiled runtime dependencies before starting services.

After both fixes:

- Hub/Context/Flow effective SQLite paths were verified under repository-root `data/`;
- the preserved first-drill Ledger, Context, Artifact, Flow and approval identities reappeared through owner APIs;
- the old Flow probe was cleaned up;
- a fresh strict baseline passed on `673af91642ea1b9440079e396675c69f53647951`;
- Phase 4 processes, exact Temporal container and exact PostgreSQL container were stopped/restarted with the existing named DB volume preserved;
- strict post passed with exact Ledger hashes, Context digest, Artifact digest, Flow ID and pending approval identity preserved;
- strict cleanup terminalized the dedicated second probe.

Final verification: `docs/verification/local-persistence-restart-closure-2026-09-11.md`.

Claim boundary: this proves the controlled **local owner storage + process + Temporal-container + PostgreSQL-container restart boundary**. It does not prove backup/restore, off-host DR, host loss, hard power-loss/fsync behavior, arbitrary corruption recovery, VPS durability or Cloudflare behavior.

## Closed isolated local backup/restore evidence

Status: **CLOSED / PASS WITH EXPLICIT ABSENT-OWNER LIMITATIONS**.

Implementation baseline:

```text
4e6bcd94776fc7dd75440ee35dd8fddf0b602233
```

Real run:

```text
runId: backup-20260911154453-f4ac8743
phase: restore-verified
```

Existing source state was backed up through owner-scoped adapters for Context, Hub, RnD, Space, Flow graph registry, Artifact and Sandbox. Optional Sync and Connect durable state was absent at source and remained reported as `missing`; the drill did not seed active state to manufacture coverage.

Temporal logical restore verified 39 `temporal` tables and 3 `temporal_visibility` tables in a dedicated isolated PostgreSQL/Temporal stack. Restored Ledger, Context, Artifact, Flow and approval semantics matched source through isolated owner APIs.

Same-laptop restore correctness is not off-host DR and does not prove disk-loss survival, hard power-loss/fsync, arbitrary corruption recovery, PITR or cross-owner transactional snapshot atomicity.

Final verification: `docs/verification/local-backup-restore-closure-2026-09-11.md`.

## Closed bounded local observability evidence

Status: **CLOSED / PASS WITH BOUNDED LOCAL LIMITATIONS**.

Implementation baseline:

```text
bbd9c1aeed0c0aaffc39b6f912c35e96b73702b6
```

Real run:

```text
runId: obs-20260912020700-00fbd7e5
owner reads: 8 per lane
ECX samples: 5
local model samples: 5
workload errors: 0
Hub→Artifact trace coverage: 5/5
```

Measured route used `openai-compatible` / `gemma4:latest`, provider `local`, 0 cache hits, 5 cache misses, hosted calls disabled and actual cost USD 0. Five ECX plans/hydrations and five local cache misses appeared in the corresponding metric deltas.

This closes only a small-sample laptop baseline. It does not create production SLA/SLO thresholds, prove peak host/GPU/model-server use, concurrency/load capacity, leak freedom, hosted-provider behavior, or immutable model identity.

Final verification: `docs/verification/local-observability-closure-2026-09-12.md`.

## Active next evidence scope — UX/product validation

The next checkpoint is UX/product validation against the already-closed local technical baseline. It is a new explicit scope, not Batch 13.

Target evidence should include:

1. synchronized reviewed `main` baseline;
2. inventory of actual Ai-facing user journeys and expected outcomes before test execution;
3. representative Local chat flows through the real Ai surface;
4. continuity/memory and visible state-transition checks without rewriting ground truth;
5. `/space`, `/ops`, and `/settings` navigation and safe critical-action checks;
6. Local/Hosted routing clarity while hosted calls remain disabled and the cost kill switch remains on;
7. approval/error/recovery behavior where safe existing flows permit it;
8. issue capture with severity and explicit distinction between functional, UX and already-known performance observations;
9. raw machine/user-specific screenshots/logs retained locally when appropriate;
10. sanitized closure evidence with exact-head/runtime/post-merge verification.

## What remains open-ended after Batch 12

Current operator-approved order:

1. local persistence/restart drill — **CLOSED / PASS**;
2. isolated local backup/restore drill — **CLOSED / PASS WITH EXPLICIT ABSENT-OWNER LIMITATIONS**;
3. local observability baseline — **CLOSED / PASS WITH BOUNDED LOCAL LIMITATIONS**;
4. product/UX validation from real use — **ACTIVE NEXT CHECKPOINT**;
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

For backup/restore specifically:

- record source snapshot identity and backup receipt/digest;
- do not overwrite active owner state during the evidence drill;
- restore only into an isolated target;
- preserve owner boundaries instead of opening another service's DB directly;
- distinguish same-host restore correctness from off-host disaster recovery.

For observability specifically:

- attach exact revision, sample counts, model/cache identity and route to every measured result;
- do not invent SLA/SLO thresholds from small local samples;
- distinguish endpoint-time process snapshots from sampled peaks or whole-host metrics;
- do not turn local USD 0 into hosted billed-cost evidence.

Do not reopen Batch 12 merely because Fase 6+ continues. Create a new explicit scope instead.
