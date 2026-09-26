# ECORIONE — Active Work Plan

Last updated: **2026-09-26**

Status: **A-11 CLOSED-PASS / DOCUMENTATION RECONCILIATION ONLY / DR-2 CHECKPOINT 2 DEFERRED / PRODUCTION CUTOVER DEFERRED**

## Audit follow-up checkpoint — SESSION 10 / A-11 CLOSED / SAFE CHECKPOINT

**Current queue:** there is no active A-series implementation after A-11. The present scope is documentation reconciliation only. At the start of this docs-only reconciliation, GitHub `main` and SumoPod staging were converged at `65bf8d2ce0b832bd12b0b279ccf9df0384a07c47` through CI #2258, Product Eval #1497, and governed Staging Deploy #1288. A docs-only merge may advance the bookkeeping SHA without reopening runtime scope. No next numbered audit item is implicitly opened.

The 2026-09-24 current-main + staging parity audit remains the source of the prioritized finding list. Its CRITICAL general-Ai human-authentication finding is now **CLOSED / PASS at the SumoPod staging boundary** through PRs #293–#295 and final reviewed main `b73e885d51e82716d5b29b3b31d207aae5ec95d0`. CI run `35967561614`, Product Eval run `35967561587`, and governed Staging Deploy run `35967881224` passed. Representative unauthenticated Ai reads/mutations now fail closed behind Basic Auth while MCP discovery/OAuth remains separate. Evidence: [verification/ai-human-auth-closure-2026-09-24.md](verification/ai-human-auth-closure-2026-09-24.md).

The failed intermediate staging attempts are preserved as historical evidence: one exposed compatibility with the installed readiness gate, and one exposed an overly strict smoke assertion on Caddy-generated Basic-Auth 401 headers. Both were corrected without reopening the application architecture.

The staging disk-pressure recovery is now **SESSION 1 CLOSED / PASS**. The host was recovered without pruning owner volumes, running containers, rollback images, networks, or unrelated workloads. BuildKit cache was the only reclaimed Docker state; the worktree is clean at the actual running reviewed SHA `b73e885d51e82716d5b29b3b31d207aae5ec95d0`; the privileged deploy helper now matches reviewed main; public auth, MCP/OAuth, Operations health, and exact-host evidence all pass. Closure evidence: [verification/staging-capacity-recovery-closure-2026-09-24.md](verification/staging-capacity-recovery-closure-2026-09-24.md).

**Session 2 — Restore Auto Deploy is CLOSED / PASS.** GitHub -> SumoPod automatic staging deployment is restored and proven through a true post-merge workflow-run. No further Session 2 work is active.

### Session 2 — CLOSED / PASS

Controlled staging convergence to exact current main `fad170645ba612b746453487dc97cc0e03cb05e7` is PASS. The reviewed host helper built and activated `staging-fad170645ba6`, public/private boundary validation passed, authenticated Operations is healthy, exact-host evidence matches the target, all 15 configured services are running, and post-deploy disk headroom is `27.51 GiB`.

Repository variable `ECORIONE_STAGING_CD_ENABLED=1` is restored. The bounded Operations-readiness retry is merged and installed. Final automatic proof passed on PR #303 merge `59e86b5cf0269348b8db572da488e0c846f71a86`: CI #1997 PASS, Product Eval #1236 PASS, and automatic Staging Deploy run `36008243369` / #761 PASS with deploy job executed, public/MCP validation PASS, Operations healthy, exact-host SHA match, all 15 services running, and `24.03 GiB` free disk. Evidence: [verification/staging-auto-deploy-restore-2026-09-24.md](verification/staging-auto-deploy-restore-2026-09-24.md).

### Session 3 — CLOSED / PASS

Session 2 is CLOSED / PASS. Session 3 audit is complete at source level and the bounded hardening implementation is in review. Priority fixes are: explicit current+rollback image retention, single shared application image build, post-deploy capacity stabilization, release-receipt/runtime identity consistency, and full rollback revalidation. The dual workflow-run trigger remains unchanged; backup freshness per deploy is documented as a separate deferred policy question.

PR #305 hardening and PR #306 final-proof checkpoint are merged. CI #2007 and Product Eval #1246 passed, and automatic Staging Deploy #781 deployed exact main `977db6f4bb72acfb6f4601372de6dc82b9200995` through the restricted SSH path. Runtime identity, public/MCP smoke, Operations health, all 15 services, current+rollback retention, stale-image cleanup and 28.87 GiB final free space all passed. **Session 3 is CLOSED / PASS.** Evidence: [verification/deployment-pipeline-audit-2026-09-24.md](verification/deployment-pipeline-audit-2026-09-24.md).

### Session 4 — CLOSED / PASS

A-12 and A-01 are closed on current reviewed main.

- PR #308 / merge `e4810e0d7980682028be67634fa430090fe9bf92`: non-loopback owner bind now requires authentication material; exact-head CI #2020, Product Eval #1259, MCP #1023 and PCS-06 #29 passed; automatic staging deploy #809 passed.
- PR #309 / merge `2ee12fd454ade78ce1bf732390334726980e0451`: shared internal HTTP calls now have a default 10-second deadline with deterministic stalled-upstream coverage; exact-head CI #2026, Product Eval #1265, MCP #1029 and PCS-06 #34 passed; merged-main CI #2027, Product Eval #1266, MCP #1030 and automatic staging deploy #821 passed.
- Final runtime: exact SHA `2ee12fd...`, Operations healthy, all 15 configured services running, private Ai boundary and MCP/OAuth smoke PASS, post-retention free space `25.11 GiB`.

There are no open CRITICAL/HIGH findings remaining from the 2026-09-24 audit. Evidence: [verification/session-4-high-findings-safe-checkpoint-2026-09-25.md](verification/session-4-high-findings-safe-checkpoint-2026-09-25.md).

### Session 5 — CLOSED / PASS

A-13 is closed through PR #312 / merge `d8d2a113c917cee87f2d43a5a2243eda2e4d2173`.

- Space standalone/default Flow now resolves to canonical `http://127.0.0.1:17028`;
- one shared resolver owns the fallback while explicit `ECORIONE_FLOW_URL` overrides remain supported;
- deterministic unit/source-contract coverage locks Space, `.env.example`, engine health mapping, desktop Compose and staging Compose to the canonical port contract;
- existing Flow-linked/AI-linked Space resolution behavior remains unchanged and covered;
- desktop/staging Compose remains unchanged at `http://flow:17028`;
- exact-head CI #2032 and Product Eval #1271 passed;
- merged-main CI #2033 and Product Eval #1272 passed;
- automatic Staging Deploy #833 executed and passed on exact `d8d2a113...`, with healthy Operations, exact-host match, no non-running configured service, preserved auth/MCP boundary, and `28.86 GiB` stabilized free space.

Evidence: [verification/session-5-a13-safe-checkpoint-2026-09-25.md](verification/session-5-a13-safe-checkpoint-2026-09-25.md).

### Session 6 — CLOSED / PASS

A-02 is closed through PR #314 / merge `591b54131c2d0b53532f33e08b878c15a0617951`.

- virtual **All** is now an explicit selectable aggregate state rather than an inert button;
- workspace aggregate conversation metadata uses the existing Historical Ledger path by omitting `projectId`, without creating a synthetic Project or parallel history store;
- Project Sources and memory remain isolated per real Project;
- conversation links from All route through the owning Project; unavailable/unassigned sessions remain metadata-only;
- exact-head CI #2041, Product Eval #1280 and PCS-06 browser #41 passed;
- merged-main CI #2042 and Product Eval #1281 passed;
- automatic Staging Deploy #851 deployed exact `591b5413...` and passed with healthy Operations, exact-host match, no non-running configured service, preserved auth/MCP boundary, and `27.81 GiB` stabilized free space.

Evidence: [verification/session-6-a02-safe-checkpoint-2026-09-25.md](verification/session-6-a02-safe-checkpoint-2026-09-25.md).

### Session 7 — CLOSED / PASS

A-03 is closed through PR #316 / merge `8bbaf855b4f415afbe09eb9b6d16f9c1df6e1f8e`.

- one shared Project-selection contract reconciles persisted/query candidates against active Projects before owner-state binding;
- archived/missing candidates fall back to active Personal, or the first active Project when Personal is unavailable;
- Ai drops stale session binding when Project selection is corrected; Work and Brain wait for Project readiness before owner reads;
- rendered PCS-06 browser coverage seeds `prj_archived`, opens Ai/Work/Brain, verifies storage convergence to `prj_personal`, and fails if a stale Project reaches owner APIs;
- exact-head CI #2050, Product Eval #1289 and PCS-06 browser #47 passed;
- merged-main CI #2051 and Product Eval #1290 passed;
- automatic Staging Deploy #869 deployed exact `8bbaf855...` and passed with healthy Operations, exact-host match, no non-running configured service, preserved auth/MCP boundary, and `25.10 GiB` stabilized free space.

Evidence: [verification/session-7-a03-safe-checkpoint-2026-09-25.md](verification/session-7-a03-safe-checkpoint-2026-09-25.md).

### Session 8 — CLOSED / PASS

The bounded Project settings + source-onboarding scope is now implemented through PRs #318–#324.

- A-04 Project settings: PR #318 / merge `33d54928de60ba3f6d8cd3770c18d7ad5eea6f98`;
- A-05a owner-backed source picker: PR #319 / merge `8c6188983f058854028d803168c946445f92b31c`;
- A-05b.1 direct file ingestion: PR #320 / merge `c299f0c0b74cd770a80483b0492b3b9e843f8b86`;
- A-05b.2 Project-scoped extraction: PR #321 / merge `74dea0b83046af18ab3c4a89a95996ba4c3bdc46`;
- A-05b.3a URL snapshot ingestion + DNS-pinning hardening: PRs #322–#323 / merges `f993b2c325b8d5645b28ec1788dbb0d8cf3ff1d8` and `55466c71bb3d978039f2088b9209607399262a09`;
- A-05b.3b generic MCP/connector resource browse + snapshot ingestion: PR #324 / merge `3dd350e938d3651e75fc81ac30e9ef751c477ca5`.

PR #324 exact head `3d4ab01ad5ac42c6317567f0ef122e1c46a0ab11` passed CI `36107141520`, Product Eval `36107141692`, MCP External HTTPS `36107141555`, and PCS-06 browser `36107141502`. Merged main `3dd350e938d3651e75fc81ac30e9ef751c477ca5` passed CI `36109640813`, Product Eval `36109640801`, and MCP External HTTPS `36109640848`. Automatic Staging Deploy `36109914350` gate-passed and successfully executed `Deploy exact reviewed main SHA`.

Ownership remains locked: Project/Hub owns binding and authority, Artifact owns snapshot bytes, Context owns derived extraction, and Connect owns connector/MCP/fetch adaptation. MCP resource snapshots are `RESTRICTED + LOCAL_ONLY`, require explicit `mcp.resource.read / mcp.read` authority, and do not fabricate chat/history.

Evidence: [verification/session-8-a05b3b-safe-checkpoint-2026-09-25.md](verification/session-8-a05b3b-safe-checkpoint-2026-09-25.md).

**A-05 is now CLOSED at the generic connector boundary.** Native Google Drive OAuth/onboarding is deferred as a separate future integration because the current repository has no Drive adapter/OAuth lifecycle/token-refresh/file-hierarchy domain. Recursive folder ingestion is intentionally not added; folders remain connector navigation and concrete resources are snapshotted individually. This decision unblocks Schedule A-06. Brain expansion, frontend decomposition, Compose readiness, production cutover, provider spend, native Google Drive integration, and DR-2 remain separate scopes. Evidence: [verification/session-9-a05-closure-decision-2026-09-25.md](verification/session-9-a05-closure-decision-2026-09-25.md).

**A-06 Schedule is now CLOSED / PASS.** A-06a closed calendar/navigation through PR #327 / merge `3b1abefd18263f7441d139e3435b064f83b142ea`. A-06b then closed the remaining product scope through PR #329 / merge `d182c5ec06be14de068b7c3911a0decffcc94d41`: searchable/autocomplete Work Project selection, inline `+ New Project`, and local AI-assisted natural-language Schedule create/edit drafting. The assistant remains draft-only; Flow still owns Trigger definitions, Temporal remains schedule truth, owner Flow version is pinned server-side, governance fields are preserved, and only explicit Save mutates the existing Trigger path. No second scheduler, task database, or synthetic history was introduced.

A-06b exact implementation head `f7e10c1d4fae957e7a9b52bbbc78805424f8da12` passed CI `36124634778`, Product Eval `36124634690`, PCS-06 rendered browser `36124634717`, and MCP External HTTPS `36124634826`. Merged implementation main `d182c5ec06be14de068b7c3911a0decffcc94d41` passed CI `36125055447`, Product Eval `36125055440`, and MCP External HTTPS `36125055159`. Automatic Staging Deploy `36125427040` executed `Deploy exact reviewed main SHA` successfully; staging reported exact-SHA match, healthy Operations with no unhealthy services, preserved public/auth + MCP boundaries, and 27.69 GiB free after capacity stabilization.

**A-07 Brain scalable layout is now CLOSED / PASS.** PR #331 merged as `13775e3903a74732162658292a8dd350a068de6b`. The Brain canvas now scales deterministically with node density, preserves >=64px center spacing through the allowed 50-Run case, and exposes contained pan/drag/zoom/reset controls without page-level overflow. Exact-head CI `36131738117`, Product Eval `36131738109`, and PCS-06 `36131738174` passed. Merged-main CI `36132291003` and Product Eval `36132290871` passed. Automatic Staging Deploy `36132607599` gate/deploy passed and executed `Deploy exact reviewed main SHA`. Evidence: [verification/session-9-a07-brain-scalable-layout-closure-2026-09-25.md](verification/session-9-a07-brain-scalable-layout-closure-2026-09-25.md).

**A-08a Brain owner-resource projection is now CLOSED / PASS.** PR #333 merged as `461a9665584b5e3a47396663cd4220f21c62027c`. Brain now promotes Project-bound Artifact and Space Page resources into first-class canonical owner nodes while keeping Source as the binding/reference and deriving only deterministic `REFERENCES` / `BELONGS_TO` edges. Exact-head CI `36141048119`, Product Eval `36141048146`, PCS-06 `36141048129`, and MCP External HTTPS `36141048157` passed. Merged-main CI `36141655282`, Product Eval `36141655343`, and MCP External HTTPS `36141655291` passed. Automatic Staging Deploy `36142092154` gate/deploy passed and executed `Deploy exact reviewed main SHA`.

**A-08b Brain Context Fact projection is now CLOSED / PASS.** PR #335 merged as `bc5601602e401bb0f4d19f567b4dd10c6388f94d`. Brain now projects first-class Context-owned `Fact` nodes from stable `MemoryFact.id` values only after Hub-first Project authorization, with bounded Context reads (`maxSensitivity=RESTRICTED`, max 40) and fail-closed sibling-Project isolation. Exact-head CI `36147793139`, Product Eval `36147793105`, PCS-06 `36147793042`, and MCP External HTTPS `36147793068` passed. Merged-main CI `36148568175`, Product Eval `36148568188`, and MCP External HTTPS `36148568214` passed. Automatic Staging Deploy `36149034797` deployed exact reviewed main successfully. Evidence: [verification/session-9-a08b-brain-context-facts-closure-2026-09-25.md](verification/session-9-a08b-brain-context-facts-closure-2026-09-25.md).

**A-08c Brain Fact provenance is now CLOSED / PASS.** PR #338 merged as `0a36a041a4077e185cbc934723d7ca195c5f5fc5`. Brain adds `GENERATED_FROM` only for schema-valid `artifact:<ArtifactId>` Context provenance when that exact Artifact node is already present from authorized Project Source state; unbound/malformed/non-Artifact provenance remains metadata-only. Exact-head CI `36156486474`, Product Eval `36156486661`, MCP External HTTPS `36156486439`, and PCS-06 `36156486530` passed. Merged-main CI `36157146397`, Product Eval `36157146459`, and MCP External HTTPS `36157146498` passed. Automatic Staging Deploy `36157615400` gate/deploy passed and executed `Deploy exact reviewed main SHA`. Evidence: [verification/session-9-a08c-brain-fact-provenance-closure-2026-09-25.md](verification/session-9-a08c-brain-fact-provenance-closure-2026-09-25.md).

**A-08d Embedded Brain grounded assistant is CLOSED / PASS.** PR #341 exact head `39f1b4f96ddb38bf97f9fb2011d609e73b5d5030` passed CI #2199, Product Eval #1438, PCS-06 #155, and MCP #1120, then merged as `1f25f32cdbb0bfd6dc043491f7668df6bc1795cb`. Merged-main CI #2200, Product Eval #1439, and MCP #1121 passed. Staging Deploy #1171 is historical gate-only evidence because its deploy job was skipped; Staging Deploy #1172 is the actual exact-SHA deployment and passed with healthy Operations, exact host identity, all 15 configured services running, preserved auth/MCP boundaries, and 25.03 GiB free after stabilization. Brain now offers a local-only selected-node assistant through the existing Ai -> Hub -> Context -> Connect path; Context narrowing uses exact authorized Fact IDs/URL Source URIs, wider Project Core Memory and broad Artifact fallback are suppressed for grounded turns, no second chat/history backend exists, and A-08c provenance remains intact. Evidence: [verification/session-9-a08d-brain-grounded-assistant-closure-2026-09-25.md](verification/session-9-a08d-brain-grounded-assistant-closure-2026-09-25.md).

**A-08 is now CLOSED at the proven owner-backed boundary.** The final two candidates were audited and explicitly deferred: Connect exposes stable MCP resource `uri` values but no owner-backed parent/child hierarchy relationship, so Brain will not infer folder structure from URI shape; Context Core Memory uses global/project label keys but exposes no canonical block ID, so Brain will not synthesize one from `(projectId, label)`. No runtime change is required for this closure. Evidence: [verification/session-9-a08-remainder-closure-decision-2026-09-26.md](verification/session-9-a08-remainder-closure-decision-2026-09-26.md).

**A-09 frontend maintainability/decomposition is CLOSED / PASS.** PRs #344–#348 decomposed the five audited concentration surfaces (Flow, Ai chat, Settings, Work, Space) into explicit page/controller + domain-local presentation/model boundaries while preserving owner APIs and product behavior. Final product main is `3c9279a21ec441ab9fe5ec95583c946a238ccc43`. Exact-head gates for every slice passed; merged-main CI #2228 and Product Eval #1467 passed; actual Staging Deploy #1228 deployed the exact reviewed SHA, preserved auth/MCP checks, reported healthy Operations, 15/15 configured services running, exact-host SHA match, and 27.69 GiB free after stabilization. No scheduler, graph store, memory store, cross-service database path, hosted spend, DR-2 work, or production cutover was introduced. Evidence: [verification/session-9-a09-frontend-decomposition-closure-2026-09-26.md](verification/session-9-a09-frontend-decomposition-closure-2026-09-26.md).

**A-10 Compose readiness/health is CLOSED / PASS.** PR #350 merged as `710127d66218e4d2e8ed23ddbc485b80b8769f6b`. Final reviewed head `5fcdf0e4d2ce0a52e5e0197e71ee942a4f5842ba` passed CI #2233, Product Eval #1472, PCS-06 #177, and Desktop Installer #246. Merged-main CI #2234 and Product Eval #1473 passed. Staging Deploy #1239 was gate-only with deploy skipped while the peer gate was pending; actual Staging Deploy #1240 deployed exact `710127d...` and passed the new health-aware startup ordering, public/auth + MCP smoke, healthy Operations with zero unhealthy services, exact-host SHA match, 15/15 configured services running, and 29.88 GiB stabilized free space. No service ownership, scheduler, memory store, graph store, cross-service database path, native Drive integration, hosted spend, DR-2 scope, or production cutover was introduced. **A-11 personal-workspace-first limitation is the next numbered audit boundary only if explicitly selected.** Evidence: [verification/session-10-a10-compose-readiness-closure-2026-09-26.md](verification/session-10-a10-compose-readiness-closure-2026-09-26.md).

**A-11 personal-workspace-first limitation is CLOSED / PASS.** PR #352 merged as exact implementation main `38fa0b8563a0f73fb44b1705e4f0e1418d8a23c5`. Browser Workspace selection is now centralized: valid `?workspace=ws_...` overrides valid persisted `ecorione.workspaceId`, invalid/absent candidates fall back to canonical `DEFAULT_WORKSPACE_ID`, and Ai, Projects, Work, Brain, Space, Flow, and Settings consume the shared context instead of owning `ws_personal`. Final reviewed head `173ba037182ca999f93c22942c564cff08d8ab6c` passed CI #2255, Product Eval #1494, and PCS-06 #195; merged-main CI #2256 and Product Eval #1495 passed; actual Staging Deploy #1284 deployed exact `38fa0b856...` and proved preserved public/auth + MCP boundaries, healthy Operations with zero unhealthy services, exact-host match, 15/15 configured services running, and 27.66 GiB stabilized free space. No Workspace registry/switcher, multi-user identity redesign, new owner/service/database, DR-2 work, native Drive integration, hosted spend, or production cutover was introduced. **No new audit scope is opened automatically.** Evidence: [verification/session-10-a11-browser-workspace-context-closure-2026-09-26.md](verification/session-10-a11-browser-workspace-context-closure-2026-09-26.md).

**Repository/docs reconciliation:** current/canonical documentation is being synchronized against exact `main`, the 15-service staging topology, and the closed audit sequence. Historical verification/archive files remain immutable evidence. GitHub branch enumeration found 392 branch names including `main`; branch cleanup is deliberately not part of this docs scope because deletion requires a separate destructive review. Evidence: [verification/repository-documentation-reconciliation-2026-09-26.md](verification/repository-documentation-reconciliation-2026-09-26.md).

## DR-2 physical independence — CHECKPOINT 1 CLOSED / CHECKPOINT 2 DEFERRED

Issue #277 remains the DR-2 tracking scope but is currently deferred; there is no active DR-2 runtime implementation. It is additive to the completed Off-host DR drill and must not rewrite Issue #266 evidence.

Checkpoint 1 is CLOSED / PASS through PR #278 / merge `4d1f4ef82839c74cc1ca8454511405a68424f0b7`. It delivered provider-neutral repository tooling only:

- `scripts/staging-dr2-host-evidence.mjs` captures sanitized hashed host identity plus a failure-domain label into a mode-0600 non-overwriting receipt;
- `scripts/staging-dr2-physical-independence-preflight.mjs` requires explicit `ECORIONE_DR_PHYSICAL_INDEPENDENCE_ACK=1`, rejects matching failure-domain/machine identities, and adds a stricter guard when both hosts are WSL;
- deterministic tests cover PASS, matching-machine rejection, reused-domain rejection, missing attestation, WSL identity requirements, and overwrite refusal;
- no runtime target was selected, contacted, provisioned, or paid for in checkpoint 1.

Exact-head gates passed: CI #1913, Product Eval #1152, MCP External HTTPS #1011, Desktop Installer #197. Merged-main CI #1914, Product Eval #1153, MCP External HTTPS #1012, and Staging Deploy #591/#592 also passed.

Checkpoint 2 is safe-paused before target selection. Existing strict SSH transport remains the preferred resume path if DR-2 is restarted later.

A provider-neutral selection package is now prepared: [verification/offhost-dr2-checkpoint-2-selection-package-2026-09-23.md](verification/offhost-dr2-checkpoint-2-selection-package-2026-09-23.md). It is a safe checkpoint only: no external target is selected, contacted, provisioned, or paid for, and checkpoint 3 must not begin until checkpoint 2 is explicitly closed.

Interim operator decision: keep local backup as the current backup posture. An encrypted Google Drive copy may be added later as a secondary off-device copy, but no Drive transport or DR-2 recovery claim is currently implemented or validated.

Plan: [offhost-dr-physical-independence.md](offhost-dr-physical-independence.md).

Safe resumable checkpoint: [verification/offhost-dr2-safe-checkpoint-2026-09-23.md](verification/offhost-dr2-safe-checkpoint-2026-09-23.md). No DR-2 runtime work is in flight and checkpoint 3 remains blocked.

## Latest post-closure maintenance checkpoint

Bounded maintenance is now **CLOSED through PR #244 at the repository boundary**. The latest slice repairs Sandbox receipt-lock acquisition cleanup so a metadata-write failure after exclusive lock creation cannot leave an idempotency key permanently busy.

Implementation checkpoint before this documentation convergence: `3114354ab44894ef80e75b9983fceac64babc2e0`. PR #244 exact implementation head `462c9418078baefc7cd00eed79dd85dac4ee1bf9` passed CI #1747 and Product Eval #986.

This maintenance did not open PE-09, PCS-11, Batch 13, a new F6 item, production promotion, Cloudflare/public-edge activation, or paid-provider evidence. At that maintenance checkpoint the proven staging runtime was still `0f332c73dc7b...`; the later explicit latest-main staging-convergence scope superseded that runtime claim with the governed deployment recorded below.

Evidence: [verification/post-closure-maintenance-checkpoint-5-2026-09-21.md](verification/post-closure-maintenance-checkpoint-5-2026-09-21.md).

The maintenance queue remains closed. The later bounded **Latest-main staging convergence** operational scope is also CLOSED / PASS at the runtime boundary.

## Latest-main staging convergence — CLOSED / PASS

The bounded operational convergence scope is CLOSED / PASS at the SumoPod staging runtime boundary.

Governed Staging Deploy #293 / run `35627920447` deployed exact reviewed `main` `52046db35e403babdda934881773c46bf2c57b68` as image `staging-52046db35e40`. The gate and deploy jobs both passed. Public home reached HTTP 200 after bounded startup readiness, protected `/ops` and `/settings` returned 401, MCP metadata/challenge checks passed, authenticated Ops reported `healthy: true` with no unhealthy services, sanitized exact-host evidence matched the target SHA, and the final PCS-08 deploy assertion passed.

That convergence established `52046db35e403babdda934881773c46bf2c57b68` / `staging-52046db35e40` at that checkpoint. It is now historical: the later governed original-DR runtime source was `b27c1e5833be0a0fccf3f525d82ae8853cd22113` / `staging-b27c1e5833be`. The previous `0f332c73...` runtime remains historical PCS-09 evidence only.

This convergence did not rerun the destructive/full-host PCS-09 reboot or same-host cold-backup acceptance against the new SHA, and it does not authorize production promotion, public-edge activation, hosted spend, PE-09, PCS-11, Batch 13, or a new F6 scope.

Closure evidence: [verification/latest-main-staging-convergence-closure-2026-09-22.md](verification/latest-main-staging-convergence-closure-2026-09-22.md).

## Off-host Backup & DR — CLOSED / PASS

### Runtime execution checkpoint — CLOSED / PASS

The original DR runtime source was exact `b27c1e5833be0a0fccf3f525d82ae8853cd22113` / `staging-b27c1e5833be`.

Three complete encrypted generations are now retained on the independent SSH target and the corrected audit reports `retention_ready=1`. PR #267 fixed the audit's SSH-stdin consumption bug without moving the application runtime.

The clean replacement environment `ecorione-recovery` is provisioned with native Docker/Compose, Node 22, Git, an empty initial project inventory, the exact `b27c1e...` checkout, the out-of-band RSA DR private key, separate deployment/operator secrets, and a dedicated strict SSH retrieval credential. The existing backup-target WSL distro remains separate from the replacement distro.

Generation `ecorione-dr-20260922152938-b27c1e5833be.receipt.env` is selected. Its immutable loss marker was created at `2026-09-22T16:21:58.074Z`; SumoPod is treated as unavailable from that boundary onward.

The first marker-bound fetch found a compatibility defect in `staging-offhost-dr-fetch.sh`: remote shell quoting is incompatible with modern OpenSSH SCP/SFTP filename handling. Direct strict-SCP proof showed the selected remote manifest is present and readable. PR #268 exact head `df6381783d00a5b607438032c22afb3775a6a9d7` passed CI #1881 + Product Eval #1120 and merged as `bfca380ec12d30fe833b02011494e18988ec8807`; merged-main CI #1882 and Product Eval #1121 also passed; it also makes fetch failures stop at the first failed artifact operation.

The application checkout remains pinned to `b27c1e...`. The reviewed fixed fetch helper was run only from an isolated worktree, marker-bound independent retrieval passed, and the temporary worktree was removed. Exact-source isolated decrypt/Docker verification then passed for all 12 archived volumes with no real project containers or volumes created.

Evidence: [verification/offhost-dr-runtime-checkpoint-2026-09-22.md](verification/offhost-dr-runtime-checkpoint-2026-09-22.md).


The operator explicitly opened **Off-host Backup & DR** as the next infrastructure scope on 2026-09-22. This is a separate operational workstream, not PE-09, PCS-11, Batch 13, production promotion, public-edge activation, or a feature batch.

Checkpoint 1 is **CLOSED / PASS at the repository-foundation boundary** through PR #250 / merge `3c5417dd44099f6c74f0bc832f4631e3fa295c8d`. Exact merged-main CI #1766, Product Eval #1005, and MCP External HTTPS #922 passed; Staging Deploy #308/#309 passed their gates and skipped deployment because activation remained disabled.

Checkpoint 2 is CLOSED / PASS at the repository execution/recovery-tooling boundary through PR #251 / merge `768c0f617064343f0bfc569d52212c80a03f0b83`. Checkpoint 3 is also CLOSED / PASS at the repository boundary through PR #252 / merge `9e522e62212b5a4170ad4947c4bdd75c28f34464`; exact head CI #1820, Product Eval #1059, MCP #970 and Desktop Installer #160 passed, followed by merged-main CI #1821, Product Eval #1060 and MCP #971. Staging Deploy #412/#413 gate-passed and deploy remained skipped because activation stayed disabled.

Real-host execution is now complete at the documented boundary. Three-generation retention, immutable marker-bound independent retrieval, isolated verification, clean-host preflight, guarded 12-volume restore, exact-source 15-service loopback startup, pre-reboot acceptance, full changed-boot-ID reboot persistence, repeated semantic/MCP/Ops/host evidence, and final sanitized closure timing evidence all passed.

There is **no active execution tail in the original Off-host DR workstream**. It remains CLOSED / PASS. DR-2 physical independence is the separately opened follow-up scope and does not alter that closure.

Checkpoint 5 is CLOSED / PASS at the repository evidence-tooling boundary through PR #256 exact head `7c1c8948022fc81e0c640fff7a8bcb7e4e689db3` (CI #1850, Product Eval #1089, MCP #996, Desktop Installer #184) and merge `941cb8c9ed237a5417550449c7d73e712b10ba72` (merged-main CI #1851, Product Eval #1090, MCP #997). Staging Deploy #468/#469 gate-passed and deploy remained skipped. At that repository checkpoint, real target retention/timing evidence was still pending; the later original runtime drill subsequently supplied and closed that evidence.

Checkpoint 6 is CLOSED / PASS at the repository loss-marker provenance boundary through PR #258 exact head `b8379a2c756e2e4ea3e00424c360072b6a910829` (CI #1857, Product Eval #1096, MCP #1001, Desktop Installer #188) and merge `cb043b47a2c899e3c0585b06db4992fcc727c723` (merged-main CI #1858, Product Eval #1097, MCP #1002). Staging Deploy #480/#481 gate-passed and deploy remained skipped. At that repository checkpoint, real loss-marker/timing evidence was still pending; the later original runtime drill subsequently supplied and closed that evidence.

Checkpoint 7 is CLOSED / PASS at the repository marker-before-fetch enforcement boundary through PR #263 exact head `ba7ef7d6922c0177be582d5734095ed154f72622` (CI #1870, Product Eval #1109) and merge `cf8921f19a5c78db2d3d2fd075ac232983a0bbb4` (merged-main CI #1871, Product Eval #1110). Staging Deploy #504/#505 gate-passed and deploy remained skipped. At that repository checkpoint, real marker-before-fetch/retrieval/restore/timing evidence was still pending; the later original runtime drill subsequently supplied and closed that evidence.

Checkpoint 4 is CLOSED / PASS at the repository boundary through PR #254 / merge `2d0ce4f871eb828d421d87bf15b244542a661246`. Exact-head CI #1843, Product Eval #1082, MCP #991, and Desktop Installer #180 passed; merged-main CI #1844, Product Eval #1083, and MCP #992 passed. Staging Deploy #456/#457 gate-passed and deploy remained skipped. At that repository checkpoint, source/target runtime readiness still required real-host PASS evidence; the later original runtime drill subsequently supplied and closed it.

Runbook: [offhost-dr-recovery.md](offhost-dr-recovery.md).  
Checkpoint 1 evidence: [verification/offhost-dr-checkpoint-1-2026-09-22.md](verification/offhost-dr-checkpoint-1-2026-09-22.md).  
Checkpoint 2 evidence: [verification/offhost-dr-checkpoint-2-2026-09-22.md](verification/offhost-dr-checkpoint-2-2026-09-22.md).  
Checkpoint 3 evidence: [verification/offhost-dr-checkpoint-3-2026-09-22.md](verification/offhost-dr-checkpoint-3-2026-09-22.md).  
Checkpoint 4 evidence: [verification/offhost-dr-checkpoint-4-2026-09-22.md](verification/offhost-dr-checkpoint-4-2026-09-22.md).  
Checkpoint 5 evidence: [verification/offhost-dr-checkpoint-5-2026-09-22.md](verification/offhost-dr-checkpoint-5-2026-09-22.md).  
Checkpoint 6 evidence: [verification/offhost-dr-checkpoint-6-2026-09-22.md](verification/offhost-dr-checkpoint-6-2026-09-22.md).  
Checkpoint 7 evidence: [verification/offhost-dr-checkpoint-7-2026-09-22.md](verification/offhost-dr-checkpoint-7-2026-09-22.md).

## Latest repository-hardening closure

**Native Windows portability — PR #182**

```text
head                 108781b5d53034462393f06d5e9cb36e9c5d5cf5
CI                   #1477 PASS
Product Eval         #716 PASS
merge main           3461951414f72c8f183527e3d28eec20dd383d45
Windows suite        191 files PASS + 1 skipped
Windows tests        990 PASS + 3 skipped
```

This is maintenance hardening, not PE-09 or Batch 13. The clean-checkout follow-up is CLOSED / PASS on PR #183: implementation/evidence head `8b4bdc3793557dccf329a4aee19bec43ab8fb9bb` passed CI #1479 + Product Eval #718; final closure head `451c3b45366ca42004d6c5af53f59c475e911e6f` passed CI #1482 + Product Eval #721 and merged as `4980b3ceb149be58788467d2e11769de12977d5a`.

The final fresh-clone Windows EOL follow-up is also CLOSED / PASS on PR #185. It normalized only the three `.cmd` Git blobs (semantic diff = 0), preserved CRLF checkout via `.gitattributes`, passed CI #1486 + Product Eval #725 + Desktop Installer #76, merged as `4194e89a2b0611897969eaca2cb9c2b4b360c774`, and post-merge main passed CI #1487 + Product Eval #726. No PE or repository-hardening implementation batch remains. The separately approved PCS-00..PCS-10 roadmap subsequently completed and is now CLOSED / PASS.

## Latest Product Evolution closure

**PE-08 — Product closure**

```text
PR #180
reviewed implementation head    33f9e891c3152a82304d5f1e31693604c855d94c
implementation CI               35449548713 / #1469 PASS
implementation Product Eval     35449548657 / #708 PASS
closure evidence head           5d1b1c80168a26ae38af33d862a6fa26b019802c
closure-head CI                 35450417735 / #1473 PASS
closure-head Product Eval       35450417734 / #712 PASS
merge main                      b32d57022344ad08a59b6b7d163507c5530a7ca6
Product Eval matrix             36 files / 148 tests PASS
normal CI                       191 files PASS + 1 skipped
normal tests                    991 PASS + 2 skipped
```

Acceptance: [product-evolution-pe08-acceptance.md](product-evolution-pe08-acceptance.md).  
Closure evidence: [verification/pe-08-product-closure-2026-09-19.md](verification/pe-08-product-closure-2026-09-19.md).

## Post-closure roadmap status

There is **no active Product Evolution batch**. PE-00 through PE-08 remain CLOSED / PASS. The separate post-closure roadmap [post-closure-product-staging-roadmap.md](post-closure-product-staging-roadmap.md) is also CLOSED / PASS through PCS-10; it must not be renamed PE-09, PCS-11, or Batch 13.

**PCS-00 Baseline lock is CLOSED / PASS.** PR #189 exact head `f58311ae30beef877f0c38962bcf4b1aefe91917` passed CI #1492 + Product Eval #731 and merged as `12fae37e901e4cbfbb7e4cb6cf9b8e9a2ec4e764`. Evidence: [verification/pcs-00-baseline-lock-2026-09-20.md](verification/pcs-00-baseline-lock-2026-09-20.md).

**PCS-01 Chat continuity/history is CLOSED / PASS.** PR #191 exact head `9445b30c659628e1d551191219d0b7cd5ccf2f7c` passed CI #1505 + Product Eval #744 and merged as `ee363c055944b27b549a2f061105eea35fa25f9e`. Historical Ledger remains canonical history; no parallel chat-history store was introduced. Evidence: [verification/pcs-01-chat-continuity-2026-09-20.md](verification/pcs-01-chat-continuity-2026-09-20.md).

**PCS-02 AI provider onboarding + hosted model choice is CLOSED / PASS.** PR #193 exact head `45dbe9365b23dfa3398a4726a26f9a245bd09e9d` passed CI #1516 + Product Eval #755 and merged as `0fba6842f4c39f2742eb6d518e63c90d1a4883db`. Connect remains the provider credential/runtime/model authority. Evidence: [verification/pcs-02-provider-onboarding-2026-09-20.md](verification/pcs-02-provider-onboarding-2026-09-20.md).

**PCS-03 Local AI resilience/runtime discovery is CLOSED / PASS.** PR #195 exact head `5be1c68f7b345d5e7d433a9eed302000ffe552a1` passed CI #1525 + Product Eval #764 and merged as `4e2407af7240c9ca3b94ffbfb0a1c239c6a4ddae`. Connect remains the local-runtime owner; OpenAI-compatible remains the abstraction; no local runtime is a supported explicit state; no silent Local/Hosted fallback was introduced. Evidence: [verification/pcs-03-local-ai-resilience-2026-09-20.md](verification/pcs-03-local-ai-resilience-2026-09-20.md).

**PCS-04 Product visual + information-architecture cleanup is CLOSED / PASS.** PR #197 exact head `ec4ed1508cb7ab72fb9d86f15ec3541c2caf80f5` passed CI #1529 + Product Eval #768 and merged as `8a328ae0c0abeb039866ac40068a9053c4796659`. Core/Workspace/Advanced navigation, shared control readability, primary page hierarchy, and explicit Ai route labels were updated without backend ownership changes. Evidence: [verification/pcs-04-visual-ia-closure-2026-09-20.md](verification/pcs-04-visual-ia-closure-2026-09-20.md).

**PCS-05 Flow runtime defect closure is CLOSED / PASS.** PR #199 exact head `d7eb37e8b5e97da07895fcd050621e563a47359b` passed CI #1537 + Product Eval #776 and merged as `f58923b8261104c8aec331f506a68f8cf5fe5e7e`. Graph-state query handlers are registered before the first awaited workflow activity; exact `node.execute` authority is preflighted before Temporal start; the UI exposes explicit governed authority preparation through Hub approval; and runtime node authorization remains fail-closed. Evidence: [verification/pcs-05-flow-runtime-closure-2026-09-20.md](verification/pcs-05-flow-runtime-closure-2026-09-20.md).

**PCS-06 Integrated browser/regression acceptance is CLOSED / PASS.** PR #201 exact head `0dfdda92e0bef800ca9a7563223b7423aa9b1299` passed CI #1553 + Product Eval #792 + PCS-06 Integrated Browser Acceptance #13 and merged as `0a8f7619567500acaec0758c400d529367baf0e5`. The production Next.js UI is now covered by deterministic Chromium journeys across Ai, Projects, Work, Brain, Space, Flow, Operations, and Settings, including conversation continuity, Local-unavailable state, provider/model UX, responsive/theme behavior, and Flow authority-to-run acceptance. The browser gate blocks external HTTP(S) requests and therefore does not claim live provider quality/latency. Evidence: [verification/pcs-06-integrated-browser-closure-2026-09-20.md](verification/pcs-06-integrated-browser-closure-2026-09-20.md).

**PCS-07 SumoPod remote staging deployment is CLOSED / PASS.** The actual SumoPod host passes reviewed-source deployment, isolated Compose/volume inventory, public HTTPS reachability, protected operator surfaces, authenticated `/api/ops` health, sanitized exact-host evidence, a valid unauthenticated MCP OAuth challenge, and the final real-browser governed Flow journey. In the final Trigger-only v2 graph, execution authority was ready, `core/trigger/v1` was granted, Trigger reached `SUCCEEDED`, and the run reached `COMPLETED` without a paid provider call. The live runtime remains the reviewed deployment SHA `99523b0bb29ce11a74ec61c0e364ef5b6dd543ae`; PR #208 corrected only the public smoke verifier and merged as `59430c4b72a704d1fd6c6176d12b13fa27ddf674` after CI #1581 + Product Eval #820. Evidence: [verification/pcs-07-sumopod-host-closure-2026-09-20.md](verification/pcs-07-sumopod-host-closure-2026-09-20.md).

**PCS-08 GitHub -> staging continuous deployment is CLOSED / PASS.** PR #210 introduced the reviewed CD boundary; closure PR #215 merged as `f0aa9ca97518e3b7e57fc6bc7a58e0ed7761ba05` after the governed deploy/rollback/restore evidence completed. Exact-current-main gating, protected staging environment secrets, forced-command deploy access, serialized exact-revision deploys, post-deploy public/Ops/exact-host checks, release receipts, and tested runtime rollback are proven. Runbook: [staging-continuous-deployment.md](staging-continuous-deployment.md). Evidence: [verification/pcs-08-repository-preparation-2026-09-20.md](verification/pcs-08-repository-preparation-2026-09-20.md).

**PCS-09 staging persistence/security/backup/observability is CLOSED / PASS.** Exact reviewed runtime `0f332c73dc7b363bffecdeecae921d805d5ae131` passed key-only SSH hardening with fresh-session proof, strict host inventory with zero blockers, real full-VPS reboot persistence, 12-volume same-host cold backup with isolated restore-content verification, and final credentialed Operations + host-resource evidence. Closure PR #218 head `ece59440d742f59252046562cf3ba86e7911b46f` passed CI #1678 + Product Eval #917 and merged as `3db9e4854afbaccb9790638243fa98048c1a4f78`; merged-main CI #1679 + Product Eval #918 passed. Off-host DR and production promotion remain non-claims. Evidence: [verification/pcs-09-repository-preparation-2026-09-21.md](verification/pcs-09-repository-preparation-2026-09-21.md).

**PCS-10 closure/documentation convergence is CLOSED / PASS.** PR #219 exact head `c84f76face60d203592d8bc6e1a51acccfec5004` passed CI #1684 + Product Eval #923 and merged as `6058aa0ff294218147a91ee0fc7b77f32d1be80d`. Post-merge bookkeeping PR #220 passed CI #1686 + Product Eval #925 and merged as `fa55e530615e9eb3a35d646e39bbbb3bf34d8a07`. Current-state, active-work, staging, security/backup, documentation-map, repository-rule, Cloudflare, and decision documents agree on the verified staging boundary. No PCS implementation scope remains active.

Completed PCS execution sequence:

```text
PCS-00 baseline lock
 -> PCS-01 chat continuity/history
 -> PCS-02 provider onboarding + hosted model choice
 -> PCS-03 local AI resilience/runtime discovery
 -> PCS-04 visual + information-architecture cleanup
 -> PCS-05 Flow runtime defect closure
 -> PCS-06 integrated browser/regression acceptance
 -> PCS-07 SumoPod remote staging
 -> PCS-08 GitHub -> staging continuous deployment
 -> PCS-09 staging persistence/security/backup/observability
 -> PCS-10 closure/docs
```

The SumoPod target is a **verified remote development/staging runtime**, not production. GitHub remains source of truth; do not turn the live VPS working tree into an unmanaged development source. At the PCS-10 checkpoint the proven staging application revision was `0f332c73dc7b363bffecdeecae921d805d5ae131`. Later governed deployments superseded that historical runtime; the original DR drill ultimately exercised `b27c1e5833be0a0fccf3f525d82ae8853cd22113` / `staging-b27c1e5833be`.

**At the PCS-10/latest-main historical checkpoint the work queue was none.** DR-2 physical independence is now explicitly opened as a separate infrastructure scope; no feature, PE, PCS, Batch, production-promotion, or public-edge scope is implicitly opened.

## Follow-up maintenance checkpoint — 2026-09-21

Bounded repository maintenance is now **CLOSED through PR #237** at the source boundary. The latest implementation checkpoint before this docs-only convergence is `443ed254f7b4c5c3880387872e882e954602452b`.

The follow-up slice hardened Sync's MCP bridge failure boundary, serialized credential-vault mutations, serialized Sandbox idempotent execution races, and bounded default JWKS fetch latency. Exact-head CI/Product Eval passed for every PR; MCP External HTTPS also passed where the public MCP boundary changed.

**Current implementation queue remains none.** This checkpoint does not authorize production promotion, Cloudflare/public-edge activation, hosted spend, a new PE/PCS/Batch/F6 scope, or any staging-runtime claim beyond existing evidence.

At this historical maintenance checkpoint, the then-latest proven SumoPod staging runtime was `0f332c73dc7b363bffecdeecae921d805d5ae131` / `staging-0f332c73dc7b`; later governed deployments superseded it.

Evidence: [verification/post-closure-maintenance-checkpoint-2-2026-09-21.md](verification/post-closure-maintenance-checkpoint-2-2026-09-21.md).

## Maintenance checkpoint 3 — 2026-09-21

Bounded repository maintenance is now **CLOSED through PR #240** at the source boundary. The latest implementation checkpoint before this docs-only convergence is `eb4ac86da19bc006009e1a2260f14c119e7997e5`.

This slice bounded Sandbox control-plane owner calls and Connect webhook forwarding to Flow. Exact-head CI/Product Eval passed for both merged implementation PRs.

**Current implementation queue remains none.** This checkpoint does not authorize production promotion, Cloudflare/public-edge activation, hosted spend, a new PE/PCS/Batch/F6 scope, or any staging-runtime claim beyond existing evidence.

At this historical maintenance checkpoint, the then-latest proven SumoPod staging runtime was `0f332c73dc7b363bffecdeecae921d805d5ae131` / `staging-0f332c73dc7b`; later governed deployments superseded it.

Evidence: [verification/post-closure-maintenance-checkpoint-3-2026-09-21.md](verification/post-closure-maintenance-checkpoint-3-2026-09-21.md).

## Maintenance checkpoint 4 — 2026-09-21

Bounded repository maintenance is now **CLOSED through PR #242** at the source boundary. The latest implementation checkpoint before this docs-only convergence is `47cbeaa8760debbfde87cff7cb7a828037a2829b`.

This slice bounded the Ai server-side Flow owner proxy to 10 seconds by default while preserving redirect fail-closed behavior and sanitized `502 UPSTREAM_UNAVAILABLE` transport semantics. PR #242 exact head `db8a8f6068a40e47187a2142e6801e975e749276` passed CI #1743, Product Eval #982, and PCS-06 Integrated Browser Acceptance #18 before merge.

**Current implementation queue remains none.** This checkpoint does not authorize production promotion, Cloudflare/public-edge activation, hosted spend, a new PE/PCS/Batch/F6 scope, or any staging-runtime claim beyond existing evidence.

At this historical maintenance checkpoint, the then-latest proven SumoPod staging runtime was `0f332c73dc7b363bffecdeecae921d805d5ae131` / `staging-0f332c73dc7b`; later governed deployments superseded it.

Evidence: [verification/post-closure-maintenance-checkpoint-4-2026-09-21.md](verification/post-closure-maintenance-checkpoint-4-2026-09-21.md).

## Maintenance checkpoint 5 — 2026-09-21

Bounded repository maintenance is now **CLOSED through PR #244** at the source boundary. The latest implementation checkpoint before this docs-only convergence is `3114354ab44894ef80e75b9983fceac64babc2e0`.

This slice repairs Sandbox receipt-lock acquisition cleanup. If exclusive lock creation succeeds but lock metadata initialization fails, the just-created descriptor/file is cleaned before the original error is rethrown, preventing a pre-effect failure from leaving the idempotency key permanently busy. PR #244 exact head `462c9418078baefc7cd00eed79dd85dac4ee1bf9` passed CI #1747 and Product Eval #986 before merge.

**Current implementation queue remains none.** This checkpoint does not authorize production promotion, Cloudflare/public-edge activation, hosted spend, a new PE/PCS/Batch/F6 scope, or any staging-runtime claim beyond existing evidence.

At this historical maintenance checkpoint, the then-latest proven SumoPod staging runtime was `0f332c73dc7b363bffecdeecae921d805d5ae131` / `staging-0f332c73dc7b`; later governed deployments superseded it.

Evidence: [verification/post-closure-maintenance-checkpoint-5-2026-09-21.md](verification/post-closure-maintenance-checkpoint-5-2026-09-21.md).

## Closed PE-08 boundary

**PE-08 — Product closure**

Implementation/audit branch: `pe/pe-08-product-closure-20260919`, created from synchronized `main` `82026c8a1948336b2da4e00ee4832180f68452f7` after PR #179 merged.

Acceptance: [product-evolution-pe08-acceptance.md](product-evolution-pe08-acceptance.md).

Current closure scope:

- audit PE-00..PE-07 migration/compatibility as one product baseline;
- rerun Project isolation/security checks across Context, Sources, Flow/Trigger/Run, Brain, and ECX;
- verify durable owner state across local restart/persistence boundaries;
- verify backup/restore/rebuild semantics for new durable metadata and derived Brain;
- run relevant Windows/runtime/installer regression when the final diff requires it;
- run deterministic Product Evolution UX/navigation/responsive regressions and existing UX inventory;
- repair only reproducible closure blockers, not add unrelated features;
- converge current docs to one final state;
- archive superseded planning snapshots only after current docs replace them;
- close only on exact-head CI + Product Eval + every relevant acceptance gate.

Implementation/audit checkpoint:

- Product Eval now carries an explicit PE-08 closure matrix for Project migration/isolation, Project Source persistence, Context Project rules, Flow/Trigger isolation and restart-safe state, owner backup/restore, Brain rebuild, Product Evolution UX/navigation/responsive guards, and Windows installer specification;
- `test/pe08-product-closure.test.ts` exercises real Hub + Context + Flow SQLite backup -> post-backup mutation -> restore -> reopen and then rebuilds Brain from restored canonical owner state;
- Brain remains non-persistent; the test proves reconstruction rather than adding Brain backup state;
- existing local runtime/browser inventory remains a separate runtime evidence boundary and must not be mislabeled from source-only tests;
- no provider/model call, hosted spend, production deployment, L4 autonomy, AutoClick, or new feature domain is part of this closure work;
- reviewed implementation head `33f9e891c3152a82304d5f1e31693604c855d94c` passed CI #1469 and Product Eval #708;
- Product Eval closure matrix: 36 files / 148 tests PASS;
- normal CI suite: 191 files PASS + 1 skipped; 991 tests PASS + 2 skipped; Phase 4 3/3 PASS; production-ops, security/toolchain/container/build gates PASS;
- the closure-candidate documentation head was required before merge and PE-08 subsequently closed on PR #180.

Dependency gate:

```text
PE-00..PE-07  CLOSED / PASS
PE-08          CLOSED / PASS
```

## Non-negotiable boundaries

- no Batch 13;
- no feature expansion hidden inside closure;
- no second scheduler/retry database;
- Temporal remains durability/timer/retry owner;
- Workspace remains the authority boundary;
- Context remains retrieval owner;
- ECX remains context-pack optimizer;
- Brain remains rebuildable/derived, not canonical persistence;
- MAX_AUTONOMY_V1 stays L3;
- no paid hosted evidence without explicit authorization;
- public production cutover remains deferred as a separate explicit operator decision; operator-owned SumoPod remote staging is verified through PCS-07..PCS-09;
- AutoClick remains deferred by design.
