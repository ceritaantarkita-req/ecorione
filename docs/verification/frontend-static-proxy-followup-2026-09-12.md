# Frontend Static Audit — Owner Proxy Follow-up

Status: **CODE-SIDE FIX IMPLEMENTED / EXACT-HEAD CI + RUNTIME WALKTHROUGH PENDING**  
Date: **2026-09-12**

This note preserves the earlier `frontend-static-audit-final-2026-09-12.md` as valid evidence and records a later static finding discovered while continuing the operator-requested deeper frontend/proxy audit. It does **not** convert repository inspection into rendered UX PASS.

## Finding

The Settings UI loads MCP configuration through:

```text
GET /api/settings/settings/mcp/servers?workspaceId=<workspace>
```

The Ai catch-all route correctly preserved that query string, and Connect correctly supports optional `workspaceId` on `GET /v1/settings/mcp/servers`. However, the Ai Settings proxy matched its anchored allowlist regex against the **entire path including the query string**. A valid workspace-filtered Settings request could therefore be rejected locally with HTTP 400 before reaching Connect.

This was a real contract mismatch between the visible Settings surface and its owner proxy, not a browser-only visual concern.

## Fixes in this follow-up

1. Settings proxy validation now separates pathname from query before allowlist matching.
2. Only the supported single `workspaceId` query is accepted for `GET /v1/settings/mcp/servers`; unknown, duplicated, or query-bearing unrelated Settings routes fail closed.
3. A shared owner-proxy path normalizer rejects dot-segment escape, absolute/cross-origin URL forms, backslashes, and fragments before owner URLs are constructed.
4. Space and Flow proxy paths use the same bounded normalizer.
5. Hub, Settings, Space, Flow, and Ops internal fetch boundaries use `redirect: "error"` so credential-bearing/internal requests do not silently follow owner redirects.
6. Owner-facing fetches remain `no-store` where applicable.
7. Deterministic regression coverage was added for Settings MCP workspace loading, path/query rejection, malformed JSON, upstream failure, redirect fail-closed behavior, Space/Flow boundary behavior, Hub redirects, and Ops aggregation.
8. The release acceptance list now includes the Ai owner-proxy tests that protect this boundary.
9. `evidence:ux:inventory` now exercises the same Settings MCP workspace proxy contract used by the UI and validates the returned `servers` shape.

## Claim boundary

This follow-up can prove only repository-side contract and deterministic test behavior after exact-head CI passes. It still cannot prove:

- rendered desktop/mobile layout quality;
- browser console cleanliness;
- real operator-device interaction behavior;
- local model end-to-end UX;
- runtime Settings MCP interaction against the synchronized operator laptop.

The real local inventory and browser walkthrough in `docs/ux-runtime-walkthrough-checklist.md` remain mandatory before UX/product validation can close.

No Hosted enablement, provider-account mutation, VPS/Cloudflare/DNS change, Historical Ledger rewrite, Context ground-truth rewrite, or immutable-model-identity claim is part of this follow-up.
