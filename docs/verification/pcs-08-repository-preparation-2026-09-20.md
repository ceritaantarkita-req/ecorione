# PCS-08 — GitHub-to-Staging CD Repository Preparation

Date: **2026-09-20**

Status: **IMPLEMENTATION CANDIDATE / CI + REAL HOST EVIDENCE PENDING**

## Scope

PCS-08 begins after PCS-07 CLOSED / PASS. It introduces a bounded GitHub-to-SumoPod staging deployment path while preserving GitHub `main` as source of truth and the existing isolated `ecorione-staging` runtime.

## Implementation candidate

The branch adds:

- `.github/workflows/staging-deploy.yml` — workflow-run gate over CI + Product Eval for exact current `main`, plus manual dispatch for the first controlled activation;
- `scripts/staging-cd-forced-command.sh` — exact-SHA SSH forced-command gate;
- `scripts/staging-cd-root-deploy.sh` — serialized exact-revision host deploy / smoke / evidence / rollback orchestration;
- `scripts/staging-cd-host-bootstrap.sh` — idempotent dedicated deploy-user + sudo boundary provisioning;
- `test/pcs08-staging-cd-source-contract.test.ts` — deterministic deployment-policy source contract;
- `docs/staging-continuous-deployment.md` — operator and security runbook.

The normal production shell syntax acceptance and release-security file inventory include the new deployment scripts, and Product Eval includes the PCS-08 source contract.

## Security boundary

The candidate is inert by default until repository variable `ECORIONE_STAGING_CD_ENABLED=1` is explicitly configured. This prevents the implementation merge itself from attempting an unprovisioned deployment.

The candidate deliberately avoids:

- personal/operator SSH keys in GitHub;
- adding the deploy account to the Docker group;
- arbitrary SSH commands;
- `ssh-keyscan` trust-on-first-use in the deployment workflow;
- polling-based `git pull`;
- deploying stale successful commits after `main` moves;
- reporting a release healthy when public/ops/exact-host evidence fails.

The GitHub key may request only `deploy <exact-sha>`. The host independently fetches and requires that SHA to equal current `origin/main`.

## Rollback boundary

The deploy orchestrator retains previous source/image identity and attempts runtime rollback after a failed post-checkout gate. Rollback success does not make the GitHub release successful.

This is runtime rollback only; owner data rollback remains separate.

## Pending evidence

Before PCS-08 can close:

1. branch CI + Product Eval must pass on exact head;
2. implementation must merge to `main`;
3. dedicated host deploy account / forced-command boundary must be provisioned from the reviewed scripts;
4. GitHub `staging` Environment secrets must be configured;
5. a real merged `main` SHA must auto-deploy after both main gates pass;
6. release receipt, public smoke, ops health, and exact-host evidence must match;
7. a controlled real rollback exercise must pass;
8. intended current `main` must be restored after the rollback exercise.

No source-only result is sufficient to claim those remote boundaries.
