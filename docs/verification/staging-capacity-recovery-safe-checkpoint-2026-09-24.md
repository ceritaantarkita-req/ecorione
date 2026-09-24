# ECORIONE — Staging Disk-Recovery Safe Checkpoint — 2026-09-24

Status: **SAFE STOP / STAGING CD DISABLED / PRIVATE EDGE STILL FAIL-CLOSED / HOST DISK RECOVERY REQUIRED**

## Why this checkpoint exists

After the Ai human-authentication closure was proven on SumoPod staging, the documentation-only convergence deploy exposed an operational disk-capacity failure on the staging host.

The important separation is:

- the **Ai human-authentication closure remains valid** at its tested runtime boundary;
- the new incident is a **staging deployment/disk-capacity problem**, not evidence that the private edge reopened;
- production promotion remains deferred;
- no owner-volume deletion, image pruning, system pruning, or data restore has been authorized.

## Last fully proven private-edge runtime

The last fully proven governed staging runtime remains reviewed SHA:

`b73e885d51e82716d5b29b3b31d207aae5ec95d0`

with image:

`staging-b73e885d51e8`

Governed Staging Deploy run `35967881224` passed and proved:

- unauthenticated `/` -> HTTP 302 to protected `/login`;
- `/login`, operator/settings routes, representative Project/history/Brain/Space reads, and chat/forget mutations -> HTTP 401 + Basic challenge;
- MCP protected-resource metadata -> HTTP 200;
- unauthenticated MCP -> OAuth/resource-metadata challenge;
- authenticated Operations -> healthy with no unhealthy services;
- exact-host evidence matched the reviewed SHA.

Canonical auth evidence: [ai-human-auth-closure-2026-09-24.md](ai-human-auth-closure-2026-09-24.md).

## Disk incident

A later governed deploy attempted to converge the docs-only checkpoint and failed during Docker image export/unpack with:

`no space left on device`

The failed run was Staging Deploy `35982405234`.

The deploy controller attempted runtime rollback to the known-good `b73e885d...` image. Container recreation completed and the public boundary returned ready again:

- home -> HTTP 302;
- ops -> HTTP 401.

However, the rollback Git checkout itself could not complete because the filesystem was already full. Therefore:

- the running network boundary remained fail-closed in fresh unauthenticated probes;
- the exact host-side Git checkout after that failed rollback is **not claimed clean or synchronized**;
- available host disk after the incident is **not yet re-measured from an authorized operator shell**;
- no further staging deployment should be attempted until host recovery is explicitly performed.

A second automatically queued staging attempt against merge `518555ff...` also failed before the CD stop fully took effect. Later workflow triggers for that SHA were skipped once the stop was active.

## Repository hardening completed

Two bounded repository fixes were merged after the incident.

### PR #297 — pre-build guard

Merge:

`518555ff16ebb04285b06cba20422dedcf1f53e1`

`scripts/self-host-upgrade.sh` now:

- measures free space on DockerRootDir before Compose build;
- uses a default 20 GiB free-space floor;
- when below the floor, prunes **BuildKit cache only** via `docker builder prune --all --force`;
- re-checks free space;
- refuses to build if the floor remains unmet;
- never invokes `docker system prune`, image prune, or volume prune.

This protects tagged rollback images, containers, networks, and durable owner volumes from broad cleanup.

### PR #298 — pre-fetch/pre-checkout guard

Merge:

`48cf5598d6b07c13c20941fa5f06776bde9882e4`

The same bounded BuildKit-only guard now also exists at the start of `scripts/staging-cd-root-deploy.sh`, before governed Git fetch/checkout.

This closes the repository-level gap where an already-full host might fail before reaching the pre-build guard.

PR #298 exact-head review passed:

- CI run `35985666142`;
- Product Eval run `35985665953`.

Merged main `48cf5598d6b07c13c20941fa5f06776bde9882e4` also passed:

- CI run `35986081561`;
- Product Eval run `35986081560`.

Automatic staging deployment remained disabled before this checkpoint documentation is merged.

## Critical host-side limitation

The privileged deploy helper used by the live SumoPod host is installed under `/usr/local/sbin` by the host bootstrap process.

The repository now contains the improved pre-fetch disk guard, but **repository merge alone does not replace the already-installed privileged helper on the host**.

Because the current host is already in a disk-pressure incident, the next recovery cannot safely assume that the new repository helper is active.

## Current safety state

Automatic staging deployment has been explicitly disabled:

`ECORIONE_STAGING_CD_ENABLED=0`

This is the required safe stop.

No further automatic deploy should be permitted until all host-recovery acceptance conditions below pass.

Fresh unauthenticated external probes after the incident still returned:

- `/` -> HTTP 302;
- `/login` -> HTTP 401;
- `/api/projects` -> HTTP 401;
- `/api/projects/history` -> HTTP 401;
- `/api/brain` -> HTTP 401;
- `/api/space/pages` -> HTTP 401.

These probes support the claim that the private browser/API edge remained fail-closed. They do **not** establish exact host Git identity or free-space health.

## Required next runtime sequence

The next discussion should treat this as one bounded **staging host recovery** scope. Do not resume unrelated audit fixes first.

Required sequence:

1. obtain authorized operator shell access to the SumoPod host;
2. inspect filesystem and Docker usage read-only;
3. verify current containers, image tags, Compose project, release state, Git HEAD/status, and any stale Git lock file;
4. reclaim **reproducible BuildKit cache only** as needed;
5. do not prune project volumes, active/rollback images, containers, or unrelated shared-host workloads;
6. prove adequate free space after cleanup;
7. refresh the installed privileged staging deploy helper from reviewed repository source;
8. re-run read-only staging/preflight checks;
9. revalidate the existing private edge and authenticated Operations before any new deploy;
10. only then decide whether to re-enable `ECORIONE_STAGING_CD_ENABLED=1`;
11. perform one controlled convergence deploy to current reviewed main;
12. require exact-host identity, private-edge negative paths, MCP/OAuth behavior, Operations health, and disk headroom to pass;
13. write a separate runtime-recovery closure record.

## Explicit non-claims

This checkpoint does not claim:

- the SumoPod host checkout is currently clean;
- the disk-pressure incident is already remediated;
- PR #297/#298 code is already installed in the privileged live host helper;
- current staging is synchronized to repository main;
- production readiness;
- DR-2 physical independence;
- closure of the remaining HIGH audit findings.

## Resume point

Repository safe baseline at this checkpoint:

`48cf5598d6b07c13c20941fa5f06776bde9882e4`

Automatic staging deployment:

`DISABLED`

Runtime safety posture:

**private edge externally fail-closed, exact host repository/disk state unresolved, no further deploy authorized until controlled host recovery.**
