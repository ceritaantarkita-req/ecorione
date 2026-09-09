# ADR-25 — Unified Capability + Permission Plane

**Status:** Accepted  
**Date:** 2026-09-09

## Context

Sebelum Batch 4, ecorione sudah punya beberapa kontrol yang benar tetapi tersebar:

- Hub memiliki deterministic `ActionClass` policy + durable human approval;
- outbound MCP memiliki local tool enablement + `ActionClass`;
- Extension manifest mendeklarasikan capability/permission, tetapi deklarasi bukan authority grant;
- Sandbox melewati Hub policy tetapi belum punya standing workspace grant;
- model hosted/local dan Flow belum memakai authority grant yang sama;
- Node Registry akan membutuhkan kontrak permission yang dapat dipakai ulang.

Kalau tiap runtime membuat permission store sendiri, revoke tidak konsisten, audit terfragmentasi, dan service dapat diam-diam melewati kontrol service lain.

## Decision

### 1. Hub adalah satu-satunya authority plane

Hub memiliki registry capability/permission dan standing grants. Connect, Sandbox, Flow, Extension, dan future Node Registry memakai Hub melalui contract/service boundary; mereka tidak membuka database Hub secara langsung.

Grant diidentifikasi oleh:

`workspace + subject + capability + permission + scope + maxSensitivity`.

Subject baseline:

- `extension`;
- `mcp-tool`;
- `sandbox`;
- `model`;
- `tool`;
- `node`.

Unknown capability, undeclared permission, scope mismatch, sensitivity di atas ceiling, atau missing grant adalah `DENY`.

### 2. Declaration bukan grant

Extension dan future node boleh mendeklarasikan kebutuhan capability/permission. Deklarasi hanya membatasi apa yang dapat diminta; ia tidak memberi authority dengan sendirinya.

Extension permission wajib dapat dipetakan deterministik ke capability yang dideklarasikan. Update manifest menyinkronkan declaration dan mencabut grant yang declaration-nya sudah hilang. Remove membersihkan declaration + active grant tetapi tidak menghapus revision provenance Batch 3.

### 3. Grant/revoke adalah `POLICY_ADMIN`

`POLICY_ADMIN` ditambahkan ke `ActionClass` dan selalu human-gated oleh policy/approval engine Hub yang sudah ada. Tidak dibuat approval engine kedua.

Urutan grant/revoke:

1. request authority mutation;
2. existing policy menghasilkan durable approval;
3. user `APPROVE`;
4. exact request/idempotency key diulang;
5. mutation dilakukan atomik dan menghasilkan immutable receipt/audit.

### 4. Standing authority dan per-action policy tetap berbeda

Standing grant menjawab *bolehkah subject memakai capability ini dalam workspace/scope/sensitivity tersebut?* Generic Hub policy tetap menjawab *apakah aksi tertentu memerlukan approval berdasarkan ActionClass/autonomy?*

Contoh: permission `provider.spend` memberi hosted model hak menggunakan jalur berbiaya. Ini bukan approval untuk setiap provider call; Connect Spend Budget ADR-21 tetap admission/cap untuk biaya aktual.

### 5. Runtime aktif wajib melewati authority sebelum side effect/egress

- Chat hosted model: authority diperiksa sebelum Context/provider egress.
- Flow hosted/local model: authority diperiksa sebelum Connect call.
- Sandbox: authority diperiksa sebelum generic policy dan execution.
- outbound MCP: authority diperiksa sebelum generic policy, connect/discovery, dan remote dispatch.
- MCP credentialRef membutuhkan grant `secret.access / credential.use` terpisah.

Local tool enablement, Sandbox boundary checks, MCP idempotency reservation, Credential Vault, Spend Budget, dan generic policy tetap berlaku; authority plane menambah lapisan standing grant, bukan menggantikannya.

### 6. Compatibility migration eksplisit dan revocable

Untuk menjaga perilaku core yang sudah CLOSED, Hub membuat one-time baseline grants pada `ws_personal` untuk:

- hosted model;
- local model;
- Sandbox tier0;
- Sandbox tier1.5;
- Sandbox tier1.

Baseline grants adalah state eksplisit dan dapat di-revoke. Tidak ada wildcard implicit allow.

Outbound MCP **tidak** dimigrasikan otomatis. Hub tidak boleh mengintrospeksi registry/DB Connect untuk membuat grant. Operator harus memberi grant MCP discover/tool/credential secara eksplisit.

### 7. Durable/auditable state

Hub menyimpan:

- code-owned capability definitions;
- workspace/subject declarations;
- active grants;
- append-only authority events;
- immutable idempotent mutation receipts.

Canonical audit mencatat grant, revoke, allow, dan deny. Raw secret tidak pernah masuk authority state atau audit.

## Consequences

### Positive

- satu semantic permission plane untuk MCP/Extension/Sandbox/model/tool/Node;
- revoke konsisten lintas runtime;
- fail-closed default;
- workspace/scope/sensitivity isolation menjadi first-class;
- Batch 9 Node Registry dapat memakai contract yang sama tanpa permission subsystem baru;
- policy/approval, Vault, Spend Budget, Sandbox, dan idempotency boundaries yang sudah CLOSED tetap dipertahankan.

### Cost / trade-off

- operator harus memberi grant eksplisit untuk outbound MCP yang sebelumnya hanya punya local tool policy;
- request runtime menambah authority check ke Hub;
- compatibility baseline harus diperlakukan sebagai migration, bukan default wildcard baru;
- declarations dan grants perlu disinkronkan saat extension berubah.

## Rejected alternatives

1. **Permission store per service** — ditolak karena revoke/audit akan tidak konsisten.
2. **Manifest declaration = auto grant** — ditolak karena install extension dapat menaikkan privilege sendiri.
3. **Hub membaca DB/registry Connect** — ditolak karena melanggar owner-service boundary.
4. **Semua permission lewat generic ActionClass saja** — ditolak karena ActionClass tidak mewakili workspace subject/capability/scope/sensitivity standing authority.
5. **Auto-grant discovered MCP tools** — ditolak karena remote discovery bukan authorization.

## Verification requirements

Closure Batch 4 membutuhkan:

- grant/revoke human approval + idempotency regression;
- workspace/scope/sensitivity fail-closed tests;
- extension declaration/grant pruning tests;
- Sandbox deny-before-execution test;
- MCP + credential deny-before-network/policy progression tests;
- hosted Chat deny-before-egress test;
- Flow/Temporal regression;
- exact-head Format/Lint/Typecheck/Test/Phase4 process/Secret Scan/Production Build;
- MCP External HTTPS regression karena Hub/Connect boundary berubah;
- expected-head merge dan post-merge `main` verification.
