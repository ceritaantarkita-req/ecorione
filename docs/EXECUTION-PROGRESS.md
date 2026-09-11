# ECORIONE — Execution Progress & Remaining Roadmap

Last updated: **2026-09-11**

Status: **ACTIVE — canonical execution tracker**

Dokumen ini adalah source of truth untuk **current execution status** setelah planned Batch 1–12 selesai. Detail kronologis Batch 1–12 dipertahankan di:

- `docs/archive/execution-progress-through-batch12-2026-09-10.md`

Jangan memakai archive tersebut sebagai current-state source. Mulai dari `docs/current-state-and-next-steps.md`, lalu file ini.

> **Maintenance rule:** setiap workstream yang mengubah current implementation/evidence status wajib meng-update file ini sebelum closure-ready. `CLOSED` hanya boleh dipakai setelah evidence sesuai boundary workstream tersedia, exact-head gate relevan hijau, merge benar, dan post-merge verification selesai.

---

## 1. Status legend

| Status | Arti |
|---|---|
| `CLOSED` | Scope selesai dan seluruh closure evidence relevan sudah terpenuhi |
| `IMPLEMENTED / CLOSURE PENDING` | Implementasi ada, tetapi runtime/exact-head/merge/post-merge evidence belum lengkap |
| `IN PROGRESS` | Scope aktif sedang dikerjakan |
| `PLANNED` | Sudah disepakati tetapi belum diimplementasikan |
| `DEFERRED` | Sengaja tidak dikerjakan sampai operator/prasyarat/use case mengaktifkannya kembali |
| `OPEN-ENDED` | Area hardening/evidence yang tidak pernah dianggap selesai permanen |

---

## 2. Closed planned roadmap

Planned platform/production roadmap tetap:

- Batch 1–12: **12/12 CLOSED**
- remaining planned batch di roadmap tersebut: **0**
- Fase 5 AutoClick: **DEFERRED BY DESIGN**
- Fase 6+: **OPEN-ENDED / evidence-driven**
- **tidak ada Batch 13 implisit**

`100%` hanya merujuk ke defined Batch 1–12 roadmap. Itu bukan persentase operational maturity sebuah live production system.

Historical detailed tracker: `docs/archive/execution-progress-through-batch12-2026-09-10.md`.

---

## 3. Current verified repository baseline

Key post-closure progression:

- Batch 12 implementation PR #29: `ad67b68290a41e69e18dfa49caefed0090bd9635`
- closure PR #30: `783a4ae8a2c90b3c696b3d619fb0c03581f675b2`
- docs/Cloudflare reconciliation PR #31: `aa360b81a6ef5cd41f466d7ada239b4e461c60ee`
- Production Activation tooling + local runtime fixes PR #32: `a6cc17530b4e4540d710fa449c93844a8dad7981`
- sourced-env proxy test isolation PR #33: `eac26497aa868e448c5fa4e48c3331abf585d5cf`
- secret-scan Git-boundary correction PR #34: `a95e5e20bb30d4828288f6bba230860bc65e631f`
- local-rehearsal docs closure PR #35: `7b1d50630e21a14413f73e2ca4a0934de042dcdf`
- browser/Historical-Ledger session identity fix PR #36: `8b93b346a11cc4293af2b8e75e2ec6af48348e60`
- Historical Ledger + ECX local evidence closure PR #37: `88d588bbe4a5f005652c20f3409dd72093439f56`
- comparative ECX harness PR #38: `c1849cd0c67712e40ea4e5c90587283900859cdb`

PR #38 repository closure evidence:

- final PR head: `d3f1cbf4d0acbb2c92f340b952f2c42e6c9bef4a`
- exact-head CI `34557147546`: **PASS**
  - Naming
  - Format
  - Lint
  - Typecheck
  - Test
  - Phase 4 real-process acceptance
  - Production Operations acceptance
  - Secret Scan
  - Production Build
- exact-head MCP External HTTPS Acceptance `34557147583`: **PASS**
- expected-head squash merge: `c1849cd0c67712e40ea4e5c90587283900859cdb`
- post-merge `main` CI `34557297702`: **PASS** all repository gates
- post-merge MCP External HTTPS Acceptance `34557297803`: **PASS**

Implementation verification: `docs/verification/comparative-harness-implementation-2026-09-11.md`.

Closed local evidence before the comparative benchmark includes:

- real Phase 4 process stack + Temporal worker RUNNING;
- WSL→Windows Ollama loopback path;
- real Connect→Ollama→Gemma local calls;
- real browser Local chat;
- browser session identity equal to actual `LOCAL_ONLY` Historical Ledger session after PR #36;
- real Ledger chronology/hash chain;
- real ECX pointer-first plan + `agent.handoff` + history hydration;
- `pnpm production:data-evidence` PASS.

Verification sources:

- `docs/verification/local-production-rehearsal-2026-09-10.md`
- `docs/verification/historical-ledger-ecx-local-evidence-2026-09-11.md`

These prove local traffic/integrity/provenance. They do **not** prove ECX/optimizer savings.

---

## 4. Active workstream — Comparative ECX efficiency evidence

Status: **IN PROGRESS — HARNESS IMPLEMENTATION CLOSED / REAL GEMMA EVIDENCE PENDING**

Harness implementation is merged and repository-verified. There is no active harness implementation branch anymore. The next boundary is real runtime evidence on the operator laptop after synchronizing to the merged tree.

Protocol: `docs/comparative-ecx-evidence.md`.

### 4.1 Experiment lanes

1. `full-inline`
   - all fixture documents are assembled directly into model context;
   - baseline for bytes/tokens/latency/quality.

2. `ecx-all`
   - fixture documents become LOCAL_ONLY Artifact pointers;
   - Hub creates one real ECX packet;
   - all packet refs are hydrated through Hub;
   - same semantic document set reaches the model as `full-inline`;
   - control lane so ECX transport is not confused with selective-context benefit.

3. `ecx-selective-oracle`
   - same ECX packet;
   - only fixture-declared relevant reference indexes are hydrated;
   - measures potential/upper bound of correct selective hydration.

**Critical boundary:** current `/v1/exchange/hydrate` receives `refIndexes` from the caller. ECORIONE does not yet have a verified autonomous semantic reference selector. The `oracle` suffix must remain until a real selector exists and has separate evidence.

### 4.2 Implemented and verified harness scope

Merged through PR #38:

- `scripts/comparative-evidence.mjs`
  - five synthetic fixed-answer workloads;
  - real Artifact upload through owner API;
  - real Hub ECX plan/hydrate calls;
  - real Connect `target=local` completion calls;
  - warm-up excluded from measurement;
  - unique same-shape measured cache-buster;
  - deterministic exact-field quality scoring;
  - median aggregation;
  - predeclared task gates;
  - optional local JSON evidence output with mode `0600`;
  - explicit claim boundary in output.
- `test/comparative-evidence.test.mjs`
  - median/scoring/context assembly regression;
  - positive gate regression;
  - cache contamination and quality-loss failure regression.
- root commands:
  - `pnpm evidence:comparative:smoke`
  - `pnpm evidence:comparative`
- `docs/comparative-ecx-evidence.md`
  - experiment design, gates, commands, interpretation, and claim boundaries.

Two implementation findings were fixed before closure rather than waived:

- Prettier differences in the new harness/test;
- `performance` was explicitly imported from `node:perf_hooks` for the Node/ESLint environment.

Temporary formatter/lint-fixer workflows are absent from the final PR diff and merged tree.

### 4.3 Five synthetic workloads

- incident triage;
- procurement award;
- release readiness;
- retention policy;
- customer escalation.

Each fixture contains authoritative relevant documents plus larger irrelevant/noise documents. Required JSON facts are fixed before the real model run, so quality can be scored without a second AI judge.

### 4.4 Predeclared pass gates

A task passes only when:

1. ECX selects the exact-capability benchmark reviewer;
2. no measured lane has `cacheHit=true`;
3. model + response-model identity stays constant across paired lanes;
4. median deterministic quality is 100% in every lane;
5. `ecx-all` median input tokens remain within 5% of `full-inline` (minimum tolerance 2 tokens);
6. selective hydration bytes are lower than all-ref hydration bytes;
7. `packetBytes + selectiveHydratedBytes` is lower than full-inline context bytes;
8. selective median input tokens are lower than full-inline;
9. selective median latency does not exceed full-inline by more than default ratio `1.35`.

Do not weaken a gate after seeing a result merely to obtain PASS.

### 4.5 Measurements

Per measured run:

- lane/task/repeat identity;
- provider/model/response-model/pricing-model;
- cache state;
- model context bytes;
- input/output/cache tokens;
- end-to-end harness latency;
- Connect `actualUsd`, `naiveUsd`, optimizer overhead;
- deterministic quality score.

Per ECX task:

- packet bytes;
- all-ref hydration bytes;
- selective hydration bytes;
- selected recipient;
- Artifact IDs.

Local provider-token `actualUsd=0` remains valid local accounting, **not hosted cost-savings evidence**.

### 4.6 Runtime commands / next gates

After this docs closure is merged and laptop synchronization is verified:

```bash
set -a
source .env
set +a
pnpm evidence:comparative:smoke
```

Do not run the closure-grade benchmark until smoke is inspected. If smoke is healthy:

```bash
pnpm evidence:comparative -- --repeats 5 \
  --output .ecorione/evidence/comparative-local-2026-09-11.json
```

Raw evidence stays local/gitignored. Only a sanitized verified summary should be committed later.

### 4.7 Remaining closure blockers

The **comparative evidence workstream itself is not CLOSED** yet. Repository/harness implementation is closed, but these evidence gates remain:

- merge and post-merge verification of this docs-only harness-closure update;
- laptop tracked-tree sync to the latest merged `main`;
- real local Gemma smoke;
- investigation/fix of any smoke-discovered defect;
- closure-grade 5× paired run;
- sanitized comparative measured-result verification note;
- current-state/progress docs updated with the actual measured verdict.

A negative benchmark result is valid evidence and must not be rewritten into a positive claim.

---

## 5. Current operator-approved execution order

Current order is deliberately local-first:

1. **Comparative ECX real Gemma efficiency evidence — ACTIVE**
2. **Local persistence/restart drill — PENDING AFTER COMPARATIVE**
3. **Local backup/restore drill — PENDING**
4. **Local observability baseline — PENDING**
5. **UX/product validation — PENDING**
6. **Immutable local model identity hardening — PENDING**
7. **Compute-host/VPS + Cloudflare production activation — DEFERRED BY OPERATOR**
8. **Hosted-provider comparative validation — OPTIONAL/FUTURE; credentials + spend intent required**
9. **Maintenance/security/dependency/DR evidence — OPEN-ENDED**
10. **New features — evidence-driven only**

Production deployment is not a blocker for current local R&D. It resumes only on an explicit operator decision.

---

## 6. Production activation status

Status: **DEFERRED BY OPERATOR DECISION / TOOLING READY**

No VPS, Cloudflare named Tunnel, domain cutover, origin-firewall mutation, or hosted-provider spending should be initiated from the current workstream.

When explicitly resumed, use:

- `docs/production-activation.md`
- `docs/production-operations.md`
- `docs/cloudflare-free-deployment.md`
- `docs/release-operations.md`

Cloudflare, if used, stays an external DNS/TLS/tunnel edge. It never becomes owner of Hub policy, Connect credentials, databases, Temporal, Artifact or Sandbox.

---

## 7. Persistent architecture/evidence rules

- Historical Ledger and Context L0 remain semantic ground truth; no convenience rewrite.
- No cross-service database access.
- Hub remains policy/approval authority.
- Connect remains provider/credential/MCP owner.
- Artifact owns L3 bytes; comparative fixtures use Artifact API rather than filesystem/DB bypass.
- Exact cache must not contaminate paired model-compute comparisons.
- Memory is untrusted data, never instructions.
- Hosted-derived memory follows quarantine/governed promotion.
- Model identity must be pinned for durable production claims. `gemma4:latest` is accepted only as current local rehearsal evidence until immutable local identity hardening.
- ECX packet/hydration count alone is not a savings metric.
- `ecx-selective-oracle` is not automatic selector evidence.
- Local USD 0 provider-token cost is not hosted-provider billed-cost evidence.
- No public savings claim without representative comparable telemetry.
- External MCP public-network acceptance must remain genuinely public-network when that gate is relevant.
- Do not weaken CI/security/evidence gates to manufacture closure.
- AutoClick remains deferred until a concrete non-API use case passes architecture review.

---

## 8. Definition of Done for post-closure workstreams

A post-closure workstream may be marked `CLOSED` only after all applicable items are satisfied:

1. dedicated branch/scope;
2. baseline SHA and architecture boundary explicit;
3. relevant implementation complete;
4. deterministic regression tests exist;
5. real runtime/E2E evidence exists when the claim crosses a runtime boundary;
6. Format PASS;
7. Lint PASS;
8. Typecheck PASS;
9. Test PASS;
10. Secret Scan PASS;
11. Production Build PASS where relevant;
12. architecture/naming/production acceptance gates PASS where relevant;
13. docs/current tracker updated;
14. no temporary helper artifacts remain;
15. exact final branch head verified;
16. PR merge uses expected-head guard when available;
17. `main` points to intended merge;
18. post-merge `main` verification passes;
19. machine/local evidence is rerun on the synchronized merged tree when the claim requires it;
20. claim boundaries are stated explicitly and do not exceed measured evidence.

For comparative/model evidence specifically, also require:

- lane definitions and acceptance thresholds fixed before closure run;
- cache contamination detection;
- equivalent fact/task/model controls;
- quality measurement rather than token-only optimization;
- raw evidence kept local/gitignored;
- sanitized verification note committed after measurement;
- automatic selector, transport, token, latency, and actual-cost claims separated.

---

## 9. Progress update protocol

Every active workstream update should record:

1. current `main` baseline;
2. active branch if any;
3. exact implementation status;
4. bugs/findings discovered;
5. focused verification evidence;
6. exact-head CI/run IDs;
7. PR + merge SHA;
8. post-merge evidence;
9. real runtime evidence where required;
10. remaining blockers and next checkpoint.

Architecture changes require ADR/decision updates. Measurement harnesses that only use existing owner APIs do not automatically constitute an architecture change.

---

## 10. Next action

**Immediate next:** finish this docs-only comparative-harness implementation closure, verify/merge it, synchronize the laptop to the resulting `main`, restart/use Phase 4 from that synchronized tree, then run `pnpm evidence:comparative:smoke`. Do not run the 5× paired closure benchmark until the smoke result is inspected and any real defect is fixed.

Canonical protocol: `docs/comparative-ecx-evidence.md`.
