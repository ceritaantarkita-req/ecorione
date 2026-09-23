# ECORIONE — Current State & Next Steps

Last updated: **2026-09-23**

Status: **CURRENT / ORIGINAL OFF-HOST DR CLOSED-PASS / DR-2 PHYSICAL INDEPENDENCE DEFERRED / PRODUCTION CUTOVER DEFERRED**

## Current verdict

The original Batch/W/F6 baseline remains closed. Product Evolution PE-00 through PE-08 is also closed at the documented boundaries.

**PE-00 through PE-08 are CLOSED / PASS. No Product Evolution batch is active.**

## DR-2 physical independence — CHECKPOINT 1 CLOSED / CHECKPOINT 2 DEFERRED

Issue #277 opens a new additive infrastructure scope after the original Off-host DR runtime closure. The closed Issue #266 claim remains unchanged: total loss of the tested SumoPod staging host is recoverable at its documented boundary.

DR-2 addresses the remaining caveat that the previous backup-target WSL distro and replacement-host WSL distro shared one physical Windows machine. Checkpoint 1 repository foundation is now CLOSED / PASS through PR #278 / merge `4d1f4ef82839c74cc1ca8454511405a68424f0b7`, with exact-head CI #1913, Product Eval #1152, MCP External HTTPS #1011, and Desktop Installer #197 PASS, followed by merged-main CI #1914, Product Eval #1153, and MCP External HTTPS #1012 PASS.

Checkpoint 2 is now deliberately deferred by operator decision. No external target has been selected or contacted; no paid infrastructure, fresh-generation export, or new recovery drill has started. The interim backup posture is local backup only. An encrypted Google Drive copy is allowed later as an optional secondary off-device copy, but it is not yet a selected/validated DR-2 target.

The repository-side checkpoint-2 selection package is prepared and records eligible/ineligible target classes, the required non-secret operator decision, strict SSH custody/trust acceptance, and the safe stop boundary. This preparation does **not** select a target and does not close checkpoint 2. It remains the safe resume point if DR-2 is restarted later. Evidence: [verification/offhost-dr2-checkpoint-2-selection-package-2026-09-23.md](verification/offhost-dr2-checkpoint-2-selection-package-2026-09-23.md).

Plan: [offhost-dr-physical-independence.md](offhost-dr-physical-independence.md).

Safe checkpoint: [verification/offhost-dr2-safe-checkpoint-2026-09-23.md](verification/offhost-dr2-safe-checkpoint-2026-09-23.md). This records the exact resumable repository state after PR #283/#284, with DR-2 checkpoint 2 deferred and no external/runtime mutation in flight.

## Off-host DR runtime checkpoint — 2026-09-22

Real-host execution has moved beyond repository-only preparation.

The governed staging source selected for the now-closed original DR drill was exact SHA `b27c1e5833be0a0fccf3f525d82ae8853cd22113` / `staging-b27c1e5833be`. Three real encrypted off-host generations for that identity are retained on the independent SSH target; the fixed retained-generation audit reports `complete_generations=3`, `incomplete_generations=0`, and `retention_ready=1`.

The audit evidence path itself exposed one runtime tooling bug: SSH inside the manifest `while read` loop consumed the loop stdin. PR #267 fixed that with `ssh -n`; the fix was exercised from an isolated worktree and proved all three retained generations complete without moving the application runtime.

A genuinely clean replacement environment now exists as the separate WSL2 distro `ecorione-recovery`. It has native Docker/Compose, Node 22, Git, an initially empty Docker inventory, the pinned PostgreSQL helper image, and a clean detached checkout at exact source SHA `b27c1e...`. A dedicated recovery SSH key with pinned target host trust passes strict access to the independent backup target. The RSA DR private key and required deployment/operator secrets were recovered from separate operator-controlled sources and installed only on the clean recovery host as mode-0600 inputs.

Generation `ecorione-dr-20260922152938-b27c1e5833be.receipt.env` is selected for the drill. Its immutable loss marker was created at `2026-09-22T16:21:58.074Z`. From that marker onward the SumoPod source is treated as unavailable for this drill.

The first marker-bound fetch exposed a second repository tooling bug: the fetch helper shell-quoted a remote path even though modern OpenSSH `scp` uses SFTP by default, causing literal quote characters to be interpreted as part of the filename. Independent target inventory and a direct strict-SCP probe proved generation #3 is present and readable. PR #268 fixed the SFTP-safe path and made artifact fetch failures fail fast; exact head `df6381783d00a5b607438032c22afb3775a6a9d7` passed CI #1881 + Product Eval #1120 and merged as `bfca380ec12d30fe833b02011494e18988ec8807`; merged-main CI #1882 and Product Eval #1121 also passed.

The exact-source application checkout must remain at `b27c1e...`. The newer fetch compatibility fix may be run only from an isolated temporary worktree; it does not change the recorded application source identity.

The full off-host DR runtime drill is now **CLOSED / PASS** at the documented SumoPod host-loss boundary. Marker-bound independent retrieval, isolated decrypt/content verification, clean-host preflight, all 12 real project-volume restores, exact-source 15-service loopback startup, semantic canary, protected-route/MCP smoke, authenticated Operations, exact-host evidence, changed Linux boot ID, preserved project volumes/Connect fingerprints after reboot, and final marker-bound closure evidence all passed. Final measured drill values are `conservativeRpoSeconds=3147`, `retrievalReadyRtoSeconds=3138`, `dataReadyRtoSeconds=5582`, `applicationReadyRtoSeconds=30042`, and `finalRecoveryRtoSeconds=71523`. These are one-drill measurements, not an SLA. The tested recovery target and replacement compute were separate WSL distros on the same Windows machine, so physical-machine/disk independence is not claimed.

Runtime checkpoint evidence: [verification/offhost-dr-runtime-checkpoint-2026-09-22.md](verification/offhost-dr-runtime-checkpoint-2026-09-22.md).

## Latest-main staging convergence closure — 2026-09-22

The bounded latest-main staging-convergence scope is CLOSED / PASS at the runtime boundary.

Governed Staging Deploy #293 / run `35627920447` deployed exact reviewed `main` `52046db35e403babdda934881773c46bf2c57b68` as `staging-52046db35e40`. Both workflow jobs passed. Public smoke, authenticated Operations health, MCP protection checks, sanitized exact-host identity, and final PCS-08 deploy validation passed. The host evidence reported `headSha == expectedSha`, `healthy: true`, and no unhealthy owner services.

That convergence checkpoint established `52046db35e403babdda934881773c46bf2c57b68` / `staging-52046db35e40` at the time. It is now historical: subsequent governed DR runtime activation established exact staging source `b27c1e5833be0a0fccf3f525d82ae8853cd22113` / `staging-b27c1e5833be`, which became the source identity selected by the later, now-closed original recovery drill.

The reviewed deploy orchestrator writes the non-secret release receipt only after public/Ops/exact-host validation succeeds and emits its final PASS after that write, so the successful run proves the receipt path completed for the deployed SHA/tag.

This convergence did not rerun the full VPS reboot or same-host cold-backup acceptance on the new SHA. That statement is historical: the later Off-host DR runtime drill subsequently CLOSED / PASS for total SumoPod staging-host loss at its documented boundary. DR-2 physical independence is now the separate deferred follow-up scope; production promotion, public-edge activation, paid-provider evidence, and long-term external telemetry retention remain separate deferred boundaries.

Closure evidence: [verification/latest-main-staging-convergence-closure-2026-09-22.md](verification/latest-main-staging-convergence-closure-2026-09-22.md).

## Off-host Backup & DR — CLOSED / PASS

Checkpoint 1 repository foundation is CLOSED / PASS through PR #250 / merge `3c5417dd44099f6c74f0bc832f4631e3fa295c8d`. Exact merged-main CI #1766, Product Eval #1005, and MCP External HTTPS #922 passed. Staging Deploy #308/#309 passed their gates and skipped deployment because activation remained disabled.

Checkpoint 2 is CLOSED / PASS at the repository execution/recovery-tooling boundary through PR #251 / merge `768c0f617064343f0bfc569d52212c80a03f0b83`. Checkpoint 3 is CLOSED / PASS at the repository boundary through PR #252 / merge `9e522e62212b5a4170ad4947c4bdd75c28f34464`; it adds a standalone replacement-host boundary with clean-host preflight, loopback-only Caddy policy edge, local MCP/security smoke, loopback authenticated Operations, and post-reboot repeat evidence without relying on SumoPod Traefik, public DNS, or public TLS.

Checkpoint 4 adds two read-only pre-mutation gates: source-host readiness binds the active release receipt, exact Git/image identity, PCS-09 strict inventory, running services, volume footprint, and local backup headroom; independent-target readiness binds strict SSH trust/custody plus a remote free-space floor derived from that exact source footprint. Neither gate creates a backup or uploads an artifact.

Checkpoint 4 repository implementation is CLOSED / PASS through PR #254 exact head `5245be4a7f0874d57b9b89e4e587aa79db90f8cf` and merge `2d0ce4f871eb828d421d87bf15b244542a661246`. Exact-head CI #1843, Product Eval #1082, MCP #991, and Desktop Installer #180 passed. Merged-main CI #1844, Product Eval #1083, and MCP #992 passed. Staging Deploy #456/#457 kept deploy skipped, so repository closure did not move the proven SumoPod runtime.

The source host still needs only an RSA-3072+ public key for the later export. The private DR key stays out-of-band and is required only on the recovery side.

Checkpoint 5 adds a read-only remote generation audit and a deterministic sanitized closure-evidence generator. The target audit verifies retained manifest/artifact modes, stems and remote hashes without upload/delete/rename; checkpoint 6 then replaces checkpoint 5's free-form loss-time input with an immutable mode-0600 loss-marker receipt bound to the selected retained generation. Final closure evidence computes conservative RPO plus retrieval/data/application/final RTO milestones from that marker-bound receipt chain.

Checkpoint 5 repository implementation is CLOSED / PASS through PR #256 exact head `7c1c8948022fc81e0c640fff7a8bcb7e4e689db3` and merge `941cb8c9ed237a5417550449c7d73e712b10ba72`. Exact-head CI #1850, Product Eval #1089, MCP #996, and Desktop Installer #184 passed. Merged-main CI #1851, Product Eval #1090, and MCP #997 passed. Staging Deploy #468/#469 kept deploy skipped, so repository closure did not move the proven SumoPod runtime.

Checkpoint 6 removes the free-form timing input from DR closure. A mode-0600 immutable loss-marker receipt now records current recovery-host UTC time, drill UUID, and selected export-manifest filename before fetch; closure evidence must bind to that marker and records its SHA-256.

Checkpoint 7 moves that marker from a final-evidence-only input into the actual recovery gate. Independent fetch now requires the exact marker before the first SCP, writes marker identity/hash plus retrieval-start time into the retrieval receipt, restore rejects unbound retrieval evidence, acceptance propagates the same chain, and final closure cross-checks all receipts against the actual marker file.

Checkpoint 7 repository implementation is CLOSED / PASS through PR #263 exact head `ba7ef7d6922c0177be582d5734095ed154f72622` and merge `cf8921f19a5c78db2d3d2fd075ac232983a0bbb4`. Exact-head CI #1870 and Product Eval #1109 passed. Merged-main CI #1871 and Product Eval #1110 passed. Staging Deploy #504/#505 kept deploy skipped, so repository closure did not move the proven SumoPod runtime.

Checkpoint 6 repository implementation is CLOSED / PASS through PR #258 exact head `b8379a2c756e2e4ea3e00424c360072b6a910829` and merge `cb043b47a2c899e3c0585b06db4992fcc727c723`. Exact-head CI #1857, Product Eval #1096, MCP #1001, and Desktop Installer #188 passed. Merged-main CI #1858, Product Eval #1097, and MCP #1002 passed. Staging Deploy #480/#481 kept deploy skipped, so repository closure did not move the proven SumoPod runtime.

The repository-only checkpoint non-claims above are now superseded by real runtime closure at the documented boundary: source/target readiness, three-generation retention, immutable marker, independent retrieval, isolated verification, 12-volume restore, exact-source startup, pre/post-reboot acceptance, changed-boot-ID persistence, and sanitized closure timing evidence all passed. Total loss of the SumoPod staging host is therefore proven recoverable for this tested generation and topology, subject to the documented same-Windows-host and secret-custody caveats.

Runbook: [offhost-dr-recovery.md](offhost-dr-recovery.md).  
Checkpoint 1 evidence: [verification/offhost-dr-checkpoint-1-2026-09-22.md](verification/offhost-dr-checkpoint-1-2026-09-22.md).  
Checkpoint 2 evidence: [verification/offhost-dr-checkpoint-2-2026-09-22.md](verification/offhost-dr-checkpoint-2-2026-09-22.md).  
Checkpoint 3 evidence: [verification/offhost-dr-checkpoint-3-2026-09-22.md](verification/offhost-dr-checkpoint-3-2026-09-22.md).  
Checkpoint 4 evidence: [verification/offhost-dr-checkpoint-4-2026-09-22.md](verification/offhost-dr-checkpoint-4-2026-09-22.md).  
Checkpoint 5 evidence: [verification/offhost-dr-checkpoint-5-2026-09-22.md](verification/offhost-dr-checkpoint-5-2026-09-22.md).  
Checkpoint 6 evidence: [verification/offhost-dr-checkpoint-6-2026-09-22.md](verification/offhost-dr-checkpoint-6-2026-09-22.md).  
Checkpoint 7 evidence: [verification/offhost-dr-checkpoint-7-2026-09-22.md](verification/offhost-dr-checkpoint-7-2026-09-22.md).

## Historical operator decision that opened PCS — 2026-09-20

The operator approved a post-closure scope after real browser use on a clean local checkout. That scope is now fully closed through PCS-10; this section preserves what was authorized and does not describe an active queue. It did not reopen PE-00..PE-08 and was not Batch 13.

The now-closed scope is documented in [post-closure-product-staging-roadmap.md](post-closure-product-staging-roadmap.md) and covered:

- persistent Ai conversation/session history across navigation;
- simpler provider/API-key onboarding with technical controls moved behind Advanced surfaces;
- OpenRouter user-facing model selection plus a governed/recommended pinned route;
- local AI reachability detection with Ollama remaining optional rather than required;
- product-wide visual/information-architecture cleanup;
- closure of observed Flow runtime/query/authority failures;
- integrated real-browser regression;
- operator-owned SumoPod deployment as **remote development/staging**;
- GitHub `main` as source of truth with verified GitHub-to-staging deployment, health checks, and rollback;
- staging persistence, HTTPS/auth, backup, and observability before any production-promotion decision.

Production public cutover remains a separate gate. Remote staging approval must not be mislabeled as production evidence.

## PCS-00 baseline lock — CLOSED / PASS

PCS-00 starts from synchronized reviewed `main` commit `93c5312d73289305d3e16ff79c5457a5010d0b19`, the merge of PR #188. Its reviewed roadmap head `c4088bd04298d42809b7b012b353d2e977e7a931` passed CI #1490 and Product Eval #729.

The baseline preserves the closed owner/security architecture and makes exact-head verification mandatory for subsequent PCS product changes. PR #189 exact head `f58311ae30beef877f0c38962bcf4b1aefe91917` passed CI #1492 + Product Eval #731 and merged as `12fae37e901e4cbfbb7e4cb6cf9b8e9a2ec4e764`. PCS-00 is **CLOSED / PASS**. Evidence: [verification/pcs-00-baseline-lock-2026-09-20.md](verification/pcs-00-baseline-lock-2026-09-20.md).

## PCS-01 chat continuity/history — CLOSED / PASS

PR #191 exact head `9445b30c659628e1d551191219d0b7cd5ccf2f7c` passed CI #1505 + Product Eval #744 and merged as `ee363c055944b27b549a2f061105eea35fa25f9e`.

Ai now preserves active sessions per Project, reopens exact canonical Historical Ledger conversations, exposes explicit New chat/history navigation, and enforces Workspace + Project binding on single-session History reads. No parallel history database was added. Integrated live-browser regression subsequently closed under PCS-06.

Evidence: [verification/pcs-01-chat-continuity-2026-09-20.md](verification/pcs-01-chat-continuity-2026-09-20.md).

## PCS-02 provider onboarding + hosted model choice — CLOSED / PASS

PR #193 exact head `45dbe9365b23dfa3398a4726a26f9a245bd09e9d` passed CI #1516 + Product Eval #755 and merged as `0fba6842f4c39f2742eb6d518e63c90d1a4883db`.

Settings now provides provider cards, transient key testing before encrypted save, automatic route activation, verified hosted model selection, and an explicit Governed / Recommended choice. Technical runtime/Vault/MCP controls remain behind Advanced settings. Connect remains the sole provider credential/runtime/model authority; RESTRICTED routing can still override user model choice according to policy.

Evidence: [verification/pcs-02-provider-onboarding-2026-09-20.md](verification/pcs-02-provider-onboarding-2026-09-20.md).

## PCS-03 Local AI resilience/runtime discovery — CLOSED / PASS

PR #195 exact head `5be1c68f7b345d5e7d433a9eed302000ffe552a1` passed CI #1525 + Product Eval #764 and merged as `4e2407af7240c9ca3b94ffbfb0a1c239c6a4ddae`.

Connect now exposes explicit Local runtime/model readiness, transient candidate discovery before persistence, optional runtime-backed digest resolution, and fail-closed identity mismatch handling. Settings treats no local runtime as a supported state and keeps Ollama optional. Ai blocks a Local route already known to be unavailable rather than sending a predictable 502, and does not silently fall back to Hosted.

Evidence: [verification/pcs-03-local-ai-resilience-2026-09-20.md](verification/pcs-03-local-ai-resilience-2026-09-20.md).

## PCS-04 Product visual + information-architecture cleanup — CLOSED / PASS

PR #197 exact head `ec4ed1508cb7ab72fb9d86f15ec3541c2caf80f5` passed CI #1529 + Product Eval #768 and merged as `8a328ae0c0abeb039866ac40068a9053c4796659`.

The product navigation now distinguishes Core, Workspace, and Advanced surfaces; shared control/native-select behavior is more consistent; Projects/Work/Brain use a clearer hierarchy; advanced surfaces have improved technical-text readability; and Ai exposes concrete route/provider/model state instead of only abstract Local/Hosted labels. Backend ownership and routing semantics were unchanged.

Evidence: [verification/pcs-04-visual-ia-closure-2026-09-20.md](verification/pcs-04-visual-ia-closure-2026-09-20.md).

## PCS-05 Flow runtime defect closure — CLOSED / PASS

PR #199 exact head `d7eb37e8b5e97da07895fcd050621e563a47359b` passed CI #1537 + Product Eval #776 and merged as `f58923b8261104c8aec331f506a68f8cf5fe5e7e`.

Flow now registers graph-state query/signal handlers before its first awaited lifecycle activity, preflights exact `node.execute` standing authority before Temporal start, and exposes an explicit version-bound **Prepare authority** flow backed by the existing Hub `POLICY_ADMIN` durable approval path. Missing authority fails before Temporal start with an actionable error, while runtime execution still re-authorizes each node and therefore remains fail-closed after grant revocation. No auto-grant or second execution/authority plane was introduced.

Evidence: [verification/pcs-05-flow-runtime-closure-2026-09-20.md](verification/pcs-05-flow-runtime-closure-2026-09-20.md).

## PCS-06 Integrated browser/regression acceptance — CLOSED / PASS

PR #201 exact head `0dfdda92e0bef800ca9a7563223b7423aa9b1299` passed CI #1553 + Product Eval #792 + PCS-06 Integrated Browser Acceptance #13 and merged as `0a8f7619567500acaec0758c400d529367baf0e5`.

The production Next.js UI is now exercised in Chromium across Ai, Projects, Work, Brain, Space, Flow, Operations, and Settings. The acceptance covers canonical conversation replay/continuity, explicit Local-unavailable state, provider onboarding/model selection, theme and narrow layout behavior, console/page-error and page-overflow checks, and Flow Save -> governed authority preparation -> explicit approval -> Run -> completed state. API/provider responses are deterministic same-origin fixtures and external HTTP(S) requests fail the gate, so this evidence does not claim live provider quality, latency, or staging behavior.

Evidence: [verification/pcs-06-integrated-browser-closure-2026-09-20.md](verification/pcs-06-integrated-browser-closure-2026-09-20.md).

## PCS-07 SumoPod remote staging deployment — CLOSED / PASS

The actual SumoPod staging host is deployed and healthy at reviewed SHA `99523b0bb29ce11a74ec61c0e364ef5b6dd543ae`. All configured staging services are running in the isolated `ecorione-staging` Compose project; sanitized host evidence matched the expected SHA with a clean worktree and mode-0600 deployment env. Public HTTPS home returned 200, `/ops` and `/settings` remain 401 without operator credentials, authenticated `/api/ops` reported `healthy: true` with no unhealthy required services, MCP protected-resource metadata returned 200, and a valid unauthenticated MCP request returned the expected 401 Bearer challenge. PR #208 then corrected the malformed public-smoke verifier and merged as `59430c4b72a704d1fd6c6176d12b13fa27ddf674` after CI #1581 + Product Eval #820.

The final real-browser governed staging journey also passed: the browser exposed the Flow authority requirements, explicit approvals moved the graph to Execution authority ready, and the final Trigger-only v2 revision ran with `core/trigger/v1` granted, Trigger `SUCCEEDED`, and run `COMPLETED` without a paid provider call. PCS-07 is therefore CLOSED / PASS at the staging-deployment boundary. Evidence: [verification/pcs-07-sumopod-host-closure-2026-09-20.md](verification/pcs-07-sumopod-host-closure-2026-09-20.md).

## PCS-08 GitHub -> staging continuous deployment — CLOSED / PASS

The merged PR #210 repository implementation provides a least-privilege GitHub-to-SumoPod path: exact current `main` must have successful CI + Product Eval push runs, then a protected `staging` Environment may invoke a dedicated SSH key whose server-side forced command accepts only `deploy <40-char SHA>`. The host independently verifies that SHA against freshly fetched `origin/main`, serializes deploys, runs preflight, deploys a unique immutable staging image tag, requires all configured services running, public HTTPS smoke, authenticated `/api/ops`, and exact-host evidence, then records current/previous SHA + image tag. A failed post-deploy gate attempts runtime rollback and still leaves the GitHub deployment failed.

The deploy account is not added to the Docker group, the workflow uses strict known-host verification rather than `ssh-keyscan`, and there is no blind polling `git pull` loop. Repository runbook: [staging-continuous-deployment.md](staging-continuous-deployment.md). PR #210 exact head `4a5fa9d9d776eae3895a8e0b8e6b73013e3f476f` passed CI #1613 + Product Eval #852 and merged as `652588e00dca5a04c8b39081fb6574a3db508ba1`. Repository-preparation evidence: [verification/pcs-08-repository-preparation-2026-09-20.md](verification/pcs-08-repository-preparation-2026-09-20.md). At that repository-preparation checkpoint, PCS-08 remained ACTIVE. The real SumoPod host bootstrap now passes from reviewed `main` merge `74c76fa2685333db3a59b04d0ca34554f8e9fcf0`: dedicated `ecorione-deploy` exists, is not in the Docker group, the sudoers policy parses, control files are root-owned, the known-good live checkout remained `99523b0bb29ce11a74ec61c0e364ef5b6dd543ae`, and public home/`/ops` remained 200/401. The dedicated key now also passes a fail-closed workstation test: interactive/no-command SSH and arbitrary `whoami` were both denied by the forced-command boundary with exit code 126. The protected GitHub `staging` Environment is now configured. First governed deploy run #35529468459 exercised the real mutation/rollback path against exact `main` `38d1bc057827ddd702d603d49bc0cad629d90c5f`: the target image built and services recreated, but an immediate public smoke saw transient 502 before the edge was ready; rollback recreated the prior `99523b0...` runtime, whose immediate one-shot verification hit the same transient 502. Independent host verification afterwards proved recovery at `99523b0...`, 15/15 services, home 200/TLS 0, and `/ops` 401. Activation returned to `0`. PR #214 added bounded public-edge readiness waiting, passed CI #1628 + Product Eval #867, merged as `0b50a426ca2b14202eba769297af6c15a579b09f`, and its main push passed CI #1629 + Product Eval #868. The host deploy control was refreshed from exact reviewed merge `0b50a426ca2b14202eba769297af6c15a579b09f` without moving the live checkout. Controlled retry run #35531374454 then PASSed end-to-end: readiness attempts 1–3 observed transient home 502 while `/ops` was already 401, attempt 4 reached home 200 + `/ops` 401, full public smoke passed, authenticated `/api/ops` reported healthy with no unhealthy required services, and exact-host evidence matched `0b50a426...` with all 15 services running and a clean detached worktree. The release receipt matched the successful exact-main deploy. A deliberate controlled rollback then PASSed to `99523b0bb29ce11a74ec61c0e364ef5b6dd543ae` / `staging-99523b0`: readiness reached home 200 + `/ops` 401 on attempt 5, all 15 services ran, authenticated `/api/ops` was healthy, and exact-host evidence matched the rollback SHA with a clean detached worktree. Because that historical checkout contains the known pre-PR-208 malformed MCP smoke request, rollback public verification used the reviewed current smoke verifier from exact `0b50a426...` without changing the rolled-back runtime; it passed the valid MCP 401 challenge. No data rollback was performed or claimed. Restore run #35553612685 then PASSed through the same governed GitHub CD path back to exact `main` `0b50a426ca2b14202eba769297af6c15a579b09f`: public readiness reached home 200 + `/ops` 401 on attempt 5, full public smoke passed, authenticated ops health remained healthy, exact-host evidence matched the restored SHA, and all 15 configured services were running. Automatic CD was then frozen to `0`. Final independent host verification matched the restored release receipt (`0b50a426...` / `staging-0b50a426ca2b`), exact HEAD and runtime image, 15/15 running services, home 200/TLS 0, `/ops` 401, clean worktree, and exact-host evidence PASS. PCS-08 is therefore **CLOSED / PASS**. Restart persistence, backup/restore, SSH hardening, and staging observability subsequently closed under PCS-09.

## PCS-09 staging persistence/security/backup/observability — CLOSED / PASS

PR #216 exact head `0bf1414859d4bf573f1ebc46ad6286b125ca1f38` passed CI #1664 + Product Eval #903 and squash-merged as `acd050139f8d5db0dcdadeb8c072ab6432100f0f`. Exact merged-main CI #1665 + Product Eval #904 + MCP External HTTPS Acceptance #894 passed. Automatic Staging Deploy gates #106/#107 passed while the deploy job stayed skipped because activation remained disabled.

At the PCS-09 repository-preparation checkpoint, the merged repository contained a sanitized real-host inventory, actual VPS reboot persistence verifier, guarded key-only SSH hardening helper, same-host cold-volume backup with isolated restore-content verification, deterministic source-contract coverage, and an operator runbook. At that point no VPS hardening/reboot/backup mutation had yet been performed; the real-host acceptance recorded immediately below subsequently completed those mutations.

Exact reviewed `main` `0f332c73dc7b363bffecdeecae921d805d5ae131` was deployed through governed run #35563423107 and passed public smoke, authenticated Ops, exact-host evidence, and 15/15 service checks. The first real PCS-09 non-strict host inventory then passed runtime/network/disk/memory/boot checks and identified exactly two hardening blockers: SSH password authentication still enabled and root login still permitted. Connect runtime/Vault/budget durable files are absent in this staging state, so no persistence claim is made for absent data. Guarded SSH hardening has now been applied: effective `PermitRootLogin no`, `PasswordAuthentication no`, `KbdInteractiveAuthentication no`, `PubkeyAuthentication yes`, and `PermitEmptyPasswords no`. A second fresh Windows PowerShell SSH session then connected successfully as `ubuntu` with the operator key, and `sudo -n true` passed. The original session was kept open until that proof succeeded. Strict PCS-09 host inventory then PASSed with `blockers=[]` and `closureReady=true`: 15/15 services, no published staging ports, Docker boot enablement, UFW, key-only SSH posture, disk/memory thresholds, and public 200/401 boundary all passed. The controlled VPS reboot baseline is now captured at boot ID `38133aa8-fcd7-41b5-8729-4c6dabb0206a`, exact SHA `0f332c73...`, image tag `staging-0f332c73dc7b`, and 15 running services. The controlled full VPS reboot is now proven: Linux `boot_id` changed from `38133aa8-fcd7-41b5-8729-4c6dabb0206a` to `c523f1d5-9ec5-4cf5-b560-9ec06a4be637`, exact source/image identity stayed on `0f332c73...` / `staging-0f332c73dc7b`, 15/15 services returned, all project volumes were preserved, and public smoke + authenticated Ops + exact-host evidence all PASSed. Same-host cold backup + isolated restore verification is now PASS: all 12 ECORIONE staging volumes were archived and independently restored/fingerprint-checked, staging recovered to home 200 / ops 401, and the verified backup is stored under `/var/lib/ecorione-staging/backups/backup-20260921T054802Z-0f332c73dc7b`. This remains same-host evidence only, not off-host DR. Final credentialed Operations evidence is also PASS: `healthy=true`, 9/9 owner entries healthy, 8 trace groups, live HTTP request counters/request-duration histograms, and owner RSS; final strict host inventory remains `blockers=[]`, `closureReady=true`, 15/15 services, 15.99 GiB available disk, and 4261 MiB available memory. Specialized model/cost/Flow telemetry is instrumented but is not claimed as a non-zero live workload in this final snapshot; no paid call was created merely for evidence. All real-host PCS-09 acceptance gates completed. Closure PR #218 exact head `ece59440d742f59252046562cf3ba86e7911b46f` passed CI #1678 + Product Eval #917 and squash-merged as `3db9e4854afbaccb9790638243fa98048c1a4f78`; merged-main CI #1679 + Product Eval #918 passed. Staging Deploy #135/#136 each passed the gate and skipped deploy because activation remained disabled, so the proven runtime stayed on `0f332c73dc7b363bffecdeecae921d805d5ae131`. PCS-09 is CLOSED / PASS.

## PCS-10 closure/documentation convergence — CLOSED / PASS

PCS-10 converged the current-state, active-work, staging, hardening/backup, documentation-map, decision-log, and deployment guidance onto the proven PCS-09 boundary. Stale statements that PCS-08 is active, PCS-09 is pending, or SumoPod staging is still deferred are removed. The SumoPod staging runbook is also de-duplicated and repaired so its operator commands match the actual host toolchain.

Closure PR #219 exact head `c84f76face60d203592d8bc6e1a51acccfec5004` passed CI #1684 + Product Eval #923 and merged to `main` as `6058aa0ff294218147a91ee0fc7b77f32d1be80d`. PCS-10 is therefore CLOSED / PASS on `main`. This documentation-only closure did not authorize production promotion or open a new implementation scope.

No runtime, provider, DNS, firewall, or production-promotion mutation is authorized by PCS-10. ECORIONE has a verified remote staging topology; **public production cutover remains a separate explicit operator decision**.

There is no active PCS implementation queue after PCS-10. Future work requires a new explicit scope/decision rather than silently creating PCS-11, PE-09, or Batch 13. Evidence: [verification/pcs-10-documentation-convergence-2026-09-21.md](verification/pcs-10-documentation-convergence-2026-09-21.md).

## Post-closure repository hardening

Native Windows portability was repaired and merged through PR #182:

```text
PR                              #182
reviewed head                   108781b5d53034462393f06d5e9cb36e9c5d5cf5
PR CI                           #1477 PASS
PR Product Eval                 #716 PASS
merge main                      3461951414f72c8f183527e3d28eec20dd383d45
Windows local normal suite      191 files PASS + 1 skipped
Windows local tests             990 PASS + 3 skipped
Windows production-shell check  5/5 PASS with explicit MSYS Bash
```

The hardening adds deterministic line-ending policy, platform-independent desktop path assertions, Node-native Tier-0 `pwd`/`ls`/`cat`, and an explicit `ECORIONE_BASH` override for Bash syntax validation on Windows. This does not reopen Product Evolution or change owner/security architecture.

Evidence: [verification/windows-native-portability-closure-2026-09-20.md](verification/windows-native-portability-closure-2026-09-20.md).

Clean-checkout reproducibility hardening is also CLOSED / PASS on PR #183. The implementation/evidence head `8b4bdc3793557dccf329a4aee19bec43ab8fb9bb` passed CI #1479 + Product Eval #718; the final closure head `451c3b45366ca42004d6c5af53f59c475e911e6f` passed CI #1482 + Product Eval #721 and merged to `main` as `4980b3ceb149be58788467d2e11769de12977d5a`. CI no longer rewrites those three historical PE test files before `format:check`.

Fresh-clone Windows EOL reproducibility is now also CLOSED / PASS. A clean Windows clone passed the pinned Node 22.20.0 / pnpm 10.28.0 toolchain, `pnpm verify` (191 test files PASS + 1 skipped; 990 tests PASS + 3 skipped; 0 failures), secret scan, and production build. That clean clone exposed one remaining hygiene defect: the three tracked `.cmd` blobs were still stored as CRLF in the Git index, producing a false dirty working tree even though semantic diff was zero. PR #185 renormalized them to canonical index LF while `.gitattributes` continues to materialize CRLF in Windows working trees (`i/lf w/crlf attr/text eol=crlf`). PR head `600f459fbe2671e7e4297e60da725b005b6f9533` passed CI #1486, Product Eval #725, and Desktop Installer #76; it merged as `4194e89a2b0611897969eaca2cb9c2b4b360c774`. Post-merge main then passed CI #1487 and Product Eval #726.

## Product Evolution status

| Batch | State |
|---|---:|
| PE-00 Architecture lock | **CLOSED / PASS** |
| PE-01 Project foundation | **CLOSED / PASS** |
| PE-02 Project Sources | **CLOSED / PASS** |
| PE-03 Trigger control plane | **CLOSED / PASS** |
| PE-04 Work + Schedule + Runs | **CLOSED / PASS** |
| PE-05 Event/Webhook automation | **CLOSED / PASS** |
| PE-06 Brain V1 | **CLOSED / PASS** |
| PE-07 Brain + Context + ECX | **CLOSED / PASS** |
| PE-08 Product closure | **CLOSED / PASS** |

## PE-02 delivered boundary

- Hub owns Project binding metadata only.
- Artifact sources are authorized through the existing Context/Artifact boundary.
- Space pages are validated in the same Workspace.
- Flow graphs are validated in the same Workspace and may be explicitly reused across Projects.
- outbound MCP servers must be visible to the same Workspace through Connect.
- URL sources are HTTPS references only; no remote content is copied.
- owner deletion/revocation produces an unavailable source state without deleting canonical owner data.
- attach/detach is audited.
- Ai Project detail includes Sources attach/list/detach UI.
- Project A/B and cross-Workspace negative paths are covered.

Acceptance: [product-evolution-pe02-acceptance.md](product-evolution-pe02-acceptance.md).

## PE-02 reviewed evidence

```text
PR #171
implementation head a6167df469cf491015b232aff8a192b32a25c569
CI #1223 PASS
Product Eval #462 PASS
MCP External HTTPS Acceptance #628 PASS
```

PR #171 is merged to `main` as `c734f00eaa791077c99557e6e89579534c43d651`; PE-02 remains CLOSED / PASS.

## PE-03 closed boundary

PE-03 closed on PR #172 exact head `74730e26321cac06c31243baeeafe29d5f4d75f0` and merged as `c739c09014d8aa20ca8e1b83c5b6be39b4ee649c`. Trigger metadata remains Flow-owned, Temporal remains schedule/runtime truth, and Hub remains authority/policy owner. See [verification/pe-03-trigger-control-plane-closure-2026-09-19.md](verification/pe-03-trigger-control-plane-closure-2026-09-19.md).

## PE-04 closed boundary

PE-04 closed on PR #173 after implementation head `c2cacbbcbee15f46ac4c5e9e43c955f5c952af43` and closure head `94936fa0704991d3536667bb8c947e9d751c813e` passed the required gates. It merged as `c08581a00a20dc6016c570a1fbb777d81e391699`. Work now exposes Project-scoped Schedule, Flow links, and an `operationId`-keyed Run read projection without a Task domain or second execution database. See [verification/pe-04-work-schedule-runs-closure-2026-09-19.md](verification/pe-04-work-schedule-runs-closure-2026-09-19.md).

## PE-05 closed boundary

PE-05 closed on PR #174 after implementation head `b3fa55e689548b5a72c47b331682285eb8fb6eb2` and closure head `3d082f555a0c701eb9911d5caa71f7cf250f5710` passed the required gates. It merged as `84defe934bf6b7d0b8868bd04c8c113e70193fc6`. Non-time Trigger delivery now uses Connect-verified webhook ingress, Flow-owned normalization/routing/dedupe, existing Hub authority, Temporal execution, and operationId-keyed Run evidence without a polling daemon, second queue, or second execution authority. See [verification/pe-05-event-webhook-closure-2026-09-19.md](verification/pe-05-event-webhook-closure-2026-09-19.md).

## PE-06 closed boundary

PE-06 closed on PR #176 after implementation head `66c7909572a1410095916843f8f46a385ecb628b` and closure head `25508dd1cef5d8ebb8846448c7732ddde7866a59` passed the required gates. It merged as `d54ad62c303847b23634ba33aead4749f21bf1d0`. Brain now exposes a Project-scoped deterministic projection over Project, Source, Flow, Trigger, and Run owner contracts with authorization-before-disclosure, sibling-Project isolation, rebuildability proof, and no graph database/canonical Brain store. See [verification/pe-06-brain-v1-closure-2026-09-19.md](verification/pe-06-brain-v1-closure-2026-09-19.md).

## PE-07 closed boundary

PE-07 closed on PR #178 after implementation head `892726c20ac95dded26fdc3fd2000ad4bb56363d` and closure head `e443a6e9d10b24b7c1de7bcb315b038cf6425a45` passed the required CI, Product Eval, and MCP gates. It merged as `15e31ed4b03f5be5bc6a7104fc14bb1dd0917743`. The bounded deterministic evidence measured 66.67% median candidate reduction across three fixtures while retaining 100% of required references/provenance and admitting zero unauthorized refs. See [verification/pe-07-brain-context-ecx-closure-2026-09-19.md](verification/pe-07-brain-context-ecx-closure-2026-09-19.md).

## PE-08 closed boundary

PE-08 was the final Product Evolution closure batch. Its closure matrix covered migration/reopen behavior, Project isolation, Source binding persistence, Context policy intersections, Flow/Trigger Project boundaries, owner backup/restore, derived Brain rebuild, UX/navigation/responsive source guards, and Windows installer specification. The integrated DR test restores Hub + Context + Flow canonical state after deliberate post-backup mutation and rebuilds Brain from the restored owners instead of persisting Brain.

Reviewed implementation head `33f9e891c3152a82304d5f1e31693604c855d94c` passed CI #1469 and Product Eval #708. Closure head `5d1b1c80168a26ae38af33d862a6fa26b019802c` passed CI #1473 and Product Eval #712. PR #180 merged as `b32d57022344ad08a59b6b7d163507c5530a7ca6`. Product Eval ran 36 files / 148 tests; normal CI ran 191 files PASS + 1 skipped and 991 tests PASS + 2 skipped, plus Phase 4 3/3, production-ops, security/toolchain/container reviews, Windows installer specification/acceptance tests, and production build.

PE-08 is not a feature expansion batch. Production VPS/Cloudflare, rendered local browser walkthrough, AutoClick, paid hosted evidence, L4 autonomy, graph persistence, and unrelated redesign remain outside scope.

Acceptance: [product-evolution-pe08-acceptance.md](product-evolution-pe08-acceptance.md).

## Post-closure maintenance checkpoint — 2026-09-21

A bounded repository audit after PE/PCS closure repaired concrete maintenance defects without opening a new roadmap. The implementation checkpoint immediately before this documentation convergence is `1618b45e3c0837a84e17d258182cd73cad3f0591`.

Closed maintenance through PR #232 includes:

- W18 cleanup state preservation while Hosted remains forced OFF;
- redirect fail-closed hardening across internal/owner, hosted-provider, multimodal, local-runtime, and JWKS fetch boundaries;
- bounded JWKS key-rotation refresh with cooldown against fetch amplification;
- correct MCP auth error semantics: malformed/invalid tokens remain caller auth failures while JWKS dependency outages remain upstream failures;
- preservation of JWKS outage classification during unknown-`kid` refresh cooldown;
- Local multimodal endpoint scope validation aligned with the existing Local privacy boundary;
- correction of one stale PCS-09 preparation sentence without rewriting historical evidence.

This is maintenance, not PE-09, PCS-11, Batch 13, or a production-promotion scope. The repository changes also do **not** by themselves prove a newer SumoPod runtime revision. The previously proven staging application revision remains `0f332c73dc7b363bffecdeecae921d805d5ae131` / image `staging-0f332c73dc7b` unless later deployment evidence proves otherwise.

Evidence: [verification/post-closure-maintenance-checkpoint-2026-09-21.md](verification/post-closure-maintenance-checkpoint-2026-09-21.md).

## Follow-up post-closure maintenance checkpoint — 2026-09-21

A second bounded maintenance slice continued from the earlier PR #232 checkpoint and is now closed through PR #237 at the repository boundary. The implementation checkpoint immediately before this documentation convergence is `443ed254f7b4c5c3880387872e882e954602452b`.

Closed follow-up maintenance includes:

- PR #234: Sync public MCP bridge failures are timeout-bounded, redirect-fail-closed, malformed upstream JSON maps to explicit `502`, and internal network diagnostics are not leaked;
- PR #235: Connect credential-vault mutations are serialized with an exclusive filesystem lock and contention is exposed as retryable `503 CREDENTIAL_VAULT_BUSY`;
- PR #236: Sandbox execution with the same idempotency key is serialized before authority/effect execution, with active contention exposed as `409 SANDBOX_EXECUTION_BUSY`;
- PR #237: default MCP JWKS retrieval is timeout-bounded while preserving redirect fail-closed behavior and `502` dependency-failure semantics.

This remains maintenance only. It does **not** open PE-09, PCS-11, Batch 13, a new F6 item, paid W18 evidence, production promotion, or Cloudflare/public-edge activation.

Repository source state and remote runtime state remain separate evidence boundaries. The repository `main` may advance without proving that SumoPod staging was redeployed. The previously proven staging application revision therefore remains `0f332c73dc7b363bffecdeecae921d805d5ae131` / image `staging-0f332c73dc7b` unless later deployment evidence proves a newer runtime.

Evidence: [verification/post-closure-maintenance-checkpoint-2-2026-09-21.md](verification/post-closure-maintenance-checkpoint-2-2026-09-21.md).

## Post-closure maintenance checkpoint 3 — 2026-09-21

A third bounded maintenance slice is now closed through PR #240 at the repository boundary. The implementation checkpoint immediately before this documentation convergence is `eb4ac86da19bc006009e1a2260f14c119e7997e5`.

Closed maintenance in this slice includes:

- PR #239: Sandbox Hub/RnD control-plane calls are timeout-bounded, preventing a stalled owner service from holding an idempotency lease indefinitely;
- PR #240: verified Connect webhook forwarding to Flow is timeout-bounded; transport/timeout failures map to sanitized `502 UPSTREAM_UNAVAILABLE`, and retry with the same provider-stable `deliveryId` remains compatible with Flow dedupe.

This remains maintenance only. It does **not** open PE-09, PCS-11, Batch 13, a new F6 item, paid W18 evidence, production promotion, or Cloudflare/public-edge activation.

At this historical maintenance checkpoint, repository source state and remote runtime state remained separate evidence boundaries and the then-latest proven SumoPod staging runtime was `0f332c73dc7b363bffecdeecae921d805d5ae131` / `staging-0f332c73dc7b`. Later governed staging convergence and DR activation superseded that runtime identity.

Evidence: [verification/post-closure-maintenance-checkpoint-3-2026-09-21.md](verification/post-closure-maintenance-checkpoint-3-2026-09-21.md).

## Post-closure maintenance checkpoint 4 — 2026-09-21

A fourth bounded maintenance slice is now closed through PR #242 at the repository boundary. The implementation checkpoint immediately before this documentation convergence is `47cbeaa8760debbfde87cff7cb7a828037a2829b`.

PR #242 bounds the Ai server-side Flow owner proxy to 10 seconds by default. A stalled Flow response now resolves through the existing sanitized `502 UPSTREAM_UNAVAILABLE` transport boundary instead of keeping the Ai route pending indefinitely. Redirect fail-closed behavior, Flow response semantics, owner authority, and Temporal execution ownership are unchanged.

The authoritative implementation head `db8a8f6068a40e47187a2142e6801e975e749276` passed CI #1743, Product Eval #982, and PCS-06 Integrated Browser Acceptance #18. The earlier candidate `7b21c96e6a18b46e333e145b8820381234b8c0bf` failed only the Prettier check in CI #1742 and was not merged.

This remains maintenance only. It does **not** open PE-09, PCS-11, Batch 13, a new F6 item, paid W18 evidence, production promotion, or Cloudflare/public-edge activation.

At this historical maintenance checkpoint, repository source state and remote runtime state remained separate evidence boundaries and the then-latest proven SumoPod staging runtime was `0f332c73dc7b363bffecdeecae921d805d5ae131` / `staging-0f332c73dc7b`. Later governed staging convergence and DR activation superseded that runtime identity.

Evidence: [verification/post-closure-maintenance-checkpoint-4-2026-09-21.md](verification/post-closure-maintenance-checkpoint-4-2026-09-21.md).

## Post-closure maintenance checkpoint 5 — 2026-09-21

A fifth bounded maintenance slice is now closed through PR #244 at the repository boundary. The implementation checkpoint immediately before this documentation convergence is `3114354ab44894ef80e75b9983fceac64babc2e0`.

PR #244 repairs Sandbox receipt-lock acquisition failure cleanup. When exclusive lock creation succeeds but metadata initialization fails before a lease is returned, the just-created descriptor and lock file are cleaned before the original error is rethrown. This prevents a pre-effect infrastructure failure from turning the same idempotency key into a persistent false-busy state.

The authoritative implementation head `462c9418078baefc7cd00eed79dd85dac4ee1bf9` passed CI #1747 and Product Eval #986. Successful lease semantics, receipt format, authority/effect ordering, and idempotency behavior are otherwise unchanged.

This remains maintenance only. It does **not** open PE-09, PCS-11, Batch 13, a new F6 item, paid W18 evidence, production promotion, or Cloudflare/public-edge activation.

At this historical maintenance checkpoint, repository source state and remote runtime state remained separate evidence boundaries and the then-latest proven SumoPod staging runtime was `0f332c73dc7b363bffecdeecae921d805d5ae131` / `staging-0f332c73dc7b`. Later governed staging convergence and DR activation superseded that runtime identity.

Evidence: [verification/post-closure-maintenance-checkpoint-5-2026-09-21.md](verification/post-closure-maintenance-checkpoint-5-2026-09-21.md).

## Current work state and deferred boundaries

- Active implementation/operational scope — **DR-2 physical independence, checkpoint 2 external target selection**. The original Off-host DR runtime drill, latest-main staging convergence, PE-00..PE-08, and PCS-00..PCS-10 remain closed at their documented boundaries.
- Post-closure product/UX + SumoPod remote staging — **CLOSED / PASS**; see `post-closure-product-staging-roadmap.md`.
- Public production cutover — **DEFERRED / SEPARATE EXPLICIT GATE**. Staging, remote persistence, security, same-host backup verification, observability, and operator acceptance are already proven at the documented staging boundary; they do not automatically authorize production.
- Cloudflare named Tunnel/public-edge choice — optional/pending operator hostname/edge decision.
- AutoClick — deferred by design.
- paid W18 rerun — closed/not authorized.
