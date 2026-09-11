# ecorione

**Satu memori bersama untuk semua AI yang lu pakai — lokal maupun hosted — plus lapisan kontrol, eksekusi, observability, dan optimizer biaya yang bisa diaudit.**

Pindah lintas provider/model tanpa kehilangan kesinambungan kerja, sambil menjaga boundary local-first, approval, audit trail, durable execution, MCP, dan biaya kontrafaktual tetap eksplisit.

> **Current status — 2026-09-11:** **production/self-host repository baseline READY · planned Batch 1–12 CLOSED · real laptop + Historical Ledger/ECX local evidence CLOSED · Comparative ECX CLOSED / PASS WITH LIMITATIONS · local persistence/restart CLOSED / PASS · isolated local backup/restore CLOSED / PASS WITH EXPLICIT ABSENT-OWNER LIMITATIONS · local observability baseline is the active next checkpoint · compute-host/VPS + Cloudflare DEFERRED BY OPERATOR · AutoClick DEFERRED BY DESIGN.**

Untuk agent/manusia yang baru masuk repo: mulai dari [`docs/current-state-and-next-steps.md`](docs/current-state-and-next-steps.md), lalu [`AGENTS.md`](AGENTS.md). Jangan pakai blueprint/audit lama sebagai current-state source.

## Current closure evidence

Key local closure progression:

- Historical Ledger + ECX local evidence: **CLOSED / PASS**;
- Comparative ECX: **CLOSED / PASS WITH LIMITATIONS**;
- first persistence/restart drill: **valid FAIL**, wrong relative durable-path reopening exposed;
- runtime path fix PR #46 + local runtime dependency bootstrap PR #48;
- final persistence/restart rerun: **CLOSED / PASS**;
- isolated backup/restore implementation PR #50 merged as `4e6bcd94776fc7dd75440ee35dd8fddf0b602233`;
- full isolated backup/restore run: **PASS**;
- post-run temp resources: **clean**;
- active owners after drill: **healthy**.

Canonical current evidence:

- [`docs/current-state-and-next-steps.md`](docs/current-state-and-next-steps.md)
- [`docs/verification/local-backup-restore-closure-2026-09-11.md`](docs/verification/local-backup-restore-closure-2026-09-11.md)
- [`docs/local-backup-restore-evidence.md`](docs/local-backup-restore-evidence.md)
- [`docs/verification/local-persistence-restart-closure-2026-09-11.md`](docs/verification/local-persistence-restart-closure-2026-09-11.md)
- [`docs/local-persistence-restart-evidence.md`](docs/local-persistence-restart-evidence.md)
- [`docs/verification/comparative-closure-grade-final-2026-09-11.md`](docs/verification/comparative-closure-grade-final-2026-09-11.md)
- [`docs/comparative-ecx-evidence.md`](docs/comparative-ecx-evidence.md)
- [`docs/EXECUTION-PROGRESS.md`](docs/EXECUTION-PROGRESS.md)

## Apa yang sudah ada

| Modul/area | Current baseline |
|---|---|
| **Ai** | Chat, `/space`, `/ops`, `/settings` Control Center |
| **Hub** | Policy, approval, audit, orchestration, Historical Ledger, ECX, capability authority |
| **Connect** | Hosted/local provider gateway, cache/routing/cost telemetry, credential Vault, spend budget, MCP inbound/outbound, runtime settings |
| **Context** | Memori L0–L2 + L3 metadata binding |
| **Sync** | Pairing/self-host relay + MCP HTTPS bridge |
| **Artifact** | Content-addressed storage SHA-256 |
| **Sandbox** | Tier 0, WASM, hardened Docker boundary |
| **Space** | Notes/block runtime tanpa menggandakan Context source of truth |
| **Flow** | Durable workflow di Temporal |
| **RnD** | Trace/eval foundation + dataset governance |
| **Multimodal / Voice** | Baseline image/document/audio + realtime voice pipeline |
| **Data / DR** | Owner-scoped backup/restore primitives + strict isolated local evidence harness |
| **Production Ops** | Compose/Caddy, metrics/traces, provider canary, release/install/upgrade/rollback tooling |
| **Security closure** | Full-history + working-tree secret scans, dependency/release checks, HTTP/SSRF hardening, real public HTTPS MCP acceptance |
| **Comparative evidence** | 5× corrected local run, 5/5 task gates PASS WITH LIMITATIONS |
| **Local persistence** | Strict restart evidence CLOSED / PASS |
| **Local backup/restore** | Strict isolated restore evidence CLOSED / PASS WITH ABSENT-OWNER LIMITATIONS |
| **AutoClick** | Deferred by design sampai ada use case non-API nyata |

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

## Comparative ECX evidence

Final corrected local benchmark:

```text
5 tasks × 5 repeats × 3 lanes = 75 measured calls
cache hits = 0
passed task gates = 5/5
median selective transport reduction = 73.6379379246037%
median selective input-token reduction = 77.8580814717477%
median selective/full latency ratio = 0.8672873729681319
```

Satu individual selective `retention-policy` repeat punya exact-string punctuation mismatch. Karena quality gate task memakai median, checkpoint tetap PASS tetapi wording wajib **PASS WITH LIMITATIONS**.

`ecx-selective-oracle` bukan bukti automatic semantic reference selector. Aggregate benchmark ini juga bukan universal/public savings claim.

## Local persistence/restart evidence

Final strict rerun membuktikan exact Ledger, Context, Artifact, Flow dan approval identity bertahan melewati controlled boundary:

```text
Phase 4 processes
+ Temporal container
+ PostgreSQL container
```

Named Temporal DB volume tetap dipertahankan. Claim ini tidak otomatis membuktikan backup/restore, off-host DR, hard power-loss/fsync atau arbitrary corruption recovery.

## Isolated local backup/restore evidence

Implementation baseline:

```text
4e6bcd94776fc7dd75440ee35dd8fddf0b602233
```

Real run:

```text
runId = backup-20260911154453-f4ac8743
phase = restore-verified
```

Runtime-backed-up owners:

```text
Context
Hub
RnD
Space
Flow graph registry
Artifact
Sandbox receipts
```

Optional absent source state:

```text
Sync    missing
Connect missing
```

Mereka tidak disemai hanya untuk membuat evidence terlihat lengkap.

Temporal restore juga diuji terpisah lewat logical dump/restore:

```text
temporal             39 restored tables
temporal_visibility   3 restored tables
```

Ledger, Context, Artifact, Flow dan approval kemudian dibaca ulang lewat **isolated restored owner APIs** dan cocok dengan source baseline. Setelah selesai:

```text
NO_EVIDENCE_CONTAINERS
NO_EVIDENCE_NETWORKS
NO_ISOLATED_LISTENERS
```

Same-laptop restore correctness **bukan** off-host DR. Backup bytes yang masih berada di laptop yang sama tetap berada di failure domain yang sama.

## Menjalankan lokal

Butuh Node >=22 dan pnpm 10.

```bash
pnpm install
pnpm verify
cp .env.example .env
pnpm dev
```

Runtime bertahap:

```bash
pnpm dev:phase2
pnpm dev:phase3
pnpm dev:phase4
```

Evidence commands:

```bash
# comparative
pnpm evidence:comparative:smoke
pnpm evidence:comparative

# persistence/restart
pnpm evidence:persistence-restart:inventory
pnpm evidence:persistence-restart --phase baseline
pnpm evidence:persistence-restart --phase post
pnpm evidence:persistence-restart --phase cleanup

# isolated backup/restore
pnpm evidence:backup-restore:inventory
pnpm evidence:backup-restore
```

Runtime evidence commands bukan deterministic CI substitutes. Raw runtime evidence tetap lokal/gitignored.

## Production/self-host — deferred

Tooling/runbook tetap tersedia:

- [`docs/production-activation.md`](docs/production-activation.md)
- [`docs/production-operations.md`](docs/production-operations.md)
- [`docs/release-operations.md`](docs/release-operations.md)
- [`docs/cloudflare-free-deployment.md`](docs/cloudflare-free-deployment.md)

Operator memilih belum memakai VPS/compute host sekarang. Deployment, Cloudflare named Tunnel, public cutover dan host-firewall mutation tetap **DEFERRED**, bukan blocker local R&D.

## Next work after Batch 12

Tidak ada automatic Batch 13. Urutan operator-approved sekarang:

1. local persistence/restart — **CLOSED / PASS**;
2. isolated local backup/restore — **CLOSED / PASS WITH EXPLICIT ABSENT-OWNER LIMITATIONS**;
3. **local observability baseline — ACTIVE NEXT CHECKPOINT**;
4. product/UX validation;
5. immutable local model identity hardening;
6. VPS/compute-host + Cloudflare hanya kalau operator explicitly resume;
7. hosted-provider comparative validation hanya dengan credential + spend intent;
8. automatic selector/optimizer hanya sebagai explicit evidence-driven scope;
9. maintenance/security/dependency/DR evidence;
10. feature baru hanya bila evidence membenarkan.

## Invarian penting

- Memory adalah untrusted data, bukan instruksi.
- Hosted egress tunduk pada scope/sensitivity/sync-class policy.
- Tidak ada silent provider fallback.
- Credential production dimiliki Connect dan terenkripsi at-rest.
- Hosted dispatch tunduk pada kill switch + cumulative budget.
- Connect MCP HTTP tidak bind publik; public reachability melalui Sync + HTTPS edge.
- Side effect memakai idempotency identity.
- Irreversible/high-risk action tetap melewati policy/approval.
- Model identity dipin untuk durable deployment/evidence claims.
- Owner-service boundary melarang cross-service DB access.
- Historical Ledger dan Context L0 ground truth tidak direwrite untuk convenience.
- Comparative cache isolation harus berlaku antar invocation.
- Oracle selective hydration bukan automatic optimizer.
- Valid failed runtime evidence tidak dihapus setelah bug diperbaiki.
- Backup/restore drill tidak boleh overwrite active owner state.
- AutoClick tetap deferred sampai use case non-API nyata lolos design gate.

## Batasan yang tetap nyata

READY baseline bukan klaim bahwa:

- hosted-provider quality/latency sudah dibuktikan deterministic CI;
- backup aman dari disk/laptop loss jika tetap berada di failure domain yang sama;
- hard power-loss/fsync, arbitrary corruption recovery atau PITR sudah dibuktikan;
- Sync/Connect runtime restore sudah terbukti ketika source durable state mereka tidak ada pada drill;
- ECX savings universal/general production sudah terbukti;
- oracle hydration membuktikan automatic reference selection;
- laptop evidence membuktikan VPS/Cloudflare behavior;
- Fase 6+ selesai permanen.

## Reading order

1. [`docs/current-state-and-next-steps.md`](docs/current-state-and-next-steps.md)
2. [`AGENTS.md`](AGENTS.md)
3. [`docs/verification/local-backup-restore-closure-2026-09-11.md`](docs/verification/local-backup-restore-closure-2026-09-11.md)
4. [`docs/local-backup-restore-evidence.md`](docs/local-backup-restore-evidence.md)
5. [`docs/verification/local-persistence-restart-closure-2026-09-11.md`](docs/verification/local-persistence-restart-closure-2026-09-11.md)
6. [`docs/local-persistence-restart-evidence.md`](docs/local-persistence-restart-evidence.md)
7. [`docs/verification/comparative-closure-grade-final-2026-09-11.md`](docs/verification/comparative-closure-grade-final-2026-09-11.md)
8. [`docs/comparative-ecx-evidence.md`](docs/comparative-ecx-evidence.md)
9. [`docs/EXECUTION-PROGRESS.md`](docs/EXECUTION-PROGRESS.md)
10. relevant production/ADR docs
11. `docs/prd.md`, `docs/research.md`, `docs/blueprint.md` for rationale/history

## Lisensi

MIT untuk kode yang sudah dirilis di repository ini. Layanan managed/hosted yang mungkin dibuat kemudian tidak mengubah lisensi kode MIT yang sudah dipublikasikan. Lihat [`docs/LICENSING.md`](docs/LICENSING.md).
