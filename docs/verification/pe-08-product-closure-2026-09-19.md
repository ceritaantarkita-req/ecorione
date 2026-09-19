# PE-08 Product closure audit

Last updated: **2026-09-19**

Status: **CLOSURE CANDIDATE / IMPLEMENTATION GATES PASS**

PE-08 is the final Product Evolution closure batch. This record tracks the repository-side audit/evidence for PE-00 through PE-07 as one baseline. It does not authorize new product scope.

Acceptance contract: [../product-evolution-pe08-acceptance.md](../product-evolution-pe08-acceptance.md).

## Reviewed baseline

```text
PE-07 -> PE-08 transition PR    #179
transition merge main           82026c8a1948336b2da4e00ee4832180f68452f7
PE-08 branch                    pe/pe-08-product-closure-20260919
implementation head             33f9e891c3152a82304d5f1e31693604c855d94c
CI                              35449548713 / #1469 PASS
Product Eval                    35449548657 / #708 PASS
dedicated MCP/Desktop workflow  not triggered by final implementation diff
```

## Closure audit matrix

| Boundary | Existing proof brought into the exact PE-08 matrix | PE-08 addition |
|---|---|---|
| Project foundation / migration | `services/hub/src/project-registry.test.ts`, `services/context/src/project-context.test.ts` | rerun under Product Eval closure matrix |
| Project Sources | `services/hub/src/project-source-registry.test.ts` | reopen/persistence rerun under closure matrix |
| Flow / Trigger Project isolation | `services/flow/src/graph-project-isolation.test.ts`, `services/flow/src/trigger-repository.test.ts` | rerun restart/isolation paths |
| Brain rebuild/isolation | `test/pe06-brain-owner-runtime.test.ts` | rebuild again from restored Product Evolution owner state |
| Brain -> Context -> ECX | PE-07 integration/security/eval suite | retained in Product Eval; no threshold weakened |
| Context backup/restore | `services/context/src/backup.test.ts` | combined with Hub + Flow owner restore |
| Local persistence evidence guards | `test/local-persistence-restart-evidence.test.mjs` | rerun as closure guard |
| Owner backup evidence guards | `test/local-backup-restore-evidence.test.mjs` | rerun as closure guard |
| UX/navigation | `test/local-ux-product-evidence.test.mjs` | Projects + Work + Brain remain required global surfaces |
| Work / Flow responsive behavior | `test/pe04-work-source-contract.test.ts`, `test/flow-responsive-source-contract.test.ts` | rerun under closure matrix |
| Windows installer specification | `test/desktop-installer.test.mjs` | rerun; dedicated Windows workflow only if final diff requires/triggers it |

## Integrated restore/rebuild drill

`test/pe08-product-closure.test.ts` exercises one deterministic Product Evolution state across canonical owners:

```text
Hub
  Project + Project Source
Context
  Project fact + provenance source URI
Flow
  Project Flow + Trigger
        |
        v
real owner SQLite backups
        |
post-backup mutations
        |
offline owner restore
        |
reopen canonical owners
        |
Brain rebuilt from restored owner data
```

Required assertions:

- Project metadata restores to the backed-up state;
- detached Project Source is restored;
- Context fact present at backup is restored;
- Context fact created after backup is absent after restore;
- backed-up Flow + Trigger return after reopen;
- Trigger created after backup is absent after restore;
- Brain is reconstructed from restored owner APIs/data structures;
- no Brain database or Brain backup is introduced.

## Security/isolation boundary

PE-08 keeps the existing negative tests in the closure matrix:

- sibling Project Context retrieval remains excluded;
- sensitivity + hosted egress rules remain intersected with Project scope;
- sibling Project subflow resolution is rejected;
- Brain owner runtime excludes sibling Project nodes;
- PE-07 Brain constraint remains an intersection after Context authorization;
- explicit empty Brain candidate set remains fail-closed;
- only Context-authorized refs become ECX refs.

No cross-service database read is introduced by PE-08.

## UX and runtime claim boundary

The repository closure matrix can prove deterministic source/UI contracts, route inventory guards, and responsive CSS/source invariants. It is **not** a real rendered browser walkthrough.

The existing runtime inventory remains a separate operator/runtime evidence boundary because it requires:

- synchronized clean local `main`;
- the local Phase 4 owner stack;
- local internal token;
- `ECORIONE_COST_KILL_SWITCH=1`;
- actual rendered HTTP surfaces.

PE-08 must not label CI/source evidence as a browser walkthrough.

## Installer boundary

PE-08 does not change desktop packaging/runtime inputs at this checkpoint. The Windows installer specification is rerun in the closure matrix and normal CI continues installer/toolchain policy checks.

If the dedicated Desktop Installer workflow is not triggered by the final PE-08 diff, the closure record must state that fact rather than inventing a Windows workflow result.

## Cost / deployment boundary

No hosted/provider call, paid benchmark, VPS/Cloudflare activation, DNS/tunnel mutation, AutoClick activation, or L4 autonomy is authorized for this closure.

## Implementation evidence

Exact implementation head `33f9e891c3152a82304d5f1e31693604c855d94c` passed the required repository gates:

```text
CI                              35449548713 / #1469 PASS
Product Eval                    35449548657 / #708  PASS
normal suite                    191 files PASS + 1 skipped
normal tests                    991 PASS + 2 skipped
Phase 4 process acceptance      2 files / 3 tests PASS
production-ops acceptance       PASS
Product Eval closure matrix     36 files / 148 tests PASS
secret scan                     PASS
dependency security review      PASS
GitHub Actions pin review       PASS
GitHub runner review            PASS
Node toolchain review           PASS (Node 22.20.0)
installer toolchain review      PASS (Inno Setup 6.7.1)
container image review          PASS
release security acceptance     PASS
production build                PASS
```

The explicit PE-08 integrated restore/rebuild test passed inside Product Eval. The dedicated MCP External HTTPS Acceptance and Desktop Installer workflows were not triggered by this final implementation diff; PE-08 does not invent those workflow results. Installer specification and Windows desktop acceptance tests still ran in normal CI, including `test/windows-desktop-installer-acceptance.test.mjs` and `test/desktop-installer.test.mjs`.

No S0/S1 closure defect remained on the implementation head. The one implementation-cycle failure was formatting-only on the new PE-08 test; the canonical Prettier output was applied and the temporary formatter helper was removed before the reviewed implementation head.

## Closure gate remaining

This documentation change creates the closure-candidate head. That exact head must pass CI + Product Eval and every workflow triggered by its final diff. PR #180 must then merge before PE-08 can be marked CLOSED / PASS.

Production VPS/Cloudflare, rendered local browser walkthrough, paid hosted evidence, AutoClick, L4 autonomy, and Brain persistence remain outside this repository closure claim.
