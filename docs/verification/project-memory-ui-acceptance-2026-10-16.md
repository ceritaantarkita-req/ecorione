# Project Memory — original local UI acceptance, 2026-10-16

Scope: draft PR #467, branch `fix/context-automatic-consolidation-20261014`.
Starting reviewed head: `dd16b4c2b1228304a8f136fd8f18e10d29002abb`.
No merge, paid inference, remote deployment, database reset or restore is authorized.
The operator explicitly approved one controlled engine restart after backup.

This supplements, without replacing, the earlier
[isolated acceptance record](project-memory-auto-consolidation-2026-10-14.md).

## Environment and preservation

- Real ECORIONE Next development UI at `http://127.0.0.1:17020`, production service
  entrypoints and the operator's existing SQLite databases; Ollama native API.
- Qwen `qwen3.5:9b`, digest
  `6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7`.
- Hermes `hermes3:latest`, digest
  `4f6b83f30b62bc3d0cf9be09266db222805ee815c8fd7d8b38f863f655be78b7`.
- PR was clean, open and draft at intake. CI, Product Eval, MCP HTTPS and Browser
  gates passed for the starting head; those results do not certify later changes.
- SQLite online backups of Context, Hub, RnD, Space and Temporal were taken before
  UI writes and again before restart. All five backups passed integrity checks.
  Private backups, runtime logs, screenshots and configuration copies stay under
  ignored `data/`; none are committed.
- Four original QA-Memory facts were compared with the first backup and remained
  unchanged. New UI test data uses `QA-Memory-UI-20261016`; test data is retained.
- Cloud AI was disabled through Settings. Subsequent engine starts additionally
  use `ECORIONE_COST_KILL_SWITCH=1`, `ECORIONE_LOCAL_MAX_TOKENS=768`,
  `ECORIONE_LOCAL_TEMPERATURE=0`, `ECORIONE_LOCAL_REASONING_EFFORT=none`.
  These process overrides do not modify `.env`.

## Observed UI results

| Scenario | Observed result |
| --- | --- |
| Original QA-Memory, fresh chat, Hermes recall | PASS: UI answered the stored experiment code, responsible person and deadline; memory panel displayed the source facts and no episodic summaries. |
| Original QA-Memory, initial Qwen recall | FAIL: Connect deadline expired. Retrieval had completed; this is not a successful recall. |
| Sibling Project isolation | PASS: Hermes answered that the empty test Project had no responsible person/deadline information; memory panel showed zero facts and zero episodic summaries. |
| Qwen receives new LOCAL_ONLY facts | PASS for chat/L0: UI returned `OK` for three harmless test facts. This alone does not certify L1 extraction. |
| Automatic extraction and explicit retry | FAIL observed: invalid shape with Hermes, and `LOCAL_MODEL_ERROR`/60-second timeout with Qwen. Pending source episodes were retained. |
| Per-message CLOUD_ALLOWED consent | PASS for chat/L0: Qwen replied locally; checkbox reset after sending, no Local Only memory/history entered that turn, and old episodes kept their original class. |
| CLOUD_ALLOWED L1 and hosted-eligibility filter | PASS: one public test fact was extracted; Context returned it with hosted filtering, while returning zero original LOCAL_ONLY facts. No hosted completion was dispatched. |
| Qwen → Hermes, new session | PASS: Hermes returned `BINTANG-205`, originally entered through Qwen, with one L1 source fact and zero episodic summaries. |
| Hermes paraphrase deadline | FAIL: fresh paraphrase session returned `2026-10-15` instead of the stored `30 November 2026`. Later Qwen recall in that resumed session returned the correct deadline. The stored original facts remained unchanged. |
| No paid inference | PASS at measured boundary: hosted disabled, UI responses report zero cost, spend ledger unchanged from backup and zero new entries on this date. |

Source/private evidence: `memory-ui-hermes-recall.png`, `memory-ui-isolation.png`,
`memory-ui-qwen-seed.png`, `memory-ui-cloud-consent.png`, `memory-ui-cross-model.png`,
`memory-ui-partial-extraction.png`, `memory-ui-paraphrase-failure-qwen-recovery.png`,
`memory-ui-egress.json`, `memory-ui-retry.log` and
the `memory-ui-*-engine.log` files under ignored `data/`.

Browser access was interrupted during the morning session by automatic approval
review hitting an account usage limit. Access later resumed through the same
browser tool. No alternate browser mechanism was used to bypass that block.

## Controlled restart

Engine PID 46648 was stopped using the repository's Windows process-tree shutdown
helper after verifying its command line and taking a fresh backup. The helper
returned a nonzero status; subsequent process and socket checks independently
confirmed that the engine and service listeners had stopped. New engine PID 18280
started with the same database paths. No database was deleted, replaced or restored.

Before any new post-restart chat, exact logical row hashes matched for:

- Context: 4 facts and 80 episodes;
- Hub: 124 history events and 6 Projects.

All five databases passed `integrity_check` after restart. The UI reloaded the
previous Qwen test conversation and its `OK` response. This proves persistence of
existing state, including pending episodes; it does not turn pending extraction
into successful extraction. Private manifests are `memory-ui-prerestart.json` and
`memory-ui-postrestart.json`.

## Confirmed repair: abandoned completion kept running

A real-socket regression reproduced Connect continuing local inference after the
caller had sent its complete request body and then disconnected. The old handler
listened only to `req.raw`'s `aborted` event, which does not cover this response-side
disconnect. Hub/Context timeouts could therefore leave model work alive.

The `/v1/complete` handler now also aborts on `reply.raw` close and removes both
listeners in `finally`. This fixes the shared completion route for Context, Hub,
Flow and SDK callers without changing extraction deadlines, prompt policy, spend
checks, database schemas or the multimodal route.

The new real-socket regression first failed (`expected false to be true`) and then
passed after the fix; the existing 18 HTTP tests also passed. Cancellation is
covered for both native Ollama and OpenAI-compatible local adapters. This repair
does not claim that a slow model will finish before the existing 60-second limit.

## Remaining acceptance failures and final runtime state

The safe UI cases were exercised; their failures are preserved. PR #467 is **not
ready for full acceptance/merge**: new three-fact LOCAL_ONLY extraction still
exceeded 60 seconds, including the post-fix explicit retry, whereas the separate
single-fact CLOUD_ALLOWED group succeeded. Four original QA-Memory facts remain
identical to the first backup. Pending inputs remain available for retry.

The timeout's remaining cause requires profiling the actual Ollama model/prompt
latency and validating an appropriate local runtime or smaller extraction batch;
the cancellation repair does not by itself establish a latency fix. Hermes also
needs renewed paraphrase correctness acceptance. Neither a larger deadline nor a
different answer from another model is used to retroactively pass those cases.

Final read-only audit: all nine Ai/service health endpoints returned 200, Context
integrity was `ok`, original facts were unchanged, and the spend ledger hash still
matched the pre-acceptance backup. Qwen was restored as the configured local model.
Cloud AI remains disabled and the running acceptance engine retains the operator
kill switch and bounded local generation controls. Browser console inspection
after the final successful cross-model case returned no errors.

## Automated verification

- Full repository regression: **1,627 passed, 6 failed, 4 skipped** across
  309 files (304 passed, 4 failed, 1 skipped). The run used
  `pnpm exec vitest run --maxWorkers=2`; no tests or gates were weakened.
- The two new real-socket cancellation cases passed, as did all Context tests and
  the existing Connect HTTP, hosted-provider and cost-policy tests in that run.
- Four failures in the two off-host DR test files concern POSIX `0600` file mode
  on Windows. The same four failures reproduced with the starting-head HTTP
  source restored in an isolated snapshot; they are not resolved by this patch.
- Two Temporal acceptance cases timed out after 120 seconds:
  `test/phase4-temporal-runtime.test.ts` and
  `services/flow/src/trigger-temporal.test.ts`. A targeted repeat on 17 October,
  at code commit `617e33dd03f96909a4668d0a851255a2c7f57a83`, passed both cases
  (2 passed, 1 existing skipped) in 15.79 seconds without changing code or limits.
  The original timeout cause is not proven; the full run remains recorded as failed.
- Typecheck, ESLint and production build passed in an isolated copy of the final
  source, preserving the active UI's development output. Existing Next/ESLint and
  CSS autoprefixer warnings remain; no new dependency was introduced.
- Repository formatting, working-tree secret scan and dependency security review
  passed. Full-history secret scan passed for all 3,802 commits present at intake.
  Exact-head remote checks are recorded in the PR after publication.

Private command logs: `memory-ui-regression.log`, `memory-ui-baseline-dr.log`,
`memory-ui-typecheck.log`, `memory-ui-lint.log`, `memory-ui-build.log` and
`memory-ui-secret-history.log`, plus `memory-ui-temporal-recheck.log` for the
17 October follow-up. Remote status must be checked against the current
PR head; the starting head's green checks do not certify this patch. No merge was
performed.
