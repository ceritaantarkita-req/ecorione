# Project memory cross-session — implementation checkpoint (2026-10-14)

## Reported symptom

In local ECORIONE, the user wrote a memorable marker in `QA-Audit`, received the expected answer in the same conversation, but a new conversation under the same Project did not recall it. The Memory sidebar also showed no derived memory.

## Confirmed code path on prior main

- Hub persists USER and agent replies to Context `/v1/episodes`.
- Hub's retrieval on the next turn reads `/v1/retrieve` (derived L1 facts) and reads episodic summaries **only by the current `sessionId`**.
- Context already had `/v1/consolidate/run`, but production chat did not invoke it automatically.
- Invalid JSON extraction previously set `consolidated_at` anyway, permanently suppressing L1 retries.

## Proposed repair on this branch

1. Once Context has durably received the agent's episode for a real Project, enqueue one nonblocking, bounded local-model consolidation batch for that Project. The response to the chat is not contingent on extraction succeeding.
2. Serialize automatic and operator-triggered consolidation to avoid duplicate concurrent promotion.
3. Only USER episodes can be promoted into durable facts; assistant episodes may still receive episodic summaries.
4. Candidate deduplication stays within the fact's own Project and cannot mutate global memory.
5. Invalid extractor JSON leaves episodes unconsolidated and retryable. Local extraction runs via Connect with a 60-second request timeout and strict JSON instructions.
6. Existing `GLOBAL_PLUS_PROJECT`, sensitivity, and `CLOUD_ALLOWED` retrieval filters remain unchanged.

## Limits / acceptance

- This is **asynchronous and model-dependent**, not guaranteed immediate recall. Do not claim closure until local/CI tests and browser acceptance show a saved fact is recalled after a new conversation.
- The auto trigger processes **at most 20 pending episodes per Project per assistant reply**; older backlog may require multiple rounds or an authorized targeted `POST /v1/consolidate/run` with `{ "now": "<ISO timestamp>", "projectId": "prj_..." }`.
- If Local AI / Connect is unavailable, the chat still succeeds; raw episodes remain stored and extraction retries on a later assistant reply or through the authorized operator endpoint. Error logs should not contain user episode bodies.
- The auto trigger is production opt-in from Context `main.ts`. Unit-test servers remain manual unless `autoConsolidate: true` is supplied.
- Do not enable direct L0 raw-history injection into prompts as a workaround; follow the Context L1 contract.

## QA checklist

1. Run `pnpm exec vitest run services/context/src/consolidate.test.ts services/context/src/http.test.ts services/context/src/project-context.test.ts`.
2. Run typecheck and lint plus full CI from branch / PR; verify no regressions.
3. Start local runtime with Connect and a reachable local model; create Project `QA-Memory`.
4. Ask the agent to remember a unique, harmless test token (no secrets) and wait for async consolidation. Confirm the Context fact exists under the Project (not only Historical Ledger).
5. Create a new conversation in the **same Project**, ask for the token, and confirm a Memory Fact was recalled and the answer is correct.
6. Repeat in a **sibling Project**: no token must appear. Repeat with a `LOCAL_ONLY` episode on hosted chat: the token must not cross into cloud context.
7. Restart Context, then repeat recall. Record the observed result and cleanup test-only data.

**Status:** branch implementation submitted for CI and local browser verification; not declared production-verified here.
