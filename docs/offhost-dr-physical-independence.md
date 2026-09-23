# ECORIONE — DR-2 Physical Independence

Last updated: **2026-09-23**

Status: **ACTIVE / CHECKPOINT 1 CLOSED-PASS / CHECKPOINT 2 TARGET SELECTION PENDING**

Issue: #277

## Why DR-2 exists

The first real off-host DR workstream is CLOSED / PASS. It proved recovery from total loss of the tested SumoPod staging host, including independent retrieval, 12 owner-volume restore, 15-service startup, semantic canary verification, protected/MCP/Ops checks, changed Linux boot ID, and final marker-bound closure evidence.

That drill intentionally retained one caveat: the backup-target WSL distro and the replacement-host WSL distro were hosted on the same physical Windows machine. DR-2 exists only to remove that physical-host/storage-failure-domain caveat.

DR-2 does **not** rewrite Issue #266 evidence and does not downgrade the existing SumoPod host-loss recovery proof.

## Objective

Prove a stronger statement:

> A retained ECORIONE DR generation can be recovered on replacement compute whose physical failure domain is distinct from the physical/storage failure domain holding the retained backup.

The final claim must remain narrower than provider/account-wide disaster recovery unless a later drill explicitly proves those boundaries too.

## Non-goals

DR-2 does not authorize:

- production cutover;
- public DNS/TLS or Cloudflare activation;
- PE-09, PCS-11, Batch 13, or feature work;
- paid infrastructure without an explicit operator choice;
- storage of raw machine identifiers or secrets in Git;
- automatic claims of physical independence from an SSH hostname or operator label alone;
- production RPO/RTO SLA claims from one drill.

## Checkpoint plan

### Checkpoint 1 — repository foundation — CLOSED / PASS

Add provider-neutral tooling that can:

1. capture sanitized Linux host identity evidence for a `backup-target` or `replacement-host`;
2. hash `/etc/machine-id` instead of recording it raw;
3. hash the DMI/system UUID when available instead of recording it raw;
4. record a sanitized operator-defined failure-domain label;
5. write mode-0600 non-overwriting evidence receipts;
6. compare backup-target and replacement-host evidence;
7. require explicit `ECORIONE_DR_PHYSICAL_INDEPENDENCE_ACK=1`;
8. reject matching failure-domain labels;
9. reject matching machine-id fingerprints;
10. reject matching system UUID fingerprints when both are available;
11. require system UUID fingerprints when both hosts report WSL virtualization;
12. state clearly that preflight evidence is not final DR-2 recovery proof.

Checkpoint 1 is CLOSED / PASS through PR #278 / merge `4d1f4ef82839c74cc1ca8454511405a68424f0b7`. Exact-head CI #1913, Product Eval #1152, MCP External HTTPS #1011, and Desktop Installer #197 passed; merged-main CI #1914, Product Eval #1153, and MCP External HTTPS #1012 passed. Staging Deploy #591/#592 gate-passed and skipped deployment. Checkpoint 1 contacted, mutated, and provisioned no external target.

Evidence: [verification/dr2-physical-independence-checkpoint-1-2026-09-23.md](verification/dr2-physical-independence-checkpoint-1-2026-09-23.md).

### Checkpoint 2 — external target selection — PENDING OPERATOR CHOICE

The operator selects a genuinely external backup target. The target must be outside the physical host/storage failure domain of the chosen replacement recovery compute.

Existing strict SSH transport is preferred initially because the closed DR path already has:

- pinned host-key trust;
- dedicated SSH identity support;
- encrypted artifact transfer;
- remote checksum verification;
- manifest-last generation commit semantics;
- independent retrieval and retention audit tooling.

Adding object-storage transport is a separate decision and is not required merely to close physical independence.

### Checkpoint 3 — real physical-independence preflight

Capture fresh mode-0600 evidence on both real hosts:

```bash
node scripts/staging-dr2-host-evidence.mjs \
  --role backup-target \
  --failure-domain <sanitized-target-domain> \
  --output /secure/recovery/dr2-backup-target-host.json
```

and:

```bash
node scripts/staging-dr2-host-evidence.mjs \
  --role replacement-host \
  --failure-domain <sanitized-replacement-domain> \
  --output /secure/recovery/dr2-replacement-host.json
```

Only after the operator has independently confirmed that the two machines/storage domains are physically separate:

```bash
export ECORIONE_DR_PHYSICAL_INDEPENDENCE_ACK=1

node scripts/staging-dr2-physical-independence-preflight.mjs \
  --backup-target /secure/recovery/dr2-backup-target-host.json \
  --replacement-host /secure/recovery/dr2-replacement-host.json \
  --output /secure/recovery/dr2-physical-independence-preflight.json
```

The preflight must PASS before DR-2 runtime recovery work begins.

## Host-evidence privacy boundary

The evidence files may contain stable **hashes** of host identifiers. They are operational receipts and must remain mode 0600. They must not be committed to Git or pasted into ordinary public documentation.

The tooling does not collect:

- IP addresses;
- SSH private keys;
- environment secret values;
- provider tokens;
- database contents;
- raw `/etc/machine-id`;
- raw DMI/system UUID;
- user data.

## WSL-specific rule

The completed Issue #266 drill showed why distinct Linux distro names are not sufficient physical-independence evidence: two WSL distros can share one Windows physical host.

Therefore, if both DR-2 hosts report `virtualization=wsl`, preflight requires both system UUID fingerprints to be present and different in addition to different machine-id fingerprints and different failure-domain labels.

This remains a guardrail, not an automatic physical-host oracle. Explicit operator attestation is still required.

## Runtime checkpoints after preflight

After a real external target is selected and checkpoint 3 passes:

1. identify the then-current proven staging runtime SHA/tag;
2. run source and external-target readiness;
3. create a fresh semantic canary and encrypted retained generation;
4. retain enough generations to satisfy the configured retention policy;
5. declare a new immutable loss marker for the selected generation;
6. retrieve only from the physically independent target;
7. verify/decrypt on clean replacement compute;
8. restore the exact recorded owner volumes;
9. restore secrets from the separate protected secret-recovery source;
10. start the exact recorded source/image topology;
11. pass semantic canary, protected/MCP/Ops, and exact-host acceptance;
12. prove changed-boot-ID persistence;
13. produce a new final marker-bound closure receipt;
14. record measured one-drill RPO/RTO without converting them into an SLA.

The Issue #266 loss marker, generation, and closure receipt remain historical evidence and must not be reused as if they were a new DR-2 drill.

## Final DR-2 closure criteria

DR-2 may be CLOSED / PASS only when all of the following are true:

- repository checkpoint tooling is merged and green;
- backup target is physically independent from replacement compute;
- fresh target and replacement-host evidence passes the DR-2 preflight;
- a fresh current-runtime encrypted generation is retained on that target;
- clean-host independent retrieval and restore pass;
- exact source/image identity is preserved;
- semantic owner-data continuity passes before and after reboot;
- project volumes and Connect durable fingerprints survive reboot;
- final marker-bound closure evidence passes;
- docs record the exact claim boundary and remaining provider/account/secret/SLA caveats.

Until then, **DR-2 physical-independence recovery remains ACTIVE / NOT YET CLOSED**.

## Relationship to the closed DR baseline

The original Off-host Backup & DR workstream and Issue #266 remain CLOSED / PASS for total SumoPod staging-host loss at their documented boundary.

DR-2 is additive evidence. Failure or incompleteness in DR-2 must not be rewritten as failure of the already-closed SumoPod host-loss drill.
