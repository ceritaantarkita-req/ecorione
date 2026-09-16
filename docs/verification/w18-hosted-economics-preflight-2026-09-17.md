# W18 — hosted economic validation preflight

Status: **HARNESS IMPLEMENTATION / REAL HOSTED SPEND NOT YET AUTHORIZED**

Date: **2026-09-17**

Baseline entering W18: `100d0f92db9778c42fb3549ae10584eee6d2f11d` (`main`, W11 closure merged).

## Goal

W18 exists to close the claim that ECX automatic selective context can reduce **real hosted provider billed cost**, not merely local input tokens or a static price-table estimate.

The W17 local-model closure remains authoritative for no-oracle selector recall/quality on the four-lane local benchmark. W18 deliberately narrows the paid experiment to the two lanes needed for economics:

- `full-inline`;
- `ecx-selective-auto`.

Formal shape:

```text
5 synthetic extraction tasks
× 2 paired repeats
× 2 hosted lanes
= 20 measured hosted model calls
warm-up calls = 0
```

## Provider and cost authority

The closure provider is **OpenRouter** with ECORIONE pinned pricing identity:

```text
claude-sonnet-4-5-20250929
```

The runtime OpenRouter mapping remains `anthropic/claude-sonnet-4.5`.

For W18, provider-billed cost is authoritative. `services/connect/src/providers/openai-compatible.ts` therefore fails closed for successful OpenRouter responses that omit `usage.cost`. Direct OpenAI retains its existing price-snapshot fallback because this W18 closure does not use direct OpenAI.

A successful OpenRouter completion therefore reaches the ECORIONE cost ledger only after provider-reported `usage.cost` has been parsed and supplied as `actualUsdOverride`; the durable spend reservation is settled to that same actual value.

## Synthetic egress boundary

W18 uses only the benchmark's synthetic extraction fixtures. Artifacts created by the W18 runner are explicitly marked:

```text
sensitivity = INTERNAL
syncClass = CLOUD_ALLOWED
```

Automatic ECX hydration is requested with `hostedEligible=true`, so the selective lane still crosses the normal hosted-egress authorization boundary. Fixture relevance indexes are never supplied to the automatic selector; they are used only after selection to evaluate recall.

## Spend safety boundary

No hosted call is permitted merely because this harness exists.

The formal runner requires all of the following before the first hosted dispatch:

1. clean `main` with `HEAD == origin/main`;
2. Connect, Hub, and Artifact healthy;
3. Connect runtime `hostedProvider=openrouter`;
4. Connect runtime hosted calls enabled;
5. encrypted credential vault available with `openrouter/messages` configured;
6. durable daily and/or monthly spend budget configured;
7. `ECORIONE_COST_KILL_SWITCH=0`;
8. **current-process** explicit opt-in `ECORIONE_W18_ALLOW_SPEND=YES`;
9. **current-process** `ECORIONE_W18_MAX_SPEND_USD` set to a positive value;
10. the durable configured spend ceiling must be no looser than that explicit W18 cap;
11. W18 has an additional absolute safety ceiling of **USD 5** even if an operator enters a larger value.

The runner tracks actual provider-billed cost after every measured call and stops future calls if the explicit W18 cap is exceeded. The durable Connect budget remains the pre-dispatch hard admission boundary.

## No-spend preflight

The runner supports a preflight mode that does not dispatch hosted inference:

```powershell
node .\scripts\w18-hosted-economics.mjs --preflight
```

It checks repository state, service health, runtime provider state, credential metadata, and durable budget configuration. It never prints credential secrets. Preflight may run while hosted calls remain disabled; `hostedCallsEnabled=true` is required only after current-run spend authorization for the formal paid run.

## Formal closure gate

For every task, both repeats in both lanes must satisfy:

- provider is `openrouter`;
- pricing model is exactly `claude-sonnet-4-5-20250929`;
- no exact-cache hit;
- exact extraction quality score is 1;
- automatic selector recall against fixture relevance is 1;
- selected refs remain within the existing `maxRefs=3` budget;
- automatic hydration bytes are lower than full-inline fixture context bytes;
- durable spend settlement is `settled`;
- budget `actualUsd` equals the billed cost recorded by the completion;
- automatic input tokens are lower than full-inline;
- automatic provider-billed cost is lower than full-inline.

Aggregate closure additionally requires:

```text
taskCount = 5
measuredModelCalls = 20
failedTasks = 0
auto billed cost < full-inline billed cost
actual run spend <= explicit W18 max spend
closureEligible = true
```

Evidence is written under the gitignored `.ecorione/evidence/` directory with a SHA-256 summary, matching the W17 evidence discipline.

## Claim boundary

A W18 PASS will support only this bounded statement:

> On the five synthetic extraction fixtures, using the same pinned hosted route through OpenRouter, automatic ECX selective context reduced provider-reported billed cost versus full-inline while preserving the exact requested answer quality and selector recall.

It will **not** establish universal workload savings, future provider prices, OpenRouter credit-purchase fees, local hardware/electricity economics, or end-to-end network savings.

## Execution boundary

Repository-side implementation and CI may proceed without spend. The real formal run must remain blocked until the operator explicitly authorizes a maximum USD spend for the current run.
