# ECORIONE — SumoPod Remote Staging Runbook

Last updated: **2026-09-21**

Status: **REMOTE STAGING VERIFIED / PCS-07..PCS-09 CLOSED / PASS / NOT PRODUCTION**

This runbook covers the first operator-owned SumoPod Ubuntu staging deployment. It does **not** authorize or claim production cutover.

## Boundary

The target operating model is:

```text
reviewed GitHub main
        |
        v
operator-owned SumoPod Ubuntu host
        |
        v
ECORIONE self-host Compose project: ecorione-staging
        |
        v
persistent owner volumes + Temporal
```

GitHub `main` remains source of truth. Do not make arbitrary live-VPS source edits and then treat the host as canonical development state.

PCS-07 proved the initial remote staging deployment and basic runtime reachability. PCS-08 later closed governed GitHub-to-staging continuous deployment, and PCS-09 closed HTTPS/operator protection, key-only SSH hardening, restart persistence, same-host verified backup/restore evidence, and staging observability. Those later closures do not promote staging to production.

## Secret and host rules

Never commit or record in repository docs:

- VPS password or private SSH key;
- public/private host IP when it is operator-sensitive;
- provider API keys;
- Connect Vault master key;
- internal service tokens;
- Temporal database password;
- OAuth/MCP handle secrets;
- deployment tokens.

Provider credentials belong in Connect Vault after the runtime is available. Deployment secrets stay in the mode-0600 host env file or another approved host-side secret mechanism.

The repository now ignores `deploy/*.env`.

## Staging isolation

Use a staging-specific env file and Compose project name:

```bash
export ECORIONE_DEPLOY_ENV=deploy/staging.env
export ECORIONE_COMPOSE_PROJECT=ecorione-staging
export ECORIONE_COMPOSE_OVERLAY=deploy/compose.sumopod.yml
export ECORIONE_EDGE_NETWORK=inmydraft-demos_web
export ECORIONE_TRAEFIK_CERTRESOLVER=letsencrypt
```

The historical `ECORIONE_PRODUCTION_ENV` variable remains supported for compatibility, but new staging work should use `ECORIONE_DEPLOY_ENV`.

All lifecycle scripts use the same variables:

- `scripts/production-preflight.sh`;
- `scripts/host-security-audit.sh`;
- `scripts/self-host-install.sh`;
- `scripts/self-host-upgrade.sh`;
- `scripts/self-host-rollback.sh`.

This keeps staging volumes/network/container names isolated from a future production Compose project on the same host.

### Existing SumoPod Traefik edge

The audited SumoPod host already has an operator-owned Traefik instance bound to public ports 80/443. ECORIONE staging must not compete for those host ports.

The reviewed `deploy/compose.sumopod.yml` overlay therefore:

- resets the baseline Caddy host port publications;
- keeps Caddy as ECORIONE's internal routing/policy boundary on port 8080;
- attaches only that Caddy service to the existing Traefik edge network;
- lets Traefik terminate public TLS and route the ECORIONE hostname to internal Caddy;
- preserves the existing Caddy basic-auth boundary for `/ops`, `/api/ops`, `/settings`, and `/api/settings`;
- does not mount the Docker socket into any ECORIONE container.

On the currently audited host, the existing Traefik network is `inmydraft-demos_web`. Re-verify the network name with `docker inspect traefik` before using this value on a rebuilt or different host.

Keep `ECORIONE_OPS_PASSWORD_HASH` single-quoted in the deployment env file. Caddy bcrypt hashes contain `# ECORIONE — SumoPod Remote Staging Runbook

Last updated: **2026-09-21**

Status: **REMOTE STAGING VERIFIED / PCS-07..PCS-09 CLOSED / PASS / NOT PRODUCTION**

This runbook covers the first operator-owned SumoPod Ubuntu staging deployment. It does **not** authorize or claim production cutover.

## Boundary

The target operating model is:

```text
reviewed GitHub main
        |
        v
operator-owned SumoPod Ubuntu host
        |
        v
ECORIONE self-host Compose project: ecorione-staging
        |
        v
persistent owner volumes + Temporal
```

GitHub `main` remains source of truth. Do not make arbitrary live-VPS source edits and then treat the host as canonical development state.

PCS-07 proved the initial remote staging deployment and basic runtime reachability. PCS-08 later closed governed GitHub-to-staging continuous deployment, and PCS-09 closed HTTPS/operator protection, key-only SSH hardening, restart persistence, same-host verified backup/restore evidence, and staging observability. Those later closures do not promote staging to production.

## Secret and host rules

Never commit or record in repository docs:

- VPS password or private SSH key;
- public/private host IP when it is operator-sensitive;
- provider API keys;
- Connect Vault master key;
- internal service tokens;
- Temporal database password;
- OAuth/MCP handle secrets;
- deployment tokens.

Provider credentials belong in Connect Vault after the runtime is available. Deployment secrets stay in the mode-0600 host env file or another approved host-side secret mechanism.

The repository now ignores `deploy/*.env`.

## Staging isolation

Use a staging-specific env file and Compose project name:

```bash
export ECORIONE_DEPLOY_ENV=deploy/staging.env
export ECORIONE_COMPOSE_PROJECT=ecorione-staging
export ECORIONE_COMPOSE_OVERLAY=deploy/compose.sumopod.yml
export ECORIONE_EDGE_NETWORK=inmydraft-demos_web
export ECORIONE_TRAEFIK_CERTRESOLVER=letsencrypt
```

The historical `ECORIONE_PRODUCTION_ENV` variable remains supported for compatibility, but new staging work should use `ECORIONE_DEPLOY_ENV`.

All lifecycle scripts use the same variables:

- `scripts/production-preflight.sh`;
- `scripts/host-security-audit.sh`;
- `scripts/self-host-install.sh`;
- `scripts/self-host-upgrade.sh`;
- `scripts/self-host-rollback.sh`.

This keeps staging volumes/network/container names isolated from a future production Compose project on the same host.

### Existing SumoPod Traefik edge

The audited SumoPod host already has an operator-owned Traefik instance bound to public ports 80/443. ECORIONE staging must not compete for those host ports.

The reviewed `deploy/compose.sumopod.yml` overlay therefore:

- resets the baseline Caddy host port publications;
- keeps Caddy as ECORIONE's internal routing/policy boundary on port 8080;
- attaches only that Caddy service to the existing Traefik edge network;
- lets Traefik terminate public TLS and route the ECORIONE hostname to internal Caddy;
- preserves the existing Caddy basic-auth boundary for `/ops`, `/api/ops`, `/settings`, and `/api/settings`;
- does not mount the Docker socket into any ECORIONE container.

On the currently audited host, the existing Traefik network is `inmydraft-demos_web`. Re-verify the network name with `docker inspect traefik` before using this value on a rebuilt or different host.

 characters, and unquoted values can be interpreted by Docker Compose as variable interpolation.

## Phase A — verify reviewed source

On SumoPod, clone or synchronize the reviewed repository. Do not deploy a dirty working tree.

```bash
git status --short
git branch --show-current
git rev-parse HEAD
git remote -v
```

Required state before mutation:

- intended reviewed `main`;
- clean worktree;
- origin points to the intended ECORIONE repository;
- exact commit recorded in staging evidence.

## Phase B — prepare host-only staging env

With the staging variables exported:

```bash
scripts/self-host-install.sh
```

If `deploy/staging.env` does not exist, the script copies the reviewed `deploy/production.env.example` topology template to that host-only path, sets mode 0600, and exits without starting containers.

Replace every `CHANGE_ME` value on the host. Do not paste secrets into Git, issues, PRs, or committed evidence.

For the first staging deployment:

- use the same reviewed owner-volume topology as self-host production baseline;
- hosted AI can be configured after startup through Connect Vault;
- Local AI may remain unavailable;
- Cloudflare Tunnel is optional and not required by PCS-07;
- do not expose internal service ports directly.

## Phase C — read-only checks before mutation

Run:

```bash
ECORIONE_DEPLOY_ENV=deploy/staging.env \
ECORIONE_COMPOSE_PROJECT=ecorione-staging \
ECORIONE_COMPOSE_OVERLAY=deploy/compose.sumopod.yml \
bash scripts/production-preflight.sh

ECORIONE_DEPLOY_ENV=deploy/staging.env \
bash scripts/host-security-audit.sh
```

Review all host-audit warnings. Do not call warnings PASS merely because strict mode was not requested.

Stop before deployment if:

- the source tree is dirty or not the reviewed commit;
- Docker/Compose is missing or unavailable;
- the env file is missing, a symlink, contains placeholders, or is not mode 600;
- Compose validation fails;
- disk is below the preflight floor;
- port 80/443 ownership conflicts with an unexplained workload, or the existing edge is not the reviewed Traefik deployment;
- host firewall/SSH posture is not understood;
- system time is not trustworthy.

## Phase D — start staging

Only after Phase C is reviewed:

```bash
ECORIONE_DEPLOY_ENV=deploy/staging.env \
ECORIONE_COMPOSE_PROJECT=ecorione-staging \
scripts/self-host-install.sh --apply
```

Then inspect the exact staging project:

```bash
docker compose \
  -p ecorione-staging \
  --env-file deploy/staging.env \
  -f deploy/compose.yml \
  ps
```

Do not expose individual RnD, Context, Connect, Hub, Artifact, Sandbox, Space, Flow, Sync, Temporal, or MCP-internal ports to the public Internet. On this shared SumoPod host, public 80/443 remain owned exclusively by the existing Traefik edge; ECORIONE Caddy stays internal on port 8080.

## Phase E — minimum PCS-07 staging evidence

After the stack is running, capture the repository-provided sanitized host/runtime inventory against the exact reviewed revision:

```bash
ECORIONE_DEPLOY_ENV=deploy/staging.env \
ECORIONE_COMPOSE_PROJECT=ecorione-staging \
ECORIONE_EXPECTED_SHA=<reviewed-main-sha> \
node scripts/staging-host-evidence.mjs
```

Optionally write the sanitized JSON to a mode-0600 host file:

```bash
ECORIONE_DEPLOY_ENV=deploy/staging.env \
ECORIONE_COMPOSE_PROJECT=ecorione-staging \
ECORIONE_EXPECTED_SHA=<reviewed-main-sha> \
ECORIONE_STAGING_EVIDENCE_OUT=data/pcs07-host-evidence.json \
node scripts/staging-host-evidence.mjs
```

The collector records only:

- exact deployed Git commit, branch/detached state, and clean-worktree status;
- host OS/kernel/architecture and available disk;
- Docker server + Compose versions;
- selected Compose project;
- configured/running/non-running service names;
- staging project volume names;
- deployment-env relative path plus safe mode/symlink/placeholder state.

It fails if the Git tree is dirty, `ECORIONE_EXPECTED_SHA` does not match, the env is unsafe, any configured service is not running, or no project volumes exist.

The collector intentionally does **not** capture IP addresses, env values, credentials/tokens, private keys, Vault contents, provider responses, prompts, user data, or database content. Review even sanitized output before committing it.

Separately capture/review:

- production preflight result;
- host-audit result and every warning;
- Ai/browser reachability through the chosen staging access path;
- `/ops` health at the chosen authenticated/access boundary;
- one basic governed product journey that does not require a paid provider call.

The host-evidence collector does not replace those checks and does not prove HTTPS/public-edge security, provider quality, persistence across restart, backup/restore, off-host DR, or durable observability.

Do not commit raw env, tokens, IPs, passwords, private keys, Vault contents, or user data.

## Upgrade

Before staging upgrade, record the currently deployed revision and verify the relevant owner backup boundary when data matters.

```bash
ECORIONE_DEPLOY_ENV=deploy/staging.env \
ECORIONE_COMPOSE_PROJECT=ecorione-staging \
scripts/self-host-upgrade.sh --apply <reviewed-tag>
```

PCS-08 closed GitHub-to-staging continuous deployment. Routine staging upgrades should use the governed workflow in [staging-continuous-deployment.md](staging-continuous-deployment.md); do not replace it with a blind polling `git pull` loop.

## Runtime rollback

```bash
ECORIONE_DEPLOY_ENV=deploy/staging.env \
ECORIONE_COMPOSE_PROJECT=ecorione-staging \
scripts/self-host-rollback.sh --apply <previous-reviewed-tag>
```

Runtime rollback does not imply data rollback. Owner data restore remains a separate evidence-driven action.

## Current evidence status

PCS-07 initial host evidence is CLOSED / PASS: [verification/pcs-07-sumopod-host-closure-2026-09-20.md](verification/pcs-07-sumopod-host-closure-2026-09-20.md).

PCS-08 governed continuous deployment is CLOSED / PASS, including exact-current-main gating, least-privilege forced-command SSH deployment, health/evidence gates, and exercised runtime rollback/restore.

PCS-09 staging hardening is CLOSED / PASS. The current proven application runtime is exact reviewed revision `0f332c73dc7b363bffecdeecae921d805d5ae131` / image `staging-0f332c73dc7b`. Real-host evidence includes key-only SSH hardening with fresh-session proof, strict zero-blocker inventory, a real full-VPS reboot with source/image/service/volume preservation, a verified same-host cold backup for all 12 project volumes with isolated restore-content checks, and final credentialed Operations + host-resource evidence. Evidence: [verification/pcs-09-repository-preparation-2026-09-21.md](verification/pcs-09-repository-preparation-2026-09-21.md).

Later documentation-only merges intentionally left automatic staging deployment disabled, so they did not replace that proven runtime. Public production promotion remains a separate explicit decision.
