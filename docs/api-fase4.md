# API Fase 4 — Flow durable execution

**Status:** CLOSURE CANDIDATE · 2026-09-09

Dokumen ini mencatat kontrak yang benar-benar diimplementasikan pada Fase 4. Sumber arsitektur tetap `prd.md`, `blueprint.md`, ADR-08, ADR-12, dan ADR-17; dokumen ini tidak membuat scheduler atau durability layer baru di luar keputusan tersebut.

## 1. Durable engine

Flow dibangun di atas **Temporal self-hosted**. SDK TypeScript dipin eksplisit ke `1.23.0`; tidak ada alias `latest` atau range untuk dependency Temporal runtime.

Keputusan final ada di ADR-17. Flow tidak mempunyai database durability sendiri: workflow state, timer, retry, signal, dan recovery berada di Temporal. Hub tetap source of truth untuk approval/audit, bukan Temporal UI atau service Flow.

Service HTTP: `services/flow`, default `http://127.0.0.1:17028`.

Worker: `services/flow/src/worker-main.ts`, default Temporal `127.0.0.1:7233`, namespace `default`, task queue `ecorione-flow`.

## 2. Workflow v1

V1 sengaja typed dan linear, bukan generic DAG builder prematur:

1. transform input secara deterministik;
2. durable delay melalui Temporal `sleep`;
3. buat durable human approval di Hub;
4. tunggu Temporal approval signal tanpa menahan proses Node;
5. panggil Connect untuk AI node;
6. panggil Sandbox untuk execution node;
7. verifikasi execution secara independen melalui trace RnD;
8. catat trace completion.

Semua side-effect child memakai operation/idempotency identity yang stabil antar retry Temporal.

### Approval ordering

Flow tidak boleh membangunkan workflow lebih dulu lalu mencatat approval belakangan. Endpoint decision melakukan urutan:

`Flow → Hub approval decision → Temporal signal`

Jika Hub gagal atau menolak decision, signal tidak dikirim.

### Independent execution verification

Sandbox tidak menilai receipt-nya sendiri. Setelah Sandbox selesai, Flow meminta RnD trace untuk operation execution dan memerlukan bukti `sandbox.execution.completed` yang cocok dengan receipt sukses. Jika bukti tidak ada/mismatch, workflow gagal non-retryable dengan type `FLOW_VERIFICATION_FAILED`.

## 3. HTTP API

### `POST /v1/flows`

Memulai workflow baru. Body mengikuti `FlowStartRequestSchema` di `packages/shared-schema/src/flow.ts`.

Contoh:

```json
{
  "scope": "personal",
  "sensitivity": "INTERNAL",
  "inputText": "ringkas laporan lalu jalankan pemeriksaan",
  "delayMs": 0,
  "approvalPrompt": "Setujui eksekusi?",
  "aiTarget": "local",
  "aiMessage": "Ringkas input.",
  "execution": {
    "tier": "tier0",
    "workspace": "/path/di-bawah-workspace-root",
    "command": "pwd",
    "wasmBase64": null,
    "wasmExport": "run",
    "wasmArgs": []
  }
}
```

Respons `202` berisi:

- `flowId` memakai canonical `wf_` / `WorkflowIdSchema`;
- `operationId` memakai `op_`;
- `temporalWorkflowId` sama dengan `flowId` pada v1.

### `GET /v1/flows/:id`

Membaca status execution langsung dari Temporal. Flow tidak menyalin status workflow ke SQLite lokal.

### `POST /v1/flows/:id/decision`

Body:

```json
{
  "decision": "APPROVE",
  "note": "opsional"
}
```

Flow membaca `operationId` dari workflow query Temporal, commit decision ke Hub terlebih dahulu, kemudian mengirim signal `approval` ke workflow yang sama.

## 4. Service boundaries

Flow tidak membuka DB service lain.

- approval/policy: HTTP Hub;
- AI: HTTP Connect `/v1/complete`;
- execution: HTTP Sandbox `/v1/executions`;
- verification/trace: HTTP RnD;
- durable state/timer/signal: Temporal.

Provider credential tetap hanya dimiliki Connect. Flow tidak memegang API key provider.

## 5. Runtime acceptance

`test/phase4-temporal-runtime.test.ts` mempunyai dua lapis acceptance:

1. local Temporal server nyata + worker graceful shutdown/replacement saat workflow menunggu approval;
2. process-level vertical slice dengan worker child yang **di-SIGKILL dua kali**: pertama ketika durable delay masih berjalan, kedua ketika Hub approval pending. Worker pengganti kemudian melanjutkan workflow yang sama.

Vertical slice kedua menggunakan:

- Temporal local server nyata;
- Hub nyata + approval/audit SQLite in-memory;
- Connect nyata;
- Sandbox nyata Tier 0;
- RnD nyata;
- Flow HTTP nyata;
- provider lokal OpenAI-compatible berupa HTTP stub deterministik khusus CI, sehingga acceptance tidak mengklaim Ollama/cloud provider eksternal sungguhan.

Run `34304296140` membuktikan implementation candidate ini lulus **51 test files / 328 tests**, termasuk process crash/recovery, Docker Fase 3, lint, typecheck, secret scan, dan production build. Workflow pada run tersebut masih memakai helper canonicalizer; status Fase 4 baru boleh diubah menjadi **CLOSED** setelah workflow CI dikembalikan ke frozen/read-only strict gate dan strict run juga hijau.
