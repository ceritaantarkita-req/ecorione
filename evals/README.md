# Eval harness

Suite regresi ecorione. Dijalankan dengan [promptfoo](https://github.com/promptfoo/promptfoo)
(MIT, jalan 100% lokal).

## Aturan yang mengikat

**Batas keras 50 kasus, selamanya.** Menambah satu berarti memensiunkan satu. Suite yang
tumbuh tanpa batas berhenti dijalankan orang, dan suite yang tidak dijalankan tidak
melindungi apa pun.

**Setiap kasus harus lahir dari bug yang benar-benar pernah terjadi.** Tidak ada coverage
spekulatif. Kalau tidak bisa menunjuk kejadian nyatanya, kasusnya belum layak masuk.

**Habiskan usaha pada tracing, bukan pada scoring.** Untuk sistem personal, **kamu sendiri
adalah ground truth-nya** — trace viewer yang bagus menghemat sepuluh kali lebih banyak jam
debugging daripada scorer canggih.

## Komposisi target (30–40 kasus)

| Kategori | Jumlah | Catatan |
|---|---|---|
| Happy path | ~15 | Satu per kapabilitas utama |
| **Keamanan** | **~8** | Prompt injection di halaman yang diambil, instruksi di nama file, tugas yang menggoda aksi destruktif. **Semua meng-assert penolakan atau konfirmasi** — ini yang menangkap regresi paling menakutkan |
| Pemilihan tool | ~8 | Ada tool salah yang masuk akal sebagai jebakan |
| Permintaan ambigu | ~5 | Jawaban benarnya **bertanya balik**, bukan menebak |
| Memori / konteks | ~4 | Retrieval, scope, invalidasi |

## Cara menilai, berurutan prioritas

1. **Assertion deterministik** di mana pun mungkin — state file, nama tool, exit code,
   regex. Murah, stabil, nol bias juri.
2. **LLM-as-judge hanya untuk ~20% yang benar-benar kabur**, dengan:
   - tukar posisi **AB+BA** (position bias spesifik-model, rentangnya 0.002–0.192 antar
     model — dua model dari keluarga yang sama pernah berbeda ~70×)
   - **keluarga model berbeda dari aktor** (self-preference)
   - 20 contoh berlabel manusia untuk memvalidasi ulang juri tiap kali model juri diganti
   - laporkan **κ (Cohen's kappa), bukan persetujuan mentah** — persetujuan mentah
     melebih-lebihkan κ sebesar 33.8–41.3 poin

Jangan over-engineer melawan verbosity bias: itu sudah teratasi di model modern (semua 21
model di studi terbaru di bawah 0.011).

## pass^k, bukan pass@k

Tiap kasus dijalankan **k=3** dan dilaporkan sebagai **pass^3** — ketiganya harus lulus.
Ini mengukur **keandalan**, bukan keberuntungan best-of-n. Variansi agent adalah risiko
produk yang sebenarnya; pass@k menyembunyikannya.

## Canary harian

5–8 kasus termurah dan paling deterministik, terjadwal harian. Dicatat: pass rate per-kasus,
**rata-rata jumlah token output**, dan **rata-rata latensi**.

Provider yang menukar model di balik alias muncul sebagai **step change pada token atau
latensi berhari-hari sebelum** muncul sebagai kegagalan. **Alert pada tren, bukan cuma pada
kegagalan** (ADR-14).

## Menjalankan

```bash
npx promptfoo@latest eval -c promptfooconfig.yaml
npx promptfoo@latest view      # lihat hasilnya
```

Belum ada kasus di sini — Fase 1 mengisinya dari 10 tugas nyata pertama yang dijalankan,
sesuai `docs/prd.md` §23.
