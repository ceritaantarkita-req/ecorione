# ECORIONE — Execution Progress & Remaining Roadmap

Last updated: **2026-09-10**

Status: **ACTIVE — canonical execution tracker**

Dokumen ini adalah source of truth untuk progress implementasi ecorione setelah blueprint awal selesai dibangun. Tujuannya supaya status pekerjaan, blocker, urutan batch, evidence, dan next action tidak bergantung pada histori chat.

> **Maintenance rule:** setiap workstream/batch yang mengubah status implementasi **WAJIB** meng-update file ini sebelum PR dianggap closure-ready. Jangan menandai pekerjaan `CLOSED` hanya karena kode sudah ditulis; closure membutuhkan evidence sesuai Definition of Done di bawah.

---

## 1. Status legend

| Status | Arti |
|---|---|
| `CLOSED` | Implementasi selesai, exact-head gate hijau, merged, dan post-merge verification memenuhi syarat |
| `IMPLEMENTED / CLOSURE PENDING` | Implementasi sudah ada/merged tetapi closure final masih punya blocker atau evidence yang belum lengkap |
| `IN PROGRESS` | Branch aktif sedang dikerjakan |
| `PLANNED` | Sudah disepakati tetapi belum mulai implementasi |
| `DEFERRED` | Sengaja tidak dikerjakan sampai prasyarat/use case nyata tersedia |
| `OPEN-ENDED` | Area hardening yang tidak pernah dianggap selesai permanen; evidence terus ditambah |

---

## 2. Current repository state

### Main

Batch 10 implementation is merged and post-merge verified on `main`:

- implementation PR #25 merge: `f5232048f29efa4d4b6632330f0d860afa781d48`
- exact final PR head: `3459e4b51ff5c04eeb129ed2463cb0545d9a6ef8`
- exact-head CI `34442113246`: full green
- exact-head MCP External HTTPS Acceptance `34442113341`: PASS
- post-merge main CI `34443543782`: full green

### Active execution

- Batch 1 status: **CLOSED**
- Batch 2 status: **CLOSED**
- Batch 3 status: **CLOSED**
- Batch 4 status: **CLOSED**
- Batch 5 status: **CLOSED**
- Batch 6 status: **CLOSED**
- Batch 7 status: **CLOSED**
- Batch 8 status: **CLOSED**
- Batch 9 status: **CLOSED**
- Batch 10 status: **CLOSED**
- next implementation target: **Batch 11 — Production Operations & Observability**

---

## 3. Completed foundation

### Core Fase 0–4

Status: **CLOSED baseline**

Sudah tersedia:

- monorepo architecture dan shared contracts
- Context / memory boundaries
- RnD trace/eval foundation
- Hub orchestration/policy
- Connect model/provider boundary
- Ai frontend/backend loop
- MCP inbound server
- Sync local/self-host bridge
- Artifact
- Space service baseline
- Sandbox tiered execution
- Flow durable orchestration dengan Temporal
- approval commit-before-signal semantics
- independent verification melalui RnD evidence

Fase 5 AutoClick tetap **DEFERRED BY DESIGN** sesuai ADR-11 sampai ada use case non-API nyata yang lolos review arsitektur.

Fase 6+ tetap **OPEN-ENDED / evidence-driven** dan tidak boleh ditandai selesai permanen.

---

## 4. Closed hardening workstreams

### 4.1 Historical Ledger

Status: **CLOSED**

- Hub-owned durable append-only history
- hash-chained entries
- atomic append batch
- exact history/replay projection
- monotonic sensitivity
- live chat dual-write ke Ledger + Context
- provider success tidak dibuat retryable hanya karena post-provider ledger bookkeeping gagal

ADR: `docs/adr/0018-historical-ledger.md`

### 4.2 ECX — internal agent exchange

Status: **CLOSED baseline**

- pointer-first exchange
- deterministic recipient planning
- no default broadcast
- duplicate agent IDs rejected
- atomic provenance
- selective hydration
- byte-budget fail-closed

Catatan: klaim penghematan token/cost **belum boleh** dibuat sampai production telemetry tersedia.

ADR: `docs/adr/0019-ecx-agent-exchange.md`

### 4.3 Connect Production Credential Vault

Status: **CLOSED**

- AES-256-GCM
- master key out-of-band
- provider-scoped credentials
- atomic secret rotation
- provider secret rotation tanpa process restart
- vault authoritative ketika aktif
- raw provider env keys tetap development-only fallback
- no HTTP credential admin endpoint

ADR: `docs/adr/0020-connect-credential-vault.md`

### 4.4 Durable cumulative hosted spend budget

Status: **CLOSED**

- daily/monthly caps
- durable across restart
- reserve before dispatch
- concurrent calls serialized/fail-closed
- ambiguous provider outcome tetap dihitung konservatif
- provider success tidak dibuat retryable karena settlement bookkeeping failure
- provider-aware spend ledger

ADR: `docs/adr/0021-durable-spend-budget.md`

### 4.5 Provider Framework + runtime abstraction

Status: **CLOSED**

Supported hosted provider boundaries:

- Anthropic
- OpenRouter
- OpenAI

Local inference:

- OpenAI-compatible runtime abstraction
- Ollama **optional**, bukan hard dependency
- runtime dapat diganti dengan compatible local endpoint tanpa mengubah architecture boundary

Provider rules:

- explicit provider selection/mapping
- pinned model identity
- no `latest` aliases
- provider-scoped vault
- provider-aware cache/spend accounting
- valid OpenRouter `usage.cost` menjadi billed actual cost ketika tersedia

ADR: `docs/adr/0022-provider-framework-and-runtime-abstraction.md`

---

## 5. External MCP HTTPS status

Status: **CLOSED**

Implementation dan public-network proof sudah selesai dan merged melalui PR #6.

Implemented:

- OAuth `WWW-Authenticate` dengan Protected Resource Metadata discovery
- least-privilege MCP scopes
- issuer/audience/JWKS validation
- Origin validation
- routing-header validation
- Sync meneruskan OAuth/MCP headers tanpa mengubah trust boundary
- Connect tetap loopback-only
- real public HTTPS acceptance melalui temporary Cloudflare Quick Tunnel
- public OAuth/JWKS endpoint
- JWT signature verification melalui JWKS yang benar-benar diambil lewat public HTTPS
- `server/discover`
- `tools/list`
- `tools/call memory_search`
- invalid JWT rejection
- insufficient scope rejection
- Origin rejection
- routing mismatch rejection
- pinned cloudflared binary + SHA-256 verification
- cleanup process/tunnel
- stale `memory_open` metadata diperbaiki karena Artifact sudah tersedia

Final PR-head evidence:

- SHA: `ce15dd0cdefddcc266f6df834506c6ef134ff5d2`
- regular CI: `34346430200` — PASS
- External HTTPS Acceptance: `34346430184` — PASS
- PR #6 merged ke `main` as `55ee05fe34e595e2c3e2ef6b9742673f1b78f156`

Closure completed after the unrelated Fase 4 Temporal readiness flake was hardened in PR #7 and post-merge `main` CI `34350438424` passed fully. External MCP HTTPS implementation and its real public-network evidence remain unchanged.

Verification: `docs/verification/mcp-external-https-2026-09-09.md`

---

# 6. Remaining execution roadmap

Dari current state, **Batch 1–10 sudah CLOSED**. Tersisa **2 batch platform/production (Batch 11–12)**; next implementation target adalah **Batch 11 — Production Operations & Observability**.

---

## Batch 1 — Fase 4 Temporal CI Flake Hardening

Status: **CLOSED**

Goal: restore deterministic full-green CI after the repeated forced-worker-recovery flake.

Implemented:

- OS child-process `spawn` is no longer treated as Temporal polling readiness
- acceptance-only IPC readiness is emitted only after `Worker.getState()` reaches `RUNNING`
- production behavior remains unchanged when the acceptance IPC env is disabled
- readiness wait is bounded and fail-closed on terminal worker states
- the process acceptance waits for explicit readiness for both the initial and replacement workers
- forced crash remains `SIGKILL`; it was not weakened into graceful shutdown
- durable Hub approval, commit-before-signal, AI, Sandbox, and RnD verification semantics remain intact

Evidence:

- originating main failure: `34346631709` — `Timed out waiting for durable Hub approval.`
- repeated stress: `34349246133` — 3/3 real forced crash/replacement acceptance PASS
- candidate code CI: `34349843284` — full green
- final PR head: `3e2d224d49fa9ce80ed9ad653268a8e6425808c7`
- final exact-head CI: `34350133864` — full green
- PR #7 merge SHA: `d79793977c9d4ea5d6e472ca4eeeabfed3259e60`
- post-merge main CI: `34350438424` — full green

Closure result:

- Phase 4 process acceptance is stable against the previously observed startup race
- External MCP HTTPS workstream is also fully `CLOSED`
- next execution target is Batch 2

---

## Batch 2 — Outbound MCP Client + MCP Manager

Status: **CLOSED**

Goal: ecorione dapat memakai MCP server pihak lain tanpa membuat transport, credential, policy, approval, atau retry boundary kedua di luar Connect + Hub.

Implemented baseline:

- official `@modelcontextprotocol/client@2.0.0` exact pin;
- explicit modern/legacy protocol negotiation dengan `versionNegotiation.mode = "auto"`;
- Streamable HTTP + stdio; HTTPS wajib kecuali explicit loopback;
- stdio exact command allowlist fail-closed;
- durable server registry dengan atomic replacement, lock, mode `0600`, dan workspace-scoped visibility;
- connection/cache partition per workspace;
- discovery tools/resources dengan surface failure isolation;
- explicit per-tool enable/disable + local `ActionClass`;
- named MCP credential refs terenkripsi dalam Connect Vault `mcp/tokens`;
- Hub policy, durable approval, dan audit melalui service API; tidak ada cross-service DB access;
- durable side-effect state `reserved` / `uncertain` / `settled`;
- invocation provenance menyimpan workspace, operation, server, tool, canonical args digest, timestamp, dan result;
- idempotency identity memasukkan workspace sehingga dua workspace tidak salah dedupe;
- known ambiguous retry ditolak sebelum reconnect/discovery; atomic reserve tetap barrier tepat sebelum remote dispatch;
- remote failure setelah side-effect dispatch menjadi uncertain dan tidak di-retry otomatis;
- remote success tidak dibuat retryable karena settlement/audit bookkeeping lokal gagal;
- operator CLI untuk server registry, tool policy, dan Vault credential refs;
- outbound MCP tidak menjalankan arbitrary GitHub/plugin code.

Evidence sebelum docs closure:

- clean code candidate head: `1cf736611d2b2a2778884d971b1afa92057f37b3`;
- CI `34357212048` — Naming, Format, Lint, Typecheck, Test, Secret Scan, Production Build PASS;
- MCP External HTTPS Acceptance `34357212042` — PASS;
- focused MCP regression setelah durable provenance/preflight fix: 14 tests PASS.

Closure evidence:

- final PR head: `5609d8cae9fe9bb83a751da5616822b8dec1c4a2`;
- CI `34359796175` — full green;
- MCP External HTTPS Acceptance `34359796083` — PASS;
- PR #9 merge SHA: `97646e102ee90a39aa25a7b79b8cbf86673aa81f`;
- post-merge main CI `34360113741` — full green.

Batch 2 resmi `CLOSED`; next implementation batch adalah Batch 3.

---

## Batch 3 — Plugin / Extension Framework

Status: **CLOSED**

Implemented baseline:

- strict versioned manifest `ecorione.extension/v1`;
- immutable GitHub commit SHA / HTTPS release / Artifact source identity;
- SHA-256 bundle identity bound to Artifact CAS;
- execution kinds only `none | mcp | sandbox`; no host execution;
- MCP execution remains behind Connect outbound MCP manager;
- executable extension remains behind Sandbox;
- declared capabilities, permissions/ActionClass, and secret requirements;
- fail-closed security admission before policy/audit mutation;
- durable workspace-scoped installation registry;
- append-only extension revisions;
- transactional idempotent install/update/rollback/remove/health receipts;
- same idempotency key + different canonical fingerprint fails conflict;
- rollback creates a new revision and preserves target provenance;
- remove preserves revision history;
- workspace-isolated list/get/revision visibility;
- HTTP lifecycle regression covers validation, idempotency, isolation, update/rollback, health, remove, and blocked admission.

Security rule:

> Arbitrary GitHub repository **tidak boleh** langsung dieksekusi di host process. Digest/provenance admission proves identity/integrity, not vulnerability absence. Capability/permission declaration is not an authority grant until Batch 4.

ADR: `docs/adr/0024-plugin-extension-framework.md`
Operations: `docs/extension-operations.md`

Closure evidence:

- final implementation candidate: `e706aa70f3b9b80fc6ec12c72972a29f3c503639`;
- exact-head CI `34368041372` — Naming, Format, Lint, Typecheck, Test, dedicated Phase 4 real-process acceptance, Secret Scan, Production Build PASS;
- exact-head MCP External HTTPS Acceptance `34368041191` — PASS;
- verification mirror PR #11 menunjuk exact SHA yang sama, dipakai hanya untuk memicu checks, lalu ditutup tanpa merge;
- PR #10 merged dengan expected-head lock sebagai `af2b3f12f5deeaf2fd50c045998416365f766b9d`;
- post-merge `main` CI `34368309860`, attempt 2 — full green setelah attempt 1 dibatalkan saat Production Build tanpa perubahan `main` SHA.

Batch 3 resmi `CLOSED`; next implementation batch adalah Batch 4.

---

## Batch 4 — Unified Capability + Permission Plane

Status: **CLOSED**

Implemented candidate:

- Hub-owned single authority plane; tidak ada permission database kedua di service lain;
- workspace + subject + capability + permission + scope + sensitivity-ceiling standing grants;
- fail-closed untuk unknown/undeclared/missing grants;
- code-owned built-in capability definitions untuk MCP, Sandbox, hosted/local model, generic tool, secret access, dan future node;
- `POLICY_ADMIN` selalu melewati durable human approval untuk grant/revoke;
- immutable/idempotent authority mutation receipts + append-only authority events;
- extension declaration bukan grant, permission terikat deterministik ke capability, stale grants dipangkas saat manifest update, remove membersihkan active grants;
- Chat hosted model authority sebelum Context/provider egress;
- Flow hosted/local model authority sebelum Connect;
- Sandbox authority sebelum generic policy/execution;
- outbound MCP authority sebelum policy/network dispatch dan credentialRef membutuhkan `secret.access / credential.use`;
- one-time explicit compatibility grants untuk hosted/local model dan Sandbox tiers pada `ws_personal`; tetap revocable;
- outbound MCP tidak auto-migrated karena Hub tidak mengintrospeksi Connect registry; operator wajib grant eksplisit;
- raw credential tetap hanya di Connect Vault; authority state/audit tidak menyimpan secret.

Regression evidence sebelum final docs head:

- integration helper run `34375813569`: root Typecheck PASS + focused authority/extension/sandbox/orchestrate tests PASS;
- regression hardening run `34376301583`: root Typecheck PASS + Chat/MCP/credential/extension/Sandbox focused tests PASS;
- temporary helper workflows/scripts self-remove dan bukan bagian final candidate.

ADR: `docs/adr/0025-unified-capability-permission-plane.md`
Operations: `docs/capability-permission-operations.md`

Closure evidence:

- final exact PR head: `c23bad4da6eff453e35b72b4167c0c74554d70f3`;
- exact-head CI `34380136146` — Naming, Format, Lint, Typecheck, Test, Phase 4 real-process acceptance, Secret Scan, dan Production Build PASS;
- exact-head MCP External HTTPS Acceptance `34380136158` — PASS;
- focused chat-loop authority audit regression `34379954762` — PASS;
- PR #13 merged dengan expected-head lock sebagai `455b5cef72d5847b67ddedebc81471432fb0ba42`;
- post-merge `main` CI `34380385839` — full green.

Batch 4 resmi **CLOSED**; next implementation batch adalah Batch 5.

---

## Batch 5 — Native Multimodal Pipeline

Status: **CLOSED**

Ownership implemented:

- Artifact → raw image/PDF/document/audio/video + generated TTS audio CAS
- Connect → normalized OCR/vision/STT/TTS adapter boundary, local/hosted routing, credential + spend enforcement
- Context → extracted/derived semantic information including page/bbox/confidence/timestamps/language
- Historical Ledger → `artifact.extracted`, `artifact.transcribed`, `artifact.synthesized` provenance references
- Hub → routing, capability authority, sensitivity/sync gates, durable attachment lifecycle, idempotency

Implemented scope:

- first-class image input through Artifact pointer
- PDF/document input with MIME validation
- OCR + vision normalized result contract
- page + normalized bounding-box + confidence metadata
- Indonesian / English / mixed / unknown language metadata
- STT transcript segments with `startMs` / `endMs`
- TTS through the same Connect inference boundary; generated audio is written back to Artifact
- durable lifecycle `RECEIVED → PROCESSING → READY | FAILED`
- replay-safe READY result and fail-closed ambiguous PROCESSING/FAILED retry semantics
- Context-owned derivation persistence keyed by `OperationId`
- Historical Ledger provenance without duplicating raw media/full derived payloads
- deterministic local-first routing; hosted fallback only when explicitly opted in
- Hub pre-authorization + SyncClass egress check before raw bytes leave Artifact boundary
- Connect re-checks hosted eligibility, cost kill switch, credential availability, and cumulative spend reservation
- explicit bounded media body limits; Artifact's decoded 20 MiB ceiling is reachable despite Base64 expansion
- hosted adapter credentials remain rotatable through Connect Vault reader
- realtime duplex voice remains intentionally outside Batch 5 and belongs to Batch 6

Bugs / hardening discovered during implementation:

- Artifact's existing 20 MiB decoded limit was previously unreachable for larger Base64 JSON uploads because Fastify kept its smaller default body limit; body ceiling is now explicit and bounded
- multimodal duplicate `OperationId` with a different request fingerprint is mapped to HTTP 409 instead of leaking as an internal 500
- local adapter is forbidden from reporting hosted cost
- hosted adapter requires Connect-owned credential access and model identities containing `latest` are rejected
- temporary formatting workflow used during development was removed before the green candidate

Regression / integration coverage:

- Connect local-first routing, explicit fallback, SyncClass rejection, kill switch, and TTS normalization
- Context derivation persistence + idempotency/conflict for OCR page/bbox/confidence metadata
- Hub end-to-end image OCR choreography across Context/Artifact/Connect/Ledger
- Hub LOCAL_ONLY hosted-fallback rejection before bytes reach Connect
- Hub TTS result written to Artifact and Ledger provenance
- same request replay returns committed result without a second Connect inference; mutated retry returns 409

Docs:

- ADR: `docs/adr/0026-native-multimodal-pipeline.md`
- Operations: `docs/multimodal-operations.md`

Green implementation candidate before progress-doc update:

- SHA: `66644a059d464b37af98894bdf3353b3e0e8a1a2`
- CI `34387285455` — Naming, Format, Lint, Typecheck, Test, Phase 4 real-process acceptance, Secret Scan, Production Build PASS
- MCP External HTTPS Acceptance `34387285379` — PASS

Closure evidence:

- final exact PR head: `a202c74eea504b9c7220e0b45fc1d113d1ff1be9`
- exact-head CI `34387886010` — Naming, Format, Lint, Typecheck, Test, Phase 4 real-process acceptance, Secret Scan, Production Build PASS
- exact-head MCP External HTTPS Acceptance `34387885874` — PASS
- PR #15 merged with expected-head lock as `2226493ae54ed83315a9f84fd3b72fe67c947157`
- `main` points to the expected merge
- post-merge main CI `34388114706` — full green
- no temporary Batch 5 helper workflow remains in the implementation tree

Batch 5 resmi **CLOSED**; next implementation batch adalah Batch 6.

---

## Batch 6 — Realtime Voice

Status: **CLOSED**

Implemented baseline:

- browser microphone capture with RMS VAD and bounded PCM16/WAV chunking
- Hub-owned durable voice-session lifecycle, monotonic client chunk receipts, ordered event sequence, and replay semantics
- incremental STT per audio chunk with partial/final transcript events
- ordered SSE downlink for session, transcript, assistant text/audio, interruption, and latency events
- Indonesian/English automatic language switching with explicit fixed-language override
- model reply delivery plus incremental TTS playback without inventing provider-native first-token streaming
- generation-based interruption/barge-in that suppresses stale output and propagates `AbortSignal` Hub -> Connect -> provider
- live microphone audio remains transient and is not persisted per chunk into Artifact/Context
- restart fails non-terminal live sessions closed instead of silently adopting transient state
- strict routing/privacy rules reuse Batch 5 authority, SyncClass, credential, kill-switch, and spend boundaries

Bugs/fixes during closure:

- strict optional `AbortSignal` propagation was corrected without weakening `exactOptionalPropertyTypes`
- Ai proxy relative imports and response null-guard were corrected
- final repository lint findings were corrected with type-only multimodal language import and unused-import removal

Docs:

- ADR: `docs/adr/0027-realtime-voice.md`
- Operations: `docs/voice-operations.md`

Closure evidence:

- focused integration/typecheck run `34422346310`: PASS
- strict lint/typecheck/focused voice run `34423581218`: PASS; temporary helper self-deleted
- final exact PR head: `4312f76c521cd676ac263a3f400923906fba7bdf`
- exact-head CI `34423696211`: full green
- exact-head MCP External HTTPS Acceptance `34423696180`: PASS
- PR #17 merged with expected-head lock as `01cc32f12745f4a5dd391e61e39ad8d8faa4d5b7`
- `main` confirmed at expected merge SHA
- post-merge main CI `34423867459`: full green
- no temporary Batch 6 helper workflow/script remains in the implementation tree

Batch 6 resmi **CLOSED**; next implementation batch adalah Batch 7.

---

## Batch 7 — Data Refactor / Rebuild Engine

Status: **CLOSED**

Immutable rule:

> Historical Ledger dan Context L0 adalah authoritative append-only sources dan **tidak boleh direwrite in-place** oleh refactor engine.

Scope:

- versioned schema migrations
- projection rebuild
- FTS rebuild
- vector/embedding reindex
- derived-fact dedupe/merge
- metadata normalization
- orphan detection
- integrity validation
- dry-run + diff
- snapshot/backup
- execute
- verify
- migration/rebuild receipt
- rollback/rebuild from immutable source

No cross-service database access. Maintenance dilakukan melalui owner-service contract/API.

---


Implementation branch: `agent/batch7-data-rebuild-20260910`

Current implementation boundary:

- Context-owned dry-run/execute/rollback/verify/receipt API
- immutable Context L0 source digest + projection digest anti-TOCTOU
- owner-generated SQLite safety snapshots
- derived LOCAL_AGENT metadata normalization + deterministic dedupe/invalidation
- staging-first L1 rebuild from immutable episodes through local extraction
- FTS5 rebuild + vector accelerator reindex from durable embeddings
- orphan/SQLite/FK/FTS integrity validation
- Historical Ledger verify-all only; no rewrite/repair endpoint

Closure evidence:

- implementation branch: `agent/batch7-data-rebuild-20260910`;
- implementation PR: #19;
- final exact PR head: `87afff362dd00c5922b641e52e18d5813b506593`;
- pre-PR integration gate `34425510633`: lint, typecheck, focused regression PASS;
- hardening gate `34425780889`: lint, typecheck, failed-execute rollback + HTTP stale-plan + History/repository/retrieval regression PASS;
- exact-head CI `34425970086`: Naming, Format, Lint, Typecheck, Test, Phase 4 real-process acceptance, Secret Scan, Production Build PASS;
- MCP External HTTPS Acceptance: **N/A** karena Batch 7 tidak mengubah path trigger workflow tersebut;
- merge memakai expected-head lock menjadi `a48629d13ad03d9d02e635c6a8ca72f511e7a99c`;
- post-merge `main` CI `34426166317`: full green;
- temporary Batch 7 integration/hardening workflows self-delete dan tidak ada di implementation tree;
- Historical Ledger dan Context L0 tetap authoritative append-only sources; Batch 7 hanya rebuild/repair projection melalui owner-service contract.

Verification: `docs/verification/batch7-closure-2026-09-10.md`

Batch 7 resmi **CLOSED**; next implementation batch adalah Batch 8.

## Batch 8 — Dataset Governance + Backup / Restore / DR

Status: **CLOSED**

Dataset governance:

- registry
- schema/version
- lineage/source
- immutable releases
- dedupe
- PII/secret sanitation
- train/eval/regression split bila relevan
- quality checks

Operations:

- backup service data
- vault-safe backup
- restore
- integrity verification
- disaster recovery procedure
- recovery drill

Implementation branch: `agent/batch8-data-governance-dr-20260910`

Implemented boundary:

- RnD-owned immutable dataset registry + content-identified releases;
- explicit schema/version + source lineage digests;
- deterministic secret/email/phone/Bearer sanitation baseline before release;
- governed-payload dedupe + deterministic group-safe train/eval/regression split;
- dataset quality report + tamper detection + registry crash self-heal;
- owner-scoped backup manifest with per-file SHA-256 + aggregate digest;
- SQLite online backup adapters for Context, Hub, RnD, Sync, and Space;
- directory/bundle backup + staged restore for Artifact, Sandbox, RnD datasets, and Connect state;
- Connect credential vault backup as ciphertext only; master key remains out-of-band;
- pre-restore safety backup + operation lock + post-restore digest verification;
- Flow DR remains Temporal-persistence responsibility; no second durability store;
- documented separate-failure-domain requirement for production DR.

Closure evidence:

- implementation branch: `agent/batch8-data-governance-dr-20260910`;
- implementation PR: #21;
- final exact PR head: `84017f01be52bf65bc8d1ea88ce2d481b1b831d8`;
- pre-PR integration gate `34428172190`: Format, Lint, root Typecheck, focused Batch 8 regression PASS;
- hardening gate `34428476195`: Format, Lint, root Typecheck, empty-directory recovery, dataset registry crash self-heal, RnD dataset restore, Context SQLite recovery drill, Connect vault-safe backup/restore regression PASS;
- exact-head CI `34429679871`: Naming, Format, Lint, Typecheck, Test, Phase 4 real-process acceptance, Secret Scan, Production Build PASS;
- exact-head MCP External HTTPS Acceptance `34429679835`: PASS;
- merge memakai expected-head lock menjadi `37f073ad9865487a217d4348083f75fe28caa1e9`;
- post-merge `main` CI `34429848537`: full green;
- temporary Batch 8 integration/hardening/tracker workflows self-delete dan tidak ada di implementation tree;
- production disaster recovery tetap mensyaratkan verified backup replication ke failure domain terpisah; local backup directory bukan bukti tahan disk loss;
- Connect master key tetap out-of-band dan Flow recovery tetap mengikuti Temporal persistence.

Verification: `docs/verification/batch8-closure-2026-09-10.md`

Batch 8 resmi **CLOSED**; next implementation batch adalah Batch 9.

---

## Batch 9 — Node Registry + Visual Flow Canvas

Status: **CLOSED**

Goal: membuat user-composable execution layer ala n8n tanpa membuat durability engine kedua.

Architecture:

```text
Visual Graph
  -> Graph Validator
  -> Compiler / Interpreter
  -> Flow
  -> Temporal
```

Node contract minimal:

- type/id/version
- input/output schema
- capability dependencies
- permissions
- side-effect declaration
- secret references
- timeout/resource limits
- retry semantics
- idempotency

Core node pack:

- Trigger
- AI
- Memory/Context
- Artifact
- MCP Tool
- HTTP/API
- Transform
- Condition/Switch
- Loop/Map
- Parallel
- Delay/Schedule
- Approval
- Human Input
- Sandbox Code
- Data owner API
- Notification
- Subflow

UI:

- drag/drop canvas
- edges
- configuration panel
- validation
- save/load/version
- execution status
- trace linkage

Implemented baseline:

- versioned shared node contract + deterministic graph compiler/validator;
- 17 core node kinds with capability, policy, side-effect, secret-ref, limit, retry, and idempotency metadata;
- Flow-owned append-only graph definitions/versions with optimistic concurrency;
- Temporal-owned durable graph execution, timers, signals, approvals, human input, parallel levels, and child-workflow subflows;
- Hub node declaration sync without auto-grant and exact node authority checks;
- owner-service execution boundaries for Connect, Context, Artifact, Space, Sandbox, RnD, and MCP;
- fail-closed HTTPS hostname allowlist and owner API prefix allowlist;
- Ai `/flow` visual canvas with drag/drop, edges, inspector, validation, save/load/version, execution status, approval/input controls, and trace linkage.

Closure evidence:

- implementation branch: `agent/batch9-node-registry-canvas-20260910`;
- implementation PR: #23;
- final exact PR head: `6294a6f641b1ddecf23ccac23ab1e85ce8da7fe8`;
- exact-head CI `34435365038`: Naming, Format, Lint, Typecheck, Test, Phase 4 real-process acceptance, Secret Scan, Production Build PASS;
- exact-head MCP External HTTPS Acceptance `34435365023`: PASS;
- PR #23 merged with expected-head lock as `05b05a5f22133d61a411ff22463ac5acfaf4c5eb`;
- `main` confirmed at the expected merge SHA;
- post-merge main CI `34435559155`: full green;
- no temporary Batch 9 helper workflow remains in the implementation tree.

ADR: `docs/adr/0030-node-registry-visual-flow.md`  
Operations: `docs/node-registry-flow-canvas-operations.md`  
Verification: `docs/verification/batch9-closure-2026-09-10.md`

Batch 9 resmi **CLOSED**; next implementation batch adalah Batch 10.

---

## Batch 10 — Space Block Runtime

Status: **CLOSED**

Goal: composable workspace/document surface ala Notion tanpa membuat duplicate memory/source-of-truth.

Candidate blocks:

- paragraph
- heading
- list
- checklist
- table
- database view
- file
- image
- embed
- AI block
- linked Context/memory
- linked Artifact
- linked Flow

Boundary:

- Context tetap owner memory
- Artifact tetap owner file/blob
- Flow tetap owner durable execution
- Space hanya menyimpan workspace/document composition yang memang menjadi domain-nya

Implemented baseline:

- 13 typed block kinds: paragraph, heading, list, checklist, table, database-view, file, image, embed, ai, context-link, artifact-link, flow-link;
- shared discriminated schemas dengan type/body agreement dan HTTPS-only embed validation;
- workspace-scoped pages/blocks dengan monotonic optimistic versions;
- transactional insert/move/delete/reorder dan fail-closed stale-write conflicts;
- same-page table dependency untuk database-view dengan exact typed-reference checking;
- Context/Artifact/Flow pointer resolution dilakukan just-in-time tanpa copy authoritative owner data;
- AI block menunjuk Flow graph, sehingga durable execution tetap dimiliki Flow/Temporal;
- real pre-Batch-10 SQLite migration mempertahankan IDs/order/timestamps dan mengubah legacy text/heading/list menjadi typed bodies;
- Ai `/space` menyediakan page composition, block palette, preview, reorder/delete, JSON inspector, reference resolution, dan existing Context core-memory editor.

Closure evidence:

- implementation branch: `agent/batch10-space-block-runtime-20260910`;
- implementation PR: #25;
- final exact implementation head: `3459e4b51ff5c04eeb129ed2463cb0545d9a6ef8`;
- exact-head CI `34442113246`: Naming, Format, Lint, Typecheck, Test, Phase 4 real-process acceptance, Secret Scan, Production Build PASS;
- exact-head MCP External HTTPS Acceptance `34442113341`: PASS;
- PR #25 merged with expected-head lock as `f5232048f29efa4d4b6632330f0d860afa781d48`;
- `main` confirmed at the expected merge SHA;
- post-merge main CI `34443543782`: full green;
- no temporary Batch 10 implementation helper workflow remains in the implementation tree.

ADR: `docs/adr/0031-space-block-runtime.md`  
Operations: `docs/space-block-runtime-operations.md`  
Verification: `docs/verification/batch10-closure-2026-09-10.md`

Batch 10 resmi **CLOSED**; next implementation batch adalah Batch 11.

---

## Batch 11 — Production Operations & Observability

Status: **IN PROGRESS**

Scope:

- managed/self-host deployment recipe
- Temporal deployment
- Docker/Compose deployment baseline
- HTTPS/reverse-proxy recipe
- persistent volumes
- provider canary
- real-provider quality floor
- cost metrics
- token metrics
- latency p50/p95
- error rate
- cache-hit metrics
- MCP/tool metrics
- node/workflow metrics
- ECX packet/hydration telemetry
- unified distributed trace
- health/operations dashboard

Important:

> Tidak ada production efficiency/cost-saving claim untuk ECX sebelum telemetry nyata tersedia.

---

## Batch 12 — Final Security / Release Closure

Status: **PLANNED**

Scope:

- full Git-history secret scan
- working-tree secret scan tetap dipertahankan
- dependency/security review
- AuthN/AuthZ audit
- SSRF
- path traversal
- injection
- secret exposure
- Sandbox escape resistance
- MCP/plugin permission review
- rate limiting
- audit coverage
- chaos/failure tests
- cross-service E2E
- backup/restore acceptance
- Next.js ESLint integration cleanup
- documentation consistency audit
- ADR consistency audit
- Settings / Control Center
- provider/model management UI
- MCP/plugin management UI
- installer/self-host package
- upgrade/migration procedure
- rollback procedure
- developer SDK/docs
- final architecture audit
- final exact-head CI closure
- post-merge/release verification

Closure label yang boleh digunakan setelah batch ini memenuhi evidence:

**ECORIONE production/self-host baseline READY**

Ini bukan berarti development berhenti; Fase 6+ tetap open-ended dan hardening/telemetry harus terus berkembang berdasarkan evidence produksi.

---

# 7. Remaining workload estimate

Current planning unit:

- **Batch 1: CLOSED**
- **Batch 2: CLOSED**
- **Batch 3: CLOSED**
- **Batch 4: CLOSED**
- **Batch 5: CLOSED**
- **Batch 6: CLOSED**
- **Batch 7: CLOSED**
- **Batch 8: CLOSED**
- **Batch 9: CLOSED**
- **Batch 10: CLOSED**
- **2 platform/production batches remaining (Batch 11–12)**
- next: **Batch 11 — Production Operations & Observability**

Heuristic percentage/granular workload estimates sengaja tidak dihitung ulang pada closure Batch 10. Status batch dan evidence di tracker ini adalah source of truth; estimasi bukan completion metric formal dan tidak boleh dipakai sebagai klaim kualitas/efisiensi produksi.

---

# 8. Recommended execution order

Urutan dependency yang harus dipertahankan kecuali ada ADR yang menggantinya:

```text
Fase 4 CI hotfix
  ↓
Outbound MCP
  ↓
Plugin Framework
  ↓
Capability / Permission Plane
  ↓
Multimodal
  ↓
Realtime Voice
  ↓
Data Refactor + Governance / DR
  ↓
Node Registry + Visual Flow
  ↓
Space Blocks
  ↓
Production Ops / Observability
  ↓
Final Security / Release Closure
```

Visual Flow **jangan** dipercepat sebelum provider/MCP/plugin/permission/data contracts cukup stabil. Membangun canvas terlalu awal akan membekukan kontrak yang masih berubah dan memicu refactor UI/runtime besar.

---

# 9. Definition of Done per batch

Sebuah batch **tidak boleh** ditandai `CLOSED` sebelum semua poin relevan berikut terpenuhi:

1. bekerja di dedicated branch, bukan langsung di `main`;
2. code/design mengikuti owner-service boundaries;
3. bug/error yang ditemukan selama workstream diperbaiki sebelum closure;
4. unit/regression/integration test relevan tersedia;
5. runtime/E2E acceptance dilakukan bila feature membutuhkan boundary nyata;
6. Format PASS;
7. Lint PASS;
8. Typecheck PASS;
9. Test PASS;
10. Secret Scan PASS;
11. Production Build PASS;
12. Naming/architecture-specific gates PASS;
13. visual verification bila menyentuh UI;
14. temporary formatter/fixer/workflow helper sudah dihapus;
15. documentation dan ADR diperbarui sesuai implementasi aktual;
16. **file `docs/EXECUTION-PROGRESS.md` ini diperbarui**;
17. exact final branch HEAD memiliki evidence green;
18. PR merge menggunakan expected-head lock bila tersedia;
19. `main` menunjuk merge yang benar;
20. post-merge `main` CI/runtime smoke PASS.

Jika post-merge menemukan failure, status tetap `IMPLEMENTED / CLOSURE PENDING` atau `IN PROGRESS`; jangan mengklaim pekerjaan `CLOSED` sampai failure diselesaikan.

---

# 10. Progress update protocol

Setiap selesai mengerjakan batch/workstream, update file ini minimal pada:

1. **Current repository state** — main SHA, active branch, blocker;
2. **status batch** — `IN PROGRESS` → `CLOSED` / lainnya;
3. **implemented scope** — apa yang benar-benar ada, bukan rencana;
4. **bugs/fixes discovered**;
5. **verification evidence** — exact SHA + CI/run IDs;
6. **merge evidence** — PR + merge SHA;
7. **post-merge evidence**;
8. **remaining workload** bila scope berubah;
9. **next recommended batch**.

Jika desain arsitektur berubah, update ADR terkait terlebih dahulu/bersamaan; file progress ini mencatat status dan referensi, bukan menggantikan ADR.

---

# 11. Next action

**Immediate next:** mulai **Batch 7 — Data Refactor / Rebuild Engine** dari baseline `main` setelah Batch 6 CLOSED. Historical Ledger dan Context L0 tetap immutable; maintenance wajib melalui owner-service contract/API tanpa cross-service database access.
