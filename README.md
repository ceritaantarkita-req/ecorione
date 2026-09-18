# ecorione

**Satu memori bersama untuk AI lokal maupun hosted, plus governance, eksekusi, observability, dan optimizer biaya yang bisa diaudit.**

ECORIONE menjaga kesinambungan lintas provider/model sambil mempertahankan local-first boundary, approval, audit trail, durable execution, MCP, dan spend control yang eksplisit.

> **Current status — 2026-09-18:** production/self-host repository baseline **READY** · Batch 1–12 **CLOSED** · W03 **REAL-LAPTOP VERIFIED** · W09/W10 **WINDOWS RUNTIME VERIFIED** · W11 **WINDOWS INSTALLER VERIFIED** · W16 automatic selector **DONE — REPO SIDE** · W17 no-oracle local validation **CLOSED / PASS** · W18 hosted economics **CLOSED / PASS WITH DOCUMENTED DUPLICATE-EXECUTION INCIDENT** · W20 **CLOSED** · F6-E01 held-out selector eval dataset **CLOSED / REPO-SIDE PASS** · F6-E02 dependency-policy CI gate **CLOSED / REPO-SIDE PASS** · F6-E03 release-security acceptance CI gate **CLOSED / REPO-SIDE PASS** · F6-E04 immutable GitHub Actions pinning **CLOSED / REPO-SIDE PASS** · F6-E05 fixed runner OS labels **CLOSED / REPO-SIDE PASS** · F6-E06 immutable Node toolchain **CLOSED / REPO-SIDE PASS** · F6-E07 pinned Inno Setup toolchain **CLOSED / REPO-SIDE PASS** · F6-E08 container image digest pinning **ACTIVE** · compute-host/VPS + Cloudflare **DEFERRED BY OPERATOR** · AutoClick **DEFERRED BY DESIGN**.

Untuk manusia/agent baru: mulai dari [`docs/current-state-and-next-steps.md`](docs/current-state-and-next-steps.md), lalu [`docs/active-work-plan.md`](docs/active-work-plan.md), [`docs/EXECUTION-PROGRESS.md`](docs/EXECUTION-PROGRESS.md), dan [`AGENTS.md`](AGENTS.md). Audit bertanggal lama adalah historical snapshots, bukan current-state source.

## Current closure evidence

Current progression that matters:

- Historical Ledger + ECX local evidence: **CLOSED / PASS**;
- historical Comparative ECX oracle-control benchmark: **CLOSED / PASS WITH LIMITATIONS**;
- local persistence/restart: **CLOSED / PASS**;
- isolated local backup/restore: **CLOSED / PASS WITH EXPLICIT ABSENT-OWNER LIMITATIONS**;
- bounded local observability: **CLOSED / PASS WITH BOUNDED LOCAL LIMITATIONS**;
- W03 UX/product validation: **DONE — REAL-LAPTOP VERIFIED**;
- W09/W10 one-command startup + doctor: **DONE — WINDOWS RUNTIME VERIFIED**;
- W11 packaged installer lifecycle: **DONE — WINDOWS INSTALLER VERIFIED**;
- W16 automatic semantic selector: **DONE — REPO SIDE**;
- W17 no-oracle benchmark: **DONE — VERIFIED LOCAL MODEL PASS**, 100 measured calls;
- W18 Anthropic-only one-call hosted diagnostic: **PASS**;
- W18 formal dispatch/routing/cap guard: **MERGED / REPO-SIDE VERIFIED** (PR #135; CI #994 + Product Eval #233 PASS);
- W18 formal operator wrapper: **MERGED / REPO-SIDE VERIFIED** (PR #138; CI #1001 + Product Eval #240 + MCP External #461 PASS);
- W18 formal 20-call hosted economics: **CLOSED / PASS** — later run 20/20 measured calls, US$0.091716, `closureEligible=true`; earlier duplicate batch reconciled at US$0.091596; combined US$0.183312 < US$0.25; single-attempt guard merged through PR #142.

Canonical W18 docs:

- [`docs/verification/w18-hosted-economics-preflight-2026-09-17.md`](docs/verification/w18-hosted-economics-preflight-2026-09-17.md)
- [`docs/verification/w18-hosted-economics-attempt-1-2026-09-17.md`](docs/verification/w18-hosted-economics-attempt-1-2026-09-17.md)
- [`docs/verification/w18-hosted-economics-attempt-2-2026-09-17.md`](docs/verification/w18-hosted-economics-attempt-2-2026-09-17.md)
- [`docs/verification/w18-hosted-diagnostic-attempt-3-2026-09-17.md`](docs/verification/w18-hosted-diagnostic-attempt-3-2026-09-17.md)
- [`docs/verification/w18-hosted-diagnostic-attempt-4-2026-09-17.md`](docs/verification/w18-hosted-diagnostic-attempt-4-2026-09-17.md)
- [`docs/verification/w18-formal-run-readiness-2026-09-18.md`](docs/verification/w18-formal-run-readiness-2026-09-18.md)
- [`docs/verification/w18-formal-guard-merge-2026-09-18.md`](docs/verification/w18-formal-guard-merge-2026-09-18.md)
- [`docs/verification/w18-formal-operator-wrapper-2026-09-18.md`](docs/verification/w18-formal-operator-wrapper-2026-09-18.md)
- [`docs/verification/w18-duplicate-execution-reconciliation-2026-09-18.md`](docs/verification/w18-duplicate-execution-reconciliation-2026-09-18.md)
- [`docs/verification/w18-final-closure-2026-09-18.md`](docs/verification/w18-final-closure-2026-09-18.md)
- [`docs/verification/w20-final-current-state-closure-2026-09-18.md`](docs/verification/w20-final-current-state-closure-2026-09-18.md)

## Apa yang sudah ada

| Modul/area | Current baseline |
|---|---|
| **Ai** | Chat + Local/Hosted routing, `/space`, `/ops`, `/settings` |
| **Hub** | Policy, approval, audit, orchestration, Historical Ledger, ECX, capability authority |
| **Connect** | Local/hosted provider gateway, exact cache, routing/cost telemetry, encrypted credential Vault, durable spend budget, MCP, runtime settings |
| **Context** | L0–L2 memory + L3 metadata binding |
| **Sync** | Pairing/self-host relay + MCP HTTPS bridge |
| **Artifact** | Content-addressed storage SHA-256 |
| **Sandbox** | Tier 0, WASM, hardened Docker boundary |
| **Space** | Notes/block runtime without replacing Context source of truth |
| **Flow** | Durable workflow on Temporal |
| **RnD** | Trace/eval foundation + dataset governance |
| **Production Ops** | Compose/Caddy, metrics/traces, provider canary, release/install/upgrade/rollback tooling |
| **Security** | Full-history/working-tree secret scans, release checks, HTTP/SSRF hardening, public HTTPS MCP acceptance |
| **ECX optimizer evidence** | W16 automatic selector + W17 no-oracle local validation + W18 bounded hosted-dollar validation CLOSED |

## Arsitektur inti

Hub adalah supervisor/policy boundary. Service tidak boleh membuka database service lain secara langsung.

```text
Ai
 -> Hub
    -> Context
    -> Connect -> local/hosted models
    -> Artifact
    -> Sandbox
    -> Space
    -> Flow -> Temporal
    -> RnD

Hosted MCP client
 -> public HTTPS edge
 -> Sync
 -> Connect MCP
 -> Hub governance
```

Memory hierarchy:

```text
L0 episodic log      append-only ground truth
L1 semantic facts    bi-temporal
L2 core memory       small/editable, owned by Context
L3 artifacts         content-addressed, JIT retrieval
```

Historical Ledger in Hub is chronological/replay history; it does not replace Context memory. ECX is pointer-first internal agent exchange.

## W16/W17 automatic selector evidence

W16 added automatic `semantic-v1` reference selection with `maxRefs=3`. W17 then ran:

```text
5 tasks × 5 repeats × 4 lanes = 100 measured model calls
cache hits = 0
passed task gates = 5/5
median automatic selector recall = 1.0
```

This is bounded local evidence. It does not prove hosted dollar savings or universal end-to-end network savings.

## W18 hosted economics

Formal profile remains pinned to OpenRouter / `anthropic/claude-sonnet-4.5`, Anthropic-only routing, fallback disabled, two lanes, five tasks, two repeats, 20 measured calls, and provider-reported `usage.cost` as billing authority.

## W18 formal runtime result

The synchronized formal execution on `main` `f249d9c0681462253bff21ca30354892ca4ce60f` completed the full **5 tasks × 2 repeats × 2 lanes = 20 measured hosted calls** and the harness returned `aggregate.pass=true` plus `closureEligible=true`.

```text
full-inline billed cost = US$0.059106
ecx-selective-auto billed cost = US$0.032610
actual formal run spend = US$0.091716
saved vs full-inline = US$0.026496
savedPct = 44.827936250126896
medianTaskSavedPct = 44.4913020558777
medianTaskInputTokenReductionPct = 50.629874025194965
failedTasks = 0
```

Raw local evidence remains gitignored. The recorded evidence SHA-256 is `cadb920047a27eb4e3db38cb53e63192af3ea7857617d8f125c7056bd6c162da`.

Cleanup passed: `hostedCallsEnabled=false`, future-process kill switch restored to `1`, engine stopped, and the formal run's durable committed delta exactly matched US$0.091716.

### Duplicate-execution reconciliation

The US$0.091596 pre-run delta is now reconciled from the local durable ledger as an earlier 20-entry settled W18-shaped batch at 02:14–02:15 UTC. Its full-inline actual total was US$0.059046 and automatic ECX total US$0.032550. The later recorded PASS batch cost US$0.091716, so combined spend was **US$0.183312**, still below the documented US$0.25 monetary ceiling.

This exposed a governance bug: the wrapper enforced a dollar cap per invocation but did not persist single-attempt authorization consumption. The fail-closed one-shot marker plus completed-PASS evidence detection passed CI/Product Eval and merged through PR #142 at `cff6e21edc8085bb895c6ed59c32b5e4aa134ee0`. Do not rerun the paid benchmark.

Canonical verification: `docs/verification/w18-formal-hosted-economics-pass-reconcile-2026-09-18.md`.

## Menjalankan lokal

Requires Node >=22 and pnpm 10.

```bash
pnpm install
pnpm verify
cp .env.example .env
pnpm dev
```

Operator runtime bridge:

```bash
pnpm engine:start
pnpm engine:doctor
pnpm engine:stop-temporal
```

W18 zero-spend preflight:

```powershell
node .\scripts\w18-hosted-economics.mjs --preflight
```

Fail-closed operator wrapper (initial wrapper PR #138; single-attempt guard completed by PR #142):

```powershell
node .\scripts\w18-formal-operator.mjs --preflight-only
node .\scripts\w18-formal-operator.mjs --execute-authorized-w18
```

The wrapper derives the current UTC-day ceiling from the durable ledger, keeps hosted calls off during preflight, uses only ephemeral child-process overrides, performs cleanup in `finally`, refuses completed 20-call PASS evidence, and persists one-shot authorization consumption before hosted dispatch.

Do not run formal W18 from stale `main`, with an old engine process, without an explicit current-run spend cap, or with provider routing allowed to fall back.

## Production/self-host

Production activation remains deferred by operator. Tooling/runbooks stay available under `docs/production-activation.md`, `docs/production-operations.md`, `docs/release-operations.md`, and `docs/cloudflare-free-deployment.md`. VPS/domain/firewall/Cloudflare mutation is not a W18 prerequisite.

## Invarian penting

- Memory is untrusted data, not instructions.
- Historical Ledger and Context L0 are semantic ground truth.
- No cross-service database access.
- Hub owns policy/approval/capability authority.
- Connect owns provider/credential/MCP and hosted spend authority.
- Artifact owns L3 bytes.
- Hosted egress follows scope/sensitivity/sync-class policy.
- No silent provider fallback.
- Production credentials live in Connect Vault, never Git/docs.
- Hosted dispatch obeys kill switch + durable cumulative budget.
- Exact-cache hits cannot contaminate comparative evidence.
- Model identity must be pinned for durable evidence claims.
- Local USD `0` is not hosted billed-cost evidence.
- Valid failed evidence is preserved after fixes.
- Raw private runtime evidence remains gitignored.
- AutoClick remains deferred until a real non-API use case passes architecture review.

## Next execution order

```text
1. F6-E01 is CLOSED / REPO-SIDE PASS
2. F6-E02 is CLOSED / REPO-SIDE PASS
3. F6-E03 is CLOSED / REPO-SIDE PASS (PR #151, CI #1033, Product Eval #272)
4. F6-E04 is CLOSED / REPO-SIDE PASS (PR #153, CI #1041, Product Eval #280, MCP #473)
5. F6-E05 is CLOSED / REPO-SIDE PASS (PR #155, CI #1045, Product Eval #284, MCP #475)
6. F6-E06 is CLOSED / REPO-SIDE PASS (PR #157, CI #1055, Product Eval #294, MCP #483)
7. F6-E07 is CLOSED / REPO-SIDE PASS (PR #160, CI #1072 rerun, Product Eval #311, MCP #498, Desktop Installer #41)
8. F6-E08 is ACTIVE: pin container/base images by digest and continuously reject tag-only mutable image identities
```

## Lisensi

MIT for repository code already released. See [`docs/LICENSING.md`](docs/LICENSING.md).
