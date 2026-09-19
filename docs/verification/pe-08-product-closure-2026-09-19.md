# PE-08 Product closure audit

Last updated: **2026-09-19**

Status: **ACTIVE / IMPLEMENTATION EVIDENCE PENDING**

PE-08 is the final Product Evolution closure batch. This record tracks the repository-side audit/evidence for PE-00 through PE-07 as one baseline. It does not authorize new product scope.

Acceptance contract: [../product-evolution-pe08-acceptance.md](../product-evolution-pe08-acceptance.md).

## Reviewed baseline

```text
PE-07 -> PE-08 transition PR    #179
transition merge main           82026c8a1948336b2da4e00ee4832180f68452f7
PE-08 branch                    pe/pe-08-product-closure-20260919
implementation head             pending
CI                              pending
Product Eval                    pending
relevant acceptance             pending
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

## Findings so far

No S0/S1 defect is claimed closed before exact-head gates execute.

The first material gap found by the audit is evidence composition: previous Product Evolution tests existed across normal CI, but PE-08 needs one explicit closure matrix and one integrated owner restore -> Brain rebuild drill. Those are the current branch changes.

## Remaining before closure candidate

- exact PE-08 implementation head CI;
- exact Product Eval with the full closure matrix;
- relevant acceptance workflow(s) triggered by the final diff;
- record real test totals and any reproducible defects/fixes;
- documentation convergence;
- closure-candidate exact-head gates;
- merge reviewed head.
