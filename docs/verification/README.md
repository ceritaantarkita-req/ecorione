# Verification evidence

This directory contains **dated evidence**, not current planning.

It intentionally preserves:

- closure records;
- failed attempts and defect ledgers;
- exact-head CI/runtime evidence;
- bounded benchmark measurements;
- reconciliation records.

Use [../current-state-and-next-steps.md](../current-state-and-next-steps.md) for current status and [../active-work-plan.md](../active-work-plan.md) for the current work queue. DR-2 checkpoint 2 external-target selection is currently deferred at a safe pre-selection boundary; PE/PCS/original Off-host DR implementation scopes remain closed.

Do not “clean up” a historical failure by rewriting its original result. If later work fixes the issue, record that in a later verification file and in the current-state docs.

W18 paid evidence is closed; do not rerun it merely to produce a newer dated record.

Latest bounded post-closure maintenance checkpoint: [post-closure-maintenance-checkpoint-5-2026-09-21.md](post-closure-maintenance-checkpoint-5-2026-09-21.md). The fourth checkpoint through PR #242 remains preserved in [post-closure-maintenance-checkpoint-4-2026-09-21.md](post-closure-maintenance-checkpoint-4-2026-09-21.md), the third checkpoint through PR #240 remains preserved in [post-closure-maintenance-checkpoint-3-2026-09-21.md](post-closure-maintenance-checkpoint-3-2026-09-21.md), the second checkpoint through PR #237 remains preserved in [post-closure-maintenance-checkpoint-2-2026-09-21.md](post-closure-maintenance-checkpoint-2-2026-09-21.md), and the earlier checkpoint through PR #232 remains preserved in [post-closure-maintenance-checkpoint-2026-09-21.md](post-closure-maintenance-checkpoint-2026-09-21.md). Historical repository-wide documentation audit: [repository-documentation-reconciliation-2026-09-21.md](repository-documentation-reconciliation-2026-09-21.md). Latest reconciliation: [repository-documentation-reconciliation-2026-09-23.md](repository-documentation-reconciliation-2026-09-23.md). Latest roadmap closure evidence: [pcs-10-documentation-convergence-2026-09-21.md](pcs-10-documentation-convergence-2026-09-21.md). Real-host staging evidence is recorded in [pcs-09-repository-preparation-2026-09-21.md](pcs-09-repository-preparation-2026-09-21.md). Native-Windows portability closure remains in [windows-native-portability-closure-2026-09-20.md](windows-native-portability-closure-2026-09-20.md).


Historical latest-main staging-convergence evidence: [latest-main-staging-convergence-closure-2026-09-22.md](latest-main-staging-convergence-closure-2026-09-22.md). It records governed Staging Deploy #293 / run `35627920447` PASS for exact reviewed `main` `52046db35e403babdda934881773c46bf2c57b68` / `staging-52046db35e40`. That runtime was later superseded by the governed original-DR staging runtime `b27c1e5833be0a0fccf3f525d82ae8853cd22113` / `staging-b27c1e5833be`; the older checkpoints remain historical evidence.

Latest original Off-host DR runtime closure: [offhost-dr-runtime-closure-2026-09-23.md](offhost-dr-runtime-closure-2026-09-23.md). It records total SumoPod staging-host-loss recovery PASS at the documented boundary on exact source `b27c1e5833be0a0fccf3f525d82ae8853cd22113` / `staging-b27c1e5833be`, with 12 restored volumes, 15 services, semantic canary, changed-boot-ID persistence, and final marker-bound RPO/RTO evidence.

Latest DR-2 foundation evidence: [offhost-dr2-checkpoint-1-2026-09-23.md](offhost-dr2-checkpoint-1-2026-09-23.md). Checkpoint 1 repository foundation is CLOSED / PASS; checkpoint 2 external-target selection is now deferred and no physical-independence runtime claim exists.

DR-2 checkpoint 2 safe selection package: [offhost-dr2-checkpoint-2-selection-package-2026-09-23.md](offhost-dr2-checkpoint-2-selection-package-2026-09-23.md). It prepares the operator decision and strict-SSH custody/trust boundary without selecting or mutating any external target; checkpoint 2 is now DEFERRED until an explicit operator decision resumes target selection.

DR-2 checkpoint 2 deferment: [offhost-dr2-checkpoint-2-deferment-2026-09-23.md](offhost-dr2-checkpoint-2-deferment-2026-09-23.md). The operator postponed external-target selection; local backup is the interim posture and Google Drive is only an optional future encrypted secondary copy, not a validated DR-2 target.

DR-2 safe resumable checkpoint: [offhost-dr2-safe-checkpoint-2026-09-23.md](offhost-dr2-safe-checkpoint-2026-09-23.md). It records exact repository main, merged-main gates, local-backup posture, no external mutation, and the resume sequence.

Current-main + staging parity audit: [current-main-staging-audit-2026-09-24.md](current-main-staging-audit-2026-09-24.md). It records exact product-tree parity, the CRITICAL general-Ai human-authentication gap tracked in Issue #287, HIGH reliability/security findings, product gaps, and repository-versus-runtime boundaries. Findings are non-authorizing; no deployment or runtime mutation is part of the audit.

Current-main audit safe/resumable checkpoint: [current-main-audit-safe-checkpoint-2026-09-24.md](current-main-audit-safe-checkpoint-2026-09-24.md). It records the exact audit merge, prioritized findings, no-mutation boundary, and the rule that the next discussion must select one bounded implementation scope before coding.
