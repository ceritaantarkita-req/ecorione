# ADR-14 — Pin versi model; canary harian untuk perubahan senyap

**Status:** Diterima · 2026-09-07 · Sumber: `research.md` §8.4

## Konteks

Provider menukar model di balik alias `-latest` tanpa pemberitahuan. Efeknya muncul sebagai
regresi kualitas berhari-hari setelah perubahan, dan penyebabnya nyaris mustahil
diidentifikasi kalau tidak ada baseline.

Ada sinyal yang muncul lebih awal daripada kegagalan: **jumlah token output rata-rata dan
latensi rata-rata bergeser sebagai step change** sebelum kualitas terlihat turun.

Embedding juga: vektor dari model berbeda tidak sebanding. Index yang mencampur dua model
menghasilkan tetangga yang tidak berarti apa-apa.

## Keputusan

Alias model dilarang di kode dan konfigurasi. `assertPinnedModel()` menolak apa pun yang
cocok `-latest`, dan CI punya gerbang grep terpisah untuk itu.

Untuk runtime lokal OpenAI-compatible, `localModelTag` adalah selector request, bukan bukti
identitas immutable. Durable evidence/cache identity harus membawa `localModelDigest` SHA-256.
Jika digest belum dikonfigurasi, local chat tetap boleh berjalan tetapi exact-match cache lokal
dibypass dan hasil harus dilabeli `modelIdentityPinned=false`. Mengganti runtime, base URL, atau
model selector membersihkan digest lama kecuali penggantinya dikirim eksplisit.

Digest diselesaikan lewat boundary provider lokal, bukan dipercaya dari deklarasi. Amandemen
2026-09-14 (audit S2-5): implementasi W13 awalnya hanya membaca `ECORIONE_LOCAL_MODEL_DIGEST`
dan menandai `modelIdentityPinned=true` tanpa pernah memeriksa model yang benar-benar dilayani
— itu klaim, bukan bukti, dan persis kelas masalah yang W13 dibuat untuk menutupnya. Sekarang:

| Keadaan | `provenance` | `pinned` |
|---|---|---|
| Runtime melaporkan digest, cocok dengan deklarasi operator | `verified` | ya |
| Runtime melaporkan digest, operator tidak mendeklarasikan | `resolved` | ya |
| Runtime melaporkan digest yang BERBEDA dari deklarasi | — | gagal tertutup, `409 LOCAL_MODEL_DIGEST_MISMATCH` |
| Runtime tidak punya provenance API, operator mendeklarasikan | `declared-unverified` | tidak |
| Tidak ada keduanya | `unverified` | tidak |

Runtime generik yang tidak memiliki provenance API tetap boleh dipakai, tetapi tidak boleh
diklaim melakukan attestation: statusnya dilaporkan apa adanya di `modelIdentityProvenance`
dan exact-match cache lokal tetap dibypass.

`localModelTag` yang berupa alias mutable (`:latest`, `@latest`, `latest`) ditolak pada jalur
mutasi runtime settings kecuali digest terpin ikut dinyatakan. File settings lama yang sudah
terlanjur menyimpan alias tetap bisa dibaca dan dilaporkan tidak-terpin, supaya upgrade tidak
membuat Connect gagal start.

Index vektor menyimpan identitas model embedding dan hanya menyentuh satu model.

**Canary set harian**: 5–8 kasus termurah dan paling deterministik, dijalankan terjadwal,
mencatat pass rate per-kasus, rata-rata token output, dan rata-rata latensi. **Alert pada
tren, bukan cuma pada kegagalan.**

## Konsekuensi

Menaikkan versi model adalah perubahan yang disengaja dengan diff yang terlihat, bukan
sesuatu yang terjadi pada hari Selasa.
