# ECORIONE — Staging Capacity Recovery Closure — 2026-09-24

Status: **SESSION 1 CLOSED / HOST RECOVERED / PRIVATE EDGE REVALIDATED / STAGING CD STILL DISABLED**

## Scope

This closure records the bounded SumoPod staging-host recovery performed after the Docker-filesystem exhaustion incident captured in [staging-capacity-recovery-safe-checkpoint-2026-09-24.md](staging-capacity-recovery-safe-checkpoint-2026-09-24.md).

It closes only the host-capacity/recovery slice. It does not claim staging is converged to current repository main, does not re-enable automatic deployment, and does not authorize production promotion or unrelated audit work.

## Recovery actions completed

The operator entered the SumoPod staging host directly and performed the previously documented safe recovery sequence.

The dirty worktree was preserved first:

- pre-recovery status saved under `/home/ubuntu/ecorione-recovery-20260924`;
- binary worktree diff saved before reset.

Only reproducible BuildKit cache was reclaimed:

`docker builder prune --all --force`

No Docker volumes, running containers, networks, active images, rollback images, or unrelated shared-host workloads were pruned.

## Capacity result

Before recovery, the root filesystem had approximately 11 GiB available.

After BuildKit-only cleanup:

- root filesystem: 79 GiB total;
- used: 57 GiB;
- available: 20 GiB;
- usage: 75%;
- Docker Build Cache: 0 B.

This satisfies the reviewed 20 GiB staging deploy floor at the observed `df -h` boundary, although exact binary-GiB host evidence later reported 19.2 GiB available. The next convergence deploy must therefore retain the repository disk-floor guard and may still refuse to proceed if available space falls below its exact threshold.

## Repository/worktree recovery

The host worktree was restored from the failed rollback state to the actual running reviewed staging SHA:

`b73e885d51e82716d5b29b3b31d207aae5ec95d0`

The host then fetched current repository main without moving the running application checkout.

Observed source state after recovery:

- `HEAD=b73e885d51e82716d5b29b3b31d207aae5ec95d0`;
- `origin/main=6a98926351af97487ef63ec04baeef2cc26c9706`;
- detached HEAD;
- clean worktree.

This is intentional: Session 1 restores a known-good reviewed runtime and clean host source state. Convergence to current main belongs to Session 2.

## Privileged deploy helper refresh

The installed privileged host deploy helper was replaced from reviewed `origin/main` source.

Hash verification passed:

- reviewed main helper SHA-256:
  `83e69763c07ede295ba895c65ede485d8f0b946fb27b4b459fbb6021e248f4ef`;
- installed `/usr/local/sbin/ecorione-staging-deploy` SHA-256:
  `83e69763c07ede295ba895c65ede485d8f0b946fb27b4b459fbb6021e248f4ef`.

The live privileged helper therefore matches the reviewed repository version containing the pre-fetch/pre-checkout capacity guard.

## Public authentication revalidation

The existing private edge was revalidated successfully against `https://ecorione.inmydraft.com`.

PASS:

- unauthenticated `/` -> HTTP 302 to `/login`;
- `/login` -> HTTP 401 + Basic challenge;
- `/ops` -> HTTP 401 + Basic challenge;
- `/settings` -> HTTP 401 + Basic challenge;
- `/api/ops` -> HTTP 401 + Basic challenge;
- `/api/settings` -> HTTP 401 + Basic challenge;
- `/api/projects` -> HTTP 401 + Basic challenge;
- `/api/projects/history` -> HTTP 401 + Basic challenge;
- `/api/brain` -> HTTP 401 + Basic challenge;
- `/api/space/pages` -> HTTP 401 + Basic challenge;
- POST `/api/chat` -> HTTP 401 + Basic challenge;
- POST `/api/forget` -> HTTP 401 + Basic challenge;
- MCP protected-resource metadata -> HTTP 200;
- unauthenticated MCP -> HTTP 401 + resource metadata challenge.

The earlier Ai human-authentication closure therefore remains valid at the recovered staging runtime boundary.

## Operations health

Authenticated Operations revalidation passed:

- `healthy: true`;
- `serviceCount: 9`;
- `unhealthyServices: []`;
- `traceGroups: 8`.

## Exact host evidence

Sanitized staging-host evidence passed for the running reviewed SHA.

Source:

- `headSha=b73e885d51e82716d5b29b3b31d207aae5ec95d0`;
- `expectedSha=b73e885d51e82716d5b29b3b31d207aae5ec95d0`;
- `expectedShaMatched=true`;
- branch: `DETACHED`;
- `cleanWorktree=true`.

Host:

- Ubuntu 24.04.4 LTS;
- Linux 6.8.0-136-generic;
- x86_64;
- available disk reported by exact host evidence: 19.2 GiB.

Runtime:

- Docker Server 29.7.1;
- Docker Compose 5.3.1;
- Compose project `ecorione-staging`;
- all 15 configured services running;
- `nonRunningServices=[]`;
- expected staging project volumes remained present.

Deployment env remained mode 0600, non-symlinked, and free of `CHANGE_ME` placeholders.

## Current safe state

Session 1 is CLOSED.

The staging runtime is healthy and still pinned to the last fully proven application SHA:

`b73e885d51e82716d5b29b3b31d207aae5ec95d0`

The host source checkout is clean, the privileged deploy helper is current, the private edge is fail-closed, and authenticated Operations is healthy.

Automatic staging deployment remains intentionally disabled:

`ECORIONE_STAGING_CD_ENABLED=0`

Do not reinterpret Session 1 as repository-main convergence.

## Next session

**Session 2 — Restore Auto Deploy / controlled convergence**

Required sequence:

1. confirm current repository main and both required gates are green;
2. keep staging CD disabled while preflight identity/capacity checks are reviewed;
3. run one controlled deployment of exact current main;
4. require disk-floor guard to pass;
5. require all configured staging services to be running;
6. require private-edge negative paths, MCP/OAuth checks, authenticated Operations, and exact-host evidence to pass;
7. verify the host release receipt records exact current main;
8. only after the controlled convergence passes, set `ECORIONE_STAGING_CD_ENABLED=1`;
9. document restored GitHub -> governed staging auto-deploy as a separate closure.

## Explicit non-claims

This closure does not prove:

- current staging runtime equals repository main;
- automatic staging deployment is enabled;
- production readiness;
- production identity/RBAC;
- DR-2 physical independence;
- closure of remaining HIGH audit findings.

Those remain separately bounded.
