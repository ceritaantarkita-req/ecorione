# ADR-12 — Idempotency key wajib pada setiap efek samping

**Status:** Diterima · 2026-09-07 · Sumber: `research.md` §7.2, §7.3

## Konteks

Matematika compounding: pada keandalan per-langkah *p* selama *n* langkah, sukses = *pⁿ*.

| Keandalan/langkah | 5 langkah | 10 langkah | 20 langkah |
|---|---|---|---|
| 95% | 77% | 60% | **36%** |
| 99% | 95% | 90% | **82%** |

Proses bisnis nyata minimal 5–15 tool call. Retry karena itu bukan kasus tepi — ia jalur
normal. Dan retry naif terhadap efek samping non-idempoten adalah **beda antara "coba
lagi" dan "menagih dua kali"**.

## Keputusan

Setiap aksi yang punya efek samping membawa idempotency key, **dipaksakan di lapisan
tool — tidak pernah diminta lewat prompt**. Key dibangun deterministik dari identitas aksi
(modul + tool + argumen ternormalisasi), dengan serialisasi stabil sehingga urutan kunci
objek tidak mengubah hasilnya.

Aksi yang sudah pernah dieksekusi dengan key yang sama dicatat sebagai
`ACTION_SKIPPED_IDEMPOTENT`, bukan dieksekusi ulang.

## Konsekuensi

- Aksi yang tidak punya aksi pembatalan **permanen L2** — tidak pernah naik ke L3.
- Biaya retry dihitung dalam cost ledger. Router yang mengabaikannya melaporkan penghematan
  palsu (ADR-13).
