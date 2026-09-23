# DR-2 checkpoint 1 closure — 2026-09-23

Status: **CLOSED / PASS — REPOSITORY FOUNDATION**

Issue: #277

## Scope

Checkpoint 1 establishes provider-neutral repository tooling for a future physically independent ECORIONE disaster-recovery drill. It does not select or contact an external target and does not modify the already-closed Issue #266 SumoPod host-loss evidence.

## Reviewed implementation

PR #278:

```text
exact_head=200f050bc74072ebe5f0945aec82b353201e70fe
merge_main=4d1f4ef82839c74cc1ca8454511405a68424f0b7
```

Exact-head gates:

```text
CI #1913 PASS
Product Eval #1152 PASS
MCP External HTTPS Acceptance #1011 PASS
Desktop Installer #197 PASS
```

Merged-main gates:

```text
CI #1914 PASS
Product Eval #1153 PASS
MCP External HTTPS Acceptance #1012 PASS
Staging Deploy #591 PASS
Staging Deploy #592 PASS
```

## Delivered tooling

Checkpoint 1 merged:

- `scripts/staging-dr2-host-evidence.mjs`;
- `scripts/staging-dr2-physical-independence-preflight.mjs`;
- `test/offhost-dr2-physical-independence.test.ts`;
- package commands for DR-2 host-evidence capture and physical-independence preflight;
- `docs/offhost-dr-physical-independence.md`;
- current-state and active-work-plan convergence.

## Evidence and privacy behavior

The host-evidence tool:

- supports `backup-target` and `replacement-host` roles;
- hashes `/etc/machine-id` rather than storing the raw value;
- hashes the DMI/system UUID when available rather than storing the raw value;
- records a sanitized operator-defined failure-domain label;
- writes a mode-0600 receipt;
- refuses overwrite;
- records virtualization, OS ID, kernel release and architecture as sanitized metadata;
- explicitly states that host hashes alone do not prove physical independence.

The physical-independence preflight:

- requires `ECORIONE_DR_PHYSICAL_INDEPENDENCE_ACK=1`;
- requires fresh mode-0600 evidence receipts;
- rejects matching failure-domain labels;
- rejects matching machine-id fingerprints;
- rejects matching system UUID fingerprints when both are present;
- requires system UUID fingerprints when both hosts report WSL virtualization;
- writes a mode-0600 non-overwriting preflight receipt;
- explicitly states that the preflight is not final DR-2 recovery proof.

## Deterministic contract coverage

The DR-2 tests cover:

- successful distinct-domain preflight;
- matching-machine rejection;
- reused failure-domain rejection;
- missing operator attestation rejection;
- two-WSL system-UUID requirement;
- preflight receipt overwrite refusal.

The exact reviewed PR passed the normal repository CI, Product Eval, MCP External HTTPS, and Desktop Installer gates.

## Non-claims

Checkpoint 1 does **not** prove physical independence.

It also does not prove:

- external target custody;
- external target storage durability;
- fresh-generation export to a new failure domain;
- independent retrieval from that new target;
- clean-host restore from that new target;
- changed-boot-ID persistence for a DR-2 generation;
- provider/account-wide recovery;
- production RPO/RTO SLA.

## Next gate

Checkpoint 2 is an operator decision: select a genuinely external backup target outside the physical/storage failure domain of the replacement recovery compute.

No paid or external infrastructure should be provisioned merely from this repository closure without that explicit operator choice.

Once a target is selected, the next technical gate is fresh host-evidence capture on both real hosts followed by the DR-2 physical-independence preflight.
