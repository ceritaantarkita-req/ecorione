# ECORIONE Release / Upgrade / Rollback Operations

Last updated: **2026-09-26**

Fase 6+ repository reproducibility gates now include immutable remote-action pin review, fixed GitHub-hosted runner-label review, exact Node/Inno toolchains, and governed container-image digest review. Normal CI runs `pnpm run actions:pin-review` and `pnpm run actions:runner-review`; release-security acceptance protects and re-executes both policies.

Node build-toolchain identity is centralized in `.node-version` and continuously checked against tracked `actions/setup-node` consumers plus the Dockerfile. Normal CI runs `pnpm run toolchain:node-review`; release-security acceptance protects and re-executes the same policy.

Windows installer compiler identity is centralized in `.inno-setup-version`. Desktop Installer reads that exact pin and installs Chocolatey `innosetup` with `--version`; normal CI runs `pnpm run toolchain:installer-review`, release-security acceptance re-executes the policy, and installer/toolchain pull requests run the Desktop Installer workflow.

Status: **release baseline CLOSED / SumoPod staging delivery VERIFIED / production promotion separate**

Current handoff: `docs/current-state-and-next-steps.md`.

At the reconciliation baseline, SumoPod staging release identity was `65bf8d2ce0b832bd12b0b279ccf9df0384a07c47` / `staging-65bf8d2ce0b8` after governed Staging Deploy #1288. A later docs-only merge may advance the exact release SHA without changing application/service/package content. CI #2258 and Product Eval #1497 passed on that exact docs-reconciled `main`. Historical release/DR SHAs remain evidence for their own dated checkpoints, not the current runtime identity.

## Install

By default the lifecycle scripts use `deploy/production.env` and Compose project `ecorione`. A non-production self-host target may override both without changing the reviewed topology:

```bash
export ECORIONE_DEPLOY_ENV=deploy/staging.env
export ECORIONE_COMPOSE_PROJECT=ecorione-staging
```

`ECORIONE_PRODUCTION_ENV` remains a compatibility fallback. SumoPod staging is verified through PCS-07..PCS-09 and the original Off-host DR host-loss drill is CLOSED / PASS at its own boundary. Use `docs/staging-continuous-deployment.md` for routine governed GitHub-to-staging delivery, `docs/sumopod-staging.md` / `docs/staging-hardening-backup-observability.md` for host procedures, `docs/offhost-dr-recovery.md` for the closed original DR runbook, and `docs/offhost-dr-physical-independence.md` for the deferred DR-2 follow-up and its safe resume boundary.

1. Run `scripts/self-host-install.sh`; first run creates the selected mode-0600 deployment env from `deploy/production.env.example` and exits.
2. Replace every `CHANGE_ME`; keep hosted provider API secrets in Connect Vault rather than deployment env plaintext.
3. Validate OAuth issuer/resource/JWKS/origins and operator credentials.
4. Run `scripts/self-host-install.sh --apply`.
5. Verify Compose/service health, HTTPS, `/ops`, `/settings`, local provider canary, and public MCP protected-resource metadata.
6. For the recommended free public edge, follow `docs/cloudflare-free-deployment.md` after the origin is healthy.

## Cloudflare Free rollout

Cloudflare does not replace the ECORIONE self-host stack. Recommended production path:

```text
Cloudflare Free DNS/TLS
  -> Cloudflare Tunnel
  -> VPS cloudflared
  -> Caddy
  -> ECORIONE services
```

Treat the edge cutover as a separate deployment operation:

1. establish a healthy origin first;
2. create/verify the named tunnel;
3. move the public hostname to the tunnel;
4. verify Ai/operator/MCP routes through the public hostname;
5. only then close direct origin web access if Tunnel-only mode is intended.

A tunnel/DNS rollback must not trigger a database restore. Edge rollback and data rollback are separate concerns.

## Upgrade

Before `scripts/self-host-upgrade.sh --apply <tag>`:

1. create and verify owner backups using the data-governance/DR procedures;
2. retain the prior image tag and deployment configuration;
3. record current provider/model mappings and relevant runtime settings;
4. validate Compose before mutation;
5. ensure the rollback path is understood.

After upgrade:

- run health and `/ops` checks;
- run local provider canary;
- run hosted canary only if the operator intentionally enables real credentials/spend;
- verify public Cloudflare/Tunnel path when used;
- verify MCP metadata/auth and negative paths;
- verify owner persistence and critical Flow behavior.

The upgrade script writes a release receipt and must fail closed when its prerequisite checks fail.

## Rollback

`scripts/self-host-rollback.sh --apply <previous-tag>` rolls runtime images back.

**Data rollback remains separate.** Restore owner data only when there is evidence that the data state itself must be restored and after validating backup manifests/digests plus owner-specific offline/online requirements.

Never blindly revert Historical Ledger or Context L0 ground truth.

For Cloudflare-only incidents:

1. restore the last known-good DNS/tunnel route;
2. reopen only the minimum origin firewall path if needed;
3. verify Caddy/application health;
4. do not restore owner databases unless a separate data incident exists.

## Release gate

A release candidate is not healthy merely because focused tests pass. The exact release head must pass the repository gates relevant to the change, including:

- Naming;
- Format;
- Lint;
- Typecheck;
- Test;
- Phase 4 real-process acceptance;
- Production Operations acceptance;
- Secret Scan;
- Dependency policy review;
- GitHub Actions pin review;
- Release security acceptance;
- Production Build;
- public MCP acceptance when the change affects that boundary.

Framework lint/build errors remain release-blocking.

The Batch 12 closure evidence is recorded in `docs/verification/batch12-closure-2026-09-10.md`. Future work must create its own evidence rather than reusing Batch 12 green runs as proof for changed code.

## Production evidence after release

Repository CI does not prove real provider or infrastructure quality. After deployment, collect:

- release/main SHA;
- deployment timestamp;
- Cloudflare Tunnel status if used;
- service health;
- real provider canary result;
- latency/error/cost metrics;
- backup verification;
- restore drill evidence when performed;
- incidents and rollback evidence.

## Failure rule

If migration, canary, recovery, public edge, or security acceptance fails, do not label the release healthy. Preserve evidence and return to the last verified image/config/data combination appropriate to the failed layer.

Do not weaken a gate, bypass Hub/Connect authority, or mutate data solely to hide an infrastructure/tunnel failure.


## Immutable container image review

Run `pnpm run images:digest-review` before release changes that touch Dockerfile or Compose definitions. Governed external images must keep a readable version tag and a full `@sha256:<64-hex>` digest. Repository-built ECORIONE images are exempt because their release identity is derived from the reviewed source/bundle artifact rather than a mutable external registry tag.
