# ADR-30 — Node Registry + Visual Flow memakai Flow control plane, Hub authority, dan Temporal runtime

**Status:** Accepted  
**Tanggal:** 2026-09-10

## Konteks

Flow Fase 4 sudah memakai Temporal sebagai durable execution engine (ADR-17). Batch 4 sudah menetapkan Hub sebagai capability/permission authority tunggal (ADR-25). Batch 9 membutuhkan execution layer yang dapat disusun user seperti workflow canvas tanpa membuat scheduler, retry engine, signal store, atau workflow-state database kedua.

Node juga bukan sekadar elemen UI. Setiap node harus punya identity/version, port contract, capability requirement, side-effect declaration, secret policy, resource ceiling, retry policy, dan idempotency semantics yang dapat divalidasi sebelum run.

## Keputusan

1. **Flow memiliki Node Registry dan graph definition control plane.** Shared contract berada di `packages/shared-schema/src/nodes.ts`; implementasi core registry/compiler berada di `services/flow/src/node-registry.ts`.
2. **Flow SQLite hanya menyimpan graph definition dan append-only graph versions.** Database ini bukan execution durability store. Timer, retry, signal, workflow state, child workflow, dan recovery tetap dimiliki Temporal.
3. **Setiap run mengeksekusi compiled immutable plan dari satu graph version.** Save menggunakan optimistic `expectedVersion`; stale writer gagal conflict. Save yang byte-equivalent dengan current version didedupe; perubahan atau revert ke isi versi lama menghasilkan versi baru bila berbeda dari current version.
4. **Graph runtime adalah DAG.** Cycle graph ditolak. Iterasi hanya melalui bounded `Loop/Map` node; recursive subflow langsung ditolak dan depth subflow dibatasi 8.
5. **Core node pack v1 berisi 17 node:** Trigger, AI, Memory/Context, Artifact, MCP Tool, HTTP/API, Transform, Condition/Switch, Loop/Map, Parallel, Delay/Schedule, Approval, Human Input, Sandbox Code, Data Owner API, Notification, dan Subflow.
6. **Hub tetap authority owner.** Flow menyinkronkan declaration `node.execute` per core node ke Hub. Declaration tidak membuat grant. Eksekusi setiap node meminta authorization Hub untuk exact workspace/scope/sensitivity; missing declaration/grant gagal tertutup.
7. **Generic policy tetap berjalan setelah standing authority.** Node dengan `ActionClass` menjalani `/v1/actions/evaluate`. Approval durable dikomit di Hub sebelum Flow mengirim Temporal signal.
8. **Owner boundaries tidak dilewati.** AI memakai Connect dan model authority; Memory memakai Context; Artifact memakai Artifact; MCP memakai Connect outbound MCP manager; executable code memakai Sandbox dan RnD proof; Data Owner node hanya GET ke owner API prefix yang di-allowlist.
9. **HTTP/API node v1 sengaja sempit:** hanya HTTPS, exact hostname allowlist, tanpa username/password/fragment, tanpa credential-looking header, dan POST mendapat deterministic idempotency key. Credentialed external integration harus memakai owner boundary seperti Connect MCP/Vault, bukan menaruh secret di graph.
10. **Resource/retry override hanya boleh memperketat registry ceiling.** Compiler menolak limit atau retry escalation.
11. **Secret plaintext tidak boleh disimpan di graph.** Field yang tampak seperti token/key/password/credential ditolak; `secretRefs` hanya diizinkan ketika definition secara eksplisit mengizinkannya.
12. **Observability memakai RnD trace.** Node start/completion/failure dan notification baseline dicatat dengan graph/run/operation linkage. Canvas membaca state Temporal/Flow API; UI bukan source of truth runtime.
13. **Visual Flow Canvas berada di app Ai route `/flow`.** UI menyediakan node palette, drag/drop placement, edges, inspector/configuration, validation, save/load/version, run status, approval/human-input controls, dan trace operation linkage melalui Flow HTTP API.

## Konsekuensi

- ECORIONE mendapat workflow composition yang dapat diinspeksi dan diversi tanpa menambah durability engine kedua.
- Flow DB wajib ikut owner-scoped backup/restore, tetapi kehilangan Flow DB tidak menggantikan atau mengubah Temporal execution history.
- Node baru harus menambah versioned contract + registry definition + validator/runtime implementation; perubahan perilaku existing node memerlukan versi node baru bila compatibility tidak dapat dipertahankan.
- Grant node harus diberikan operator secara eksplisit melalui Hub authority flow; graph yang valid secara struktur belum tentu authorized untuk dieksekusi.
- Generic HTTP node bukan credential gateway. Integrasi yang membutuhkan secret harus tetap menggunakan Connect/Vault atau owner integration yang sesuai.
- Managed multi-host deployment tetap membutuhkan persistence Temporal yang benar dan shared deployment strategy; ADR ini tidak memperkenalkan replacement untuk Temporal.
