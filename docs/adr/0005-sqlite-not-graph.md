# ADR-05 — SQLite + sqlite-vec + FTS5, bukan graph database

**Status:** Diterima · 2026-09-07 · Sumber: `research.md` §3.2.3, §3.3

## Konteks

Graphiti/Zep menawarkan model memori berbasis temporal knowledge graph yang idenya sangat
bagus. Tapi ia menuntut graph DB (Neo4j/FalkorDB) sebagai dependensi, konstruksi graph oleh
LLM di setiap ingest, dan community summarization.

Bukti yang menentukan: **paper mem0 sendiri menemukan varian graph hanya menambah ~2 poin.**

## Keputusan

Satu file SQLite: `sqlite-vec` untuk vektor, FTS5 untuk leksikal, difusikan dengan RRF.

Yang **diambil** dari pendekatan graph: validitas bi-temporal, invalidate-jangan-hapus,
entity resolution, hybrid search tiga sinyal. Yang **ditolak**: mesin graph-nya.

Fakta dimodelkan sebagai baris dengan foreign key entitas — graph relasional yang bisa
ditelusuri 1–2 hop lewat self-join SQL, tanpa graph engine.

`sqlite-vec` opsional: ada fallback brute-force di JS. Pada skala personal (10⁴–10⁵ fakta)
brute force memang cukup, dan test berjalan di jalur itu supaya tidak bergantung pada
ekstensi yang terpasang.

## Konsekuensi

- Nol service, backup satu file, sinkronisasi sepele — semuanya prasyarat local-first.
- Transaksi atomik mencakup metadata **dan** vektor sekaligus; vector DB terpisah tidak
  bisa memberi itu.
- Ditinjau ulang hanya kalau muncul pertanyaan multi-hop yang terbukti gagal ditangani
  hybrid search — **dan kegagalan itu harus diukur dulu sebelum apa pun dibangun.**
