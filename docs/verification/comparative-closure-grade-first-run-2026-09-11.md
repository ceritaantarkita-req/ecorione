# Comparative ECX closure-grade first run — 2026-09-11

Status: **FAIL / VALID RUNTIME FINDING — 4/5 TASKS PASS; RELEASE FIXTURE EXACT-VALUE AMBIGUITY FOUND**

This note records the first full closure-grade local Comparative ECX run after the cache-isolation correction was merged and the operator laptop was synchronized to `main`.

It is deliberately preserved as a failed-run record. The result must not be rewritten into a PASS after the fact.

## Revision and runtime boundary

Repository revision used for the run:

`197627dc04689dea94bf7957e18b2699f8fb9213`

Runtime boundary:

- WSL2 Ubuntu 24.04 operator laptop;
- Phase 4 local services;
- Connect local OpenAI-compatible route;
- Ollama local runtime;
- runtime model reported as `gemma4:latest`;
- hosted calls remain outside this evidence scope.

## Command

The working command syntax was:

```bash
pnpm evidence:comparative \
  --repeats 5 \
  --output .ecorione/evidence/comparative-local-2026-09-11.json
```

The earlier documentation form `pnpm evidence:comparative -- --repeats ...` is invalid for this package-script/parser combination because the literal `--` reaches `scripts/comparative-evidence.mjs` and is rejected as an unknown argument. Related current docs are corrected in the follow-up fixture-fix scope.

## Run shape

- tasks: 5;
- repeats: 5;
- lanes per repeat: 3;
- measured model calls: 75;
- warm-up: one unmeasured call;
- cache namespace: unique for the invocation;
- exact-cache contamination: not observed in measured lane summaries;
- provider-token actual cost: USD 0 for the local runtime.

## Aggregate result

The run produced:

- passed tasks: `4/5`;
- failed task: `release-readiness`;
- median fixture-level selective transport reduction: `73.6379379246037%`;
- median selective-vs-full input-token reduction: `77.70491803278688%`;
- median selective/full latency ratio: `0.8387964882197358`.

These aggregate reduction values are **provisional observations from a failed closure run**, not a final ECORIONE savings claim.

The four passing tasks were:

- `incident-triage`;
- `procurement-award`;
- `retention-policy`;
- `customer-escalation`.

For those tasks, the `ecx-all` control kept input-token count aligned with `full-inline`, while `ecx-selective-oracle` reduced hydrated/model context and retained deterministic answer quality under the predeclared gates.

## `release-readiness` failure

`release-readiness` failed the same deterministic quality gate in all three lanes:

```text
full-inline median quality < 1
ecx-all median quality < 1
ecx-selective-oracle median quality < 1
```

Observed median quality in all three lanes was `1/3`.

This was **not selective-hydration-specific quality loss**. The full-inline baseline, the all-ref ECX control, and the oracle-selective lane all exhibited the same exact-match issue.

The model consistently returned values such as:

```json
{
  "releaseId": "R2026.09.11.",
  "openBlocker": "DB-188 migration checksum mismatch.",
  "rollbackCommand": "deployctl rollback r2026-09-11"
}
```

The fixed expected answer is:

```json
{
  "releaseId": "R2026.09.11",
  "openBlocker": "DB-188 migration checksum mismatch",
  "rollbackCommand": "deployctl rollback r2026-09-11"
}
```

The original fixture text placed sentence punctuation immediately after two authoritative string values:

```text
Release ID: R2026.09.11.
Only open blocker: DB-188 migration checksum mismatch.
```

At the same time, the prompt required exact preservation while the answer key excluded those sentence-final periods. That makes the fixture delimiter ambiguous for an exact-string benchmark.

## Follow-up correction

Branch:

`fix/comparative-release-fixture-ambiguity-20260911`

The correction is intentionally narrow:

1. keep the existing expected answer unchanged;
2. keep deterministic exact-match scoring unchanged;
3. keep all quality/bytes/token/latency gates unchanged;
4. remove only the ambiguous sentence-final periods immediately adjacent to the two `release-readiness` authoritative string values;
5. add a regression test that locks those source delimiters;
6. correct the documented package-script argument syntax;
7. rerun the targeted `release-readiness` task after merge;
8. only after the targeted task is healthy, rerun the complete 5× closure benchmark on the corrected merged revision.

No punctuation normalization is added to `scoreReply`; doing so after seeing this failure would weaken the predeclared exact-match quality gate.

## Claim boundary

This failed run supports the following observations:

- the per-invocation cache isolation correction worked for the full run;
- 75 measured calls were attempted across the intended three-lane protocol;
- four of five fixtures passed all predeclared task gates;
- the failing task failed equally across baseline/control/selective lanes due to an exact-value fixture ambiguity;
- selective hydration showed substantial byte/token reductions in the measured fixtures, including the failed task's transport/token gates.

It does **not** establish:

- final closure-grade Comparative ECX PASS;
- automatic reference selection;
- general optimizer effectiveness;
- hosted-provider billed-cost savings;
- production/VPS savings;
- a public percentage-savings claim.

The final comparative verdict remains **OPEN / RERUN REQUIRED**.