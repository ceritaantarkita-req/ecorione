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

Current `main` SHA setelah External MCP HTTPS merge:

- `55ee05fe34e595e2c3e2ef6b9742673f1b78f156`

Current `main` condition:

- Format: PASS
- Lint: PASS
- Typecheck: PASS
- Naming: PASS
- Test: **FAIL — 1 flaky Fase 4 Temporal process acceptance**
- Secret Scan: skipped karena test gate berhenti
- Production Build: skipped karena test gate berhenti

Failure yang sedang ditangani:

- file: `test/phase4-temporal-runtime.test.ts`
- scenario: forced worker crash → replacement worker → durable approval
- failure: `Timed out waiting for durable Hub approval.`
- evidence: post-merge CI run `34346631709`
- 395/396 tests PASS sebelum gate berhenti
- failure terjadi sebelum jalur MCP/provider baru menjadi penyebab; ini merupakan acceptance flake lama yang sudah terlihat lebih dari sekali pada workstream sebelumnya

### Active branch

- `agent/phase4-ci-flake-hardening-20260909`
- base: `55ee05fe34e595e2c3e2ef6b9742673f1b78f156`
- purpose: harden Fase 4 process readiness/recovery acceptance dan mengembalikan `main` ke full green

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

Status: **IMPLEMENTED / CLOSURE PENDING**

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

Closure masih pending hanya karena post-merge `main` membuka Fase 4 Temporal flake yang tidak berasal dari MCP workstream.

Verification: `docs/verification/mcp-external-https-2026-09-09.md`

---

# 6. Remaining execution roadmap

Dari current state, sisa roadmap dibagi menjadi **12 batch besar** termasuk hotfix aktif sekarang.

---

## Batch 1 — Fase 4 Temporal CI Flake Hardening

Status: **IN PROGRESS**

Goal: mengembalikan `main` ke deterministic full-green baseline.

Work:

- audit replacement-worker startup semantics
- jangan menganggap OS child-process `spawn` berarti Temporal worker sudah siap polling
- buat explicit readiness/recovery evidence atau handshake yang sesuai boundary
- harden polling/diagnostics tanpa menyembunyikan runtime failure nyata
- pastikan forced worker crash benar-benar terjadi
- replacement worker mengambil durable workflow state
- approval tercatat di Hub
- Flow decision commit + Temporal signal tetap benar
- AI → Sandbox → RnD verification tetap selesai
- repeated/stress acceptance untuk membuktikan flake hilang
- full CI
- merge hotfix
- post-merge `main` full green
- update file ini dengan final SHA/run evidence

Closure result yang diharapkan:

- Fase 4 process acceptance stabil
- External MCP HTTPS workstream dapat dinaikkan dari `IMPLEMENTED / CLOSURE PENDING` menjadi `CLOSED`

---

## Batch 2 — Outbound MCP Client + MCP Manager

Status: **PLANNED**

Goal: ecorione dapat memakai MCP server pihak lain, bukan hanya menyediakan inbound MCP server.

Scope:

- stdio MCP client
- Streamable HTTP MCP client
- MCP server registry
- workspace-scoped visibility
- connect/disconnect
- discovery tools/resources
- health/status
- per-tool enable/disable
- timeout/error isolation
- credential references melalui Connect/Vault
- audit + provenance
- permission boundary

---

## Batch 3 — Plugin / Extension Framework

Status: **PLANNED**

Scope:

- Plugin Registry
- manifest/version/source metadata
- pinned Git revision/release
- capability declaration
- permission requirements
- secret requirements
- install/update/remove
- rollback
- integrity/provenance
- extension health
- workspace visibility

Security rule:

> Arbitrary GitHub repository **tidak boleh** langsung dieksekusi di host process. Source harus melalui pinned revision, validation/security gate, dan Sandbox bila membawa executable code.

---

## Batch 4 — Unified Capability + Permission Plane

Status: **PLANNED**

Scope:

- capability registry untuk model/MCP/plugin/node/tool/sandbox
- permission scopes
- read/write/network/filesystem distinctions
- side-effect declaration
- high-impact action approval
- secret-access policy
- sandbox policy
- revoke capability
- audit
- fail-closed default

Tujuan: MCP, Plugin, Flow Node, Sandbox, dan AI memakai permission semantics yang konsisten.

---

## Batch 5 — Native Multimodal Pipeline

Status: **PLANNED**

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

- **1 active hotfix batch**
- **11 subsequent platform/production batches**
- total: **±12 major batches** dari state saat file ini dibuat

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
