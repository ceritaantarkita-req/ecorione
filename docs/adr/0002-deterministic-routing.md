# ADR-02 — Routing berbasis aturan deterministik, bukan prediksi kualitas

**Status:** Diterima · 2026-09-07 · Sumber: `research.md` §2.4

## Konteks

Klaim populer RouteLLM adalah "85% pengurangan biaya dengan 95% performa GPT-4". Angka
sebenarnya dari papernya, per benchmark:

| Benchmark | Reduksi vs random |
|---|---|
| MT-Bench (subjektif, chat) | 3.66× |
| MMLU | 1.41× |
| GSM8K | 1.49× |

85% adalah kasus terbaik pada benchmark paling menguntungkan metodenya. **Beban kerja
agent jauh lebih mirip GSM8K daripada MT-Bench.**

Lebih keras: benchmark netral RouterArena menempatkan sebuah router komersial terkemuka di
**peringkat 12**, justru karena terlalu sering memilih model mahal — router itu
*menaikkan* biaya dibanding kebijakan statis yang masuk akal. Routing juga menambah
~100–200ms per keputusan.

## Keputusan

Routing hanya memakai sinyal murah dan bisa diverifikasi: kelas sensitivitas data, status
budget, apakah tugas butuh tool calling, panjang konteks, kebutuhan latensi. **Tidak ada
prediktor kualitas yang dilatih.**

Gerbang sensitivitas dievaluasi **lebih dulu dan tidak pernah ditukar dengan biaya**.

Default gagal ke arah kualitas: menurunkan model butuh aturan yang menyala eksplisit,
tidak pernah jadi fallback diam-diam.

## Konsekuensi

- Penghematan dari routing realistis 0–40%, dan itu bukan klaim utama produk.
- "Data ini tidak boleh keluar dari mesin ini" adalah satu-satunya keputusan routing yang
  memberi nilai bukan-biaya — dan itu tidak bisa diberikan provider mana pun.
- Setiap keputusan mencatat aturan mana yang menyala, supaya bisa diaudit dan direplay.
