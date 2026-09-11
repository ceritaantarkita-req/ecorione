# Fase 6+ — evidence-driven hardening baseline

**Status:** ACTIVE / OPEN-ENDED · reconciled through comparative-harness implementation closure on 2026-09-11

Fase 6+ bukan fase yang boleh diberi label CLOSED permanen. Yang sudah CLOSED adalah **planned platform/production roadmap Batch 1–12**. Dokumen ini mencatat hardening baseline yang sudah masuk `main` dan area evidence-driven yang masih bisa berkembang setelah closure.

Current canonical handoff: `docs/current-state-and-next-steps.md`.

## Current closure state

- Batch 1–12: **CLOSED**
- production/self-host repository baseline: **READY** sesuai boundary yang didokumentasikan
- local laptop rehearsal: **PASS / LOCAL BOUNDARY CLOSED**
- local Historical Ledger + ECX traffic/integrity evidence: **PASS / LOCAL CHECKPOINT CLOSED**
- Historical Ledger + ECX evidence merge: `88d588bbe4a5f005652c20f3409dd72093439f56`
- comparative ECX harness implementation: **PASS / CLOSED**
- comparative harness PR #38 merge: `c1849cd0c67712e40ea4e5c90587283900859cdb`
- PR #38 exact-head CI `34557147546` + MCP External HTTPS `34557147583`: **PASS**
- PR #38 post-merge CI `34557297702` + MCP External HTTPS `34557297803`: **PASS**
- real Gemma comparative ECX efficiency evidence: **ACTIVE / PENDING RUNTIME MEASUREMENT**
- compute-host/VPS + Cloudflare deployment: **DEFERRED BY OPERATOR DECISION**
- AutoClick: **DEFERRED BY DESIGN**
- no implicit Batch 13

Comparative harness verification: `docs/verification/comparative-harness-implementation-2026-09-11.md`.

## Hardening/platform baseline yang sudah masuk

### Cost + credential control

- emergency hosted-cost kill switch di Connect;
- production credential vault AES-256-GCM dengan master key out-of-band;
- durable daily/monthly hosted spend reservation/settlement;
- provider-aware actual/naive cost accounting;
- no silent provider fallback.

### Provider/runtime framework

- Anthropic, OpenRouter, OpenAI hosted boundaries;
- local OpenAI-compatible runtime abstraction;
- explicit provider/model mapping;
- model identity pinning contract;
- provider-scoped Vault credentials;
- provider-aware spend/cache telemetry.

`gemma4:latest` yang dipakai pada local rehearsal adalah runtime evidence sementara. Mutable alias itu belum dianggap durable production identity dan harus diganti dengan operator-controlled immutable tag/alias pada checkpoint hardening lokal yang terpisah.

### MCP + extension + permission plane

- inbound MCP HTTP/stdio;
- public HTTPS MCP proof through Sync;
- provider-resilient external tunnel acceptance;
- outbound MCP manager with workspace-scoped registry/credential refs/tool policy;
- Plugin/Extension Framework with immutable source/digest provenance and no arbitrary host execution;
- Hub-owned unified capability/permission authority;
- side-effect reservation/uncertain semantics;
- policy/approval/audit remains Hub-owned.

### Multimodal + voice

- multimodal input pipeline baseline;
- realtime voice session/order plane;
- STT/TTS remains Connect/provider boundary;
- final transcript/reply remains in normal governed chat/memory path;
- raw live audio is transient according to the documented boundary.

### Data rebuild / governance / DR

- owner-service rebuild/migration boundaries;
- Context L0 and Historical Ledger ground truth are not convenience-rewritten;
- dry-run/digest/receipt patterns;
- dataset governance through RnD;
- owner-scoped backup/restore procedures;
- Temporal/Flow persistence treated according to its owner/runtime boundary.

### Production operations / observability

- Docker Compose self-host baseline;
- Caddy-only public ports in the repository baseline;
- pinned infrastructure images;
- owner-scoped persistent volumes;
- process metrics + W3C-compatible trace propagation;
- Ai `/ops` aggregation;
- provider canary mechanism;
- Production Operations acceptance in CI;
- install/upgrade/rollback scripts;
- release/security acceptance;
- working-tree + full-history secret scanning;
- dependency review and production build release gate;
- Ai `/settings` Control Center and Connect-owned runtime settings.

### Historical Ledger + ECX real local evidence

The deterministic Ledger/ECX implementation baseline is no longer test-only evidence. A real local browser session was verified in a `LOCAL_ONLY` hash chain, a real ECX plan appended `agent.handoff`, the referenced range was hydrated, and `pnpm production:data-evidence` passed.

This proves local traffic/integrity/provenance. It still does not prove comparative savings.

Verification: `docs/verification/historical-ledger-ecx-local-evidence-2026-09-11.md`.

### Comparative harness implementation

The comparative harness is now merged and repository-verified. It uses existing Artifact, Hub ECX and Connect owner APIs rather than a database/filesystem shortcut, and it keeps the control/claim boundary explicit.

Merged scope includes:

- `full-inline`, `ecx-all`, and `ecx-selective-oracle` lanes;
- five fixed-answer synthetic workloads with relevant + noise documents;
- deterministic exact-field quality scoring;
- warm-up exclusion and measured-call cache-busting;
- hard failure on measured cache hits;
- median aggregation and predeclared quality/bytes/token/latency gates;
- optional mode-0600 raw JSON output under gitignored `.ecorione/` storage;
- deterministic helper/gate regression coverage.

Pre-closure findings were fixed rather than waived: new-file Prettier differences and the explicit Node `performance` import required by the repository lint environment. Temporary helper workflows are absent from the merged tree.

Verification: `docs/verification/comparative-harness-implementation-2026-09-11.md`.

## Active comparative evidence scope

Current local R&D protocol: `docs/comparative-ecx-evidence.md`.

The harness implementation is **CLOSED**; the measured real Gemma result remains **ACTIVE/PENDING**. The runtime benchmark uses three paired lanes:

- `full-inline` — full synthetic context sent to the same local model;
- `ecx-all` — real ECX packet + all refs hydrated, preserving the same semantic document set as the baseline;
- `ecx-selective-oracle` — same ECX packet with only fixture-declared relevant refs hydrated.

The oracle suffix is mandatory because current ECX does **not** autonomously choose `refIndexes`. The caller chooses them. The lane measures the potential/upper bound of correct selective hydration, not automatic selector quality.

Predeclared evidence includes transport bytes, input/output tokens, latency, cache state, model identity, and deterministic answer quality. Exact-cache hits invalidate measured runs. Local `actualUsd=0` is recorded but is not hosted-cost evidence.

Next exact runtime order:

1. synchronize laptop to the merged harness/docs closure;
2. restart/use Phase 4 from that synchronized tree;
3. run `pnpm evidence:comparative:smoke`;
4. inspect all three lanes and fix any real defect without weakening gates;
5. only after healthy smoke, run the 5× paired closure benchmark and save raw JSON locally;
6. commit a sanitized measured-result verification note and update canonical status.

If oracle-selective evidence is useful, a real selector may be proposed later as a separate evidence-driven scope. If it is not useful, record the negative result instead of building a selector to defend the hypothesis.

## What remains open-ended after Batch 12

These are **not unfinished Batch 12 items**. Current operator-approved order is:

1. run comparative ECX real Gemma evidence using the predeclared protocol;
2. perform a controlled local persistence/restart drill;
3. perform an isolated local backup/restore drill;
4. collect a local observability baseline from representative workloads;
5. validate product/UX behavior from real use;
6. replace mutable rehearsal model identity with an immutable operator-controlled local identity and revalidate telemetry/cache identity;
7. resume compute-host/VPS + Cloudflare deployment only when the operator explicitly chooses to do so;
8. validate hosted providers/cost only with operator credentials and explicit spend intent;
9. build representative evaluation datasets and held-out comparisons before broad optimizer claims;
10. improve UX/Control Center/approval/error surfaces based on observed friction;
11. integrate other ecosystem projects only through explicit APIs/contracts;
12. keep dependency/security/model/pricing reviews current;
13. add new features only when evidence justifies them.

## Deployment direction — currently deferred

The existing future public-edge topology remains valid if/when the operator resumes production activation:

```text
Cloudflare Free DNS/TLS/WAF/DDoS
  -> Cloudflare Tunnel
  -> ECORIONE compute host
  -> Caddy
  -> Ai + Sync/MCP
  -> internal services
```

Cloudflare does **not** replace ECORIONE compute, Docker services, owner databases, Temporal, Vault, Artifact storage, or Sandbox. Detailed future procedure: `docs/production-activation.md` and `docs/cloudflare-free-deployment.md`.

Do not infer target-host readiness from the laptop evidence. The production workstream is deferred, not completed.

## Evidence rule for future work

Future work may only become part of a new READY/VERIFIED claim when the relevant evidence exists. At minimum:

- dedicated branch/scope;
- owner-service architecture preserved;
- focused deterministic tests/acceptance;
- format/lint/typecheck/test/secret scan/build gates where applicable;
- runtime/public-network acceptance when applicable;
- documentation/ADR update when the architecture or claim boundary changes;
- exact-head evidence;
- merge with head guard when available;
- post-merge main verification.

For comparative benchmarks specifically:

- define lanes and quality answer keys before the real run;
- record cache state and reject contaminated cached measurements;
- compare equivalent task/fact sets;
- preserve raw evidence locally in gitignored storage;
- commit only sanitized verified summaries;
- distinguish ECX transport, selective hydration, automatic selection, model routing/cache, and actual provider cost as separate claims.

Do not reopen Batch 12 merely because Fase 6+ continues. Create a new explicit scope instead.
