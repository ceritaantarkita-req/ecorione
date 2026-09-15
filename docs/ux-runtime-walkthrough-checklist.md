# UX Runtime Walkthrough Checklist

Status: **READY / REQUIRES OPERATOR LAPTOP**

Run only on synchronized clean **current `origin/main`** with `ECORIONE_COST_KILL_SWITCH=1`. PR #65 / `f3f5fca3d20ddd35e1a4c4a7fbd6983a33db85ca` is the latest code-bearing UX/static baseline and must be present in the synchronized commit ancestry; do not checkout that older SHA merely to run evidence.

## Preflight

1. Fetch remote refs and synchronize local `main` to current `origin/main`.
2. Require `git rev-parse HEAD` equals `git rev-parse origin/main`.
3. Require `git status --short` is empty.
4. Require `git merge-base --is-ancestor f3f5fca3d20ddd35e1a4c4a7fbd6983a33db85ca HEAD` succeeds.
5. Verify root `.env` already exists and has a non-empty `ECORIONE_INTERNAL_TOKEN`; never print the token value into evidence or chat.
6. Start the synchronized Phase 4 stack from **PowerShell terminal A** with the hosted kill switch forced in the process environment:

```powershell
$env:ECORIONE_COST_KILL_SWITCH = "1"
pnpm engine:start
```

`engine:start` is the canonical cross-platform launcher: it reads root `.env`, reuses or starts Temporal, starts the required Phase 4 fleet, waits for readiness, and serves Ai at `http://127.0.0.1:3000`. Leave terminal A running during the walkthrough. If `.env` is unexpectedly absent, stop instead of treating auto-generated local config as W03 evidence.

7. In **PowerShell terminal B**, force the kill switch again and run the strict inventory:

```powershell
$env:ECORIONE_COST_KILL_SWITCH = "1"
pnpm evidence:ux:inventory
```

The inventory may hydrate `ECORIONE_INTERNAL_TOKEN` from root `.env` when the shell does not already contain it, but it never prints the token and it never imports the kill-switch value from `.env`. It still fails closed unless the shell explicitly has `ECORIONE_COST_KILL_SWITCH=1`, and it independently verifies that the running product reports Hosted effectively OFF.

8. Stop on inventory FAIL. PASS must include all eight required owners, all five primary surfaces, pinned local model digest, Settings MCP workspace-list proxy, Ops, Space, and Flow checks.
9. Open `http://127.0.0.1:3000` with browser DevTools Console visible. If `engine:start` already opened a browser window, use that exact running stack.

`Sync` is not part of the required local Phase 4 fleet. Operations may still expose its optional health when available; an unavailable optional Sync must be labeled as optional and must not degrade the required Phase 4 fleet.

## Desktop walkthrough

| ID | Action | PASS observation | Evidence |
|---|---|---|---|
| UX-01 | Use global nav Ai → Space → Flow → Operations → Settings → Ai | every surface reachable, correct active nav, no manual URL entry | one screenshot collage or per-surface screenshots |
| UX-02 | Send one Local message: `Balas tepat: UX_LOCAL_OK` | waiting state appears once, one reply appears, route/model/cache/cost line visible, no duplicate turn | screenshot + console check |
| UX-03 | Send second Local message: `Balas tepat: UX_CONTINUITY_OK` | same displayed session id remains; second reply appends to same thread | screenshot |
| UX-04 | Inspect memory panel | core/recalled/episodic state is understandable and reflects returned data | screenshot |
| UX-05 | If a disposable recalled fact exists, use Forget once | button enters pending state; success/failure appears visibly; no duplicate request | screenshot; otherwise NOT_EXERCISED |
| UX-06 | Inspect route control and Settings | Local available; Hosted shown OFF/effectively disabled under kill switch | screenshot |
| UX-07 | Operations: manual Refresh, toggle Auto 5s off/on | no overlapping refresh glitch; required Phase 4 fleet stays understandable; optional Sync, if unavailable, is clearly labeled optional rather than degrading the fleet | screenshot |
| UX-08 | Settings: click `Load workspace` for the current MCP workspace, then run Local canary only | workspace load completes without local proxy 400/stale swap; MCP server list or explicit empty result is understandable; canary pending/result is visible; Hosted remains OFF | screenshot + console check |
| UX-09 | Space: open two existing pages quickly; create disposable page only if desired | old document is not interactable while new page loads; no stale content swap; owner-backed actions give feedback | screenshot |
| UX-10 | Flow: edit a draft after save/load | Run becomes unavailable while `unsaved changes` is visible; Validate ignores stale results if draft changes during request | screenshot |
| UX-11 | Safe failure: invalid Space block JSON or invalid Flow config JSON | actionable visible error, app remains usable without full reload | screenshot |
| UX-12 | repeat Ai + one management surface at narrow viewport ~390px | no page-level horizontal trap except intentional Flow canvas scroll; controls remain reachable | screenshots |

## Browser console

Record console errors/warnings after each route. Framework/hydration/unhandled-promise errors are defects. Expected application-level request failures intentionally triggered for UX-11 must be distinguished from unhandled browser errors.

The repository now includes an App Router icon asset specifically to prevent the previously observed application-owned `GET /favicon.ico 404` noise from being treated as an unresolved console finding. A clean-console runtime recheck is still required before UX-RUNTIME-006 can be marked runtime-verified.

## Defect ledger format

For every finding record: `ID | severity S0-S3 | route | exact steps | expected | observed | console evidence | disposition`. No S0/S1 may remain for closure; S2 must be fixed or explicitly accepted.

## Minimum screenshots

- desktop Ai before message;
- desktop Ai after successful Local reply;
- same-session second turn;
- Space; Flow; Operations; Settings;
- Settings Hosted OFF plus the exercised MCP workspace load state;
- narrow/mobile Ai;
- narrow/mobile one management surface.

Raw screenshots stay local if they expose machine/user-specific details. Commit only sanitized findings.
