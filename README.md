# ecorione

**Satu memori bersama untuk semua AI yang lu pakai — lokal maupun hosted — plus lapisan kontrol, eksekusi, observability, dan optimizer biaya yang bisa diaudit.**

Pindah lintas provider/model tanpa kehilangan kesinambungan kerja, sambil menjaga boundary local-first, approval, audit trail, durable execution, MCP, dan biaya kontrafaktual tetap eksplisit.

> **Current status — 2026-09-11:** **production/self-host repository baseline READY · planned platform/production Batch 1–12 CLOSED · real laptop + Historical Ledger/ECX local evidence CLOSED · Comparative ECX harness MERGED/VERIFIED · final corrected local Comparative ECX checkpoint CLOSED / PASS WITH LIMITATIONS · local persistence/restart is the active next checkpoint · compute-host/VPS deployment DEFERRED BY OPERATOR · AutoClick DEFERRED BY DESIGN.**

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
- PR #41 exact-head CI `34565244451`: PASS;
- PR #41 post-merge `main` CI `34565539119`: PASS;
- real local browser→Hub→Connect→Ollama/Gemma path: PASS;
- real local Historical Ledger hash chain + ECX plan/handoff/hydration: PASS;
- `pnpm production:data-evidence`: PASS pada captured local checkpoint;
- first cached comparative smoke: valid FAIL, cache-isolation defect found and preserved;
- corrected uncached comparative smoke after PR #40: PASS;
- first closure-grade 75-call run: valid FAIL, 4/5 tasks PASS, `release-readiness` delimiter ambiguity found and preserved;
- targeted corrected `release-readiness` after PR #41: PASS;
- final corrected 75-call run: **5/5 task gates PASS**, all measured calls uncached;
- final local Comparative ECX verdict: **CLOSED / PASS WITH LIMITATIONS**.

Final corrected benchmark aggregate:

```text
measured model calls: 75
passed task gates: 5/5
median selective transport reduction: 73.6379379246037%
median selective input-token reduction: 77.8580814717477%
median selective/full latency ratio: 0.8672873729681319
```

Important limitation: one individual `retention-policy` selective repeat returned two exact-string values with sentence-final periods and scored `1/3`. The predeclared quality gate uses the median over five repeats, so that task still formally passed. Therefore the checkpoint is **PASS WITH LIMITATIONS**, not a claim that all 75 individual completions had perfect exact-string quality.

Detail current state/evidence:

- [`docs/current-state-and-next-steps.md`](docs/current-state-and-next-steps.md)
- [`docs/verification/comparative-closure-grade-final-2026-09-11.md`](docs/verification/comparative-closure-grade-final-2026-09-11.md)
- [`docs/comparative-ecx-evidence.md`](docs/comparative-ecx-evidence.md)
- [`docs/verification/comparative-closure-grade-first-run-2026-09-11.md`](docs/verification/comparative-closure-grade-first-run-2026-09-11.md)
- [`docs/verification/comparative-smoke-cache-defect-2026-09-11.md`](docs/verification/comparative-smoke-cache-defect-2026-09-11.md)
- [`docs/verification/comparative-harness-implementation-2026-09-11.md`](docs/verification/comparative-harness-implementation-2026-09-11.md)
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

Raw evidence tetap local/gitignored:

```text
.ecorione/evidence/comparative-local-2026-09-11-v2.json
bytes: 94654
sha256: 189795c71dc72acfd3d1533490a002d87e68421682868eb2b8b830c6fbdab439
```

`ecx-selective-oracle` adalah **upper-bound/control lane**, bukan bukti selector otomatis. Local provider-token `actualUsd=0` juga bukan hosted cost-savings proof. Aggregate percentages dari benchmark ini tidak boleh dipromosikan menjadi universal/public savings claim.

Satu individual selective retention repeat memiliki exact-string punctuation mismatch; lihat final verification note. Jadi wording yang benar adalah **task-level benchmark PASS WITH LIMITATIONS**, bukan “75/75 outputs perfect”.

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

External acceptance benar-benar menguji public HTTPS: OAuth protected-resource discovery, Bearer challenge, JWKS/JWT verification, discovery/list/call, dan negative auth/origin/routing cases. Acceptance dibuat provider-resilient setelah Cloudflare Quick Tunnel terbukti dapat mengalami fresh-host DNS/route provisioning failure; public-network test tetap tidak boleh diturunkan menjadi localhost-only.

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

1. **local persistence/restart drill — ACTIVE NEXT CHECKPOINT**;
2. isolated local backup/restore drill;
3. local observability baseline;
4. product/UX validation from real use;
5. immutable local model identity hardening;
6. VPS/compute-host + Cloudflare deployment only when explicitly resumed;
7. hosted-provider comparative validation only with operator credentials + spend intent;
8. optional automatic-selector/optimizer work only if a new explicit evidence-driven scope justifies it;
9. ongoing maintenance/security/dependency/DR evidence;
10. new features only when evidence justifies them.

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
- Comparative benchmark cache isolation harus berlaku antar invocation; measured `cacheHit=true` adalah invalid untuk model-compute comparison.
- Exact-match fixture harus punya source delimiter yang tidak ambigu; jangan menormalisasi scorer setelah failure demi memaksa PASS.
- Comparative benchmark tidak boleh mengubah oracle ref selection menjadi klaim automatic optimizer.
- AutoClick tetap deferred sampai use case non-API nyata lolos design gate.

## Batasan yang tetap nyata

READY baseline bukan klaim bahwa:

- real hosted-provider quality/latency telah dibuktikan deterministic CI;
- process-local rate limiter adalah distributed global limiter;
- semua DNS-rebinding/network risk sudah hilang;
- repository secret scan menggantikan organization/account secret controls;
- backup aman jika tetap berada di failure domain yang sama;
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
| 3 | [`docs/verification/comparative-closure-grade-final-2026-09-11.md`](docs/verification/comparative-closure-grade-final-2026-09-11.md) | Final corrected local Comparative ECX evidence + limitations |
| 4 | [`docs/comparative-ecx-evidence.md`](docs/comparative-ecx-evidence.md) | Comparative protocol + closed claim boundary |
| 5 | [`docs/verification/comparative-closure-grade-first-run-2026-09-11.md`](docs/verification/comparative-closure-grade-first-run-2026-09-11.md) | First 5× run + fixture finding |
| 6 | [`docs/verification/comparative-smoke-cache-defect-2026-09-11.md`](docs/verification/comparative-smoke-cache-defect-2026-09-11.md) | First real smoke failure + cache root cause |
| 7 | [`docs/verification/comparative-harness-implementation-2026-09-11.md`](docs/verification/comparative-harness-implementation-2026-09-11.md) | Harness implementation closure |
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
