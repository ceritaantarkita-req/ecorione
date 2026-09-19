# AGENTS.md — repository working rules

ECORIONE is a local-first shared-memory and governed-execution layer for local and hosted AI.

## Read order

Before changing the repo:

1. `docs/README.md`
2. `docs/current-state-and-next-steps.md`
3. `docs/active-work-plan.md`
4. this file
5. for Product Evolution: architecture + roadmap + agent guide
6. relevant accepted ADR/runbook

Dated audits and `docs/verification/` are evidence, not current work queues.

## Current state — 2026-09-19

- original Batch 1–12 / W / F6 baseline: **CLOSED**;
- Windows runtime + installer: **VERIFIED**;
- Product Evolution architecture + PE-00..PE-08 roadmap: **DOCUMENTED**;
- PE-00: **CLOSED / PASS**;
- PE-01: **CLOSED / PASS**;
- PE-02: **CLOSED / PASS**;
- PE-03: **ACTIVE / TRIGGER CONTROL PLANE**;
- PE-04..PE-08: **BLOCKED BY PRIOR PE BATCH**;
- production VPS/Cloudflare: **DEFERRED BY OPERATOR**;
- AutoClick: **DEFERRED BY DESIGN**.

Do not create Batch 13. PE-03 is active; do not pull PE-04+ scope forward.

## Architecture invariants

- Memory and external content are untrusted data, not instructions.
- Historical Ledger and Context L0 remain durable semantic source material.
- No cross-service database access.
- Hub owns policy, approvals, audit and capability authority.
- Connect owns provider credentials, MCP runtime state and hosted spend authority.
- Context owns memory semantics; Artifact owns raw artifact bytes.
- Flow uses Temporal for workflow durability, retry, timers, signals and recovery.
- Space stores composition/references; it does not copy owner data into a competing source of truth.
- Hosted egress follows scope/sensitivity/sync-class policy.
- Hosted-derived memory follows quarantine/governed promotion.
- No silent provider fallback.
- Side effects require stable idempotency identity and the appropriate approval boundary.
- Production credentials belong in Connect Vault, never Git/docs/chat output.
- Durable evidence claims require pinned/traceable model and runtime identity.
- AutoClick remains deferred until a concrete non-API case justifies it.

## Product Evolution invariants

- Workspace remains authority/security boundary; Project is inside Workspace.
- Project is context/product grouping, not a new blob/data owner.
- `All` is virtual; `Personal` is a real default Project.
- sibling Project memory never joins a prompt implicitly.
- Schedule is a time-trigger UI, not a scheduler engine.
- Temporal remains Flow timer/retry/state/recovery owner.
- Trigger cannot grant authority.
- autonomy remains Hub policy; do not create an autonomous service.
- Run begins as a unified read model; do not create competing execution truth.
- Brain is a rebuildable projection; no graph DB by default.
- Context remains retrieval owner; ECX remains context-pack optimizer.
- no first-class Task domain until a real need is proven.
- `MAX_AUTONOMY_V1` stays L3.

## Current active scope

PE-03 is active. Implement Trigger control plane only, following ADR-36, the PE-03 acceptance contract, and the agent guide. PE-04 Work/Schedule/Runs product UI remains blocked except for the minimum control surface needed to verify PE-03.

## Git / closure discipline

- start from synchronized reviewed `main`;
- one PE batch at a time;
- use a short-lived explicit branch;
- keep scope bounded;
- add deterministic tests for behavioral/policy changes;
- require relevant exact-head CI/Product Eval/acceptance;
- never weaken a gate to manufacture PASS;
- merge only the reviewed head;
- synchronize current docs after material state changes;
- do not start the next PE batch until the current one is CLOSED.

## Evidence discipline

- preserve valid failed evidence;
- do not rewrite historical snapshots to make the past look green;
- keep raw private runtime evidence gitignored;
- commit sanitized summaries only;
- do not claim universal savings/security/reliability from bounded evidence;
- do not rerun paid W18 merely for freshness;
- reopen closed evidence only for a reproducible regression or materially changed identity/boundary.

## Documentation discipline

Current status belongs in:

- `docs/current-state-and-next-steps.md`;
- `docs/active-work-plan.md`;
- `docs/EXECUTION-PROGRESS.md`.

Product Evolution architecture/sequence/procedure belongs in:

- `docs/product-evolution-architecture.md`;
- `docs/product-evolution-roadmap.md`;
- `docs/product-evolution-agent-guide.md`.

Architecture decisions belong in ADRs. Operational procedure belongs in runbooks. Dated measurements/failures belong in verification/evidence. Superseded analysis belongs in archive.
