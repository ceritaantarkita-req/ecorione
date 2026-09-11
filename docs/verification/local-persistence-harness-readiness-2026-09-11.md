# Local Persistence / Restart Harness Readiness — 2026-09-11

Status: **REPOSITORY HARNESS READY / RUNTIME RESTART EVIDENCE NOT STARTED**

This note records repository-side readiness for the operator-approved local persistence/restart checkpoint. It does **not** claim that persistence has survived a real restart yet.

## Scope

The checkpoint is local-first and post-closure. It is not Batch 13 and it does not resume compute-host/VPS or Cloudflare deployment.

The intended runtime proof covers:

- Hub Historical Ledger identity + hash-chain verification;
- Context episode identity + digest;
- Artifact identity + byte digest;
- the same Temporal-backed Flow remaining `RUNNING` while waiting on the same Hub approval;
- the same approval remaining `PENDING` with the same operation identity;
- controlled restart of only explicitly identified ECORIONE-owned boundaries.

## Repository implementation

### PR #43 — base harness

Merged revision: `47ebb8b5430396dc2968445dfb56998f98e009b3`

Added:

- read-only inventory/preflight;
- baseline owner-API probes for Hub, Context, Artifact and Flow;
- post-restart identity/content checks;
- dedicated Flow cleanup;
- raw evidence under gitignored `.ecorione/evidence/`;
- safety rules that prohibit global Docker stop/prune and cross-service direct database access.

### PR #44 — strict evidence hardening

Merged revision: `3319f140379c455446bade50c80aadcca5b0ecc7`

The strict wrapper became the canonical `evidence:persistence-restart` command and now fails closed unless:

- baseline Flow status is exactly `RUNNING`;
- baseline and post-restart Hub approval status is exactly `PENDING`;
- approval `operationId` is unchanged;
- Ledger baseline `headHash` is present and matches the single probe event;
- Ledger post-restart `eventHash`, `headHash`, and `nextSeq` retain the exact baseline identity;
- Context episode identity/digest is unchanged;
- Artifact identity/digest is unchanged;
- Flow identity is unchanged and Temporal still reports it `RUNNING`;
- cleanup ends in a terminal Flow state.

The original harness remains available only as `evidence:persistence-restart:raw` for diagnostics. It is not the closure gate.

## Repository verification

Post-merge checks on `3319f140379c455446bade50c80aadcca5b0ecc7`:

- CI push run `34576180542`: **PASS**
  - naming;
  - format;
  - lint;
  - typecheck;
  - test;
  - Phase 4 real-process acceptance;
  - production operations acceptance;
  - secret scan;
  - production build.
- MCP External HTTPS push run `34576180562`: **PASS**.

No runtime evidence was manufactured from CI. These checks prove the harness/repository gates, not laptop restart persistence.

## Runtime entry gate

Before mutation, the laptop must be synchronized to the then-current reviewed `main`, have a clean tracked tree, and run:

```bash
pnpm evidence:persistence-restart:inventory
```

The inventory output must identify the exact ECORIONE Phase 4 process boundary and exact ECORIONE-owned Temporal/PostgreSQL containers before any stop/restart command is selected.

Only then may the runtime sequence advance to:

```bash
pnpm evidence:persistence-restart --phase baseline
# operator-controlled restart of only the reviewed ECORIONE boundary
pnpm evidence:persistence-restart --phase post
pnpm evidence:persistence-restart --phase cleanup
```

## Claim boundary

Until the real laptop sequence is executed, the correct status is:

> **repository harness ready; local persistence/restart runtime evidence pending**

Do not call the checkpoint PASS, do not claim PostgreSQL-container durability unless PostgreSQL itself is actually included in the reviewed restart boundary, and do not treat reset process-local metrics/caches as durable-state defects.
