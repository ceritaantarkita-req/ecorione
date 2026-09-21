# ECORIONE — Flow & Responsive UX Redesign

> **CLOSED DESIGN CONTRACT:** retained because W03 verification cites this implementation contract. It is not active work; W03 is closed at its documented real-laptop boundary.


Status: **IMPLEMENTED / W03 CLOSED / RETAINED DESIGN CONTRACT**

Original design date: **2026-09-15** · Reconciled: **2026-09-21**

Source: real-laptop W03 rendered walkthrough on synchronized current main plus direct operator feedback after a second-person usability check.

Closure: the redesign was implemented and the fresh rendered W03 walkthrough passed at the documented real-laptop boundary; see `verification/w03-responsive-flow-implementation-2026-09-15.md`. Later PCS-04 visual/IA closure and PCS-06 integrated browser acceptance do not reopen this design contract.

## 1. Why this exists

The W03 walkthrough proved that the core product routes, local model path, runtime inventory, Space, Flow validation, and failure handling are functional, but it also exposed two product-level UX problems that block closure:

1. **mobile/narrow layouts are still desktop layouts compressed into a small viewport** on several management surfaces, especially Flow;
2. **Flow interaction is not self-explanatory**. A first-time user can miss that node types are clickable, can fail to infer how nodes are connected, and must use a dense inspector before understanding the simple path.

These are not cosmetic-only defects. W03 requires a usable rendered product, so this redesign is part of W03 closure rather than a later visual polish phase.

## 2. Product principles

1. Mobile is a distinct interaction mode, not a shrunken desktop canvas.
2. Common actions must be discoverable without documentation.
3. Flow must support progressive disclosure: **summary → quick settings → advanced configuration**.
4. Node connection must use direct-manipulation affordances comparable to mature node editors: visible ports, hover/focus targets, and clear directional edges.
5. Advanced JSON remains available, but it must not be the first interaction a normal user needs.
6. Existing backend graph schemas, validation, Temporal execution, governance, and fail-closed behavior remain authoritative. The redesign must not weaken execution policy or bypass current APIs.

## 3. App-wide responsive target

### Narrow viewport baseline

Primary acceptance viewport: **390–430 CSS px**.

- Global navigation becomes an icon rail plus overlay drawer; opening it must not push the product surface sideways.
- Main content uses the available viewport width and must not create an accidental page-level horizontal scrollbar.
- Controls stack vertically when horizontal action rows no longer fit.
- Long identifiers, hashes, and URLs wrap or scroll inside their own fields rather than expanding the page.
- Space, Operations, and Settings must remain readable and actionable without pinch-zoom.
- Intentional horizontal panning is allowed only inside a dedicated Flow canvas mode.

### Surface-specific behavior

- **Ai:** composer, replies, metadata, and memory panel remain reachable in one-column flow.
- **Space:** page list becomes a compact horizontal selector, drawer, or top section; document/editor content remains the primary column.
- **Operations:** metrics and service status use stacked cards/rows; traces follow below.
- **Settings:** runtime, vault, and MCP actions stack; async feedback remains visible near the active action and through sticky status feedback.
- **Flow:** default mobile experience is **Stack/List mode**, not a 900px free canvas squeezed into the viewport.

## 4. Flow desktop information architecture

Desktop Flow uses three zones:

1. **Global nav** — unchanged product navigation.
2. **Builder panel on the left** — collapsible, with two modes:
   - `Nodes`: searchable/scan-friendly node catalog;
   - `Configure`: selected-node configuration.
3. **Canvas/work area** — maximal remaining width.

The current permanent inspector on the right is removed. Configuration moves next to the node catalog so the canvas no longer gets squeezed between two side panels.

The builder panel must collapse to a narrow icon rail and reopen without losing selected node state.

## 5. Node catalog affordance

Every node definition row must visibly communicate that it can be inserted:

- category/icon;
- node label;
- short category/supporting text;
- explicit add affordance such as `+` or right-arrow;
- click to insert;
- drag to canvas remains supported on pointer devices.

The row must no longer rely on users discovering that plain text is clickable.

## 6. Canvas node card

Default node cards stay compact. A card shows:

- node kind/category cue;
- label;
- version or run state;
- small configuration summary when useful;
- input port(s) on the left;
- output port(s) on the right;
- `View more` / disclosure affordance.

### Quick settings

`View more` expands an inline or anchored quick-settings area for the few most common fields for that node kind.

Examples:

- AI: target + message;
- HTTP/API: method + URL;
- Delay: duration;
- Condition: operator;
- Approval/Human Input: prompt.

Quick settings update the draft through the same graph state used by advanced configuration.

### Advanced configuration

`Advanced` selects the node and opens the left `Configure` panel. The full editor retains:

- label;
- structured/simple controls where practical;
- raw JSON as an advanced fallback;
- timeout/retry controls;
- delete action;
- validation information relevant to the node.

## 7. Connection interaction

### Ports

Connections use visible ports instead of the current hidden `Mulai koneksi → click target` mental model.

- standard node: one input port left, one output port right;
- Trigger may omit its input;
- Condition/Switch exposes distinct labeled outputs such as `true` and `false`;
- future multi-output node definitions may map ports from the shared schema when available.

### Pointer connection

1. pointer-down/drag from an output port;
2. draw a temporary edge following the pointer;
3. valid target input ports highlight;
4. drop on a valid port to create the edge;
5. Escape/click empty canvas cancels.

### Accessible/click alternative

Clicking an output port enters connect mode; clicking a valid input port completes the edge. The active source is visibly announced in the canvas toolbar/status region.

### Edge behavior

- edge direction remains visually obvious;
- selected edge can be deleted;
- invalid self-connection/unsupported targets do not create graph state;
- all successful edge changes mark the draft dirty and clear stale validation.

## 8. Flow mobile mode

At narrow viewport, Flow defaults to **Stack/List mode**:

- nodes render as ordered cards/steps;
- each card can expand/collapse quick settings;
- connection summary is shown as `From → To` rows/chips;
- `Connect to…` provides an accessible connection method without requiring precise canvas dragging;
- toolbar actions remain reachable;
- advanced config opens as an in-page sheet/section or drawer;
- optional `Canvas` toggle may expose the free canvas for expert users, with horizontal pan contained inside the canvas only.

Desktop and mobile operate on the exact same graph state and APIs.

## 9. Toolbar simplification

Primary Flow toolbar should emphasize:

- flow name;
- Save;
- Validate;
- Run;
- `Saved / Unsaved changes` state.

Less-frequent metadata such as scope, sensitivity, graph id, and version loading may live in a secondary details row/panel so they do not dominate the first-run experience.

Run remains disabled for unsaved drafts and current stale-validation safeguards remain intact.

## 10. W03 acceptance additions

W03 closure required—and subsequently passed—the redesigned current-main recheck with:

1. Ai, Space, Operations, Settings, and Flow at 390–430px with no accidental page-level horizontal trap;
2. Settings Runtime actions all reachable at narrow width;
3. Flow node catalog visibly communicates add/insert behavior;
4. a first-time operator can insert two nodes and connect them using visible ports without using the old inspector connection button;
5. Condition/Switch branch ports are visually distinct;
6. quick settings are available from a node card and advanced config opens from the left builder panel;
7. builder/config panel can collapse and reopen without losing the selected node;
8. mobile Flow Stack/List mode supports node inspection and connection without requiring desktop canvas precision;
9. Save/Validate/Run dirty-state behavior remains unchanged;
10. existing safe-failure behavior for invalid config remains actionable;
11. browser console contains no application-owned framework/hydration/unhandled-promise error.

## 11. Non-goals for this pass

- no change to Temporal workflow semantics;
- no new execution authority;
- no bypass of Hub/MCP/tool policy;
- no replacement of the shared graph schema;
- no claim that normal Ai chat becomes an autonomous agent;
- no removal of raw JSON configuration for advanced/debug use.

## 12. Historical implementation order

1. responsive app-shell and surface cleanup;
2. Flow builder shell: collapsible left panel + simplified toolbar;
3. discoverable node catalog;
4. port-based connections and edge selection/removal;
5. compact node cards + quick settings + advanced config handoff;
6. dedicated Flow mobile Stack/List mode;
7. regression tests for graph-state changes and responsive structural contracts where stable;
8. fresh rendered W03 walkthrough and ledger closure update.
