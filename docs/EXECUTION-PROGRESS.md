# ECORIONE — Execution Progress

Last updated: **2026-09-20**

Status: **CURRENT SUMMARY**

## Closed baseline

| Scope | State |
|---|---:|
| Fase 0–4 / Batch 1–12 | **CLOSED** |
| W-series through W20 | **CLOSED at documented boundaries** |
| F6-E01 through F6-E08 | **CLOSED / REPO-SIDE PASS** |
| Production/self-host repository baseline | **READY** |
| Windows runtime + installer | **VERIFIED** |
| Native Windows portability / EOL policy | **CLOSED / PASS (PR #182 + PR #185)** |

## Product Evolution

| Batch | State |
|---|---:|
| PE architecture/roadmap docs | **DOCUMENTED** |
| PE-00 Architecture lock + migration contract | **CLOSED / PASS** |
| PE-01 Project foundation | **CLOSED / PASS** |
| PE-02 Project Sources | **CLOSED / PASS** |
| PE-03 Trigger control plane | **CLOSED / PASS** |
| PE-04 Work + Schedule + Runs | **CLOSED / PASS** |
| PE-05 Event/Webhook automation | **CLOSED / PASS** |
| PE-06 Brain V1 | **CLOSED / PASS** |
| PE-07 Brain + Context + ECX | **CLOSED / PASS** |
| PE-08 Product closure | **CLOSED / PASS** |

## Next post-closure scope

The operator approved a separate **PCS-00..PCS-10** roadmap after real-browser validation. It is not PE-09 and not Batch 13.

| Scope | State |
|---|---:|
| PCS-00 Baseline lock | **CLOSED / PASS** |
| PCS-01 Chat continuity/history | **CLOSED / PASS** |
| PCS-02 Provider onboarding + hosted model choice | **CLOSED / PASS** |
| PCS-03 Local AI resilience/runtime discovery | **CLOSED / PASS** |
| PCS-04 Visual + information-architecture cleanup | **CLOSED / PASS** |
| PCS-05 Flow runtime defect closure | **CLOSED / PASS** |
| PCS-06 Integrated browser/regression acceptance | **CLOSED / PASS** |
| PCS-07 SumoPod remote staging | **CLOSED / PASS** |
| PCS-08 GitHub -> staging continuous deployment | **ACTIVE** |
| PCS-09 Staging persistence/security/backup/observability | **PLANNED** |
| PCS-10 Closure/docs | **PLANNED** |

PCS-00 locked `main` commit `93c5312d73289305d3e16ff79c5457a5010d0b19` as the post-closure starting point. PR #189 exact head `f58311ae30beef877f0c38962bcf4b1aefe91917` passed CI #1492 + Product Eval #731 and merged as `12fae37e901e4cbfbb7e4cb6cf9b8e9a2ec4e764`. Evidence: [verification/pcs-00-baseline-lock-2026-09-20.md](verification/pcs-00-baseline-lock-2026-09-20.md).

PCS-01 closed on PR #191 exact head `9445b30c659628e1d551191219d0b7cd5ccf2f7c`, which passed CI #1505 + Product Eval #744 and merged as `ee363c055944b27b549a2f061105eea35fa25f9e`. Chat continuity now reuses Historical Ledger canonical replay, preserves active session per Project, exposes explicit New chat/history navigation, and enforces Project-bound History reads. Evidence: [verification/pcs-01-chat-continuity-2026-09-20.md](verification/pcs-01-chat-continuity-2026-09-20.md).

PCS-02 closed on PR #193 exact head `45dbe9365b23dfa3398a4726a26f9a245bd09e9d`, which passed CI #1516 + Product Eval #755 and merged as `0fba6842f4c39f2742eb6d518e63c90d1a4883db`. Settings now exposes a simple provider connect flow and verified hosted model choice while keeping Connect Vault/runtime governance authoritative. Evidence: [verification/pcs-02-provider-onboarding-2026-09-20.md](verification/pcs-02-provider-onboarding-2026-09-20.md).

PCS-03 closed on PR #195 exact head `5be1c68f7b345d5e7d433a9eed302000ffe552a1`, which passed CI #1525 + Product Eval #764 and merged as `4e2407af7240c9ca3b94ffbfb0a1c239c6a4ddae`. Local AI now exposes explicit runtime/model readiness, probes candidate settings before persistence, preserves OpenAI-compatible as the abstraction, keeps Ollama optional, and blocks known-unavailable Local chat without silent Hosted fallback. Evidence: [verification/pcs-03-local-ai-resilience-2026-09-20.md](verification/pcs-03-local-ai-resilience-2026-09-20.md).

PCS-04 closed on PR #197 exact head `ec4ed1508cb7ab72fb9d86f15ec3541c2caf80f5`, which passed CI #1529 + Product Eval #768 and merged as `8a328ae0c0abeb039866ac40068a9053c4796659`. Navigation now separates Core/Workspace/Advanced surfaces, common controls/readability are more consistent, primary page hierarchy is simplified, and Ai exposes explicit provider/model route state. Evidence: [verification/pcs-04-visual-ia-closure-2026-09-20.md](verification/pcs-04-visual-ia-closure-2026-09-20.md).

PCS-05 closed on PR #199 exact head `d7eb37e8b5e97da07895fcd050621e563a47359b`, which passed CI #1537 + Product Eval #776 and merged as `f58923b8261104c8aec331f506a68f8cf5fe5e7e`. Flow now registers graph-state handlers before its first awaited activity, preflights exact node authority before Temporal start, exposes governed authority preparation through Hub approval, and keeps runtime node re-authorization fail-closed. Evidence: [verification/pcs-05-flow-runtime-closure-2026-09-20.md](verification/pcs-05-flow-runtime-closure-2026-09-20.md).

PCS-06 closed on PR #201 exact head `0dfdda92e0bef800ca9a7563223b7423aa9b1299`, which passed CI #1553 + Product Eval #792 + PCS-06 Integrated Browser Acceptance #13 and merged as `0a8f7619567500acaec0758c400d529367baf0e5`. Production Next.js UI was exercised in Chromium across the approved desktop and narrow product surfaces with deterministic same-origin API fixtures, no external provider requests, console/page-error checks, overflow checks, and Flow authority-to-run acceptance. Evidence: [verification/pcs-06-integrated-browser-closure-2026-09-20.md](verification/pcs-06-integrated-browser-closure-2026-09-20.md).

PCS-07 actual-host deployment now passes on the reviewed SumoPod staging boundary. The live runtime was deployed from exact reviewed main `99523b0bb29ce11a74ec61c0e364ef5b6dd543ae`; all configured services are running under the isolated `ecorione-staging` Compose project; sanitized host evidence matched the expected SHA with a clean worktree and mode-0600 env. Public HTTPS home returned 200; `/ops` and `/settings` remain protected; authenticated `/api/ops` reported a healthy required fleet; MCP metadata returned 200 and a valid unauthenticated MCP request returned the expected 401 Bearer challenge. PR #208 fixed only the malformed public-smoke verifier and merged as `59430c4b72a704d1fd6c6176d12b13fa27ddf674` after CI #1581 + Product Eval #820. The final real rendered-browser governed Flow journey also passed: after explicit authority preparation/approval, the final Trigger-only v2 graph showed `core/trigger/v1` Granted, Trigger `SUCCEEDED`, and run `COMPLETED` without a paid provider call. PCS-07 is CLOSED / PASS. Evidence: [verification/pcs-07-sumopod-host-closure-2026-09-20.md](verification/pcs-07-sumopod-host-closure-2026-09-20.md). PCS-08 GitHub -> staging continuous deployment is now ACTIVE.

PCS-08 repository implementation merged through PR #210. Exact head `4a5fa9d9d776eae3895a8e0b8e6b73013e3f476f` passed CI #1613 + Product Eval #852 and merged as `652588e00dca5a04c8b39081fb6574a3db508ba1`. It adds `staging-deploy.yml`, a dedicated forced-command SSH boundary, exact-current-main verification, serialized host deployment, public/ops/exact-host post-deploy checks, release identity receipts, and prior-image/source runtime rollback. Deterministic source-contract coverage plus normal shell/release-security coverage are included. Host bootstrap, GitHub `staging` Environment secrets, fail-closed deploy-key tests, and one real governed mutation/rollback exercise are now complete as evidence. The first governed deploy (run #35529468459) built and applied the exact target image but failed public smoke on a transient 502 before the edge was ready; rollback recreated the prior runtime and independent host verification proved the known-good `99523b0...` state was restored with all 15 services running, home 200/TLS 0, and `/ops` 401. PR #214 added bounded public-edge readiness waiting, passed CI #1628 + Product Eval #867, merged as `0b50a426ca2b14202eba769297af6c15a579b09f`, and main then passed CI #1629 + Product Eval #868. The host-installed deploy control must be refreshed from that reviewed merge before the next controlled deploy. Runbook: [staging-continuous-deployment.md](staging-continuous-deployment.md). Evidence candidate: [verification/pcs-08-repository-preparation-2026-09-20.md](verification/pcs-08-repository-preparation-2026-09-20.md).

Public production cutover remains deferred. Cloudflare Tunnel remains optional/not yet selected for staging. See [post-closure-product-staging-roadmap.md](post-closure-product-staging-roadmap.md).

## Latest maintenance closure

PR #182 (`108781b5d53034462393f06d5e9cb36e9c5d5cf5`) hardened native Windows execution and merged as `3461951414f72c8f183527e3d28eec20dd383d45` after CI #1477 and Product Eval #716 passed. Local Windows validation passed Prettier, lint, typecheck, secret scan, production build, the production Bash syntax gate through explicit MSYS Bash, and the full 191-file / 990-test normal suite with zero failures.

This maintenance closure does not open PE-09 or Batch 13.

Clean-checkout reproducibility then closed on PR #183. Final closure head `451c3b45366ca42004d6c5af53f59c475e911e6f` passed CI #1482 and Product Eval #721 and merged as `4980b3ceb149be58788467d2e11769de12977d5a`. The normal CI path now performs read-only `format:check` against committed canonical formatting; it no longer rewrites source first.

A clean Windows re-clone then proved the runtime/test/build path but surfaced false dirty status on the three `.cmd` files because their Git blobs were still CRLF. PR #185 closed that last EOL reproducibility gap with semantic diff zero: canonical index is LF, Windows working tree remains CRLF via `.gitattributes`. Head `600f459fbe2671e7e4297e60da725b005b6f9533` passed CI #1486, Product Eval #725, and Desktop Installer #76; merge `4194e89a2b0611897969eaca2cb9c2b4b360c774` then passed main CI #1487 and Product Eval #726.

## Latest Product Evolution closure

PE-07 closed on PR #178 implementation head `892726c20ac95dded26fdc3fd2000ad4bb56363d`, closure head `e443a6e9d10b24b7c1de7bcb315b038cf6425a45`, and merged as `15e31ed4b03f5be5bc6a7104fc14bb1dd0917743`. Implementation and closure heads passed CI, Product Eval, and MCP acceptance. Bounded deterministic evidence reported 66.67% median candidate reduction, 100% required-reference/provenance retention, and zero unauthorized refs.

PE-08 closed on PR #180 after reviewed implementation head `33f9e891c3152a82304d5f1e31693604c855d94c` passed CI #1469 and Product Eval #708, closure head `5d1b1c80168a26ae38af33d862a6fa26b019802c` passed CI #1473 and Product Eval #712, and merged as `b32d57022344ad08a59b6b7d163507c5530a7ca6`. Product Evolution PE-00..PE-08 is CLOSED / PASS at documented boundaries. No Product Evolution batch is active.

```text
PE-00  CLOSED / PASS
PE-01  CLOSED / PASS
PE-02  CLOSED / PASS
PE-03  CLOSED / PASS
PE-04  CLOSED / PASS
PE-05  CLOSED / PASS
PE-06  CLOSED / PASS
PE-07  CLOSED / PASS
PE-08  CLOSED / PASS
```

## Previous closures

PE-05: PR #174 / implementation `b3fa55e689548b5a72c47b331682285eb8fb6eb2` / closure `3d082f555a0c701eb9911d5caa71f7cf250f5710` / main `84defe934bf6b7d0b8868bd04c8c113e70193fc6`.

PE-04: PR #173 / implementation `c2cacbbcbee15f46ac4c5e9e43c955f5c952af43` / closure `94936fa0704991d3536667bb8c947e9d751c813e` / main `c08581a00a20dc6016c570a1fbb777d81e391699`.

PE-03: PR #172 / exact head `74730e26321cac06c31243baeeafe29d5f4d75f0` / main `c739c09014d8aa20ca8e1b83c5b6be39b4ee649c`.

PE-02: PR #171 / implementation `a6167df469cf491015b232aff8a192b32a25c569` / main `c734f00eaa791077c99557e6e89579534c43d651`.

PE-01: PR #169 / main `1d2b537de3ad07336adb9a97121309f04d61cc21`.

PE-00: PR #167 / main `b7ebf5492aca463e55f9f30bc259b9a6028c62d7`.
