# Off-host DR checkpoint 3 — standalone replacement-host recovery boundary — 2026-09-22

Status: **IMPLEMENTED / REPOSITORY GATES PENDING / REAL-HOST DR STILL PENDING**

## Scope

Checkpoint 1 closed the encrypted portable-backup foundation. Checkpoint 2 closed the repository execution/recovery tooling through PR #251 / merge `768c0f617064343f0bfc569d52212c80a03f0b83`.

Checkpoint 3 removes an invalid total-host-loss assumption that still existed in the operator procedure: a clean replacement host must not depend on the lost SumoPod host's operator-owned Traefik network `inmydraft-demos_web`, public DNS, or public TLS merely to prove that ECORIONE data/application recovery works.

This checkpoint remains part of the explicitly opened **Off-host Backup & DR** workstream. It is not PCS-11, PE-09, Batch 13, production promotion, Cloudflare/public cutover, or a feature batch.

## Recovery-boundary model

The replacement-host proof is now split deliberately:

```text
off-host retrieval
 -> clean-host preflight
 -> isolated restore verification
 -> exact project-volume restore
 -> exact-source application start
 -> loopback-only Caddy policy boundary
 -> semantic owner-data canary
 -> authenticated Operations
 -> exact-host evidence
 -> full host reboot
 -> repeat loopback/semantic/Ops/host evidence
 -> total-host-loss recovery candidate

public DNS / public TLS / Cloudflare
 -> separate later edge/promotion gate
```

A DR claim therefore no longer requires the replacement host to impersonate the lost SumoPod public edge during the recovery drill.

## Repository implementation

Checkpoint 3 adds:

- `deploy/compose.dr-recovery.yml`
  - overrides the base Caddy host publications;
  - publishes only `127.0.0.1:${ECORIONE_DR_LOOPBACK_PORT:-18080}:8080`;
  - reuses the reviewed `Caddyfile.sumopod` policy/routing boundary;
  - attaches Caddy only to the ECORIONE internal network;
  - contains no Traefik labels and no dependency on `inmydraft-demos_web`;
  - does not publish host ports 80/443.

- `scripts/staging-offhost-dr-replacement-preflight.sh`
  - requires retrieved DR metadata + verified retrieval receipt;
  - requires metadata/receipt/deployment-env mode 0600;
  - requires exact recovered Git SHA and clean tracked worktree;
  - refuses inherited `ECORIONE_EDGE_NETWORK`;
  - refuses any existing Compose project container or project-labelled volume;
  - refuses an already-used loopback recovery port;
  - runs the existing production preflight against the recovery overlay;
  - parses rendered `docker compose config --format json`;
  - requires exactly one Caddy publication: loopback host -> configured recovery port -> container 8080;
  - refuses public 80/443 publication or the historical SumoPod edge network;
  - creates no containers and no volumes.

- `scripts/staging-offhost-dr-local-smoke.mjs`
  - accepts HTTP only when the base URL is loopback;
  - checks home reachability + security headers;
  - requires unauthenticated `/ops` and `/settings` to remain HTTP 401;
  - verifies MCP protected-resource metadata keeps the reviewed external HTTPS resource identity;
  - verifies the unauthenticated MCP challenge still advertises the configured protected-resource metadata URL and `memory:read`;
  - does not claim public Internet reachability.

- `scripts/staging-offhost-dr-start.sh`
  - supports explicit standalone recovery mode;
  - when `ECORIONE_DR_STANDALONE_RECOVERY=1`, requires `deploy/compose.dr-recovery.yml`;
  - refuses `ECORIONE_EDGE_NETWORK` in standalone mode;
  - preserves the existing failed-start cleanup rule: remove attempted containers/network, never restored volumes.

- `scripts/staging-offhost-dr-acceptance.mjs`
  - keeps existing `public` acceptance mode;
  - adds explicit `loopback` DR mode;
  - loopback mode requires the recovery overlay and no external edge network;
  - uses the local DR smoke plus authenticated Operations over loopback;
  - still requires semantic Ledger/Context/Artifact canary, exact source/image, all services running, restored-volume presence, and sanitized host evidence;
  - records the edge mode in the acceptance receipt.

- `scripts/staging-offhost-dr-reboot-evidence.mjs`
  - requires the post-reboot mode to match the pre-reboot acceptance receipt;
  - repeats loopback smoke + authenticated Operations + semantic canary after a changed Linux boot ID;
  - preserves the existing exact source/image, project volume, and Connect durable-file fingerprint checks.

## Public-edge non-claim

Checkpoint 3 intentionally does **not** prove:

- that public DNS points at the replacement host;
- that a public TLS certificate can be issued/renewed there;
- that Cloudflare or another edge is active;
- that SumoPod's historical Traefik network exists;
- that the replacement host is production.

Those remain separate from the host-loss recovery claim.

## Runtime activation prerequisite

The current proven SumoPod runtime remains the earlier reviewed application revision until a new governed staging deployment proves otherwise.

Checkpoint 2 merged as `768c0f617064343f0bfc569d52212c80a03f0b83`; merged-main CI/Product Eval/MCP gates passed, while Staging Deploy #372/#373 passed their gate and skipped the deploy job because `ECORIONE_STAGING_CD_ENABLED` remained disabled.

Checkpoint 3 must itself merge and pass exact merged-main gates before real DR evidence begins. Then the exact checkpoint-3 merge must be deployed through the existing PCS-08 forced-command GitHub -> SumoPod path. The staging CD variable should be enabled only for that controlled deployment and frozen again immediately after PASS.

The currently available GitHub connector can read workflow state and merge reviewed PRs but does not expose repository-variable mutation or workflow-dispatch actions. The safety gate must **not** be bypassed by editing the workflow to force a deployment.

## Repository gate history

PR #252 exact head `e13fbf7b4d747b02135594e242dfc914b7913cf5` passed Product Eval #1057 and the CI read-only format + naming gates, but CI #1818 stopped at lint before typecheck/test. ESLint reported one checkpoint-3 defect in `scripts/staging-offhost-dr-local-smoke.mjs`: bare `AbortController` violated the repository Node/global contract (`no-undef`). The implementation now uses `globalThis.AbortController`, matching the existing repository public-smoke pattern. No lint rule or CI gate was weakened.

A new exact-head CI run is required before merge.

## Current non-claims

At this checkpoint:

- no checkpoint-3 repository gate has yet been accepted;
- no checkpoint-3 source has been deployed to SumoPod;
- no independent off-host generation has been created from the real staging volumes;
- no replacement host has been provisioned;
- no real retrieval/restore/reboot drill has run;
- total-host-loss recovery remains **NOT PROVEN**.

## Repository gate history

PR #252 initially opened at exact head `17e3ac85a8876c071daafb000eb5fdf677bb2b7f`. CI #1801 exposed a valid naming-gate failure before the normal verify path could be accepted. The two offending literals were both checkpoint-3 additions:

- the local smoke example used the historical deployment domain in executable source;
- the source-contract test named the historical external Docker network directly.

Neither literal was required for recovery behavior. The executable example was changed to a neutral example domain and the test was rewritten to assert the generic invariant that the recovery overlay has no external network. The naming rule was not weakened.

Early checkpoint-3 commits also added two convenience aliases to `package.json`. That unnecessarily triggered the heavy Desktop Installer workflow on every synchronize event and accumulated stale installer runs that were unrelated to DR behavior. The aliases were removed; the canonical runbook already calls the scripts directly. The final checkpoint-3 diff no longer changes `package.json` and therefore does not require a Desktop Installer result for closure.

A later exact head `9085e208cfb6d13a2719b768dd1f5198ddc8774d` reached CI #1811. Its naming job passed, but the read-only format/parser gate correctly failed because two source edits contained a literal `\\n` sequence after `const expectedMcpResource =` rather than a real line break. That syntax defect was repaired in both acceptance and reboot-evidence entrypoints.

The same repair cycle used the repository's locked Prettier toolchain on the two entrypoints plus `test/offhost-dr-source-contract.test.ts`. The temporary formatter workflow completed successfully and removed itself from the branch; the resulting formatter head was `72075838ddf97db8cb33a868d6bfd0fca1e48b62`.

Checkpoint 3 also adds a real rendered-Compose test under the existing Linux Docker acceptance flag. CI now executes `docker compose ... config --format json` with `deploy/compose.dr-recovery.yml` and requires the rendered Caddy service to expose exactly one `127.0.0.1:18080 -> 8080` publication on the internal network. This complements the source-contract checks and catches unsupported/incorrect Compose override semantics before runtime use.

No failed gate was bypassed, converted to a warning, or removed.

## Safe resumable handoff

Repository-side next steps:

1. require exact-head CI + Product Eval + relevant acceptance for the checkpoint-3 branch;
2. merge only that reviewed head;
3. require merged-main gates;
4. update canonical docs with the exact merge identity.

Runtime-side next steps after that repository closure:

1. explicitly enable `ECORIONE_STAGING_CD_ENABLED=1`;
2. manually dispatch **Staging Deploy** for the exact current `main` SHA;
3. require governed public smoke, authenticated Operations, exact-host evidence and release receipt PASS;
4. immediately return `ECORIONE_STAGING_CD_ENABLED` to disabled;
5. configure an independent SSH backup target and out-of-band DR key custody;
6. run the real current-revision off-host export;
7. provision a clean replacement host and continue through fetch -> preflight -> restore -> standalone loopback start -> acceptance -> reboot/post evidence.

No workflow bypass, ad-hoc live-source copy, or production promotion is authorized by this checkpoint.
