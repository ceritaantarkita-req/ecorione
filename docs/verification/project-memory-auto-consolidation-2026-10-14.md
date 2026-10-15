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

1. Run `pnpm exec vitest run services/context/src/consolidate.test.ts services/context/src/http.test.ts services/context/src/project-memory-persistence.test.ts services/hub/src/project-context.test.ts`.
2. Run typecheck and lint plus full CI from branch / PR; verify no regressions.
3. Start local runtime with Connect and a reachable local model; create Project `QA-Memory`.
4. Ask the agent to remember a unique, harmless test token (no secrets) and wait for async consolidation. Confirm the Context fact exists under the Project (not only Historical Ledger).
5. Create a new conversation in the **same Project**, ask for the token, and confirm a Memory Fact was recalled and the answer is correct.
6. Repeat in a **sibling Project**: no token must appear. Repeat with a `LOCAL_ONLY` episode on hosted chat: the token must not cross into cloud context.
7. Restart Context, then repeat recall. Record the observed result and cleanup test-only data.

**Status:** branch implementation submitted for CI and local browser verification. Local-model readiness and real persistent cross-session recall are **not** verified by GitHub CI alone; do not declare production-ready based solely on unit tests.

## 2026-10-15: operator screenshot review and remaining acceptance gate

Evidence boundary: the operator supplied screenshots of a Windows local `pnpm engine:start` session, the Projects `QA-Memory` surface, and Local/hosted chat examples. These are visual observations, **not** a remotely executed test or independent review of the laptop database.

Observed in supplied screenshots:

- Engine log included successful `GET /healthz` responses (`200`) and a ready Ai Next.js surface at `127.0.0.1:17020`.
- The selected `QA-Memory` Project displayed policy `GLOBAL_PLUS_PROJECT` and autonomy ceiling `L3`.
- Its read-only Memory panel reported `Pending episodes: 0`, `Processed episodes: 12`, `Saved facts: 1`, `Local Only: 1`, and `Cloud Allowed: 0`.
- A Local Qwen answer reproduced the harmless marker `BIRU-742` after a message explicitly named that marker, while admitting it did not have the fuller definition. This demonstrates a **limited local recall observation**, not complete semantic recall.
- The screenshots do **not** establish successful new-session recall, nonlexical semantic recall, sibling-Project isolation, actual hosted egress filtering, or durable recall after Context restart. They do **not** establish that the saved fact was used in a different model's actual input.

Exact-head GitHub verification before this documentation update: PR #467 at `3c786df159c8b64643de7cd799119c311bea2ef9` had **CI #2951, Product Eval #2190, PCS-06 Browser #559, and MCP HTTPS #1368 SUCCESS**; CI verify, naming and secret-history jobs were successful. Those CI/mock gates cannot substitute for operator-controlled Windows persistence and model-input observations. A new branch head after this documentation edit requires new exact-head gate review.

### Manual operator acceptance matrix — keep private runtime evidence local

| Case | Execution | Pass criteria |
|---|---|---|
| A: new session | In QA-Memory/Local create a harmless unique factual statement; wait for `Saved facts` increase, then open **new** conversation under the **same Project** and ask for the exact code | Answer cites the correct value; `memoryUsed.recalledFacts` or equivalent scoped retrieval shows an authorized hit rather than replay of the original session |
| B: model switch | Repeat in that Project with Local model A then Local model B, with a question that needs a previously saved fact | Both have the same Project identity/instructions; correct relevant fact retrieved without unrestricted replay |
| C: sibling isolation | Ask for the distinctive marker from sibling QA-Audit Project (without including the marker in the query) | No sibling Project fact enters retrieval/dynamic context; model must not claim private knowledge |
| D: Local Only → hosted | Save distinct Local Only marker, switch to OpenRouter/hosted, ask a neutral recall question (do **not** put private marker in outbound user prompt) | LOCAL_ONLY raw text, summaries and facts absent from hosted `dynamicText` and request; lack of recall alone is not proof, inspect sanitized route/trace |
| E: explicit cloud consent | In Local, explicitly opt in for a **different** harmless test message, wait for local fact extraction, then ask via hosted in the same Project | Only new consented `CLOUD_ALLOWED` fact is retrievable; old Local Only facts stay blocked; consent resets on next send |
| F: persistence | After backing up test DB and checking for active unsaved work, perform a **controlled** Context restart and re-query from a new Project session | Saved fact and its Project/syncClass survive restart, while transient `lastAttempt` may reset |
| G: paraphrase diagnostic | In same new session, query the fact without sharing its exact token or key terms | Log lexical `hits` / `memoryUsed` separately from model answer: current Phase-1 chat retrieval is **lexical-only by design** (see `docs/api-fase1.md`), so this is a measured limitation, not grounds to silently inject unrestricted L0 history |

For all cases capture: test case ID, local build/ref, Project pseudonym, session boundary, model/provider, before/after Memory counts, eligible retrieval hit IDs and sanitized model input where allowed, and pass/fail. Do **not** commit local DB, credentials, raw model inputs, identifying screenshots, or personal markers to this public repository. Do not change sync classes to make a failed privacy test green.

**Remaining gate:** independent real-Windows A–F acceptance and reviewed current-head security checks before PR #467 is marked ready/merged. Desktop Commander was offline during this review, so no direct remote laptop actions or live-model calls were executed by the reviewer. Main remains unchanged.

## 2026-10-15: privacy-tier correctness repair and verified automated gates

Two concrete defects in the initial draft implementation were corrected on PR #467:

1. **Cross-tier dedupe/supersession:** An older Project fact with matching subject/predicate could swallow or supersede a newly consented fact even if its `syncClass` or `sensitivity` differed. `services/context/src/consolidate.ts` now only deduplicates/supersedes within the same Project, scope, exact sync class and exact sensitivity tier. Explicitly repeated CLOUD_ALLOWED facts can coexist with prior LOCAL_ONLY facts without retroactively changing the original.
2. **Mixed-policy local extraction:** One local extractor prompt formerly contained USER episodes spanning differing privacy/sensitivity classes (and possibly Projects when the operator ran cross-Project consolidation). It could accidentally attribute information from LOCAL_ONLY or higher-sensitivity input to a lower-class source episode. Local extraction is now grouped by the exact `projectId + scope + sensitivity + syncClass` tuple before prompting. Groups are processed serially; failures preserve only the failed group's episodes for retry. The configured episode limit remains per invocation (at most 20), while distinct policy groups can require more than one **local-only** model call. There is still no hosted extraction fallback.

Deterministic regression coverage added in `services/context/src/consolidate.test.ts` for local/cloud deduplication, sensitivity-preserving supersession, separate extraction prompts, and partially invalid grouped extraction.

Exact-head automated verification **before this documentation/temporary-workflow cleanup**: commit `044713036582b7fa3ffbc0c1a37be07ec4322316` — CI #2959 **SUCCESS** (verify including format, lint, typecheck, tests, real-process acceptance, naming, secret-history), Product Eval #2198 **SUCCESS**, PCS-06 Browser #567 **SUCCESS**, MCP HTTPS #1376 **SUCCESS**. A temporary read-only diagnostic workflow was used to derive exact Prettier changes and is removed by the documentation cleanup commit; it is **not** part of the target PR deliverable.

Remaining acceptance: real operator-controlled Windows/local-model new-session recall, cross-provider eligible context, sibling Project exclusion, consent egress, and restart/persistence checks, as defined above. Automated checks do **not** establish actual laptop database contents, model input or new-session accuracy. PR stays draft and must **not** merge until those checks are independently observed and the final cleanup commit's gates are green.

## 2026-10-15: file-backed restart regression and extractor-outage containment

At the reviewed code head `63e648a5c54f6f112ac58b6c6187df99d98307f8`:

- Added `services/context/src/project-memory-persistence.test.ts`. It writes two harmless Project episodes with different sync classes to a **temporary on-disk SQLite DB**, waits for the local extractor to create durable facts, closes the Context server/DB, opens the same DB through a fresh Context server, and verifies L1 recall while the new chat session has no episodes.
- Negative checks confirm that the sibling Project cannot retrieve either fact, hosted-eligible retrieval cannot return LOCAL_ONLY facts, and a separately consented CLOUD_ALLOWED fact remains eligible. Post-restart per-Project counts and the expected reset of ephemeral worker telemetry are also asserted.
- Local extractor promise rejection is now handled **per privacy/sensitivity group**, leaving only that group's episodes pending while other groups may complete; returned errors do not include the model exception payload. A dedicated regression test verifies this behavior.
- These tests use a deterministic mocked local extractor and a disposable database. They are more realistic than in-memory tests for persistence, but **not proof of real-model semantic recall, cross-provider execution, or Windows laptop runtime behavior**.

GitHub gates for that code head: CI **#2963 SUCCESS** (format, lint, typecheck, tests, real-process acceptance, release/security gates, production build, naming and secret-history); Product Eval **#2202 SUCCESS**; PCS-06 Browser **#571 SUCCESS**; MCP External HTTPS **#1380 SUCCESS**.

The remaining operator-controlled acceptance A–F above is unchanged. To run the deterministic persistence test from a clean checkout of PR #467, use `pnpm exec vitest run services/context/src/project-memory-persistence.test.ts services/context/src/consolidate.test.ts`. This test is safe for the actual laptop's existing Context DB because it uses a newly created temporary SQLite file; it **does not** inspect or validate the existing laptop DB. Real provider/model and local restart acceptance must still be performed separately and recorded before merge. No paid hosted canaries are necessary for the deterministic tests.
