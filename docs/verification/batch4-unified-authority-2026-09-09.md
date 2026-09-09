# Batch 4 — Unified Capability + Permission Plane verification

Date: 2026-09-09

Status: exact-head closure candidate

This note records the candidate evidence used to close Batch 4. Batch 4 is not considered CLOSED until the exact head of PR #13 passes the regular CI and MCP External HTTPS acceptance, the PR is merged with an expected-head lock, and the resulting `main` commit passes post-merge CI.

## Implemented authority boundary

- Hub owns the workspace-scoped capability/permission authority plane.
- Standing grants are scoped by workspace, subject, capability, permission, data scope, and maximum sensitivity.
- Unknown capability/permission, missing grant, stale extension declaration, or mismatched scope/sensitivity fail closed.
- Grant/revoke mutations are `POLICY_ADMIN` operations and remain behind durable human approval.
- Extension declarations never become authority grants automatically.
- Chat/model authority is checked before Context/provider egress.
- Flow model authority is checked before Connect dispatch.
- Sandbox authority is checked before generic policy/execution.
- Outbound MCP authority is checked before network dispatch; credential-backed MCP additionally requires `secret.access / credential.use`.
- Raw provider/MCP credentials remain Connect-owned and are not stored in Hub authority state.
- Built-in compatibility grants cover the pre-Batch-4 personal-workspace model and Sandbox paths only; outbound MCP remains explicit-operator-grant only.

## Pre-final regression evidence

- Integration helper run `34375813569`: root Typecheck PASS and focused authority/extension/sandbox/orchestrate tests PASS.
- Regression hardening run `34376301583`: root Typecheck PASS and focused Chat/MCP/credential/extension/Sandbox authority tests PASS.
- Exact-head candidate `64564f7e8aa0a09c9738cf74f879fa340ec884d0` exposed three import-only lint errors; Format and Naming already passed.
- One-shot lint hygiene run `34378863858`: Lint PASS and root Typecheck PASS; helper workflow/script self-removed after committing `d4c1f033c91fe4dc663993077205e82353d6a937`.
- No policy, authorization, runtime, or data-boundary semantics were weakened to resolve the lint failure.

## Exact-head closure gates

The commit containing this final evidence update is intentionally authored through the repository connector so GitHub executes pull-request workflows instead of leaving a bot-authored synchronization commit in `action_required` state.

Required before merge:

- Naming PASS
- Format PASS
- Lint PASS
- Typecheck PASS
- Test PASS, including the dedicated Fase 4 real-process acceptance
- Secret Scan PASS
- Production Build PASS
- MCP External HTTPS Acceptance PASS

Required after merge:

- `main` points at the expected merge result.
- post-merge `main` CI is fully green.
- canonical execution tracker is then updated to `Batch 4 — CLOSED` before Batch 5 implementation is treated as the active baseline.
