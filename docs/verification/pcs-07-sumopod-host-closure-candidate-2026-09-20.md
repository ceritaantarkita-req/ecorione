# PCS-07 SumoPod Remote Staging — Actual Host Closure Candidate

Date: **2026-09-20**

Status: **ACTUAL HOST DEPLOYMENT PASS / FINAL GOVERNED BROWSER JOURNEY PENDING**

PCS-07 covers the first operator-owned SumoPod Ubuntu **staging** deployment. It does not promote this host to production and does not close PCS-09 persistence/security/backup/observability work.

## Reviewed repository path

Repository-side staging preparation was established before host mutation and later adapted to the audited shared-host edge:

- PR #203 — isolated SumoPod staging deployment preparation;
- PR #204 — sanitized actual-host evidence tooling;
- PR #206 — existing SumoPod Traefik edge adaptation;
- PR #207 — literal Caddy bcrypt env handling;
- PR #208 — public smoke request corrected to the repository's MCP 2026-07-28 HTTP contract.

PR #208 exact head `2c5543be19651e1d23083e1cbbf6d9ad40a0e231` passed CI #1581 and Product Eval #820 and merged as `59430c4b72a704d1fd6c6176d12b13fa27ddf674`.

The runtime was deployed from reviewed `main` commit:

```text
99523b0bb29ce11a74ec61c0e364ef5b6dd543ae
```

That commit was exact `main` at deployment time. PR #208 changed the public-smoke verifier/test contract after the host exposed the malformed smoke request; it did not change runtime service behavior or the deployed topology.

## Host inventory and isolation evidence

Sanitized host evidence reported:

```text
OS                     Ubuntu 24.04.4 LTS
kernel                 Linux 6.8.0-136-generic
architecture           x86_64
Docker server          29.7.1
Docker Compose         5.3.1
Compose project        ecorione-staging
Compose overlay        deploy/compose.sumopod.yml
edge network           inmydraft-demos_web
deployment env mode    600
deployment env symlink false
placeholders           none
source HEAD            99523b0bb29ce11a74ec61c0e364ef5b6dd543ae
expected SHA match     true
worktree               clean
branch mode            DETACHED exact revision
```

All 15 configured services were running and there were zero non-running services:

```text
ai
artifact
caddy
connect
context
flow
flow-worker
hub
mcp
rnd
sandbox
space
sync
temporal
temporal-db
```

The staging project created owner-scoped persistent volumes for Artifact, Caddy, Connect, Context, Flow, Hub, RnD, Sandbox, Space, Sync, and Temporal PostgreSQL. Existing unrelated Compose projects and volumes were not replaced.

## Shared edge result

The actual VPS already had an operator-owned Traefik instance bound to host ports 80/443. ECORIONE therefore uses the reviewed SumoPod overlay:

```text
Internet
  -> existing Traefik :80/:443
  -> ECORIONE internal Caddy :8080
  -> Ai / Sync-MCP / internal owners
```

ECORIONE Caddy does not publish competing host 80/443 bindings. Caddy remains the ECORIONE policy/routing boundary behind Traefik, including Basic Auth for operator surfaces.

The selected staging hostname resolves to the VPS and public HTTPS succeeded.

## Public/runtime evidence

Observed on the real staging host:

```text
GET /                         HTTP 200, TLS verification success
GET /ops                     HTTP 401 without operator credentials
GET /settings                HTTP 401 without operator credentials
GET /.well-known/oauth-protected-resource/mcp
                              HTTP 200
valid unauthenticated POST /mcp
                              HTTP 401
WWW-Authenticate             Bearer challenge with public resource_metadata,
                              memory:read scope, invalid_token
```

The valid MCP request used the repository protocol contract:

- `mcp-protocol-version: 2026-07-28`;
- `mcp-method: tools/list`;
- matching JSON-RPC method;
- required modern `params._meta` protocol envelope.

The initial `production-public-smoke.mjs` request returned HTTP 400 because the verifier itself omitted those mandatory fields and therefore failed protocol validation before AuthN. PR #208 corrected the verifier. The live runtime then independently returned the expected HTTP 401 OAuth challenge for a valid unauthenticated request.

## Operations health

Authenticated `/api/ops` snapshot on the actual staging boundary reported:

```json
{
  "healthy": true,
  "serviceCount": 9,
  "unhealthyServices": [],
  "traceGroups": 8
}
```

This is an Ai read-only aggregation of required owner health. It does not establish hosted-provider quality or durable external telemetry.

## Resource snapshot

One post-deployment idle snapshot measured approximately **1.79 GiB** total memory across the 15 ECORIONE staging containers. CPU was effectively idle except for small Temporal/PostgreSQL activity.

Post-build root filesystem state was approximately:

```text
79G total
52G used
24G available
69% used
```

A single snapshot is not peak-capacity evidence. PCS-09 retains longer-lived capacity/observability work.

## Host audit warnings reviewed

The real-host audit produced four warnings. None was silently treated as production-safe:

1. SSH root-login policy was not clearly restricted.
2. SSH password authentication remained enabled/unresolved.
3. membership of the operator account in the Docker group grants root-equivalent Docker access.
4. `cloudflared` was not installed.

For this staging boundary:

- the Docker-group warning is accepted as an operator-host privilege fact, not a least-privilege production claim;
- `cloudflared` is not required because the selected staging edge is the existing Traefik deployment;
- SSH hardening is intentionally deferred to PCS-09 so it can be changed with a second-session/anti-lockout procedure instead of during first deployment.

## Explicit non-claims

PCS-07 evidence does **not** prove:

- restart persistence on this VPS;
- backup/restore on this VPS;
- off-host disaster recovery;
- durable long-term observability;
- final SSH/firewall hardening;
- production promotion;
- real OAuth issuer/JWKS token verification for the staging MCP endpoint;
- hosted-provider quality, latency, or paid-provider canary;
- peak resource capacity.

The staging config intentionally kept hosted-cost execution disabled during this checkpoint. Provider credentials were not required for PCS-07.

## Remaining closure gate

The repository PCS-07 contract still requires:

1. rendered Ai/browser reachability through the chosen staging access path; and
2. one basic governed product journey that does not require a paid provider call.

The recommended final proof is the real staging Flow surface:

```text
open /flow
 -> save a minimal Trigger graph
 -> Prepare authority
 -> explicit Approve for node.execute
 -> Run
 -> observe completed state
```

A Trigger-only graph is sufficient and exercises the existing Hub approval / standing-grant / Temporal execution boundary without any hosted provider request.

Until that actual browser journey is observed, this document remains a **closure candidate**, not the final PCS-07 CLOSED / PASS record.

## Next scope after closure

After the final browser/governed journey passes, PCS-07 may be marked CLOSED / PASS and PCS-08 becomes active:

```text
reviewed PR
 -> required GitHub gates
 -> merge main
 -> exact reviewed deployment to SumoPod
 -> health/smoke
 -> healthy marker or rollback
```

PCS-08 must not implement a blind polling `git pull` loop and must preserve host-side secret ownership.
