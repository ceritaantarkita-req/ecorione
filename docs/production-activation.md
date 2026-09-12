# ECORIONE — Production Activation Workstream

Status: **DEFERRED BY OPERATOR DECISION / TOOLING READY**
Date: 2026-09-12

This is the post-closure production-deployment workstream. It does not reopen Batch 1–12 and it is not Batch 13.

The operator has explicitly chosen **not to deploy to a VPS/compute host yet**. Do not treat that decision as a blocker or failure. Do not perform target-host, Cloudflare, firewall, domain, or hosted-provider mutations unless the operator explicitly resumes this workstream.

Current active local work is documented in `docs/current-state-and-next-steps.md`. Local persistence/restart, isolated local backup/restore, and the bounded local observability baseline are closed within their documented local boundaries. **UX/product validation is the active next checkpoint.** Comparative ECX remains closed with its documented limitations.

## Objective when resumed

Take the repository-verified production/self-host baseline from the already-closed local evidence boundary into a real compute-host deployment, then optionally put Cloudflare Free + a named Tunnel in front of it, validate real providers/traffic, and gather production-only evidence.

## Completed prerequisites

- Planned implementation roadmap: **12/12 CLOSED (100%)**.
- Production/self-host repository baseline: **READY** within its documented repository boundary.
- Real laptop rehearsal: **PASS / LOCAL BOUNDARY CLOSED**.
- Real Historical Ledger + ECX local traffic/integrity checkpoint: **PASS / LOCAL CHECKPOINT CLOSED**.
- Browser/Historical-Ledger session identity defect: fixed in PR #36.
- Historical Ledger + ECX evidence closure: PR #37 merged as `88d588bbe4a5f005652c20f3409dd72093439f56`.
- Comparative ECX harness + runtime evidence checkpoint: **CLOSED / PASS WITH LIMITATIONS**.
- Final corrected Comparative ECX run: 5/5 task gates PASS over 75 uncached measured calls.
- Local persistence/restart first drill: **valid FAIL**, relative durable-path defect found.
- Repo-root runtime path fix PR #46: merged as `778e7eb19a0e2f528c64e68459d8ff6e6ecbe1ce`.
- Local compiled-runtime bootstrap fix PR #48: merged as `673af91642ea1b9440079e396675c69f53647951`.
- Final local persistence/restart rerun: **CLOSED / PASS** across Phase 4 + Temporal + PostgreSQL-container restart boundary.
- Isolated local backup/restore implementation PR #50: merged as `4e6bcd94776fc7dd75440ee35dd8fddf0b602233`.
- Isolated local backup/restore runtime checkpoint: **CLOSED / PASS WITH EXPLICIT ABSENT-OWNER LIMITATIONS**.
- Local observability implementation PR #52: merged as `bbd9c1aeed0c0aaffc39b6f912c35e96b73702b6`.
- Bounded local observability runtime checkpoint: **CLOSED / PASS WITH BOUNDED LOCAL LIMITATIONS**.
- Deployment, provider-canary, ops-snapshot, host-audit, Cloudflare Tunnel, public-smoke, and guarded origin-lockdown tooling exists.

Sanitized local evidence:

- `docs/verification/local-production-rehearsal-2026-09-10.md`;
- `docs/verification/historical-ledger-ecx-local-evidence-2026-09-11.md`;
- `docs/verification/comparative-closure-grade-final-2026-09-11.md`;
- `docs/verification/local-persistence-restart-first-drill-2026-09-11.md`;
- `docs/verification/local-persistence-restart-closure-2026-09-11.md`;
- `docs/verification/local-backup-restore-closure-2026-09-11.md`;
- `docs/verification/local-observability-closure-2026-09-12.md`.

## Why production activation remains deferred

The operator-approved local-first sequence is now:

```text
local persistence/restart — CLOSED / PASS
  -> isolated local backup/restore — CLOSED / PASS WITH EXPLICIT ABSENT-OWNER LIMITATIONS
  -> local observability baseline — CLOSED / PASS WITH BOUNDED LOCAL LIMITATIONS
  -> UX/product validation — ACTIVE NEXT CHECKPOINT
  -> immutable local model identity hardening
  -> production activation only when the operator explicitly chooses to resume it
```

None of the closed local checkpoints should be mislabeled as VPS, Cloudflare, hosted-provider, remote-host durability, or off-host DR evidence.

## Production tooling available when resumed

| Command | Purpose | Mutation |
|---|---|---|
| `pnpm production:preflight` | Validate production env, file permissions, Compose/repo acceptance and disk-floor checks | Read-only |
| `pnpm production:host-audit` | Inspect firewall, listening sockets, SSH posture, unattended upgrades, Docker access, env mode, tunnel service and NTP | Read-only |
| `scripts/self-host-install.sh --apply` | Install/start synchronized self-host baseline after preflight | Mutating |
| `pnpm canary:provider` | Exercise one configured local/hosted provider path | Provider call |
| `pnpm canary:providers` | Sequential hosted-provider matrix through Connect Vault; restores original runtime settings | Temporary runtime-setting mutation + provider calls |
| `pnpm cloudflare:tunnel:install` | Validate Cloudflare prerequisites | Dry-run by default |
| `pnpm cloudflare:tunnel:install -- --apply` | Install remotely-managed named Tunnel service | Mutating |
| `pnpm production:smoke` | Verify HTTPS home, protected `/ops` + `/settings`, MCP resource metadata and unauthenticated challenge | Read-only network checks |
| `pnpm production:ops-snapshot` | Fetch protected `/api/ops`; optional local mode-0600 snapshot | Read-only except optional snapshot file |
| `pnpm production:data-evidence` | Verify Historical Ledger + ECX + model/token/cache/cost traffic floors | Read-only |
| `pnpm cloudflare:origin:lockdown` | Validate firewall/tunnel/SSH preconditions | Dry-run by default |
| `pnpm cloudflare:origin:lockdown -- --apply` | Remove direct origin web ingress with guarded rollback behavior | Mutating / high-impact |

Production secrets are never command-line examples in this document. Provider secrets enter only through Connect Vault/Control Center. A Cloudflare tunnel token belongs only in the operator shell at installation time.

## Current checklist

| # | Work item | State | Evidence / next gate |
|---|---|---|---|
| 0 | Local production rehearsal | **DONE / LOCAL BOUNDARY CLOSED** | Phase 4, Temporal, Gemma canary, direct Ai API, real browser Local chat, sourced-env verification |
| 1 | Historical Ledger + ECX local traffic/integrity | **DONE / LOCAL CHECKPOINT CLOSED** | Session identity, hash chain, real ECX plan/handoff/hydration, `production:data-evidence` PASS |
| 2 | Comparative ECX local efficiency evidence | **DONE / PASS WITH LIMITATIONS** | 5/5 task gates PASS over 75 uncached calls; oracle-selector and one per-run exact-string limitation remain explicit |
| 3 | Local persistence/restart evidence | **DONE / LOCAL CHECKPOINT CLOSED** | Fresh strict baseline; Phase 4 + Temporal + PostgreSQL restart; exact owner state survived; strict cleanup PASS |
| 4 | Isolated local backup/restore evidence | **DONE / PASS WITH LIMITATIONS** | Existing owner state restored into isolated targets; Temporal/PostgreSQL logical restore verified; absent Sync/Connect source state not claimed |
| 5 | Local observability baseline | **DONE / BOUNDED LOCAL PASS** | 8 owner reads/lane, 5 ECX, 5 uncached local-model samples, 0 workload errors, 5/5 trace coverage |
| 6 | UX/product validation | **ACTIVE IN SEPARATE LOCAL WORKSTREAM** | Real Ai-facing journeys, usability/functionality/error/recovery evidence |
| 7 | Deploy to real compute host/VPS | **DEFERRED BY OPERATOR** | No host action until explicit resume |
| 8 | Install Cloudflare Free + named Tunnel | **DEFERRED WITH #7** | Tooling ready; account/host evidence pending |
| 9 | Domain/DNS/HTTPS/Caddy/MCP public routing | **DEFERRED WITH #7** | Requires real target hostname/host |
| 10 | Origin firewall lockdown | **DEFERRED WITH #7** | Never apply before successful public smoke + SSH/tunnel preconditions |
| 11 | Production E2E edge smoke | **PENDING FUTURE DEPLOYMENT** | `pnpm production:smoke` on actual public edge |
| 12 | Hosted provider credentials/canaries | **OPTIONAL / OPERATOR CREDENTIALS REQUIRED** | Never required for current local work |
| 13 | Durable production observability | **PENDING FUTURE DEPLOYMENT** | Local observability baseline does not replace production retention/alerting evidence |
| 14 | Host hardening/off-host DR | **PENDING FUTURE DEPLOYMENT** | Requires actual host/failure-domain evidence |

## Resume procedure

When the operator explicitly resumes production deployment, start from synchronized clean `main` and do **read-only checks first**:

```bash
# On the chosen compute host, after cloning/synchronizing the repo:
pnpm production:preflight
pnpm production:host-audit
```

Do not continue if preflight finds placeholders, unsafe permissions, failed Compose/repository acceptance, inadequate disk, or an unexplained port/service collision.

Only after the production env is complete and reviewed:

```bash
scripts/self-host-install.sh --apply
ECORIONE_CANARY_TARGET=local pnpm canary:provider
```

Then, only if Cloudflare is still the chosen edge:

```bash
pnpm cloudflare:tunnel:install
# Operator supplies CLOUDFLARE_TUNNEL_TOKEN only in the shell, then:
pnpm cloudflare:tunnel:install -- --apply

ECORIONE_PUBLIC_BASE_URL=https://<production-hostname> pnpm production:smoke
```

Hosted-provider validation is independent and requires operator-owned Vault credentials plus explicit spend intent:

```bash
pnpm canary:providers
```

Capture production evidence only after the real deployment exists:

```bash
pnpm production:ops-snapshot
pnpm production:data-evidence
```

Origin lockdown is last, not first:

```bash
pnpm cloudflare:origin:lockdown
pnpm cloudflare:origin:lockdown -- --apply
```

## Evidence rules

Do not mark deferred production items DONE from repository CI, laptop rehearsal, local persistence/restart, local backup/restore, local observability, UX validation, or local comparative benchmarks. Specifically:

- local Phase 4 + Temporal/PostgreSQL persistence evidence does not prove remote-host persistence/restart/backup behavior;
- local backup/restore does not prove off-host disaster recovery;
- bounded local observability does not prove production SLA/SLO, load capacity, peak host/GPU use, durable telemetry retention or alerting;
- a `Healthy` Cloudflare Tunnel alone does not prove origin routing;
- local provider evidence does not prove hosted-provider quality, latency, cost, or billing;
- ECX packet/hydration counts alone do not prove savings;
- `ecx-selective-oracle` does not prove automatic reference selection;
- the final local synthetic Comparative ECX percentages are not universal/public production savings claims;
- task-level median quality PASS is not equivalent to every individual model completion being perfect;
- UI/ledger counterfactual `savedUsd`/`naiveUsd` is not a public savings claim;
- repository security CI does not prove host firewall/SSH/account posture.

## Stop conditions when resumed

Stop deployment/cutover if any of these occurs:

- local Git tree is not intended reviewed `main`;
- production env contains placeholders or unsafe permissions;
- Compose/repository production acceptance fails;
- target-host workloads/ports have an unresolved collision;
- Cloudflare edge port 7844 is unreachable when Tunnel deployment is intended;
- public smoke fails;
- `/ops` or `/settings` becomes unauthenticated;
- MCP protected-resource metadata/challenge points at wrong public resource URL;
- provider matrix cannot restore original runtime settings;
- Historical Ledger integrity verification fails;
- origin-lockdown preflight cannot prove active SSH allow rule, active cloudflared, and working public path.

## Required reading when resumed

1. `docs/current-state-and-next-steps.md`
2. `AGENTS.md`
3. this file
4. `docs/production-operations.md`
5. `docs/cloudflare-free-deployment.md`
6. `docs/release-operations.md`
7. `docs/security-review.md`
8. latest local verification notes relevant to the chosen target boundary

## Architecture boundary

Cloudflare, if used, is an external DNS/TLS/tunnel edge only. ECORIONE compute, policy, credentials, owner data stores, Temporal, Artifact and Sandbox remain self-hosted. Hub remains policy/approval authority and Connect remains provider/credential/MCP owner.
