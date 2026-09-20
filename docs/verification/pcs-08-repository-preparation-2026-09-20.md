# PCS-08 — GitHub-to-Staging CD Repository Preparation

Date: **2026-09-20**

Status: **REPOSITORY IMPLEMENTATION MERGED / HOST BOOTSTRAP PASS / GITHUB ENV + REAL CD EVIDENCE PENDING**

## Scope

PCS-08 begins after PCS-07 CLOSED / PASS. It introduces a bounded GitHub-to-SumoPod staging deployment path while preserving GitHub `main` as source of truth and the existing isolated `ecorione-staging` runtime.

## Repository implementation

PR #210 exact reviewed head `4a5fa9d9d776eae3895a8e0b8e6b73013e3f476f` passed CI #1613 + Product Eval #852 and merged to `main` as `652588e00dca5a04c8b39081fb6574a3db508ba1`. Pre-activation duplicate-deploy hardening then passed PR #212 exact head `60b920412a8dcc08c912da60d68e9fe1416baec8` with CI #1622 + Product Eval #861 and merged as `74c76fa2685333db3a59b04d0ca34554f8e9fcf0`. Push `main` at that exact merge SHA passed CI #1623 + Product Eval #862. The resulting Staging Deploy gate runs #19 and #20 completed successfully while the deploy job remained skipped because the activation variable was still disabled.

The merged implementation adds:

- `.github/workflows/staging-deploy.yml` — workflow-run gate over CI + Product Eval for exact current `main`, plus manual dispatch for the first controlled activation;
- `scripts/staging-cd-forced-command.sh` — exact-SHA SSH forced-command gate;
- `scripts/staging-cd-root-deploy.sh` — serialized exact-revision host deploy / smoke / evidence / rollback orchestration;
- `scripts/staging-cd-host-bootstrap.sh` — idempotent dedicated deploy-user + sudo boundary provisioning; it installs sibling reviewed control scripts relative to its own location so bootstrap can be exported from an exact commit without moving the live known-good checkout;
- `test/pcs08-staging-cd-source-contract.test.ts` — deterministic deployment-policy source contract;
- `docs/staging-continuous-deployment.md` — operator and security runbook.

The normal production shell syntax acceptance and release-security file inventory include the new deployment scripts, and Product Eval includes the PCS-08 source contract.

## Security boundary

The merged workflow is inert by default until repository variable `ECORIONE_STAGING_CD_ENABLED=1` is explicitly configured. This prevents the implementation merge itself from attempting an unprovisioned deployment.

The merged implementation deliberately avoids:

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

## Real host bootstrap evidence

On 2026-09-21 the actual SumoPod host was bootstrapped from reviewed exact `main` commit `74c76fa2685333db3a59b04d0ca34554f8e9fcf0` without moving the live staging checkout.

Observed before bootstrap:

```text
origin/main  74c76fa2685333db3a59b04d0ca34554f8e9fcf0
live HEAD    99523b0bb29ce11a74ec61c0e364ef5b6dd543ae
```

Observed after bootstrap:

```text
PASS staging CD host bootstrap
deploy user                  ecorione-deploy
deploy user Docker group     absent
sudoers validation           parsed OK
deploy gate owner/mode       root:root 755
root deploy owner/mode       root:root 755
host CD config owner/mode    root:root 644
sudoers owner/mode           root:root 440
live checkout                unchanged at 99523b0bb29ce11a74ec61c0e364ef5b6dd543ae
public home                  HTTP 200 / TLS verify 0
unauthenticated /ops         HTTP 401
```

The dedicated Ed25519 public key was present on the host and installed into the forced-command deploy account. No private deployment key was copied to the VPS by this bootstrap.

This establishes the host-side least-privilege boundary but does not yet prove the GitHub secret/environment path or a real CD mutation.

## Pending evidence

Before PCS-08 can close:

1. GitHub `staging` Environment secrets must be configured;
2. the dedicated key must be proven fail-closed for shell/arbitrary commands;
3. a real current `main` SHA must deploy through the GitHub workflow after both main gates pass;
4. release receipt, public smoke, ops health, and exact-host evidence must match;
5. a controlled real rollback exercise must pass;
6. intended current `main` must be restored after the rollback exercise.

No source-only result is sufficient to claim those remote boundaries.
