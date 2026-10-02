# Session 11 — MCP Action Product Convergence Closure

Date: **2026-10-02**

Status: **CLOSED / PASS / STAGING VERIFIED**

This checkpoint closes the explicitly authorized Session 11 continuation after Session 10 Deterministic Condition Trigger.

Session 11 productizes the already-existing Flow -> Connect outbound MCP action path so non-time automation can bind to configured external tools without creating a native Gmail/Telegram service, polling daemon, second scheduler, or new authority plane.

Architecture decision: [ADR-40 — MCP action binding tetap Flow → Connect-governed](../adr/0040-mcp-action-flow-connect-boundary.md).

## Closed product/runtime scope

Delivered:

- Flow MCP Tool nodes now expose configured Connect MCP servers as a guided picker;
- tool discovery is explicit and user-initiated for one selected server;
- browser product code receives only list/discovery product surfaces and does not receive an MCP tool-call route;
- Ai creates discovery operation identity server-side and forces browser-triggered discovery to L0 READ;
- Connect/Hub still authorize discovery and remain authoritative for server configuration, tool enablement, action class, credentials, policy, and audit;
- disabled MCP tools remain visible as disabled and are not selectable as executable tools;
- Flow graph continues to store only `serverId`, `tool`, and non-secret `arguments`;
- MCP Tool arguments can bind to runtime Flow input through bounded `{{ path }}` templates;
- an exact template preserves the underlying JSON value type while an embedded template remains text;
- structured argument rendering is bounded by maximum depth and total entries;
- no `eval`, dynamic function, user scripting, or arbitrary expression language is introduced;
- resolved arguments are produced in Flow immediately before dispatch and sent to Connect;
- Connect/Hub governance therefore evaluates the actual resolved arguments used for the remote action;
- existing MCP side-effect idempotency, reservation, and uncertain-outcome semantics remain unchanged;
- Automation UX now makes explicit that external actions remain inside the exact pinned Flow rather than inside Trigger handling;
- Schedule remains time-only and Condition remains event-driven.

## Authority path

Canonical external-action path:

```text
event / webhook / deterministic condition
  -> Flow-owned Trigger
  -> exact pinned Flow version
  -> MCP Tool node
  -> bounded runtime argument resolution
  -> Connect outbound MCP manager
  -> Hub policy / approval / capability governance
  -> configured remote MCP server/tool
  -> Flow / Temporal continuation
  -> Run + audit evidence
```

The browser product surface cannot directly call a remote MCP tool. Discovery is a separate L0 READ path and does not mint execution authority.

## Runtime merge

Runtime PR:

- PR **#431** — `feat: converge Session 11 MCP action product surface`
- final reviewed head: `cd57404e767335e46abbdc8bc629774f32ad2b70`
- merged runtime `main`: `9bd2b87fc4f3755b837c74d6b42585e0c5181870`
- staging image: `staging-9bd2b87fc4f3`

Exact-head gates:

| Gate | Result |
|---|---|
| CI #2691 | PASS |
| Product Eval #1930 | PASS |
| PCS-06 Integrated Browser Acceptance #436 | PASS |
| MCP External HTTPS Acceptance #1240 | PASS |
| Desktop Installer #306 | PASS |

The earlier in-branch red runs were development feedback only: formatting/lint assertions and Playwright `<option>` state checks were corrected before the final reviewed head. Only the final exact reviewed head above is closure evidence.

Merged-main gates:

| Gate | Result |
|---|---|
| CI #2692 | PASS |
| Product Eval #1931 | PASS |
| MCP External HTTPS Acceptance #1241 | PASS |

## Staging proof

Staging workflow remained fail-safe:

- Staging Deploy **#2131**: gate PASS; deploy skipped while merged-main CI was not yet complete;
- Staging Deploy **#2132**: actual deploy PASS.

Actual staging evidence for `9bd2b87fc4f3755b837c74d6b42585e0c5181870`:

- exact expected SHA matched;
- clean DETACHED worktree;
- staging image `staging-9bd2b87fc4f3`;
- public/auth boundary smoke PASS;
- MCP protected-resource metadata and unauthenticated challenge PASS;
- Operations `healthy: true`, `unhealthyServices: []`;
- 15 configured compose services / 15 running / 0 non-running;
- host Ubuntu 24.04.4 LTS, kernel 6.8.0-136-generic, x86_64;
- deployment env metadata passed its existing sanitized host-evidence boundary;
- rollback set retained current `staging-9bd2b87fc4f3` and previous docs-compatible `staging-3d23ec611e80`;
- stale `staging-222b47403a9c` image was removed;
- deployment host evidence observed 23.89 GiB available before final cleanup and stabilized at **25.25 GiB free**;
- PCS-08 staging deploy PASS for the exact SHA/tag.

SumoPod remains staging, not production.

## Post-closure CD hardening

The first docs-only closure merge exposed a deployment-control bug rather than a Session 11 product bug:

- PR #432 merged docs-only `main` `49fe4d26676ab37e4a9cdd5fb7691b9ac3b026a3`;
- CI #2694 and Product Eval #1933 passed;
- Staging Deploy #2136 then rebuilt/redeployed the docs-only SHA as `staging-49fe4d26676a`;
- public/auth + MCP smoke, Operations health, exact-host evidence, and 15/15 service state still passed, but the deployment was unnecessary.

Post-Session-11 CD hardening therefore closed the gap without opening Session 12:

- PR **#433** — `fix: skip docs-only automatic staging deploys`;
- final reviewed head: `f5d9e631c6c28f8716b2c238df17d28a44be57bf`;
- PR-head CI #2698 PASS;
- PR-head Product Eval #1937 PASS;
- merged `main`: `7130dba720cff37a040ce29620b7902b52691e9c`;
- merged-main CI #2699 PASS;
- merged-main Product Eval #1938 PASS;
- Staging Deploy #2145: gate PASS / deploy skipped while peer CI was incomplete;
- Staging Deploy #2146: actual deploy PASS;
- exact host SHA matched `7130dba720cff37a040ce29620b7902b52691e9c`;
- staging image `staging-7130dba720cf`;
- public/auth + MCP smoke PASS;
- Operations `healthy: true`, `unhealthyServices: []`;
- 15 configured services / 15 running / 0 non-running;
- stabilized free disk **27.36 GiB**.

The automatic CD rule is now:

- `workflow_run` auto-CD on a current-main commit that changes only `docs/**` => gate records the SHA but deploy is skipped;
- any non-`docs/**` change => existing current-main + peer-gate + exact-SHA deployment behavior remains active;
- explicit `workflow_dispatch` remains available and is not blocked by the docs-only auto-skip.

This restores the intended sequence: runtime/control change -> exact-SHA staging proof -> docs closure, without making docs closure itself a new runtime deployment.

## Explicit non-claims

This closure does **not** claim:

- a native Gmail connector;
- a native Telegram connector;
- provider-specific OAuth onboarding;
- inbox/chat polling or subscription setup;
- real Gmail/Telegram delivery proof;
- automatic reply semantics for a provider;
- an always-on LLM monitor;
- a first-class Task domain;
- L4 autonomy / AutoClick;
- a second scheduler, queue, execution database, credential store, or policy authority;
- production cutover.

A configured third-party MCP server may provide email, Telegram, or another external action, but that server/provider integration remains operator-configured external capability rather than a native Session 11 adapter.

## Safe resume

Session 11 MCP Action Product Convergence is **CLOSED / PASS / STAGING VERIFIED**.

Future work must preserve:

1. Flow remains graph/action-composition owner;
2. Connect remains outbound MCP transport/credential/runtime owner;
3. Hub remains policy/approval/capability authority;
4. browser product surfaces may list/discover but must not become a direct remote tool-call authority;
5. remote MCP tool enablement and ActionClass remain Connect-owned configuration;
6. runtime arguments must remain bounded/non-secret graph data and be resolved before Connect governance;
7. side-effect idempotency and uncertain-outcome semantics must remain fail-closed;
8. Trigger/Schedule/Condition ownership from Sessions 7–10 remains unchanged;
9. provider-native Gmail/Telegram adapters, OAuth/subscriptions, polling, Task-domain consolidation, L4/AutoClick, and production promotion require separate explicit scopes;
10. no Session 12 is automatically opened by this closure.
