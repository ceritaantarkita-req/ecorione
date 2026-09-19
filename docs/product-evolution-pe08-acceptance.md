# PE-08 acceptance contract

Last updated: **2026-09-19**

Status: **REQUIRED FOR PE-08 CLOSURE**

PE-08 is the Product Evolution closure batch. Its job is to prove that PE-00 through PE-07 form one clean, reproducible, isolated product baseline. PE-08 is not a feature-expansion batch.

## Goal

```text
PE-00..PE-07 reviewed product
-> migration/cross-batch audit
-> Project isolation/security audit
-> restart/persistence verification
-> backup/restore/rebuild verification
-> runtime/UX regression
-> documentation convergence
-> exact-head closure
```

## Scope boundary

Allowed work:

- audits and deterministic closure evidence;
- regression tests;
- fixes for reproducible defects that block the closure gates;
- documentation cleanup/convergence;
- archival of superseded planning snapshots when current docs already replace them.

Not authorized by PE-08:

- new product domains or major features;
- graph database or Brain persistence;
- second scheduler/retriever/execution owner;
- L4 autonomy;
- new paid hosted evidence;
- production VPS/Cloudflare activation;
- AutoClick;
- broad redesign unrelated to a verified closure defect.

If a material feature is needed to solve a closure defect, stop and record that the roadmap is not actually ready to close rather than hiding the feature inside PE-08.

## Cross-batch migration audit

PE-08 must verify the migration/compatibility chain introduced by Product Evolution:

- Personal default Project remains valid;
- legacy/ambiguous records retain their documented migration/quarantine behavior;
- Project metadata and source bindings remain owner-consistent;
- Context global + current-Project semantics remain intact;
- Flow/Trigger/Run Project scoping remains consistent;
- Brain remains rebuildable from canonical owners;
- PE-07 Brain narrowing remains optional and fail-closed;
- no cross-service database shortcut was introduced.

Audit findings must be classified. Any S0/S1 closure blocker must be fixed or PE-08 fails.

## Project isolation and security audit

Required negative checks include:

- Project A cannot retrieve Project B memory implicitly;
- Project A cannot infer protected Project B Brain nodes/edges;
- cross-Workspace Project access fails closed;
- Project Source validation still uses canonical owner boundaries;
- Trigger/Flow/Run lookup cannot escape Workspace/Project scope;
- Brain candidate constraints cannot bypass Context policy;
- ECX receives only Context-authorized refs;
- invalidated/sensitivity/syncClass/trust rules remain binding;
- memory/external content stays untrusted data rather than instructions;
- no provider secret or production credential enters repository evidence.

No unresolved cross-Project leakage is allowed at closure.

## Restart and persistence verification

PE-08 must exercise the existing local restart/persistence boundary for durable owners touched by Product Evolution.

The evidence must distinguish:

- durable canonical state that must survive restart;
- derived/rebuildable state such as Brain that should be reconstructed rather than persisted.

A restart PASS must show that Project-aware state is still readable and correctly isolated after restart. Do not convert derived projections into persistence merely to make this test easier.

## Backup / restore / rebuild verification

Use existing owner backup/restore and rebuild mechanisms where applicable.

At minimum, verify the closure meaning for:

- Hub-owned Project metadata/bindings;
- Context Project-aware memory;
- owner state required to reconstruct Flow/Trigger/Run views;
- Brain reconstruction from restored canonical owners.

A Brain backup is not required because Brain is not canonical durable state. Its closure requirement is deterministic rebuild from restored owner data.

## Runtime and installer regression

Normal CI must keep toolchain/installer policy green.

If PE-00..PE-07 changed files that materially affect packaged Windows runtime behavior, run the relevant Windows/Desktop installer acceptance before PE-08 closure. If no dedicated installer workflow is triggered or required by the final diff, document that fact rather than inventing evidence.

Production deployment remains optional and separately activated.

## UX / responsive walkthrough

PE-08 must cover the Product Evolution surfaces as one product, not isolated screenshots:

```text
Projects
Work / Schedule / Flows / Runs
Brain
Space
Operations
Settings
```

Required checks:

- primary navigation remains reachable;
- Project selection is consistent across Project-aware surfaces;
- no obvious horizontal/page overflow regression at supported narrow layout breakpoints;
- empty/degraded/error states remain explicit;
- canonical owner navigation from Brain/Work still resolves to the owner surface;
- no closure-critical broken route or stale primary label remains.

Use deterministic UI/source tests and existing UX inventory. A real browser walkthrough may supplement them when available, but source-only evidence must not be mislabeled as a real browser run.

## Eval governance

The PE-07 repair that adds `evals/**/*.test.ts` to Vitest discovery is part of the baseline.

PE-08 must ensure:

- governed eval manifests stay within the permanent repository case budget;
- Product Eval actually executes the intended eval files;
- stale provenance is not reintroduced;
- no gate is weakened to manufacture PASS.

## Documentation convergence

At closure, current documents must tell one state:

- PE-00 through PE-08 CLOSED at their documented boundaries;
- no active Batch 13;
- production VPS/Cloudflare remains deferred unless separately activated;
- AutoClick remains deferred;
- current work plan contains no stale PE implementation queue.

Historical verification files remain immutable evidence except for the active PE-08 closure record itself. Superseded planning snapshots may be archived, not rewritten as if they were never current.

## Required evidence

PE-08 closure evidence must record:

- reviewed exact commit;
- cross-batch audit result and any defects fixed;
- Project-isolation/security result;
- restart/persistence result;
- backup/restore/rebuild result;
- UX/runtime/installer result;
- normal test totals;
- CI run;
- Product Eval run;
- every relevant acceptance workflow;
- explicit deferred/optional production boundary.

## Closure gates

PE-08 is CLOSED / PASS only when all are true:

- no S0/S1 blocker;
- no unresolved cross-Project leakage;
- cross-batch migration audit passes;
- restart/persistence evidence passes;
- backup/restore/rebuild evidence passes;
- UX/runtime regressions required by the final diff pass;
- CI + Product Eval + relevant acceptance are green on the exact reviewed head;
- current docs converge on one state;
- production deployment remains separate unless explicitly activated.

## Claim boundary

PE-08 closes the repository/product baseline at the tested boundaries. It does not prove universal model quality, universal optimizer savings, production-host readiness on an untested target host, or safety outside the documented policy/test surfaces.
