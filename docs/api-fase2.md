# API Fase 2 — MCP inbound + Sync

Status: **implemented on working branch** — 2026-09-09. Dokumen ini menjelaskan kontrak yang benar-benar ada setelah Fase 2, bukan rencana awal. Rencana asal tetap di `fase2.md`; keputusan reachability ada di ADR-16.

## 1. Topologi

- Connect outbound tetap di `127.0.0.1:17023`.
- Connect MCP HTTP berjalan terpisah di `127.0.0.1:17010`; Connect **tidak pernah** bind publik.
- Sync local/self-hosted berjalan di `127.0.0.1:17011` dan dapat menjadi target tunnel HTTPS pihak ketiga sesuai ADR-16.
- Semua tool memory MCP tetap melewati **Connect -> Hub -> Context**. Tidak ada akses DB Context dari Connect/Sync.
- Managed public relay ecorione **tidak** ada di repo publik ini.

## 2. MCP 2026-07-28

Transport:

- stdio: `pnpm --filter @ecorione/connect run mcp:stdio`
- HTTP stateless: `pnpm --filter @ecorione/connect run mcp:http`

RPC yang diumumkan:

- `server/discover`
- `tools/list`
- `tools/call`

Lima tool:

1. `memory_search`
2. `memory_get`
3. `memory_propose`
4. `memory_recent`
5. `memory_open`

`memory_open` tetap mengembalikan not-implemented eksplisit sampai Artifact Fase 3 tersedia.

### Trust boundary

Memory yang dibaca melalui MCP selalu dirender sebagai **untrusted data**, bukan instruction. `memory_propose` selalu memakai trust `HOSTED_AGENT` dan masuk quarantine; tool ini tidak mempunyai jalur promote langsung.

Handle MCP bersifat opaque, AEAD-protected, punya TTL, dan terikat ke principal + scope + sensitivity + delivery. Handle dari principal atau delivery lain ditolak.

## 3. MCP HTTP auth

Endpoint metadata:

- `GET /.well-known/oauth-protected-resource`
- `GET /.well-known/oauth-protected-resource/mcp`

Endpoint RPC:

- `POST /mcp`
- `GET /mcp` -> 405 (stateless POST-only)

Server memvalidasi issuer, resource/audience, JWKS signature, Origin, OAuth scopes, dan routing headers MCP. Scope tool minimal:

- read tools -> `memory:read`
- `memory_propose` -> `memory:write`

Env wajib untuk HTTP MCP:

- `ECORIONE_MCP_OAUTH_ISSUER`
- `ECORIONE_MCP_RESOURCE`
- `ECORIONE_MCP_JWKS_URL`
- `ECORIONE_MCP_HANDLE_KEY`

## 4. Hub MCP boundary

Endpoint Hub yang dipakai Connect inbound:

- `POST /v1/mcp/memory/search`
- `POST /v1/mcp/memory/get`
- `POST /v1/mcp/memory/propose`
- `POST /v1/mcp/memory/recent`
- `POST /v1/mcp/memory/open`

Access context membawa principal, source app, allowed scopes, max sensitivity, delivery (`local`/`hosted`) dan request id. Hub melakukan defense-in-depth terhadap scope/sensitivity dan mencatat `MCP_TOOL_CALLED` di audit log.

Hosted delivery hanya boleh mengeluarkan data yang eligible untuk cloud (`CLOUD_ALLOWED`/`PUBLIC`).

## 5. Context additions

Fase 2 menambah lookup tunggal yang dibutuhkan `memory_get`:

- `GET /v1/facts/:id`
- `GET /v1/episodes/:id`

Kontrak Fase 1 lainnya tetap berlaku.

## 6. Sync local/self-hosted

Sync menyimpan **ciphertext relay**, bukan plaintext. Pairing v1:

1. device pertama: `POST /v1/devices/bootstrap` dengan header `x-ecorione-owner-token`;
2. device aktif membuat one-time code: `POST /v1/pairing-codes`;
3. device baru: `POST /v1/devices/pair` dengan code + public key;
4. hasil pairing memberi device token acak; server hanya menyimpan SHA-256 token, bukan token mentah.

Endpoint:

- `POST /v1/devices/bootstrap`
- `GET /v1/devices`
- `POST /v1/pairing-codes`
- `POST /v1/devices/pair`
- `POST /v1/relay`
- `GET /v1/relay`
- `POST /v1/relay/:id/ack`

Payload relay terdiri dari `senderEphemeralPublicKey`, nonce, GCM auth tag, dan ciphertext. Helper device-side menggunakan X25519 -> HKDF-SHA256 -> AES-256-GCM. Private key tidak pernah dikirim ke Sync.

### MCP bridge

Sync meneruskan endpoint berikut ke Connect MCP loopback tanpa menghapus header OAuth/Origin/MCP:

- `/.well-known/oauth-protected-resource`
- `/.well-known/oauth-protected-resource/mcp`
- `/mcp`

Tunnel HTTPS v1 diarahkan ke Sync local, **bukan** langsung ke Connect.

## 7. Security invariants

- Connect MCP tetap loopback-only.
- Sync local tetap loopback-only; exposure publik dilakukan tunnel yang dipilih pemilik mesin.
- Tidak ada plaintext user-memory di tabel relay.
- Pairing code sekali pakai dan punya expiry.
- MCP hosted tidak memperluas scope/sensitivity dari token/handle.
- Hosted writes masuk quarantine.
- L4 tetap di luar ceiling v1 dan tidak dapat diubah menjadi approval escape hatch.

## 8. Batas Fase 2

Fase 2 tidak membangun managed cloud relay, Artifact storage, durable Flow, atau Sandbox. `memory_open` baru menjadi fungsional setelah Artifact Fase 3 tersambung.
