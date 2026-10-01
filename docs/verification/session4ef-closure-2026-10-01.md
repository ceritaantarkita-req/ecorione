# Session 4E + 4F Closure — 2026-10-01

Status: **CLOSED / PASS / STAGING VERIFIED**

## Scope closed

PR #417 closes the remaining AI provider/model roadmap for Session 4E and the bounded Session 4F polish scope:

- bounded `+ Tambah AI -> Lainnya / Custom OpenAI-compatible` onboarding;
- Connect-owned credential validation and encrypted Vault persistence;
- public-HTTPS custom egress with SSRF/private-address/DNS-rebinding protections, bounded timeout and response size;
- exact custom model identity and operator pricing;
- existing multi-credential priority/failover beneath one logical provider;
- Local-to-Hosted continuity through Project-scoped hosted-eligible context without replaying local-only conversation history;
- adjacent Provider/Source + Model controls, connection/error/loading feedback and custom-provider presentation;
- certified dynamic OpenRouter pricing carried into reservation and normal completion.

## Local acceptance

The operator tested the integration branch locally before merge.

Observed real behavior included:

- OpenRouter dynamic selection from the normal Ai composer;
- `google/gemini-3.8-flash` successfully validated and executed;
- a second dynamic OpenRouter model was selected and executed in the same product surface;
- Settings showed the active OpenRouter connection and selected model;
- response metadata exposed model/cost evidence without exposing credential material.

During acceptance, normal Gemini completion initially failed because the reservation path dropped the certified dynamic pricing override. Commit `507186b9e845bdb9cf8b4f206a6a9ba2887a7ea7` fixed the OpenRouter estimator mapping. The post-fix live Gemini completion settled successfully with provider-reported billed cost.

Focused acceptance after the fix:

```text
credential/failover + handoff + custom security + 4E/4F UX = 57/57 PASS
OpenRouter pricing/routing targeted regression             = 43/43 PASS
lint                                                       = PASS
typecheck                                                  = PASS
secret-scan                                                = PASS
production build                                           = PASS
```

The prior Windows full-suite run reported 1487 PASS / 4 FAIL; all four failures were the existing Unix `0600` Off-host DR permission assertions observed as `0666` on Windows/NTFS. Linux CI remains authoritative for that Unix-mode requirement.

## Reviewed PR evidence

```text
PR                         = #417
reviewed head              = 93c3230b552e479194b756135a5458d8a6fd001e
PR-head CI                 = #2600 PASS
PR-head Product Eval       = #1839 PASS
PR-head PCS-06 browser     = #371 PASS
merge main                 = 6170ee5d67ee4b105771d8ce2c348afba6cce896
merged-main CI             = #2601 PASS
merged-main Product Eval   = #1840 PASS
```

## Staging convergence

Staging Deploy #1949 was the expected gate-only run fired before both peer gates had converged; its deploy job was skipped.

Staging Deploy #1950 then deployed exact reviewed main:

```text
SHA                         = 6170ee5d67ee4b105771d8ce2c348afba6cce896
image                       = staging-6170ee5d67ee
previous SHA                = c3ef2f186f465c2942b552974e47333c797cb4a1
previous image              = staging-c3ef2f186f46
exact host SHA matched      = true
clean worktree              = true
configured/running services = 15 / 15
non-running services        = 0
Operations healthy          = true
unhealthy services          = []
stabilized free disk        = 29.95 GiB
```

Runtime acceptance also passed:

- auth bootstrap redirect;
- protected login/operator/API boundaries;
- protected Project/history/Brain/Space/chat/forget routes;
- MCP protected-resource metadata and unauthenticated challenge;
- authenticated Operations snapshot;
- exact-host evidence;
- bounded rollback-image retention and capacity stabilization.

The deploy helper emitted:

```text
PASS PCS-08 staging deploy sha=6170ee5d67ee4b105771d8ce2c348afba6cce896 tag=staging-6170ee5d67ee
```

## Boundary / non-claims

This closure does not claim:

- successful execution against an arbitrary user-controlled custom OpenAI-compatible endpoint without that endpoint and credential being supplied;
- native Google Drive integration;
- broader multi-user identity/final RBAC;
- DR-2 physical independence;
- production promotion/cutover;
- external A2A, recursive agent graphs, long-running ECX orchestration or AutoClick/L4 autonomy.

A real custom-provider credential test is now a normal validation action against implemented code, not unfinished Session 4E implementation.

## Final state

Session 4E and Session 4F are **CLOSED / PASS / STAGING VERIFIED**. No post-4F implementation session is opened implicitly. The next implementation scope must be selected explicitly from the remaining roadmap.
