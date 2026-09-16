# W17 — ECX No-Oracle Comparative Validation Harness

Date: 2026-09-16  
Status: **DONE — VERIFIED LOCAL MODEL PASS (100 measured calls)**

## Baseline

W17 is built on the W16 merge baseline:

```text
main merge commit: 504e6aef86092d6f398ff290a40f77593c8882ca
W16 PR: #112
post-merge CI: #906 / 35085550485 — SUCCESS
post-merge Product Eval: #145 / 35085550544 — SUCCESS
post-merge MCP External HTTPS Acceptance: #448 / 35085550463 — SUCCESS
```

W16 is therefore closed repo-side. W17 does not reopen the W16 API contract; it validates automatic selection on the same comparative task set without providing fixture relevance indexes to the automatic lane.

## What changed

The comparative harness now runs four paired lanes:

```text
full-inline
ecx-all
ecx-selective-auto
ecx-selective-oracle
```

`ecx-selective-auto` calls Hub hydration with:

```json
{
  "selection": {
    "mode": "semantic-v1",
    "maxRefs": 3
  }
}
```

It does **not** receive `relevantRefIndexes`. Fixture oracle indexes are retained only for evaluation and the oracle-control lane.

The harness records:

- automatic selected ref indexes;
- oracle recall and precision;
- hydrated bytes for all-ref, automatic, and oracle lanes;
- paired input-token, latency, quality, model identity, and cache-hit measurements;
- a conservative selector-scan accounting floor so selected hydration savings are not mislabeled as end-to-end transport savings.

## Predeclared task gates

Each task fails if any of these conditions occurs:

1. routed recipient differs from the expected reviewer;
2. any measured completion is an exact cache hit;
3. paired runs do not use one stable model identity;
4. median quality is below `1` in any lane;
5. `ecx-all` materially changes input-token count versus `full-inline` beyond the existing control tolerance;
6. automatic selection returns zero refs, duplicate refs, or more than `maxRefs=3`;
7. automatic selector oracle recall is below `1`;
8. automatic or oracle selected hydration fails to reduce hydrated bytes versus `ecx-all`;
9. selected-hydration transport (`packet + selected hydration`) does not beat full-inline context bytes;
10. automatic or oracle median model input tokens do not beat full-inline;
11. automatic or oracle median latency exceeds the configured paired-run tolerance.

The selector candidate-scan byte floor is reported but is deliberately **not** turned into a savings gate. W16 currently scans bounded authorized text candidates before choosing refs, so W17 must distinguish model-context/hydration savings from total network transport.

## Selector defect found during W17 preparation

The first fixture-level no-oracle contract exposed a real recall defect on `incident-triage`:

```text
fixture count: 5
pass: 4
fail: incident-triage
oracle recall: 0.5
required recall: 1.0
```

Root cause: W16 ranked descriptors correctly but then applied a relative `topScore * 0.28` cutoff. For multi-field tasks this could discard a lower-scoring but still positive secondary evidence document even when the caller's bounded `maxRefs` budget had room for it.

The selector was hardened to treat `maxRefs` as the hard top-K budget once positive semantic overlap exists. Authority penalties still rank legacy/noise evidence lower, while all positive-score candidates compete for the bounded top-K slots.

After the change, the focused validation passed:

```text
comparative helper tests: 9/9 PASS
no-oracle selector fixture tests: 5/5 PASS
total focused tests: 14/14 PASS
```

The five fixtures are:

```text
incident-triage
procurement-award
release-readiness
retention-policy
customer-escalation
```

This focused result verifies deterministic selector recall against the fixture set. It is not a substitute for the real local-model comparative run.

## Required real closure run

W17 required the real local runtime to execute the same five tasks with the four lanes and the configured repeat count. The completed formal closure profile was:

```text
5 tasks × 5 repeats × 4 lanes = 100 measured model calls
+ one excluded warm-up completion
```

The real run must retain:

- immutable local-model identity evidence;
- zero measured cache hits;
- 5/5 task quality gates;
- automatic oracle recall = 1 for every task;
- paired automatic/full and oracle/full input-token + latency measurements;
- selector-scan accounting and bounded claim language.

## Real local-model closure evidence

The operator executed the formal fail-closed closure runner on Windows against clean synchronized `main`:

```text
runtime baseline: 90bc800649b02be1de752d8c67c365c65a9d21a6
branch: main
HEAD == origin/main: yes
worktree clean: yes
local model: qwen3.5:9b
immutable identity verified: yes
run shape: 5 tasks × 5 repeats × 4 lanes
measured model calls: 100
passed tasks: 5/5
failed tasks: 0
automatic lane oracle indexes supplied: false
median automatic selector recall: 1.0
median automatic selector precision: 0.6666666666666666
cache hits: 0
closureEligible: true
```

The raw local evidence was written to the gitignored evidence directory and sealed by the closure runner:

```text
file: .ecorione/evidence/w17-no-oracle-2026-09-16T12-35-29-327Z.json
sha256: a76a6a195aea6e117651f948e41b3fdcbbd2532cbdf556c14a2437fa50483fb3
bytes: 129693
model identity: qwen3.5:9b|qwen3.5:9b
```

Aggregate bounded results:

```text
median oracle-control transport reduction: 73.6379379246037%
median oracle-control input-token reduction: 76.34342186534899%
median oracle-control/full latency ratio: 0.9507074318703778
median automatic selected-hydration transport reduction: 46.089385474860336%
median automatic input-token reduction: 50.80489375402447%
median automatic/full latency ratio: 0.9839322301085884
automatic known-transport-floor beat task count: 0/5
```

The last metric is intentionally retained: W17 does **not** claim end-to-end network savings for automatic selection because candidate scanning remains part of the known transport floor.

A preceding bounded smoke run also passed all four lanes for `incident-triage` with quality `1`, selector recall `1`, and zero cache hits.

## Claim boundary

The real run is now captured and passed the predeclared closure gates. W17 is closed for this bounded local evidence profile.

Even after a local PASS, the evidence remains bounded to this task set, local runtime, selected model identity, and measured harness. It does not establish universal savings, production economics, or hosted-provider billed-cost savings. Hosted economics remain W18.
