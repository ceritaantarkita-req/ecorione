# ADR-24 — Plugin / Extension Framework

Status: Accepted
Tanggal: 2026-09-09

## Context

Ecorione membutuhkan cara memasang dan mengelola extension tanpa menjadikan GitHub repository, package, atau manifest sebagai jalur eksekusi arbitrary code di host process. Setelah outbound MCP client/manager tersedia, extension perlu mempunyai control plane yang menyatukan identity, source provenance, lifecycle, rollback, health, workspace visibility, dan declaration capability/permission/secret requirement.

Framework ini belum menggantikan unified capability/permission plane. Batch 3 hanya mendefinisikan declaration yang ketat dan admission minimum; grant/revocation lintas model/MCP/plugin/node/tool/Sandbox disatukan pada workstream berikutnya.

## Decision

1. Hub menjadi owner control-plane extension registry, lifecycle, revision history, security admission minimum, policy integration, dan audit. Hub tidak menjalankan extension code.
2. Extension manifest memakai kontrak versioned `ecorione.extension/v1` di shared-schema dan menolak unknown fields.
3. Source harus immutable/auditable: GitHub memakai exact 40-character commit SHA, release memakai HTTPS URL tanpa embedded credential/fragment, atau Artifact CAS identity.
4. Setiap manifest membawa `bundleSha256` dan `packageArtifactId`. Admission memverifikasi digest bundle identik dengan digest Artifact CAS; artifact source juga harus menunjuk Artifact yang sama.
5. Runtime baseline hanya `none`, `mcp`, atau `sandbox`. Tidak ada `host` runtime. MCP tetap dieksekusi melalui Connect outbound MCP manager. Executable extension hanya boleh melalui Sandbox boundary.
6. Manifest mendeklarasikan capability, permission/action class, dan secret requirement. Declaration bukan grant. Unknown/wildcard declaration fail closed.
7. MCP execution wajib mendeklarasikan `mcp.client`. Sandbox execution wajib mendeklarasikan `sandbox.execute` serta permission dengan `ActionClass=EXECUTE`. Secret requirement wajib disertai permission `CREDENTIAL_ACCESS`.
8. Install/update security admission dijalankan sebelum policy/approval/audit mutation. Manifest yang diblok tidak boleh membuat installation/revision ataupun approval/audit side effect.
9. Registry durable dan workspace-scoped. Cross-workspace visibility tidak diizinkan.
10. Revision history append-only. Install, update, dan rollback membuat revision immutable. Rollback tidak mengubah revision lama; ia membuat revision baru dengan provenance ke revision target.
11. Installation adalah mutable projection yang menunjuk current revision dan lifecycle/health state. Remove tidak menghapus provenance revision.
12. Semua mutation menggunakan idempotency key + canonical fingerprint. Same key + same fingerprint mengembalikan receipt lama; same key + different fingerprint fail conflict.
13. Mutation state dan immutable operation receipt ditulis dalam transaksi yang sama sehingga crash/retry tidak menggandakan lifecycle mutation.
14. Secret material tidak disimpan di manifest/registry. Connect tetap owner credential material; Batch 4 akan menyatukan authorization atas secret reference tanpa memindahkan secret ownership.
15. Arbitrary repository installation, package build, vulnerability scanning, signature trust store, atau host execution bukan klaim baseline ini. Security gate saat ini membuktikan identity/integrity/declaration consistency; executable isolation dilakukan Sandbox.

## Consequences

- Extension dapat dipasang, di-update, di-rollback, di-remove, dan dipantau health-nya dengan provenance durable.
- Source/version drift menjadi terlihat karena revision dan digest dipin.
- Workspace berbeda tidak berbagi installation projection atau revision visibility.
- Retry lifecycle aman terhadap duplicate mutation.
- Framework tidak mengklaim bahwa bundle pihak ketiga aman hanya karena digest cocok; digest membuktikan identity/integrity, bukan absence of vulnerabilities.
- Permission declaration Batch 3 sengaja menjadi input bagi unified capability/permission plane Batch 4, bukan authority grant final.

## Non-goals

- Marketplace discovery/ranking.
- Menjalankan arbitrary GitHub repository di host process.
- Menyimpan credential plaintext di extension manifest/registry.
- Menggantikan Sandbox isolation.
- Menjadikan extension declaration sebagai permission grant otomatis.
- Full software-supply-chain signature infrastructure pada baseline ini.
