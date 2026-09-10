# Batch 12 — Final Security / Release Closure Verification

**Date:** 2026-09-10  
**Implementation PR:** #29  
**Implementation merge SHA:** `ad67b68290a41e69e18dfa49caefed0090bd9635`  
**Final implementation head:** `c59d5c2f39b99615afcc9dbf17432f9cbc69bce9`

## Verdict

**ECORIONE production/self-host baseline READY** for the documented repository and self-host deployment boundary.

Batch 12 closes the planned Batch 1–12 platform/production roadmap. This is not a claim that development, security work, or production validation is permanently complete. Fase 6+ remains open-ended and evidence-driven, and AutoClick remains deferred until a concrete non-API use case passes architecture review.

## What Batch 12 closed

The final release batch adds or verifies:

- shared internal HTTP hardening with timing-safe bearer checks, bounded request/body handling, security headers, no-store behavior, and bounded process-local rate limiting;
- public URL/SSRF validation against unsafe protocols, embedded credentials, private/local literal hosts, and unsafe resolved address ranges;
- working-tree and full Git-history secret scans;
- deterministic dependency/security review and registry audit gating;
- focused AuthN/AuthZ, Sandbox escape, MCP/plugin permission, backup/recovery, failure/chaos, worker-audit, and runtime-settings acceptance;
- Ai `/settings` Control Center while keeping provider/model/credential/MCP mutable state Connect-owned and credential plaintext out of Ai;
- developer SDK documentation;
- conservative self-host install, upgrade/migration, rollback, and release operations tooling;
- Next.js-specific lint integration and production build as release-blocking gates;
- final documentation/ADR consistency and release evidence.

## External MCP public HTTPS gate

During closure, Cloudflare Quick Tunnel repeatedly registered a tunnel edge connection while its newly generated `*.trycloudflare.com` hostname still returned NXDOMAIN through the system resolver, Cloudflare DoH, and Google DoH. A direct Cloudflare-edge probe using the original hostname/SNI returned HTTP 530, confirming the generated public hostname/route was not yet provisioned rather than exposing an MCP/Auth/JWKS regression.

The acceptance harness was therefore made provider-resilient instead of weakening the test. It retains pinned Cloudflare as the primary option when available and can fall back to an independent Pinggy SSH/HTTPS tunnel. The fallback still has to run the same real public-network acceptance; it does not replace the test with loopback evidence.

Provider-resilient proof run `34485069385` passed through public HTTPS and verified:

- protected-resource discovery;
- 401 `resource_metadata` challenge;
- public JWKS fetch and JWT verification;
- `server/discover`;
- `tools/list`;
- `tools/call memory_search` through Sync to Hub;
- insufficient-scope rejection;
- malformed-JWT rejection;
- Origin rejection;
- routing-header mismatch rejection.

## Bugs found and fixed before closure

- `/settings` initially used a CSS Modules selector that was not locally scoped; it was scoped to the page root.
- `/space` used a raw root `<a>` navigation that violated the enabled Next.js rule; it was replaced with `next/link`.
- production build was explicitly retained as a release-blocking gate after these findings.
- Cloudflare Quick Tunnel DNS provisioning was separated from ECORIONE correctness by adding the independent real-public-HTTPS fallback described above.

## Implementation evidence

| Evidence | Result |
|---|---|
| Batch 12 integration/security run `34476691984` | PASS |
| Provider-resilient full public HTTPS MCP proof `34485069385` | PASS |
| Exact implementation head | `c59d5c2f39b99615afcc9dbf17432f9cbc69bce9` |
| Exact-head CI `34485292260` | PASS |
| Exact-head MCP External HTTPS Acceptance `34485292292` | PASS |
| PR #29 expected-head-locked squash merge | `ad67b68290a41e69e18dfa49caefed0090bd9635` |
| Post-merge main MCP `34485575560` | PASS |
| Post-merge main CI `34485575168`, attempt 2 | PASS |

The exact-head CI passed Naming, Format, Lint, Typecheck, Test, Phase 4 real-process acceptance, Production Operations acceptance, Secret Scan, and Production Build.

The first post-merge CI attempt hit one 60-second timeout in the existing in-process Temporal restart test while 530 other tests passed. The failed job was rerun on the **unchanged** merge SHA; attempt 2 passed the full test suite, Phase 4 real-process acceptance, Production Operations acceptance, Secret Scan, and Production Build. The timeout is recorded rather than hidden because closure evidence must describe the actual run history.

## Historical audit reconciliation

`docs/final-audit-2026-09-09.md` is retained as a historical snapshot and is not rewritten. Its then-open release blockers have since been addressed through the subsequent roadmap:

- production credential vault: closed before Batch 12 through the Connect credential-vault workstream;
- durable cumulative hosted spend budget: closed through its dedicated hardening workstream;
- external public MCP proof: closed and later made provider-resilient during Batch 12;
- full-history secret assurance: added in Batch 12;
- production deployment/observability baseline: delivered in Batch 11;
- Next.js-specific lint/release-build gap: closed in Batch 12.

The historical audit remains useful as evidence of the earlier state; this verification document is the current Batch 12 release-closure record.

## Residual boundaries that remain explicit

The READY label does **not** claim:

- real hosted-provider quality, latency, or availability from deterministic CI stubs;
- that process-local rate limiting is a distributed/global limiter;
- elimination of DNS rebinding between validation and socket connection in every external network path;
- future vulnerability absence or that repository secret scanning replaces organization-level secret scanning;
- off-host backup durability when an operator stores backups in the same failure domain;
- host OS, firewall, reverse-proxy, provider-account, or infrastructure hardening that repository CI cannot prove;
- completion of Fase 6+ forever.

These boundaries are documented operational responsibilities or future evidence-driven hardening, not hidden release claims.

## Closure rule

This document deliberately does not write its own closure-PR CI run ID into itself. Doing so would create a self-referential loop in which adding the run ID creates a new commit that requires a new run. The closure PR's exact head and GitHub checks are the final evidence for the documentation-only closure change.

After this closure documentation passes exact-head repository CI, is merged with an expected-head lock, and the resulting `main` commit passes post-merge repository CI, Batch 12 is fully closed. No Batch 13 exists unless a new scope is explicitly created.