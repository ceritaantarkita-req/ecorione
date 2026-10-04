# Session 12D Repository-Green / Real Local Acceptance Pending — 2026-10-04

**Status:** CURRENT / REPOSITORY + AUTOMATED-MOCK ACCEPTANCE CLOSED / REAL LOCAL GOOGLE OAUTH + PICKER ACCEPTANCE PENDING / PR #444 DRAFT / UNMERGED

## Why this checkpoint exists

This file is the canonical safe-resume pointer after the repository-side Session 12D hardening work. It supersedes the 2026-10-03 SumoPod transition file as the **current** queue pointer without rewriting that historical evidence.

## Audited repository truth

```text
repository                  = ceritaantarkita-req/ecorione
default branch              = main
main product/runtime base   = bd8d2513aa21164e5a1f6d36b898d8140b57506a (#448)
Session 12A merge           = 084d669d8631a2590e7a9e88b62e161691bf4fc9
Session 12B merge           = 977689ffff8bdf2d00fd1ed34c172d3452d98d17
Session 12C merge           = 4326e77b2f77aa48a4be075c5fab2ff8b9983655
12D local-support merge     = bd8d2513aa21164e5a1f6d36b898d8140b57506a (#448)
12D umbrella PR             = #444
12D PR state                = DRAFT / OPEN / UNMERGED
12D reviewed head           = df87fff76a4b1b5dc251161ff7802b71796360c3
mergeable                   = true
repository audit hardening = #461 + #462 MERGED into reviewed head
active remote staging       = NONE
last proven SumoPod runtime = 084d669d8631a2590e7a9e88b62e161691bf4fc9
```

The 78-commit branch history is an umbrella-history detail. The reviewed delta against current main remains bounded to the Session 12D Google Drive browser/Connect/Hub lifecycle and its tests/docs rather than a new cross-product ownership model.

## Exact-head gate proof

PR #444 exact head `df87fff76a4b1b5dc251161ff7802b71796360c3`:

```text
CI                          = #2830 PASS
Product Eval                = #2069 PASS
MCP External HTTPS          = #1322 PASS
PCS-06 Integrated Browser   = #480 PASS
Desktop Installer           = #348 PASS
```

## Repository + automated/mock acceptance — CLOSED / PASS

The deterministic `pnpm acceptance:google-drive:mock` surface now covers the repository-controlled behavior needed before a real Google run, including:

- OAuth state/PKCE and encrypted Connect refresh-token custody;
- short-lived Picker session behavior and no-store browser boundary;
- Picker DocsView LIST mode and bounded multi-select;
- `PICKED` metadata mapping, operator `CANCEL`, malformed payload rejection, duplicate-ID rejection, and max-20 enforcement;
- blob download plus deterministic supported Google-native export;
- selected-file ingestion through Connect -> Hub -> Artifact;
- real Context Index/Re-index lifecycle;
- snapshot refresh, idempotent retry, detach, and retained historical content-addressed snapshots;
- multi-file partial-success semantics and reconnect-required batch abort;
- bounded provider/error mappings without corrupting last-good Project state;
- no browser persistence of Google refresh/access tokens as a supported design path.

Audit hardening additionally proves explicit `invalid_grant` credential invalidation, transient 408/429/5xx credential preservation, connector-state reload after auth loss, and sanitized upstream metadata/content error mapping. This is repository/mock proof only. It does **not** prove Google Cloud console configuration or real provider behavior.

## Remaining Session 12D gate — real local Google acceptance

Run on operator-controlled local compute using the current runbook:

1. prepare local secrets/config without committing them;
2. run `pnpm acceptance:google-drive:preflight -- --origin http://localhost:3000`;
3. use root `pnpm dev` so `.env` is loaded;
4. verify real Google OAuth start/callback and safe cancel;
5. verify connected state and real Picker LIST rendering;
6. select at least one stored/blob file and one supported Google-native file;
7. verify selected-file -> Connect -> Hub -> Artifact Project Source ingestion;
8. verify Index and Re-index;
9. verify Drive snapshot refresh;
10. disconnect without deleting already-created snapshots;
11. confirm no Google access/refresh token is persisted in browser storage;
12. record only sanitized evidence.

Do not record OAuth codes, PKCE/state, access/refresh tokens, API key values, client secrets, Vault keys, or private Drive contents.

## Merge rule

PR #444 must remain DRAFT until the real local run passes.

After PASS:

1. record the exact locally accepted #444 SHA;
2. mark #444 ready;
3. merge **only that exact accepted head**;
4. require merged-main CI / Product Eval / MCP / browser / Desktop gates;
5. update current documentation again to the merged-main identity.

## Preserved boundaries

None of the following is implied by local PASS:

- remote staging;
- production/public cutover;
- Cloudflare/public-edge proof;
- DR-2 physical independence;
- whole-Drive listing/indexing;
- recursive folder sync/background polling;
- broad `drive` or `drive.readonly` scope;
- broader Workspace registry/final RBAC;
- Gmail/Calendar expansion.

SumoPod remains retired from the active staging role. Its historical evidence stays valid only at the dates and SHAs where it was recorded.
