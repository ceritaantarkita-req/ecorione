# ADR-33 — Final Security and Release Closure Baseline

Status: Accepted
Date: 2026-09-10

## Decision

ECORIONE's production/self-host readiness label is gated by defense-in-depth HTTP hardening, full-history + working-tree secret scans, deterministic dependency/deployment review, existing Sandbox/backup/Temporal recovery evidence, operator-only Control Center routes, conservative install/upgrade/rollback tooling, and exact-head + post-merge CI.

Runtime provider/model state and credential metadata remain Connect-owned. Credential plaintext is encrypted into the existing vault and never copied to Ai. MCP configuration remains Connect-owned and configuration changes do not grant execution authority; Hub governance and per-tool policy remain mandatory.

The readiness label means the documented self-host baseline passed repository evidence. It does not assert real hosted-provider quality, future vulnerability absence, off-host backup durability, or host/network hardening that cannot be proven in repository CI.

## Public HTTPS acceptance resilience

Real external MCP acceptance remains a public-network test. Cloudflare Quick Tunnel is retained as a pinned primary provider when its binary is available and its generated hostname becomes routable. If that provider cannot provision a routable public hostname, the acceptance harness may use the independent Pinggy SSH/HTTPS tunnel path and must still execute the same OAuth/JWKS, protected-resource, MCP discovery, tool invocation, and authorization-rejection checks through public HTTPS.

A provider outage or fresh-host DNS provisioning failure is therefore not treated as an ECORIONE product failure, but the public-network acceptance itself is never skipped or downgraded to loopback-only evidence.

## Closure evidence

Batch 12 implementation was verified and merged with the following evidence:

- pre-PR Batch 12 integration/security run `34476691984`: PASS;
- provider-resilient real public HTTPS MCP proof `34485069385`: PASS;
- final implementation head `c59d5c2f39b99615afcc9dbf17432f9cbc69bce9`;
- exact-head CI `34485292260`: full green, including Format, Lint, Typecheck, Test, Phase 4 real-process acceptance, Production Operations acceptance, Secret Scan, and Production Build;
- exact-head MCP External HTTPS Acceptance `34485292292`: PASS;
- implementation PR #29 merged with expected-head lock as `ad67b68290a41e69e18dfa49caefed0090bd9635`;
- post-merge main MCP External HTTPS Acceptance `34485575560`: PASS;
- post-merge main CI `34485575168`, attempt 2: full green on the unchanged merge SHA. Attempt 1 hit one transient 60-second Temporal test timeout; the same job reran on the same SHA and passed the complete suite and remaining gates.

The closure documentation and current release posture are recorded in `docs/verification/batch12-closure-2026-09-10.md` and `docs/EXECUTION-PROGRESS.md`.

## Readiness boundary

After the closure evidence above, the documented label is:

**ECORIONE production/self-host baseline READY**

This closes the planned Batch 1–12 platform/production roadmap. It does not close Fase 6+ permanently, create an implicit Batch 13, or change the decision to defer AutoClick until a concrete non-API use case passes architecture review. Future security hardening, telemetry, production validation, maintenance, and R&D remain evidence-driven work.