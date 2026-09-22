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

## Current state — 2026-09-22

- original Batch 1–12 / W / F6 baseline: **CLOSED**;
- Windows runtime + installer: **VERIFIED**;
- native Windows portability + repository EOL policy: **HARDENED / VERIFIED** (PR #182);
- clean-checkout / CI format reproducibility: **CLOSED / PASS** (PR #183; CI #1482; Product Eval #721);
- Windows `.cmd` index/worktree EOL reproducibility: **CLOSED / PASS** (PR #185; CI #1486; Product Eval #725; Desktop Installer #76; post-merge CI #1487 + Product Eval #726);
- Product Evolution architecture + PE-00..PE-08 roadmap: **DOCUMENTED**;
- PE-00: **CLOSED / PASS**;
- PE-01: **CLOSED / PASS**;
- PE-02: **CLOSED / PASS**;
- PE-03: **CLOSED / PASS**;
- PE-04: **CLOSED / PASS**;
- PE-05: **CLOSED / PASS**;
- PE-06: **CLOSED / PASS**;
- PE-07: **CLOSED / PASS**;
- PE-08: **CLOSED / PASS**;
- PCS-00 post-closure baseline lock: **CLOSED / PASS** (PR #189; CI #1492; Product Eval #731; merge `12fae37e901e4cbfbb7e4cb6cf9b8e9a2ec4e764`);
- PCS-01 chat continuity/history: **CLOSED / PASS** (PR #191; CI #1505; Product Eval #744; merge `ee363c055944b27b549a2f061105eea35fa25f9e`);
- PCS-02 provider onboarding + hosted model choice: **CLOSED / PASS** (PR #193; CI #1516; Product Eval #755; merge `0fba6842f4c39f2742eb6d518e63c90d1a4883db`);
- PCS-03 Local AI resilience/runtime discovery: **CLOSED / PASS** (PR #195; CI #1525; Product Eval #764; merge `4e2407af7240c9ca3b94ffbfb0a1c239c6a4ddae`);
- PCS-04 Product visual + information-architecture cleanup: **CLOSED / PASS** (PR #197; CI #1529; Product Eval #768; merge `8a328ae0c0abeb039866ac40068a9053c4796659`);
- PCS-05 Flow runtime defect closure: **CLOSED / PASS** (PR #199; CI #1537; Product Eval #776; merge `f58923b8261104c8aec331f506a68f8cf5fe5e7e`);
- PCS-06 Integrated browser/regression acceptance: **CLOSED / PASS** (PR #201; CI #1553; Product Eval #792; Browser Acceptance #13; merge `0a8f7619567500acaec0758c400d529367baf0e5`);
- PCS-07 SumoPod remote staging deployment: **CLOSED / PASS**;
- PCS-08 GitHub -> staging continuous deployment: **CLOSED / PASS** (implementation PR #210; closure PR #215; closure merge `f0aa9ca97518e3b7e57fc6bc7a58e0ed7761ba05`);
- PCS-09 staging persistence/security/backup/observability: **CLOSED / PASS** (closure PR #218 head `ece59440d742f59252046562cf3ba86e7911b46f`; CI #1678; Product Eval #917; merge `3db9e4854afbaccb9790638243fa98048c1a4f78`; merged-main CI #1679 + Product Eval #918);
- PCS-10 closure/documentation convergence: **CLOSED / PASS** (PR #219 head `c84f76face60d203592d8bc6e1a51acccfec5004`; CI #1684; Product Eval #923; merge `6058aa0ff294218147a91ee0fc7b77f32d1be80d`; post-merge bookkeeping PR #220 merged as `fa55e530615e9eb3a35d646e39bbbb3bf34d8a07` after CI #1686 + Product Eval #925);
- SumoPod remote development/staging: **VERIFIED / NOT PRODUCTION**;
- public production VPS/Cloudflare cutover: **DEFERRED / SEPARATE GATE**;
- off-host Backup & DR: **ACTIVE / CHECKPOINT 3 STANDALONE REPLACEMENT-HOST RECOVERY**; checkpoints 1–2 are CLOSED / PASS at repository boundaries, while real independent copy and total-host-loss recovery remain unproven;
- AutoClick: **DEFERRED BY DESIGN**.

Do not create Batch 13 implicitly. PE-00 through PE-08 are CLOSED / PASS; any new product scope requires an explicit roadmap/decision.

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

There is no active Product Evolution batch. PE-00 through PE-08 are CLOSED / PASS at their documented boundaries.

**PCS-00 through PCS-10 are CLOSED / PASS at documented boundaries.**

**Off-host Backup & DR is the only active operational scope.** It is explicitly authorized as a separate infrastructure workstream and is not PCS-11, PE-09, Batch 13, production promotion, or a feature batch. Checkpoint 1 repository foundation and checkpoint 2 execution/recovery tooling are CLOSED / PASS at their repository boundaries. Checkpoint 3 is active and adds a clean replacement-host preflight plus loopback-only Caddy/security/MCP/Ops acceptance so total-host-loss recovery does not depend on the lost SumoPod Traefik/public edge. Do not claim real off-host protection or total-host-loss recovery until the runtime gates in `docs/offhost-dr-recovery.md` pass on an independent failure domain.

For staging maintenance use `docs/staging-continuous-deployment.md`, `docs/sumopod-staging.md`, `docs/staging-hardening-backup-observability.md`, and `docs/offhost-dr-recovery.md`. Deploy only exact reviewed `main` through the least-privilege governed CD path; preserve host/GitHub secret isolation, fail releases when health/smoke/evidence fails, and retain the tested runtime rollback path. GitHub `main` remains source of truth; SumoPod evidence is staging rather than production. Preserve Temporal as Flow durability/timer owner and Hub as capability authority; authorization must remain fail-closed before execution. Do not create PCS-11, reopen Product Evolution, create Batch 13, promote SumoPod staging to production, activate Cloudflare/public cutover, AutoClick, L4 autonomy, graph persistence, or paid hosted evidence without a separate explicit decision.

## Git / closure discipline

- start from synchronized reviewed `main`;
- one active implementation/closure batch at a time;
- use a short-lived explicit branch;
- keep scope bounded;
- add deterministic tests for behavioral/policy changes;
- require relevant exact-head CI/Product Eval/acceptance;
- never weaken a gate to manufacture PASS;
- merge only the reviewed head;
- synchronize current docs after material state changes;
- preserve `.gitattributes`: text LF by default, `.cmd`/`.bat` CRLF;
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
