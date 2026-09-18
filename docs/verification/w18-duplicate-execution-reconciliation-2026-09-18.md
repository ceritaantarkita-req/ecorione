# W18 Duplicate Formal Execution — Ledger Reconciliation and Guard Fix

Date: **2026-09-18**

Status: **RECONCILED / FIX MERGED / INCIDENT CLOSED**

## What the durable ledger proves

The operator-provided local ledger contains two consecutive groups of 20 settled W18-shaped entries on 2026-09-18 UTC.

### Earlier batch

```text
window = 02:14:52.621Z .. 02:15:34.405Z
settled entries = 20
full-inline actual total = US$0.059046
ecx-selective-auto actual total = US$0.032550
batch total = US$0.091596
```

The reservation sequence is the same W18 task/lane sequence used by the formal harness:

```text
0.103174, 0.087859,
0.103174, 0.087859,
0.107374, 0.087720,
0.107374, 0.087720,
0.095569, 0.078049,
0.095569, 0.078049,
0.100399, 0.083445,
0.100399, 0.083445,
0.100309, 0.083592,
0.100309, 0.083592
```

This exactly reconciles the previously unexplained durable-spend delta:

```text
formal-run start daily committed = US$0.091596
preceding zero-spend preflight daily committed = US$0
delta = US$0.091596
```

### Later batch

The supplied formal transcript records the second 20-call batch:

```text
window = 02:18:03.986Z .. 02:18:48.850Z
full-inline actual total = US$0.059106
ecx-selective-auto actual total = US$0.032610
batch total = US$0.091716
aggregate.pass = true
closureEligible = true
failedTasks = 0
```

### Combined durable spend

```text
earlier batch = US$0.091596
later batch = US$0.091716
combined = US$0.183312
documented maximum dollar authorization = US$0.25
```

Therefore the incident did **not** exceed the documented US$0.25 monetary ceiling in aggregate. It did violate the documented **single-attempt** governance boundary because the formal harness executed twice.

No ledger entries are rewritten or deleted.

## Root cause

The pre-existing operator wrapper derived a fresh temporary daily ceiling on every invocation:

```text
formalDailyCeiling = current UTC-day committed + US$0.25
```

That correctly limited each invocation but did not persist a one-shot authorization-consumption state. After one completed run, a second invocation could therefore derive a new ceiling from the updated ledger and proceed.

This is a governance bug in the operator wrapper, not a provider billing discrepancy.

## Fail-closed fix

The fix adds two independent protections:

1. before an execute invocation starts the engine, refuse if local raw evidence already contains a completed 20-call W18 PASS summary;
2. after zero-spend preflight passes but **before hosted mode is enabled**, atomically create a gitignored authorization-consumption marker under `.ecorione/evidence/`.

The marker is intentionally created before any hosted dispatch. If the process crashes or the run fails afterward, the attempt remains consumed and cannot be silently retried.

The marker is runtime-private and remains gitignored.

## Closure interpretation

The later formal runtime evidence remains technically valid:

- 20 measured calls completed;
- zero failed tasks;
- aggregate gate PASS;
- provider-billed cost remained below the documented dollar ceiling;
- cleanup returned hosted mode off and stopped the engine.

The duplicate-execution incident remains visible as governance evidence.

The single-attempt guard passed exact-head repository gates and merged:

```text
PR = #142
exact reviewed head = 1f0d87963857d4bb261579204e76bae970c496b0
CI #1012 = PASS
Product Eval #251 = PASS
merged main = cff6e21edc8085bb895c6ed59c32b5e4aa134ee0
```

No hosted provider call was made by the guard fix. The incident is closed; W18 may be closed at its documented bounded evidence boundary.
