# PCS-08 — GitHub-to-Staging CD Repository Preparation

Date: **2026-09-20**

Status: **REPOSITORY + HOST BOUNDARY PASS / FIRST GOVERNED DEPLOY EXERCISED / RETRY PENDING**

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

The dedicated deploy key was then tested directly from the operator workstation:

```text
interactive/no-command SSH     denied
PTY allocation                 denied
arbitrary command "whoami"     denied
forced-command exit code       126
```

Both requests returned the expected boundary message:

```text
Denied: this key may only deploy one exact 40-character reviewed SHA.
```

This proves the dedicated SSH key cannot be used for an interactive shell or an arbitrary remote command at the tested boundary. The only accepted command shape remains the forced `deploy <40-character-sha>` path.

## GitHub environment + first governed deployment evidence

The protected GitHub `staging` Environment was configured with the dedicated deploy identity, trusted known-host entry, host, and deploy user. The repository activation variable was deliberately held at `0` until the exact current `main` revision had passed its required gates.

The first controlled deployment targeted exact `main`:

```text
target SHA                    38d1bc057827ddd702d603d49bc0cad629d90c5f
workflow run                  35529468459
gate                          PASS
least-privilege SSH identity  PASS
exact reviewed deploy step    FAIL after runtime mutation
```

The target image `ecorione:staging-38d1bc057827` built successfully and the staging services were recreated. The failure occurred in post-deploy public smoke because the public home returned HTTP 502 about two seconds after all Compose services had merely reached Docker `running` state.

The orchestrator then checked out the prior known-good source revision `99523b0bb29ce11a74ec61c0e364ef5b6dd543ae` and recreated the prior `staging-99523b0` runtime. Its immediate one-shot rollback HTTP check also observed transient 502 and therefore reported rollback verification failure.

Independent host verification after the run proved the runtime had in fact recovered:

```text
HEAD                         99523b0bb29ce11a74ec61c0e364ef5b6dd543ae
active ai image              ecorione:staging-99523b0
configured/running services  15 / 15
public home                  HTTP 200 / TLS verify 0
unauthenticated /ops         HTTP 401
```

The operator workflow returned `ECORIONE_STAGING_CD_ENABLED` to `0` after the failed governed run.

This failure therefore produced useful real rollback evidence while exposing a bounded edge-readiness race in both deployment and rollback verification. It is not counted as a successful PCS-08 release.

PR #214 exact head `bd130417484edcedfd1632207d53744cc5024db1` added a bounded public-edge readiness wait without weakening the subsequent full smoke/ops/exact-host gates. It passed CI #1628 + Product Eval #867 and merged as `0b50a426ca2b14202eba769297af6c15a579b09f`. Push `main` then passed CI #1629 + Product Eval #868. Staging Deploy workflow-run gates #32/#33 passed while deployment remained skipped because activation was still disabled.

The host-installed root deploy control must be refreshed from exact reviewed merge `0b50a426ca2b14202eba769297af6c15a579b09f` before the next controlled deployment attempt.

## Pending evidence

Before PCS-08 can close:

1. refresh the host-installed root deploy control from reviewed merge `0b50a426ca2b14202eba769297af6c15a579b09f`;
2. a real current `main` SHA must deploy successfully through the GitHub workflow after both main gates pass;
3. release receipt, public smoke, ops health, and exact-host evidence must match;
4. controlled rollback evidence must be completed against the readiness-aware verifier;
5. intended current `main` must be restored after the rollback exercise.

No source-only result is sufficient to claim those remote boundaries.
