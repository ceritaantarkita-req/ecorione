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

## Runtime dependency and privacy boundary

- Memory extraction is **local-only** by the existing Context/Connect contract (`target: "local"`); it does **not** automatically fall back to OpenRouter/hosted. A green OpenRouter canary proves chat connectivity, **not** successful memory consolidation.
- The local model configured in **Settings → Local AI** must be reachable and pass its own local canary for automatic L1 facts to materialize. Without it, episode/History writes still succeed, but Memory may remain empty; startup or next-turn backfill cannot be claimed until demonstrated.
- This preserves the explicit restriction in `docs/api-fase1.md`: no silent hosted-data egress and no unexpected extra hosted API spend. Cloud-eligible derived facts can be recalled by hosted chat only **after** local extraction succeeds and their `syncClass` passes hosted eligibility.
- Background failures now log only a Project ID, error type, or bounded count, never exception payloads that may include model output. Raw episodes stay eligible for retries.

## 2026-10-15: local-runtime investigation and Project diagnostics

- `services/context/src/consolidate.ts` accepts strictly JSON-compatible local extractor replies with a single Markdown JSON fence or one leading `<think>...</think>` block. Malformed or free-form replies remain failures and eligible for retry; no hosted fallback was enabled.
- `GET /v1/memory/status?projectId=...` exposes per-Project counts only: pending/processed Episodes, active facts, Local Only/Cloud Allowed facts, plus **ephemeral** queued/processing/lastAttempt state. It never returns episode contents or fact text.
- The same-origin `/api/projects/memory-status` route **first validates Project ownership via Hub** for the active Workspace. The Projects view displays a read-only status panel with a Refresh control.
- **Important:** `lastAttempt` is in-memory runtime telemetry, not durable after a Context restart. Pending and saved counts come from the persistent Context DB. The panel is an explanation aid, **not** proof that a particular model has retrieved a particular fact.
- Follow-up browser acceptance: refresh the Project panel after a Local → Local test. If Pending remains nonzero or lastAttempt=failed, investigate the local extractor. If Saved > 0 and the same local chat cannot retrieve it, investigate retrieval/relevance. If facts are Local Only, an OpenRouter chat must not see them.
- All changes stay in draft PR #467 until CI, local-model runtime verification, Project isolation and restart acceptance are documented.

## 2026-10-15: model-switch Project continuity (local ↔ local / local ↔ hosted)

- Hub **always resolves the active Workspace/Project** for chat. Ordinary Project chat now renders bounded, user-configured **Project name, description, and instructions** in dynamic per-turn context independent of which model handles the turn. These are user preferences, never a substitute for system/policy/tool authority. Brain-grounded constrained turns intentionally do **not** import wider Project instructions.
- Provider-independent retrieval still assembles only authorized Core Memory, relevant L1 facts, recent same-session episode summaries, and Artifact pointers, preserving budget limits, Project filtering, and the stable cache prefix. System guidance discourages models from denying facts that were already provided to them; output truthfulness remains model-dependent.
- **Local → Local:** the new model receives current Project settings and eligible saved facts / bounded session summaries; it does not receive a limitless verbatim context window.
- **Hosted → Local:** cloud-eligible episodes/facts are still accessible locally.
- **Local → Hosted:** historical `LOCAL_ONLY` messages/facts are **never** silently exported. The default Local send remains Local Only. The chat composer offers a **per-message, unchecked-by-default** opt-in for future Local turns to be stored `CLOUD_ALLOWED`. Explicitly consented turns consult **only cloud-eligible Context inputs**, even while answered by a local model, to avoid laundering earlier private memory into a cloud-visible reply. Local Only messages written before consent remain Local Only. Attachment-bearing messages do not use this opt-in.
- The local user must deliberately enable sharing for each eligible Local message; it resets after a send, route change, or session change. Switching to OpenRouter still obeys hosted eligibility on each retrieved fact/episode.
- This achieves **authorized continuity**, not impossible guarantees of zero context loss across arbitrary long histories or incompatible providers. Exact entire-chat replay, retroactive release of local private context, new tool permissions, and model-internal reasoning transfer are **out of scope**.

Acceptance to run before merge:
1. Local A → Local B in same Project/session: name, instructions, eligible facts and bounded episodic summaries are in model input; new model responds consistently.
2. Hosted A → Hosted B and Hosted → Local: same Project context and eligible history; previous cloud turns survive.
3. Local (no consent) → OpenRouter: private contents absent in any outbound `dynamicText` and retrieval response.
4. Local (explicit Cloud Allowed opt-in) → Hosted: new permitted facts/episodes may be retrieved later, while all prior Local Only facts/episodes stay excluded.
5. New session same Project retrieves durable L1, sibling Project does not; shutdown/restart retains it. **Real Windows runtime proof still required.**

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

**Status:** branch implementation submitted for CI and local browser verification. Local-model readiness and real persistent cross-session recall are **not** verified by GitHub CI alone; do not declare production-ready based solely on unit tests.
