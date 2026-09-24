# ECORIONE — Deployment Pipeline Audit — 2026-09-24

Status: **SESSION 3 IN PROGRESS / AUDIT COMPLETE / HARDENING PR OPEN**

## Scope

This audit reviews the current GitHub -> SumoPod staging delivery path only:

- GitHub workflow gating and concurrency;
- restricted SSH transport;
- privileged host deploy helper;
- Docker build/apply behavior;
- release identity and rollback;
- disk/capacity behavior;
- runtime acceptance and documentation.

It does not authorize production cutover, DR-2 runtime work, remaining product/security findings, or unrelated feature work.

## Baseline proven before this audit

Session 2 closed with a true post-merge automatic deployment:

- reviewed main: `ce4719a7b54f716f8eb6f08602e67a592d01b519`;
- CI #1999 PASS;
- Product Eval #1238 PASS;
- automatic Staging Deploy #765 PASS;
- least-privilege SSH deploy job executed;
- private-edge smoke PASS;
- Operations healthy;
- exact-host evidence matched the reviewed SHA;
- all 15 configured services running;
- disk headroom: 21.67 GiB.

## Findings

### DP-01 — HIGH — tagged staging images were not retained automatically

The deploy path protected volumes/containers and only pruned BuildKit cache under pressure, but successful deployments left historical `ecorione:staging-*` image tags behind indefinitely.

This is the direct structural reason disk pressure could return even after Session 1 recovery. Manual cleanup repeatedly had to preserve only current + recorded rollback images.

**Hardening:** the host helper now removes only stale `ecorione:staging-*` images that are neither the recorded current/rollback images nor referenced by any container.

### DP-02 — HIGH — identical application image was built/exported once per Compose service

All application services intentionally use the same `ecorione:<tag>` image and the same root Dockerfile, but `docker compose up -d --build` requested build/export work for every buildable service.

Runtime logs showed repeated export/unpack of the same tag across RnD, Context, Connect, Hub, Artifact, Sandbox, Space, Flow, Flow Worker, Sync, MCP and Ai. This amplified deploy duration and Docker filesystem churn.

**Hardening:** build the reviewed application image once with `docker build`, then start Compose using `up -d --no-build`.

### DP-03 — HIGH — rollback verification was weaker than forward-deploy verification

Forward deployment required:

- all services running;
- public smoke;
- authenticated Operations;
- exact-host evidence.

Rollback only required running services plus a basic public boundary check. A rollback could therefore be labeled verified while internal Operations or source identity remained wrong.

**Hardening:** rollback now runs the same full `validate_deployed_revision` boundary and also stabilizes capacity.

### DP-04 — MEDIUM — release receipt, Git HEAD and active image were not required to agree before a new deploy

When a target differed from the recorded current release, the helper derived rollback SHA from current Git HEAD and rollback tag from the running Ai container independently. If host state drifted, those values could form an inconsistent rollback pair.

**Hardening:** with an existing release receipt, current SHA/tag, Git HEAD and active Ai image must agree before mutation. Recorded previous SHA/tag are also syntax-validated.

### DP-05 — MEDIUM — no steady-state post-deploy capacity target

The 20 GiB pre-build floor prevents starting an obviously unsafe build, but it did not restore headroom after a successful deployment. Session 2 ended only slightly above the floor.

**Hardening:** after successful deployment/revalidation/rollback the helper:

1. removes stale ECORIONE staging images;
2. targets 25 GiB free space by pruning BuildKit cache only when below that target;
3. requires the existing 20 GiB minimum floor to remain satisfied.

No volumes, unrelated images, networks or containers are pruned.

### DP-06 — LOW — deployment documentation remained stale after Session 2

`docs/staging-continuous-deployment.md` still described CD as disabled after the historical disk incident even though Session 2 restored it.

**Hardening:** update canonical deployment docs to the current restored state and new retention/build/rollback behavior.

### DP-07 — INFO — dual workflow_run triggers create benign gate-only runs

Staging Deploy listens to both CI and Product Eval completion. The first event often arrives before the peer gate and exits with `ready=false`; the later event performs the deploy after both are green.

This creates extra successful workflow records with deploy skipped, but it is currently intentional and safe. Removing one trigger could miss deployment when the other workflow finishes later. No code change is authorized here.

### DP-08 — MEDIUM / DEFERRED — pre-upgrade backup receipt is declarative, not an automated backup gate

`self-host-upgrade.sh` writes a receipt reminding the operator that backup verification is required, but routine governed CD does not itself prove freshness of a backup before every deployment.

PCS-09 and the off-host DR work separately prove backup/restore boundaries. Automatically cold-backing up all volumes on every staging deploy would materially change deployment latency and availability, so this audit records the gap without silently adding that behavior.

A future bounded backup-freshness policy can be discussed separately.

## Intended steady-state pipeline after this hardening

```text
merge main
 -> CI + Product Eval on exact SHA
 -> workflow_run gate
 -> restricted SSH: deploy <exact SHA>
 -> verify origin/main
 -> verify release receipt == Git HEAD == active image
 -> capacity floor
 -> preflight
 -> build one ecorione:<tag> image
 -> Compose up --no-build
 -> public/private smoke
 -> bounded Operations readiness
 -> exact-host evidence
 -> release receipt
 -> retain current + rollback images only
 -> conditional BuildKit cleanup to 25 GiB target
 -> PASS

failure after mutation
 -> checkout recorded previous SHA
 -> activate already-proven previous image --no-build
 -> full public/Ops/exact-host validation
 -> capacity stabilization
 -> workflow remains failed
```

## Runtime rollout boundary

The source hardening changes the root-owned deploy helper. Therefore:

1. PR gates may run normally while CD remains enabled because PR branches do not deploy;
2. before merge, set `ECORIONE_STAGING_CD_ENABLED=0`;
3. merge only after CI + Product Eval PASS;
4. refresh installed privileged helper from exact merged main;
5. clean stale current-host images if needed while preserving current + recorded rollback;
6. run one controlled exact-main deployment;
7. require public/Ops/exact-host/capacity PASS;
8. set `ECORIONE_STAGING_CD_ENABLED=1`;
9. require one true automatic post-merge proof;
10. close Session 3.

## Non-claims

This audit does not claim:

- production readiness;
- automated backup freshness per deployment;
- DR-2 physical independence;
- closure of remaining HIGH security findings;
- closure of Space/Project product defects.
