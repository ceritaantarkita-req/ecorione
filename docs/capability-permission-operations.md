# Unified Capability + Permission Plane — Operations

ADR: [`adr/0025-unified-capability-permission-plane.md`](adr/0025-unified-capability-permission-plane.md)

Hub adalah authority owner. Endpoint ini bukan pengganti generic policy/approval; standing grant harus lolos dulu, kemudian runtime tetap menjalankan kontrol spesifiknya.

## Read-only inspection

### Capability definitions

```http
GET /v1/capabilities
```

### Workspace grants

```http
GET /v1/authority/grants?workspaceId=ws_personal
GET /v1/authority/grants?workspaceId=ws_personal&subjectKind=model&subjectId=hosted
```

### Authorization check

```http
POST /v1/authority/authorize
Content-Type: application/json

{
  "operationId": "op_authoritycheck001",
  "workspaceId": "ws_personal",
  "subject": { "kind": "model", "id": "hosted" },
  "capabilityId": "model.invoke.hosted",
  "permissionIds": ["model.invoke", "network.connect", "provider.spend"],
  "scope": "personal",
  "sensitivity": "INTERNAL",
  "autonomy": "L1"
}
```

Missing/unknown grant menghasilkan `DENY`; authorization check tidak membuat grant.

## Grant workflow

Grant/revoke memakai `POLICY_ADMIN`, sehingga request pertama normalnya menghasilkan `409 AUTHORITY_APPROVAL_REQUIRED` dan durable approval.

Contoh grant:

```http
POST /v1/authority/grants
Content-Type: application/json

{
  "operationId": "op_grantmcpread001",
  "workspaceId": "ws_personal",
  "subject": { "kind": "mcp-tool", "id": "remote/read" },
  "capabilityId": "mcp.tool.call",
  "permissionIds": ["mcp.tool.read"],
  "scope": "personal",
  "maxSensitivity": "INTERNAL",
  "autonomy": "L1",
  "reason": "Allow read-only remote MCP tool.",
  "idempotencyKey": "grant-remote-read-001"
}
```

Approve operation yang sama:

```http
POST /v1/approvals/op_grantmcpread001/decide
Content-Type: application/json

{
  "decision": "APPROVE",
  "note": "Approved by workspace owner"
}
```

Kemudian ulang **request grant yang sama**, termasuk `operationId` dan `idempotencyKey`. Mutation menjadi durable dan retry idempotent.

## Revoke workflow

```http
POST /v1/authority/revoke
Content-Type: application/json

{
  "operationId": "op_revokemcpread001",
  "workspaceId": "ws_personal",
  "subject": { "kind": "mcp-tool", "id": "remote/read" },
  "capabilityId": "mcp.tool.call",
  "permissionIds": ["mcp.tool.read"],
  "scope": "personal",
  "maxSensitivity": "INTERNAL",
  "autonomy": "L1",
  "reason": "Remote integration no longer needed.",
  "idempotencyKey": "revoke-remote-read-001"
}
```

Approve melalui endpoint approval yang sama, lalu retry exact request revoke.

## Outbound MCP examples

Discovery mempunyai subject khusus `${serverId}/server.discover`:

- subject: `mcp-tool:remote/server.discover`
- capability: `mcp.discover`
- permission: `mcp.read`

Remote tool call:

- subject: `mcp-tool:remote/read`
- capability: `mcp.tool.call`
- permission diturunkan dari local `ActionClass`, misalnya `mcp.tool.read`, `mcp.tool.write`, atau `mcp.tool.external-send`.

Jika server menggunakan `credentialRef`, subject tool yang sama juga membutuhkan:

- capability: `secret.access`
- permission: `credential.use`

Grant secret hanya memberi hak memakai named credential melalui owner service. Secret plaintext tetap berada di Connect Credential Vault dan tidak masuk Hub.

> Discovery/enablement di Connect **tidak otomatis membuat authority grant**. Hub tidak membaca registry Connect secara langsung.

## Extension behavior

Extension manifest mendeklarasikan capability + permission. Declaration bukan grant.

- install/update/rollback menyinkronkan declarations;
- permission wajib terikat ke capability yang dideklarasikan;
- grant extension hanya dapat dibuat untuk declaration yang tersedia;
- update yang menghapus declaration otomatis memangkas standing grant yang sudah tidak valid;
- remove membersihkan active declaration/grant;
- revision/provenance Batch 3 tetap append-only.

## Compatibility baseline

Batch 4 membuat one-time explicit baseline grants hanya untuk `ws_personal` agar closed core path tidak rusak:

- model `hosted`;
- model `local`;
- Sandbox `tier0`;
- Sandbox `tier1.5`;
- Sandbox `tier1`.

Baseline state dapat di-revoke. Ini bukan wildcard dan tidak berlaku untuk workspace lain.

Outbound MCP tidak termasuk compatibility migration dan membutuhkan grant operator eksplisit.

## Failure semantics

- unknown capability/declaration → fail closed;
- missing permission → `DENY`;
- scope mismatch → `DENY`;
- request sensitivity di atas `maxSensitivity` → `DENY`;
- reuse idempotency key untuk mutation berbeda → conflict;
- non-approved grant/revoke tidak mengubah authority state;
- authority deny terjadi sebelum provider/network/execution pada integration path yang relevan;
- authority grant tidak melewati generic Hub policy, Spend Budget, Vault, Sandbox boundary, MCP idempotency, atau local tool enablement.

## Audit

Hub canonical audit dapat berisi:

- `CAPABILITY_GRANTED`;
- `CAPABILITY_REVOKED`;
- `CAPABILITY_AUTHORIZED`;
- `CAPABILITY_DENIED`.

Authority append-only event log menyimpan provenance mutation/declaration. Jangan memasukkan raw token/key/password ke `reason`, subject ID, atau metadata audit.
