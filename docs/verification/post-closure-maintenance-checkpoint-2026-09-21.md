# Post-closure maintenance checkpoint — 2026-09-21

Status: **BOUNDED MAINTENANCE PASS CLOSED THROUGH PR #232 / NO NEW ROADMAP OPENED**

## Purpose

After PCS-00..PCS-10 and PE-00..PE-08 were already CLOSED / PASS, a bounded post-closure audit continued against the current repository. The work in this checkpoint repaired concrete correctness, security, privacy, and documentation defects only.

It does **not** create PE-09, PCS-11, Batch 13, a new F6 item, a W-series rerun, production promotion, or a paid-provider evidence scope.

Implementation checkpoint before this documentation convergence: `1618b45e3c0837a84e17d258182cd73cad3f0591`.

## Safety boundary used for the pass

- `main` remains the repository source of truth.
- one bounded defect scope per PR;
- exact-head CI/Product Eval and every relevant acceptance gate must pass before merge;
- no production promotion, Cloudflare/public-edge activation, W18 rerun, or provider-spend authorization;
- no weakening of secret-history, release-security, MCP external HTTPS, or other existing gates;
- historical evidence is preserved rather than rewritten;
- repository merge status is not treated as proof that remote staging has been redeployed.

## Closed maintenance sequence

| PR | Maintenance result |
|---|---|
| #222 | W18 cleanup preserves the prior hosted provider/model pair while still forcing Hosted OFF. |
| #223 | stale PCS-09 preparation wording was marked historical instead of contradicting completed real-host evidence. |
| #224 | credential-bearing internal/owner service fetches fail closed on redirects. |
| #225 | Anthropic and OpenAI-compatible/OpenRouter provider requests fail closed on redirects before credentials can follow a redirect chain. |
| #226 | multimodal adapter redirects fail closed for hosted bearer traffic and local payloads. |
| #227 | local model completion/provenance traffic fails closed on redirects. |
| #228 | MCP JWKS trust-root retrieval rejects redirects. |
| #229 | a still-fresh JWKS cache can refresh once for a rotated unknown `kid`, with bounded cooldown against fetch amplification. |
| #230 | malformed JWT schema is classified as `401 invalid_token`; JWKS dependency failure is classified as `502` without leaking raw upstream diagnostics. |
| #231 | a failed JWKS rotation refresh remains a dependency failure throughout the cooldown instead of degrading into a false `401 invalid_token`. |
| #232 | local multimodal endpoints inherit the Local privacy boundary: HTTP/HTTPS only, no URL credentials/fragments, and loopback/private/local host scope unless the existing explicit public opt-out is set. |

## Resulting security/correctness invariants

- credential-bearing owner/internal/provider requests must not silently follow redirects;
- Local text-model and Local multimodal routes must not silently become public routes;
- public Hosted routing remains explicit and governed separately from Local routing;
- MCP JWT validation distinguishes caller-invalid tokens from authorization-server/JWKS outages;
- JWKS rotation support stays bounded and fail-closed;
- W18 cleanup does not silently erase an operator's hosted model preference;
- repository secret scanning remains strict; test fixtures are written so they do not require scanner bypasses.

## Runtime/staging claim boundary

The repository maintenance pass does **not** replace the existing real-host staging proof.

The documented proven SumoPod staging application revision remains:

`0f332c73dc7b363bffecdeecae921d805d5ae131`

with image:

`staging-0f332c73dc7b`

unless a later explicit staging deployment record proves a newer application revision.

GitHub Staging Deploy workflow runs associated with repository maintenance must be read at the job level: a successful gate/run does not by itself mean the deploy job mutated the host. No public-production claim is created by this maintenance checkpoint.

## Current boundary after this checkpoint

- PE-00..PE-08 — CLOSED / PASS.
- PCS-00..PCS-10 — CLOSED / PASS.
- bounded post-closure maintenance through PR #232 — CLOSED at the repository boundary.
- active product implementation queue — NONE.
- public production cutover — separate explicit decision.
- optional Cloudflare/public edge — separate explicit decision.
- off-host DR / total-host-loss recovery — still separate evidence.
- paid W18 rerun — not authorized.
- AutoClick and L4 autonomy — still deferred by design.

The documentation-convergence PR that links this checkpoint is the authority for its own exact-head CI/Product Eval/merge status.
