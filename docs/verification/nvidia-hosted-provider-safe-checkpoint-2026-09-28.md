# NVIDIA Hosted Provider Trial — Safe Checkpoint — 2026-09-28

Status: **FINAL / CLOSED / PASS**

## Purpose

Record the first-class NVIDIA API Catalog / NIM hosted-provider integration, the bounded staging hosted-trial activation, the Docker native-build defect discovered during rollout, the rollback that preserved staging availability, the permanent Docker fix, and the final exact-main staging convergence.

This checkpoint is the resume pointer for the NVIDIA hosted-provider trial work. Do not restart the implementation from scratch unless a new explicit scope changes the provider/model/runtime boundary.

## Final audited runtime identity

```text
repository              = ceritaantarkita-req/ecorione
runtime-changing merge  = 0f86a34cde66dd541dae9a830ae8cc155e1efe6b
staging image           = staging-0f86a34cde66
open PRs at audit       = 0
retained branch baseline= 9
runtime status          = healthy
configured              = 15 services
running                 = 15 services
non-running             = 0
final free disk         = 29.89 GiB
```

The temporary checkpoint branch itself makes the live remote count one higher until this documentation is merged and that branch is exact-SHA deleted. Docs-only closure commits may also advance live Git/staging SHA without changing the runtime compatibility baseline above.

SumoPod remains **staging, not production**.

## Accepted NVIDIA boundary

ECORIONE now supports NVIDIA as a first-class hosted provider under the existing Connect authority boundary.

```text
provider id      = nvidia
display name     = NVIDIA / NIM
credential scope = nvidia/messages
dev env fallback = NVIDIA_API_KEY
base endpoint    = https://integrate.api.nvidia.com/v1
chat endpoint    = /chat/completions
pinned model     = z-ai/glm-5.3
Ai label         = NVIDIA / GLM-5.3
```

The integration reuses the existing OpenAI-compatible hosted adapter rather than creating a second provider stack.

Credential onboarding follows the normal Connect Vault flow:

```text
Settings
 -> NVIDIA / NIM
 -> Connect
 -> paste secret locally
 -> Test API key
 -> encrypt/save in Connect Vault
 -> activate provider/model
 -> Ai uses Hosted · NVIDIA · GLM-5.3
```

No NVIDIA API secret was committed to Git, written into docs, or supplied to this implementation session.

## Free prototype accounting boundary

The supported NVIDIA route is the hosted API Catalog **free prototype endpoint** for `z-ai/glm-5.3`.

For that specific route:

- provider-token accounting snapshot is USD 0;
- Connect still creates a minimum USD `0.000001` pre-dispatch reservation so durable spend admission, concurrency protection, and ambiguous-failure semantics are not bypassed;
- the global hosted cost kill switch still has authority;
- cumulative spend controls still apply;
- no silent provider fallback is introduced.

This does **not** claim that NVIDIA partner endpoints, self-hosted NIM, NVIDIA AI Enterprise production, or arbitrary NVIDIA models are free or supported.

## Provider implementation — PR #381

Canonical implementation PR:

```text
PR            = #381 feat: add NVIDIA NIM hosted provider
reviewed head = 26d3370c6198d5ab7b20ab1a38cc946ebbf0e39c
merge SHA     = 41fdedf9b13d6d16c645169a6fc9021361a4ddd2
```

Final exact-head gates:

- CI **#2365** — PASS;
- Product Eval **#1604** — PASS;
- PCS-06 Integrated Browser Acceptance **#202** — PASS.

Merged-main gates:

- CI **#2366** — PASS;
- Product Eval **#1605** — PASS.

Staging rollout:

- Staging Deploy **#1500** — gate-only PASS;
- Staging Deploy **#1501** — actual deploy PASS;
- exact staging SHA: `41fdedf9b13d6d16c645169a6fc9021361a4ddd2`;
- image: `staging-41fdedf9b13d`;
- Operations healthy;
- 15/15 configured services running.

## Bounded staging hosted-trial activation — PR #382

The prior staging host had hosted calls disabled by the operator-level cost kill switch. A one-time staging-only migration was used because the governed deployment SSH key intentionally permits only `deploy <exact SHA>` and cannot mutate host configuration arbitrarily.

Canonical activation PR:

```text
PR            = #382 ops: enable bounded hosted trials on staging once
reviewed head = 4809860aab81abc260b4d01cb99504393c4fbd18
merge SHA     = a62c66ed73f45294e52f1202dccc4155696f5618
```

Exact-head gates:

- CI **#2367** — PASS;
- Product Eval **#1606** — PASS.

Merged-main gates:

- CI **#2368** — PASS;
- Product Eval **#1607** — PASS.

The one-time migration was bounded to `ECORIONE_COMPOSE_PROJECT=ecorione-staging` and:

- required the host-only deployment env to remain a regular mode-0600 file;
- set `ECORIONE_COST_KILL_SWITCH=0`;
- refused unlimited spend;
- preserved existing positive daily/monthly limits;
- defaulted only when absent/blank to USD 1/day and USD 10/month;
- preserved unrelated host secrets/config;
- wrote a one-time marker so later operator kill-switch changes would not be overwritten.

Exact private spend-limit values are not copied into repository evidence. The important proven boundary is: hosted calls were opened under a finite spend policy and `SPEND_UNLIMITED` was not enabled.

## Failed deploy evidence that must be preserved

Staging Deploy **#1505** failed after the one-time host migration had already succeeded.

The log proves:

```text
PASS staging hosted trial bootstrap: hosted enabled with bounded spend policy.
```

The application image build then failed because `better-sqlite3` fell back to `node-gyp` native compilation and the slim Docker build image did not contain Python.

Observed failure:

```text
gyp ERR! stack Error: Could not find any Python installation to use
better-sqlite3 install: Failed
Deployment failed: compose upgrade/build failed
```

The governed release path correctly rolled runtime back to:

```text
41fdedf9b13d6d16c645169a6fc9021361a4ddd2
staging-41fdedf9b13d
```

Rollback revalidation passed public auth, MCP metadata/challenge, Operations health, exact-host evidence, and capacity checks.

The host-only migration had already completed before the image build failure, so the operator cost kill switch was open under a finite spend policy while runtime stayed on the previously healthy NVIDIA-capable image. This does **not** prove the persisted runtime `hostedCallsEnabled` toggle was already true; that activation remains part of the normal Settings/provider activation flow.

Do not erase or reinterpret this failed run; it is valid rollout evidence.

## Permanent Docker fix — PR #383

The Docker build was changed to a pinned two-stage build:

- build stage: same exact pinned Node base plus `python3 make g++`;
- `pnpm install --frozen-lockfile && pnpm run build` runs in the builder;
- runtime stage: same pinned slim Node base;
- the built tree is copied into runtime;
- compiler/native build toolchain is absent from the final runtime stage;
- Node toolchain governance now validates every Node `FROM ... AS ...` stage against `.node-version`.

The temporary hosted-trial bootstrap script/hook/tests were removed after the host migration completed, restoring future kill-switch ownership fully to the operator.

Canonical fix PR:

```text
PR            = #383 fix: harden Docker native builds after hosted trial bootstrap
reviewed head = f62f4d388f41279721ce335e2ca16e845592e047
merge SHA     = 0f86a34cde66dd541dae9a830ae8cc155e1efe6b
```

Final exact-head gates:

- CI **#2379** — PASS;
- Product Eval **#1618** — PASS.

Merged-main gates:

- CI **#2380** — PASS;
- Product Eval **#1619** — PASS.

Staging:

- Staging Deploy **#1524** — gate-only PASS;
- Staging Deploy **#1525** — actual deploy PASS.

Real SumoPod Docker evidence from #1525:

```text
apt-get install ... python3 make g++
better-sqlite3 install: Done
image = staging-0f86a34cde66
```

Final runtime proof:

- exact requested/deployed SHA matched `0f86a34cde66dd541dae9a830ae8cc155e1efe6b`;
- public auth bootstrap PASS;
- MCP protected-resource metadata PASS;
- MCP unauthenticated challenge PASS;
- Operations `healthy: true`;
- `unhealthyServices: []`;
- exact host SHA matched expected SHA;
- configured services = 15;
- running services = the same 15;
- `nonRunningServices: []`;
- final stabilized capacity = **29.89 GiB free**.

## Repository hygiene after NVIDIA work

One-time exact-SHA cleanup run:

```text
Actions run = 36368987090
result      = PASS
```

Deleted exact merged work branches:

1. `feat/nvidia-nim-provider-20260928` at `26d3370c6198d5ab7b20ab1a38cc946ebbf0e39c`;
2. `ops/staging-hosted-trial-bootstrap-20260928` at `4809860aab81abc260b4d01cb99504393c4fbd18`;
3. `fix/docker-native-build-and-hosted-trial-cleanup-20260928` at `f62f4d388f41279721ce335e2ca16e845592e047`.

The helper self-deleted and proved:

```text
NVIDIA_WORK_BRANCHES_DELETED=3
FINAL_REMOTE_BRANCH_COUNT=9
NVIDIA_TRIAL_BRANCH_CLEANUP=PASS
```

## Current user-visible state

What is now expected in Settings:

- NVIDIA / NIM appears as an available AI provider;
- its verified hosted model is GLM-5.3;
- Connect opens the normal credential form;
- `Test API key` must pass before `Save & activate` becomes available.

What remains intentionally user/operator action:

1. paste the user's NVIDIA secret into the NVIDIA / NIM card;
2. click `Test API key`;
3. require a real PASS from NVIDIA;
4. click `Save & activate`;
5. select NVIDIA / GLM-5.3 as the hosted provider/model if not auto-selected;
6. send a real message from Ai and confirm the UI shows `Hosted · NVIDIA · GLM-5.3`.

Until those steps happen, do **not** claim that the user's actual NVIDIA credential has been validated or that a real GLM-5.3 completion has been observed from their key.

## Current state

```text
NVIDIA provider implementation = CLOSED / PASS
NVIDIA UI onboarding          = IMPLEMENTED / LIVE
NVIDIA Vault path             = IMPLEMENTED / LIVE
NVIDIA pinned model           = z-ai/glm-5.3
staging operator gate         = OPEN UNDER BOUNDED SPEND
runtime hosted toggle         = NOT CLAIMED ENABLED UNTIL SETTINGS ACTIVATION
actual user NVIDIA key        = NOT STORED / NOT TESTED BY THIS CHECKPOINT
real user-key completion      = NOT YET PROVEN
Docker native build defect    = CLOSED / PASS
main vs staging               = CONVERGED
repository branch hygiene     = 9 retained branches
production promotion          = NOT CLAIMED
```

No new roadmap, ECX Batch 8, PE-09, PCS-11, Batch 13, DR-2 runtime scope, or production cutover is opened by this checkpoint.
