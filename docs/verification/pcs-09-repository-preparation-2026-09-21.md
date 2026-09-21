# PCS-09 — Staging Hardening Repository Preparation

Date: **2026-09-21**

Status: **REPOSITORY PREPARATION / REAL HOST EVIDENCE PENDING**

## Starting boundary

PCS-08 is CLOSED / PASS. The docs-only PCS-08 closure merged to main as f0aa9ca97518e3b7e57fc6bc7a58e0ed7761ba05 with automatic staging deployment disabled, leaving the proven runtime on application revision 0b50a426ca2b14202eba769297af6c15a579b09f.

PCS-09 begins from that controlled boundary and must not silently convert staging into production.

## Repository preparation

This branch adds a sanitized actual-host inventory script plus deterministic source-contract coverage and wires the inventory into package scripts and Product Eval.

The inventory checks:

- source identity and clean worktree;
- staging env file safety without reading secret values;
- configured/running services and project volumes;
- container restart policy and published-port exposure;
- Docker enabled-at-boot state;
- UFW and effective SSH authentication posture;
- host disk and memory availability;
- public home and protected /ops behavior;
- size/SHA-256 fingerprints only for present Connect durable files.

## Expected first-host result

The first non-strict run may legitimately report SSH hardening blockers. That is baseline evidence, not a reason to weaken the checks.

## Pending PCS-09 evidence

1. exact-head CI + Product Eval for this repository preparation;
2. governed deployment of reviewed PCS-09 tooling to staging;
3. real non-strict host inventory;
4. key-only SSH hardening with fresh-session proof;
5. strict inventory PASS;
6. actual VPS reboot persistence evidence;
7. same-host verified backup and isolated restore evidence;
8. staging Operations + host resource evidence;
9. sanitized final closure.
