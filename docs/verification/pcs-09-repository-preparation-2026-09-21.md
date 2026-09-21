# PCS-09 — Staging Hardening Repository Preparation

Date: **2026-09-21**

Status: **REPOSITORY IMPLEMENTATION MERGED / REAL HOST EVIDENCE PENDING**

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

## Pending PCS-09 evidence

1. governed deployment of exact reviewed PCS-09 `main` to staging;
2. real non-strict host inventory;
3. key-only SSH hardening with fresh-session proof;
4. strict inventory PASS;
5. actual VPS reboot persistence evidence;
6. same-host verified backup and isolated restore evidence;
7. staging Operations + host resource evidence;
8. sanitized final closure.
