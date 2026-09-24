# ECORIONE — Ai Human-Authentication Closure Checkpoint — 2026-09-24

Status: **CLOSED / PASS AT SUMOPOD STAGING BOUNDARY / NOT PRODUCTION**

## Scope

This checkpoint closes the CRITICAL audit finding tracked in Issue #287: the reachable general Ai browser/API edge previously had no human-authentication boundary while Ai proxy routes injected the internal service token server-side.

The closure is intentionally bounded to the current self-host/SumoPod edge. It does not promote staging to production, reopen PE/PCS, authorize DR-2 checkpoint 2, or claim a general identity/RBAC product.

## Implementation

The reviewed Caddy policy now keeps MCP/OAuth on its existing separate protocol boundary and makes the general Ai surface private by default:

- unauthenticated `/` redirects to `/login` with HTTP 302 without serving Ai content;
- `/login` is protected by the existing operator Basic-Auth credentials and redirects authenticated users back to `/`;
- all other Ai page/API fallback traffic is Basic-Auth protected before it can reach `ai:3000`;
- `/.well-known/oauth-protected-resource*` remains reachable for MCP discovery;
- `/mcp*` remains governed by its OAuth/OIDC resource-server boundary.

This deliberately reuses the existing operator credential set as an urgent fail-closed human gate. It is not presented as a final multi-user authentication architecture.

## Change chain

1. PR #293 / merge `7f08456a9761f1f590761b38b7fe83b300e82e80`
   - made the staging readiness gate accept a protected-home response;
   - its first deployment attempt exposed that the existing host-side deploy helper still expected a 2xx/3xx home response.

2. PR #294 / merge `6f28bcf3087c5309a2124aa926bee4e39e24d414`
   - added the protected `/login` bootstrap and representative private-route negative-path smoke;
   - real staging reached the new policy successfully;
   - deployment validation then failed only because the smoke expected general content security headers on a Caddy-generated Basic-Auth 401 challenge.

3. PR #295 / merge `b73e885d51e82716d5b29b3b31d207aae5ec95d0`
   - corrected the smoke to assert the relevant authentication property on private 401 responses: HTTP 401 plus a Basic `WWW-Authenticate` challenge;
   - preserved normal security-header assertions on the unauthenticated root redirect;
   - preserved the MCP discovery/OAuth challenge checks.

The failed intermediate staging runs are retained as historical evidence and are not rewritten as passes.

## Reviewed-main gates

For final main `b73e885d51e82716d5b29b3b31d207aae5ec95d0`:

- CI run `35967561614`: **PASS**
- Product Eval run `35967561587`: **PASS**
- governed Staging Deploy run `35967881224`: **PASS**
  - gate job: PASS
  - deploy job: PASS

## Real staging acceptance

The successful governed deploy established exact reviewed SHA `b73e885d51e82716d5b29b3b31d207aae5ec95d0` / image `staging-b73e885d51e8`.

The public smoke passed these unauthenticated checks:

- `/` -> HTTP 302 to `/login`
- `/login` -> HTTP 401 + Basic challenge
- `/ops` -> HTTP 401 + Basic challenge
- `/settings` -> HTTP 401 + Basic challenge
- `/api/ops` -> HTTP 401 + Basic challenge
- `/api/settings` -> HTTP 401 + Basic challenge
- `/api/projects` -> HTTP 401 + Basic challenge
- `/api/projects/history` -> HTTP 401 + Basic challenge
- `/api/brain` -> HTTP 401 + Basic challenge
- `/api/space/pages` -> HTTP 401 + Basic challenge
- POST `/api/chat` -> HTTP 401 + Basic challenge
- POST `/api/forget` -> HTTP 401 + Basic challenge
- MCP protected-resource metadata -> HTTP 200
- unauthenticated MCP request -> HTTP 401 with resource metadata challenge

Authenticated Operations also returned `healthy: true`, `serviceCount: 9`, and no unhealthy services.

Sanitized host evidence matched the expected SHA, reported a clean detached checkout, and showed all 15 configured services running with no non-running services.

## Claim boundary

This checkpoint proves that the tested SumoPod staging edge now fails closed for the representative general Ai read/mutation surfaces covered above while retaining the separate MCP/OAuth boundary.

It does **not** prove:

- final end-user identity, account lifecycle, session management, MFA, or RBAC;
- production readiness or production cutover;
- that every future route is automatically protected if Caddy routing is changed incorrectly;
- DR-2 physical independence;
- provider/account security outside the tested edge.

Future route additions must remain behind the private fallback or add their own reviewed authentication boundary.

## Safe resume point

Repository and staging are synchronized on final reviewed main `b73e885d51e82716d5b29b3b31d207aae5ec95d0` at this checkpoint.

Issue #287 may be closed as resolved by PRs #293–#295 and the successful governed staging acceptance above.

The next implementation scope should be selected independently from the remaining audit findings; this closure does not implicitly authorize the HIGH direct-start bearer-token gap, timeout coverage work, Space default-port fix, Project UX fixes, DR-2 checkpoint 2, or production promotion.
