# Berkontribusi ke ecorione

Proses di sini sengaja ringan. Ekosistem pendahulunya tenggelam dalam kontrak formal,
"closure verdict", dan ratusan script sekali-pakai — itu yang dihindari (`docs/prd.md` §24).

## Setup

```bash
pnpm install
pnpm verify
```

Butuh Node ≥22 dan pnpm 10. `pnpm verify` menjalankan format, lint, typecheck, test, dan
secret scan — hal yang sama dengan CI.

## Alur kerja

1. Branch pendek umur dari `main`: `feat/…`, `fix/…`, `docs/…`.
2. Kerjakan sebagai **vertical slice** — UI → API → data, tersambung end-to-end.
   Jangan membangun fondasi lengkap dulu lalu menyambungnya belakangan; itu pola yang
   membuat 5 modul di ekosistem lama selesai dites tapi tidak pernah terpakai.
3. `pnpm verify` hijau.
4. PR → review → merge → hapus branch.

## Definisi "selesai"

Sebuah modul **tidak boleh** dilabeli selesai kecuali bisa dipakai end-to-end oleh
pengguna. Label status yang menyesatkan adalah kegagalan spesifik yang proyek ini dibangun
untuk menghindarinya. "Test-nya lulus" bukan "selesai".

## Test

- Assertion deterministik dulu — state file, nama tool, exit code, regex.
- Test berdampingan dengan sumbernya (`src/foo.ts` → `src/foo.test.ts`).
- Tekankan integrasi/e2e, bukan cuma unit — konsisten dengan prinsip vertical slice.
- Setiap kasus di `evals/` harus lahir dari bug yang benar-benar pernah terjadi.
  **Tidak ada coverage spekulatif**, dan suite dibatasi keras 50 kasus selamanya:
  menambah satu berarti memensiunkan satu.

## Keputusan

Keputusan biasa: satu baris di `docs/DECISIONS.md`.
Keputusan yang mengubah invarian di `AGENTS.md`: ADR baru di `docs/adr/`.

Jangan membuat commit terpisah hanya untuk mencatat keputusan — itu membanjiri git history,
dan `DECISIONS.md` sudah menanganinya.

## Keamanan

- Jangan pernah commit `.env`, kunci, atau token. `pnpm secret-scan` jalan di pre-commit
  dan CI, tapi itu jaring pengaman terakhir, bukan izin untuk ceroboh.
- Perubahan pada deskripsi tool MCP diperlakukan sebagai **rilis yang relevan-keamanan**
  (mitigasi rug-pull) — sebutkan eksplisit di PR.
- Kalau menemukan celah keamanan, jangan buka issue publik.

## Yang tidak akan diterima

Menambahkan semantic caching, graph database, orkestrasi multi-agent, mesin durable
execution buatan sendiri, atau otonomi L4 — tanpa ADR yang membatalkan alasan penolakannya
di `docs/research.md`. Semua itu sudah diriset dan ditolak dengan angka.
