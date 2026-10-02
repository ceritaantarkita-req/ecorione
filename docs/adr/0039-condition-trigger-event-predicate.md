# ADR-39 — Condition Trigger adalah predicate event, bukan polling engine

**Status:** Diterima · 2026-10-02 · Session 10

## Konteks

ADR-36 menstabilkan Trigger kind `condition` tetapi sengaja menahannya sebagai reserved. Session 9 kemudian memproductize `event` dan `webhook` Trigger yang sudah aktif tanpa membuat autonomous service.

Kebutuhan produk berikutnya adalah pekerjaan non-time yang hanya berjalan ketika keadaan pada event tertentu memenuhi syarat. Implementasi tidak boleh berubah menjadi polling daemon, scheduler kedua, atau always-on LLM monitor.

## Keputusan

1. **Flow tetap pemilik Condition Trigger.** Tidak ada service `autonomous` baru.
2. `condition` diaktifkan sebagai Trigger kind yang menerima **NormalizedTriggerEvent** yang sama dengan event automation.
3. Condition **hanya dievaluasi ketika event masuk** melalui ingress event yang sudah ada. Tidak ada timer, cron, `setInterval`, background scan, atau model polling.
4. V1 configuration terdiri dari:
   - `source`;
   - `eventKind`;
   - satu deterministic `predicate`.
5. Predicate V1 hanya boleh membaca path bounded dari:
   - `payload.<field...>`; atau
   - `metadata.<field...>`.
6. Path dibatasi maksimal delapan segmen setelah root dan menolak `__proto__`, `prototype`, serta `constructor`.
7. Operator V1:
   - `EQ`, `NEQ`;
   - `GT`, `GTE`, `LT`, `LTE` untuk number tanpa coercion;
   - `CONTAINS` untuk string/array dengan strict equality;
   - `EXISTS`.
8. Nilai pembanding hanya JSON primitive bounded: string, finite number, boolean, atau null.
9. Tidak ada `eval`, dynamic code, user regex, expression language, atau arbitrary script pada predicate.
10. Jika selector source/kind tidak cocok, delivery tetap fail closed seperti Event Trigger.
11. Jika selector cocok tetapi predicate bernilai false, hasilnya adalah deterministic no-op:
    - tidak memanggil Hub execution policy;
    - tidak memulai Temporal Flow;
    - tidak membuat side effect.
12. Jika predicate true, jalur authority tetap:
    ```text
    normalized event
      -> enabled Condition Trigger
      -> deterministic predicate
      -> Project + exact pinned Flow validation
      -> Hub policy / approval / capability
      -> Temporal-backed Flow execution
      -> Run projection
    ```
13. Condition Trigger tidak boleh menaikkan authority. `MAX_AUTONOMY_V1` tetap L3.
14. Provider-specific adapters (mis. Gmail/Telegram) tetap scope terpisah dan harus menormalisasi event sebelum Condition Trigger.
15. Schedule tetap khusus time Trigger; Temporal tetap schedule/durability owner.

## Konsekuensi

- Condition dapat dipakai untuk kasus seperti menjalankan Flow hanya saat `payload.score >= 80` tanpa agent yang terus memeriksa keadaan.
- Retries dari event yang benar-benar dispatch tetap memakai event delivery dedupe/idempotency yang sudah ada.
- False condition tidak menghasilkan execution receipt karena tidak ada execution; retry terhadap payload/config yang sama tetap deterministik.
- Mengubah predicate lalu mengirim ulang event lama dapat menghasilkan evaluasi berbeda dan diperlakukan sebagai explicit operator configuration change, bukan replay dari execution lama.
- Kebutuhan stateful threshold lintas banyak event, window aggregation, polling external state, atau LLM-based semantic condition memerlukan ADR/scope baru.

## Non-goals

Session 10 tidak:

- membuat autonomous polling service;
- mengaktifkan L4 / AutoClick;
- membuat Task domain;
- membuat provider-specific Gmail/Telegram connector;
- membuat scheduler/queue/execution database kedua;
- mengizinkan external caller memilih Workspace, Project, Flow, version, atau autonomy;
- melakukan production cutover.
