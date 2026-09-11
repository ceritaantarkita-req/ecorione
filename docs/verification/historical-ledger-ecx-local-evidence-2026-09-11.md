# Historical Ledger + ECX local evidence — 2026-09-11

Status: **REAL LOCAL EVIDENCE PASS / checkpoint closed / not a production savings claim**

This note records the real local Historical Ledger + Ecorione Compact Exchange (ECX) evidence collected immediately after the final Local→Gemma browser rehearsal. It is intentionally limited to the local laptop boundary and excludes secrets, host-specific paths and provider credentials.

## Source session

The browser-visible session after the chat-session hydration fix was:

- session: `sess_866a9ae3-09f8-4f42-862a-a28cabd9d1f7`;
- scope: `personal`;
- sensitivity: `INTERNAL`;
- sync class: `LOCAL_ONLY`;
- route: `local`.

The browser and Historical Ledger resolved to the same session identifier. This closes the presentation/client hydration mismatch that had previously made the header show a different random session ID from the one actually sent to Hub.

The real Local chat produced this Ledger sequence:

1. `seq=0` — `user.message`, target `local`, text `Balas singkat: SESSION_ID_SYNC_OK`;
2. `seq=1` — `model.called`, provider `local`, `requestModel=gemma4:latest`, `responseModel=gemma4:latest`, `pricingModel=local/provider-token-zero`, `routeReason=local-consolidation`, `actualUsd=0`, 210 input tokens and 350 output tokens;
3. `seq=2` — `agent.message`, assistant response `Acknowledged.`.

The hash chain continued without gaps from `seq=0` through `seq=2`.

## Real ECX plan

A real ECX plan was then created against the exact Historical Ledger range above:

- operation: `op_ecxreal20260911021216`;
- sender: `agent:ui-assistant`;
- intent: `verify-ledger-handoff`;
- need: `history`, `verification`;
- history reference: the source session, `afterSeq=-1`, `throughSeq=2`;
- hydration budget: 16,384 bytes;
- response mode: `delta`;
- candidates: one exact-capability ledger reviewer and one cheaper partial-capability generic reviewer;
- max recipients: 1.

The planner returned HTTP 200 and selected `agent:ledger-reviewer`, confirming capability overlap takes precedence over the cheaper partial match. The plan metrics were:

- candidates: 2;
- recipients/packets: 1;
- packet bytes: 478.

The selected packet kept the Historical Ledger payload pointer-first instead of embedding the referenced history inline.

## Real ECX hydration

The selected packet was hydrated with:

- `scope=personal`;
- `maxSensitivity=INTERNAL`;
- `hostedEligible=false`.

`hostedEligible=false` is required because the source Historical Ledger session is `LOCAL_ONLY`. Hydration returned HTTP 200 with:

- hydrated items: 1;
- hydrated bytes: 1,725;
- media type: `application/json`;
- the hydrated item pointing to the exact source session and `seq=0..2` range.

The request stayed on the local-eligible boundary; no hosted eligibility was granted to the `LOCAL_ONLY` history.

## Ledger provenance after ECX

The ECX plan appended one new provenance event atomically to the same Historical Ledger session:

4. `seq=3` — `agent.handoff`, actor `hub:exchange`, operation `op_ecxreal20260911021216`.

The handoff payload recorded the sender, selected recipient, task, need, history reference, budget and delta response mode. Its `prevHash` equals the `seq=2` assistant-event hash, so the chain continued through `seq=3` without a gap.

## Production-data evidence snapshot

After the real plan and hydration, `pnpm production:data-evidence` returned PASS with this local runtime snapshot:

- Historical Ledger: 8 sessions, 15 events;
- ECX plans: 1;
- ECX packets: 1;
- ECX packet bytes: 478;
- ECX hydrations: 1;
- ECX hydrated items: 1;
- ECX hydration bytes: 1,725;
- provider model calls: 1;
- provider input tokens: 210;
- provider output tokens: 350;
- provider cache-read tokens: 0;
- provider cache-write tokens: 0;
- provider actual cost: USD 0.

The command ended with:

`PASS production-data-evidence: real traffic exists across Historical Ledger, ECX, and provider telemetry boundaries`

This closes the defined local Historical Ledger + ECX evidence checkpoint.

## Claim boundary

This evidence proves real local traffic crossed all three required boundaries:

`Local browser/model traffic → Historical Ledger → ECX plan/handoff/hydration → observability counters`

It does **not** prove:

- ECX or optimizer savings versus an equivalent non-ECX workload;
- hosted-provider savings or quality;
- production latency or throughput;
- VPS durability, restart or backup behavior;
- Cloudflare production operation;
- a second model/agent actually executed the selected ECX packet.

The UI/ledger `naiveUsd` and counterfactual savings display remain comparative accounting against the configured naive hosted baseline. Public efficiency/savings claims still require representative comparative task telemetry.

## Related fixes and evidence

The session-ID mismatch discovered during this checkpoint was fixed in PR #36. The fix keeps the random session client-owned, renders a deterministic pre-hydration placeholder, uses the same client session ID for both the header and `/api/chat`, and adds regression coverage. Exact-head and post-merge CI passed.

See also:

- `docs/current-state-and-next-steps.md`;
- `docs/production-activation.md`;
- `docs/verification/local-production-rehearsal-2026-09-10.md`;
- `scripts/production-data-evidence.mjs`.
