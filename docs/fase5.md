# Fase 5 — AutoClick gate

**Status:** DEFERRED BY DESIGN · 2026-09-09

Fase 5 tidak dibangun pada baseline ini. Ini bukan pekerjaan yang tertunda karena implementasi belum sempat dilakukan; ini keputusan yang diwajibkan oleh `docs/blueprint.md` §8, `docs/prd.md` §23–§24, dan ADR-11.

## Gate produk

Baris kode pertama `services/autoclick/` hanya boleh dibuat setelah ada kebutuhan produk konkret yang:

1. benar-benar dibutuhkan pengguna;
2. tidak dapat diselesaikan lewat API/service boundary yang tersedia;
3. mempunyai langkah irreversible yang dapat dipetakan ke Hub approval;
4. dapat diuji dengan dead-man's switch dan application allowlist nyata.

Pada closure Fase 4, repository belum mendefinisikan use case non-API konkret tersebut dan tidak memiliki `services/autoclick/`. Membuat RPA generik sekarang akan melanggar prinsip vertical-slice/evidence-driven di PRD §24.10.

## Yang sengaja tidak dibuat

- runtime Python AutoClick;
- browser/desktop driver;
- profil browser otomatis;
- application allowlist baru;
- mekanisme approval baru;
- dead-man's switch palsu yang hanya diuji lewat unit test.

Hub approval yang sudah ada tetap menjadi satu-satunya approval gate bila AutoClick kelak dibangun.

## Kapan Fase 5 boleh dibuka lagi

Buat ADR/decision baru yang mencatat use case non-API nyata beserta bukti kenapa API tidak cukup. Implementasi kemudian wajib memenuhi seluruh kontrol ADR-11: profil browser terpisah, deny-by-default application allowlist, approval sebelum commit irreversible, screen content sebagai untrusted data, dead-man's switch global, step budget, screenshot/action trace ke RnD, dan plafon otonomi L2.
