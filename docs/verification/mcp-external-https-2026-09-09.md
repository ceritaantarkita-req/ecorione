# MCP external HTTPS acceptance — 2026-09-09

## Verdict

**External MCP HTTPS acceptance: PASS / closure-ready.** Code/runtime dan dokumentasi telah melewati regular exact-head CI serta dedicated public-HTTPS acceptance. Satu final evidence-only commit ini tetap wajib melewati kedua gate sekali lagi sebelum merge PR.

## Boundary yang dibuktikan

Acceptance sengaja tidak membuka Connect ke internet:

```text
hosted-style client
  -> public HTTPS edge (temporary Cloudflare Quick Tunnel)
  -> Sync loopback bridge
  -> Connect MCP loopback
  -> Hub loopback

Connect MCP -> public HTTPS OAuth/JWKS endpoint
```

Dua Quick Tunnel sementara digunakan hanya selama test: satu menuju mock OAuth/JWKS dan satu menuju Sync. Tidak ada permanent credential, tunnel token, atau managed ecorione relay.

## Supply-chain pin

Workflow `.github/workflows/mcp-external-acceptance.yml` memakai:

- cloudflared release: `2026.8.3`
- Linux amd64 SHA-256: `f29324fe934d1e100617484c78deef803c4dc2cd351d645bbde42e96b4fccc5e`

Binary tidak dijalankan sebelum checksum cocok.

## Candidate code-head evidence

Code/runtime head sebelum update dokumentasi:

- SHA: `0077642d0268d9001eae62a710036333b72cf432`
- regular CI run: `34345345324`
- MCP External HTTPS Acceptance run: `34345345372`

Pada SHA tersebut regular CI PASS untuk Format, Lint, Typecheck, Test, Secret Scan, Production Build, dan Naming. External workflow juga PASS.

## Docs-integrated exact-head evidence

Head dengan seluruh code, runtime, docs, ADR/API update, stale `memory_open` capability-description fix, dan tanpa helper workflow sementara:

- SHA: `142750529d936f9f497021744ebd6c27993a9246`
- regular CI run: `34346152971`
- MCP External HTTPS Acceptance run: `34346153002`

Kedua workflow selesai **success**. Regular CI melewati frozen install, Format, Lint, Typecheck, Test, Secret Scan, Production Build, dan Naming. Dedicated external workflow melewati build TypeScript, checksum cloudflared, lalu public HTTPS acceptance end-to-end.

## Checks external workflow

Runner membuktikan:

1. public OAuth/JWKS `/healthz` reachable via TLS;
2. public Sync `/healthz` reachable via TLS;
3. unauthenticated MCP request mengembalikan 401;
4. `WWW-Authenticate` menunjuk public Protected Resource Metadata dan `memory:read`;
5. Protected Resource Metadata publik mengiklankan MCP resource dan authorization server yang benar;
6. JWT yang ditandatangani test key diverifikasi Connect memakai JWKS yang diambil lewat public HTTPS;
7. `server/discover` sukses;
8. `tools/list` sukses;
9. `tools/call memory_search` melintasi Sync -> Connect -> Hub tepat sekali;
10. write-only OAuth token ditolak untuk read tool dengan 403 `insufficient_scope`;
11. malformed JWT ditolak 401;
12. Origin yang tidak diizinkan ditolak 403;
13. `Mcp-Method` yang tidak cocok dengan body ditolak 400;
14. Connect tetap bind `127.0.0.1`;
15. process/tunnel ditutup pada cleanup.

## Apa yang tidak diklaim

PASS ini **bukan** bukti bahwa:

- ecorione mengoperasikan managed public relay;
- Cloudflare Quick Tunnel adalah deployment production yang direkomendasikan untuk semua user;
- mock OAuth server adalah authorization server production;
- availability internet/tunnel provider dijamin oleh ecorione.

Evidence ini menutup gap bahwa transport MCP sebelumnya belum pernah dibuktikan melalui public HTTPS/JWKS nyata. Final PR merge tetap mensyaratkan kedua workflow hijau pada commit evidence ini.
