# ADR-03 — Tidak ada semantic caching di v1

**Status:** Diterima · 2026-09-07 · Sumber: `research.md` §2.5

## Konteks

Angka "95%" yang beredar adalah **akurasi pencocokan, bukan hit rate**. Hit rate nyata
yang dipublikasikan: FAQ 40–60%, klasifikasi 50–70%, RAG 15–25%, dan **chat terbuka —
yaitu kasus ecorione — 10–20%**.

Mode gagalnya bukan "cache miss", melainkan **mengembalikan jawaban yang salah dengan
percaya diri**: query identik yang bergantung konteks mengembalikan jawaban milik konteks
lain, respons kedaluwarsa untuk hal sensitif waktu, drift model embedding membatalkan
seluruh cache secara diam-diam, dan cache poisoning memperkuat satu halusinasi ke semua
query serupa.

GPTCache — implementasi rujukannya — rilis terakhir Agustus 2024.

## Keputusan

Semantic caching tidak dibangun. Diganti **exact-match cache** (hash request ternormalisasi)
di dalam Connect: menangkap trafik retry/regenerate/duplikat dengan **risiko kebenaran nol**.

Modul `Cache` yang direncanakan sebelumnya **dilebur ke Connect** — implementasi amannya
sekitar 50 baris, tidak layak jadi modul.

## Konsekuensi

- Kalau nanti dipertimbangkan lagi: di balik flag, hanya untuk subset berbentuk FAQ,
  threshold ≥0.92, tidak pernah untuk hal spesifik-pengguna atau sensitif waktu.
- Butuh ADR baru yang membatalkan alasan di atas, bukan sekadar keputusan implementasi.
