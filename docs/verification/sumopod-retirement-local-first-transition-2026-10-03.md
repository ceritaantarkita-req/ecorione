# SumoPod Staging Retirement + Local-First Transition — 2026-10-03

**Status:** OPERATOR DECISION RECORDED / SUMOPOD ACTIVE-STAGING ROLE RETIRED / LOCAL-FIRST DEVELOPMENT ACCEPTANCE ACTIVE / PRODUCTION + DR-2 UNCHANGED

## Operator decision

On 2026-10-03 the operator decided not to renew the current SumoPod VPS when its current paid period ends. No further SumoPod repair, staging recovery, or new runtime deployment is required for ongoing ECORIONE development unless the operator explicitly reauthorizes that host later.

This is an operating-cost decision. It does not invalidate historical SumoPod staging evidence that was true when recorded.

## Repository state at transition

```text
GitHub main                 = 4326e77b2f77aa48a4be075c5fab2ff8b9983655
Session 12A merge           = 084d669d8631a2590e7a9e88b62e161691bf4fc9
Session 12B merge           = 977689ffff8bdf2d00fd1ed34c172d3452d98d17
Session 12C merge / main    = 4326e77b2f77aa48a4be075c5fab2ff8b9983655
Session 12D draft PR        = #444
Session 12D reviewed head   = a6d7073c63d9d0f6581af67c2bef3a599629303e
```

Session 12D reviewed-head gates are all green:

```text
CI                          = #2748 PASS
Product Eval                = #1987 PASS
MCP External HTTPS          = #1278 PASS
PCS-06 Integrated Browser   = #446 PASS
```

PR #444 remains DRAFT / UNMERGED until local runtime acceptance is performed on operator-controlled compute.

## Historical SumoPod truth

The last proven **actual** SumoPod runtime before the active-image host-state blocker was Session 12A:

```text
Staging Deploy              = #2183
runtime SHA                 = 084d669d8631a2590e7a9e88b62e161691bf4fc9
image                       = staging-084d669d8631
services                    = 15/15 running
Ai                          = healthy
public/auth smoke           = PASS
Operations                  = healthy
exact-host SHA              = MATCH
free disk                   = 27.41 GiB
```

Do not infer later runtime success from gate-only staging runs.

The first real Session 12B deploy attempt (#2226) and Session 12C deploy attempt (#2228) both failed **before mutation** because the root deployment guard could not determine the active ECORIONE staging image:

```text
Refusing deploy: unable to determine active ECORIONE staging image
```

A rerun of #2228 failed identically. The guard was not weakened.

Therefore:

- Session 12A is the last proven SumoPod runtime;
- Session 12B is merged-main quality-gate PASS but **not SumoPod-staging-verified**;
- Session 12C is merged-main quality-gate PASS but **not SumoPod-staging-verified**;
- Session 12D is exact-head quality-gate PASS and awaits local acceptance before merge.

Historical PCS-07..PCS-09, Sessions 4E–11, original Off-host DR, and other dated SumoPod evidence remain valid at their documented historical boundaries.

## Interim operating model

Until a new external staging target is explicitly selected:

```text
reviewed branch / PR
  -> CI + Product Eval + required acceptance gates
  -> local Docker/Compose acceptance on operator-controlled compute
  -> merge exact reviewed head
  -> merged-main gates
```

There is no active remote staging target in this interim model.

The local acceptance step is not a production claim and not a substitute for future remote-host evidence when production/staging-specific behavior matters.

## Session 12 Native Google Drive boundary

Current Session 12 state:

- **12A OAuth foundation:** MERGED / quality gates PASS / last real SumoPod runtime proof is on this merge;
- **12B selected-file fetch/export:** MERGED / quality gates PASS / remote staging proof unavailable;
- **12C governed Project Source lifecycle:** MERGED / quality gates PASS / remote staging proof unavailable;
- **12D Picker/browser UX:** DRAFT / exact-head full gates PASS / local acceptance pending.

12D local acceptance should prove, on operator-controlled compute:

1. Connect reports Google Drive status without token disclosure;
2. OAuth start redirects only to Google's fixed authorization origin;
3. callback state/PKCE succeeds and same-origin return navigation is preserved;
4. cancelled consent returns safely;
5. Picker session is short-lived and no-store;
6. user selects one or more concrete Drive files through Picker;
7. selected files snapshot through Connect -> Hub -> Artifact;
8. Project lifecycle records `google-drive:fileId`;
9. Index/Re-index works through existing Context lifecycle;
10. Drive snapshot refresh updates the lifecycle's latest Artifact;
11. disconnect revokes/removes Connect credential custody without deleting existing Artifact snapshots;
12. browser storage contains no refresh/access token persistence.

No whole-Drive indexing, recursive folder sync, or background polling is introduced.

## What is paused

The following remain separate and are not unblocked by retiring SumoPod:

- production cutover;
- Cloudflare/public-production activation;
- DR-2 physical-independence proof;
- final Workspace registry / broader multi-user RBAC;
- any new paid external staging target.

## Future staging replacement

A replacement staging target may be selected later. ECORIONE remains Docker/Compose-based, so the next staging host should reuse the existing governed deployment model rather than create a new product architecture.

Do not provision or pay for a replacement host without explicit operator authorization.

## Resume rule

For current product work, use this transition record together with:

1. `docs/current-state-and-next-steps.md`;
2. `docs/active-work-plan.md`;
3. Issue #440;
4. PR #444.

Do not retry or repair SumoPod merely to satisfy historical staging closure language.
