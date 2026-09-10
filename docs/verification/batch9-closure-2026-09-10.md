# Batch 9 Closure Verification — Node Registry + Visual Flow Canvas

Date: 2026-09-10

## Verdict

Batch 9 implementation memenuhi scope Node Registry + Visual Flow Canvas tanpa membuat durability engine kedua. Exact implementation-head CI, MCP External HTTPS Acceptance, expected-head merge, dan post-merge `main` verification seluruhnya hijau.

Hard invariants yang dipertahankan:

> Flow memiliki graph definition/version control plane, tetapi Temporal tetap satu-satunya durable execution engine. Hub tetap authority owner; node declaration bukan grant. Owner-service boundaries tidak dilewati oleh graph runtime.

## Implemented boundary

Node/graph control plane sekarang memiliki:

- shared versioned node contracts dengan stable `core/<kind>/v1` identity;
- input/output ports, capability requirements, policy ActionClass, side-effect flag, secret-ref policy, resource ceilings, retry ceilings, dan idempotency semantics;
- 17 core node kinds: Trigger, AI, Memory/Context, Artifact, MCP Tool, HTTP/API, Transform, Condition/Switch, Loop/Map, Parallel, Delay/Schedule, Approval, Human Input, Sandbox Code, Data Owner API, Notification, dan Subflow;
- deterministic graph validation/compiler dengan exact graph/plan digest;
- tepat satu Trigger, reachability/port validation, DAG enforcement, dan bounded Loop/Map semantics;
- immutable append-only graph versions dengan optimistic `expectedVersion` conflict protection dan current-content dedupe;
- exact compiled graph version dikirim ke Temporal untuk setiap run;
- durable Temporal timer, signal, approval wait, human-input wait, parallel level execution, dan child-workflow subflow;
- direct subflow recursion rejection dan depth ceiling 8.

Authority/execution boundaries:

- core node declarations disinkronkan ke Hub tanpa membuat auto-grant;
- setiap node meminta `node.execute` authorization untuk exact workspace/scope/sensitivity;
- generic policy gate berjalan untuk node yang memiliki ActionClass;
- approval decision dikomit di Hub sebelum Temporal signal;
- AI tetap melewati Connect + model authority;
- Memory/Context, Artifact, dan Space tetap memakai owner API masing-masing;
- MCP Tool tetap melewati Connect outbound MCP manager;
- Sandbox Code tetap melewati Sandbox dan matching independent RnD proof;
- Data Owner API v1 hanya GET ke explicit `<service>:<path-prefix>` allowlist;
- HTTP/API v1 hanya HTTPS ke exact hostname allowlist, menolak URL credential/fragment dan credential-looking inline headers, serta memberi deterministic idempotency key untuk POST.

Visual surface:

- Ai route `/flow` menyediakan node palette dan drag/drop placement;
- graph edges dan inspector/configuration panel;
- validation dan save/load/version workflow;
- run controls, execution/node status, approval/human-input controls;
- trace operation linkage ke runtime evidence.

## Regression and runtime proof

Focused coverage yang ditambahkan mencakup:

- shared 17-node contract stability dan secret/config rejection;
- deterministic compiler levels, cycle/unreachable/port/secret/limit rejection;
- append-only graph versioning, current-content dedupe, dan stale writer conflict;
- Hub declaration sync tanpa auto-grant;
- Flow HTTP save -> validated compiled plan -> Temporal start integration;
- Temporal graph runtime acceptance dengan durable timer, human input, conditional branch, dan approval resume;
- existing full repository regression, Docker/Temporal recovery acceptance, secret scan, production build, dan public HTTPS MCP acceptance.

Hardening yang ditemukan selama implementasi juga ditutup:

- Flow frozen lockfile disinkronkan untuk `better-sqlite3`;
- Hub node declaration route diregister ke server;
- Data Owner `space` runtime URL wiring dilengkapi;
- strict `exactOptionalPropertyTypes` issues pada HTTP body, override types, Temporal client type, dan child workflow diperbaiki tanpa melonggarkan compiler;
- Flow DB env dinormalisasi menjadi `ECORIONE_FLOW_DB_PATH`;
- runtime HTTP dan owner API allowlists didokumentasikan sebagai fail-closed controls;
- Temporal acceptance fixture diperbaiki agar mengikuti Human Input node contract (`prompt` wajib), bukan melonggarkan schema;
- temporary development helper workflows tidak ada pada final implementation tree.

## Evidence chain

### Exact implementation head

- implementation branch: `agent/batch9-node-registry-canvas-20260910`;
- implementation PR: #23;
- exact final PR head: `6294a6f641b1ddecf23ccac23ab1e85ce8da7fe8`;
- exact-head CI `34435365038`: PASS untuk Naming, Format, Lint, Typecheck, Test, Phase 4 real-process acceptance, Secret Scan, dan Production Build;
- exact-head MCP External HTTPS Acceptance `34435365023`: PASS, termasuk public HTTPS MCP acceptance.

### Merge and post-merge verification

- PR #23 merged memakai expected-head lock terhadap `6294a6f641b1ddecf23ccac23ab1e85ce8da7fe8`;
- implementation merge SHA: `05b05a5f22133d61a411ff22463ac5acfaf4c5eb`;
- `main` dikonfirmasi menunjuk exact merge SHA tersebut;
- post-merge `main` CI `34435559155`: PASS untuk Naming, Format, Lint, Typecheck, Test, Phase 4 real-process acceptance, Secret Scan, dan Production Build.

## Scope closure

Scope canonical Batch 9 tercakup:

- versioned node definition contract — complete;
- input/output schema/ports — complete;
- capability/permission declaration — complete;
- side-effect + secret-ref policy — complete;
- timeout/resource + retry ceilings — complete;
- idempotency semantics — complete;
- 17-node core pack — complete;
- graph validation/compiler — complete;
- save/load/version — complete;
- Temporal-backed execution — complete;
- Hub authority/approval integration — complete;
- owner-service execution boundaries — complete;
- drag/drop visual canvas + edges + configuration — complete;
- execution status + trace linkage — complete.

## Explicit production boundary

Batch 9 tidak mengubah Flow menjadi general credential gateway dan tidak membuat workflow-state database kedua. Credentialed external integration tetap harus memakai Connect/Vault atau owner integration yang sesuai. Production Flow recovery tetap mengikuti persistence Temporal yang dipakai deployment; Flow SQLite hanya menyimpan graph definition/version control-plane data.

## Closure result

Batch 9: **CLOSED**.

Next implementation target: **Batch 10 — Space Block Runtime**.
