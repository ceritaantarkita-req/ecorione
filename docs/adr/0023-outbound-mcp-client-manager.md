# ADR-23 — Outbound MCP Client + Manager

Status: Accepted
Tanggal: 2026-09-09

## Context

Ecorione sudah memiliki MCP server inbound di Connect, tetapi belum mempunyai boundary generik untuk memakai MCP server pihak lain. Menambahkan client eksternal tanpa governance yang jelas akan membuka beberapa kelas risiko sekaligus: credential leakage, arbitrary process execution lewat stdio, cross-workspace data leakage, tool side effect yang salah diklasifikasikan, dan duplicate remote execution setelah timeout/crash.

Outbound MCP juga tidak boleh menjadi jalur samping yang melewati Hub. Connect tetap pemilik transport/credential boundary, sedangkan Hub tetap pemilik policy, approval, dan audit.

## Decision

1. Connect menjadi satu-satunya runtime boundary untuk outbound MCP. Hub tidak membuka transport MCP eksternal sendiri.
2. Client SDK resmi dipin exact ke `@modelcontextprotocol/client@2.0.0`. Protocol negotiation diaktifkan eksplisit dengan `versionNegotiation.mode = "auto"`; runtime tidak mengandalkan default SDK untuk memilih protocol era.
3. Transport baseline adalah Streamable HTTP dan stdio. Streamable HTTP wajib HTTPS, kecuali HTTP loopback yang diizinkan eksplisit. URL tidak boleh membawa username/password/fragment.
4. Stdio fail-closed: command harus ada secara exact di `ECORIONE_MCP_STDIO_ALLOWLIST`. Registry tidak boleh menyimpan environment variable yang tampak seperti token/key/secret/password/credential; secret harus memakai credential reference.
5. MCP server registry durable dan workspace-scoped. File registry memakai exclusive lock, atomic replacement, dan mode `0600`. Connection/cache partition juga dipisahkan per workspace.
6. Credential MCP disimpan sebagai named encrypted references dalam Connect Credential Vault scope `mcp/tokens`. Registry hanya menyimpan reference, bukan secret plaintext.
7. Discovery tidak otomatis mengaktifkan tool. Setiap tool harus di-enable eksplisit dan diberi local `ActionClass`. Klasifikasi lokal adalah policy input authoritative; remote hint tidak boleh otomatis menurunkan risk class.
8. Semua discovery/call melewati Hub policy contract. Hub tetap owner approval dan audit melalui service API; Connect tidak mengakses Hub database secara langsung.
9. Side effect menggunakan durable idempotency identity yang mencakup workspace, server, tool, dan canonical arguments. Store menyimpan `workspaceId`, `operationId`, tool, digest args, timestamp, status, dan result.
10. Sebelum remote side-effect dispatch, Connect melakukan durable reservation. State adalah `reserved`, `uncertain`, atau `settled`. `reserve()` tetap atomic race barrier tepat sebelum dispatch.
11. Retry yang sudah diketahui `reserved`/`uncertain` ditolak pada preflight sebelum Connect membuka ulang transport atau melakukan remote discovery. Ini mengurangi network activity pada ambiguous retry tanpa mengganti atomic reservation barrier.
12. Jika transport/call gagal setelah side-effect dispatch, reservation menjadi `uncertain`, connection ditutup, dan automatic redispatch dilarang. Operator/caller harus menyelesaikan remote state secara eksplisit.
13. Jika remote side effect sukses tetapi settlement atau audit bookkeeping gagal, hasil remote tetap dikembalikan sebagai sukses dengan state degraded/reservation-retained. Keberhasilan eksternal tidak dibuat retryable hanya karena bookkeeping lokal gagal.
14. Arbitrary GitHub repository/plugin code execution bukan bagian dari outbound MCP manager. Plugin/extension installation harus melalui workstream terpisah dengan manifest, revision pinning, permission/security gate, dan Sandbox bila membawa executable code.

## Consequences

- Ecorione dapat memakai MCP server pihak lain melalui satu boundary yang dapat diaudit.
- Workspace berbeda tidak berbagi connection partition maupun durable idempotency identity.
- Side effect eksternal memiliki fail-closed ambiguity semantics yang konsisten dengan prinsip ADR-12.
- Menambah transport atau credential mechanism baru harus mempertahankan Hub governance, workspace isolation, dan no-automatic-retry invariant.
- Stdio lebih ketat daripada menjalankan command generik; operator harus mengizinkan executable secara eksplisit.

## Non-goals

- Marketplace/plugin installer.
- Menjalankan arbitrary repository di host process.
- Menganggap remote MCP metadata sebagai permission authority.
- Automatic retry untuk ambiguous external side effect.
- Managed secret service atau multi-host registry pada baseline single-host/self-host ini.
