# Repository + documentation reconciliation — 2026-09-26

Date: **2026-09-26**

Status: **CLOSED / PASS — REPOSITORY + CURRENT-DOCUMENT RECONCILIATION**

Baseline GitHub `main` audited:

```text
65bf8d2ce0b832bd12b0b279ccf9df0384a07c47
```

This record audits the current GitHub repository and reconciles current/canonical documentation after the A-11 closure. It does not rewrite dated evidence, reopen closed implementation scopes, delete branches, resume DR-2, activate production, or change runtime code.

## 1. Current repository/runtime identity

At the audit baseline:

- GitHub default branch: `main`;
- exact `main`: `65bf8d2ce0b832bd12b0b279ccf9df0384a07c47`;
- latest merged checkpoint: PR #353, A-11 documentation closure;
- open pull requests: **0**;
- open issue inventory: **Issue #277 only**, the deferred DR-2 physical-independence tracker;
- post-merge CI **#2258**: PASS;
- post-merge Product Eval **#1497**: PASS;
- governed Staging Deploy **#1288**: gate PASS + deploy PASS;
- staging exact source: `65bf8d2ce0b832bd12b0b279ccf9df0384a07c47`;
- staging image tag reported by deployment: `staging-65bf8d2ce0b8`;
- public/auth smoke: PASS;
- MCP protected-resource metadata + unauthenticated challenge: PASS;
- Operations: `healthy: true`, zero unhealthy owner services;
- configured/running Compose services: **15/15**;
- staging worktree: clean detached, exact SHA matched;
- stabilized free space: **26.29 GiB**.

The older DR runtime `b27c1e...`, latest-main convergence `52046db...`, and every intermediate audit-follow-up staging revision remain valid historical evidence only. They are not the current staging identity.

## 2. Repository inventory

The exact baseline tree contains:

- **972 tracked blobs/files** at the audited pre-reconciliation baseline;
- **250 tracked files under `docs/`** at that baseline;
- this reconciliation adds one verification record, so the resulting tree contains **973 tracked blobs/files** and **251 tracked files under `docs/`**;
- **17 `package.json` manifests**:
  - 1 repository root package;
  - 1 browser app: `@ecorione/ai`;
  - 6 shared packages: context-assembly, sdk, shared-schema, shared-server, shared-telemetry, shared-ui;
  - 9 service packages: Artifact, Connect, Context, Flow, Hub, RnD, Sandbox, Space, Sync;
- 6 GitHub Actions workflows:
  - CI;
  - Product Eval;
  - PCS-06 Integrated Browser Acceptance;
  - MCP External Acceptance;
  - Desktop Installer;
  - Staging Deploy.

Production Compose defines exactly **15 services**:

```text
temporal-db
temporal
rnd
context
connect
hub
artifact
sandbox
space
flow
flow-worker
sync
mcp
ai
caddy
```

This matches the current staging host inventory reported by the governed deployment.

## 3. Current architecture remains coherent

The repository still implements the documented owner split:

- Ai: browser/product surface;
- Hub: policy, approval, capability authority, Projects, Historical Ledger, orchestration;
- Context: memory/retrieval semantics and provenance;
- Connect: provider/model credentials, Vault, spend, inbound/outbound MCP;
- Artifact: raw artifact-byte owner;
- Space: page/block composition and owner references;
- Flow: graph/Trigger owner;
- Temporal: durable timer/retry/workflow truth;
- Sandbox: governed execution;
- RnD: trace/evidence/dataset owner;
- Sync: device/ciphertext relay + public MCP bridge.

No documentation reconciliation here authorizes a second scheduler, graph database, competing memory store, cross-service database path, or a new autonomous service.

## 4. Audit-follow-up state

The 2026-09-24 audit is no longer an open work queue.

Closed bounded follow-ups include:

- A-00 human authentication — CLOSED / PASS;
- A-12 owner remote-bind authentication — CLOSED / PASS;
- A-01 internal HTTP timeout coverage — CLOSED / PASS;
- A-13 Space -> Flow standalone/default port — CLOSED / PASS;
- A-02 virtual Projects All behavior — CLOSED / PASS;
- A-03 stale Project selection reconciliation — CLOSED / PASS;
- A-04 Project settings — CLOSED / PASS;
- A-05 source onboarding — CLOSED at the generic owner/MCP connector boundary;
- A-06 Schedule — CLOSED / PASS;
- A-07 Brain scalable layout — CLOSED / PASS;
- A-08 owner-backed Brain projection/grounding — CLOSED at the proven owner-backed boundary, with speculative hierarchy/Core-Memory identity deferred;
- A-09 frontend decomposition — CLOSED / PASS;
- A-10 Compose readiness — CLOSED / PASS;
- A-11 browser Workspace context — CLOSED / PASS.

A-11 implementation is PR #352 / implementation SHA `38fa0b8563a0f73fb44b1705e4f0e1418d8a23c5`; its implementation staging proof is Staging Deploy #1284. PR #353 later converged documentation and current staging to `65bf8d2c...`.

No new numbered audit scope is opened by this reconciliation.

## 5. Documentation audit

Documentation is intentionally divided into different authority classes.

### Current/canonical

Current state must come from:

1. current code + tests;
2. `docs/current-state-and-next-steps.md`;
3. `docs/active-work-plan.md`;
4. accepted ADRs for architecture invariants;
5. current owner/runbook documents;
6. `docs/EXECUTION-PROGRESS.md`.

### Historical evidence

`docs/verification/`, `docs/archive/`, dated audit files, failed attempts, old safe checkpoints, and historical roadmap bodies may correctly contain:

- older SHAs;
- `ACTIVE`, `OPEN`, `PENDING`, or “next scope” wording that was true at that time;
- skipped staging runs;
- superseded runtime identities;
- failures later repaired.

Those files must not be mass-rewritten to make history look current.

## 6. Stale current-document contradictions found

The audit found several current/canonical contradictions that required reconciliation:

1. root `README.md` still described the 2026-09-24 CRITICAL Ai-auth finding as open;
2. root `README.md` still claimed post-DR documentation merges had not deployed because staging activation was disabled;
3. `AGENTS.md` still carried the obsolete human-auth “Security stop condition” as current scope;
4. `docs/README.md` still named the original DR revision as the latest staging runtime and said deployment activation remained disabled;
5. `docs/staging-continuous-deployment.md` still described Session 3 pipeline hardening as active even though it is closed;
6. `docs/sumopod-staging.md` still described automatic CD as intentionally disabled;
7. `docs/security-review.md` still described direct remote-bind-without-token as an unresolved finding even though A-12 closed;
8. `docs/production-activation.md` still said the general Ai fallback was not human-authenticated despite its own later closure note;
9. the current audit document retained open/partial headings for A-13/A-02/A-03/A-04/A-05/A-08 even though their bodies contain closure updates;
10. current navigation/evidence indexes did not identify this 2026-09-26 reconciliation as the latest documentation audit.

The reconciliation PR corrects those current-document contradictions without rewriting historical verification records.

## 7. Repository hygiene observation

GitHub branch enumeration returned **392 branch names including `main`**. The names show substantial historical implementation, fix, audit, checkpoint, and docs branch accumulation.

This is a repository-hygiene finding only.

No branch is deleted in this documentation scope because branch deletion is destructive and requires a separate review that determines whether each branch is merged, uniquely referenced, protected, or still useful as recovery provenance.

## 8. Current open/deferred boundaries

The following remain separate and are not reopened here:

- Issue #277 / DR-2 checkpoint 2 external target selection — **DEFERRED / SAFE-PAUSED**;
- native Google Drive OAuth/onboarding — **DEFERRED**;
- broader Workspace registry/switcher/provisioning/membership UX — **NOT OPENED**;
- multi-user identity/RBAC redesign — **NOT OPENED**;
- hosted-provider spend/paid validation — **NOT OPENED**;
- public production cutover — **DEFERRED / SEPARATE GATE**;
- optional Cloudflare named public edge — **SEPARATE OPERATOR DECISION**;
- AutoClick — **DEFERRED BY DESIGN**.

## 9. Operator-observed mobile staging note

During the same session, an operator observed on iPhone that the root Basic-Auth bootstrap path could leave a blank page after authentication, while opening the protected `/flow` route directly with the same credential successfully loaded the application.

This is recorded only as a **single operator-observed staging UX limitation**, not yet as a cross-browser root-cause conclusion. The existing staging auth boundary remains functional, and no runtime/auth code change is part of this documentation reconciliation.

If selected later, mobile Basic-Auth bootstrap compatibility should be handled as a separate bounded bugfix with a reproducible browser acceptance case.

## 10. Reconciliation boundary

This scope changes documentation only.

It must not:

- alter application/service/runtime behavior;
- mutate staging credentials;
- change Basic-Auth credentials;
- change GitHub staging secrets/variables;
- delete historical branches;
- close Issue #277;
- resume DR-2;
- introduce native Drive;
- enable hosted spend;
- promote staging to production.

## 11. Post-merge closure evidence

The reconciliation implementation/documentation PR is **#354**.

Exact reviewed PR head:

```text
f356f00d643b017d0e9870142c71c597d281872f
```

Exact-head gates:

- CI **#2262** — PASS;
- Product Eval **#1501** — PASS.

PR #354 squash-merged as:

```text
265a28d4c53cc482af8ea33a6362a21e640d30e5
```

Merged-main gates on that exact SHA:

- CI **#2263** — PASS;
- Product Eval **#1502** — PASS.

Staging delivery for the merge SHA produced two workflow-run outcomes:

- Staging Deploy **#1297** — gate PASS, deploy **SKIPPED**;
- Staging Deploy **#1298** — gate PASS, deploy **PASS**.

Only #1298 is actual runtime deployment proof.

Staging Deploy #1298 directly proved:

- image `staging-265a28d4c53c`;
- host `HEAD` and expected SHA both `265a28d4c53cc482af8ea33a6362a21e640d30e5`;
- clean detached staging checkout;
- unauthenticated root `302 -> /login`;
- `/login`, `/ops`, `/settings`, `/api/ops`, representative Project/history/Brain/Space reads, and chat/forget mutations fail closed with `401 + Basic challenge`;
- MCP protected-resource metadata returns 200 and unauthenticated MCP remains OAuth-challenged with 401;
- Operations `healthy: true` with `unhealthyServices: []`;
- all **15/15** configured Compose services running;
- final staging capacity stabilization: **25.11 GiB free**;
- rollback-set image retention kept the new current image and previous `staging-65bf8d2ce0b8` image while removing the older `staging-38fa0b8563a0` image.

Post-merge repository inventory before opening this final closure-bookkeeping branch:

- **973** tracked blobs/files;
- **251** tracked files under `docs/`;
- **0** open pull requests;
- open issue inventory: **Issue #277 only**, the deferred DR-2 tracker;
- **393** branch names including `main`;
- the merged reconciliation branch remained present and was not deleted because branch cleanup is a separate destructive hygiene scope.

This closes the requested repository/documentation reconciliation. Any later docs-only bookkeeping SHA must be distinguished from the runtime proof above; it does not reopen A-11 or create a new product/runtime scope.

## 12. Safe resume

After this reconciliation merges:

1. treat the docs-only merge SHA as repository/current-staging bookkeeping identity;
2. retain A-11 implementation identity `38fa0b856...` separately from later docs-only SHAs;
3. use current-state/active-work docs rather than old dated verification files to decide what is active;
4. do not reopen a closed A-series item without a reproducible regression;
5. if repository branch cleanup is desired, perform a separate non-doc audit before deleting anything;
6. if the mobile root-login behavior is selected, reproduce it first and keep the fix separate from documentation cleanup;
7. keep DR-2/native Drive/hosted spend/production cutover explicitly deferred unless the operator opens one of them.

