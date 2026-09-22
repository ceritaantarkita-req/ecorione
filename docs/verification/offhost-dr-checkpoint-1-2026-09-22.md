# Off-host DR checkpoint 1 — repository foundation — 2026-09-22

Status: **CLOSED / PASS AT REPOSITORY FOUNDATION / REAL-HOST DR NOT YET CLAIMED**

## Scope

The operator explicitly opened **Off-host Backup & DR** as the next infrastructure scope after latest-main staging convergence closed.

This checkpoint is intentionally separate from PE-09, PCS-11, Batch 13, production promotion, public-edge activation, paid-provider evidence, or a new product feature scope.

Baseline repository `main` when the branch was opened:

```text
428aec1454f08148c5b33be82d6d48820009dff5
```

Current proven SumoPod staging application identity at scope open:

```text
source SHA  52046db35e403babdda934881773c46bf2c57b68
image       staging-52046db35e40
```

The existing PCS-09 cold-backup proof for `0f332c73...` remains historical same-host evidence only and is not relabeled as current-revision off-host DR.

## Repository implementation

Checkpoint 1 adds:

- `scripts/staging-offhost-dr-bundle.mjs` — validates an existing PCS-09 backup and creates a portable AES-256-GCM encrypted bundle whose random data key is wrapped by an out-of-band RSA-OAEP/SHA-256 public key;
- `scripts/staging-offhost-dr-transfer.sh` — copies only the encrypted bundle and sidecar to an explicitly acknowledged independent SSH failure domain using strict known-host verification and remote SHA-256 verification;
- `scripts/staging-offhost-dr-verify.mjs` — verifies/decrypts the bundle on a separate host and can restore every archived volume into isolated temporary Docker volumes for deterministic fingerprint/file-count comparison;
- `test/offhost-dr-source-contract.test.ts` — locks the encryption, isolated-restore, transfer-integrity, and no-prune/no-`ssh-keyscan` source boundaries;
- `docs/offhost-dr-recovery.md` — documents key custody, off-host transfer, clean-host verification, total-host-loss drill, secret recovery, retention, and non-claims.

The private DR key is deliberately not required by the source-host bundler or transfer helper. It is needed only at the recovery boundary.

## Synthetic implementation check

Before repository publication, the bundle/verify implementation was exercised against a synthetic PCS-09-compatible fixture using a freshly generated RSA-3072 keypair.

The first streaming decrypt-to-`tar` attempt produced a valid implementation failure:

```text
Premature close
```

That path was not accepted as evidence. The verifier was changed to decrypt into a root-only temporary tar, validate the tar entry list, extract it, remove the plaintext tar, and clean the temporary directory on exit.

The corrected synthetic round trip then passed:

```text
PASS encrypted ECORIONE DR bundle created
PASS ECORIONE off-host DR bundle integrity verification
source_sha=52046db35e403babdda934881773c46bf2c57b68
source_tag=staging-52046db35e40
volumes=1
restore_boundary=encrypted bundle + embedded backup integrity verified; Docker restore not requested
```

Node syntax checks passed for both Node entrypoints and Bash syntax validation passed for the transfer helper.

PR #250 initial exact head `7696da4f612d8ef383646bfa70b44def61692950` then exposed a valid repository gate failure: CI #1760 stopped at the read-only Prettier format check and identified only the two new Node scripts plus the new source-contract test. The gate was not weakened. Those three files were rewritten by the repository's exact locked Prettier toolchain, and the temporary formatting helper removed itself from the final tree before final exact-head gates were rerun.

A later exact-head CI #1763 progressed through format, lint, and typecheck and then ran the normal test suite. It reported 1092 passed, 2 skipped, and one failed test: the new DR source-contract test looked for the literal text `archive SHA-256 mismatch`, while the implementation correctly constructs the message as `${archive} SHA-256 mismatch`. The implementation's archive hashing path was unchanged. The test was corrected to assert the actual `await sha256File(archivePath)` integrity path plus the `SHA-256 mismatch` failure boundary; the suite was not weakened or skipped.

This is implementation evidence only. It is **not** SumoPod runtime evidence and does not prove a real off-host copy or replacement-host recovery.

## Repository closure

PR #250 final exact head `9ad4946ed7fa4921c6c0cd8afdbaa312e9ab25e6` passed:

- CI #1765 — PASS;
- Product Eval #1004 — PASS;
- MCP External HTTPS Acceptance #921 — PASS;
- Desktop Installer #113 — PASS.

PR #250 then squash-merged to `main` as `3c5417dd44099f6c74f0bc832f4631e3fa295c8d`. Exact merged-main CI #1766, Product Eval #1005, and MCP External HTTPS Acceptance #922 all passed. Staging Deploy #308/#309 each passed their gate and skipped deploy because staging activation remained disabled, so this repository closure did not mutate the proven SumoPod runtime.

Checkpoint 1 is therefore CLOSED / PASS at the repository-foundation boundary.

## Remaining real-host gates

Checkpoint 1 remains open until real infrastructure evidence proves:

1. fresh cold backup from the current staging revision;
2. encrypted DR bundle from that exact backup;
3. transfer to a failure domain independent of SumoPod;
4. checksum match on the remote retained copy;
5. retrieval of that copy without using the source host;
6. clean-host decrypt + `--verify-docker` restore of every real owner volume;
7. exact-source application rebuild using recorded Git identity and separately recovered secrets;
8. healthy application/auth/Operations/exact-host state after recovery plus restart persistence;
9. sanitized recovery timestamps and bounded RPO/RTO evidence.

## Explicit non-claims

At this checkpoint:

- no current-revision SumoPod backup has been copied off-host;
- no independent backup target has been accepted as evidence;
- no private DR key is stored in Git;
- no current staging volumes were destructively restored;
- no replacement VPS has recovered the actual staging state;
- total-host-loss recovery remains **NOT PROVEN**;
- production promotion remains deferred.

The safe resumable handoff is the repository foundation plus runbook above. The next mutation should begin at the fresh current-revision PCS-09 cold-backup gate, not by editing live staging state manually.
