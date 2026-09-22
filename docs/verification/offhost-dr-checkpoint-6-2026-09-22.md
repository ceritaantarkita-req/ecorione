# Off-host DR checkpoint 6 — immutable loss-marker provenance — 2026-09-22

Status: **CLOSED / PASS AT REPOSITORY BOUNDARY / REAL-HOST DR STILL PENDING**

## Scope

Checkpoints 1–5 are CLOSED / PASS at repository boundaries.

Checkpoint 6 hardens the remaining timing-evidence provenance boundary. Checkpoint 5 could compute conservative RPO and staged RTO only after the operator supplied a free-form `loss_declared_at` timestamp to the closure-evidence command. That was explicit and deterministic, but it still allowed copy/paste error or retroactive timestamp selection.

Checkpoint 6 replaces that free-form timestamp with an immutable local loss-marker receipt created at the start of the recovery drill.

This remains inside the already-authorized **Off-host Backup & DR** workstream. It is not PCS-11, PE-09, Batch 13, production promotion, public-edge activation, or a feature batch.

## Loss marker

Checkpoint 6 adds:

```text
scripts/staging-offhost-dr-loss-marker.mjs
```

The operator creates the marker after selecting the retained export generation and at the moment the source host is declared unavailable for the drill:

```bash
node scripts/staging-offhost-dr-loss-marker.mjs \
  --manifest-name ecorione-dr-<timestamp>-<sha12>.receipt.env \
  --output /var/lib/ecorione-dr/recovery-loss-marker.json
```

The marker:

- validates that the selected generation is one safe `ecorione-dr-*.receipt.env` filename;
- refuses paths and traversal-like manifest inputs;
- records current recovery-host UTC time internally;
- generates a UUID drill identifier;
- binds the marker to the exact selected export-manifest filename;
- records `clockSource=recovery-host-system-utc`;
- writes one mode-0600 JSON receipt with `flag: wx`;
- refuses overwrite of an existing receipt or symlink target.

It does not accept a user-supplied timestamp.

## Closure-evidence binding

`scripts/staging-offhost-dr-closure-evidence.mjs` now requires:

```text
--loss-marker <json>
```

instead of:

```text
--loss-declared-at <iso8601>
```

The closure generator requires the loss marker to be a regular mode-0600 file and validates:

- schema version 1;
- marker kind `ecorione-offhost-dr-loss-marker`;
- UUID-shaped drill ID;
- UTC declaration timestamp;
- selected export-manifest filename;
- clock-source marker.

The selected manifest recorded by the loss marker must exactly match the retrieved export manifest used by closure evidence.

The final sanitized evidence also records:

- drill ID;
- loss-marker filename;
- SHA-256 of the loss-marker receipt;
- clock source;
- loss declaration timestamp from the receipt.

The previous direct free-form timing argument is removed from the closure path.

## RPO/RTO boundary

Checkpoint 6 does not claim that a software receipt can independently prove a physical host was lost.

It proves a narrower and useful operational fact:

> the measured recovery timeline for one drill is bound to one immutable local receipt created at the operator-declared start of that drill and to one selected retained generation.

Conservative RPO remains:

```text
semantic-canary backup boundary -> loss-marker declaredAt
```

RTO milestones remain:

```text
loss-marker declaredAt
 -> independent retrieval ready
 -> data ready
 -> application ready
 -> final changed-boot-ID acceptance
```

These measurements remain evidence for one drill, not a production SLA.

## Behavioral coverage

Checkpoint 6 adds behavioral tests that require the loss-marker tool to:

- create a parseable receipt;
- bind the selected manifest;
- write mode 0600;
- use a declaration time inside the actual command execution window;
- refuse overwrite;
- reject path-like/unrelated manifest inputs.

Existing closure-evidence tests now use deterministic mode-0600 loss-marker fixtures rather than free-form CLI timestamps.

Source-contract tests lock:

- `randomUUID`;
- marker kind;
- selected-manifest binding;
- system-UTC clock source;
- mode 0600 + `wx`;
- overwrite refusal;
- absence of the legacy free-form `loss-declared-at` argument;
- closure binding to marker filename/hash/timestamp.

## Repository gate history

PR #258 initial candidate reached CI #1854, which passed naming but stopped at the read-only Prettier format gate on exactly:

```text
scripts/staging-offhost-dr-closure-evidence.mjs
test/offhost-dr-loss-marker.test.ts
```

No gate was bypassed or weakened. The repository's locked Prettier toolchain formatted only those two files through a temporary self-removing workflow. That formatter completed successfully and removed itself; the formatter result head was:

```text
928cacd9cef47b040761aa3d6e9fa08449b0ae37
```

The final exact-head CI/Product Eval/MCP/Desktop gates must rerun after this normal evidence commit.

## Repository closure

Checkpoint 6 implementation closed through PR #258.

```text
PR exact head       b8379a2c756e2e4ea3e00424c360072b6a910829
CI                  #1857 PASS
Product Eval        #1096 PASS
MCP HTTPS           #1001 PASS
Desktop Installer   #188 PASS
merge main          cb043b47a2c899e3c0585b06db4992fcc727c723
merged-main CI      #1858 PASS
merged-main Product #1097 PASS
merged-main MCP     #1002 PASS
Staging Deploy      #480 gate PASS / deploy SKIPPED
Staging Deploy      #481 gate PASS / deploy SKIPPED
```

Both post-merge Staging Deploy triggers kept the deploy job skipped. Checkpoint-6 repository closure therefore did **not** change the SumoPod runtime.

## Current non-claims

Checkpoint 6 does **not** prove:

- final exact-head repository gates yet;
- a newer governed SumoPod deployment;
- a real source-loss declaration;
- a real off-host export;
- real independent retrieval;
- real-host RPO/RTO;
- total-host-loss recovery.

Those remain runtime evidence boundaries.

## Safe resumable handoff

Repository-side:

1. require exact-head CI + Product Eval + relevant acceptance gates;
2. merge only the reviewed head;
3. require merged-main gates;
4. converge canonical docs with exact identities.

Runtime-side after repository closure:

1. governed deploy exact reviewed current `main`;
2. freeze staging CD;
3. source readiness;
4. independent-target readiness;
5. fresh off-host export;
6. target audit/report and generation selection;
7. create immutable loss marker **before independent fetch**;
8. fetch selected generation;
9. restore on clean replacement host;
10. application acceptance;
11. changed-boot-ID post-reboot acceptance;
12. generate closure timing evidence using `--loss-marker`;
13. run retention `--check` once the policy minimum exists.

No workflow bypass or real-host mutation is performed by this checkpoint.
