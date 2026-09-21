# ECORIONE — Off-host Backup & Disaster Recovery

Last updated: **2026-09-22**

Status: **ACTIVE / CHECKPOINT 2 — EXECUTION + CLEAN-HOST RECOVERY PATH**

This is the explicitly opened infrastructure workstream after latest-main staging convergence closed. It is **not** PE-09, PCS-11, Batch 13, production promotion, or a feature batch.

## Objective

Prove that ECORIONE can recover after loss of the entire SumoPod staging host by using a backup that exists in a separate failure domain.

Final closure requires evidence for all of the following:

1. create a fresh coordinated cold backup from the current proven staging revision;
2. convert that verified PCS-09 backup into a portable authenticated encrypted DR bundle;
3. copy the encrypted bundle plus non-secret metadata outside the SumoPod failure domain;
4. verify the remote copy checksum after transfer;
5. retrieve that copy on a clean replacement host;
6. decrypt it and restore every archived owner volume into isolated Docker volumes with deterministic content verification;
7. rebuild the application from the exact recorded Git source revision and restore required out-of-band secrets;
8. pass application health, protected-route, authenticated Operations, exact-source, persistence/restart, and final recovery checks;
9. record sanitized recovery evidence including measured RPO/RTO boundaries.

Until those gates pass, **total-host-loss recovery remains a non-claim**.

## Failure-domain model

An off-host target must not share the SumoPod host or its local disks. The repository intentionally stays provider-neutral: the transfer helper accepts a strict SSH destination such as another VPS, a NAS reachable through SSH, or a storage gateway backed by independent storage.

The operator must explicitly acknowledge that the selected destination is outside the SumoPod failure domain before transfer. The helper cannot infer provider/account/storage independence from a hostname.

## Cryptographic model

The source VPS must not hold the DR private key.

Use an RSA keypair generated outside SumoPod:

```bash
openssl genpkey \
  -algorithm RSA \
  -pkeyopt rsa_keygen_bits:3072 \
  -out ecorione-dr-private.pem
chmod 600 ecorione-dr-private.pem

openssl pkey \
  -in ecorione-dr-private.pem \
  -pubout \
  -out ecorione-dr-public.pem
```

Only `ecorione-dr-public.pem` is needed on the source host. Keep the private key in a separately recoverable operator-controlled location and do not commit either private material or recovery credentials to Git.

The bundle format uses:

- random AES-256 data key per bundle;
- AES-256-GCM authenticated encryption for backup contents;
- RSA-OAEP with SHA-256 to wrap the data key;
- backup identity bound as GCM authenticated additional data;
- SHA-256 and byte length over the final ciphertext;
- the existing PCS-09 per-volume archive hashes, deterministic tree fingerprints, and file counts inside the encrypted payload.

The JSON sidecar contains cryptographic metadata needed for decryption and integrity validation, but no private key or source-host secret.

## A. Preferred current-revision export path

Checkpoint 2 adds a guarded orchestrator so the operator does not manually stitch together backup, bundling, manifest generation, and transfer.

Required environment still uses the strict independent SSH target variables documented below. With the DR public key already available on the source host:

```bash
cd /srv/ecorione-staging
sudo -E bash scripts/staging-offhost-dr-export.sh --apply \
  /secure/path/ecorione-dr-public.pem \
  /var/lib/ecorione-staging/dr-export
```

The orchestrator:

1. locks concurrent DR export;
2. reads the root-owned staging release receipt;
3. requires exact clean Git identity;
4. creates a fresh PCS-09 cold backup;
5. requires backup SHA/tag to match the current release;
6. builds the encrypted bundle;
7. writes an export manifest with filenames/hashes;
8. transfers bundle + metadata + export manifest to the independent target;
9. writes a source-side transfer receipt only after checksum-verified transfer passes.

The older manual sequence remains useful for diagnosis, but the orchestrator is now the preferred path.

## B. Manual cold-backup component

The current proven staging application identity when this workstream opened is:

```text
source SHA  52046db35e403babdda934881773c46bf2c57b68
image       staging-52046db35e40
```

The earlier PCS-09 backup for `0f332c73...` is historical evidence only. Do not use it to claim recovery of the current application state.

On SumoPod, first run the existing reviewed cold-backup path:

```bash
cd /srv/ecorione-staging
sudo -E bash scripts/staging-pcs09-backup.sh --apply
```

Record the emitted:

```text
backup_dir=
source_sha=
source_tag=
```

The backup operation itself must PASS before continuing.

## C. Manual encrypted-bundle component

Copy only the DR public key to the source host, then run:

```bash
sudo node scripts/staging-offhost-dr-bundle.mjs \
  --backup-dir /var/lib/ecorione-staging/backups/<current-backup-run> \
  --public-key /root/ecorione-dr-public.pem \
  --output-dir /var/lib/ecorione-staging/dr-export
```

The bundler refuses malformed or symlinked input, verifies the PCS-09 manifest/checksums and every archive before encryption, refuses weak RSA keys, and refuses to overwrite an existing bundle.

Successful output is a pair:

```text
ecorione-dr-<timestamp>-<sha12>.ecdr
ecorione-dr-<timestamp>-<sha12>.json
```

Both remain mode 0600.

## D. Independent SSH transfer boundary

Prepare a dedicated SSH key and trusted `known_hosts` file outside Git. Do not learn the destination key with an untrusted `ssh-keyscan` immediately before transfer.

Example environment:

```bash
export ECORIONE_DR_SSH_TARGET='backupuser@independent-backup-host.example'
export ECORIONE_DR_SSH_DIR='/srv/backups/ecorione'
export ECORIONE_DR_SSH_IDENTITY='/root/.ssh/ecorione_dr_backup'
export ECORIONE_DR_SSH_KNOWN_HOSTS='/root/.ssh/ecorione_dr_known_hosts'
export ECORIONE_DR_FAILURE_DOMAIN_ACK=1
```

Transfer:

```bash
sudo -E bash scripts/staging-offhost-dr-transfer.sh --apply \
  /var/lib/ecorione-staging/dr-export/<bundle>.ecdr \
  /var/lib/ecorione-staging/dr-export/<bundle>.json
```

The helper uses strict host-key checking, disables forwarding, uploads temporary files first, verifies SHA-256 remotely, moves them into final names only after verification, then verifies final hashes again.

The private DR key is intentionally not transferred.

## E. Isolated verification from a clean host

A clean replacement/verification host needs Git/Node, Docker, the retrieved encrypted pair, and the out-of-band private DR key.

Pull the pinned helper image if it is not already available:

```bash
docker pull postgres:17.6-alpine@sha256:ef257d85f76e48da1c64832459b59fcaba1a4dac97bf5d7450c77753542eee94
```

Run:

```bash
node scripts/staging-offhost-dr-verify.mjs \
  --bundle /secure/recovery/<bundle>.ecdr \
  --metadata /secure/recovery/<bundle>.json \
  --private-key /secure/recovery/ecorione-dr-private.pem \
  --verify-docker
```

The verifier:

- validates ciphertext size/hash before decryption;
- authenticates AES-GCM and the recorded backup identity;
- refuses unsafe tar paths;
- verifies embedded manifests and archive hashes;
- restores each archive to a temporary Docker volume;
- recomputes the same deterministic tree fingerprint and file count from PCS-09;
- removes verification volumes in normal and failure cleanup paths.

It never restores into the live staging volume names and never uses Docker prune.


## F. Re-fetch from the independent target

After treating the source host as unavailable, the replacement host must fetch the retained generation from the independent target rather than copying it from the source VPS.

Use the exact off-host export-manifest filename:

```bash
export ECORIONE_DR_SSH_TARGET='backupuser@independent-backup-host.example'
export ECORIONE_DR_SSH_DIR='/srv/backups/ecorione'
export ECORIONE_DR_SSH_IDENTITY='/root/.ssh/ecorione_dr_backup'
export ECORIONE_DR_SSH_KNOWN_HOSTS='/root/.ssh/ecorione_dr_known_hosts'
export ECORIONE_DR_FAILURE_DOMAIN_ACK=1

sudo -E bash scripts/staging-offhost-dr-fetch.sh --apply \
  /secure/recovery \
  ecorione-dr-<timestamp>-<sha12>.receipt.env
```

The fetch helper downloads the retained export manifest first, derives the exact encrypted artifact filenames/hashes from it, fetches those artifacts, verifies hashes, and writes:

```text
ecorione-dr-<timestamp>-<sha12>.retrieval.env
```

That retrieval receipt is required by the real-volume restore gate.

## G. Guarded clean-host real-volume restore

First keep the recovery host clean: do not start the ECORIONE Compose project and do not pre-create its target volumes.

Then:

```bash
export ECORIONE_DR_RESTORE_ACK=1

sudo -E node scripts/staging-offhost-dr-restore.mjs \
  --bundle /secure/recovery/<bundle>.ecdr \
  --metadata /secure/recovery/<bundle>.json \
  --private-key /secure/recovery/ecorione-dr-private.pem \
  --retrieval-receipt /secure/recovery/<bundle>.retrieval.env
```

Before real-volume mutation the restore tool reruns the isolated Docker verifier. It then refuses any existing project container or target volume, creates the exact recorded Compose volumes with Compose labels, restores every archive, verifies tree fingerprint + file count, and removes only newly created volumes if the attempt fails.

On success it writes a mode-0600 restore receipt under `/var/lib/ecorione-dr`. At this point data is ready, but the application and secrets are not yet accepted.

Restore the required deployment env, Vault master key, operator credentials, OAuth/provider secrets, and other out-of-band configuration from their separately protected recovery source. Then check out the exact recovered source SHA and start the recorded source/image topology.

Run pre-reboot application recovery acceptance:

```bash
export ECORIONE_DEPLOY_ENV=deploy/staging.env
export ECORIONE_COMPOSE_PROJECT=ecorione-staging
export ECORIONE_COMPOSE_OVERLAY=deploy/compose.sumopod.yml
export ECORIONE_EDGE_NETWORK=inmydraft-demos_web
export ECORIONE_PUBLIC_BASE_URL=https://ecorione.inmydraft.com
export ECORIONE_OPS_CREDENTIAL_FILE=/secure/recovery/ecorione-staging-ops.txt

sudo -E node scripts/staging-offhost-dr-acceptance.mjs \
  --restore-receipt /var/lib/ecorione-dr/<restore-receipt>.json
```

The acceptance gate requires exact Git SHA, clean tracked worktree, all configured services, exact Ai image tag, restored volume presence, public smoke, authenticated Operations, and sanitized exact-host evidence. Only after those pass does it write the recovered release receipt and a pre-reboot recovery acceptance receipt.

Capture the reboot baseline:

```bash
sudo -E node scripts/staging-offhost-dr-reboot-evidence.mjs \
  --phase baseline \
  --acceptance-receipt /var/lib/ecorione-dr/recovery-acceptance.json
```

Perform one operator-controlled full replacement-host reboot, then rerun:

```bash
sudo -E node scripts/staging-offhost-dr-reboot-evidence.mjs \
  --phase post \
  --acceptance-receipt /var/lib/ecorione-dr/recovery-acceptance.json
```

The post phase requires a changed Linux boot ID plus preserved exact source/image, project-volume inventory, Connect durable-file fingerprints, public boundary, authenticated Operations, and exact-host evidence.

## H. Total-host-loss application recovery drill

The isolated archive restore above proves portable data integrity. Final DR closure additionally requires a genuinely clean replacement-host drill:

1. provision a replacement host without relying on the lost SumoPod filesystem;
2. install the required Docker/Git/Node baseline;
3. clone GitHub and check out the exact `sourceSha` embedded in the DR metadata;
4. retrieve the encrypted off-host bundle from the independent target;
5. decrypt/verify it with the out-of-band private DR key;
6. restore the archived data into the exact Compose-owned target volumes;
7. restore required secrets/configuration from their separate recovery source;
8. start the exact recorded image/source topology;
9. require all configured services running;
10. require public home health and protected `/ops`/`/settings`;
11. require authenticated Operations healthy with no required unhealthy owner service;
12. require exact-source/host evidence to match the recorded SHA;
13. perform a controlled restart/reboot and prove persistence;
14. record sanitized timestamps for recovery start, data-ready, application-ready, and final acceptance.

Only after this sequence passes may the project claim total-host-loss recovery.

## Secret-recovery boundary

The PCS-09 backup deliberately excludes secrets that should not be copied as ordinary volume backup material. A host-loss drill therefore also needs a separately protected recovery source for applicable items such as:

- Connect Vault master key;
- deployment environment secrets;
- operator credentials;
- SSH private keys;
- OAuth/provider credentials and other externally managed secrets.

Do not put these values into the DR JSON sidecar, Git, verification docs, or ordinary chat output.

## Initial retention policy

Until usage evidence justifies a different policy:

- retain at least three successful encrypted off-host generations;
- retain an additional pre-maintenance generation before risky host/storage changes;
- retain the ciphertext SHA-256 next to each generation;
- periodically perform the clean-host restore verifier rather than treating successful upload as successful recovery;
- rerun a clean-host restore after any backup-format or persistent-volume topology change.

This is an initial operational policy, not a production SLA.

## Checkpoint state

Checkpoint 1 repository foundation is CLOSED / PASS. Checkpoint 2 now extends the repository path with current-revision export orchestration, retained export manifests, independent fetch/retrieval receipts, guarded real-volume restore, application acceptance, and replacement-host reboot evidence.

Repository foundation contains:

- `scripts/staging-offhost-dr-bundle.mjs`;
- `scripts/staging-offhost-dr-transfer.sh`;
- `scripts/staging-offhost-dr-verify.mjs`;
- deterministic source-contract coverage;
- this operator runbook.

Checkpoint 2 still intentionally makes these non-claims until real infrastructure execution occurs:

- no current-revision SumoPod backup has yet been copied off-host by this workstream;
- no independent target has been recorded as configured evidence;
- no DR private key is stored in Git;
- no destructive staging mutation was performed by repository preparation;
- no clean replacement VPS has yet recovered the real SumoPod state;
- total-host-loss recovery is **NOT YET PROVEN**.

Runtime evidence must be added only after those real-host gates are actually executed.
