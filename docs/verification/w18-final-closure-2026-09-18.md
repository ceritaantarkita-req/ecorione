# W18 Hosted Economic Validation — Final Closure

Date: **2026-09-18**

Status: **CLOSED / PASS WITH DOCUMENTED DUPLICATE-EXECUTION INCIDENT**

## Closure basis

W18 is closed on the bounded hosted-economic evidence for the pinned OpenRouter/Anthropic route.

Formal measured runtime:

```text
repository = main @ f249d9c0681462253bff21ca30354892ca4ce60f
provider gateway = OpenRouter
runtime model = anthropic/claude-sonnet-4.5
provider.only = anthropic
fallback = disabled
tasks = 5
repeats = 2
lanes = full-inline, ecx-selective-auto
measured calls = 20
failed tasks = 0
aggregate.pass = true
closureEligible = true
```

Measured billed-cost result:

```text
full-inline = US$0.059106
ecx-selective-auto = US$0.032610
formal run spend = US$0.091716
saved = US$0.026496
savedPct = 44.827936250126896%
medianTaskSavedPct = 44.4913020558777%
medianTaskInputTokenReductionPct = 50.629874025194965%
```

Raw local evidence remains gitignored. Recorded evidence SHA-256:

```text
cadb920047a27eb4e3db38cb53e63192af3ea7857617d8f125c7056bd6c162da
```

Cleanup passed with hosted calls disabled, future-process kill switch restored to 1, engine stopped, and no unsettled reservation after the recorded PASS run.

## Duplicate-execution incident

Ledger reconciliation later showed an earlier complete 20-entry settled W18-shaped batch:

```text
earlier batch = US$0.091596
later recorded PASS batch = US$0.091716
combined = US$0.183312
documented monetary ceiling = US$0.25
```

The combined spend stayed below the documented US$0.25 monetary ceiling. The duplicate execution nevertheless violated the documented single-attempt governance boundary.

The incident is preserved in:

`docs/verification/w18-duplicate-execution-reconciliation-2026-09-18.md`

No historical ledger entry was rewritten or deleted.

## Guard closure

PR #142 fixed the missing persistent single-attempt consumption state:

- completed 20-call PASS evidence now blocks execute reruns;
- a gitignored authorization-consumption marker is atomically created after zero-spend preflight and before hosted dispatch;
- a crash or failed run after marker creation remains consumed and cannot silently retry.

Repository verification:

```text
PR = #142
exact reviewed head = 1f0d87963857d4bb261579204e76bae970c496b0
CI #1012 = PASS
Product Eval #251 = PASS
merged main = cff6e21edc8085bb895c6ed59c32b5e4aa134ee0
```

The guard merge made no hosted provider call.

## Final W18 verdict

**W18 = CLOSED / PASS**, with the duplicate-execution incident retained as governance evidence.

Claim boundary remains narrow: this supports a billed-cost reduction result only for the five synthetic extraction fixtures under the tested pinned OpenRouter/Anthropic route. It does not establish universal savings, future provider pricing, end-to-end network savings, or production SLA/SLO.


## Final closure merge evidence

```text
PR = #143
exact reviewed head = 97890b269e19c9c9b8eaa8a89b4a17bcfdd09e11
CI #1014 = PASS
Product Eval #253 = PASS
merged main = 65142fe14901c87a8e499710081492d4b77e1357
```

This final closure merge was documentation-only and made no hosted provider call.
