# ECORIONE — Off-host Backup & Disaster Recovery

Last updated: **2026-09-22**

Status: **ACTIVE / REPOSITORY CHECKPOINTS 1–7 CLOSED / RETENTION CLOSED / CLEAN REPLACEMENT-HOST RECOVERY IN PROGRESS**

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

## Runtime activation prerequisite

Repository checkpoints 1–7 are CLOSED / PASS. The current real staging runtime still predates those DR-tooling merges, so real DR evidence must begin with one governed deployment of the **exact current reviewed `main`** through the existing PCS-08 path. Do **not** copy newer DR scripts into the older proven checkout and call that current-revision evidence.

To activate runtime evidence:

1. temporarily enable the existing governed PCS-08 staging deployment gate;
2. manually dispatch **Staging Deploy** for the exact current reviewed `main` SHA;
3. require public smoke, authenticated Operations, exact-host evidence, and release-receipt update to pass;
4. confirm the release receipt records that exact deployed SHA/tag;
5. freeze automatic staging deployment back to disabled immediately after PASS;
6. use that release receipt as the source identity for source readiness and the fresh DR export.

The current connector can read workflow state but does not expose repository-variable mutation or workflow-dispatch actions. Do not bypass that safety boundary by editing the deployment workflow to force a run.

Any later docs-only closure merge must not silently move the runtime again. Runtime identity and repository-documentation identity remain separate evidence boundaries.

Checkpoint 3 repository implementation is CLOSED / PASS through PR #252 final head `b4986b081a0e76c660b6f09e2f2e2ef46f003d57` and merge `9e522e62212b5a4170ad4947c4bdd75c28f34464`. Exact PR-head CI #1820, Product Eval #1059, MCP #970, and Desktop Installer #160 passed; merged-main CI #1821, Product Eval #1060, and MCP #971 also passed. Staging Deploy #412/#413 gate-passed and deploy remained skipped because `ECORIONE_STAGING_CD_ENABLED` stayed disabled.

Checkpoint 3 closure bookkeeping then merged through PR #253 as `801adbc1eca847c77cba4b9bb89264ccf47cbf88` after CI #1822 + Product Eval #1061. Merged-main CI #1823 + Product Eval #1062 passed. Staging Deploy #416/#417 gate-passed and their deploy jobs remained skipped, so the proven runtime did not move.

Checkpoint 4 repository readiness guardrails are now CLOSED / PASS through PR #254 exact head `5245be4a7f0874d57b9b89e4e587aa79db90f8cf` and merge `2d0ce4f871eb828d421d87bf15b244542a661246`. Exact-head CI #1843, Product Eval #1082, MCP #991, and Desktop Installer #180 passed. Merged-main CI #1844, Product Eval #1083, and MCP #992 passed. Staging Deploy #456/#457 gate-passed and deploy remained skipped, so the SumoPod runtime still did not move.

Checkpoint 5 retained-generation audit and sanitized RPO/RTO evidence tooling is CLOSED / PASS through PR #256 exact head `7c1c8948022fc81e0c640fff7a8bcb7e4e689db3` and merge `941cb8c9ed237a5417550449c7d73e712b10ba72`. Exact-head CI #1850, Product Eval #1089, MCP #996, and Desktop Installer #184 passed. Merged-main CI #1851, Product Eval #1090, and MCP #997 passed. Staging Deploy #468/#469 gate-passed and deploy remained skipped, so the proven SumoPod runtime still did not move.

Checkpoint 6 hardens recovery-clock provenance by replacing the free-form closure `loss_declared_at` argument with an immutable mode-0600 loss-marker receipt bound to the selected retained export manifest. It is CLOSED / PASS at the repository boundary through PR #258 exact head `b8379a2c756e2e4ea3e00424c360072b6a910829` and merge `cb043b47a2c899e3c0585b06db4992fcc727c723`. Exact-head CI #1857, Product Eval #1096, MCP #1001, and Desktop Installer #188 passed. Merged-main CI #1858, Product Eval #1097, and MCP #1002 passed. Staging Deploy #480/#481 gate-passed and deploy remained skipped.

Checkpoint 7 enforces checkpoint 6's marker boundary at the actual independent-fetch step. The updated fetch path refuses to start SCP without a valid mode-0600 loss marker bound to the requested retained generation, records marker identity/hash plus retrieval-start time in the retrieval receipt, and propagates that chain through restore/acceptance/reboot/final closure. It is CLOSED / PASS at the repository boundary through PR #263 exact head `ba7ef7d6922c0177be582d5734095ed154f72622` and merge `cf8921f19a5c78db2d3d2fd075ac232983a0bbb4`. Exact-head CI #1870 and Product Eval #1109 passed. Merged-main CI #1871 and Product Eval #1110 passed. Staging Deploy #504/#505 gate-passed and deploy remained skipped.

Checkpoint 4 adds read-only runtime readiness guardrails before the first DR mutation and is CLOSED / PASS at the repository boundary. After the governed deployment of the exact current main succeeds and CD is frozen again, place **only** the RSA-3072+ DR public key on the source host and run:

```bash
export ECORIONE_DR_PUBLIC_KEY=/secure/path/ecorione-dr-public.pem
sudo -E bash scripts/staging-offhost-dr-source-readiness.sh --check
```

The readiness gate refuses private-key PEM material, non-RSA keys, and RSA keys below 3072 bits. This must PASS before creating a canary or cold backup. Record the emitted `target_min_free_kib=<N>` and keep using the same `ECORIONE_DR_PUBLIC_KEY` path for the later export.

Configure the independent SSH target, confirm the failure domain manually, then require:

```bash
export ECORIONE_DR_TARGET_MIN_FREE_KIB='<N>'
sudo -E bash scripts/staging-offhost-dr-target-readiness.sh --check
```

The target check performs no upload or remote mutation. Only after **both** readiness gates PASS may the export orchestrator below run.

The export orchestrator also **re-runs both readiness gates itself before any export-directory creation, semantic canary, cold-stop, backup, bundle, or transfer mutation**. It derives the effective target-capacity floor as the greater of the live source-derived requirement and any stricter operator-supplied `ECORIONE_DR_TARGET_MIN_FREE_KIB`. This makes the manual checks a visible operator gate while keeping the mutation path fail-closed if the environment drifts between checks and export.

The export generation includes bundle + metadata + semantic canary + export manifest. The semantic-canary file is transferred before the export manifest; the manifest remains the remote generation commit marker.

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
4. creates a small LOCAL_ONLY semantic canary through owner APIs: one Historical Ledger event, one Context episode, and one Artifact;
5. verifies that canary immediately, then creates a fresh PCS-09 cold backup;
6. requires backup SHA/tag to match the current release;
7. builds the encrypted bundle;
8. writes an export manifest with bundle/metadata/canary filenames and hashes;
9. transfers bundle + metadata + canary + export manifest to the independent target;
10. writes a source-side transfer receipt only after checksum-verified transfer passes.

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

For a **complete retained generation usable by the current fetch/recovery path**, use the preferred export orchestrator in section A. The manual bundler in section C produces only bundle + metadata and is diagnostic/building-block tooling; transferring only that pair does **not** create a complete checkpoint-7 recovery generation.

If manually exercising the transfer helper against an already prepared full generation, pass all four matching files:

```bash
sudo -E bash scripts/staging-offhost-dr-transfer.sh --apply \
  /var/lib/ecorione-staging/dr-export/<bundle>.ecdr \
  /var/lib/ecorione-staging/dr-export/<bundle>.json \
  /var/lib/ecorione-staging/dr-export/<bundle>.receipt.env \
  /var/lib/ecorione-staging/dr-export/<bundle>.canary.json
```

The helper uses strict host-key checking, disables forwarding, uploads temporary files first, verifies SHA-256 remotely, and finalizes bundle + metadata + canary before publishing the export manifest **last** as the retained-generation commit marker. Recovery treats final manifest presence as proof that every referenced artifact should already exist under its final name and hash.

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

Select the exact retained export-manifest filename and create the immutable recovery clock marker **before any fetch**:

```bash
node scripts/staging-offhost-dr-loss-marker.mjs \
  --manifest-name ecorione-dr-<timestamp>-<sha12>.receipt.env \
  --output /var/lib/ecorione-dr/recovery-loss-marker.json
```

Then use that exact manifest + marker for the independent fetch:

```bash
export ECORIONE_DR_SSH_TARGET='backupuser@independent-backup-host.example'
export ECORIONE_DR_SSH_DIR='/srv/backups/ecorione'
export ECORIONE_DR_SSH_IDENTITY='/root/.ssh/ecorione_dr_backup'
export ECORIONE_DR_SSH_KNOWN_HOSTS='/root/.ssh/ecorione_dr_known_hosts'
export ECORIONE_DR_FAILURE_DOMAIN_ACK=1

sudo -E bash scripts/staging-offhost-dr-fetch.sh --apply \
  /secure/recovery \
  ecorione-dr-<timestamp>-<sha12>.receipt.env \
  /var/lib/ecorione-dr/recovery-loss-marker.json
```

### Modern OpenSSH SCP/SFTP compatibility note

Runtime execution on 2026-09-22 exposed a compatibility defect in the earlier fetch helper. Modern OpenSSH `scp` uses SFTP by default, so wrapping the already constrained remote pathname in literal shell quote characters can cause those quote characters to be interpreted as part of the filename. The symptom is a false `No such file or directory` even though the retained artifact exists.

PR #268 fixes this by passing the constrained `${TARGET}:${REMOTE_DIR}/${name}` path directly and by failing immediately on SCP/chmod/mv failure while cleaning any partial local artifact.

If a real recovery drill has already created its immutable loss marker against an older exact application source revision, **do not move the application checkout merely to obtain this fetch compatibility fix**. Keep the application checkout pinned to the source SHA recorded by the DR metadata. Use an isolated temporary worktree at the reviewed fetch-fix merge only to execute `staging-offhost-dr-fetch.sh`, then perform verification, preflight, restore, start, acceptance, reboot evidence, and closure from the exact recorded application checkout.

This exception is for the recovery transport helper only. It must not be used to relabel a newer application checkout as exact-source recovery evidence.

The fetch helper now refuses to begin independent retrieval unless the supplied mode-0600 loss marker already exists, is valid, and binds the exact requested export-manifest filename. It records `retrieval_started_at` only after that marker check and before the first SCP.

The fetch helper then downloads the retained export manifest first, derives the exact encrypted artifact and semantic-canary filenames/hashes from it, fetches the bundle + metadata + canary, verifies all hashes, and writes:

```text
ecorione-dr-<timestamp>-<sha12>.retrieval.env
```

That retrieval receipt now carries the loss-marker filename/SHA-256/drill ID/clock source/loss time plus retrieval-start and retrieval-complete timestamps. It is required by the real-volume restore gate, which rejects unbound or impossible marker/retrieval chronology.

## G. Guarded clean-host real-volume restore

First keep the replacement host clean: do not start the ECORIONE Compose project and do not pre-create its target volumes. Restore the required deployment env/secrets file from its separately protected recovery source before preflight; it must remain mode 0600.

Use the standalone loopback recovery boundary and run the read-only preflight **before** real-volume mutation:

```bash
export ECORIONE_DEPLOY_ENV=deploy/staging.env
export ECORIONE_COMPOSE_PROJECT=ecorione-staging
export ECORIONE_COMPOSE_OVERLAY=deploy/compose.dr-recovery.yml
export ECORIONE_DR_LOOPBACK_PORT=18080
unset ECORIONE_EDGE_NETWORK

sudo -E bash scripts/staging-offhost-dr-replacement-preflight.sh --check \
  /secure/recovery/<bundle>.json \
  /secure/recovery/<bundle>.retrieval.env
```

The replacement-host preflight requires exact recovered Git identity, a clean tracked worktree, no project containers, no project-labelled volumes, a free loopback port, safe mode-0600 recovery inputs, a valid rendered Compose config, exactly one Caddy publication on `127.0.0.1:18080 -> 8080`, no public 80/443 publication, and no dependency on the historical SumoPod edge network.

Only after that PASS:

```bash
export ECORIONE_DR_RESTORE_ACK=1

sudo -E node scripts/staging-offhost-dr-restore.mjs \
  --bundle /secure/recovery/<bundle>.ecdr \
  --metadata /secure/recovery/<bundle>.json \
  --private-key /secure/recovery/ecorione-dr-private.pem \
  --retrieval-receipt /secure/recovery/<bundle>.retrieval.env \
  --canary-state /secure/recovery/<bundle>.canary.json
```

Before real-volume mutation the restore tool reruns the isolated Docker verifier. It then refuses any existing project container or target volume, creates the exact recorded Compose volumes with Compose labels, restores every archive, verifies tree fingerprint + file count, and removes only newly created volumes if the attempt fails.

On success it writes a mode-0600 restore receipt under `/var/lib/ecorione-dr`. At this point data is ready, but the application and secrets are not yet accepted.

Operational note: the recovery-state directory is root-controlled. Shell wildcard expansion occurs before `sudo`, so a command such as `sudo ls /var/lib/ecorione-dr/restore-*.json` may report no match when the unprivileged caller cannot traverse that directory. Prefer the exact `restore_receipt=` path printed by the restore tool, or perform wildcard expansion inside a root shell such as `sudo sh -c 'ls -1t /var/lib/ecorione-dr/restore-*.json'`.

Restore the required deployment env, Vault master key, operator credentials, OAuth/provider secrets, and other out-of-band configuration from their separately protected recovery source. Then check out the exact recovered source SHA.

Start the recovered topology through the guarded standalone helper rather than a hand-written Compose command:

```bash
export ECORIONE_DEPLOY_ENV=deploy/staging.env
export ECORIONE_COMPOSE_PROJECT=ecorione-staging
export ECORIONE_COMPOSE_OVERLAY=deploy/compose.dr-recovery.yml
export ECORIONE_DR_LOOPBACK_PORT=18080
export ECORIONE_DR_STANDALONE_RECOVERY=1
unset ECORIONE_EDGE_NETWORK

sudo -E bash scripts/staging-offhost-dr-start.sh --apply \
  /var/lib/ecorione-dr/<restore-receipt>.json
```

The start helper requires independent-retrieval proof, exact Git SHA, a clean tracked worktree, all restored volumes present, and no existing project containers. In standalone mode it refuses any overlay other than `deploy/compose.dr-recovery.yml` and refuses an external edge network. It sets the recorded image tag and waits for every configured service. On startup failure it removes only attempted project containers/network and preserves the restored volumes.

Runtime execution exposed a clean-host Compose build race when several services sharing one application image attempted to export the same tag concurrently while Bake/buildx was unavailable. PR #273 changes the helper to build the shared ECORIONE application image once, verify the exact source tag, then start the complete topology with `up -d --no-build`. This is recovery orchestration hardening; it does not alter application source identity or restored data.

Run pre-reboot application recovery acceptance through the loopback-only Caddy policy boundary:

```bash
export ECORIONE_DEPLOY_ENV=deploy/staging.env
export ECORIONE_COMPOSE_PROJECT=ecorione-staging
export ECORIONE_COMPOSE_OVERLAY=deploy/compose.dr-recovery.yml
export ECORIONE_DR_ACCEPTANCE_MODE=loopback
export ECORIONE_DR_LOOPBACK_BASE_URL=http://127.0.0.1:18080
export ECORIONE_DR_EXPECTED_MCP_RESOURCE=https://ecorione.inmydraft.com/mcp
export ECORIONE_OPS_CREDENTIAL_FILE=/secure/recovery/ecorione-staging-ops.txt
unset ECORIONE_EDGE_NETWORK

sudo -E node scripts/staging-offhost-dr-acceptance.mjs \
  --restore-receipt /var/lib/ecorione-dr/<restore-receipt>.json \
  --canary-state /secure/recovery/<bundle>.canary.json
```

The loopback acceptance gate requires exact Git SHA, clean tracked worktree, all configured services, exact Ai image tag, restored volume presence, the Historical Ledger + Context + Artifact semantic canary, security headers, protected `/ops`/`/settings`, the configured external MCP resource/challenge identity, authenticated Operations, and sanitized exact-host evidence. This proves the recovered application/security boundary without claiming public DNS/TLS reachability.

Capture the reboot baseline:

```bash
sudo -E node scripts/staging-offhost-dr-reboot-evidence.mjs \
  --phase baseline \
  --acceptance-receipt /var/lib/ecorione-dr/recovery-acceptance.json \
  --canary-state /secure/recovery/<bundle>.canary.json
```

Perform one operator-controlled full replacement-host reboot, then rerun:

```bash
sudo -E node scripts/staging-offhost-dr-reboot-evidence.mjs \
  --phase post \
  --acceptance-receipt /var/lib/ecorione-dr/recovery-acceptance.json \
  --canary-state /secure/recovery/<bundle>.canary.json
```

Keep the same checkpoint-3 loopback environment exported for both reboot-evidence phases. The post phase requires a changed Linux boot ID plus preserved exact source/image, project-volume inventory, Connect durable-file fingerprints, a second successful semantic-canary read, loopback Caddy/security/MCP checks, authenticated Operations, and exact-host evidence. Public DNS/TLS remains a separate gate.

## H. Total-host-loss application recovery drill

The isolated archive restore above proves portable data integrity. Final DR closure additionally requires a genuinely clean replacement-host drill:

1. provision a replacement host without relying on the lost SumoPod filesystem;
2. install the required Docker/Git/Node baseline;
3. clone GitHub and check out the exact `sourceSha` embedded in the DR metadata;
4. select the retained generation and create its immutable loss-marker receipt;
5. retrieve that generation from the independent target with the marker-required fetch path;
6. decrypt/verify it with the out-of-band private DR key;
7. restore the archived data into the exact Compose-owned target volumes;
8. restore required secrets/configuration from their separate recovery source;
9. start the exact recorded image/source topology;
10. require all configured services running;
11. require the loopback-only Caddy boundary healthy with security headers and protected `/ops`/`/settings`;
12. require the configured MCP resource/challenge identity to remain unchanged;
13. require the semantic Ledger/Context/Artifact canary to be readable with exact identity/digests;
14. require authenticated Operations healthy with no required unhealthy owner service;
15. require exact-source/host evidence to match the recorded SHA;
16. perform a full replacement-host reboot and repeat semantic/edge/Ops/host evidence with a changed boot ID;
17. record sanitized timestamps for recovery start, data-ready, application-ready, and final acceptance;
18. generate the final timing receipt cross-bound to the marker/retrieval/restore/acceptance chain.

After the retained generation is selected and **before independent fetch**, create the immutable recovery clock marker:

```bash
node scripts/staging-offhost-dr-loss-marker.mjs \
  --manifest-name ecorione-dr-<timestamp>-<sha12>.receipt.env \
  --output /var/lib/ecorione-dr/recovery-loss-marker.json
```

The marker records current recovery-host UTC time internally, generates a drill UUID, binds the exact selected export-manifest filename, writes mode 0600 with exclusive-create semantics, and refuses overwrite. It does not accept a user-supplied timestamp.

After post-reboot acceptance has mutated the acceptance receipt into final candidate state:

```bash
node scripts/staging-offhost-dr-closure-evidence.mjs \
  --export-manifest /secure/recovery/<bundle>.receipt.env \
  --canary-state /secure/recovery/<bundle>.canary.json \
  --retrieval-receipt /secure/recovery/<bundle>.retrieval.env \
  --restore-receipt /var/lib/ecorione-dr/<restore-receipt>.json \
  --acceptance-receipt /var/lib/ecorione-dr/recovery-acceptance.json \
  --loss-marker /var/lib/ecorione-dr/recovery-loss-marker.json \
  --output /var/lib/ecorione-dr/recovery-closure-evidence.json
```

The closure tool binds the selected manifest and measured timeline to that immutable loss marker. Conservative RPO uses the semantic-canary creation timestamp as the pre-backup boundary; RTO milestones cover independent retrieval, data-ready, application-ready, and final changed-boot-ID acceptance. These measurements describe one drill and are not a production SLA.

Public DNS, public TLS issuance/renewal, Cloudflare and production promotion remain separate from this host-loss recovery proof.

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

Checkpoint 5 adds a read-only remote audit for this policy:

```bash
export ECORIONE_DR_RETENTION_MIN_GENERATIONS=3
sudo -E bash scripts/staging-offhost-dr-target-audit.sh --report
sudo -E bash scripts/staging-offhost-dr-target-audit.sh --check
```

`--report` inventories every retained generation commit marker, requires mode-0600 manifests/artifacts, validates filenames/stems and remote SHA-256 values, reports complete/incomplete generation counts and latest source identity, but does not fail solely because fewer than three complete generations exist.

`--check` additionally fails if any retained generation is incomplete/corrupt or if complete generations are below the configured minimum. The audit is read-only: no upload, mkdir, rename, or deletion is performed on the independent target.

## Checkpoint state

Checkpoints 1–7 are CLOSED / PASS at repository boundaries, and the real runtime total-SumoPod-host-loss drill is now CLOSED / PASS at the documented boundary.

Repository foundation contains:

- `scripts/staging-offhost-dr-bundle.mjs`;
- `scripts/staging-offhost-dr-transfer.sh`;
- `scripts/staging-offhost-dr-verify.mjs`;
- deterministic source-contract coverage;
- this operator runbook.

Repository checkpoints 1–7 are now followed by real runtime execution evidence. As of the 2026-09-22 runtime checkpoint:

- exact source `b27c1e5833be0a0fccf3f525d82ae8853cd22113` / `staging-b27c1e5833be` has three complete encrypted retained generations on the independent target;
- the corrected target audit reports `complete_generations=3`, `incomplete_generations=0`, and `retention_ready=1`;
- a clean replacement WSL2 distro exists with exact-source checkout, native Docker/Compose, Node/Git, the required helper image, dedicated strict SSH retrieval credentials, the out-of-band RSA private key, and separately recovered mode-0600 deployment/operator inputs;
- generation `ecorione-dr-20260922152938-b27c1e5833be.receipt.env` has an immutable loss marker created at `2026-09-22T16:21:58.074Z`;
- the first marker-bound fetch exposed the SCP/SFTP quoting defect described in section F; independent inventory plus direct strict-SCP proved the retained generation is intact, and PR #268 merged the transport fix;
- no DR private key or recovery secret value is stored in Git or in this documentation.

Real runtime execution passed independent retrieval, isolated decrypt/content verification, clean-host preflight, guarded real-volume restore, exact-source loopback startup, semantic-canary/application acceptance, authenticated Operations, exact-host evidence, changed-boot-ID reboot persistence, and final marker-bound RPO/RTO closure evidence. For the tested exact source/generation, total loss of the SumoPod staging host is therefore **PROVEN RECOVERABLE at this runbook boundary**. This does not claim physical-machine/disk independence because the backup-target and recovery WSL distros were hosted on the same Windows machine, and it does not turn one-drill RPO/RTO measurements into an SLA.

Runtime evidence: [verification/offhost-dr-runtime-checkpoint-2026-09-22.md](verification/offhost-dr-runtime-checkpoint-2026-09-22.md).
