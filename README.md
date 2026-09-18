# ecorione

**Satu memori bersama untuk AI lokal maupun hosted, plus governance, eksekusi, observability, dan optimizer biaya yang bisa diaudit.**

ECORIONE menjaga kesinambungan lintas provider/model sambil mempertahankan local-first boundary, approval, audit trail, durable execution, MCP, dan spend control yang eksplisit.

> **Current status — 2026-09-18:** production/self-host repository baseline **READY** · Batch 1–12 **CLOSED** · W03 **REAL-LAPTOP VERIFIED** · W09/W10 **WINDOWS RUNTIME VERIFIED** · W11 **WINDOWS INSTALLER VERIFIED** · W16 automatic selector **DONE — REPO SIDE** · W17 no-oracle local validation **CLOSED / PASS** · W18 hosted economics **FORMAL RUN READY / NOT CLOSED** after a successful Anthropic-only one-call diagnostic and merged formal dispatch/routing guards · W20 **BLOCKED ON W18** · compute-host/VPS + Cloudflare **DEFERRED BY OPERATOR** · AutoClick **DEFERRED BY DESIGN**.

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
- W18 formal 20-call hosted economics: **NOT YET CLOSED**.

Canonical W18 docs:

- [`docs/verification/w18-hosted-economics-preflight-2026-09-17.md`](docs/verification/w18-hosted-economics-preflight-2026-09-17.md)
- [`docs/verification/w18-hosted-economics-attempt-1-2026-09-17.md`](docs/verification/w18-hosted-economics-attempt-1-2026-09-17.md)
- [`docs/verification/w18-hosted-economics-attempt-2-2026-09-17.md`](docs/verification/w18-hosted-economics-attempt-2-2026-09-17.md)
- [`docs/verification/w18-hosted-diagnostic-attempt-3-2026-09-17.md`](docs/verification/w18-hosted-diagnostic-attempt-3-2026-09-17.md)
- [`docs/verification/w18-hosted-diagnostic-attempt-4-2026-09-17.md`](docs/verification/w18-hosted-diagnostic-attempt-4-2026-09-17.md)
- [`docs/verification/w18-formal-run-readiness-2026-09-18.md`](docs/verification/w18-formal-run-readiness-2026-09-18.md)
- [`docs/verification/w18-formal-guard-merge-2026-09-18.md`](docs/verification/w18-formal-guard-merge-2026-09-18.md)
- [`docs/verification/w18-formal-operator-wrapper-2026-09-18.md`](docs/verification/w18-formal-operator-wrapper-2026-09-18.md)

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
| **ECX optimizer evidence** | W16 automatic selector + W17 no-oracle local validation; W18 hosted-dollar closure pending formal run |

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

Formal profile:

```text
provider gateway = OpenRouter
pricing identity = claude-sonnet-4-5-20250929
runtime model = anthropic/claude-sonnet-4.5
provider.only = ["anthropic"]
allow_fallbacks = false
lanes = full-inline, ecx-selective-auto
5 tasks × 2 repeats × 2 lanes = 20 calls
warmups = 0
cost authority = OpenRouter usage.cost
```

Attempts 1–3 preserved valid failures. Attempt 3 identified `content_filter` through `routingProvider=Amazon Bedrock`. After provider routing was pinned Anthropic-only with fallback disabled, Attempt 4 passed on the same `procurement-award/full-inline` diagnostic with quality `1`, billed cost `$0.006681`, and durable settlement `settled`. PR #135 then merged the formal pre-dispatch cap guard, successful routing evidence, reservation-estimator coupling, and durable reservation consistency checks into `main` at `fcf71cc03f7584e005a490b8d7d3e4c9afdeba1a`.

Latest zero-spend postflight after Attempt 4:

```text
dailyCommittedUsd = 0.160104
monthlyCommittedUsd = 0.160104
unsettledReservations = 1
dailyHeadroomUsd = 0.839896
monthlyHeadroomUsd = 9.839896
hostedCallsEnabled = false
costKillSwitch = 1
```

The single unsettled reservation is historical Attempt 2. Do not rewrite it.

A fresh authorization exists for **one formal W18 attempt up to US$0.25**. This is not standing permission for retries. The formal process must derive current UTC-day committed spend at execution time and use the durable Connect reservation boundary as the pre-dispatch hard stop.

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

Recommended fail-closed operator wrapper (merged via PR #138; sync local `main` first):

```powershell
node .\scripts\w18-formal-operator.mjs --preflight-only
node .\scripts\w18-formal-operator.mjs --execute-authorized-w18
```

The wrapper derives the current UTC-day ceiling from the durable ledger, keeps hosted calls off during preflight, uses only ephemeral child-process overrides, and performs cleanup in `finally`. The execute command remains a single authorized attempt capped at US$0.25.

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
1. documentation sync (this update)
2. synchronize operator laptop to merged main
3. one authorized formal W18 run, max US$0.25
4. if PASS: commit W18 closure evidence
5. W20 final current-state sync
6. if FAIL: preserve evidence, diagnose, require fresh authorization before retry
```

## Lisensi

MIT for repository code already released. See [`docs/LICENSING.md`](docs/LICENSING.md).
