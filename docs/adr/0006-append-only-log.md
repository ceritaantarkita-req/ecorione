# ADR-06 — Log append-only sebagai ground truth; tier lain adalah proyeksi

**Status:** Diterima · 2026-09-07 · Sumber: `research.md` §3.2, deepseek-harness

## Konteks

Prinsip yang dipakai deepseek-harness: *"the session log is the source of the context the
model sees."* Log append-only yang otoritatif memberi resume, fork, search, dan replay.

Masalah nyata yang dipecahkannya di sini: konsolidasi memori adalah pekerjaan LLM, dan
LLM kadang mengekstrak fakta yang salah. Tanpa sumber yang bisa diturunkan ulang, satu
kesalahan ekstraksi jadi permanen.

## Keputusan

**L0 (log episodik) adalah ground truth dan tidak pernah diedit.** L1 (fakta), L2 (memori
inti), dan L3 (artifact) adalah **proyeksi turunan yang bisa dibangun ulang** dari L0.

Ditegakkan di database, bukan lewat konvensi: trigger SQLite menolak UPDATE dan DELETE
pada `episodes`. Penghapusan baris `facts` juga ditolak, kecuali di dalam
`rebuildDerivedTiers()` yang membuang **seluruh** tier untuk diturunkan ulang — sengaja
bernama panjang supaya "hapus satu fakta yang mengganggu" tidak bisa menyelinap lewat sana.

Kontradiksi menghasilkan **invalidasi, bukan penghapusan**: `t_invalid` + `superseded_by`
terisi, fakta lama tetap ada. Retrieval selalu memfilter `t_invalid IS NULL` secara default.

## Konsekuensi

- Jawaban lama masih bisa dijelaskan sesudah faktanya berubah — provenance tetap utuh.
- Ketika dua fakta hidup bertentangan dan tidak ada yang dominan, **keduanya ditampilkan
  dengan timestamp**. Memilih diam-diam adalah cara menghasilkan jawaban salah yang
  terdengar yakin.
- Peluruhan recency adalah **sinyal ranking, bukan penghapusan**. Melupakan belum
  terpecahkan siapa pun; menghapus lebih berbahaya daripada menurunkan peringkat.
