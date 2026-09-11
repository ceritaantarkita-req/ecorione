# Comparative ECX closure-grade final local evidence — 2026-09-11

Status: **PASS WITH LIMITATIONS / LOCAL COMPARATIVE CHECKPOINT CLOSED**

This note records the corrected closure-grade Comparative ECX run performed on the synchronized laptop after PR #41 removed the `release-readiness` exact-value delimiter ambiguity without changing the answer key, scorer, or predeclared task gates.

## Repository/runtime identity

- repository: `ceritaantarkita-req/ecorione`
- merged runtime revision: `4d5ee560a3b6cef024b0d7ed7bbec53a17f32675`
- source PR: #41 `fix: remove ambiguity from comparative release fixture`
- PR #41 exact-head CI: `34565244451` — PASS
- PR #41 post-merge `main` CI: `34565539119` — PASS
- laptop tracked tree was synchronized to the merge revision before the corrected runtime checks
- local route/provider: `local`
- model / response model: `gemma4:latest`
- pricing model: `local/provider-token-zero`

`gemma4:latest` is runtime evidence for this laptop checkpoint only. It remains a mutable alias and is not a durable production model-identity claim.

## Targeted release verification

Before repeating the full benchmark, `release-readiness` was rerun with one paired repeat across all three lanes.

Observed:

- `full-inline`: quality `1`, input tokens `1394`, cache hits `0`;
- `ecx-all`: quality `1`, input tokens `1394`, cache hits `0`;
- `ecx-selective-oracle`: quality `1`, input tokens `461`, cache hits `0`;
- packet bytes `1012`;
- all-ref hydration bytes `6211`;
- selective hydration bytes `1561`;
- selective transport reduction `58.7594%`;
- selective input-token reduction `66.9297%`;
- selective/full latency ratio `0.8054`;
- task gate: PASS.

This verified that the PR #41 release fixture correction restored exact deterministic quality without changing the control/token relationship.

## Full corrected closure-grade run

Command shape:

```bash
pnpm evidence:comparative \
  --repeats 5 \
  --output .ecorione/evidence/comparative-local-2026-09-11-v2.json
```

Run shape:

- tasks: `5`;
- paired repeats per task: `5`;
- lanes: `full-inline`, `ecx-all`, `ecx-selective-oracle`;
- measured model calls: `75`;
- measured exact-cache hits: `0`;
- failed task gates: none.

Local raw-evidence receipt:

- path: `.ecorione/evidence/comparative-local-2026-09-11-v2.json`
- bytes: `94654`
- SHA-256: `189795c71dc72acfd3d1533490a002d87e68421682868eb2b8b830c6fbdab439`

The raw JSON remains local/gitignored. Only this sanitized verification note is committed.

## Per-task measured medians

| Task | Full input tokens | ECX-all input tokens | Selective input tokens | Transport reduction | Input-token reduction | Selective/full latency ratio | Task gate |
|---|---:|---:|---:|---:|---:|---:|---:|
| `incident-triage` | 1553 | 1553 | 351 | 74.1928% | 77.3986% | 0.8673 | PASS |
| `procurement-award` | 1884 | 1884 | 393 | 75.6462% | 79.1401% | 0.9084 | PASS |
| `release-readiness` | 1392 | 1392 | 459 | 58.7594% | 67.0259% | 0.9740 | PASS |
| `retention-policy` | 1595 | 1595 | 338 | 73.6379% | 78.8088% | 0.7663 | PASS |
| `customer-escalation` | 1522 | 1522 | 337 | 73.5568% | 77.8581% | 0.8456 | PASS |

All five task-level predeclared gates passed. `full-inline` and `ecx-all` had zero median input-token delta on every task, which is the expected control behavior when both lanes deliver the same semantic document set.

## Aggregate result

Harness aggregate:

- task count: `5`;
- measured model calls: `75`;
- passed tasks: `5`;
- failed tasks: none;
- median selective transport reduction: `73.6379379246037%`;
- median selective input-token reduction: `77.8580814717477%`;
- median selective/full latency ratio: `0.8672873729681319`.

The harness therefore emitted:

```text
PASS comparative-evidence: paired local ECX transport/selective-hydration evidence meets predeclared gates; savings claims remain bounded
```

## Important post-run audit limitation

A manual audit of the 75 individual measured completions found one exact-string mismatch that did **not** fail the task-level gate because the predeclared quality gate uses the median across five repeats:

- task: `retention-policy`;
- lane: `ecx-selective-oracle`;
- paired repeat: `2/5`;
- quality score: `1/3`;
- returned strings included `ap-southeast.` and `Data Steward.` with sentence-final periods;
- the other four selective repeats and all baseline/control repeats for this task scored `3/3`.

Therefore this checkpoint is recorded as **PASS WITH LIMITATIONS**, not as a claim that every one of the 75 individual completions had perfect exact-string quality. The formal predeclared task gates passed, but future benchmark hardening should eliminate remaining exact-string delimiter ambiguity and may choose a stricter all-repeats quality gate before using this harness for broader claims.

This limitation does not change the measured byte/token control relationship, and it is not hidden or rewritten out of the evidence history.

## What this checkpoint verifies

Within these five synthetic local fixtures and the predeclared median-based gates, the evidence verifies that:

1. real Artifact pointers + Hub ECX planning/hydration + Connect local completion worked end-to-end;
2. `ecx-all` preserved the same median model input token count as `full-inline`;
3. hydrating the fixture-declared relevant subset reduced transported context bytes;
4. the selective-oracle lane reduced median model input tokens on every task;
5. task-level median deterministic quality remained `1.0` in all three lanes;
6. median selective latency stayed inside the predeclared `1.35×` tolerance on every task;
7. all measured calls were uncached and model identity remained stable.

## What this checkpoint does not verify

It does **not** establish:

- automatic semantic reference selection;
- a production autonomous optimizer;
- hosted-provider billed-cost savings;
- production/VPS/Cloudflare savings or behavior;
- general workload quality outside these fixtures;
- a universal public percentage-savings claim.

`ecx-selective-oracle` still uses fixture-declared relevant `refIndexes`. It is an upper-bound/control lane. The current ECX hydrator does not autonomously discover those refs.

Local provider-token `actualUsd=0` is expected and is not hosted-cost evidence.

## Closure decision

The local Comparative ECX measurement checkpoint is **CLOSED / PASS WITH LIMITATIONS**. The observed aggregate reductions may be cited only as results of this specific synthetic local benchmark, with the oracle-selector and per-run-quality limitations attached.

The next operator-approved checkpoint is **local persistence/restart evidence**, followed by isolated local backup/restore and local observability. VPS/compute-host + Cloudflare deployment remains deferred until explicitly resumed.
