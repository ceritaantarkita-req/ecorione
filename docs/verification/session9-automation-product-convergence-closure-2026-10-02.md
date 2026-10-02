# Session 9 — Automation Product Convergence Closure

Date: **2026-10-02**

Status: **CLOSED / PASS / STAGING VERIFIED**

This checkpoint closes the explicitly authorized Session 9 continuation after Session 8 Brain product convergence.

The original product notes raised non-scheduled autonomy as an open question because work such as replying to email or Telegram is not naturally expressed as a clock schedule. Session 9 resolves the bounded product gap by exposing the already-proven Flow-owned non-time Trigger substrate. It does **not** create a new autonomous service, Task domain, polling loop, Gmail/Telegram connector, or L4/AutoClick runtime.

## Closed product scope

Session 9 productized existing non-time automation without changing execution ownership:

- first-class **Automation** navigation and `/automations` surface;
- searchable owner-backed Project picker with inline Project creation;
- Project-scoped listing for existing `event` and `webhook` Trigger definitions;
- create and edit event/webhook automations with exact pinned Flow version;
- enable/disable controls remain Flow Trigger mutations under Hub policy;
- Runs remain the unified execution read model and can be filtered from an Automation;
- exact Flow deep links are preserved;
- Schedule remains time-Trigger-only and Temporal remains time-schedule/runtime truth;
- generic webhook automation generates a bounded hook id and exposes the canonical public ingress path;
- Connect-owned per-hook token retrieval is available only through the protected Settings proxy and only by GET;
- revealed webhook tokens are transient UI state and are not written into Trigger definitions, Flow data, docs, or logs;
- public `/webhooks/*` ingress is intentionally outside the browser Basic-Auth gate, but is body-bounded and only proxies to the private Ai route;
- the Ai webhook proxy forwards the external hook token and payload to Connect without minting internal authorization;
- Connect remains the verifier for the derived per-hook token before forwarding a normalized delivery to Flow.

## Authority boundary

The retained execution path is:

```text
external event/webhook caller
  -> bounded public /webhooks/:hookId ingress
  -> Ai transport proxy
  -> Connect per-hook token verification
  -> Flow Trigger matching + Project/pinned-Flow validation
  -> Hub policy / approval / capability authority
  -> Temporal-backed Flow execution
  -> Run projection / audit evidence
```

Canonical ownership remains unchanged:

- Project -> Hub;
- Trigger definitions and dispatch semantics -> Flow;
- connector secrets / webhook root secret / token derivation -> Connect;
- policy, approvals and authority -> Hub;
- durable workflow execution, retry and recovery -> Temporal;
- execution read model -> existing Run projection.

A public webhook caller cannot select Workspace, Project, Flow version, or autonomy. Those values continue to come from the configured Trigger and owner state.

## Runtime merge

Runtime PR:

- PR **#427** — `feat: converge Session 9 Automation product surface`
- final reviewed head: `8f4c91c4e39416abae3eafdaa9e40defecd409f4`
- merged runtime `main`: `7336a7a71f976c1bd202059b0bf6f0983bf95cfd`
- staging image: `staging-7336a7a71f97`

Exact-head gates:

| Gate | Result |
|---|---|
| CI #2651 | PASS |
| Product Eval #1890 | PASS |
| PCS-06 Integrated Browser Acceptance #402 | PASS |

Merged-main gates:

| Gate | Result |
|---|---|
| CI #2652 | PASS |
| Product Eval #1891 | PASS |

The implementation includes deterministic source-contract coverage for the Automation surface, settings-proxy allowlist, public Caddy ingress, and authority exclusions; webhook proxy tests cover token forwarding, invalid hook rejection, and the 96 KiB body boundary. PCS-06 covers desktop/narrow Automation rendering, stale Project reconciliation, existing webhook visibility, and protected token reveal.

## Staging proof

Staging workflow behavior remained fail-safe:

- Staging Deploy **#2051**: gate-only PASS; deploy skipped while the peer required gate was incomplete;
- Staging Deploy **#2052**: actual deploy PASS after both merged-main gates were green.

Actual staging evidence for `7336a7a71f976c1bd202059b0bf6f0983bf95cfd`:

- exact expected SHA matched;
- clean DETACHED worktree;
- staging image `staging-7336a7a71f97`;
- auth bootstrap and protected operator/API surfaces PASS;
- MCP protected-resource metadata and unauthenticated challenge PASS;
- standard public smoke PASS for `https://ecorione.inmydraft.com`;
- Operations `healthy: true`, `unhealthyServices: []`;
- 15 configured compose services / 15 running / 0 non-running;
- host Ubuntu 24.04.4 LTS, kernel 6.8.0-136-generic, x86_64;
- rollback set preserved the current and previous staging images;
- capacity stabilized at **27.44 GiB free**;
- PCS-08 staging deploy PASS for exact SHA/tag.

This staging proof confirms the exact Session 9 runtime and edge configuration are deployed and healthy. It does **not** claim a real third-party Gmail/Telegram/provider delivery was executed; provider-specific connectors are outside this session.

SumoPod remains staging, not production.

## Explicit non-claims

This closure does **not** claim:

- production cutover;
- `condition` Trigger activation;
- polling or an always-on LLM monitor;
- a first-class Task domain;
- a new autonomous service;
- L4 autonomy or AutoClick;
- provider-specific Gmail or Telegram connectors;
- automatic reply behavior;
- a second scheduler, queue, execution database, credential store, or policy authority;
- external caller authority over Workspace, Project, Flow, version, or autonomy.

## Safe resume

Session 9 Automation product convergence is **CLOSED / PASS / STAGING VERIFIED**.

Future work must preserve these compatibility requirements:

1. Schedule remains time-trigger UX and Temporal remains schedule/durability owner;
2. Automation remains a product surface over Flow-owned `event` / `webhook` Triggers;
3. Project routing and exact pinned Flow versions remain owner-backed;
4. webhook credentials/token derivation remain Connect-owned;
5. public ingress remains body-bounded and cannot mint internal authority;
6. Hub policy/approval/capability boundaries remain mandatory before execution;
7. Runs remain the execution read model;
8. `condition`, polling, provider-specific connectors, Task-domain consolidation, and higher autonomy require separate explicit scopes;
9. production promotion remains separate.
