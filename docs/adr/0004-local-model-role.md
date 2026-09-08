# ADR-04 — Model lokal adalah classifier, bukan agent

**Status:** Diterima · 2026-09-07 · Sumber: `research.md` §5

## Konteks

Target hardware adalah laptop Windows 8–16GB RAM. Realitasnya lebih keras dari yang diakui
kebanyakan panduan: OS, runtime, dan KV cache keluar dari kolam RAM yang sama, jadi budget
16GB unified ≈ model 7–9B di Q4_K_M–Q6_K; 8GB ≈ 3–4B.

Dua temuan yang lebih bisa dipercaya daripada nama model spesifik mana pun:

1. **Q4_K_M adalah lantai produksi untuk tool calling.** Q3/Q2 merusak keandalan tool-call
   **sebelum** merusak kualitas chat — kegagalannya tidak terlihat di pengujian santai.
2. **Model di bawah ~7B tanpa pelatihan tool-call khusus gagal sistematis** pada struktur
   JSON multi-tool. Angka ~95% well-formed berasal dari kelas 27B yang butuh ~16GB VRAM.

## Keputusan

Model lokal mengerjakan: gerbang salience, ekstraksi fakta, konsolidasi memori, klasifikasi
tugas untuk routing, reranking hasil retrieval, redaksi data sensitif sebelum keluar mesin.

Agent loop, tool calling, dan reasoning multi-langkah tetap di model hosted.

## Konsekuensi

- Ini bukan kelemahan yang disembunyikan — ini yang membuat klaim ecorione bisa
  dipertahankan, dan memberi model lokal pekerjaan yang memang ia kuasai.
- Konsolidasi berjalan di luar jalur panas dan dibatch, jadi kelambatan model lokal tidak
  pernah terasa oleh pengguna.
- vLLM di luar cakupan: butuh CUDA + ~16GB VRAM, dan keunggulan throughput-nya hilang pada
  satu pengguna.
