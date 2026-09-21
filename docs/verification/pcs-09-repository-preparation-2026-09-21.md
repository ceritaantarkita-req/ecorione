# PCS-09 — Staging Hardening Repository Preparation

Date: **2026-09-21**

Status: **REPOSITORY IMPLEMENTATION MERGED / REAL HOST BASELINE CAPTURED / HARDENING PENDING**

## Starting boundary

PCS-08 is CLOSED / PASS. The docs-only PCS-08 closure merged to main as f0aa9ca97518e3b7e57fc6bc7a58e0ed7761ba05 with automatic staging deployment disabled, leaving the proven runtime on application revision 0b50a426ca2b14202eba769297af6c15a579b09f.

PCS-09 begins from that controlled boundary and must not silently convert staging into production.

## Repository preparation

This branch adds a sanitized actual-host inventory, an actual-VPS reboot baseline/post verifier, a guarded SSH hardening helper, a coordinated same-host cold volume backup with isolated content verification, deterministic source-contract coverage, package scripts, Product Eval coverage, and the PCS-09 operator runbook.

The inventory checks:

- source identity and clean worktree;
- staging env file safety without reading secret values;
- configured/running services and project volumes;
- container restart policy and published-port exposure;
- Docker enabled-at-boot state;
- UFW and effective SSH authentication posture;
- host disk and memory availability;
- public home and protected /ops behavior;
- size/SHA-256 fingerprints only for present Connect durable files;
- real Linux boot-id change across reboot evidence;
- exact release SHA/tag and Docker volume preservation across reboot;
- present Connect durable-file fingerprint preservation across reboot;
- SSH key-only/root-login hardening with sshd syntax/effective-setting checks;
- same-host cold backup of every staging Compose volume;
- isolated temporary-volume content verification for each backup archive;
- guaranteed staging restart attempt after the backup window.

## Expected first-host result

The first non-strict run may legitimately report SSH hardening blockers. That is baseline evidence, not a reason to weaken the checks.

## Repository merge evidence

PR #216 exact head `0bf1414859d4bf573f1ebc46ad6286b125ca1f38` passed CI #1664 and Product Eval #903, then squash-merged to `main` as `acd050139f8d5db0dcdadeb8c072ab6432100f0f`.

The exact merged `main` revision then passed:

- CI #1665;
- Product Eval #904;
- MCP External HTTPS Acceptance #894.

Automatic Staging Deploy workflow-run gates #106 and #107 completed successfully while the deployment job remained skipped because the repository activation variable stayed disabled. Therefore the PCS-09 repository merge did not mutate the proven staging runtime.

## Governed PCS-09 staging deployment

Controlled Staging Deploy run `35563423107` PASSed against exact reviewed `main` `0f332c73dc7b363bffecdeecae921d805d5ae131`.

Observed from the governed deploy path:

- gate PASS;
- dedicated least-privilege SSH identity PASS;
- image `ecorione:staging-0f332c73dc7b` built and applied;
- public edge became ready on attempt 4 after three transient home HTTP 502 responses;
- full public smoke PASS;
- authenticated Ops snapshot `healthy=true`, no unhealthy required services;
- exact-host evidence matched the target SHA;
- 15/15 configured services running;
- clean detached worktree;
- activation returned to `0` after the controlled deployment.

## Real-host baseline inventory

The first non-strict PCS-09 inventory ran on the actual SumoPod staging host at `2026-09-21T05:26:26.560Z`.

PASS / healthy observations:

- exact source SHA `0f332c73dc7b363bffecdeecae921d805d5ae131`;
- clean worktree;
- deployment env mode 600;
- 15 configured / 15 running services;
- every ECORIONE staging container uses `restart=unless-stopped`;
- no ECORIONE staging container publishes a host port;
- Docker is enabled at boot;
- UFW active;
- unattended-upgrades enabled;
- available disk 16.02 GiB;
- available memory 4331.6 MiB;
- public home HTTP 200;
- unauthenticated `/ops` HTTP 401.

Expected hardening blockers:

```text
SSH password authentication is not disabled
SSH root login is not restricted
```

Effective SSH baseline:

```text
PermitRootLogin yes
PasswordAuthentication yes
KbdInteractiveAuthentication no
PubkeyAuthentication yes
```

Connect durable runtime settings, Vault ciphertext, and spend-budget files were absent in this staging state. The inventory records absence only; it does not fabricate persistence evidence for data that does not exist.

The failed first operator command using `pnpm staging:pcs09:inventory` also proved the host does not have pnpm installed. The actual inventory was therefore run directly with Node. Host-side runbook commands are updated accordingly rather than installing another package manager merely for evidence collection.

## SSH hardening apply evidence

The guarded SSH hardening helper was executed from an already-working operator key-authenticated session while that session remained open.

Effective settings before apply:

```text
permitrootlogin yes
pubkeyauthentication yes
passwordauthentication yes
kbdinteractiveauthentication no
permitemptypasswords no
```

The apply step returned:

```text
PASS PCS-09 SSH hardening applied.
IMPORTANT: keep this session open and prove a NEW operator public-key SSH session before closing it.
```

Effective settings immediately after reload:

```text
permitrootlogin no
pubkeyauthentication yes
passwordauthentication no
kbdinteractiveauthentication no
permitemptypasswords no
```

A second fresh Windows PowerShell SSH session then connected successfully as `ubuntu` using the existing operator key after the hardened daemon settings were active. Inside that fresh session:

```text
whoami
ubuntu

sudo -n true
SUDO PASS
```

The original pre-hardening session was intentionally kept open until this proof succeeded. The fresh-session result closes the SSH lockout-safety gate and the PCS-09 key-only operator-access hardening boundary.

## Strict host inventory PASS

The strict PCS-09 inventory then ran on the hardened real host at `2026-09-21T05:34:35.690Z` and returned:

```text
blockers=[]
closureReady=true
PASS PCS-09 staging inventory
```

Strict evidence confirmed:

- exact source SHA `0f332c73dc7b363bffecdeecae921d805d5ae131`;
- clean worktree;
- deployment env mode 600;
- 15/15 configured services running;
- every staging container uses `restart=unless-stopped`;
- no ECORIONE staging container publishes host ports;
- Docker enabled at boot;
- UFW active;
- effective SSH: root login disabled, password auth disabled, keyboard-interactive disabled, public-key auth enabled;
- unattended-upgrades enabled;
- available disk 16.02 GiB;
- available memory 4304.4 MiB;
- public home HTTP 200;
- unauthenticated `/ops` HTTP 401.

The two Connect warnings remain informational because runtime settings and Vault ciphertext are absent in this staging state; PCS-09 makes no persistence claim for absent files.

## VPS reboot baseline captured

The pre-reboot PCS-09 persistence baseline was captured from the real staging host:

```text
statePath     /srv/ecorione-staging/.ecorione/evidence/pcs09-vps-restart-state.json
bootId        38133aa8-fcd7-41b5-8729-4c6dabb0206a
headSha       0f332c73dc7b363bffecdeecae921d805d5ae131
currentTag    staging-0f332c73dc7b
serviceCount  15
```

Connect runtime settings, Vault ciphertext, and spend-budget fingerprints remained `present=false`, consistent with the earlier host inventories.

The baseline PASS proves the before-state only. PCS-09 does not claim reboot persistence until a real VPS reboot changes Linux `boot_id` and the post phase verifies release/source identity, service fleet, volume inventory, present Connect fingerprints, public smoke, authenticated Ops, and exact-host evidence.

## Pending PCS-09 evidence

1. host-wide pre-reboot restart-policy inventory for unrelated shared-VPS workloads;
2. operator-approved full VPS reboot;
3. PCS-09 post-reboot persistence verification;
4. same-host verified backup and isolated restore evidence;
5. staging Operations + host resource evidence;
6. sanitized final closure.
