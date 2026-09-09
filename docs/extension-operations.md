# Extension Operations

Panduan ini menjelaskan control plane Plugin / Extension Framework Batch 3. Hub menyimpan manifest, revision provenance, installation projection, health, dan immutable operation receipts. Hub **tidak menjalankan extension code**.

## Boundary runtime

Extension manifest hanya boleh memakai:

- `execution.kind = "none"` — metadata/integration declaration tanpa executable runtime;
- `execution.kind = "mcp"` — runtime tetap melalui outbound MCP Client/Manager milik Connect;
- `execution.kind = "sandbox"` — executable bundle hanya melalui Sandbox boundary.

Tidak ada host-process runtime. Jangan clone repository lalu menjalankannya dari Hub.

## Source dan integrity

Supported source:

- GitHub repository + exact 40-character commit SHA;
- HTTPS release URL tanpa username/password/fragment;
- Artifact CAS.

Manifest selalu membawa `bundleSha256` dan `packageArtifactId`. Security admission memastikan digest bundle sama dengan digest Artifact CAS. Ini membuktikan identity/integrity artifact yang diregistrasikan; **bukan** bukti bahwa source bebas vulnerability.

## Declaration minimum

Manifest dapat mendeklarasikan:

- `capabilities[]`;
- `permissions[]` beserta `ActionClass`;
- `secretRequirements[]`.

Baseline admission:

- MCP execution membutuhkan capability `mcp.client`;
- Sandbox execution membutuhkan capability `sandbox.execute` dan permission berkelas `EXECUTE`;
- extension yang meminta secret membutuhkan permission berkelas `CREDENTIAL_ACCESS`;
- wildcard capability/permission ditolak.

Declaration ini bukan grant otomatis. Unified authorization/grant/revocation diselesaikan pada Batch 4.

## HTTP lifecycle

Semua endpoint berada di Hub.

### Validate

`POST /v1/extensions/validate`

Body:

```json
{
  "manifest": { "...": "ExtensionManifest" }
}
```

Validation tidak mengubah registry.

### Install

`POST /v1/extensions/install`

Body mengikuti `ExtensionInstallRequestSchema`: operation/workspace/policy context, idempotency key, dan manifest.

Security admission dijalankan **sebelum** policy/audit mutation. Manifest blocked mendapat `403 EXTENSION_SECURITY_BLOCKED` dan tidak membuat revision/installation.

First successful install menghasilkan 201. Retry dengan idempotency key dan canonical fingerprint yang sama mengembalikan receipt yang sama tanpa mutation kedua. Key yang sama dengan payload berbeda menghasilkan conflict.

### List / get

- `GET /v1/extensions?workspaceId=ws_...`
- `GET /v1/extensions/:id?workspaceId=ws_...`
- `GET /v1/extensions/:id/revisions?workspaceId=ws_...`

Visibility selalu workspace-scoped.

### Update

`POST /v1/extensions/:id/update`

Manifest ID harus sama dengan path ID. Update membuat immutable revision baru dan memindahkan installation projection.

### Rollback

`POST /v1/extensions/:id/rollback`

Body membawa `targetRevisionId`. Target harus berasal dari workspace + extension yang sama. Rollback tidak mengubah revision target; Hub membuat **revision baru** dengan `changeType=ROLLBACK` dan `sourceRevisionId` yang menunjuk target.

### Health

`POST /v1/extensions/:id/health`

Menyimpan projection health `HEALTHY | DEGRADED | ERROR | BLOCKED` beserta detail dan timestamp. Health report tidak mengeksekusi extension.

### Remove

`POST /v1/extensions/:id/remove`

Installation projection menjadi `REMOVED`; revision provenance tidak dihapus.

## Idempotency dan crash semantics

Mutating lifecycle memakai idempotency key dan canonical operation fingerprint. Mutation projection/revision dan immutable operation receipt ditulis dalam transaksi SQLite yang sama. Dengan demikian retry setelah response hilang tidak mengulang lifecycle mutation.

## Credentials

Manifest hanya mendeklarasikan kebutuhan secret. Secret material tidak disimpan dalam Hub extension registry. Connect tetap owner credential material. Jangan memasukkan API key/token/password ke manifest atau revision metadata.

## Operator checklist

Sebelum install/update:

1. pastikan source dipin immutable;
2. pastikan bundle yang dimaksud sudah masuk Artifact CAS dengan digest yang sama;
3. review capability/permission/secret declaration;
4. untuk MCP, daftarkan/configure server melalui Outbound MCP Manager;
5. untuk executable extension, gunakan Sandbox path; jangan menjalankan bundle di host;
6. gunakan idempotency key stabil untuk retry operasi yang sama;
7. cek installation + revision history setelah mutation;
8. update health berdasarkan runtime evidence, bukan asumsi.
