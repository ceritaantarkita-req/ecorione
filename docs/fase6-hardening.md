# Fase 6+ — evidence-driven hardening baseline

**Status:** ACTIVE / OPEN-ENDED · reconciled through Batch 12 closure on 2026-09-10

Fase 6+ bukan fase yang boleh diberi label CLOSED permanen. Yang sudah CLOSED adalah **planned platform/production roadmap Batch 1–12**. Dokumen ini mencatat hardening baseline yang sudah masuk `main` dan area evidence-driven yang masih bisa berkembang setelah closure.

Current canonical handoff: `docs/current-state-and-next-steps.md`.

## Current closure state

- Batch 1–12: **CLOSED**
- production/self-host baseline: **READY** sesuai boundary yang didokumentasikan
- final closure merge: `783a4ae8a2c90b3c696b3d619fb0c03581f675b2`
- final post-closure main CI: `34490006960` — PASS
- AutoClick: **DEFERRED BY DESIGN**
- no implicit Batch 13

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
- model identity pinning;
- provider-scoped Vault credentials;
- provider-aware spend/cache telemetry.

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

### Final security/release closure

Batch 12 closed:

- shared HTTP hardening;
- request/body bounds and security headers;
- SSRF/public URL validation;
- AuthN/AuthZ regression coverage;
- Sandbox/path/permission release checks;
- full-history secret scan;
- dependency/security review;
- Next.js lint/build cleanup;
- developer SDK docs;
- self-host/release procedures;
- real public HTTPS MCP acceptance resilience;
- final exact-head + post-merge evidence.

See:

- `docs/adr/0033-final-security-release-closure.md`
- `docs/verification/batch12-closure-2026-09-10.md`
- `docs/EXECUTION-PROGRESS.md`

## What remains open-ended after Batch 12

These are **not unfinished Batch 12 items**. They are future operational/product/R&D evidence work:

1. deploy the closed baseline to a real production VPS/server;
2. validate real Anthropic/OpenRouter/OpenAI quality, latency, errors, and billed cost;
3. scrape/store durable production metrics outside process memory;
4. perform host OS/firewall/SSH/account hardening;
5. separate backups from the same failure domain and run recurring restore drills;
6. collect real product workflow evidence;
7. build real evaluation datasets and provider/model comparisons;
8. validate ECX/optimizer savings before making production savings claims;
9. improve UX/Control Center/approval/error surfaces based on use;
10. integrate other ecosystem projects only through explicit APIs/contracts;
11. keep dependency/security/model/pricing reviews current;
12. add new features only when evidence justifies them.

## Cloudflare Free deployment direction

Recommended next public-edge topology:

```text
Cloudflare Free DNS/TLS/WAF/DDoS
  -> Cloudflare Tunnel
  -> ECORIONE VPS
  -> Caddy
  -> Ai + Sync/MCP
  -> internal services
```

Cloudflare does **not** replace ECORIONE compute, Docker services, owner databases, Temporal, Vault, Artifact storage, or Sandbox. Detailed bootstrap/tunnel/rollback procedure: `docs/cloudflare-free-deployment.md`.

## Evidence rule for future work

Future work may only become part of a new READY claim when the relevant evidence exists. At minimum:

- dedicated branch/scope;
- owner-service architecture preserved;
- focused tests/acceptance;
- format/lint/typecheck/test/secret scan/build gates where applicable;
- runtime/public-network acceptance when applicable;
- documentation/ADR update;
- exact-head evidence;
- merge with head guard when available;
- post-merge main verification.

Do not reopen Batch 12 merely because Fase 6+ continues. Create a new explicit scope instead.
