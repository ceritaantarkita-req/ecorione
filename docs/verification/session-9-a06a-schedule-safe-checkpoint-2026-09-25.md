# Session 9 — A-05 closure + A-06a Schedule calendar safe checkpoint

Date: **2026-09-25**

Status: **SAFE / RESUMABLE — A-05 CLOSED / A-06a CLOSED / A-06b NOT STARTED**

Exact product main and staging baseline:

```
3b1abefd18263f7441d139e3435b064f83b142ea
```

There is no unmerged implementation work at this checkpoint.

## 1. A-05 closure decision

A-05 is closed at the generic connector boundary through PR #326 / merge:

```
dae2ea7bf90bc277b17d906a65df3a688566fc76
```

Decision:

- generic MCP-resource discovery + selected-resource snapshot ingestion is the supported connector boundary for this roadmap;
- native Google Drive OAuth/onboarding is deferred as a separate future integration;
- recursive folder auto-ingestion is intentionally not introduced;
- folders remain provider/connector navigation concerns and ECORIONE snapshots concrete selected resources into Artifact;
- Project/Hub remains binding/authority owner, Artifact owns raw snapshot bytes, Context owns derived extraction, Connect owns external adaptation.

This prevents A-05 from creating a new provider-OAuth/token-refresh/file-hierarchy domain merely to finish Project source onboarding.

Decision record: [session-9-a05-closure-decision-2026-09-25.md](session-9-a05-closure-decision-2026-09-25.md).

## 2. A-06a Schedule calendar implementation

PR **#327 — `feat: add navigable Schedule calendar views`**

Reviewed exact head:

```
fdc516b0336b598fae7217f511146fcbc96f5c21
```

Squash merge / product main:

```
3b1abefd18263f7441d139e3435b064f83b142ea
```

A-06a adds:

- Schedule modes `list / day / week / month / year`;
- explicit calendar cursor;
- Previous / Today / Next navigation;
- real day, week, month, and year calendar projections;
- responsive month/week/year layouts;
- year-to-month navigation;
- exact Flow-version deep links from occurrences;
- deterministic calendar/timezone helpers extracted from the large Work page;
- unit, source-contract, and rendered-browser regression coverage.

## 3. Authority boundary preserved

A-06a is UI/product evolution only.

- Flow remains Trigger-definition owner.
- Temporal remains durable schedule/runtime truth.
- Hub policy/authority remains unchanged.
- Ai Work projects owner state only.
- Work **does not parse cron to fabricate future runs**.
- Calendar cells only render `TriggerScheduleRuntime.nextActionTimes` exposed by Temporal.
- No scheduler database/domain was introduced.
- No new provider/model call or hosted spend was introduced.

The helper/component extraction is bounded A-09 maintainability while Work was already being touched; it is not a broad frontend refactor.

## 4. Exact PR-head evidence

Reviewed head `fdc516b0336b598fae7217f511146fcbc96f5c21` passed:

- CI **`36113711079`** — PASS
  - format
  - lint
  - typecheck
  - full tests
  - Phase 4 real-process acceptance
  - production operations acceptance
  - secret scan
  - dependency/toolchain/action/image/security policy gates
  - release-security acceptance
  - production build
  - secret-history
- Product Eval **`36113711113`** — PASS
- PCS-06 Integrated Browser Acceptance **`36113711071`** — PASS

PCS-06 built the production Ai UI, launched it in Chromium, navigated the Schedule Year/Next/Today/Month controls, checked desktop calendar overflow, exercised narrow Work calendar rendering, and completed without browser-console/page errors.

## 5. Merged-main evidence

Merged main `3b1abefd18263f7441d139e3435b064f83b142ea` passed:

- CI **`36114202738`** — PASS
- Product Eval **`36114202810`** — PASS

## 6. Exact staging proof

Automatic Staging Deploy **`36114495464`**:

- gate — PASS
- deploy — PASS
- `Deploy exact reviewed main SHA` — PASS

Therefore exact product main:

```
3b1abefd18263f7441d139e3435b064f83b142ea
```

is the proven staging runtime revision at this checkpoint.

## 7. What is still open inside A-06

A-06a closes the calendar/navigation deficiency, but **A-06 is not globally closed yet**.

Remaining bounded A-06 product work:

1. **Project selection UX**
   - current Work Project selection remains a native `select`;
   - searchable/autocomplete Project selection is not implemented;
   - inline `+ new Project` from Work is not implemented.

2. **AI-assisted Schedule interaction**
   - no embedded AI/chat composer for natural-language Schedule creation/editing;
   - any future AI-assisted path must still compile intent into the existing Trigger/Flow/Temporal authority path rather than directly scheduling outside it.

These should be treated as **A-06b** and must not be mixed with Brain A-07/A-08 or a scheduler-backend rewrite.

## 8. Safe resume rule

If work resumes from this checkpoint:

1. verify `main` is still at or descends cleanly from `3b1abefd18263f7441d139e3435b064f83b142ea`;
2. do not reopen A-05 unless a new explicit native-provider integration scope is authorized;
3. open a narrow A-06b branch/PR from current reviewed main;
4. preserve Flow/Trigger/Temporal ownership;
5. do not introduce a second scheduler, task database, synthetic history, or direct hosted inference merely to render schedules;
6. add deterministic tests + rendered browser evidence before merge;
7. merge only with green exact-head gates, then verify merged-main and exact-SHA staging;
8. do not start Brain A-07/A-08 until A-06b is either closed or explicitly deferred.

## 9. Separate deferred scopes

This checkpoint does not authorize or alter:

- native Google Drive provider integration;
- recursive folder mirroring;
- Brain A-07/A-08;
- broad frontend decomposition beyond touched surfaces;
- Compose A-10;
- DR-2 checkpoint 2;
- production/public cutover;
- provider spend;
- L4 autonomy / AutoClick.

