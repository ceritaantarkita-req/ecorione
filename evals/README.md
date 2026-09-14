# Eval harness

ECORIONE memisahkan dua lapisan eval supaya product regressions tidak tercampur dengan kualitas model.

## W14 — deterministic product eval

`product-regressions.json` adalah manifest bounded untuk kasus yang berasal dari **bug atau tugas nyata**. Setiap kasus wajib menunjuk:

- provenance repository (`origin.source` + `origin.ref`);
- deterministic regression test yang benar-benar ada (`target.file` + `target.testName`);
- expected product invariant yang dilindungi.

`product-regressions.test.ts` memvalidasi provenance, uniqueness, batas 50 kasus, dan memastikan target regression masih ada. Workflow `.github/workflows/product-eval.yml` kemudian menjalankan manifest validator bersama seluruh deterministic target yang direferensikan suite.

Current W14 seed berisi 12 kasus lintas Settings/MCP, owner-boundary security, local runtime/model identity, provider credential flow, Ai chat/memory, dan Operations degraded/optional-service behavior. Ini **bukan** pengukuran kualitas model dan tidak boleh dipakai sebagai claim agentic success.

Aturan penambahan kasus tetap sama: kalau sebuah kasus baru tidak bisa menunjuk bug/tugas nyata dan deterministic regression yang membuktikannya, kasus belum boleh masuk. Bila target file baru ditambahkan ke manifest, tambahkan file tersebut juga ke workflow Product Eval supaya regression-nya benar-benar dieksekusi.

## W15 — agent/model eval

Prompt/model evaluation tetap menggunakan [promptfoo](https://github.com/promptfoo/promptfoo) (MIT, dapat berjalan lokal) melalui `promptfooconfig.yaml`. W15 akan mengukur reason/tool/execute/observe/verify; W14 tidak menyamarkan deterministic product tests sebagai model quality evidence.

## Aturan yang mengikat

**Batas keras 50 kasus, selamanya.** Menambah satu berarti memensiunkan satu. Suite yang tumbuh tanpa batas berhenti dijalankan orang, dan suite yang tidak dijalankan tidak melindungi apa pun.

**Setiap kasus harus lahir dari bug atau tugas yang benar-benar pernah terjadi.** Tidak ada coverage spekulatif. Kalau tidak bisa menunjuk kejadian nyatanya, kasusnya belum layak masuk.

**Habiskan usaha pada tracing, bukan pada scoring.** Untuk sistem personal, **kamu sendiri adalah ground truth-nya** — trace viewer yang bagus menghemat sepuluh kali lebih banyak jam debugging daripada scorer canggih.

## Komposisi target model eval (30–40 kasus)

| Kategori | Jumlah | Catatan |
|---|---|---|
| Happy path | ~15 | Satu per kapabilitas utama |
| **Keamanan** | **~8** | Prompt injection di halaman yang diambil, instruksi di nama file, tugas yang menggoda aksi destruktif. **Semua meng-assert penolakan atau konfirmasi** — ini yang menangkap regresi paling menakutkan |
| Pemilihan tool | ~8 | Ada tool salah yang masuk akal sebagai jebakan |
| Permintaan ambigu | ~5 | Jawaban benarnya **bertanya balik**, bukan menebak |
| Memori / konteks | ~4 | Retrieval, scope, invalidasi |

## Cara menilai model eval, berurutan prioritas

1. **Assertion deterministik** di mana pun mungkin — state file, nama tool, exit code, regex. Murah, stabil, nol bias juri.
2. **LLM-as-judge hanya untuk ~20% yang benar-benar kabur**, dengan:
   - tukar posisi **AB+BA** (position bias spesifik-model, rentangnya 0.002–0.192 antar model — dua model dari keluarga yang sama pernah berbeda ~70×)
   - **keluarga model berbeda dari aktor** (self-preference)
   - 20 contoh berlabel manusia untuk memvalidasi ulang juri tiap kali model juri diganti
   - laporkan **κ (Cohen's kappa), bukan persetujuan mentah** — persetujuan mentah melebih-lebihkan κ sebesar 33.8–41.3 poin

Jangan over-engineer melawan verbosity bias: itu sudah teratasi di model modern (semua 21 model di studi terbaru di bawah 0.011).

## pass^k, bukan pass@k

Tiap kasus model dijalankan **k=3** dan dilaporkan sebagai **pass^3** — ketiganya harus lulus. Ini mengukur **keandalan**, bukan keberuntungan best-of-n. Variansi agent adalah risiko produk yang sebenarnya; pass@k menyembunyikannya.

## Canary harian

5–8 kasus termurah dan paling deterministik, terjadwal harian. Dicatat: pass rate per-kasus, **rata-rata jumlah token output**, dan **rata-rata latensi**.

Provider yang menukar model di balik alias muncul sebagai **step change pada token atau latensi berhari-hari sebelum** muncul sebagai kegagalan. **Alert pada tren, bukan cuma pada kegagalan** (ADR-14).

## Menjalankan W15 nanti

```bash
npx promptfoo@latest eval -c promptfooconfig.yaml
npx promptfoo@latest view
```

`promptfooconfig.yaml` sengaja belum diisi dengan provider/model case pada W14. Pengisian itu adalah W15 dan harus menggunakan task/trace nyata, bukan fixture spekulatif.
