# ECORIONE — Execution Progress & Remaining Roadmap

Last updated: **2026-09-09**

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

Batch 4 implementation merged ke `main` sebagai:

- `455b5cef72d5847b67ddedebc81471432fb0ba42`
- post-merge main CI `34380385839`: full green

### Active execution

- Batch 1 status: **CLOSED**
- Batch 2 status: **CLOSED**
- Batch 3 status: **CLOSED**
- Batch 4 status: **CLOSED**
- next implementation target: **Batch 5 — Native Multimodal Pipeline**

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

Dari current state, **Batch 1–4 sudah CLOSED**. Tersisa **8 batch platform/production (Batch 5–12)**; next implementation target adalah **Batch 5 — Native Multimodal Pipeline**.

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

Status: **PLANNED — NEXT**

Ownership:

- Artifact → raw image/PDF/audio/video
- Connect → OCR/vision/STT/TTS inference adapters
- Context → extracted/derived semantic information
- Historical Ledger → extraction/transcript provenance/history references
- Hub → routing/policy/sensitivity

Scope:

- first-class image input
- PDF/document input
- OCR
- page/bounding-box/confidence metadata
- Indonesian + English language detection
- STT
- transcript + timestamps
- TTS
- attachment lifecycle
- provenance
- local-first with explicit hosted fallback

---

## Batch 6 — Realtime Voice

Status: **PLANNED**

Scope:

- microphone/stream input
- streaming STT
- VAD
- partial transcript
- streaming model response
- streaming TTS
- interruption / barge-in
- voice session lifecycle
- Indonesian/English switching
- latency telemetry

---

## Batch 7 — Data Refactor / Rebuild Engine

Status: **PLANNED**

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

## Batch 8 — Dataset Governance + Backup / Restore / DR

Status: **PLANNED**

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

---

## Batch 9 — Node Registry + Visual Flow Canvas

Status: **PLANNED**

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

---

## Batch 10 — Space Block Runtime

Status: **PLANNED**

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

---

## Batch 11 — Production Operations & Observability

Status: **PLANNED / PARTIAL FOUNDATION EXISTS**

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
- **9 platform/production batches remaining (Batch 4–12)**
- next: **Batch 4 — Unified Capability + Permission Plane**

Dalam workstream teknis granular, estimasi tersisa sekitar **30–35 pekerjaan signifikan**, tergantung temuan audit/CI selama implementasi.

Heuristic progress estimate — **bukan telemetry atau completion metric formal**:

- overall platform menuju production/self-host baseline: kira-kira **60–65%**
- backend/core architectural foundation: kira-kira **75–80%**

Angka ini hanya planning heuristic berdasarkan scope roadmap, bukan klaim produktivitas atau kualitas produksi.

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

**Immediate next:** selesaikan Batch 1 — Fase 4 Temporal CI Flake Hardening pada branch `agent/phase4-ci-flake-hardening-20260909`, lalu update dokumen ini dengan evidence final sebelum merge.
