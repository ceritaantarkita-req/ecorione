# Off-host DR runtime checkpoint — 2026-09-22

Status: **CLOSED / PASS — TOTAL SUMOPOD HOST-LOSS RECOVERY PROVEN AT THE DOCUMENTED BOUNDARY**

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

## Marker-bound retrieval — PASS

The fixed fetch helper was executed only from the isolated PR #268 merge worktree while the application checkout remained exact and clean at `b27c1e5833be0a0fccf3f525d82ae8853cd22113`.

Generation `ecorione-dr-20260922152938-b27c1e5833be` was retrieved from the independent target with the existing immutable loss marker. The marker-bound retrieval receipt records:

```text
retrieval_started_at=2026-09-22T17:14:13.854Z
retrieved_at=2026-09-22T17:14:15.951Z
bundle_sha256=cf0a002595e36c215041fd66ce206e584a5c98919b6c90ca52cad59f123ff318
metadata_sha256=4820c11a612aa06503decfec6b8d693756e71ee70c8afefae709f9566a30af91
canary_sha256=b5f234304bc1b861ce03615e6b2e6cf6c0cd15271f7d104e3a57021ed8634ec6
```

The temporary fetch worktree was removed after PASS and the application checkout still resolved to exact `b27c1e...`.

## Isolated decrypt/content verification — PASS

Before verification, every retrieved recovery input and the loss marker was root-owned mode 0600. The `ecorione-staging` Compose project had zero containers and zero project-labelled volumes.

The exact-source verifier successfully:

- authenticated and decrypted the encrypted generation;
- confirmed `source_sha=b27c1e5833be0a0fccf3f525d82ae8853cd22113`;
- confirmed `source_tag=staging-b27c1e5833be`;
- restored and fingerprint-checked all 12 archived volumes in isolated temporary Docker volumes;
- emitted `PASS ECORIONE off-host DR bundle integrity verification`;
- removed all `ecorione-dr-verify-*` temporary volumes on completion.

After verification, the real `ecorione-staging` project still had zero containers and zero project-labelled volumes. No real recovery volume had been mutated yet.

## Clean replacement-host preflight — PASS

The official read-only replacement-host preflight passed from exact source `b27c1e5833be0a0fccf3f525d82ae8853cd22113` with:

```text
source_tag=staging-b27c1e5833be
compose_project=ecorione-staging
recovery_overlay=deploy/compose.dr-recovery.yml
loopback_base=http://127.0.0.1:18080
```

Before preflight the loopback port was free and the project had no containers or project-labelled volumes. The production configuration preflight passed; the optional repository acceptance sub-step was skipped because pnpm is not installed on the clean recovery host, which is an explicitly supported path in the preflight script. After preflight, Git remained exact and clean and the project container/volume inventory remained empty.

This closes the final read-only gate before real recovery-volume mutation.

## Guarded real project-volume restore — PASS

The guarded restore reran isolated verification successfully, then created and fingerprint-verified the exact 12 Compose-owned recovery volumes:

```text
ecorione-staging_artifact_data
ecorione-staging_caddy_config
ecorione-staging_caddy_data
ecorione-staging_connect_data
ecorione-staging_context_data
ecorione-staging_flow_data
ecorione-staging_hub_data
ecorione-staging_rnd_data
ecorione-staging_sandbox_data
ecorione-staging_space_data
ecorione-staging_sync_data
ecorione-staging_temporal_db
```

The restore emitted:

```text
PASS ECORIONE clean-host real project-volume restore
restore_receipt=/var/lib/ecorione-dr/restore-b27c1e5833be-1790099700511.json
source_sha=b27c1e5833be0a0fccf3f525d82ae8853cd22113
source_tag=staging-b27c1e5833be
volumes=12
```

Post-restore inventory confirmed exactly 12 project-labelled volumes and zero project containers. The application has not been started yet.

Operator note: `/var/lib/ecorione-dr` is root-controlled. A wildcard such as `sudo ls /var/lib/ecorione-dr/restore-*.json` can fail because wildcard expansion occurs in the caller's shell before `sudo`. Use the exact emitted receipt path, or run the wildcard inside a root shell.

## Restore receipt verification — PASS

Exact receipt `/var/lib/ecorione-dr/restore-b27c1e5833be-1790099700511.json` is root-owned mode 0600 and records exact source `b27c1e5833be0a0fccf3f525d82ae8853cd22113`, source tag `staging-b27c1e5833be`, Compose project `ecorione-staging`, 12 restored volumes, and independent-target retrieval evidence. Its measured data milestones are:

```text
recoveryStartedAt=2026-09-22T17:54:37.742Z
dataReadyAt=2026-09-22T17:55:00.511Z
```

Before application startup the receipt correctly recorded `applicationStarted=false` and `secretsRestored=false`; application-level recovery is proven separately by acceptance evidence below.

## Recovered application startup — PASS

The first startup attempt exposed a Docker Compose recovery-host build race: with Bake configured but buildx unavailable, several services exported the same `ecorione:staging-b27c1e5833be` tag concurrently and failed with `image ... already exists` before application containers were accepted.

PR #273 fixes the durable helper by building the shared exact-source application image once, verifying the expected image tag, and starting the topology with `up -d --no-build`. For the already active drill, the exact application checkout remained pinned to `b27c1e...`; the equivalent single-build/no-build sequence was executed without moving source identity.

Runtime startup then passed with all 15 configured services running and the recovery edge listening only on `127.0.0.1:18080`. Git remained exact and clean.

## Pre-reboot application recovery acceptance — PASS

The loopback acceptance gate passed and wrote mode-0600 receipt:

```text
acceptance_receipt=/var/lib/ecorione-dr/recovery-acceptance.json
source_sha=b27c1e5833be0a0fccf3f525d82ae8853cd22113
source_tag=staging-b27c1e5833be
serviceCount=15
restoredVolumeCount=12
semanticCanaryAccepted=true
preRebootAccepted=true
rebootPersistenceAccepted=false
edgeMode=loopback
acceptanceBaseOrigin=http://127.0.0.1:18080
acceptedAt=2026-09-23T00:42:40.366Z
```

This acceptance includes semantic owner-data canary verification, loopback security/protected-route/MCP smoke, authenticated Operations, and sanitized exact-host evidence. Public DNS/TLS remains outside this recovery proof.

## Replacement-host reboot persistence — PASS

The reboot baseline captured exact source/image identity, 15 configured/running services, 12 project volumes, Connect durable-file fingerprints, semantic canary state, and Linux boot ID `54ff4a46-1cf9-4152-a61f-0ee581a78859`.

A single-distro WSL terminate did not change the Linux boot ID, so it was rejected as insufficient evidence. A full WSL2 utility-VM shutdown/relaunch then changed the recovery-host boot ID to `b7504194-fbe6-4741-8752-506ab7aaccd7`.

Post-reboot evidence then passed with:

```text
phase=post-verified
serviceCount=15
projectVolumeCount=12
connectFingerprintsPreserved=true
projectVolumesPreserved=true
semanticCanaryVerifiedAfterReboot=true
rebootPersistenceAccepted=true
totalHostLossRecoveryCandidate=true
```

The recovered topology returned automatically, remained loopback-only on `127.0.0.1:18080`, preserved exact source/image identity, and re-passed semantic canary, MCP/protected-route smoke, authenticated Operations, and sanitized host evidence.

## Final marker-bound closure evidence — PASS

The final mode-0600 closure receipt `/var/lib/ecorione-dr/recovery-closure-evidence.json` passed all cross-checks against the selected export manifest, semantic canary, immutable loss marker, retrieval receipt, restore receipt, and final acceptance receipt.

Final measured drill values:

```text
source_sha=b27c1e5833be0a0fccf3f525d82ae8853cd22113
source_tag=staging-b27c1e5833be
restoredVolumeCount=12
serviceCount=15
failureDomainAcknowledged=true
independentRetrievalVerified=true
semanticCanaryAccepted=true
semanticCanaryVerifiedAfterReboot=true
changedBootIdProven=true
totalHostLossRecoveryCandidate=true
conservativeRpoSeconds=3147
retrievalReadyRtoSeconds=3138
dataReadyRtoSeconds=5582
applicationReadyRtoSeconds=30042
finalRecoveryRtoSeconds=71523
```

These timings describe this one drill and are not a production SLA.

## Closure boundary

At the tested boundary, **total loss of the SumoPod staging host is recoverable from the retained encrypted off-host generation** without using the lost source after the immutable loss marker. The drill proves exact-source application recovery, all 12 owner volumes, separate recovery secrets, 15-service startup, semantic owner-data continuity, protected/MCP/Ops boundaries, and changed-boot-ID persistence.

This is not evidence of independent physical-laptop or physical-disk recovery between the backup target and replacement compute: both WSL distros used for those two roles were hosted on the same Windows machine. The separately protected secret copy was also created immediately before this drill, so this run proves use of that out-of-band copy after loss declaration rather than historical long-term secret-backup independence.

Public DNS/TLS, Cloudflare/production cutover, provider/account-wide disaster recovery, and production SLA commitments remain separate boundaries.

Detailed closure evidence: [offhost-dr-runtime-closure-2026-09-23.md](offhost-dr-runtime-closure-2026-09-23.md).
