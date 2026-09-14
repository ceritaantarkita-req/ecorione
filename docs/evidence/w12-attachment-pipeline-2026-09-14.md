# W12 Attachment Pipeline Evidence — 2026-09-14

Status at creation: **IMPLEMENTED — FINAL NORMAL CI PENDING**

This note records repository evidence for W12 without replacing `docs/active-work-plan.md` as the canonical execution log.

## Implemented path

```text
Composer File/Photo/Folder
  → staged browser File
  → POST /api/attachments on Send
  → Artifact owns raw bytes
  → Hub /v1/multimodal/analyze
  → Context episode in the same session
  → normal chat orchestration hydrates governed Context
```

Key boundaries:

- file labels are not injected as fake prompt content;
- manual notes remain explicit user-authored prompt content;
- local attachments are `LOCAL_ONLY`; hosted attachments are `CLOUD_ALLOWED`;
- multimodal routing uses the selected target with hosted fallback disabled;
- internal service credentials stay server-side;
- one file is limited to 20 MiB and the composer is limited to 20 attachments;
- files remain `staged` and removable until Send;
- upload happens during Send, not immediately on file selection;
- once a Context episode exists, the UI does not offer a fake remove action;
- partial upload failure preserves successful governed pointers and exposes the failed file for retry handling;
- if chat fails after attachment ingestion, governed attachments remain available for retry rather than being silently discarded.

## Verification already completed

The final staged-composer candidate passed the full repository verification chain in CI run `34830648734`:

- Format — PASS
- Lint — PASS
- Typecheck — PASS
- Tests — PASS
- Phase 4 real-process acceptance — PASS
- Production operations acceptance — PASS
- Secret scan — PASS
- Production build — PASS
- Naming — PASS

MCP External HTTPS Acceptance run `34830648703` — **PASS**.

The verified candidate was materialized to the branch as commit `e7c1c2d2a3c9f94b9425b033275f3360d7031d3e` (`fix: stage attachments until chat submit`). The normal CI workflow was restored to its canonical blob and temporary staged patch material was removed.

The workflow events emitted directly by the GitHub Actions bot materialization commit were marked `action_required` with zero jobs, so they are **not** counted as final clean-head verification. This evidence note intentionally creates a normal user/API commit so the canonical CI workflow can verify the materialized branch state independently.
