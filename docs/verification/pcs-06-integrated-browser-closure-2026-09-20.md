# PCS-06 — Integrated Browser / Regression Acceptance Closure

Date: **2026-09-20**

Status: **CLOSED / PASS**

## Scope

PCS-06 verifies the post-closure product baseline through a rendered production Next.js UI in Chromium, in addition to the normal repository and Product Eval gates.

This batch adds acceptance infrastructure and regression coverage. It does not move service ownership, add a second execution/authority plane, or deploy ECORIONE remotely.

## Delivered acceptance gate

A dedicated `PCS-06 Integrated Browser Acceptance` workflow now:

- installs Playwright/Chromium ephemerally under `/tmp` without changing the repository package manifest or lockfile;
- builds the production product UI;
- starts the production Ai application;
- drives rendered Chromium user journeys;
- checks application console/page errors;
- checks page-level horizontal overflow;
- captures screenshot evidence;
- fails if the browser reaches an external HTTP(S) hostname.

Product Eval also locks the PCS-06 acceptance-scope contract.

## Rendered journeys verified

Desktop Chromium at **1440x900** verifies:

- Ai canonical conversation replay from Historical Ledger projection;
- same-session continuity across navigation;
- restored Hosted route for a replayed Hosted conversation;
- route locking after replayed turns;
- explicit disabled Local route when Local AI is unavailable;
- Hosted chat send/response behavior through deterministic same-origin fixtures;
- Projects and recent conversation rendering;
- light/dark theme switching;
- Work Schedule / Flows / Runs navigation;
- Brain relationship projection rendering;
- Space document rendering;
- Operations healthy-state rendering;
- Settings provider onboarding UI, credential test -> save/activate flow, default provider/model selection, Governed / Recommended model state, Local AI not-connected state, and Advanced settings surfaces;
- Flow Save -> Prepare authority -> explicit Approve -> authority-ready -> Run -> completed execution state.

Narrow Chromium at **410x844** verifies:

- Ai;
- Projects;
- Work;
- Brain;
- Space;
- Operations;
- Settings;
- Flow Stack;
- Flow Canvas with contained horizontal overflow.

The final browser run reported no page-level overflow and no application console/page-error failure on the covered narrow surfaces.

## External/provider boundary

The browser gate intercepts ECORIONE same-origin API calls with deterministic fixtures. It intentionally performs **no paid or live external provider call**.

Therefore PCS-06 proves rendered product behavior and integration contracts at this deterministic browser boundary. It does **not** claim:

- live hosted-provider quality or latency;
- live credential/provider availability;
- production/public-edge readiness;
- SumoPod persistence, security, backup, or observability.

Those remote-host boundaries remain in PCS-07..PCS-09.

## Preserved architecture

- Historical Ledger remains canonical chat history.
- Connect remains provider credential/runtime/model authority.
- Hub remains policy, approval, audit, and capability authority.
- Temporal remains Flow durability, retry, timer, signal, state, and recovery owner.
- Brain remains a rebuildable projection over canonical owners.
- Project remains a context/product grouping inside Workspace.
- No silent Local/Hosted fallback was introduced.
- No auto-grant or second Flow execution authority was introduced.

## Closure evidence

```text
implementation PR                 #201
reviewed exact head               0dfdda92e0bef800ca9a7563223b7423aa9b1299
CI                                #1553 PASS
Product Eval                      #792 PASS
PCS-06 Browser Acceptance         #13 PASS
merge main                        0a8f7619567500acaec0758c400d529367baf0e5
```

The exact reviewed head passed all three required gates before merge.

## Acceptance

PCS-06 is **CLOSED / PASS** at its documented deterministic rendered-browser boundary.

The next approved roadmap scope is **PCS-07 — SumoPod remote staging deployment**. SumoPod remains staging, not production; GitHub `main` remains source of truth.
