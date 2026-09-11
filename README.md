# ecorione

**Satu memori bersama untuk semua AI yang lu pakai — lokal maupun hosted — plus lapisan kontrol, eksekusi, observability, dan optimizer biaya yang bisa diaudit.**

Pindah lintas provider/model tanpa kehilangan kesinambungan kerja, sambil menjaga boundary local-first, approval, audit trail, durable execution, MCP, dan biaya kontrafaktual tetap eksplisit.

> **Current status — 2026-09-11:** **production/self-host repository baseline READY · planned platform/production Batch 1–12 CLOSED · real laptop + Historical Ledger/ECX local evidence CLOSED · final corrected local Comparative ECX checkpoint CLOSED / PASS WITH LIMITATIONS · local persistence/restart CLOSED / PASS across the tested Phase 4 + Temporal + PostgreSQL-container boundary · isolated local backup/restore is the active next checkpoint · compute-host/VPS deployment DEFERRED BY OPERATOR · AutoClick DEFERRED BY DESIGN.**

Untuk agent/manusia yang baru masuk repo: mulai dari [`docs/current-state-and-next-steps.md`](docs/current-state-and-next-steps.md). Jangan menyimpulkan current state dari blueprint/audit lama saja.

## Current closure evidence

Key post-closure progression:

- implementation PR #29 merged sebagai `ad67b68290a41e69e18dfa49caefed0090bd9635`;
- closure PR #30 merged sebagai `783a4ae8a2c90b3c696b3d619fb0c03581f675b2`;
- local Production Activation/runtime-fix sequence PR #32–#36 merged;
- Historical Ledger + ECX local evidence closure PR #37 merged sebagai `88d588bbe4a5f005652c20f3409dd72093439f56`;
- comparative harness PR #38 merged sebagai `c1849cd0c67712e40ea4e5c90587283900859cdb`;
- comparative harness docs closure PR #39 merged sebagai `5437c1ea5d8ee168dbbe09de688a23c39089c7aa`;
- comparative cache-isolation fix PR #40 merged sebagai `197627dc04689dea94bf7957e18b2699f8fb9213`;
- release fixture delimiter correction PR #41 merged sebagai `4d5ee560a3b6cef024b0d7ed7bbec53a17f32675`;
- final corrected 75-call Comparative ECX run: **5/5 task gates PASS**, all measured calls uncached;
- final local Comparative ECX verdict: **CLOSED / PASS WITH LIMITATIONS**;
- local persistence harness/strict gate PR #43–#45 merged;
- first real persistence/restart drill: **valid FAIL**, wrong package-relative durable paths exposed;
- repo-root runtime path fix PR #46 merged sebagai `778e7eb19a0e2f528c64e68459d8ff6e6ecbe1ce`;
- first-drill finding preserved historically in PR #47;
- local compiled-runtime bootstrap fix PR #48 merged sebagai `673af91642ea1b9440079e396675c69f53647951`;
- preserved first-drill Ledger/Context/Artifact/Flow/approval state became readable again through owner APIs after the fix;
- fresh second strict persistence baseline + controlled Phase 4/Temporal/PostgreSQL restart: **PASS**;
- strict post: exact Ledger/Context/Artifact/Flow/approval identities survived;
- strict cleanup: dedicated Flow probe terminalized;
- final local persistence/restart verdict: **CLOSED / PASS**.

Comparative benchmark aggregate:

```text
measured model calls: 75
passed task gates: 5/5
median selective transport reduction: 73.6379379246037%
median selective input-token reduction: 77.8580814717477%
median selective/full latency ratio: 0.8672873729681319
```

Important limitation: one individual `retention-policy` selective repeat returned two exact-string values with sentence-final periods and scored `1/3`. The predeclared quality gate uses the median over five repeats, so that task still formally passed. Therefore the Comparative checkpoint is **PASS WITH LIMITATIONS**, not a claim that all 75 individual completions had perfect exact-string quality.

Persistence limitation: the successful drill proves the controlled local owner-storage + process + Temporal-container + PostgreSQL-container restart boundary. It does not prove backup/restore, host loss, off-host DR, hard power-loss/fsync behavior, VPS durability, Cloudflare behavior or arbitrary corruption recovery.

Detail current state/evidence:

- [`docs/current-state-and-next-steps.md`](docs/current-state-and-next-steps.md)
- [`docs/verification/local-persistence-restart-closure-2026-09-11.md`](docs/verification/local-persistence-restart-closure-2026-09-11.md)
- [`docs/local-persistence-restart-evidence.md`](docs/local-persistence-restart-evidence.md)
- [`docs/verification/local-persistence-restart-first-drill-2026-09-11.md`](docs/verification/local-persistence-restart-first-drill-2026-09-11.md)
- [`docs/verification/comparative-closure-grade-final-2026-09-11.md`](docs/verification/comparative-closure-grade-final-2026-09-11.md)
- [`docs/comparative-ecx-evidence.md`](docs/comparative-ecx-evidence.md)
- [`docs/verification/historical-ledger-ecx-local-evidence-2026-09-11.md`](docs/verification/historical-ledger-ecx-local-evidence-2026-09-11.md)
- [`docs/verification/local-production-rehearsal-2026-09-10.md`](docs/verification/local-production-rehearsal-2026-09-10.md)
- [`docs/EXECUTION-PROGRESS.md`](docs/EXECUTION-PROGRESS.md)

## Apa yang sudah ada

| Modul/area | Current baseline |
|---|---|
| **Ai** | Chat, `/space`, `/ops`, `/settings` Control Center |
| **Hub** | Policy, approval, audit, orchestration, Historical Ledger, ECX, capability/permission authority |
| **Connect** | Hosted/local provider gateway, exact cache/routing/cost telemetry, credential vault, durable spend budget, MCP inbound/outbound, runtime settings |
| **Context** | Memori L0–L2 + L3 metadata binding |
| **Sync** | Pairing/self-host relay + MCP HTTPS bridge |
| **Artifact** | Content-addressed storage SHA-256 |
| **Sandbox** | Tier 0, WASM, hardened Docker boundary |
| **Space** | Notes/block runtime tanpa menggandakan Context source of truth |
| **Flow** | Durable workflow di Temporal |
| **RnD** | Trace/eval foundation + dataset governance |
| **Multimodal / Voice** | Baseline image/document/audio + realtime voice pipeline |
| **Data / DR** | Rebuild/governance/backup-restore procedures |
| **Production Ops** | Compose/Caddy, metrics/traces, provider canary, release/install/upgrade/rollback tooling |
| **Security closure** | Full-history + working-tree secret scans, dependency/release checks, HTTP/SSRF hardening, real public HTTPS MCP acceptance |
| **Comparative evidence** | Harness merged; cache isolation verified; final corrected local 5× run passed 5/5 task gates; checkpoint CLOSED / PASS WITH LIMITATIONS |
| **Local persistence evidence** | Strict baseline/post/cleanup harness; repo-root durable-path contract fixed; final local process + Temporal + PostgreSQL-container restart checkpoint CLOSED / PASS |
| **AutoClick** | **Deferred by design** sampai ada use case non-API nyata |

## Arsitektur inti

Hub adalah supervisor/policy boundary. Tidak ada service yang boleh membuka database service lain secara langsung.

```text
Ai
 -> Hub
    -> Context
    -> Connect -> local/hosted models
    -> Artifact
    -> Sandbox
    -> Space
    -> Flow -> Temporal
    -> RnD

Hosted MCP client
 -> public HTTPS edge
 -> Sync
 -> Connect MCP
 -> Hub governance
```

### Memori

```text
L0  log episodik      append-only ground truth
L1  fakta semantik    bi-temporal, invalidate ≠ delete
L2  core memory       kecil, editable manusia, source of truth di Context
L3  artifact          content-addressed, just-in-time retrieval
```

Historical Ledger di Hub menyimpan chronological/replay history dan tidak menggantikan Context episodic/semantic memory. ECX adalah pointer-first internal agent exchange.

**Current ECX claim boundary:** selective hydration ada, tetapi API `/v1/exchange/hydrate` menerima `refIndexes` dari caller. ECORIONE belum boleh diklaim memiliki automatic semantic reference selector hanya karena selective hydration dapat menghemat context ketika reference yang benar sudah diketahui.

## Comparative ECX evidence

Closed local protocol/results: [`docs/comparative-ecx-evidence.md`](docs/comparative-ecx-evidence.md).

Benchmark membandingkan tiga lane dengan task/facts/model yang sama:

```text
full-inline
vs
ECX packet + hydrate all refs
vs
ECX packet + hydrate fixture-declared relevant refs (oracle control)
```

Yang diukur: transport bytes, input/output tokens, latency, cache state, model identity, dan deterministic answer quality.

Final corrected run pada merged revision `4d5ee560a3b6cef024b0d7ed7bbec53a17f32675` menjalankan 5 task × 5 repeat × 3 lane = 75 measured calls. 5/5 task-level gates PASS, semua measured calls uncached, dan median input-token control delta `full-inline` vs `ecx-all` adalah nol untuk setiap task.

`ecx-selective-oracle` adalah **upper-bound/control lane**, bukan bukti selector otomatis. Local provider-token `actualUsd=0` juga bukan hosted cost-savings proof. Aggregate percentages dari benchmark ini tidak boleh dipromosikan menjadi universal/public savings claim.

Satu individual selective retention repeat memiliki exact-string punctuation mismatch; lihat final verification note. Jadi wording yang benar adalah **task-level benchmark PASS WITH LIMITATIONS**, bukan “75/75 outputs perfect”.

## Local persistence/restart evidence

Closed protocol/results:

- [`docs/local-persistence-restart-evidence.md`](docs/local-persistence-restart-evidence.md)
- [`docs/verification/local-persistence-restart-closure-2026-09-11.md`](docs/verification/local-persistence-restart-closure-2026-09-11.md)

Historical first failure remains preserved in [`docs/verification/local-persistence-restart-first-drill-2026-09-11.md`](docs/verification/local-persistence-restart-first-drill-2026-09-11.md).

Final successful drill used a fresh strict baseline on merged revision `673af91642ea1b9440079e396675c69f53647951`, stopped only the ECORIONE Phase 4 process group + exact Temporal + exact PostgreSQL container, preserved the existing named DB volume, restarted dependency-safely, and required strict post + cleanup PASS.

The same Ledger event/head hash, Context episode digest, Artifact ID/digest, Flow ID and pending Hub approval operation identity survived the tested boundary.

## Provider dan local runtime

Connect tetap satu-satunya outbound model gateway.

Hosted provider baseline:

- Anthropic;
- OpenRouter;
- OpenAI.

Production credential berada di Connect Vault. Raw provider API key dari environment hanya development fallback sesuai konfigurasi; tidak boleh menjadi credential store produksi ketika Vault aktif.

Local inference memakai endpoint **OpenAI-compatible**. Ollama adalah salah satu implementation yang mungkin digunakan, bukan dependency arsitektural wajib.

Tidak ada silent provider fallback. Model identity harus dipin untuk durable production evidence. `gemma4:latest` yang muncul pada laptop rehearsal/benchmark adalah runtime evidence sementara; mutable alias itu akan di-hardening pada checkpoint lokal terpisah.

## MCP

### Inbound

Connect mempunyai MCP stateless HTTP/stdio. HTTP Connect tetap loopback-only. Public hosted-client reachability melewati Sync + HTTPS edge.

External acceptance benar-benar menguji public HTTPS: OAuth protected-resource discovery, Bearer challenge, JWKS/JWT verification, discovery/list/call, dan negative auth/origin/routing cases. Public-network test tetap tidak boleh diturunkan menjadi localhost-only.

### Outbound

Connect juga mempunyai outbound MCP manager dengan official client SDK yang dipin, HTTPS/allowlisted stdio, workspace-scoped registry, Vault credential refs, explicit tool policy, Hub approval/audit, dan durable side-effect reservation. Ambiguous side effect tidak di-retry otomatis.

Lihat [`docs/outbound-mcp-operations.md`](docs/outbound-mcp-operations.md).

## Menjalankan lokal

Butuh Node >=22 dan pnpm 10.

```bash
pnpm install
pnpm verify
cp .env.example .env
pnpm dev
```

Runtime bertahap tersedia:

```bash
pnpm dev:phase2
pnpm dev:phase3
pnpm dev:phase4
```

Local dev entrypoints build compiled runtime workspace dependencies before starting service processes so a fresh `git pull` cannot leave stale shared-package `dist` exports behind.

Flow membutuhkan Temporal melalui `ECORIONE_TEMPORAL_ADDRESS`.

## Production/self-host — currently deferred

Baseline production menggunakan Docker Compose + Caddy. Tooling dan runbook tetap tersedia:

- [`docs/production-activation.md`](docs/production-activation.md)
- [`docs/production-operations.md`](docs/production-operations.md)
- [`docs/release-operations.md`](docs/release-operations.md)
- [`docs/cloudflare-free-deployment.md`](docs/cloudflare-free-deployment.md)

**Operator memilih belum memakai VPS/compute host sekarang.** Karena itu deployment, Cloudflare named Tunnel, public cutover, dan host firewall mutation adalah **DEFERRED**, bukan active next step dan bukan blocker.

Jika nanti dilanjutkan, Cloudflare Free tetap opsi DNS/HTTPS edge + Tunnel, bukan replacement compute. ECORIONE databases, Temporal, Vault, Artifact, Sandbox, dan services tetap berada di self-host origin.

## Next work after Batch 12

There is **no automatic Batch 13**. Future work must be opened as a new explicit scope.

Current operator-approved order:

1. local persistence/restart drill — **CLOSED / PASS**;
2. **isolated local backup/restore drill — ACTIVE NEXT CHECKPOINT**;
3. local observability baseline;
4. product/UX validation from real use;
5. immutable local model identity hardening;
6. VPS/compute-host + Cloudflare deployment only when explicitly resumed;
7. hosted-provider comparative validation only with operator credentials + spend intent;
8. optional automatic-selector/optimizer work only if a new explicit evidence-driven scope justifies it;
9. ongoing maintenance/security/dependency/DR evidence;
10. new features only when evidence justifies them.

Backup/restore evidence must restore into isolated targets rather than overwrite active durable state, preserve owner boundaries, record receipts/digests, and distinguish same-host restore correctness from off-host disaster recovery.

See [`docs/current-state-and-next-steps.md`](docs/current-state-and-next-steps.md).

## Invarian penting

- Memory adalah **untrusted data**, bukan instruksi.
- Hosted egress tunduk pada scope/sensitivity/sync-class policy.
- Tulisan hosted masuk quarantine sebelum menjadi trusted/core memory.
- Tidak ada silent provider fallback.
- Credential production dimiliki Connect dan terenkripsi at-rest.
- Hosted dispatch tunduk pada kill switch + cumulative budget.
- Connect MCP HTTP tidak bind publik; public reachability melalui Sync + HTTPS edge.
- MCP OAuth tetap diverifikasi di Connect; tunnel/Cloudflare bukan ECORIONE permission authority.
- Side effect memakai idempotency identity.
- Irreversible/high-risk action tetap melewati policy/approval yang sesuai.
- Prefix caching harus byte-stable.
- Model identity dipin untuk durable deployment/evidence claims.
- Owner-service boundary melarang cross-service database access.
- Historical Ledger dan Context L0 ground truth tidak direwrite untuk convenience migration.
- Configured relative local durable paths resolve from repo root; absolute production paths stay absolute.
- Comparative benchmark cache isolation harus berlaku antar invocation; measured `cacheHit=true` adalah invalid untuk model-compute comparison.
- Exact-match fixture harus punya source delimiter yang tidak ambigu; jangan menormalisasi scorer setelah failure demi memaksa PASS.
- Comparative benchmark tidak boleh mengubah oracle ref selection menjadi klaim automatic optimizer.
- Valid failed runtime evidence tidak boleh dihapus/rewrite setelah bug diperbaiki.
- Backup/restore drill tidak boleh overwrite active durable owner state.
- AutoClick tetap deferred sampai use case non-API nyata lolos design gate.

## Batasan yang tetap nyata

READY baseline bukan klaim bahwa:

- real hosted-provider quality/latency telah dibuktikan deterministic CI;
- process-local rate limiter adalah distributed global limiter;
- semua DNS-rebinding/network risk sudah hilang;
- repository secret scan menggantikan organization/account secret controls;
- backup aman jika tetap berada di failure domain yang sama;
- local persistence/restart PASS membuktikan backup/restore atau off-host DR;
- hard power-loss/fsync atau arbitrary corruption recovery sudah dibuktikan;
- host OS/firewall/SSH/Cloudflare/provider-account hardening dilakukan otomatis;
- ECX/optimizer savings sudah terbukti hanya dari traffic/hydration counts;
- cached benchmark response membuktikan real model token/latency savings;
- oracle selective hydration membuktikan automatic reference selection;
- final local synthetic benchmark membuktikan universal/general production savings;
- task-level median quality PASS berarti setiap individual model completion sempurna;
- laptop evidence membuktikan VPS/Cloudflare production behavior;
- Fase 6+ selesai permanen.

## Dokumen — reading order untuk agent baru

| Urutan | File | Fungsi |
|---:|---|---|
| 1 | [`docs/current-state-and-next-steps.md`](docs/current-state-and-next-steps.md) | Current canonical handoff + next scope |
| 2 | [`AGENTS.md`](AGENTS.md) | Invarian dan aturan kerja repo |
| 3 | [`docs/verification/local-persistence-restart-closure-2026-09-11.md`](docs/verification/local-persistence-restart-closure-2026-09-11.md) | Final local persistence/restart closure evidence |
| 4 | [`docs/local-persistence-restart-evidence.md`](docs/local-persistence-restart-evidence.md) | Persistence protocol + closed claim boundary |
| 5 | [`docs/verification/local-persistence-restart-first-drill-2026-09-11.md`](docs/verification/local-persistence-restart-first-drill-2026-09-11.md) | Historical valid first-drill failure/root cause |
| 6 | [`docs/verification/comparative-closure-grade-final-2026-09-11.md`](docs/verification/comparative-closure-grade-final-2026-09-11.md) | Final corrected local Comparative ECX evidence + limitations |
| 7 | [`docs/comparative-ecx-evidence.md`](docs/comparative-ecx-evidence.md) | Comparative protocol + closed claim boundary |
| 8 | [`docs/verification/historical-ledger-ecx-local-evidence-2026-09-11.md`](docs/verification/historical-ledger-ecx-local-evidence-2026-09-11.md) | Real local Ledger + ECX closure |
| 9 | [`docs/verification/local-production-rehearsal-2026-09-10.md`](docs/verification/local-production-rehearsal-2026-09-10.md) | Real laptop runtime evidence |
| 10 | [`docs/EXECUTION-PROGRESS.md`](docs/EXECUTION-PROGRESS.md) | Detailed current progress + closure history |
| 11 | [`docs/production-activation.md`](docs/production-activation.md) | Deferred production activation runbook |
| 12 | [`docs/production-operations.md`](docs/production-operations.md) | Production/self-host operations |
| 13 | [`docs/cloudflare-free-deployment.md`](docs/cloudflare-free-deployment.md) | Future free Cloudflare edge/Tunnel option |
| 14 | [`docs/release-operations.md`](docs/release-operations.md) | Install/upgrade/rollback/release gate |
| 15 | [`docs/prd.md`](docs/prd.md) | Product + architecture requirements |
| 16 | [`docs/research.md`](docs/research.md) | Research/due diligence |
| 17 | [`docs/blueprint.md`](docs/blueprint.md) | Historical execution blueprint; not current status source |
| 18 | [`docs/DECISIONS.md`](docs/DECISIONS.md) | Decision log |
| 19 | [`docs/adr/`](docs/adr/) | Architecture Decision Records |
| 20 | [`docs/verification/`](docs/verification/) | Exact-head/runtime evidence |

## Lisensi

MIT untuk kode yang sudah dirilis di repository ini. Layanan managed/hosted yang mungkin dibuat kemudian tidak mengubah lisensi kode MIT yang sudah dipublikasikan. Lihat [`docs/LICENSING.md`](docs/LICENSING.md).
