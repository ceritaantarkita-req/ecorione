# ADR-21 — Durable cumulative spend budget di Connect

**Status:** Accepted · 2026-09-09

## Konteks

`ECORIONE_COST_KILL_SWITCH` hanya sakelar darurat. Ia tidak membatasi total spend per hari/bulan dan tidak memberi perlindungan terhadap restart atau dua hosted call yang datang hampir bersamaan.

Budget juga tidak boleh diletakkan di Hub/AI karena Flow, MCP, atau caller masa depan dapat memanggil Connect lewat jalur lain. Serialization point yang benar adalah **Connect provider boundary**, tepat sebelum request hosted dikirim.

## Keputusan

Connect memiliki `FileSpendBudget` durable dengan dua limit opsional:

- `ECORIONE_SPEND_DAILY_USD`
- `ECORIONE_SPEND_MONTHLY_USD`

State disimpan di `ECORIONE_SPEND_BUDGET_PATH` dan ditulis dengan atomic file replacement. Sebelum hosted cache-miss dikirim ke provider, Connect membuat **reservation** konservatif. Reservation ikut dihitung terhadap limit harian/bulanan sebelum dispatch.

Writer memakai exclusive filesystem lock supaya dua process tidak melakukan admission terhadap snapshot lama yang sama. Lock conflict/corrupt store gagal tertutup; hosted call tidak dijalankan.

Status entry:

- `reserved` — admission sudah durable, provider belum memiliki hasil terkonfirmasi;
- `uncertain` — provider call gagal/hasil billing ambigu; reservation tetap dihitung;
- `settled` — provider sukses dan actual cost sudah durable.

Provider success mengganti nilai reservation dengan `actualUsd`. Jika actual cost melebihi reservation, overrun tetap dicatat dan mengurangi headroom call berikutnya. Jika settlement gagal **setelah provider sukses**, response provider tidak diubah menjadi retryable error; reservation konservatif tetap tersimpan sehingga retry otomatis tidak dipicu hanya oleh kegagalan accounting pasca-dispatch.

Cache hit internal dan route lokal tidak memakai hosted budget karena tidak menimbulkan provider spend hosted.

## Reservation

Anthropic v1 menghitung reservation dari:

1. request-body UTF-8 bytes sebagai ceiling konservatif untuk prompt-token proxy;
2. framing allowance eksplisit;
3. rate prompt paling mahal dari input/cache-write/cache-read untuk model pinned;
4. seluruh `max_tokens` output yang mungkin dipakai.

Estimator bukan invoice provider dan tidak menggantikan actual usage. Fungsinya hanya admission control konservatif sebelum provider call.

## Failure semantics

- Limit terlampaui → `429 SPEND_BUDGET_EXCEEDED`.
- Store/lock/format failure → `503 SPEND_BUDGET_UNAVAILABLE`.
- Provider failure setelah reservation → reservation dipertahankan (`uncertain` bila marker berhasil).
- Tidak ada silent fallback ke local untuk menghindari budget.

## Konsekuensi

Positif:

- budget bertahan restart;
- concurrent process tidak dapat oversubscribe dari snapshot sama;
- crash/ambiguous provider failure tidak diam-diam membebaskan budget;
- seluruh caller mendapat guard yang sama karena boundary ada di Connect.

Trade-off:

- stale lock fail-closed membutuhkan recovery operator eksplisit;
- file store ditujukan untuk single-host/self-host deployment, bukan distributed multi-host ledger;
- reservation konservatif dapat mengurangi utilisasi headroom dibanding billing aktual, tetapi lebih aman daripada under-reservation.

Distributed/managed deployment nantinya harus mengganti storage implementation dengan transactional shared store tanpa mengubah contract admission di Connect.
