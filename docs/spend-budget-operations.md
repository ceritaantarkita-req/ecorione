# Connect durable spend budget — operator guide

ADR-21 adalah admission control hosted spend pada boundary Connect. Ini berbeda dari `ECORIONE_COST_KILL_SWITCH`, yang hanya emergency stop.

## Konfigurasi

```text
ECORIONE_SPEND_BUDGET_PATH=./data/connect-spend-budget.json
ECORIONE_SPEND_DAILY_USD=
ECORIONE_SPEND_MONTHLY_USD=
```

Minimal satu limit harus diisi untuk mengaktifkan budget. Nilai harus USD positif. Kosong berarti periode itu tidak dibatasi.

## Semantik

- hosted **cache miss**: reservation dibuat durable sebelum provider dispatch;
- hosted internal cache hit: tidak memakai budget provider;
- local route: tidak memakai hosted budget;
- provider success: reservation disettle ke actual provider cost;
- provider/network failure setelah dispatch: reservation tetap dihitung konservatif;
- daily/monthly rollover ditentukan dari timestamp UTC request;
- restart tidak menghapus state.

## Error

- `429 SPEND_BUDGET_EXCEEDED` — reservation baru akan melewati daily/monthly cap;
- `503 SPEND_BUDGET_UNAVAILABLE` — store corrupt, lock aktif, atau accounting boundary tidak tersedia;
- `503 COST_KILL_SWITCH_ACTIVE` — emergency hosted switch aktif.

Semua error budget terjadi sebelum provider dispatch, kecuali kegagalan settlement setelah provider sudah sukses. Pada kasus pasca-provider tersebut, response provider tetap dikembalikan dan reservation lama tetap dihitung supaya caller tidak melakukan retry provider secara otomatis.

## File dan recovery

Store memakai atomic replacement dan mode file `0600` pada platform POSIX. File `.lock` mencegah writer paralel memakai snapshot lama yang sama.

**Jangan menghapus lock secara otomatis.** Lock yang tertinggal dapat berarti process crash di tengah accounting boundary. Operator harus memastikan tidak ada process Connect aktif yang memakai store tersebut, membuat backup file budget, lalu melakukan recovery manual. Fail-closed lebih aman daripada membuka kemungkinan overspend.

File implementation ini hanya untuk deployment single-host/self-host. Deployment multi-host harus memakai transactional shared storage sebelum beberapa Connect writer diaktifkan.

## Audit

Entry menyimpan provider/model, operation ID, reserved USD, actual USD, status, created time dan settled time. Jangan menggunakan file ini sebagai invoice provider; actual charge resmi tetap berasal dari provider billing. Budget store adalah kontrol admission dan ledger operasional ecorione.
