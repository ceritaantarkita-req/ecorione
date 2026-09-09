# ADR-17 — Temporal sebagai mesin durable execution Flow

**Status:** Diterima · 2026-09-09 · Sumber: ADR-08, `blueprint.md` §7, verifikasi upstream 2026-09-09

## Konteks

ADR-08 sudah mengunci bahwa ecorione **tidak membangun scheduler/checkpointer sendiri**.
Fase 4 mewajibkan mesin yang dapat membuktikan tiga hal pada mode self-hosted:

1. workflow resume setelah worker/process crash tanpa mengulang efek samping yang sudah selesai;
2. timer dan human approval dapat menunggu lama tanpa mempertahankan compute aktif;
3. retry/checkpoint/durable state adalah kemampuan engine, bukan emulasi SQLite buatan Flow.

Kandidat yang tersisa di blueprint adalah Temporal dan Trigger.dev.

Verifikasi upstream pada 2026-09-09:

- Temporal mendokumentasikan self-hosting dan workflow yang melanjutkan state setelah crash,
  network failure, atau infrastructure outage. TypeScript SDK menyediakan workflow, worker,
  client, activities, signals, timers, dan retries; paket resmi saat keputusan ini dibuat
  berada di versi `1.23.0` dan berlisensi MIT.
- Trigger.dev tetap kandidat yang bagus untuk TypeScript-first managed workflow, tetapi
  dokumentasi self-host v4 menyatakan checkpoints/non-blocking waits tidak tersedia pada
  self-host; long wait karena itu memakai resource. Ini bertentangan langsung dengan
  requirement Fase 4 "tunggu approval berhari-hari tanpa konsumsi compute" pada mode
  local/self-hosted.

## Keputusan

**Flow v1 memakai Temporal self-hosted.**

- SDK TypeScript dipin eksplisit ke `@temporalio/client`, `@temporalio/worker`,
  `@temporalio/workflow`, dan `@temporalio/activity` versi `1.23.0`.
- Flow hanya berisi workflow definitions, activities/node handlers, worker wiring, dan
  client/HTTP boundary. Flow **tidak** mempunyai tabel checkpoint/scheduler/retry sendiri.
- Temporal Service adalah dependency runtime yang dapat dijalankan lokal/self-hosted.
  Tidak ada ketergantungan wajib ke Temporal Cloud.
- Lima node v1 tetap mengikuti blueprint: transform, delay, human-approval, AI melalui
  Connect, dan execution melalui Sandbox.
- Human approval menggunakan signal Temporal untuk membangunkan workflow yang menunggu.
  Keputusan approval tetap dicatat Hub; Temporal tidak menjadi policy engine kedua.
- Semua effectful activity memakai idempotency key sistem (ADR-12). Activity retry tidak
  boleh mengubah semantic key hanya karena attempt bertambah.
- Workflow L3 hanya boleh selesai setelah node verifikasi independen; aktor yang melakukan
  side effect tidak boleh sekaligus menjadi satu-satunya verifier.
- Tidak ada always-on agent polling. Trigger masuk melalui client/event/schedule; worker
  Temporal boleh long-running karena ia runtime execution, bukan agent yang mem-poll dunia.

## Konsekuensi

- Local stack bertambah satu komponen operasional: Temporal Service. Kompleksitas ini
  diterima karena durability tidak akan diimplementasikan ulang di ecorione.
- Test unit Flow memakai Temporal test environment/time-skipping bila sesuai; closure Fase 4
  tetap membutuhkan acceptance dengan Temporal Service nyata dan worker crash/restart.
- Trigger.dev tidak dinyatakan buruk atau dilarang selamanya. Mengganti engine di masa
  depan butuh ADR baru dan bukti bahwa semantics crash recovery, wait tanpa compute,
  signals, idempotency, dan audit tetap terpenuhi.

## Sumber upstream yang diverifikasi

- Temporal documentation: https://docs.temporal.io/
- Temporal TypeScript SDK packages: https://www.npmjs.com/package/@temporalio/client
- Trigger.dev self-host v4: https://trigger.dev/blog/self-hosting-trigger-dev-v4-docker
