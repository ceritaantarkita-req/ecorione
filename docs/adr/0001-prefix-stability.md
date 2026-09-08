# ADR-01 — Prefix stabil sebagai requirement kelas satu

**Status:** Diterima · 2026-09-07 · Sumber: `research.md` §2.1

## Konteks

Prompt caching adalah lever optimizer terkuat: hemat 60–85% biaya input. Angkanya bukan
klaim performa, melainkan aritmetika dari tabel harga resmi provider. Anthropic: tulis
cache 1.25×, baca 0.1× → titik impas di **0.28 kali baca**, artinya satu hit saja sudah
membayar penulisannya. Dipakai ulang 10×: hemat 80%. 20×: 84%. Asimtot 90%.

Cache dicocokkan lewat **hash prefix**. Kalau satu byte prefix berubah antar panggilan,
cache tidak pernah kena — **dan tidak ada error, peringatan, atau sinyal apa pun**.
Sistem tetap berjalan, cuma 10× lebih mahal. Ini mode kegagalan paling berbahaya yang ada
di sistem ini justru karena ia sepenuhnya senyap.

Hierarki invalidasi Anthropic: `tools` → `system` → `messages`. Mengubah definisi tool
membatalkan semuanya di bawahnya.

## Keputusan

Prefix stabil (system prompt + definisi tool + blok memori inti L2) **dijamin
byte-identik** antar panggilan. Semua yang dinamis wajib berada di belakang cache
breakpoint.

Ditegakkan di tiga lapis, bukan lewat disiplin:

1. **Tipe** — `ContextPack` memisahkan `stable` dan `dynamic` secara struktural, jadi
   menaruh konten dinamis di paruh stabil tidak bisa dikompilasi.
2. **ESLint** — `Date.now()` diblokir di jalur perakitan. Clock disuntik lewat parameter.
3. **Test** — `assertPrefixStable` membandingkan digest dan melaporkan bagian mana yang
   bergeser; `findVolatilePatterns` menangkap timestamp, UUID, dan epoch di dalam prefix.

## Konsekuensi

- Kompresi prompt (LLMLingua-2) **tidak boleh** dipakai pada prefix: outputnya
  non-deterministik dan menghancurkan caching. Keduanya saling meniadakan, dan caching
  jauh lebih menguntungkan. Kompresi hanya untuk ekor dinamis.
- Definisi tool tidak boleh berubah di tengah sesi.
- Memori inti dibatasi ~1.500 token: ia dibayar di setiap panggilan.
