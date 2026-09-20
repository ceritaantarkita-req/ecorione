# ECORIONE — GitHub to SumoPod Staging Continuous Deployment

Last updated: **2026-09-20**

Status: **PCS-08 ACTIVE / REPOSITORY IMPLEMENTATION CANDIDATE**

PCS-08 automates deployment of the current reviewed GitHub `main` revision to the already-proven SumoPod staging runtime. It does not promote staging to production and does not replace PCS-09 persistence/security/backup/observability work.

## Deployment model

```text
PR
 -> CI + Product Eval
 -> merge main
 -> CI + Product Eval on exact main SHA
 -> Staging Deploy gate
 -> restricted SSH command: deploy <40-char SHA>
 -> SumoPod exact origin/main verification
 -> preflight
 -> build / apply exact SHA
 -> running-service check
 -> public smoke
 -> authenticated /api/ops snapshot
 -> exact-host evidence
 -> release receipt

any failed post-deploy gate
 -> previous checkout
 -> previous image tag
 -> runtime rollback
 -> basic public verification
 -> workflow remains failed
```

The GitHub workflow does not poll the VPS with a blind `git pull` loop.

## GitHub-side trust boundary

`.github/workflows/staging-deploy.yml` is triggered only when **CI** or **Product Eval** completes.

The gate job:

- accepts only `push` runs on `main`;
- requires the triggering workflow to be successful;
- verifies the target SHA is still the current GitHub `main` SHA;
- verifies successful `push/main` runs for **both** `ci.yml` and `product-eval.yml` on that exact SHA;
- skips stale revisions rather than deploying them.

The deploy job is deliberately inert until the repository variable `ECORIONE_STAGING_CD_ENABLED` is explicitly set to `1`. This lets the implementation merge before host credentials are provisioned without producing a failed or accidental deployment. After the host and secrets are ready, enable the variable and manually dispatch **Staging Deploy** once; later eligible `main` pushes deploy automatically.

The deploy job uses the protected GitHub Environment named `staging`. Configure these environment secrets:

```text
STAGING_SSH_PRIVATE_KEY
STAGING_SSH_KNOWN_HOSTS
STAGING_SSH_HOST
STAGING_SSH_USER
```

Do not use an operator's normal SSH private key. Generate a dedicated Ed25519 deployment key with no passphrase because the private key is consumed non-interactively by GitHub Actions.

The workflow requires strict host-key checking and never uses `ssh-keyscan` at deployment time. `workflow_dispatch` is supported so the operator can perform the first controlled deployment immediately after enabling the repository variable and configuring the protected environment.

## SumoPod least-privilege boundary

The dedicated SSH account defaults to:

```text
ecorione-deploy
```

It is not added to the Docker group. Its `authorized_keys` entry is forced to:

```text
/usr/local/sbin/ecorione-staging-deploy-gate
```

with OpenSSH `restrict`.

The forced-command gate accepts exactly:

```text
deploy <40-character-lowercase-git-sha>
```

and forwards only that SHA through passwordless sudo to the root-owned deployment orchestrator. Interactive shell, arbitrary command execution, port forwarding, agent forwarding, PTY use, and user rc execution are not authorized by that key.

The root orchestrator independently verifies that the requested SHA equals the freshly fetched `origin/main` SHA before mutation.

## One-time host bootstrap

Bootstrap is intentionally a manual operator action because it creates an OS account, forced-command SSH boundary, root-owned config, and one narrow sudo rule.

From a reviewed checkout on the VPS:

```bash
sudo bash scripts/staging-cd-host-bootstrap.sh \
  --public-key-file /path/to/dedicated-staging-deploy.pub \
  --public-base-url https://ecorione.inmydraft.com
```

Defaults match the currently proven staging topology:

```text
repo             /srv/ecorione-staging
repo owner       ubuntu
deploy user      ecorione-deploy
ops credentials  /home/ubuntu/ecorione-staging-ops.txt
edge network     inmydraft-demos_web
cert resolver    letsencrypt
```

Override them only when the real host topology changes.

The bootstrap installs:

```text
/usr/local/sbin/ecorione-staging-deploy-gate
/usr/local/sbin/ecorione-staging-deploy
/etc/ecorione-staging-cd.conf
/etc/sudoers.d/ecorione-staging-deploy
```

Re-running the bootstrap is the explicit way to update the root-owned deployment control scripts after a reviewed change.

## Trusted known_hosts value

Do not learn the host key from an untrusted network scan immediately before deployment.

From the already-trusted VPS session, read the server Ed25519 host public key:

```bash
sudo cat /etc/ssh/ssh_host_ed25519_key.pub
```

Build the `known_hosts` line using the SSH hostname selected for GitHub deployment and place that line in the protected `STAGING_SSH_KNOWN_HOSTS` environment secret.

## Host deploy behavior

The root-owned deploy orchestrator:

1. serializes deploys with `flock`;
2. refuses a tracked-dirty staging checkout;
3. fetches `origin/main` without `git pull`;
4. refuses any requested SHA that is not exact current `origin/main`;
5. records the previous checkout SHA and active ECORIONE image tag;
6. checks out the requested SHA detached;
7. runs the existing production preflight with the SumoPod staging env/project/overlay;
8. builds/applies a unique `staging-<12-sha>` image tag;
9. waits until every configured staging service is running;
10. runs public HTTPS smoke;
11. runs authenticated `/api/ops` health using the host-only operator credential file;
12. runs sanitized exact-host evidence against the target SHA;
13. updates the host-only `ECORIONE_IMAGE_TAG` only after all gates pass;
14. writes a non-secret release receipt to `/var/lib/ecorione-staging/deploy-state.env`.

No provider key, internal token, Vault key, database password, operator password, or SSH private key is written to Git.

## Failed deployment / rollback

If a post-checkout deployment gate fails, the orchestrator attempts runtime rollback to:

- the previous Git checkout SHA; and
- the previous active ECORIONE image tag.

It then requires every configured service to be running and performs a basic public home + protected-`/ops` verification.

A rollback does **not** convert the failed GitHub deployment into success. The GitHub job remains failed.

Runtime rollback is not data rollback. Schema/data recovery remains a separate evidence boundary and is retained for PCS-09.

## Release identity

Successful deployment state is recorded as non-secret metadata:

```text
current_sha
current_tag
previous_sha
previous_tag
deployed_at
```

The target source checkout remains detached at the exact deployed SHA.

## PCS-08 closure evidence still required

Repository CI can prove syntax, source contracts, workflow policy, and security-review integration. PCS-08 cannot close from source-only evidence.

Closure requires the real GitHub-to-SumoPod path to prove:

- dedicated forced-command deploy user installed;
- protected GitHub staging environment configured;
- one exact `main` SHA deployed automatically after both gates pass;
- healthy public smoke, authenticated operations snapshot, and exact-host evidence;
- release receipt matches the deployed revision;
- a real rollback exercise is successful and followed by restoration of the intended current revision.

Until that evidence exists, PCS-08 remains ACTIVE.
