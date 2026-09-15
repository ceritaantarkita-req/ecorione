# UX Runtime Walkthrough Checklist

Status: **COMPLETE / W03 CLOSED ON 2026-09-15**

This checklist remains the reusable procedure for future regressions. W03 closure was completed on the verified Windows operator baseline described in `docs/verification/w03-responsive-flow-implementation-2026-09-15.md`.

Run future rechecks only on synchronized clean **current `origin/main`** with `ECORIONE_COST_KILL_SWITCH=1`. PR #65 / `f3f5fca3d20ddd35e1a4c4a7fbd6983a33db85ca` remains part of the required UX ancestry; do not checkout that older SHA merely to run evidence.

## 2026-09-15 W03 closure result

The final W03 pass established:

```text
Windows canonical stack: READY
tracked worktree: clean
strict UX/product inventory: PASS
Hosted effective state: OFF
local model: qwen3.5:9b
immutable digest: verified/pinned
desktop walkthrough: PASS
390–430 px responsive walkthrough: PASS
Flow Stack / Canvas usability: PASS
Trigger → AI governed execution: COMPLETED
Condition true/false wiring: PASS
Condition truthy run: Trigger/Condition/AI SUCCEEDED, false-branch Artifact SKIPPED
clean-console Local chat exact response UX_CONSOLE_OK: PASS
S0 open: 0
S1 open: 0
S2 open/unaccepted: 0
```

UX-05 remained `NOT_EXERCISED` because no disposable recalled fact was available; that is an allowed disposition under this checklist.

The previously observed `VM... / reportAllChanges / startTime` exception was tooling/browser-injected noise and was not reproducible as an application-owned error during the clean-console check.

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

`engine:start` is the canonical cross-platform launcher: it reads root `.env`, reuses or starts Temporal, starts the required Phase 4 fleet, waits for readiness, and serves Ai at `http://127.0.0.1:3000`. Leave terminal A running during the walkthrough.

7. In **PowerShell terminal B**, force the kill switch again and run the strict inventory:

```powershell
$env:ECORIONE_COST_KILL_SWITCH = "1"
pnpm evidence:ux:inventory
```

The inventory may hydrate `ECORIONE_INTERNAL_TOKEN` from root `.env` when the shell does not already contain it, but it never prints the token and it never imports the kill-switch value from `.env`. It fails closed unless the shell explicitly has `ECORIONE_COST_KILL_SWITCH=1`, and independently verifies that the running product reports Hosted effectively OFF.

8. Stop on inventory FAIL. PASS must include all eight required owners, all five primary surfaces, pinned local model digest, Settings MCP workspace-list proxy, Ops, Space, and Flow checks.
9. Open `http://127.0.0.1:3000` with browser DevTools Console visible. Prefer a browser profile without extensions for final console evidence.

`Sync` is not part of the required local Phase 4 fleet. Operations may expose its optional health when available; unavailable optional Sync must be labeled optional and must not degrade the required fleet.

## Desktop walkthrough

| ID | Action | PASS observation | Evidence |
|---|---|---|---|
| UX-01 | Use global nav Ai → Space → Flow → Operations → Settings → Ai | every surface reachable, correct active nav, no manual URL entry | one screenshot collage or per-surface screenshots |
| UX-02 | Send one Local message: `Balas tepat: UX_LOCAL_OK` | waiting state appears once, one reply appears, route/model/cache/cost line visible, no duplicate turn | screenshot + console check |
| UX-03 | Send second Local message: `Balas tepat: UX_CONTINUITY_OK` | same displayed session id remains; second reply appends to same thread | screenshot |
| UX-04 | Inspect memory panel | core/recalled/episodic state is understandable and reflects returned data | screenshot |
| UX-05 | If a disposable recalled fact exists, use Forget once | button enters pending state; success/failure appears visibly; no duplicate request | screenshot; otherwise NOT_EXERCISED |
| UX-06 | Inspect route control and Settings | Local available; Hosted shown OFF/effectively disabled under kill switch | screenshot |
| UX-07 | Operations: manual Refresh, toggle Auto 5s off/on | no overlapping refresh glitch; required fleet stays understandable; optional Sync remains explicitly optional | screenshot |
| UX-08 | Settings: `Load workspace` for current MCP workspace, then Local canary only | explicit empty/list state is visible near the action; canary pending/result remains visible while working lower on the page; Hosted remains OFF | screenshot + console check |
| UX-09 | Space: switch quickly between two pages | old document is not interactable while new page loads; no stale content swap; selected page and content agree | screenshot |
| UX-10 | Flow: edit after save/load, Validate, edit again | Run unavailable while dirty; stale validation is cleared/ignored after draft change | screenshot |
| UX-11 | Safe failure: invalid Space block JSON or invalid Flow config JSON | actionable visible error; app remains usable without full reload | screenshot |

## Flow redesign walkthrough

| ID | Action | PASS observation |
|---|---|---|
| UX-F01 | Scan the Flow node catalog as a first-time user | each node visibly communicates add/insert behavior; click-to-add and drag remain available |
| UX-F02 | Insert two ordinary nodes | cards appear without requiring knowledge of the inspector; draft becomes dirty |
| UX-F03 | Connect two nodes using visible ports | output/input ports are visible; drag or click connection succeeds; edge appears; draft becomes dirty |
| UX-F04 | Add Condition/Switch and inspect its outputs | `true` and `false` branch ports are visually distinct and usable |
| UX-F05 | Open `View more` on a node | common settings are available without raw JSON |
| UX-F06 | Open advanced configuration | left builder panel switches/opens Configure; selected node state is preserved |
| UX-F07 | Collapse and reopen builder panel | canvas gains room; reopening preserves selected node and configuration draft |
| UX-F08 | Delete/select an edge or cancel active connect mode | graph remains consistent; no phantom edge is created |

## Narrow/mobile walkthrough

Primary viewport: **390–430 CSS px**.

| ID | Surface | PASS observation |
|---|---|---|
| UX-12A | Ai | composer, replies, metadata, memory panel reachable; no accidental page-level horizontal trap |
| UX-12B | Space | page navigation and active page remain usable without pinch-zoom or page-level horizontal trap |
| UX-12C | Operations | fleet metrics/services/traces stack readably; controls reachable |
| UX-12D | Settings | Runtime/Vault/MCP actions stack; hashes/URLs do not expand the page; all buttons reachable |
| UX-12E | Flow default mobile mode | Stack/List mode is usable without desktop-canvas precision; node cards/config/connect actions reachable |
| UX-12F | Flow optional Canvas mode | any horizontal panning is contained inside Flow canvas only, never the full page |

For Flow functional acceptance, additionally prove on the narrow viewport that a saved graph can expose connection controls/summaries for Condition `true` and `false` outputs. The 2026-09-15 closure graph used:

```text
Trigger [out] → Condition / Switch
Condition / Switch [true] → AI
Condition / Switch [false] → Artifact
```

The real run used a truthy input and completed with the false branch skipped, confirming branch semantics without requiring the inactive Artifact branch to execute.

## Flow execution authority

Flow execution authority is fail-closed. A declaration visible in Flow does not itself grant `node.execute`.

If a node run fails with an authority denial, use the normal Hub governance path for the exact node definition:

```text
authority.grant request
→ POLICY_ADMIN approval required
→ explicit operator decision
→ retry exact grant request
```

Do not bypass authority, auto-grant broad node families, or weaken the policy merely to make the walkthrough pass.

## Browser console

Record console errors/warnings after each route. Framework/hydration/unhandled-promise errors are defects. Expected application-level request failures intentionally triggered for UX-11 must be distinguished from unhandled browser errors.

The repository includes an App Router icon asset to prevent the previously observed application-owned `GET /favicon.ico 404` noise. Extension/tooling-injected `VM...`/anonymous script errors are not application defects unless reproduced in a clean browser context or directly correlated with an ECORIONE interaction.

## Defect ledger format

For every finding record: `ID | severity S0-S3 | route | exact steps | expected | observed | console evidence | disposition`.

Closure rule:

- no S0/S1 may remain open;
- any S2 must be fixed or explicitly accepted;
- expected governed failures must not be mislabeled as successful product execution;
- tooling/browser noise must be separated from application-owned errors using a clean-console reproduction check.

## Minimum screenshots

- desktop Ai after successful Local reply;
- same-session second turn;
- Space with two pages;
- Flow desktop showing visible ports and left builder/config panel;
- Flow node quick settings;
- Operations;
- Settings Hosted OFF plus MCP workspace-load/canary feedback;
- narrow Ai;
- narrow Space or Operations;
- narrow Settings;
- narrow Flow Stack/List mode;
- for a branch-wiring regression, narrow Flow showing Condition `true`/`false` connection summaries.

Raw screenshots stay local if they expose machine/user-specific details. Commit only sanitized findings.
