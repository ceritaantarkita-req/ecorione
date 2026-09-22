# Off-host DR checkpoint 7 — marker-before-fetch enforcement — 2026-09-22

Status: **IMPLEMENTED / REPOSITORY GATES PENDING / REAL-HOST DR STILL PENDING**

## Scope

Checkpoints 1–6 are CLOSED / PASS at repository boundaries.

Checkpoint 6 created an immutable loss-marker receipt and final closure evidence consumed it, but the independent-fetch script itself did not require that marker. An operator could therefore fetch a retained generation first and create the marker later, making measured RTO start later than the actual recovery activity.

Checkpoint 7 closes that enforcement gap.

This remains inside the explicitly authorized **Off-host Backup & DR** workstream. It is not PCS-11, PE-09, Batch 13, production promotion, public-edge activation, or a feature batch.

## Marker-before-fetch enforcement

`scripts/staging-offhost-dr-fetch.sh` now requires:

```text
--apply <destination-dir> <export-manifest.receipt.env> <loss-marker.json>
```

Before any destination artifact is fetched it requires the loss marker to:

- already exist;
- be a regular non-symlink file;
- be mode 0600;
- contain valid JSON;
- use schema version 1;
- use kind `ecorione-offhost-dr-loss-marker`;
- contain a UUID-v4 drill ID;
- contain a valid UTC `declaredAt`;
- bind the exact requested export-manifest filename;
- use `clockSource=recovery-host-system-utc`;
- not declare a timestamp in the future.

Only after that validation does fetch record a millisecond-resolution `retrieval_started_at` and perform the first SCP.

The marker declaration must be <= retrieval start.

## Retrieval receipt

Successful fetch now records:

```text
retrieval_started_at=
retrieved_at=
loss_marker_filename=
loss_marker_sha256=
loss_marker_drill_id=
loss_marker_clock_source=
loss_declared_at=
```

alongside the existing export-manifest and artifact filenames/hashes.

This makes the retrieval receipt itself prove that the selected marker existed and matched the selected generation before independent retrieval began.

## Restore and acceptance propagation

The guarded real-volume restore now rejects retrieval receipts unless they contain a valid marker-bound chain:

- safe loss-marker filename;
- SHA-256;
- UUID-v4 drill ID;
- recovery-host clock source;
- loss declaration timestamp;
- retrieval-start timestamp;
- retrieval-complete timestamp;
- chronology `loss <= retrieval start <= retrieval complete`.

The restore receipt propagates those fields.

Application acceptance then requires and propagates the same marker-bound fields into the acceptance receipt.

## Final closure cross-binding

`staging-offhost-dr-closure-evidence.mjs` now cross-checks the actual mode-0600 loss-marker file against:

- retrieval receipt;
- restore receipt;
- final acceptance receipt.

All of the following must match:

- marker filename;
- marker SHA-256;
- drill ID;
- clock source;
- loss declaration timestamp;
- retrieval-start timestamp;
- retrieval-complete timestamp.

Closure chronology additionally requires:

```text
successful export
 <= loss marker
 <= independent retrieval start
 <= independent retrieval completion
 <= recovery start
 <= data ready
 <= application ready
 <= changed-boot-id final acceptance
```

Final sanitized timing evidence adds:

```text
retrievalStartDelaySeconds
```

in addition to retrieval-ready/data-ready/application-ready/final-recovery RTO milestones.

## Behavioral/source-contract coverage

Checkpoint 7 updates the deterministic closure-evidence fixtures so marker identity and timing propagate through retrieval -> restore -> acceptance.

The successful fixture proves:

- marker-bound receipt equality;
- `retrievalStartDelaySeconds`;
- existing RPO/RTO calculations remain deterministic.

Negative fixtures continue to prove:

- selected-generation mismatch is rejected;
- impossible loss/export chronology is rejected.

Source-contract coverage locks:

- loss marker is validated before the first manifest fetch;
- fetch usage requires the marker;
- marker SHA/drill/timing fields exist in retrieval evidence;
- restore rejects unbound/invalid retrieval chronology;
- acceptance propagates marker identity;
- final closure cross-binds all marker fields;
- fetch remains strict-host-key and never uses `ssh-keyscan`.

## Current non-claims

Checkpoint 7 does **not** prove:

- final exact-head repository gates yet;
- a newer governed SumoPod deployment;
- a real marker-before-fetch execution;
- a real independent retrieval;
- measured real-host RPO/RTO;
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
6. target audit/report and retained-generation selection;
7. create the immutable loss marker;
8. run the updated marker-required fetch using that exact marker;
9. restore + acceptance + reboot proof;
10. generate marker-bound closure timing evidence;
11. require retention `--check` once the policy minimum exists.

No workflow bypass or real-host mutation is performed by checkpoint 7 repository work.
