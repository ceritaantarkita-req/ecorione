# ADR-36 — Trigger dimiliki Flow; Temporal tetap schedule/durability engine

**Status:** Diterima · 2026-09-19 · PE-00

## Konteks

Flow sudah memakai Temporal dan ADR-17 melarang scheduler/retry database kedua. Product Evolution membutuhkan Trigger dan Schedule tanpa polling agent atau durability engine baru.

Repository saat ini mem-pin Temporal TypeScript SDK `1.23.0`.

## Keputusan

1. **Flow service memiliki TriggerDefinition metadata/control API.**
2. **Temporal memiliki runtime truth untuk time schedules, timers, retry, signals, workflow state, dan recovery.**
3. Hub tetap authority plane: Trigger create/update/enable dan execution tidak boleh memberi authority sendiri.
4. Trigger kinds stabil: `manual | time | event | webhook | condition`.
   - PE-03 mengaktifkan hanya `manual` dan `time`;
   - `event`/`webhook` diaktifkan PE-05;
   - `condition` tetap reserved dan tidak boleh berarti polling LLM.
5. Time Trigger memakai Temporal Schedule API, bukan `setInterval`, cron daemon, atau tabel scheduler buatan sendiri.
6. Schedule spec memakai IANA timezone. UI menyimpan timezone eksplisit; jangan hanya offset.
7. Flow version policy v1 = **PINNED ONLY**. Trigger menyimpan exact graph/version. `FOLLOW_LATEST` ditunda sampai ada use case dan audit semantics yang jelas.
8. Overlap v1:
   - `SKIP` -> Temporal overlap SKIP;
   - `QUEUE_ONE` -> Temporal BUFFER_ONE;
   - `BUFFER_ALL`, ALLOW_ALL, CANCEL_OTHER, TERMINATE_OTHER tidak diekspos v1.
9. Misfire/catch-up disimpan eksplisit. Default ECORIONE = 1 minute, bukan hidden default. Batas maksimal awal = 24 hours; lebih besar butuh explicit future decision.
10. Side-effect idempotency key harus mencakup stable Trigger identity + scheduled occurrence/run identity + action fingerprint.
11. Trigger disabled tidak boleh dispatch.
12. Manual trigger juga melewati Hub policy/capability; “manual” bukan bypass.
13. `MAX_AUTONOMY_V1` tetap L3. Effective autonomy tidak boleh melebihi Project ceiling, Trigger request, Flow/node requirement, atau Hub policy.

## Verifikasi API Temporal

Official TypeScript API menyediakan `ScheduleClient.create`, `ScheduleOptions.spec`, policy `catchupWindow` dan `overlap`, serta IANA `timezone` pada `ScheduleSpec`. Overlap enum menyediakan SKIP dan BUFFER_ONE yang sesuai dengan policy v1.

Referensi:
- https://typescript.temporal.io/api/classes/client.ScheduleClient
- https://typescript.temporal.io/api/interfaces/client.ScheduleOptions
- https://typescript.temporal.io/api/interfaces/client.ScheduleSpec
- https://typescript.temporal.io/api/enums/proto.temporal.api.enums.v1.ScheduleOverlapPolicy

PE-03 tetap wajib compile/runtime test terhadap dependency repo yang benar-benar dipin `1.23.0`; dokumentasi eksternal bukan pengganti exact-version test.

## Konsekuensi

- Flow DB boleh menyimpan Trigger definition/configuration dan pointer schedule ID, tetapi tidak membuat second durable schedule state machine.
- Schedule UI adalah editor/view Trigger time definitions.
- Worker/server restart tidak boleh mengubah occurrence semantics.
