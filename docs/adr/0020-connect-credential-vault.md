# ADR-20 — Connect memiliki credential vault terenkripsi at-rest

**Status:** Diterima · 2026-09-09

## Konteks

PRD §5 dan §7 menetapkan bahwa raw provider credential hanya boleh dimiliki Connect dan harus terenkripsi at-rest. Baseline sebelumnya masih membaca `ANTHROPIC_API_KEY` langsung dari environment sehingga cocok untuk development lokal, tetapi belum memenuhi requirement storage produksi/self-host.

Menambah service secrets terpisah akan memperlebar trust boundary dan bertentangan dengan prinsip satu owner credential di Connect. Menaruh master key di file vault yang sama juga hanya memindahkan plaintext-equivalent secret, bukan memberi encryption at-rest yang berarti.

## Keputusan

Connect memiliki **file credential vault lokal** dengan invariant berikut:

1. file vault hanya berisi ciphertext + metadata non-secret;
2. encryption memakai **AES-256-GCM** dengan nonce acak 96-bit per write dan authentication tag 128-bit;
3. master key harus tepat 32 byte dan dipasok **out-of-band** melalui `ECORIONE_CONNECT_VAULT_MASTER_KEY`; master key tidak pernah ditulis ke file vault;
4. provider/purpose/generation menjadi authenticated additional data (AAD), sehingga ciphertext tidak dapat dipindahkan ke scope credential lain tanpa gagal autentikasi;
5. credential lookup scoped oleh `provider + purpose`; caller Connect meminta hanya credential yang diperlukan untuk adapter tersebut;
6. write credential mengganti satu scope dan menaikkan generation; Connect membaca file kembali per hosted call sehingga rotasi provider-secret dapat berlaku tanpa restart;
7. master-key rotation mendekripsi seluruh entry di memory, lalu menulis ulang seluruh vault dengan key baru sebagai satu atomic file replacement; Connect harus dihentikan/di-restart dengan master key baru saat prosedur ini dilakukan;
8. malformed file, wrong key, atau ciphertext tamper **fail closed**; tidak ada fallback ke plaintext env ketika vault aktif;
9. file ditulis dengan mode `0600` pada platform yang mendukung permission POSIX;
10. tidak ada HTTP endpoint untuk administrasi credential. Bootstrap/rotation dilakukan melalui CLI operator yang membaca secret dari stdin agar nilai tidak perlu menjadi argument command line.

`ANTHROPIC_API_KEY` tetap tersedia sebagai **development-only compatibility fallback** ketika vault tidak dikonfigurasi. Begitu `ECORIONE_CONNECT_VAULT_MASTER_KEY` aktif, fallback env tersebut diabaikan.

## Format dan lokasi

Default ciphertext file:

```text
./data/connect-credentials.vault.json
```

Path dapat diubah dengan `ECORIONE_CONNECT_VAULT_PATH`. Direktori `data/` sudah di-gitignore.

Provider scope v1 yang dikenali schema internal vault: `anthropic`, `openai`, `openrouter`. Purpose v1: `messages`. Menambah purpose baru harus dilakukan ketika adapter benar-benar memerlukannya; jangan memberi satu credential scope generik yang otomatis dipakai semua capability.

## Operasi

- generate master key: `pnpm --filter @ecorione/connect vault:keygen`
- list metadata tanpa secret: `pnpm --filter @ecorione/connect vault:list`
- set/rotate provider secret: pipe secret ke `vault:set <provider> <purpose>`
- rotate master key: hentikan Connect, pipe master key baru ke `vault:rotate-master`, update source master key out-of-band, lalu start Connect kembali

CLI tidak pernah mencetak provider secret. `vault:keygen` memang mencetak master key baru karena output itu harus disimpan operator di secret source di luar vault.

## Konsekuensi

- raw provider API key tidak lagi perlu berada di storage `.env` produksi;
- compromise file vault tanpa master key tidak langsung membuka credential;
- tampering terdeteksi oleh GCM authentication;
- rotasi provider secret tidak membutuhkan restart Connect;
- rotasi master key membutuhkan maintenance boundary singkat dan restart dengan key baru;
- ini bukan hardware-backed keystore dan tidak melindungi credential dari proses/OS yang sudah sepenuhnya dikompromikan;
- rate limiting dan durable cumulative spend budget tetap pekerjaan terpisah pada provider boundary.
