# Node Registry + Visual Flow Canvas — operator guide

Batch 9 menambahkan user-composable graph di atas Flow tanpa membuat durability engine kedua. Graph definition/version dimiliki Flow; execution tetap Temporal; authority tetap Hub.

## Runtime boundary

- Flow API: `ECORIONE_FLOW_URL` (default `http://127.0.0.1:17028`).
- Flow graph DB: `ECORIONE_FLOW_DB_PATH` (default repo `data/flow.sqlite`). DB ini hanya control-plane definition/version.
- Temporal: `ECORIONE_TEMPORAL_ADDRESS` + `ECORIONE_TEMPORAL_NAMESPACE` tetap menyimpan durable workflow execution.
- HTTP node: `ECORIONE_FLOW_HTTP_HOST_ALLOWLIST` berisi comma-separated exact hostnames. Empty berarti semua generic external HTTP node ditolak.
- Data Owner node: `ECORIONE_FLOW_OWNER_API_ALLOWLIST` berisi comma-separated `<service>:<path-prefix>`. Empty berarti generic owner API node ditolak.
- Visual Canvas: app Ai route `/flow` dan proxy `/api/flow/...`.

## Node registry

`GET /v1/nodes` mengembalikan 17 core node definition v1. Definition memuat:

- stable `core/<kind>/v1` identity;
- input/output ports;
- capability requirements;
- generic policy ActionClass bila diperlukan;
- side-effect flag;
- secret-ref policy;
- maximum resource limits;
- retry ceiling;
- idempotency semantics.

Perubahan behavior yang tidak backward-compatible harus memakai node version baru; jangan mutate arti `v1` diam-diam.

## Graph lifecycle

- `POST /v1/graphs/validate` — compile/validate graph tanpa menyimpan.
- `GET /v1/graphs?workspaceId=...` — list graph summaries.
- `POST /v1/graphs` — create graph v1 dan sync core-node declarations ke Hub.
- `GET /v1/graphs/:id` — current version; `?version=N` membaca historical immutable version.
- `PUT /v1/graphs/:id` — save dengan `expectedVersion`; stale write menghasilkan conflict.
- `GET /v1/graphs/:id/versions` — version history.
- `POST /v1/graphs/:id/runs` — start exact compiled version di Temporal.
- `GET /v1/graph-runs/:id` — Temporal status + graph/node state.
- `POST /v1/graph-runs/:id/nodes/:nodeId/decision` — commit Hub approval lalu signal Temporal.
- `POST /v1/graph-runs/:id/nodes/:nodeId/input` — signal human input ke Temporal.

Valid graph harus memiliki tepat satu Trigger, seluruh node reachable, port valid, dan graph harus DAG. `Loop/Map` menangani iterasi bounded tanpa membuat cycle graph.

## Authority dan approval

Graph creation/update menyinkronkan **declaration** untuk core nodes. Ini tidak mengizinkan eksekusi.

Operator harus memberikan `node.execute / node.execute` grant untuk subject node yang dibutuhkan, scoped ke workspace + scope + sensitivity ceiling. Grant/revoke tetap melewati Hub `POLICY_ADMIN` approval flow ADR-25.

Saat run:

1. Flow meminta Hub authorize untuk `subject.kind=node` dan exact `definitionId`.
2. Bila node punya `ActionClass`, Flow menjalankan generic Hub policy.
3. Bila policy meminta approval, run masuk `WAITING_APPROVAL`.
4. Endpoint decision memvalidasi approval key, commit keputusan di Hub, lalu mengirim Temporal signal.
5. Missing declaration/grant, policy deny, atau malformed approval gagal tertutup.

AI node masih membutuhkan model authority tersendiri. MCP/Sandbox tetap menjalankan authority/policy boundary milik jalur masing-masing.

## HTTP/API safety

Generic HTTP node v1:

- hanya `https:`;
- exact hostname harus ada di allowlist;
- username/password/URL fragment dilarang;
- credential-looking request headers dilarang di schema;
- graph inline secret scan menolak key seperti token/password/secret/api-key;
- POST mendapat deterministic `idempotency-key` berdasarkan run + node + graph version;
- generic Hub policy dievaluasi sebelum dispatch.

Credentialed integration jangan dipaksa melalui node ini. Gunakan Connect outbound MCP/Vault atau owner connector boundary yang relevan.

## Data Owner node

Node ini hanya membuat GET ke service owner yang telah dipetakan (`context`, `artifact`, `space`, `rnd`, `hub`, `connect`) dan hanya bila `<service>:<path-prefix>` ada di allowlist. Ia tidak membuka akses DB lintas service.

## Execution semantics

- Delay menggunakan Temporal durable timer.
- Parallel berjalan per compiler level dan dibatasi `graph.maxParallelism` serta node ceilings.
- Condition memilih output port `true`/`false` dan branch lain menjadi `SKIPPED`.
- Human Input menunggu Temporal signal.
- Approval menunggu durable Hub decision + Temporal signal.
- Sandbox harus memiliki matching independent RnD completion proof.
- Subflow memakai Temporal child workflow, direct recursion ditolak, depth maksimum 8.
- Node failure menghasilkan `FAILED` state dan RnD failure trace; retry memakai versioned node retry ceiling.

## Persistence dan DR

Flow DB hanya menyimpan graph metadata/version. Ia dapat dibackup/restore memakai `services/flow/src/backup.ts` dan generic owner backup primitives Batch 8. Temporal persistence tetap memiliki DR channel sendiri sesuai ADR-17/ADR-29.

Jangan memulihkan Flow DB sebagai pengganti Temporal state, dan jangan membuat tabel execution-state baru di Flow untuk meniru Temporal.

## Verification baseline

Batch 9 dianggap closure-ready hanya bila:

- shared contract/compiler tests PASS;
- graph repository/version tests PASS;
- Hub declaration/no-auto-grant regression PASS;
- Flow HTTP save→compiled-plan→Temporal-start integration PASS;
- dedicated Temporal graph runtime acceptance PASS;
- full Format/Lint/Typecheck/Test/Phase4 recovery/Secret Scan/Production Build PASS;
- MCP External HTTPS regression PASS;
- exact final branch HEAD diverifikasi, merged dengan expected-head lock, lalu `main` post-merge full green.
