# PCS-01 — Chat Continuity and History Closure

Date: **2026-09-20**

Status: **CLOSED / PASS**

## Scope

PCS-01 closes the browser-facing chat continuity gap without introducing a second chat-history owner.

Historical Ledger remains the canonical chronological/replay source. Context remains episodic-memory owner. Project remains a context/product grouping inside Workspace.

## Delivered behavior

- Ai preserves an active `sessionId` per Project in browser storage across page navigation/remount.
- An explicit `?session=` selection is validated against the active Project before replay.
- Existing Historical Ledger user/assistant events are projected back into the chat UI.
- The route target is restored from the session history when available.
- **Percakapan baru** explicitly creates a fresh session.
- Projects recent-conversation links reopen the exact Project + session.
- New History sessions receive a bounded title derived from the first user message.
- Replay is bounded to the latest 500 Ledger events rather than issuing an unbounded history read.
- Historical single-session/event reads now enforce supplied Workspace + Project bindings and fail closed for sibling Project queries.

## Preserved architecture/security boundaries

- no parallel chat/history database;
- Historical Ledger remains canonical chat replay state;
- Context remains memory-semantics owner;
- Workspace remains the authority/security boundary;
- Project binding is enforced before Ai displays an existing conversation;
- no silent local/hosted route fallback;
- Connect remains provider credential/runtime owner;
- no production, SumoPod, Cloudflare, AutoClick, L4 autonomy, or new scheduler scope was added.

## Regression coverage

PCS-01 added deterministic coverage for:

- Hub History Workspace/Project read isolation;
- exact-session Ai replay proxy;
- Historical Ledger event -> chat-turn projection;
- restoration of chat route target;
- per-Project persisted session helpers;
- branded History fixture IDs;
- Product Eval inclusion of the new continuity regressions.

The integrated live-browser product pass remains planned under **PCS-06**, as defined by the approved roadmap. PCS-01 does not relabel source/CI evidence as live-browser acceptance.

## Closure evidence

```text
implementation PR          #191
reviewed exact head        9445b30c659628e1d551191219d0b7cd5ccf2f7c
CI                         #1505 PASS
Product Eval               #744 PASS
merge main                 ee363c055944b27b549a2f061105eea35fa25f9e
```

CI #1505 passed format, lint, typecheck, normal tests, Phase 4 real-process acceptance, production-operations acceptance, secret scan, dependency/toolchain/container/release-security review, and production build.

## Acceptance

PCS-01 acceptance is satisfied at the repository implementation/regression boundary:

1. active session continuity is explicit and Project-scoped;
2. reopening a known conversation reads the canonical Historical Ledger;
3. new sessions are created only by explicit New chat or a defined invalid/Project-session transition;
4. sibling Project History reads fail closed;
5. exact-head CI and Product Eval passed.

The next roadmap scope is **PCS-02 — AI provider onboarding and hosted model choice**.
