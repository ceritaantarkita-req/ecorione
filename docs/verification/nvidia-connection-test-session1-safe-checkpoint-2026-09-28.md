# NVIDIA Connection Test — Session 1 Safe Checkpoint — 2026-09-28

Status: **FINAL / CLOSED / PASS / STAGING VERIFIED**

## Scope

This checkpoint closes the bounded Session 1 requested after the Settings screenshots showed NVIDIA / NIM credential testing stuck on `Testing…`.

Session 1 changed only provider-test robustness. It does **not** start the OpenRouter multi-model registry work.

## Closed behavior

The Connect Settings validation path now has:

- a **30-second default credential-test deadline**;
- explicit `504 PROVIDER_TEST_TIMEOUT` instead of an unbounded credential test;
- an enforced provider-canary latency deadline, not merely a post-response latency check;
- a bounded NVIDIA credential/canary generation cap of **512 output tokens**;
- the existing **4096-token normal hosted-chat baseline unchanged**;
- transient credential handling preserved: the test key is not saved by the test endpoint;
- no silent provider fallback;
- existing spend admission/reservation and operator hosted gate preserved;
- a machine-readable timeout state surfaced to Settings provider-health UI.

## Exact reviewed head

```text
PR                         = #387
reviewed head              = c7ab5a3052a311b7361afe7aa6f0b4100ec8229e
merge SHA                  = 59961422e11d126baa0b2ff957dd7abf8e063f08
exact-head CI              = #2402 PASS
exact-head Product Eval    = #1641 PASS
exact-head PCS-06 Browser  = #218 PASS
```

The PR had earlier format-only failed attempts while the patch was being normalized. No gate was weakened; the final reviewed head above passed the full required checks.

## Merged-main / staging proof

```text
runtime / staging SHA      = 59961422e11d126baa0b2ff957dd7abf8e063f08
staging image              = staging-59961422e11d
merged-main CI             = #2403 PASS
merged-main Product Eval   = #1642 PASS
actual Staging Deploy      = #1567 PASS
Operations                 = healthy
configured/running         = 15 / 15
non-running                = 0
stabilized free disk       = 27.42 GiB
```

Staging Deploy #1567 rebuilt and deployed the exact merge SHA, passed the protected-route and MCP smoke checks, reported healthy Operations, and converged all 15 configured services.

SumoPod remains **staging, not production**.

## Regression coverage

Deterministic coverage now proves:

1. the NVIDIA credential probe sends `max_tokens: 512`;
2. the transient secret is not echoed in the response;
3. a delayed NVIDIA credential test returns `504 PROVIDER_TEST_TIMEOUT` instead of hanging;
4. NVIDIA hosted canary uses the same bounded probe output;
5. Settings provider health maps the timeout via the machine-readable error code.

## User-key boundary

This checkpoint does **not** claim the user's actual NVIDIA API key has passed a real provider call.

The next operator validation remains:

```text
Settings
 -> NVIDIA / NIM
 -> enter the real key
 -> Test API key
 -> observe PASS or a bounded explicit error within the deadline
 -> Save & activate only after PASS
 -> send one real Ai message
```

A failure or timeout after this checkpoint is now diagnostic evidence rather than an indefinite UI wait.

## OpenRouter boundary

OpenRouter multi-model support is **not part of Session 1**.

The agreed next scope, if explicitly continued, is Session 2: replace the current Claude-only OpenRouter catalog foundation with an extensible governed model registry while preserving pricing/evidence/governance boundaries.

Do not mix that work into this closed checkpoint retroactively.

## Repository / branch state

At Session 1 runtime closure, before this docs refresh:

```text
open pull requests         = 0
live remote branches       = 11
cleanup-boundary branches  = 9
known bookkeeping ref      = docs/current-safe-resume-20260928
known merged Session 1 ref = fix/nvidia-credential-test-timeout-20260928
unexpected work branches   = 0
```

The two additional refs are known bookkeeping/provenance refs. Their presence does not mean Session 1 is still active.

## Resume rule

Session 1 is complete. Do not reopen the NVIDIA timeout/canary patch merely for freshness.

For the next implementation:

1. inspect current `main`;
2. read `docs/verification/ecorione-safe-resume-checkpoint-2026-09-28.md`;
3. read this checkpoint for Session 1 evidence;
4. open only the next explicitly authorized scope.

## Bottom line

NVIDIA credential/provider testing is now bounded, lighter, and failure-explicit in the deployed staging runtime. Session 1 is **CLOSED / PASS**. Real user-key validation remains an operator action, not unfinished repository implementation.
