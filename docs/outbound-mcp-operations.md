# Outbound MCP — Operator Guide

Dokumen ini menjelaskan baseline operasional outbound MCP di Connect. Registry dan credential dimodifikasi lewat CLI operator; runtime HTTP hanya mengekspos list/status/discover/call/disconnect. Tidak ada endpoint HTTP untuk menulis credential.

## 1. Runtime state

Environment yang relevan:

```env
ECORIONE_MCP_OUTBOUND_REGISTRY_PATH=./data/connect-mcp-registry.json
ECORIONE_MCP_OUTBOUND_INVOCATION_PATH=./data/connect-mcp-invocations.json
ECORIONE_MCP_STDIO_ALLOWLIST=command-a,/absolute/path/command-b
```

`ECORIONE_MCP_STDIO_ALLOWLIST` adalah daftar **comma-separated exact command strings**. Empty list berarti semua stdio command ditolak.

Credential MCP memakai Connect Credential Vault yang sama dengan provider. `ECORIONE_CONNECT_VAULT_MASTER_KEY` harus tersedia untuk operasi credential. Named MCP secrets disimpan terenkripsi di scope `mcp/tokens`; registry hanya menyimpan `credentialRef`.

## 2. CLI operator

Semua command memakai:

```bash
pnpm --filter @ecorione/connect mcp:manage -- <command>
```

Command yang tersedia:

```text
server:list [workspaceId]
server:upsert
server:remove <id>
tool:set <serverId> <tool> <true|false> <actionClass>
credential:list
credential:set <ref>
credential:remove <ref>
```

`server:upsert` membaca seluruh JSON config dari stdin. `credential:set` membaca secret dari stdin, sehingga secret tidak perlu muncul di process arguments.

Contoh menyimpan credential:

```bash
printf '%s' "$REMOTE_MCP_TOKEN" | \
  pnpm --filter @ecorione/connect mcp:manage -- credential:set example-token
```

Contoh server Streamable HTTP:

```json
{
  "id": "example",
  "displayName": "Example MCP",
  "workspaceIds": ["ws_personal"],
  "transport": {
    "type": "streamable-http",
    "url": "https://mcp.example.com/mcp",
    "credentialRef": "example-token"
  },
  "toolPolicies": []
}
```

Simpan config misalnya ke `/tmp/example-mcp.json`, lalu:

```bash
pnpm --filter @ecorione/connect mcp:manage -- server:upsert < /tmp/example-mcp.json
```

HTTP non-TLS hanya diperbolehkan untuk loopback dan harus menyetel `allowInsecureLoopback: true`. URL dengan username, password, atau fragment ditolak.

Contoh stdio:

```json
{
  "id": "local-tool",
  "displayName": "Local Tool MCP",
  "workspaceIds": ["ws_personal"],
  "transport": {
    "type": "stdio",
    "command": "/opt/example-mcp/bin/server",
    "args": [],
    "env": {},
    "credentialRef": "local-tool-token",
    "credentialEnv": "EXAMPLE_TOKEN"
  },
  "toolPolicies": []
}
```

Command harus cocok exact dengan salah satu entry di `ECORIONE_MCP_STDIO_ALLOWLIST`. `credentialRef` dan `credentialEnv` untuk stdio harus dikonfigurasi bersama. Environment config yang namanya tampak seperti secret ditolak; secret masuk melalui Vault.

## 3. Discovery lalu enable tool

Remote discovery **tidak** otomatis memberikan permission. Setelah melihat tool yang diiklankan remote, operator menetapkan policy lokal secara eksplisit, misalnya:

```bash
pnpm --filter @ecorione/connect mcp:manage -- \
  tool:set example search true READ

pnpm --filter @ecorione/connect mcp:manage -- \
  tool:set example create_record true REVERSIBLE_WRITE
```

`ActionClass` memakai kontrak shared policy ecorione (`READ`, `REVERSIBLE_WRITE`, `IRREVERSIBLE_WRITE`, `SPEND`, `EXTERNAL_SEND`, `CREDENTIAL_ACCESS`, `EXECUTE`). Class yang gated tetap membutuhkan Hub approval sesuai policy. Jangan menurunkan class hanya karena remote server mengklaim tool aman/read-only.

## 4. Runtime routes

Connect menyediakan:

```text
GET  /v1/mcp-outbound/servers?workspaceId=ws_...
GET  /v1/mcp-outbound/servers/:id/status?workspaceId=ws_...
POST /v1/mcp-outbound/servers/:id/discover
POST /v1/mcp-outbound/servers/:id/tools/:tool/call
POST /v1/mcp-outbound/servers/:id/disconnect
```

Discovery body membawa `workspaceId`, `operationId`, `scope`, `sensitivity`, `autonomy`, dan `now`. Tool call membawa field yang sama plus `arguments`. Semua request tetap melewati Hub governance.

Error penting:

- `403 MCP_PERMISSION_DENIED` — transport/tool tidak diizinkan.
- `403 MCP_POLICY_DENIED` — Hub menolak action.
- `409 MCP_APPROVAL_REQUIRED` — approval durable harus diselesaikan.
- `409 MCP_OUTCOME_UNCERTAIN` — side effect mungkin sudah terjadi; **jangan retry secara blind**.
- `503 MCP_CREDENTIAL_UNAVAILABLE` — credential reference tidak tersedia.
- `503 MCP_STATE_UNAVAILABLE` — registry/invocation durable state tidak aman dipakai.
- `504 MCP_TIMEOUT` — transport/request melewati timeout.

## 5. Ambiguous side effects

Untuk action non-`READ`, Connect membuat durable reservation sebelum `tools/call`. Jika remote call gagal setelah dispatch, reservation dipertahankan sebagai `uncertain`. Retry berikutnya dengan identity yang sama ditolak bahkan sebelum reconnect/network discovery.

Jika menerima `MCP_OUTCOME_UNCERTAIN`, operator harus memeriksa state remote atau menjalankan reconciliation yang khusus untuk server tersebut. Jangan menghapus invocation store untuk memaksa retry; itu menghilangkan safety evidence.

Remote success juga tidak diubah menjadi retryable error hanya karena settlement atau audit lokal gagal. Response membawa degraded settlement/audit state agar operator dapat memperbaiki bookkeeping tanpa menggandakan side effect.

## 6. Batas security

Outbound MCP bukan plugin installer. Menambahkan server stdio tidak berarti arbitrary repository boleh dieksekusi. Source/plugin executable harus melewati workstream Plugin/Extension Framework: pinned revision, manifest, permission/security gate, provenance, dan Sandbox bila membawa code.
