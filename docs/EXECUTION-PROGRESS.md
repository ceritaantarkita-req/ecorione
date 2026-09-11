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
- comparative harness docs closure PR #39: `5437c1ea5d8ee168dbbe09de688a23c39089c7aa`
- comparative cache-isolation fix PR #40: `197627dc04689dea94bf7957e18b2699f8fb9213`

PR #38 repository closure evidence:

- final PR head: `d3f1cbf4d0acbb2c92f340b952f2c42e6c9bef4a`
- exact-head CI `34557147546`: **PASS**
- exact-head MCP External HTTPS Acceptance `34557147583`: **PASS**
- merge: `c1849cd0c67712e40ea4e5c90587283900859cdb`
- post-merge `main` CI `34557297702`: **PASS**
- post-merge MCP External HTTPS Acceptance `34557297803`: **PASS**

PR #40 cache-isolation evidence:

- exact-head repository gates: **PASS**;
- merge: `197627dc04689dea94bf7957e18b2699f8fb9213`;
- post-merge CI `34561893817`: **PASS**;
- corrected real Gemma smoke: **PASS** with all measured lanes `cacheHit=false` and non-zero token telemetry.

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

Status: **IN PROGRESS — CACHE FIX VERIFIED / FIRST 5× RUN 4 OF 5 TASKS PASS / RELEASE FIXTURE CORRECTION IN REVIEW / FINAL VERDICT PENDING**

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

**Critical boundary:** current `/v1/exchange/hydrate` receives `refIndexes` from the caller. ECORIONE does not yet have a verified autonomous semantic reference selector. The `oracle` suffix remains mandatory.

### 4.2 Harness scope already implemented

Merged harness scope includes:

- five synthetic fixed-answer workloads;
- real Artifact upload through owner API;
- real Hub ECX plan/hydrate calls;
- real Connect `target=local` completion calls;
- warm-up excluded from measurement;
- measured cache contamination as hard failure;
- deterministic exact-field quality scoring;
- median aggregation;
- predeclared task gates;
- optional local JSON evidence output under gitignored `.ecorione/`;
- explicit claim boundary in output;
- per-invocation measured cache namespace isolation after PR #40.

Deterministic tests cover scoring/context helpers, positive gates, cache/quality failures, cache-marker isolation, and the release exact-value delimiter correction.

### 4.3 Predeclared pass gates

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

### 4.4 Runtime evidence progression

#### First real smoke — FAIL / valid cache finding

Synchronized laptop revision: `5437c1ea5d8ee168dbbe09de688a23c39089c7aa`.

Artifact, ECX plan/hydration, recipient selection, and deterministic returned quality worked, but all three measured completion lanes hit exact cache. The hard cache gate rejected the run. Finding preserved in:

- `docs/verification/comparative-smoke-cache-defect-2026-09-11.md`.

#### Corrected smoke after PR #40 — PASS

Synchronized laptop revision: `197627dc04689dea94bf7957e18b2699f8fb9213`.

Observed:

- all three measured lanes `cacheHit=false`;
- real non-zero token telemetry;
- same local model identity across lanes;
- deterministic quality 100%;
- `full-inline` and `ecx-all` control token counts aligned;
- oracle-selective bytes/tokens lower;
- task gate PASS.

#### First full closure-grade 5× run — FAIL / 4 of 5 tasks pass

Revision: `197627dc04689dea94bf7957e18b2699f8fb9213`.

Run shape:

- tasks: 5;
- repeats: 5;
- lanes: 3;
- measured model calls: 75.

Aggregate observed result:

- passed tasks: `4/5`;
- failed task: `release-readiness`;
- median selective transport reduction: `73.6379379246037%`;
- median selective input-token reduction: `77.70491803278688%`;
- median selective/full latency ratio: `0.8387964882197358`.

These percentages are **provisional observations from a failed closure run**.

`release-readiness` failed median deterministic quality in all three lanes (`full-inline`, `ecx-all`, and `ecx-selective-oracle`). The model returned sentence-final periods in two values that the expected exact answer intentionally excludes. The original source fixture placed periods immediately after those authoritative values, making the delimiter ambiguous for an exact-string benchmark. Because the baseline/control/selective lanes failed identically, this is not ECX-specific quality loss.

Finding preserved in:

- `docs/verification/comparative-closure-grade-first-run-2026-09-11.md`.

### 4.5 Active fixture correction

Branch:

`fix/comparative-release-fixture-ambiguity-20260911`

Correction rules:

- expected answer unchanged;
- exact-match scorer unchanged;
- quality gate unchanged;
- byte/token/latency gates unchanged;
- remove only the sentence-final periods directly adjacent to the two ambiguous authoritative values;
- add regression coverage that locks the delimiter-safe source representation;
- correct documented CLI argument forwarding; literal `--` must not be passed to the harness parser.

This is a benchmark-fixture design correction, not an ECX architecture change.

### 4.6 Correct commands

Targeted verification after the fixture fix is merged and synchronized:

```bash
pnpm evidence:comparative \
  --tasks release-readiness \
  --repeats 1
```

Closure-grade run after targeted verification passes:

```bash
pnpm evidence:comparative \
  --repeats 5 \
  --output .ecorione/evidence/comparative-local-2026-09-11.json
```

Do **not** use `pnpm evidence:comparative -- --repeats ...`; the literal `--` is forwarded to `scripts/comparative-evidence.mjs` and rejected as an unknown argument.

Raw evidence stays local/gitignored. Only sanitized verified summaries belong in Git.

### 4.7 Remaining closure blockers

The comparative evidence workstream is **not CLOSED** yet. Remaining gates:

- exact-head repository verification of `fix/comparative-release-fixture-ambiguity-20260911`;
- merge + post-merge verification;
- laptop synchronization to resulting `main`;
- targeted real Gemma `release-readiness` rerun;
- complete 5-task × 5-repeat closure rerun on corrected merged revision;
- sanitized final measured-result verification note;
- canonical docs updated with final `PASS`, `PASS WITH LIMITATIONS`, or `FAIL / NEEDS ITERATION` verdict.

A negative result remains valid evidence and must not be rewritten into a positive claim.

---

## 5. Current operator-approved execution order

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
- Benchmark cache isolation must hold across separate invocations while the same Connect process is alive.
- Exact-match benchmark source values must use unambiguous delimiters; do not normalize scoring after a failure to manufacture PASS.
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
- cache namespaces isolated across separate benchmark invocations;
- equivalent fact/task/model controls;
- exact source/answer delimiters unambiguous when deterministic exact-match scoring is used;
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

**Immediate next:** verify `fix/comparative-release-fixture-ambiguity-20260911` through normal repository gates. If exact-head verification is green, merge it, verify `main`, synchronize the laptop, then run a targeted uncached `release-readiness` check. Only after that task is healthy should the complete 5× closure run be repeated on the corrected merged revision.

Canonical protocol: `docs/comparative-ecx-evidence.md`.
