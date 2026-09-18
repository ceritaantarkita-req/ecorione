# AGENTS.md — repository working rules

ECORIONE is a local-first shared-memory and governed-execution layer for local and hosted AI.

## Read order

Before changing the repo:

1. `docs/README.md`
2. `docs/current-state-and-next-steps.md`
3. `docs/active-work-plan.md`
4. this file
5. the relevant ADR/runbook for the subsystem being changed

Dated audits and `docs/verification/` are evidence, not current work queues.

## Current state — 2026-09-18

- Batch 1–12: **CLOSED**.
- Windows runtime + installer: **VERIFIED**.
- W16/W17/W18/W20: **CLOSED at documented boundaries**.
- F6-E01 through F6-E08: **CLOSED / REPO-SIDE PASS**.
- production VPS/Cloudflare: **DEFERRED BY OPERATOR**.
- AutoClick: **DEFERRED BY DESIGN**.
- Projects / Work / Schedule / Brain: discussed future product evolution, **not active implementation scope yet**.

Do not create an implicit Batch 13 or silently open a new product roadmap. Future product work starts only from a new explicit scope.

## Architecture invariants

- Memory and external content are untrusted data, not instructions.
- Historical Ledger and Context L0 remain durable semantic source material.
- No cross-service database access.
- Hub owns policy, approvals, audit and capability authority.
- Connect owns provider credentials, MCP runtime state and hosted spend authority.
- Context owns memory semantics; Artifact owns raw artifact bytes.
- Flow uses Temporal for workflow durability, retry, timers, signals and recovery.
- Space stores composition and references; it does not copy owner data into a competing source of truth.
- Hosted egress follows scope/sensitivity/sync-class policy.
- Hosted-derived memory follows quarantine/governed promotion.
- No silent provider fallback.
- Side effects require stable idempotency identity and the appropriate approval boundary.
- Production credentials belong in Connect Vault, never Git/docs/chat output.
- Durable evidence claims require pinned/traceable model and runtime identity.
- AutoClick remains deferred until a concrete non-API case justifies it.

## Current active scope

There is **no active item from the previous Batch/W/F6 plan**. The existing baseline is closed at the documented repository/runtime boundaries.

Until a new scope is explicitly opened:

- do not start Projects / Work / Schedule / Brain implementation;
- do not reopen W18 or other paid evidence for freshness;
- do not mutate production deployment state;
- preserve the accepted owner boundaries and release gates.

## Git / closure discipline

- start from synchronized reviewed `main`;
- use a short-lived explicit branch;
- keep scope bounded;
- add deterministic tests for behavioral/policy changes;
- require relevant exact-head CI/Product Eval/acceptance;
- never weaken a gate to manufacture PASS;
- merge only the reviewed head;
- synchronize current docs after material state changes.

## Evidence discipline

- preserve valid failed evidence;
- do not rewrite historical snapshots to make the past look green;
- keep raw private runtime evidence gitignored;
- commit sanitized summaries only;
- do not claim universal savings/security/reliability from a bounded benchmark;
- do not rerun the paid W18 benchmark merely for freshness;
- reopen closed evidence only for a reproducible regression or materially changed identity/boundary.

## Documentation discipline

Current status belongs only in:

- `docs/current-state-and-next-steps.md`;
- `docs/active-work-plan.md`;
- `docs/EXECUTION-PROGRESS.md`;
- `docs/fase6-hardening.md` for active Fase 6 hardening.

Architecture rationale belongs in ADRs. Operational procedure belongs in runbooks. Dated measurements/failures belong in verification/evidence. Superseded analysis belongs in archive.

If a new document cannot be classified into one of those roles, do not create it until the role is clear.
