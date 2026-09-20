# PCS-07 — Repository Preparation Checkpoint

Date: **2026-09-20**

Status: **REPOSITORY PREPARATION PASS / REAL SUMOPOD HOST EVIDENCE PENDING**

PCS-07 remains active. This checkpoint records only repository-side readiness for the approved operator-owned SumoPod staging deployment. It does **not** claim that the actual VPS has been audited, deployed, restarted, backed up, or exposed through a production/public edge.

## Repository-side changes now merged

### PR #203 — isolated staging deployment preparation

Reviewed exact head:

```text
78f13902f30ab83f92e3c858eadf9fd800ead7de
```

Evidence:

```text
CI             #1561 PASS
Product Eval   #800 PASS
merge main     5862d461760b57a21c2622ee5a234da27b6245ce
```

Delivered:

- `deploy/*.env` is ignored so host deployment secrets are not normal Git candidates;
- `ECORIONE_DEPLOY_ENV` selects the deployment env while preserving the historical `ECORIONE_PRODUCTION_ENV` fallback;
- `ECORIONE_COMPOSE_PROJECT` isolates a staging Compose namespace such as `ecorione-staging`;
- preflight, host audit, install, upgrade, and rollback use the selected env/project consistently;
- mutating lifecycle scripts fail closed on env symlinks and non-0600 env permissions;
- the reviewed `deploy/compose.yml` topology remains the single self-host topology;
- the active SumoPod runbook requires clean reviewed source and read-only checks before mutation.

### PR #204 — sanitized real-host evidence tooling

Reviewed exact head:

```text
8eabc24c7df44e2cad36c2c53902ef71a8dd2138
```

Evidence:

```text
CI                          #1570 PASS
Product Eval                #809 PASS
Desktop Installer           #84 PASS
MCP External HTTPS          #869 PASS
merge main                  b1e003f8267cbab4c7e97bd23f81183ca18ed0ba
```

Delivered:

- `pnpm staging:host-evidence`;
- exact reviewed-SHA check through `ECORIONE_EXPECTED_SHA`;
- clean-worktree enforcement;
- env safety checks for missing/symlink/non-0600/placeholder state;
- Compose config validation;
- configured/running/non-running service-name inventory;
- staging project volume-name inventory;
- OS/kernel/architecture, Docker/Compose version, and available-disk metadata;
- optional mode-0600 sanitized evidence output;
- release-security acceptance protects the evidence tooling from silent removal/drift.

## Redaction boundary

The repository-provided host evidence collector intentionally does not capture:

- public/private IP addresses;
- environment variable values;
- API keys, passwords, internal tokens, or private keys;
- Connect Vault contents;
- provider responses;
- prompts;
- user data;
- database contents.

Sanitized output must still be reviewed before it is committed as evidence.

## PCS-07 closure conditions still pending

PCS-07 cannot close until the real SumoPod host is accessed and evidence is captured for at least:

1. reviewed Git revision and clean source state;
2. OS/kernel + Docker/Compose host inventory;
3. production preflight;
4. host-security audit with warnings reviewed rather than hidden;
5. staging env safety;
6. actual `ecorione-staging` Compose service state;
7. persistent staging volume inventory;
8. Ai/browser reachability through the selected staging access path;
9. `/ops` health at the chosen access/auth boundary;
10. one basic governed product journey that does not require a paid provider call.

PCS-09 retains restart persistence, backup/restore, HTTPS/public-edge posture, off-host DR, and durable observability evidence unless one of those becomes a blocker for the initial staging deployment.

## Current blocker

No SSH/VPS connector or repository-hosted deployment runner is currently available through the connected tool surface. GitHub repository access cannot read repository secrets and does not itself provide shell access to SumoPod.

Therefore the remaining PCS-07 work is an actual-host execution boundary, not a repository-code gap.

Do not mark PCS-07 CLOSED from repository CI alone.
