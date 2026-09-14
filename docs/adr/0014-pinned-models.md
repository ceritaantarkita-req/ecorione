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

Digest adalah provenance yang dideklarasikan operator; runtime generik yang tidak memiliki
provenance API tidak boleh diklaim melakukan cryptographic attestation otomatis terhadap bytes
model.

Index vektor menyimpan identitas model embedding dan hanya menyentuh satu model.

**Canary set harian**: 5–8 kasus termurah dan paling deterministik, dijalankan terjadwal,
mencatat pass rate per-kasus, rata-rata token output, dan rata-rata latensi. **Alert pada
tren, bukan cuma pada kegagalan.**

## Konsekuensi

Menaikkan versi model adalah perubahan yang disengaja dengan diff yang terlihat, bukan
sesuatu yang terjadi pada hari Selasa.
