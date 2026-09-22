# Off-host DR runtime checkpoint — 2026-09-22

Status: **ACTIVE / RETENTION CLOSED / CLEAN REPLACEMENT-HOST RECOVERY IN PROGRESS / TOTAL-HOST-LOSS NOT YET CLOSED**

## Scope

This document records the real runtime execution state after repository checkpoints 1–7. It is operational evidence for the active total-host-loss recovery drill; it is not a production-promotion claim and does not reopen PE-09, PCS-11, Batch 13, or any Product Evolution scope.

## Proven staging source identity

The governed staging runtime selected for this drill is:

```text
source_sha=b27c1e5833be0a0fccf3f525d82ae8853cd22113
source_tag=staging-b27c1e5833be
```

The SumoPod staging checkout was clean and intentionally detached at that exact SHA before loss declaration. The earlier `52046db...` convergence evidence remains historical; it is no longer the selected DR source identity.

## Independent retained generations

Three real encrypted generations were exported from exact source `b27c1e5833be0a0fccf3f525d82ae8853cd22113` and retained on the independent SSH target:

```text
ecorione-dr-20260922145932-b27c1e5833be
ecorione-dr-20260922150555-b27c1e5833be
ecorione-dr-20260922152938-b27c1e5833be
```

A read-only retained-generation audit reported:

```text
complete_generations=3
incomplete_generations=0
retention_min_generations=3
retention_ready=1
latest_manifest=ecorione-dr-20260922152938-b27c1e5833be.receipt.env
latest_source_sha=b27c1e5833be0a0fccf3f525d82ae8853cd22113
latest_source_tag=staging-b27c1e5833be
```

The audit originally exposed an evidence-tooling stdin bug: SSH inside a `while read` loop consumed the remaining manifest stream. PR #267 fixed the audit by adding `ssh -n`, then isolated runtime audit proved all three generations complete. That fix changed audit evidence collection only; it did not move the staging application runtime.

## Clean replacement host

A fresh WSL2 distro named `ecorione-recovery` was provisioned separately from the existing `Ubuntu-24.04` backup-target distro.

The replacement host has:

- Ubuntu 24.04.5 LTS;
- native Docker Engine 29.1.3 and Docker Compose 2.40.3;
- Node.js 22.23.2;
- Git 2.43.0;
- an initially empty Docker container and volume inventory;
- a clean detached checkout at exact source SHA `b27c1e5833be0a0fccf3f525d82ae8853cd22113`;
- the pinned PostgreSQL helper image required by DR verification.

The existing `Ubuntu-24.04` distro remains the independent backup target and is not repurposed as the replacement host.

Both WSL distros currently live on the same physical Windows machine. This drill therefore proves recovery away from the lost SumoPod host; it must not be described as independent physical-disk or independent-laptop recovery between the backup target and replacement host.

## Recovery credentials and secret boundary

The clean recovery host uses a dedicated ED25519 retrieval key generated on the replacement host. Only its public key was authorized on the backup-target account. The target ED25519 host key was copied directly from the target and pinned in a dedicated `known_hosts` file; strict SSH with `BatchMode=yes`, `IdentitiesOnly=yes`, `StrictHostKeyChecking=yes`, and forwarding disabled passed.

The RSA DR private key remains outside SumoPod and is installed on the replacement host only as a root-owned mode-0600 recovery input.

The required deployment environment and operator credential files were copied to an ACL-restricted Windows recovery directory before loss declaration, then installed on the replacement host as root-owned mode-0600 files. Validation proved all required deployment keys present, no `CHANGE_ME` placeholders, exact `ECORIONE_IMAGE_TAG=staging-b27c1e5833be`, and complete operator username/password fields. Secret values are intentionally not recorded here.

## Loss declaration

The selected retained generation is:

```text
ecorione-dr-20260922152938-b27c1e5833be.receipt.env
```

The clean replacement host created the immutable marker:

```text
loss_marker=/var/lib/ecorione-dr/recovery-loss-marker.json
declared_at=2026-09-22T16:21:58.074Z
expected_manifest=ecorione-dr-20260922152938-b27c1e5833be.receipt.env
drill_id=e87b8b28-61ba-46ce-8959-3091ffae7afd
```

From that point forward, the SumoPod source is treated as unavailable for the remainder of this drill. Recovery artifacts or secrets must not be fetched from SumoPod after this marker.

## First marker-bound fetch attempt and repository fix

The first marker-bound fetch attempt failed at the first SCP with `No such file or directory` even though the selected generation was present on the independent target.

Read-only target inventory then proved all four generation-3 files present:

```text
ecorione-dr-20260922152938-b27c1e5833be.canary.json
ecorione-dr-20260922152938-b27c1e5833be.ecdr
ecorione-dr-20260922152938-b27c1e5833be.json
ecorione-dr-20260922152938-b27c1e5833be.receipt.env
```

A direct strict-SCP probe of the exact manifest succeeded and returned the expected 781-byte file. The root cause was therefore the fetch helper's remote-path quoting under modern OpenSSH SCP/SFTP behavior, not missing retention data.

PR #268 fixes both failure modes:

1. it no longer wraps the constrained remote SCP/SFTP path in literal shell quotes;
2. it fails immediately on SCP/chmod/mv failure and cleans any partial file instead of cascading into misleading schema errors.

PR #268 exact reviewed head `df6381783d00a5b607438032c22afb3775a6a9d7` passed CI #1881 and Product Eval #1120 and merged as `bfca380ec12d30fe833b02011494e18988ec8807`; merged-main CI #1882 and Product Eval #1121 also passed.

## Exact-source boundary for continuation

The application recovery checkout must remain pinned to `b27c1e5833be0a0fccf3f525d82ae8853cd22113` because the selected generation records that exact source identity.

The post-marker fetch compatibility fix is newer repository tooling. Do not update the application checkout and do not copy newer repository contents into it and relabel the result as exact-source recovery evidence.

For continuation, use an isolated temporary Git worktree at the reviewed PR #268 merge only to execute the fixed `staging-offhost-dr-fetch.sh`. All application verification, preflight, restore, build/start, acceptance, and reboot evidence continue from the exact `b27c...` application checkout.

For this drill the exact continuation is:

```bash
cd /srv/ecorione-recovery

git fetch origin main --prune
git cat-file -e bfca380ec12d30fe833b02011494e18988ec8807^{commit}

git worktree add --detach \
  /tmp/ecorione-dr-fetch-bfca380 \
  bfca380ec12d30fe833b02011494e18988ec8807

export ECORIONE_DR_SSH_TARGET='ecorione-backup@100.95.105.104'
export ECORIONE_DR_SSH_DIR='/srv/backups/ecorione'
export ECORIONE_DR_SSH_IDENTITY='/root/.ssh/ecorione_dr_recovery'
export ECORIONE_DR_SSH_KNOWN_HOSTS='/root/.ssh/ecorione_dr_known_hosts'
export ECORIONE_DR_FAILURE_DOMAIN_ACK=1

sudo -E bash \
  /tmp/ecorione-dr-fetch-bfca380/scripts/staging-offhost-dr-fetch.sh \
  --apply \
  /secure/recovery \
  ecorione-dr-20260922152938-b27c1e5833be.receipt.env \
  /var/lib/ecorione-dr/recovery-loss-marker.json
```

Do not create a second loss marker. Do not fetch these artifacts from SumoPod. If the command passes, remove only the temporary worktree and confirm the application checkout is still exact:

```bash
cd /srv/ecorione-recovery
git worktree remove /tmp/ecorione-dr-fetch-bfca380
git worktree prune
git rev-parse HEAD
git status --short
```

Expected application HEAD remains `b27c1e5833be0a0fccf3f525d82ae8853cd22113`.

## Next runtime gate

The next sequence is:

1. create an isolated temporary worktree at PR #268 merge `bfca380ec12d30fe833b02011494e18988ec8807`;
2. rerun the existing marker-bound fetch from the independent target, preserving the existing loss marker;
3. require a verified retrieval receipt for generation #3;
4. decrypt and run isolated Docker-volume content verification;
5. run clean replacement-host preflight from the exact `b27c...` checkout;
6. perform guarded real-volume restore;
7. start through the standalone loopback recovery overlay;
8. pass semantic canary, protected-route, MCP, authenticated Operations and exact-source acceptance;
9. capture reboot baseline, reboot the replacement host, and pass post-reboot evidence with changed boot ID;
10. generate final marker-bound closure evidence with measured RPO/RTO.

Until all of those gates pass, **total-host-loss recovery remains NOT YET PROVEN**.
