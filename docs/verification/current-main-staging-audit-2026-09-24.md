# Current main + staging parity audit — 2026-09-24

Status: **AUDIT COMPLETE / A-00 + A-01 + A-12 CLOSED-PASS / LOWER-PRIORITY FINDINGS REMAIN OPEN**

## Post-audit closure update — 2026-09-25

The audit baseline and original no-mutation conclusions below remain historical evidence. Subsequent explicitly authorized work has now closed every CRITICAL/HIGH finding from this audit:

- **A-00 CRITICAL human-authentication boundary — CLOSED / PASS** through the private-by-default Ai edge closure documented in [ai-human-auth-closure-2026-09-24.md](ai-human-auth-closure-2026-09-24.md).
- **A-12 HIGH owner remote-bind fail-open configuration — CLOSED / PASS** through PR #308 / merge `e4810e0d7980682028be67634fa430090fe9bf92`; automatic Staging Deploy #809 passed exact merged main.
- **A-01 HIGH internal HTTP timeout coverage — CLOSED / PASS** through PR #309 / merge `2ee12fd454ade78ce1bf732390334726980e0451`; automatic Staging Deploy #821 passed exact merged main.

The exact safe handoff, runtime evidence, test gates, remaining lower-priority findings, and next authorized discussion scope are recorded in [session-4-high-findings-safe-checkpoint-2026-09-25.md](session-4-high-findings-safe-checkpoint-2026-09-25.md).

## Scope

This audit covers the two explicitly requested tracks:

1. current `main` repository/product audit across architecture, UI/UX, API/service ownership, Flow/Temporal, Brain, Context, Hub, Connect/MCP, Sandbox/Sync, security/reliability, tests, and maintainability;
2. repository-versus-staging evidence audit: identify what is product-runtime parity versus what exists only in newer repository operations/docs.

No staging deployment, provider mutation, secret mutation, DR-2 resume, production promotion, or paid infrastructure action is part of this audit.

## Exact repository baseline

~~~text
main=4143adf2185e82d5c8713dc6c148ba828b104d07
~~~

Current-main gates already passed:

- CI #1929 — PASS;
- Product Eval #1168 — PASS;
- Staging Deploy #622 — gate PASS, deploy SKIPPED.

CI #1929 included format, lint, typecheck, regular tests, Phase 4 real-process acceptance, production-operations acceptance, working-tree/full-history secret scans, dependency policy review, GitHub Actions pin/runner review, Node/installer toolchain review, container-image digest review, release-security acceptance, and production build.

The regular test stage reported **210 test files passed + 1 skipped** and **1114 tests passed + 2 skipped**.

## 1. Repository architecture assessment

### Strong / retained boundaries

The architecture remains internally coherent:

- **Ai** is the browser/product surface;
- **Hub** owns policy, approval, capability authority, Projects, Historical Ledger and orchestration;
- **Flow** owns graph and Trigger definitions;
- **Temporal** remains durable schedule/retry/workflow truth;
- **Context** remains retrieval/memory-semantics owner;
- **Artifact** remains raw artifact-byte owner;
- **Connect** remains provider/model credentials, routing, MCP and spend owner;
- **Sandbox** remains governed execution boundary;
- **Space** remains composition/workspace document owner;
- **Sync** remains device/ciphertext relay and MCP bridge;
- **RnD** remains trace/evidence/dataset surface.

No cross-service database access pattern was found in the audited dependency topology. Service packages depend on shared contracts/server helpers rather than importing another service's database implementation.

The current product architecture also correctly avoids introducing a second scheduler, a second canonical Brain store, or a separate autonomous service.

### Deployment shape

The main Compose topology remains 15 services: 12 ECORIONE application/runtime roles plus Temporal, Temporal Postgres, and Caddy. Only Caddy is the application edge in base Compose; SumoPod uses the existing Traefik edge overlay while retaining Caddy as ECORIONE's routing/policy boundary.

## 2. Exact main-versus-staging product parity

This is the strongest result of the audit.

Git-tree identities are unchanged across historical proven staging commit `52046db35e403babdda934881773c46bf2c57b68`, original-DR runtime source `b27c1e5833be0a0fccf3f525d82ae8853cd22113`, and current `main`:

| Product tree | 52046db | b27c1e58 | current main | Result |
|---|---|---|---|---|
| `apps/` | `10339ff31ffde5a18c3ed2621b991212ee7281e3` | same | same | exact parity |
| `services/` | `137cb974fda63d6c6c87d623e0c222079dad5676` | same | same | exact parity |
| `packages/` | `de1f62cfe4e9220d2efc0e2bce31cd4ba0e383b2` | same | same | exact parity |

Core staging deployment files are also byte-identical across those revisions:

- `deploy/compose.yml` -> `755a0422576e771c52382aa42e32d476473ef76b`;
- `deploy/compose.sumopod.yml` -> `68f8757f0927b1a55c7402a552395b65f55ac50d`;
- `deploy/Caddyfile` -> `a517ef904cff8a4d50f3b7909522ad22e08459ee`;
- `deploy/Caddyfile.sumopod` -> `a683e561012a766231c63834a4b278e357a7d57b`.

Therefore current GitHub `main` does **not** contain newer user-facing application/service/package code waiting to be deployed to staging.

The 26 commits from `52046db...` to `b27c1e...` were documentation/off-host-DR tooling/tests and the standalone recovery overlay. The later 137 commits from `b27c1e...` to current `main` were again documentation/DR tooling/tests/package script exposure. No `apps/`, `services/`, or `packages/` product-tree change occurred.

### Important staging claim boundary

This parity proves repository-product equivalence, not fresh live-host health on 2026-09-24. A fresh direct live SumoPod probe was not available during this audit. Historical runtime evidence and the closed DR evidence remain valid, but this document does not invent a new current-host uptime/health claim.

## 3. Findings

### A-00 — CRITICAL — CLOSED / PASS — public Ai surface had no human authentication boundary

Tracking issue **#287** is closed at the documented urgent private-by-default staging boundary. The original finding text below is retained as historical audit evidence.

**Type:** authentication / confidentiality / integrity / spend exposure.

The self-host/SumoPod Caddy policy protects only `/ops*`, `/api/ops*`, `/settings*`, and `/api/settings*` with Basic Auth. The general fallback routes every other Ai page/API request directly to `ai:3000`. The SumoPod Traefik overlay publishes that Caddy service without an additional authentication middleware.

Ai route handlers then inject `ECORIONE_INTERNAL_TOKEN` server-side when calling Hub/Connect/owner services. There is no separate authenticated human principal/session at the Ai boundary.

The same-origin middleware is a CSRF boundary, not authentication:

- safe methods such as GET are always allowed;
- mutation requests without `Sec-Fetch-Site` and `Origin` are intentionally accepted for curl/native/smoke clients.

Consequently, any network client that can reach the Ai edge can, at the source-policy level, call non-operator Ai APIs without proving user identity. Concrete exposed capabilities include:

- `GET /api/projects?workspaceId=ws_personal` -> Hub Project listing;
- Project history/session replay APIs -> Historical Ledger conversation metadata/content up to the route's `RESTRICTED` grant;
- Brain/Space/Flow reads;
- direct non-browser mutation requests to Project, Space, Flow, attachment, memory-forget, voice, and chat routes;
- chat requests can cross the server-side internal bearer boundary and may consume configured model capacity/spend.

This is not merely a cross-origin browser attack: the origin middleware explicitly treats headerless non-browser requests as allowed.

The exact `apps/` and Caddy/SumoPod routing files are byte-identical between the historically proven staging runtime and current audit baseline. Historical staging acceptance also proved the public home path returned 200 while only operator surfaces were expected to return 401. A fresh live-host probe was not performed in this audit, so this finding does **not** claim the SumoPod hostname is currently online; it does prove the reviewed public-edge design lacks user authentication whenever that edge is reachable. The native desktop Compose path binds Ai to `127.0.0.1`, so this is primarily a reachable remote-edge defect rather than evidence that the local desktop surface is internet-exposed.

**Recommended future scope:** before further public/staging feature work, add one fail-closed human-auth boundary for the Ai surface (edge or application session), define a minimal explicit allowlist for endpoints that are genuinely public, preserve MCP/OAuth routes as their separate authenticated protocol boundary, and add unauthenticated negative-path acceptance for Project/history/chat/mutation APIs.

### A-01 — HIGH — CLOSED / PASS — internal HTTP timeout coverage was incomplete

**Type:** reliability / partial-failure containment.

`packages/shared-server/src/client.ts` makes `AbortSignal` optional and supplies no default timeout. Several core call sites perform owner/service HTTP calls without a signal.

Audited examples include:

- Brain owner projection -> Hub/Flow in `apps/ai/lib/brain-projection.ts`;
- Project Source owner verification in `services/hub/src/project-source-http.ts`;
- Flow Project checks in `services/flow/src/trigger-http.ts`;
- scheduled Trigger Project authorization in `services/flow/src/trigger-activities.ts`;
- selected owner/audit paths that use `httpJson` without a bounded signal.

Some previously hardened paths already use explicit timeouts, so the policy is inconsistent rather than absent.

**Risk:** a dependency that accepts a connection but stalls can hold a browser request, Trigger path, worker activity, or owner verification much longer than the bounded-failure behavior used elsewhere.

**Closure:** PR #309 added a 10-second default internal HTTP deadline at the shared boundary, preserved tighter caller-owned signals, bounded the remaining Brain owner fetch, and added deterministic stalled-upstream/source-contract coverage. Exact-head CI #2026, Product Eval #1265, MCP External HTTPS #1029, and PCS-06 #34 passed; merged main `2ee12fd454ade78ce1bf732390334726980e0451` then passed CI #2027, Product Eval #1266, MCP External HTTPS #1030, and automatic Staging Deploy #821.


### A-12 — HIGH — CLOSED / PASS — remote bind could fail open without an internal bearer token outside guarded Compose paths

**Type:** security configuration / defense-in-depth.

`packages/shared-server/src/server.ts` makes two independent decisions:

- `bindHost()` returns `0.0.0.0` when `ECORIONE_ALLOW_REMOTE_BIND=1`;
- bearer authentication is skipped entirely when `createServer(...)` receives no token.

The production entrypoints for RnD, Context, Connect, Hub, Artifact, Sandbox, Space, and Flow all read `ECORIONE_INTERNAL_TOKEN` as optional and then call `bindHost()` independently. A direct/manual service launch can therefore combine remote bind with an absent internal token and expose an owner service unauthenticated.

The reviewed Compose paths are **not currently exposed by this configuration gap**: both `deploy/compose.yml` and `desktop/compose.yml` set `ECORIONE_ALLOW_REMOTE_BIND=1` while requiring `ECORIONE_INTERNAL_TOKEN` with Compose's mandatory-variable syntax. The finding is a latent fail-open direct/self-host configuration surface, not evidence of a current SumoPod staging breach.

**Closure:** PR #308 added a fail-closed authenticated bind helper and moved RnD, Context, Connect, Hub, Artifact, Sandbox, Space, and Flow production entrypoints onto it. Loopback remains valid without the internal token, while non-loopback startup now refuses to proceed without authentication material. Exact-head CI #2020, Product Eval #1259, MCP External HTTPS #1023, and PCS-06 #29 passed; merged main `e4810e0d7980682028be67634fa430090fe9bf92` then passed automatic Staging Deploy #809.

### A-13 — MEDIUM — Space standalone default points at the Ai fallback port instead of Flow

**Closure update — 2026-09-25: CLOSED / PASS.** PR #312 / merge `d8d2a113c917cee87f2d43a5a2243eda2e4d2173` changed the Space standalone/default Flow owner URL to canonical port `17028`, centralized the fallback while preserving explicit overrides, and added deterministic owner-port contract coverage. Exact-head CI #2032 + Product Eval #1271 passed; merged-main CI #2033 + Product Eval #1272 passed; automatic Staging Deploy #833 executed and passed on exact `d8d2a113...`. The original audit evidence and recommendation below are retained as historical discovery context.

**Type:** reliability / configuration-default defect.

Canonical Flow port is `17028` in `.env.example`, Flow itself, Hub, Connect, worker configuration, Ops aggregation, and Compose. Ai fallback ports are `17029–17039`.

However:

- `services/space/src/main.ts` defaults `ECORIONE_FLOW_URL` to `http://127.0.0.1:17029`;
- `services/space/src/http.ts` uses the same `17029` fallback when `flowUrl` is omitted.

Compose explicitly injects `http://flow:17028`, so the proven staging/desktop Compose paths are not affected. A standalone/default Space process can nevertheless resolve Flow-linked or AI-linked blocks against the wrong port.

**Recommended future scope:** change both Space defaults to `17028` and add a deterministic source/runtime regression test so the owner port map cannot drift.

### A-02 — MEDIUM — Projects “All” is rendered as a button but has no behavior

**Type:** confirmed static UX defect.

`apps/ai/app/projects/page.tsx` renders the virtual **All** entry as a button with no click handler or state transition. It is visually interactive but does nothing.

### A-03 — MEDIUM — persisted Project selection can become stale

**Type:** UX/state-consistency risk.

Ai, Work, and Brain independently read `ecorione.projectId` from browser local storage and accept any syntactically valid `prj_...` ID before reconciling it against the active Project list.

When a custom Project is archived, `apps/ai/app/projects/page.tsx` moves its local selected state back to Personal but does not clear/update the persisted `ecorione.projectId`.

Likely failure path: a previously selected Project is archived -> local storage still points to it -> later Ai/Work/Brain boot against the archived ID -> owner APIs fail until the user explicitly chooses another active Project.

This should receive a deterministic regression test before repair.

### A-04 — PRODUCT GAP — Project creation/settings are thinner than the intended product

The backend Project model supports name, description, instruction, autonomy ceiling, and fixed memory policy `GLOBAL_PLUS_PROJECT`. Hub exposes Project PATCH.

The current Ai Projects surface creates by name only, displays memory/autonomy metadata, does not expose description/instruction/autonomy editing, has no same-origin Ai API route for generic Project PATCH, and cannot offer a meaningful memory-policy selector because V1 memory policy is currently a single literal.

### A-05 — PRODUCT GAP — Project Sources are bindings, not source onboarding/ingestion

Current Project Sources support references to Artifact, Space page, Flow graph, MCP server, and HTTPS URL.

Not currently implemented in the Project surface:

- Google Drive connection/onboarding;
- direct document/photo/folder upload as Project Source;
- browsing/selecting connector resources;
- URL content ingestion from the Projects page.

For URL bindings specifically, Hub marks the binding available after schema validation; it does not fetch/ingest the URL as part of Project Source attachment. This is correct for the current reference-only contract but should not be presented as if URL content has been connected and indexed.

### A-06 — PRODUCT GAP — Schedule is operationally real but not yet the requested calendar UX

The runtime architecture is real and sound: Schedule is a time Trigger UI, Flow owns Trigger definition, Temporal owns schedule truth, exact Flow version is pinned, timezone/catch-up/overlap/autonomy are represented, and linked Runs are exposed.

Current product gaps:

- views are `list/day/week/month`; **year is absent**;
- day/week/month render a filtered upcoming-occurrence **timeline**, not a calendar grid;
- there is no date cursor or previous/next period navigation;
- Project selection is a native `select`, not searchable autocomplete;
- no inline “+ new Project” action;
- no embedded AI/chat composer for natural-language schedule creation/editing.

This should be treated as UX/product evolution, not a scheduler-backend rewrite.

### A-07 — MEDIUM PRODUCT/UX — Brain V1 becomes unreadable at allowed graph sizes

Brain V1 correctly implements a deterministic, rebuildable connected-dot projection and preserves owner authority.

Current node types are Project, Source, Flow, Trigger, and Run. The graph query allows up to 120 visible nodes and 50 Runs. The SVG uses a fixed `1080 x 640` viewbox and vertically spaces every node type by `step = 640 / (group.length + 1)`.

Run nodes have radius 18. At 50 Runs, vertical step is about 12.5 px while node diameter is 36 px. Overlap is therefore deterministic well before the allowed limit.

The page has no pan or zoom control.

### A-08 — PRODUCT GAP — Brain does not yet represent the full intended knowledge/file graph

Brain currently derives Project Source + Flow + Trigger + Run relationships. It does not expose first-class nodes for memory/facts, individual files/folders unless indirectly represented by a source owner artifact/reference, or connector-resource hierarchy. Time schedule is represented through Trigger rather than a distinct visual node.

The current page also has no embedded AI/chat surface.

The correct future direction is to expand the derived projection from canonical owners, not introduce a second graph database.

### A-09 — MEDIUM — frontend maintainability concentration

Largest current product files include approximately:

- `apps/ai/app/flow/page.tsx` — 65 KB;
- `apps/ai/app/settings/page.tsx` — 50 KB;
- `apps/ai/app/page.tsx` — 43 KB;
- `apps/ai/app/work/page.tsx` — 35 KB;
- `apps/ai/app/space/page.tsx` — 32 KB.

These files mix state orchestration, API calls, derived view state, and substantial presentation logic. CI is green, but the next feature iteration should extract domain hooks/components instead of continuing to grow these page modules.

### A-10 — MEDIUM — Compose readiness is weaker than the runtime acceptance tooling

Base Compose defines an explicit Docker healthcheck for Temporal Postgres, but not for the ECORIONE app services. Many service relationships use `depends_on` without service-health conditions.

The repository acceptance scripts compensate by waiting/probing after startup, but ordinary Compose startup has a weaker readiness contract. This can create transient dependency-start races and makes “container running” weaker than “service ready”.

### A-11 — LIMITATION — browser-facing product is personal-workspace-first

Several Ai product surfaces intentionally hardcode `ws_personal` and default `prj_personal`. This is consistent with the current single-owner V1 model and is not a security bug, but multi-workspace/multi-user UX cannot be layered cleanly without first removing page-level personal-workspace assumptions.

## 4. Security audit result

At the original audit baseline, one CRITICAL human-authentication defect and two HIGH findings were identified. Those CRITICAL/HIGH findings are now CLOSED / PASS through the explicitly authorized follow-up work summarized above. This document keeps the original findings for traceability; it should not be read as claiming they remain open on current main. Lower-priority findings remain separately bounded.

Positive evidence:

- current-main CI secret-history and working-tree scans pass;
- dependency policy review passes;
- release-security acceptance passes;
- GitHub Action pins/runner policy pass;
- container image digest review passes;
- no live-code `FIXME` / `HACK` backlog was found;
- no application `eval(...)` use was found;
- Sandbox host execution uses explicit allowlisting and `spawn(..., shell: false)`;
- tier-1 Docker sandbox drops capabilities, disables network, uses a read-only root filesystem, no-new-privileges, non-root UID, memory/CPU/PID limits;
- Project/Flow/Brain paths retain explicit Workspace/Project constraints;
- Trigger autonomy is capped at L3;
- credentials remain Connect-owned rather than copied into Ai.

This is a bounded source/repository conclusion, not a penetration-test claim.

## 5. Staging/operations findings

Historical staging evidence shows the 15-service topology functioning and the public/Ops boundary passing at the closed staging/DR checkpoints.

The repository-product parity result means a new deploy is **not required merely to synchronize product feature code**.

Operational drift does exist: current `main` contains newer DR/fetch/start/physical-independence scripts and tests than the historical product image revision. Those operational changes were intentionally not followed by an application deployment. Therefore product parity and operator-script parity on a live host remain separate claims.

Historical host evidence also showed pending Ubuntu security updates and meaningful Docker image reclaim potential from retained older tagged images. Those are maintenance observations only until freshly re-measured.

## 6. Product-intent reconciliation

| Intended capability | Current implementation | Audit result |
|---|---|---|
| Project menu + Personal/custom Projects | implemented | strong base |
| virtual All | rendered but inert | defect |
| Project history/chat | implemented | strong base |
| Project setup/memory controls | partial | gap |
| Project sources | reference bindings | needs connector/upload onboarding |
| Schedule connected to Project/Flow | implemented | strong base |
| durable scheduling | Temporal-backed | strong base |
| day/week/month/list | occurrence timeline | partial UX |
| year/calendar navigation | absent | gap |
| AI-assisted Schedule chat | absent | gap |
| Brain connected-dot graph | implemented | strong base |
| Brain Project/Flow/Trigger/Run links | implemented | strong base |
| Brain file/folder/memory richness | partial | gap |
| Brain chat | absent | gap |
| autonomous service | intentionally absent | correct boundary |
| non-time automation | event/webhook Trigger exists | correct foundation |

## 7. Recommended next implementation order

This audit does **not** authorize implementation automatically.

1. fail-closed human authentication for the public Ai surface + unauthenticated negative-path tests;
2. fail-closed remote-bind/auth startup invariant + regression tests;
3. bounded internal HTTP timeout policy + stalled-upstream tests;
4. Space Flow default-port correction + regression test;
5. Project state/UI correctness: virtual All + stale persisted Project reconciliation;
6. Project settings + source onboarding UX;
7. Schedule calendar/navigation/year + AI-assisted schedule interaction;
8. Brain scalable layout/pan/zoom + richer canonical-owner projection;
9. frontend module decomposition while touching those surfaces;
10. Compose readiness/health improvements;
11. fresh staging runtime acceptance after selected changes merge.

Do not open a new autonomous service, graph database, scheduler, or cross-service database path to solve these items.

## 8. Safe checkpoint

It is safe to stop after this audit.

~~~text
repository main: 4143adf2185e82d5c8713dc6c148ba828b104d07
runtime mutation: none
staging deployment: none
DR-2: still deferred
production: still deferred
implementation of audit findings: not started
~~~

The next conversation may choose which audit finding becomes the first bounded implementation checkpoint.