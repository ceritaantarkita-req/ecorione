# ECORIONE Release / Upgrade / Rollback Operations

## Install

1. Run `scripts/self-host-install.sh`; first run creates mode-0600 `deploy/production.env` and exits.
2. Replace every `CHANGE_ME`; keep provider API secrets in Connect Vault, not the env file.
3. Run `scripts/self-host-install.sh --apply`.
4. Verify HTTPS, `/ops`, local provider canary, and public MCP resource metadata.

## Upgrade

Before `scripts/self-host-upgrade.sh --apply <tag>`, create and verify owner backups using Batch 8 procedures and retain the prior image tag. The upgrade script validates Compose before mutation and writes a release receipt. Run health/ops/provider-canary checks after deployment.

## Rollback

`scripts/self-host-rollback.sh --apply <previous-tag>` rolls runtime images back. **Data rollback is deliberately separate**: only restore an owner backup after validating its manifest/digest and the service-specific offline/online restore requirements. Never blindly revert Historical Ledger or Context L0 immutable sources.

## Release gate

Treat the repository production build as release-blocking. Before merge or release, the exact implementation head must pass the normal repository CI, including `pnpm run build`; framework lint or production-build failures are not releasable even when focused acceptance tests are green.

## Failure rule

If migration, canary, recovery, or security acceptance fails, do not label the release healthy. Preserve evidence and return to the last verified image/data combination.
