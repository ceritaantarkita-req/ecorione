# ADR-11 — RPA diturunkan ke P2 dengan kontrol khusus

**Status:** Diterima · 2026-09-07 · Sumber: `research.md` §6.3, §7.5

## Konteks

Ini kesimpulan paling tidak nyaman dari seluruh riset: **tingkat sandbox nyaris tidak
penting, karena otomasi desktop/browser berjalan di luar sandbox menurut definisinya.**

Agent yang bisa menggerakkan mouse dan mengetik di desktop asli bisa membuka email
pengguna, mengotorisasi transaksi di tab browser yang sudah login, dan mengekstrak apa pun
di layar — **tanpa satu pun batas container terlibat**. Mem-sandbox interpreter Python
sambil memberi agent yang sama `computer_use` tanpa batas adalah teater keamanan.

Keandalannya juga tidak mendukung: paper *An Illusion of Progress?* (Online-Mind2Web, 300
tugas / 136 situs live) menemukan skor WebVoyager ~90% **sangat overestimate** — agent
search-only trivial dapat 51% di WebVoyager tapi hanya **22%** di Online-Mind2Web. Di situs
nyata: Operator 61.3%, Claude Computer Use 56.3%, sisanya (termasuk browser-use) **~28–30%**.

Tambahan: Cloudflare dan sejenisnya kini memblokir bot AI secara default, dan otomasi
terhadap situs yang ToS-nya melarang adalah eksposur kontraktual.

## Keputusan

AutoClick turun dari P1 ke **P2** dan menjadi escape hatch, bukan jalur utama. **Selalu
pakai API kalau API-nya ada.**

Kontrol wajib:

- **Profil browser terpisah**, tidak pernah profil utama pengguna yang sudah login. Satu
  keputusan ini menyumbang lebih banyak keamanan daripada teknologi isolasi mana pun.
- **Allowlist aplikasi** — boleh Chrome dan Excel; tidak boleh password manager, aplikasi
  bank, terminal.
- **Konfirmasi sebelum commit** untuk aksi tak-terbalikkan: kirim, bayar, hapus, posting,
  beri izin. Tampilkan screenshot + klik yang dimaksud.
- **Semua konten layar adalah input tak-tepercaya** — teks halaman, OCR, isi dokumen =
  data, tidak pernah instruksi.
- **Dead-man's switch**: hotkey abort global, budget langkah keras, indikator "agent sedang
  menyetir" yang terlihat.
- Rekam screenshot + log aksi tiap langkah.

## Konsekuensi

Otomasi browser di web nyata berplafon **L2 paling banter** — tidak pernah di jalur tanpa
pengawasan.
