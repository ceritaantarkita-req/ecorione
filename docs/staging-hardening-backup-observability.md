# ECORIONE — PCS-09 Staging Hardening, Persistence, Backup & Observability

Last updated: **2026-09-22**

Status: **PCS-09 CLOSED / PASS**

PCS-09 starts after PCS-08 GitHub-to-SumoPod continuous deployment CLOSED / PASS. It hardens and proves the real remote staging host. It does not promote ECORIONE to production. The host currently has Node.js but no pnpm; operator evidence commands therefore invoke reviewed Node/Bash entrypoints directly.

## Evidence order

1. Merge and verify the read-only PCS-09 staging inventory.
2. Deploy the reviewed PCS-09 tooling to staging through the existing governed CD path.
3. Capture a non-strict actual-host inventory before mutation.
4. Harden SSH only after a working operator public-key session is proven; keep the existing session open until a second fresh key-only login succeeds.
5. Re-run strict inventory and close remaining security blockers.
6. Capture reboot baseline evidence, then perform an operator-approved VPS reboot because unrelated SumoPod workloads share this host.
7. Verify all ECORIONE services, exact source/image identity, Docker volumes, and present Connect durable-file fingerprints after reboot.
8. Create a coordinated same-host cold backup of ECORIONE staging owner volumes and verify restoration into isolated temporary targets.
9. Verify the governed Operations surface plus host disk/memory/service evidence.
10. Only after those real-host gates pass, prepare sanitized PCS-09 closure evidence.

## Read-only staging inventory

The repository command is:

    node scripts/staging-pcs09-inventory.mjs

Strict closure mode is:

    ECORIONE_EXPECTED_SHA=<exact-deployed-sha> node scripts/staging-pcs09-inventory.mjs --strict

The inventory records only sanitized operational metadata:

- exact Git HEAD and clean-worktree state;
- configured versus running Compose services;
- Docker restart policy and accidental published host ports;
- staging Docker-volume inventory;
- Docker service enabled-at-boot state;
- UFW active state;
- effective SSH root/password/keyboard-interactive/public-key settings;
- available disk and memory;
- public home status and protected /ops status;
- size and SHA-256 only for present Connect runtime-settings, Vault-ciphertext, and spend-budget files.

It does not print deployment-env values, credential plaintext, Vault plaintext, private keys, provider responses, prompts, user data, or database contents.

## Security posture

The first inventory is expected to expose existing host hardening gaps rather than hide them. Earlier PCS evidence already observed that SSH root/password authentication remained enabled. PCS-09 must close those findings without risking lockout.

No firewall or SSH mutation is performed by the inventory script. SSH hardening and any OS package maintenance remain separate, explicitly controlled steps.

Repository SSH helper:

    bash scripts/staging-ssh-hardening.sh --check

Apply only while an existing working key-authenticated operator session remains open:

    sudo bash scripts/staging-ssh-hardening.sh --apply

The helper validates sshd syntax and effective settings before reload. After apply, a second fresh operator SSH connection must succeed before the original session is closed.

Pending Ubuntu security updates are not mixed into the same transaction as SSH hardening, reboot persistence, or backup evidence. Backup and restart recovery should be proven first, then OS maintenance can be scheduled with its own before/after health verification.

## Restart persistence boundary

PCS-09 requires an actual VPS reboot proof, not merely a process restart. The evidence must show the Linux boot identifier changed while the intended ECORIONE source/image, project volumes, service fleet, and present Connect durable-state fingerprints remain stable.

A VPS reboot is disruptive to other workloads sharing the host and therefore requires operator approval at execution time.

Baseline command shape:

    ECORIONE_EXPECTED_SHA=<exact-deployed-sha> node scripts/staging-pcs09-restart-evidence.mjs --phase baseline

After an approved full VPS reboot and reconnect:

    ECORIONE_EXPECTED_SHA=<exact-deployed-sha> node scripts/staging-pcs09-restart-evidence.mjs --phase post

The post phase refuses to pass unless Linux boot_id changed, all configured services are running, the release SHA/tag and volume inventory are preserved, present Connect durable-file fingerprints are unchanged, and public smoke + authenticated Ops + exact-host evidence all pass.

## Backup boundary

PCS-09 will create and verify a same-host staging backup before any disaster-recovery claim. The backup must not copy the Connect Vault master key, operator credentials, SSH private keys, or deployment-env secrets into Git or ordinary backup manifests.

Same-host backup is not off-host disaster recovery. A separate off-host copy to a distinct failure domain is required before total-VPS-loss recovery can be claimed.

That separate workstream is now explicitly active at checkpoint 2. Checkpoint 1 is CLOSED / PASS at the repository-foundation boundary; checkpoint 2 adds current-revision export orchestration, retained export manifests, independent re-fetch/retrieval receipts, guarded exact-volume clean-host restore, application acceptance, and replacement-host reboot evidence. See [offhost-dr-recovery.md](offhost-dr-recovery.md). No real current-revision off-host copy or total-host-loss recovery is claimed until the runtime gates in that runbook pass.

Repository backup command:

    sudo -E bash scripts/staging-pcs09-backup.sh --apply

The helper refuses a mismatched release receipt or dirty tracked worktree, estimates free-space headroom before stopping anything, stops only the ECORIONE staging Compose project, snapshots every project volume while cold, restores each archive into a temporary Docker volume, compares deterministic file-content fingerprints and counts, removes temporary verification volumes, and guarantees a staging restart attempt through an EXIT trap.

Root-only manifests are stored under /var/lib/ecorione-staging/backups. Deployment env, operator credentials, SSH private keys, and the Connect Vault master key are intentionally excluded.

## Observability boundary

The existing governed Operations surface already exposes required owner health, HTTP errors and latency, model-call/token/cost counters, MCP calls, Flow runs, ECX counters, recent distributed traces, and owner-process RSS/heap.

PCS-09 verifies those signals on the actual staging runtime. Final real-host evidence reported all nine Operations entries healthy, eight trace groups, live HTTP request counters/request-duration histograms across the eight metrics-enabled owner services, and per-owner RSS. The final strict host inventory separately reported 15/15 running services, 15.99 GiB available disk, 4261 MiB available memory, and zero blockers.

Specialized model/token/cost, MCP, Flow, and ECX metrics remain part of the governed instrumentation path, but PCS-09 does not claim non-zero values for every specialized counter in the final post-reboot/post-backup snapshot. In particular, no paid provider call is introduced solely to manufacture evidence while the staging cost-kill boundary remains in force.

Host-level disk/memory/container inventory remains operator-only. ECORIONE will not mount the Docker socket or broad host filesystem into the AI web application simply to display host metrics.

Long-term telemetry retention remains an external-scraper responsibility until a durable collector is explicitly deployed and verified.

## Closure evidence

PCS-09 closure PR #218 exact head `ece59440d742f59252046562cf3ba86e7911b46f` passed CI #1678 + Product Eval #917 and merged as `3db9e4854afbaccb9790638243fa98048c1a4f78`. Merged-main CI #1679 + Product Eval #918 passed. Automatic Staging Deploy #135/#136 passed their gates and skipped deploy because activation remained disabled.

The PCS-09 closure runtime was the independently proven exact revision `0f332c73dc7b363bffecdeecae921d805d5ae131`. A later bounded latest-main staging-convergence deployment superseded the current application identity to `52046db35e403babdda934881773c46bf2c57b68` / `staging-52046db35e40` through Staging Deploy #293. That later convergence passed public/Ops/exact-host deployment gates but did not rerun this document's full reboot or cold-backup acceptance sequence.

## Explicit non-claims

PCS-09 does not by itself prove off-host disaster recovery, point-in-time recovery, total VPS loss recovery, recovery of an out-of-band Vault master key, production SLA/SLO, public production cutover, or long-term telemetry retention.
