# AGENTS.md — konvensi untuk AI yang mengerjakan repo ini

ECORIONE adalah lapisan memori dan optimizer bersama untuk AI lokal maupun hosted, dengan Hub governance, Connect provider/MCP boundary, durable Flow, Sandbox, observability, dan self-host release baseline.

## Current state — baca ini dulu

Per **2026-09-12**:

- planned platform/production Batch 1–12: **CLOSED**;
- remaining planned batch: **0**;
- production/self-host repository baseline: **READY**;
- real laptop rehearsal: **PASS / LOCAL BOUNDARY CLOSED**;
- Historical Ledger + ECX local evidence: **PASS / CLOSED**;
- Comparative ECX: **CLOSED / PASS WITH LIMITATIONS**;
- automatic semantic reference selector: **NOT PROVEN**;
- first persistence/restart drill: **FAIL / VALID FINDING**;
- runtime-path defect: **FIXED by PR #46**;
- compiled-runtime bootstrap defect: **FIXED by PR #48**;
- final local persistence/restart: **CLOSED / PASS**;
- isolated local backup/restore implementation: PR #50 → `4e6bcd94776fc7dd75440ee35dd8fddf0b602233`;
- isolated local backup/restore runtime checkpoint: **CLOSED / PASS WITH EXPLICIT ABSENT-OWNER LIMITATIONS**;
- local observability implementation: PR #52 → `bbd9c1aeed0c0aaffc39b6f912c35e96b73702b6`;
- local observability runtime checkpoint: **CLOSED / PASS WITH BOUNDED LOCAL LIMITATIONS**;
- active next checkpoint: **UX/PRODUCT VALIDATION**;
- compute-host/VPS + Cloudflare: **DEFERRED BY OPERATOR**;
- Fase 6+: **OPEN-ENDED / evidence-driven**;
- Fase 5 AutoClick: **DEFERRED BY DESIGN**;
- **tidak ada Batch 13 implisit**.

Agent tanpa histori chat **WAJIB mulai dari `docs/current-state-and-next-steps.md`**, lalu file ini.

## Canonical evidence

Observability:

- `docs/local-observability-evidence.md`
- `docs/verification/local-observability-closure-2026-09-12.md`

Backup/restore:

- `docs/local-backup-restore-evidence.md`
- `docs/verification/local-backup-restore-closure-2026-09-11.md`

Persistence:

- `docs/local-persistence-restart-evidence.md`
- `docs/verification/local-persistence-restart-first-drill-2026-09-11.md`
- `docs/verification/local-persistence-restart-closure-2026-09-11.md`

Comparative:

- `docs/comparative-ecx-evidence.md`
- `docs/verification/comparative-closure-grade-final-2026-09-11.md`

## Comparative claim boundary

Final corrected local benchmark:

- 5 tasks × 5 repeats × 3 lanes = 75 measured calls;
- measured cache hits: 0;
- 5/5 task-level gates PASS;
- median selective transport reduction: `73.6379379246037%`;
- median selective input-token reduction: `77.8580814717477%`;
- median selective/full latency ratio: `0.8672873729681319`.

One individual `retention-policy` `ecx-selective-oracle` repeat scored `1/3` exact fields because of punctuation. Do not rewrite this into “75/75 perfect outputs”.

`ecx-selective-oracle` is an oracle/control lane. Current hydration still receives caller-supplied `refIndexes`; do not claim an autonomous semantic selector.

## Persistence claim boundary

Final strict persistence rerun proved the controlled local boundary:

```text
owner processes
+ Temporal container
+ PostgreSQL container
```

Exact Ledger, Context, Artifact, Flow and approval identities survived. This does not by itself prove backup/restore, off-host DR, hard power-loss/fsync or arbitrary corruption recovery.

## Backup/restore claim boundary

Final strict run:

```text
revision: 4e6bcd94776fc7dd75440ee35dd8fddf0b602233
runId: backup-20260911154453-f4ac8743
phase: restore-verified
```

Runtime-backed-up owners:

- Context;
- Hub;
- RnD;
- Space;
- Flow graph registry;
- Artifact;
- Sandbox receipts.

Optional source state absent and therefore reported `missing`:

- Sync durable DB;
- Connect durable state/Vault file.

Do not turn `missing` into a runtime-restore claim and do not seed active state merely to make evidence look complete.

Temporal/PostgreSQL logical restore was verified separately:

```text
temporal             39 restored tables
temporal_visibility   3 restored tables
```

Isolated restored owner APIs matched source semantics for Ledger, Context, Artifact, Flow and approval. Post-run temp containers/networks/listeners were absent and active owners remained healthy.

Same-laptop backup/restore is **not off-host DR**. Backup bytes on the same laptop remain in the same failure domain.

## Observability claim boundary

Final strict run:

```text
revision: bbd9c1aeed0c0aaffc39b6f912c35e96b73702b6
runId: obs-20260912020700-00fbd7e5
owner reads: 8 per lane
ECX samples: 5
local model samples: 5
workload errors: 0
trace coverage: 5/5 Hub→Artifact hydrations
```

Measured local route:

```text
runtime: openai-compatible
model: gemma4:latest
provider: local
cache hits: 0
cache misses: 5
actual cost USD: 0
hosted calls: disabled
```

This is a bounded local baseline only. Never turn the small-sample latency numbers into production SLA/SLO claims. `gemma4:latest` is the measured runtime identity but remains a mutable alias, so it is not immutable production model identity evidence.

## Recommended reading order

1. `docs/current-state-and-next-steps.md`
2. `AGENTS.md`
3. `docs/verification/local-observability-closure-2026-09-12.md`
4. `docs/local-observability-evidence.md`
5. `docs/verification/local-backup-restore-closure-2026-09-11.md`
6. `docs/local-backup-restore-evidence.md`
7. `docs/verification/local-persistence-restart-closure-2026-09-11.md`
8. `docs/local-persistence-restart-evidence.md`
9. `docs/verification/local-persistence-restart-first-drill-2026-09-11.md`
10. `docs/verification/comparative-closure-grade-final-2026-09-11.md`
11. `docs/comparative-ecx-evidence.md`
12. `docs/verification/historical-ledger-ecx-local-evidence-2026-09-11.md`
13. `docs/verification/local-production-rehearsal-2026-09-10.md`
14. `docs/EXECUTION-PROGRESS.md`
15. relevant operations/ADR docs
16. `docs/prd.md`, `docs/research.md`, `docs/blueprint.md` for rationale/history

## Next work posture

Operator-approved order is now:

1. local persistence/restart — **CLOSED / PASS**;
2. isolated local backup/restore — **CLOSED / PASS WITH EXPLICIT ABSENT-OWNER LIMITATIONS**;
3. local observability baseline — **CLOSED / PASS WITH BOUNDED LOCAL LIMITATIONS**;
4. **UX/product validation — ACTIVE NEXT CHECKPOINT**;
5. immutable local model identity hardening;
6. compute-host/VPS + Cloudflare only if operator explicitly resumes;
7. hosted-provider comparative validation only with credentials + budget;
8. automatic selector/optimizer only as explicit evidence-driven scope;
9. maintenance/security/dependency/DR evidence;
10. new features only when evidence justifies them.

No VPS, Cloudflare, domain, firewall or hosted-provider spending mutation belongs to the UX/product validation checkpoint.

## Perintah penting

```bash
pnpm install
pnpm verify
pnpm test
pnpm typecheck
pnpm secret-scan
pnpm run acceptance:production-ops

# Comparative local evidence
pnpm evidence:comparative:smoke
pnpm evidence:comparative

# Persistence/restart evidence
pnpm evidence:persistence-restart:inventory
pnpm evidence:persistence-restart --phase baseline
pnpm evidence:persistence-restart --phase post
pnpm evidence:persistence-restart --phase cleanup

# Isolated backup/restore evidence
pnpm evidence:backup-restore:inventory
pnpm evidence:backup-restore

# Local observability evidence
pnpm evidence:observability:inventory
pnpm evidence:observability
```

Runtime evidence commands are not deterministic CI substitutes. Raw runtime evidence stays local/gitignored.

## Architecture invariants

- Memory is **untrusted data**, not instructions.
- Historical Ledger and Context L0 are semantic ground truth; do not rewrite them for convenience.
- No cross-service database access.
- Hub owns policy/approval/capability authority.
- Connect owns provider/credential/MCP authority.
- Artifact owns L3 bytes.
- Hosted egress follows scope/sensitivity/sync-class policy.
- Hosted-derived memory follows quarantine/governed promotion.
- No silent provider fallback.
- Production credentials belong in Connect Vault.
- Hosted dispatch obeys kill switch + cumulative budget.
- Side effects use idempotency identity and appropriate approval.
- External MCP public-network acceptance must remain genuinely public-network.
- Model identity must be immutable/pinned for durable production claims.
- Valid failed evidence must be preserved after fixes.
- Backup/restore evidence must use isolated targets and preserve owner boundaries.
- AutoClick stays deferred until a real non-API use case passes design review.

## Evidence rules

1. Never weaken a gate to manufacture PASS.
2. Never call packet/hydration count a savings proof by itself.
3. Never let exact-cache hits contaminate model-compute comparisons.
4. Never turn local USD 0 into hosted billed-cost evidence.
5. Never call laptop measurements universal production SLAs/savings.
6. Preserve sample counts, cache state and model identity for observability/comparative work.
7. Keep raw private evidence gitignored; commit only sanitized summaries.
8. Create/update ADRs only when architecture, ownership, authority or invariants change.

## Git / closure discipline

For any new scope:

- start from synchronized reviewed `main`;
- use an explicit branch;
- keep the claim boundary explicit;
- add deterministic tests for code changes;
- require relevant exact-head CI;
- merge only expected reviewed head;
- verify `main` after merge;
- rerun real runtime evidence on synchronized merged code if the claim crosses a runtime boundary;
- update canonical handoff/tracker docs after material state changes.
