# Repository documentation reconciliation — 2026-09-23

Status: **AUDIT COMPLETE / CURRENT-STATE CONVERGENCE CANDIDATE**

Baseline `main`: `3bb1d0b26064469998e4595809d646575cd04456`  
Working branch: `docs/repository-state-reconciliation-20260923`

## Purpose

Reconcile the entire ECORIONE documentation surface with the real repository/runtime state before DR-2 checkpoint 2 proceeds.

This pass starts from the repository tree rather than from chat history. At baseline it inventoried **220 Markdown/MDX/TXT files under `docs/`**, plus the root `README.md` and `AGENTS.md`. This reconciliation file becomes the 221st document under `docs/` when merged.

The audit preserves historical provenance rather than rewriting old evidence to look current.

## Real project state at audit boundary

The current authoritative state is:

- original Batch 1–12 / W / bounded F6 baseline: **CLOSED at documented boundaries**;
- Product Evolution PE-00..PE-08: **CLOSED / PASS**;
- post-closure PCS-00..PCS-10: **CLOSED / PASS**;
- original Off-host Backup & DR: **CLOSED / PASS** for total SumoPod staging-host loss at the documented boundary;
- original DR exact recovered runtime: `b27c1e5833be0a0fccf3f525d82ae8853cd22113` / `staging-b27c1e5833be`;
- original DR runtime evidence: three retained encrypted generations, marker-bound independent retrieval, isolated verification, guarded restore of 12 project volumes, 15-service application recovery, semantic canary, protected/MCP/Ops checks, changed Linux boot ID, preserved Connect/project-volume fingerprints, and final marker-bound closure evidence;
- original DR one-drill measurements: conservative RPO 3147s, retrieval-ready RTO 3138s, data-ready RTO 5582s, application-ready RTO 30042s, final recovery RTO 71523s; these are measurements, **not SLA**;
- original DR remaining caveat: backup-target and replacement-host WSL distros were on the same physical Windows machine; the secret-recovery copy was freshly prepared before that drill;
- DR-2 physical independence: **ACTIVE**;
- DR-2 checkpoint 1 repository foundation: **CLOSED / PASS** through PR #278 / merge `4d1f4ef82839c74cc1ca8454511405a68424f0b7`;
- DR-2 checkpoint 1 bookkeeping: **CLOSED / PASS** through PR #280 / merge `3bb1d0b26064469998e4595809d646575cd04456`;
- DR-2 checkpoint 2 external-target selection: **ACTIVE / OPERATOR GATE**;
- no genuinely external DR-2 target has been selected, contacted, provisioned, or paid for yet;
- GitHub `main` remains source of truth;
- later documentation/DR-2 merges after the original DR runtime were **not deployed** because staging deployment activation remained disabled; recent Staging Deploy workflows passed their gate jobs and skipped the deploy job;
- public production promotion and Cloudflare/public-edge activation remain **DEFERRED / SEPARATE EXPLICIT GATES**;
- AutoClick remains **DEFERRED BY DESIGN**.

## Documentation classes and reconciliation rule

### Current/canonical documents

These must state present reality and may be edited as state changes:

- root `README.md`;
- `AGENTS.md`;
- `docs/README.md`;
- `docs/current-state-and-next-steps.md`;
- `docs/active-work-plan.md`;
- `docs/EXECUTION-PROGRESS.md`;
- current operator/security/release/staging/DR runbooks;
- current decision log.

### Historical contract/reference documents

PRD, blueprint, closed roadmaps, closed acceptance contracts, and prior local evidence documents may contain historical phase language. This pass updates their **current-status/reconciliation notices** where needed, while preserving the original contract/sequence text.

### Accepted ADRs

Accepted ADRs remain architectural decision records. They are not mass-edited to reflect later operational status unless a new ADR supersedes an architectural decision.

### Dated verification and archive evidence

`docs/verification/` and `docs/archive/` preserve what was true when each record was produced. Old files may therefore say ACTIVE, PENDING, NOT YET PROVEN, or name older runtime SHAs. Those statements are historical provenance, not present authority.

This pass does **not** rewrite dated evidence to manufacture a cleaner history.

## Contradictions corrected

The baseline still contained several present-tense claims that were no longer true after the original DR closure and DR-2 opening. The reconciliation corrects them in current/living documents, including:

- Off-host Backup & DR described as the only active operational scope;
- original DR runtime execution described as pending;
- real independent retrieval/restore and total-host-loss recovery described as not yet proven;
- `52046db...` described as the current staging runtime after the later governed `b27c1e...` DR deployment;
- older `0f332c73...` maintenance/runtime identities written in present tense rather than explicitly historical;
- production/security/CD docs describing all off-host DR as a non-claim after the later original DR runtime closure;
- PCS-09 handoff wording that still said real off-host runtime evidence had not happened;
- verification index saying no implementation/operational scope was active;
- PRD/blueprint notices saying there was no active work at all;
- documentation navigation still pointing readers to the original Off-host DR as active instead of DR-2 checkpoint 2.

## Current claim boundaries after reconciliation

The documentation now distinguishes these claims:

1. **Original SumoPod staging-host-loss recovery — PROVEN / CLOSED**  
   Proven only at the documented Issue #266 boundary.

2. **DR-2 physical-host/storage independence — ACTIVE / NOT YET PROVEN**  
   Checkpoint 1 is closed; checkpoint 2 target selection is active.

3. **Public production — NOT ACTIVATED**  
   Staging and DR evidence do not authorize production.

4. **Cloudflare/public edge — OPTIONAL / NOT SELECTED AS PRODUCTION CUTOVER**  
   Cloudflare evidence remains separate.

5. **Point-in-time recovery and provider/account-wide disaster recovery — NOT CLAIMED**  
   Neither follows automatically from the original DR drill.

6. **RPO/RTO SLA — NOT CLAIMED**  
   The measured original-drill values are not contractual targets.

## Living documents synchronized

This pass updates the living/current documentation surfaces that materially affected current interpretation:

- root `README.md`;
- `AGENTS.md`;
- `docs/README.md`;
- `docs/EXECUTION-PROGRESS.md`;
- `docs/current-state-and-next-steps.md`;
- `docs/active-work-plan.md`;
- `docs/DECISIONS.md`;
- `docs/prd.md`;
- `docs/blueprint.md`;
- `docs/verification/README.md`;
- `docs/production-activation.md`;
- `docs/production-operations.md`;
- `docs/release-operations.md`;
- `docs/security-review.md`;
- `docs/cloudflare-free-deployment.md`;
- `docs/sumopod-staging.md`;
- `docs/staging-continuous-deployment.md`;
- `docs/staging-hardening-backup-observability.md`;
- `docs/data-governance-dr-operations.md`;
- `docs/local-backup-restore-evidence.md`;
- `docs/post-closure-product-staging-roadmap.md`;
- DR-2/original-DR runbooks already synchronized before this pass remain authoritative.

## Historical documents intentionally not rewritten

The audit intentionally leaves dated historical evidence intact, including:

- old latest-main staging-convergence checkpoints that said ACTIVE before closure;
- original Off-host DR repository checkpoint files that said real-host runtime remained pending;
- PCS/PE closure records that contained non-claims valid at their own closure date;
- older maintenance checkpoints that named the then-current staging SHA;
- archived planning/audit snapshots.

Their history is valid. Current state must be read through the precedence documented in `docs/README.md`.

## Deployment/source distinction

Repository and runtime identity remain separate evidence boundaries.

At this reconciliation boundary:

- repository `main` baseline: `3bb1d0b26064469998e4595809d646575cd04456`;
- latest proven original-DR staging application runtime: `b27c1e5833be0a0fccf3f525d82ae8853cd22113` / `staging-b27c1e5833be`;
- documentation/DR-2 repository advances after that runtime do not imply a new staging deployment;
- Staging Deploy gate success with deploy skipped must not be described as application deployment.

## Next gate

After this documentation reconciliation merges green, **DR-2 checkpoint 2 external-target selection** remains the only active infrastructure gate.

No checkpoint 3 runtime preflight should begin until the operator chooses a genuinely external backup target outside the physical/storage failure domain of the intended replacement compute.

## Merge gate

Before this reconciliation may be treated as current:

- exact PR head must pass normal repository CI and Product Eval;
- any documentation/link/format failure must be fixed, not bypassed;
- merge only the reviewed head;
- merged-main CI/Product Eval must be checked;
- current-state scans must no longer present the original Off-host DR as active/pending or `52046db...`/`0f332c73...` as the current staging identity outside explicitly historical context.

This document is the audit record; the PR is the exact-head merge authority.
