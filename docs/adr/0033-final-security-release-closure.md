# ADR-33 — Final Security and Release Closure Baseline

Status: Accepted
Date: 2026-09-10

## Decision

ECORIONE's production/self-host readiness label is gated by defense-in-depth HTTP hardening, full-history + working-tree secret scans, deterministic dependency/deployment review, existing Sandbox/backup/Temporal recovery evidence, operator-only Control Center routes, conservative install/upgrade/rollback tooling, and exact-head + post-merge CI.

Runtime provider/model state and credential metadata remain Connect-owned. Credential plaintext is encrypted into the existing vault and never copied to Ai. MCP configuration remains Connect-owned and configuration changes do not grant execution authority; Hub governance and per-tool policy remain mandatory.

The readiness label means the documented self-host baseline passed repository evidence. It does not assert real hosted-provider quality, future vulnerability absence, off-host backup durability, or host/network hardening that repository CI cannot prove.

## Public HTTPS acceptance resilience

Real external MCP acceptance remains a public-network test. Cloudflare Quick Tunnel is retained as a pinned primary provider when its binary is available and its generated hostname becomes routable. If that provider cannot provision a routable public hostname, the acceptance harness may use the independent Pinggy SSH/HTTPS tunnel path and must still execute the same OAuth/JWKS, protected-resource, MCP discovery, tool invocation, and authorization-rejection checks through public HTTPS.

A provider outage or fresh-host DNS/route provisioning failure is therefore not treated as an ECORIONE product failure, but the public-network acceptance itself is never skipped or downgraded to loopback-only evidence.

## Closure evidence

Batch 12 implementation and closure were verified and merged with the following evidence:

- pre-PR Batch 12 integration/security run `34476691984`: PASS;
- provider-resilient real public HTTPS MCP proof `34485069385`: PASS;
- final implementation head `c59d5c2f39b99615afcc9dbf17432f9cbc69bce9`;
- exact-head implementation CI `34485292260`: full green;
- exact-head MCP External HTTPS Acceptance `34485292292`: PASS;
- implementation PR #29 merged with expected-head lock as `ad67b68290a41e69e18dfa49caefed0090bd9635`;
- post-implementation-merge MCP External HTTPS Acceptance `34485575560`: PASS;
- post-implementation-merge CI `34485575168`, attempt 2: full green on the unchanged merge SHA;
- closure PR #30 exact-head CI `34489719588`: PASS;
- closure PR #30 merged with expected-head lock as `783a4ae8a2c90b3c696b3d619fb0c03581f675b2`;
- final post-closure `main` CI `34490006960`: full green.

The full CI gate includes Naming, Format, Lint, Typecheck, Test, Phase 4 real-process acceptance, Production Operations acceptance, Secret Scan, and Production Build.

The first post-implementation-merge CI attempt hit one transient 60-second Temporal test timeout while 530 other tests passed. The same job was rerun on the same SHA and passed. That event remains recorded rather than being hidden.

## Readiness boundary

After the evidence above, the documented label is:

**ECORIONE production/self-host baseline READY**

This closes the planned Batch 1–12 platform/production roadmap with **0 planned batches remaining**. It does not close Fase 6+ permanently, create an implicit Batch 13, or change the decision to defer AutoClick until a concrete non-API use case passes architecture review.

Future security hardening, telemetry, production validation, maintenance, product work, and R&D remain evidence-driven work under new explicit scopes.

## Post-closure deployment decision

The preferred low-cost public-edge deployment for the current self-host architecture is **Cloudflare Free + Cloudflare Tunnel in front of the ECORIONE VPS**, while compute and state remain self-hosted.

Cloudflare is not promoted into an ECORIONE authority or data owner:

- Hub remains policy/approval/authority owner;
- Connect remains provider/credential/MCP configuration owner;
- Cloudflare Tunnel is transport/edge only;
- Temporal, owner databases, Artifact storage, Vault, Sandbox, and all application services remain on the operator's origin unless a future ADR explicitly changes ownership.

The production rollout and rollback procedure is documented in `docs/cloudflare-free-deployment.md`. A persistent named production tunnel is an operator deployment step, not part of the Batch 12 repository closure proof.

## Canonical references

- current status + next scopes: `docs/current-state-and-next-steps.md`
- detailed execution tracker: `docs/EXECUTION-PROGRESS.md`
- Batch 12 verification: `docs/verification/batch12-closure-2026-09-10.md`
- production operations: `docs/production-operations.md`
- release/rollback: `docs/release-operations.md`
- Cloudflare Free deployment: `docs/cloudflare-free-deployment.md`
