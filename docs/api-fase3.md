# API Fase 3 — Artifact, Sandbox, Space

**Status:** CLOSED · 2026-09-09

Dokumen ini mencatat kontrak yang benar-benar diimplementasikan pada Fase 3. Sumber arsitektur tetap `prd.md`, `blueprint.md`, ADR-10, dan shared schema; dokumen ini bukan kontrak baru yang menyimpang dari source.

## 1. Artifact — CAS L3

Service: `services/artifact`, default `http://127.0.0.1:17025`.

### Storage dan dedup

- ID content-addressed: `art_<sha256>`.
- Blob fisik disimpan sekali per SHA-256.
- Bytes identik boleh mempunyai beberapa binding metadata terklasifikasi di Context. Dedup fisik **tidak** menggabungkan atau menaikkan scope/sensitivity/syncClass.
- Artifact tidak membuka DB Context; metadata, registration, dan authorization selalu lewat HTTP Context.
- Path dari metadata tidak dipercaya sebagai filesystem locator. Artifact menghitung lokasi blob sendiri dari digest ID.
- Saat read, hash/ukuran diverifikasi; mismatch gagal eksplisit.

### `POST /v1/artifacts`

Body:

```json
{
  "contentBase64": "...",
  "mimeType": "text/plain",
  "description": "catatan hasil kerja",
  "scope": "personal",
  "sensitivity": "INTERNAL",
  "syncClass": "LOCAL_ONLY"
}
```

Respons berisi `pointer` dan `deduplicated`. Default hard limit upload v1: 20 MiB.

### `GET /v1/artifacts/:id/content`

Query wajib/opsional:

- `scope`
- `maxSensitivity`
- `hostedEligible=0|1`

Sebelum byte dibaca, Artifact meminta Context mengotorisasi ID terhadap scope, sensitivity, dan hosted eligibility. Tidak ada authorization berdasarkan pointer yang dikirim caller saja.

### MCP `memory_open`

Fase 2 sebelumnya sengaja mengembalikan 501 sampai Artifact tersedia. Mulai Fase 3 jalurnya:

`Connect MCP → Hub policy/scope gate → Artifact → Context authorization → bytes`

Hub mengembalikan artifact sebagai data (`artifactId`, `mimeType`, `contentBase64`); Connect tetap membungkus hasil tool sebagai untrusted data.

## 2. Sandbox — eksekusi bertingkat

Service: `services/sandbox`, default `http://127.0.0.1:17026`.

Semua request melewati Hub policy dan menghasilkan receipt idempoten. Trace dikirim ke RnD. Sandbox tidak membuat approval engine kedua.

### Tier 0

Host execution paling ketat dan selalu tersedia:

- workspace harus berada di bawah `ECORIONE_SANDBOX_WORKSPACE_ROOT`;
- shell metacharacter/path traversal ditolak;
- destructive verbs ditolak;
- v1 hanya mengizinkan `pwd`, `ls`, relative `cat`, dan `git status|diff|log|show` tanpa escape flags.

Interpreter bebas tidak dijalankan di host karena itu akan membuat filesystem allowlist semu.

### Tier 1.5

WASM zero-ambient-authority:

- modul yang memiliki host import ditolak;
- hanya export yang diminta yang dapat dieksekusi;
- tidak memperoleh filesystem/network binding implicit.

### Tier 1

Docker escalation untuk workload yang butuh runtime/package nyata. V1 menjalankan:

- `--network=none`
- `--read-only`
- tmpfs `/tmp` dengan `noexec,nosuid`
- `--cap-drop=ALL`
- `no-new-privileges`
- user non-root
- memory/CPU/PID limits
- tepat satu bind mount workspace
- tidak pernah mount Docker socket

Catatan: ecorione mengikuti ADR-10 dan **tidak mengklaim secure sandbox** terhadap kernel escape.

### `POST /v1/executions`

Body mengikuti `SandboxExecutionRequestSchema` di `packages/shared-schema/src/sandbox.ts`. Side effect selalu membawa `idempotencyKey`.

Retry key yang sama mengembalikan receipt durable yang sama dan tidak mengeksekusi aksi kedua kali.

## 3. Space — notes + editor L2

Service: `services/space`, default `http://127.0.0.1:17027`.

Keputusan UX v1: UI berada sebagai route `/space` di app Ai, bukan app Next.js kedua. Backend Space tetap service terpisah sehingga keputusan UI ini reversible tanpa migrasi data.

### Data milik Space

Space mempunyai SQLite sendiri (`ECORIONE_SPACE_DB_PATH`) untuk:

- `pages`
- `blocks`

Tipe blok v1: `text`, `heading`, `list`.

Route backend utama:

- `POST /v1/pages`
- `GET /v1/pages`
- `GET /v1/pages/:id`
- `PATCH /v1/pages/:id`
- `DELETE /v1/pages/:id`
- `POST /v1/pages/:id/blocks`
- `PATCH /v1/blocks/:id`
- `DELETE /v1/blocks/:id`

### Core memory L2 bukan data Space

Space **tidak** memiliki tabel/salinan core memory. Route:

- `GET /v1/core-memory`
- `PUT /v1/core-memory/:label`

hanya proxy ke endpoint Context Fase 1. Dengan demikian Ai chat, Context assembly, dan editor Space memakai satu source of truth yang sama.

Browser tidak menerima `ECORIONE_INTERNAL_TOKEN`: `/space` menggunakan route handler same-origin di app Ai yang memanggil Space server-side.

## 4. Runtime acceptance dan closure

CI Fase 3 mengeksekusi runtime acceptance nyata, bukan hanya unit-plan assertion:

1. Artifact upload/read dengan Context service asli; cross-scope read ditolak.
2. Space edit core memory lewat service boundary Context asli.
3. Sandbox Tier 0 benar-benar menjalankan command allowlisted.
4. Sandbox Tier 1.5 benar-benar menjalankan zero-import WASM.
5. Sandbox Tier 1 benar-benar menjalankan container Docker dengan hardening ADR-10.

Final strict closure run `34301124513` pada commit `6117e8a528b52aef2351dd63b45b1fd980a8dc74` lulus frozen lockfile, format check, naming, lint, typecheck, runtime tests termasuk Docker nyata, secret scan, dan production build. Run helper `34300859602` adalah evidence runtime sebelumnya, bukan final strict closure run.
