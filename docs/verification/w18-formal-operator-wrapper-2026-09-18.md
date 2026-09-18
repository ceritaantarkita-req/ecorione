# W18 formal operator wrapper — repository preparation (2026-09-18)

Status: **MERGED / REPO-SIDE PASS / NO HOSTED CALL / FORMAL W18 STILL NOT EXECUTED**

This change reduces the remaining operator-only risk before the already-authorized formal W18 run. It does not claim W18 closure and does not consume provider spend.

## Merge verification

```text
PR = #138
exact reviewed head = c4b5b30f02716d66a8974903acb824f36ac1d12f
CI #1001 = SUCCESS
Product Eval #240 = SUCCESS
MCP External HTTPS Acceptance #461 = SUCCESS
merged main = 05ddd248e90e26b9db2c785d533c55ec817db013
```

CI #1001 passed formatting, lint, typecheck, tests, Phase 4 real-process acceptance, production-operations acceptance, secret scan, production build, naming, and full-history secret scan. No hosted provider dispatch occurred during these repository gates or the merge.

## Added operator path

The new `scripts/w18-formal-operator.mjs` wrapper:

- requires synchronized clean `main` through the existing W18 repository assertion;
- refuses to start while an old Connect process is already healthy;
- reads the current UTC ledger state immediately before startup;
- requires monthly headroom for the full current US$0.25 authorization;
- computes the temporary daily ceiling as `currentUtcDayCommittedUsd + 0.25`;
- injects kill-switch-open, Anthropic-only routing, W18 spend authorization, and the dynamic daily ceiling only into child-process environment;
- never writes those temporary values into `.env`;
- starts a fresh ECORIONE engine and keeps hosted calls disabled during the zero-spend preflight;
- enables hosted calls only after preflight PASS and only when the explicit `--execute-authorized-w18` flag is used;
- always attempts to set `hostedCallsEnabled=false` in `finally`;
- restores the prior hosted provider setting when available;
- stops the special engine process with the existing cross-platform process-tree cleanup;
- prints sanitized ledger state after cleanup.

The wrapper intentionally fixes the current formal authorization ceiling at **US$0.25**. A larger future run requires a deliberate code/docs change and fresh authorization rather than a casual CLI argument.

## Commands

Zero-spend wrapper rehearsal:

```powershell
node .\scripts\w18-formal-operator.mjs --preflight-only
```

Single authorized formal attempt after the operator laptop is synchronized to merged `main` at or beyond `05ddd248e90e26b9db2c785d533c55ec817db013`:

```powershell
node .\scripts\w18-formal-operator.mjs --execute-authorized-w18
```

The second command can dispatch hosted calls and consumes the current single-run authorization once provider dispatch begins. A partial or failed run must not be repeated without fresh explicit authorization.

## Evidence boundary

No hosted provider call was made while implementing this wrapper. Formal W18 remains open until the actual merged-main operator run returns `closureEligible=true`, its local evidence/hash is reviewed, and a sanitized closure record is merged.

W20 therefore remains blocked on formal W18 runtime evidence.
