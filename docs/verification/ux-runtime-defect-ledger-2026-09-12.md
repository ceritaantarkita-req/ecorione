# UX Runtime Defect Ledger — 2026-09-12

Status: **IN PROGRESS — FIRST REAL-LAPTOP FINDINGS RECORDED**

This ledger records findings produced only after the synchronized real-laptop UX checkpoint began. It does not rewrite the static S0–S3 ledger and it does not claim rendered UX closure.

Tested starting revision: `4329586bbd78df5bd7b2539ca0bfe03120c2a67e` (`HEAD == origin/main` at the start of the run). Hosted calls remained bounded by `ECORIONE_COST_KILL_SWITCH=1`.

Raw screenshots, terminal output and machine-specific details remain local. Only sanitized observations are recorded here.

| ID | Severity | Surface | Reproduction | Expected | Observed | Disposition |
|---|---|---|---|---|---|---|
| UX-RUNTIME-001 | S2 | inventory `/ops` surface marker | Run `pnpm evidence:ux:inventory` against the rendered Phase 4 stack | The inventory recognizes the visible Operations heading `Runtime health & telemetry` | Browser rendered the heading, but the inventory rejected the page because SSR HTML encoded `&` as `&amp;` while the harness required a literal raw-text match | **FIXED IN BRANCH** — surface validation now accepts the HTML-escaped form while preserving framework-error rejection; regression added |
| UX-RUNTIME-002 | S2 | `/ops` fleet health | Run canonical local `pnpm dev:phase4` and open Operations | Required Phase 4 owners determine fleet health; services outside that stack must not silently make the fleet degraded | `Sync` was probed as if required even though `dev:phase4` does not start Sync, so the rendered fleet could be reported `Degraded` solely because optional Sync was absent | **FIXED IN BRANCH** — Ops response marks Sync optional, required owners alone determine fleet health, and UI labels unavailable Sync as `OPTIONAL DOWN`; regression added |
| UX-RUNTIME-003 | S2 | operator preflight / Ops auth | Follow the runtime checklist from a fresh WSL shell | Phase 4 and the inventory inherit the configured internal service token without exposing its value | The checklist did not explicitly instruct sourcing the root `.env`; Operations therefore surfaced `ECORIONE_INTERNAL_TOKEN belum dikonfigurasi untuk ops aggregation` when Phase 4 was started from a shell that only exported the cost kill switch | **FIXED IN BRANCH** — checklist now requires sourcing root `.env` in both Phase 4 and inventory shells, re-asserting the kill switch afterwards; inventory also fails early if the token is absent |

## Current claim boundary

These three findings are real runtime/protocol defects discovered before the formal UX-01..UX-12 walkthrough could begin. Their source-side fixes still require exact-head CI, merge, laptop synchronization to the new `origin/main`, and a fresh inventory run before any finding can be marked runtime-verified.

No rendered UX PASS is claimed yet. Additional runtime findings may be added or existing findings reopened during the subsequent walkthrough.
