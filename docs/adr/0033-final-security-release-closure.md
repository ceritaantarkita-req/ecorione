# ADR-33 — Final Security and Release Closure Baseline

Status: Accepted
Date: 2026-09-10

## Decision

ECORIONE's production/self-host readiness label is gated by defense-in-depth HTTP hardening, full-history + working-tree secret scans, deterministic dependency/deployment review, existing Sandbox/backup/Temporal recovery evidence, operator-only Control Center routes, conservative install/upgrade/rollback tooling, and exact-head + post-merge CI.

Runtime provider/model state and credential metadata remain Connect-owned. Credential plaintext is encrypted into the existing vault and never copied to Ai. MCP configuration remains Connect-owned and configuration changes do not grant execution authority; Hub governance and per-tool policy remain mandatory.

The readiness label means the documented self-host baseline passed repository evidence. It does not assert real hosted-provider quality, future vulnerability absence, off-host backup durability, or host/network hardening that cannot be proven in repository CI.
