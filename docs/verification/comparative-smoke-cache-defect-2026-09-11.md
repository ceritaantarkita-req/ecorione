# Comparative ECX first real Gemma smoke — cache-isolation finding — 2026-09-11

Status: **FAIL / VALID RUNTIME FINDING — CACHE-ISOLATION FIX MERGED/VERIFIED; UNCACHED SMOKE RERUN PENDING**

This note records the first real local comparative smoke after the comparative harness implementation was merged and the operator laptop was synchronized.

It is a failure record, not a savings result. The failure is useful because the predeclared cache-contamination gate rejected an invalid comparison instead of allowing cached latency/token values to be presented as model-compute evidence.

## Revision and runtime

Synchronized repository revision used by the failed smoke:

`5437c1ea5d8ee168dbbe09de688a23c39089c7aa`

Runtime boundary:

- WSL2 Ubuntu 24.04 laptop;
- Phase 4 local services;
- Temporal worker RUNNING;
- Connect local OpenAI-compatible route;
- Ollama local runtime;
- model reported by the benchmark: `gemma4:latest`;
- hosted calls remain outside this local evidence scope.

## Command

```bash
cd ~/projects/ecorione
set -a
source .env
set +a
pnpm evidence:comparative:smoke
```

The smoke runs one fixture (`incident-triage`), one paired repeat, and three measured lanes:

- `full-inline`;
- `ecx-all`;
- `ecx-selective-oracle`.

## Wiring that succeeded

The real runtime reached the intended owner boundaries:

- Artifact fixture uploads succeeded;
- Hub `POST /v1/exchange/plan` succeeded;
- Hub all-ref hydration succeeded;
- Hub oracle-selective hydration succeeded;
- Connect returned responses for all three measured lanes;
- ECX selected `agent:comparative-evidence-reviewer`.

Observed ECX/transport values:

- packet bytes: `1011`;
- all-ref hydrated bytes: `8241`;
- oracle-selective hydrated bytes: `1123`;
- selective transport bytes (`packet + selective hydration`): `2134`;
- full-inline context bytes: `8269`;
- byte-only selective transport reduction calculation: `74.19276817027452%`.

The byte calculation is a property of this fixture/packet and is not by itself an optimizer savings claim.

## Measured-lane contamination

All three measured lanes reported:

- `cacheHit: true`;
- `inputTokens: 0`;
- `outputTokens: 0`.

Returned deterministic quality was `1.0` in all three lanes, but those replies were exact-cache responses rather than new measured model calls.

Observed harness latencies were approximately:

- `full-inline`: `10.88 ms`;
- `ecx-all`: `9.00 ms`;
- `ecx-selective-oracle`: `7.18 ms`.

These are cache-response latencies and **must not** be interpreted as Gemma inference latencies.

## Gate result

The task correctly failed with:

```text
measured run hit exact cache
selective median input tokens did not beat full-inline
```

The second failure follows from the cache behavior: every measured lane returned zero input tokens, so selective input-token reduction cannot be established from this run.

No threshold was relaxed.

## Root cause

The PR #38 implementation appended a cache marker based on:

- task id;
- paired-run index;
- mode.

That marker was unique within one benchmark invocation but deterministic across separate invocations. Connect exact-cache identity includes model identity, stable prefix digest, dynamic text, and user message. Therefore a later smoke/full run against the same still-running Connect process could reuse a prior benchmark entry while that entry remained inside the exact-cache TTL.

This is a measurement-harness defect, not evidence of an ECX transport failure.

## Fix implementation and verification

Fix branch:

`fix/comparative-cache-namespace-20260911`

The correction:

1. generates a fresh random 32-hex namespace once per benchmark invocation;
2. uses fixed-shape numeric task/pair/mode coordinates in every measured cache marker;
3. keeps measured `cacheHit=true` as a hard failure;
4. adds deterministic regression coverage for cross-invocation separation and paired marker-shape stability;
5. does not change the predeclared quality/bytes/token/latency thresholds.

Repository evidence:

- PR #40: `fix: isolate comparative benchmark cache per run`;
- final exact PR head: `689adf108252dd8eb899ea04cc96986da45bc38f`;
- exact-head CI `34561732640`: **PASS** Naming, Format, Lint, Typecheck, Test, Phase 4 real-process acceptance, Production Operations acceptance, Secret Scan and Production Build;
- squash merge on `main`: `197627dc04689dea94bf7957e18b2699f8fb9213`;
- post-merge CI `34561893817`: **PASS** all repository gates.

No MCP-specific workflow was required by this change set; the fix only changes the local comparative harness/test/docs and does not change the MCP/network boundary.

The fix implementation is therefore **MERGED / REPOSITORY-VERIFIED**. The comparative efficiency result itself is still open because the corrected harness has not yet been rerun on the synchronized laptop.

## Claim boundary

This failed smoke supports only these findings:

- real Artifact + Hub ECX plan/hydration wiring was exercised;
- selective hydration transferred fewer bytes for the fixture;
- the original benchmark cache-isolation design was insufficient across separate invocations;
- the cache-contamination gate worked and rejected the run;
- the repository fix for cross-invocation cache isolation is merged and verified.

This smoke does **not** establish:

- real uncached input-token reduction;
- real Gemma latency reduction;
- automatic reference selection;
- universal optimizer effectiveness;
- hosted-provider cost savings;
- production/VPS behavior.

Next checkpoint: synchronize the laptop to the latest `main` containing PR #40, rerun `pnpm evidence:comparative:smoke`, and require all measured lanes to be uncached with non-zero model token telemetry before any closure-grade benchmark.
