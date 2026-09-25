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

**Closure update — 2026-09-25: CLOSED / PASS.** PR #314 / merge `591b54131c2d0b53532f33e08b878c15a0617951` made **All** an explicit virtual aggregate state, opened the existing workspace-scoped Historical Ledger metadata path by allowing omitted `projectId`, preserved per-Project memory/source isolation, and routed aggregate conversation links through their owning real Project. Exact-head CI #2041, Product Eval #1280 and PCS-06 browser #41 passed; merged-main CI #2042 and Product Eval #1281 passed; automatic Staging Deploy #851 executed and passed on exact `591b5413...`. The original audit evidence below is retained as historical discovery context.

**Type:** confirmed static UX defect.

`apps/ai/app/projects/page.tsx` renders the virtual **All** entry as a button with no click handler or state transition. It is visually interactive but does nothing.

### A-03 — MEDIUM — persisted Project selection can become stale

**Closure update — 2026-09-25: CLOSED / PASS.** PR #316 / merge `8bbaf855b4f415afbe09eb9b6d16f9c1df6e1f8e` introduced one shared active-Project reconciliation contract across Ai/Work/Brain. Persisted/query candidates are accepted only when present in the active Project list; archived/missing candidates converge to active Personal or the first active Project, and owner reads are blocked until reconciliation completes. Exact-head CI #2050, Product Eval #1289 and PCS-06 browser #47 passed; merged-main CI #2051 and Product Eval #1290 passed; automatic Staging Deploy #869 executed and passed on exact `8bbaf855...`. The original audit evidence below is retained as historical discovery context.

**Type:** UX/state-consistency risk.

Ai, Work, and Brain independently read `ecorione.projectId` from browser local storage and accept any syntactically valid `prj_...` ID before reconciling it against the active Project list.

When a custom Project is archived, `apps/ai/app/projects/page.tsx` moves its local selected state back to Personal but does not clear/update the persisted `ecorione.projectId`.

Likely failure path: a previously selected Project is archived -> local storage still points to it -> later Ai/Work/Brain boot against the archived ID -> owner APIs fail until the user explicitly chooses another active Project.

This should receive a deterministic regression test before repair.

### A-04 — PRODUCT GAP — Project creation/settings are thinner than the intended product

**Closure update — 2026-09-25: CLOSED / PASS.** PR #318 / merge `33d54928de60ba3f6d8cd3770c18d7ad5eea6f98` added the same-origin Project PATCH path and Projects settings UI for name, description, instruction, and autonomy ceiling. The single V1 memory policy `GLOBAL_PLUS_PROJECT` is intentionally displayed read-only rather than represented as a fake selector. The later Session 8 source-ingestion sequence preserved this ownership/model boundary and final implementation main `3dd350e938d3651e75fc81ac30e9ef751c477ca5` reached staging through successful Staging Deploy run `36109914350`.

The backend Project model supports name, description, instruction, autonomy ceiling, and fixed memory policy `GLOBAL_PLUS_PROJECT`. Hub exposes Project PATCH.

The current Ai Projects surface creates by name only, displays memory/autonomy metadata, does not expose description/instruction/autonomy editing, has no same-origin Ai API route for generic Project PATCH, and cannot offer a meaningful memory-policy selector because V1 memory policy is currently a single literal.

### A-05 — PRODUCT GAP — Project Sources are bindings, not source onboarding/ingestion

**Closure update — 2026-09-25: CLOSED AT GENERIC CONNECTOR BOUNDARY.** Session 8 closed the currently authorized source slices through PRs #319–#324: owner-backed source selection, direct file -> Artifact ingestion, separate Project-scoped extraction, hardened HTTPS URL snapshot ingestion, and browsing/ingesting concrete resources from a Project-bound MCP server. Generic connector snapshots are stored as `RESTRICTED + LOCAL_ONLY`, exact resource reads require explicit `mcp.resource.read / mcp.read` authority, and the path does not synthesize chat/history. Final implementation main is `3dd350e938d3651e75fc81ac30e9ef751c477ca5`, with merged-main CI/Product Eval/MCP PASS and automatic Staging Deploy run `36109914350` PASS.

The remaining boundary decision is now resolved: native Google Drive OAuth/onboarding is deferred as a separate future integration because the repository has no Drive/OAuth lifecycle domain, and recursive folder auto-ingestion is intentionally rejected for this roadmap. Generic MCP resource ingestion is the accepted A-05 connector boundary.

Current Project Sources support owner-backed references plus the later Session 8 ingestion slices: direct file -> Artifact upload, separate Project-scoped extraction, hardened HTTPS URL snapshot ingestion, and browsing/ingesting concrete resources from a Project-bound MCP server.

The original audit's missing direct-upload, connector-resource browsing, and URL-ingestion items are therefore closed. The remaining provider-specific limitations are native Google Drive OAuth/onboarding and recursive folder mirroring; both are explicitly deferred outside A-05 for this roadmap.

### A-06 — CLOSED / PASS — Schedule product evolution

**Closure update — 2026-09-25: A-06 CLOSED / PASS.** The original finding is retained here for traceability, but both bounded remediation slices are now closed.

A-06a closed calendar/navigation through PR #327 / merge `3b1abefd18263f7441d139e3435b064f83b142ea`, adding `list/day/week/month/year`, explicit Previous/Today/Next calendar navigation, responsive real projections, and exact Flow-version links while rendering only Temporal `nextActionTimes`.

A-06b closed the remaining product gaps through PR #329 / merge `d182c5ec06be14de068b7c3911a0decffcc94d41`:

- Project selection is now searchable/autocomplete instead of native-select-only;
- Work exposes inline `+ New Project` through the existing Project owner API;
- Work exposes local AI-assisted natural-language Schedule create/edit drafting;
- AI assistance is draft-only and `LOCAL_ONLY` through Hub -> Connect;
- only existing Project Flow IDs can be selected by the model;
- `graphVersion` is pinned from the Flow owner;
- autonomy/enabled/catch-up/overlap governance fields are preserved;
- generated time configuration is schema-validated;
- explicit Save remains the only path that mutates the existing Flow Trigger API;
- Temporal remains schedule truth and no second scheduler/task store/history domain was introduced.

Exact A-06b implementation head `f7e10c1d4fae957e7a9b52bbbc78805424f8da12` passed CI `36124634778`, Product Eval `36124634690`, PCS-06 rendered-browser `36124634717`, and MCP External HTTPS `36124634826`. Merged main `d182c5ec06be14de068b7c3911a0decffcc94d41` passed CI `36125055447`, Product Eval `36125055440`, and MCP External HTTPS `36125055159`. Automatic Staging Deploy `36125427040` executed the exact-SHA deploy successfully, with Operations healthy, no unhealthy services, preserved auth/MCP boundaries, and 27.69 GiB free after stabilization.

Evidence: [session-9-a06b-schedule-closure-2026-09-25.md](session-9-a06b-schedule-closure-2026-09-25.md).

### A-07 — CLOSED / PASS — Brain scalable layout

**Closure update — 2026-09-25.** PR #331 / merge `13775e3903a74732162658292a8dd350a068de6b` closes the original readability/scalability finding.

Brain now uses a deterministic dynamic canvas height with >=64px center spacing per lane, including the allowed 50-Run case. Pan controls, drag-to-pan, zoom in/out, reset, and contained internal overflow are implemented. The Brain projection/owner model is unchanged: no graph database, no new canonical data owner, and no A-08 richer node classes were introduced.

Exact-head CI `36131738117`, Product Eval `36131738109`, and PCS-06 `36131738174` passed. Merged-main CI `36132291003` and Product Eval `36132290871` passed. Automatic Staging Deploy `36132607599` executed `Deploy exact reviewed main SHA` successfully.

Evidence: [session-9-a07-brain-scalable-layout-closure-2026-09-25.md](session-9-a07-brain-scalable-layout-closure-2026-09-25.md).

### A-08 — PARTIALLY CLOSED — richer canonical-owner Brain projection

**A-08a CLOSED / PASS.** PR #333 / merge `461a9665584b5e3a47396663cd4220f21c62027c` adds first-class Artifact and Space Page nodes derived from authorized Project Source views. Source remains the binding/reference node; canonical owner IDs remain authoritative and Brain adds only deterministic relationships.

**A-08b CLOSED / PASS.** PR #335 / merge `bc5601602e401bb0f4d19f567b4dd10c6388f94d` adds first-class Context-owned Fact nodes from stable `MemoryFact.id` values. Hub authorizes the exact Project before the bounded Context owner read; Context is queried with `maxSensitivity=RESTRICTED` and max 40 Facts; sibling-Project rows fail closed. No Context DB read, graph database, owner mutation, fact mutation, or model-created canonical edge was introduced.

A-08b exact-head CI `36147793139`, Product Eval `36147793105`, PCS-06 `36147793042`, and MCP External HTTPS `36147793068` passed. Merged-main CI `36148568175`, Product Eval `36148568188`, and MCP External HTTPS `36148568214` passed. Automatic Staging Deploy `36149034797` executed `Deploy exact reviewed main SHA` successfully.

**A-08c CLOSED / PASS.** PR #338 / merge `0a36a041a4077e185cbc934723d7ca195c5f5fc5` adds `GENERATED_FROM` only for schema-valid `artifact:<ArtifactId>` Fact provenance when that Artifact is already present from authorized Project Source state. Unbound, malformed, non-Artifact, or non-visible Artifact provenance creates no canonical relationship. Exact-head CI `36156486474`, Product Eval `36156486661`, MCP External HTTPS `36156486439`, and PCS-06 `36156486530` passed; merged-main CI `36157146397`, Product Eval `36157146459`, and MCP External HTTPS `36157146498` passed; automatic Staging Deploy `36157615400` executed `Deploy exact reviewed main SHA` successfully.

Remaining A-08 candidates require stable authorized owner identity: connector resource hierarchy, Core Memory representation, and embedded Brain AI/chat. The correct direction remains expansion from canonical owners and reuse of existing Ai/Context/ECX paths, not a second graph database or chat system.

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
| day/week/month/list | real calendar projections from Temporal nextActionTimes | CLOSED / PASS |
| year/calendar navigation | implemented with explicit cursor navigation | CLOSED / PASS |
| AI-assisted Schedule chat | local AI-assisted create/edit draft compiler with explicit Save | CLOSED / PASS |
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
5. Project state/UI correctness: CLOSED (virtual All in Session 6; stale persisted Project reconciliation in Session 7);
6. Project settings + source onboarding: CLOSED for this roadmap (generic MCP connector boundary; native Google Drive integration deferred separately);
7. Schedule A-06: CLOSED / PASS (A-06a calendar/navigation + A-06b searchable/inline Project selection and governed local AI-assisted drafting);
8. Brain scalable layout/pan/zoom + richer canonical-owner projection — eligible for a future explicit scope decision, not automatically authorized;
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