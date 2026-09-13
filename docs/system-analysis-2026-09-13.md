# Analisis Sistem — 2026-09-13

Ditulis oleh Claude (Anthropic) atas permintaan Amanda, sebagai lanjutan dari `final-audit-2026-09-09.md`
dan audit repo yang dilakukan di awal sesi ini (2026-09-13). Disusun dari kombinasi: dokumen internal
repo (`docs/final-audit-2026-09-09.md`, `docs/current-state-and-next-steps.md`,
`docs/ux-runtime-walkthrough-checklist.md`), pemeriksaan langsung `package.json`/config, dan pekerjaan
tangan-langsung memperbaiki UI `apps/ai` (sidebar, dark mode, composer) selama sesi ini.

## Yang sudah kuat

Disiplin dokumentasi dan testing di atas rata-rata proyek solo — 33 ADR, 112 file test, dan tiap
checkpoint punya "claim boundary" eksplisit (tidak menyatakan selesai sebelum benar-benar terbukti).
Audit internal repo sendiri (`docs/final-audit-2026-09-09.md`) sudah jujur menyimpulkan: **GO untuk
dev/alpha lokal, NO-GO untuk diklaim production-ready**. Itu tanda proses berpikir yang sehat, bukan
self-hype.

## Temuan — apa yang salah / berisiko

### 1. Kompleksitas jauh di atas validasi pemakaian nyata

11 modul + Temporal + Docker + observability + backup harness, untuk tool yang dipakai satu orang.
Tidak ada bukti eksplisit di dokumen manapun bahwa sistem ini sudah dipakai sehari-hari untuk kerjaan
nyata. Sebelum menambah lapisan baru, pertanyaan yang belum terjawab: apakah kompleksitas ini sepadan
dengan value yang sudah terbukti?

### 2. `pnpm dev` hanya menjalankan 5 dari 11 servis

Script `dev` di root `package.json` hanya start `rnd, context, connect, hub, ai`. Space, Flow, Artifact,
Sandbox baru jalan lewat `pnpm dev:phase3`/`dev:phase4`. Ini menjelaskan langsung 502 yang muncul di
screenshot walkthrough sesi ini pada Space/Flow ("tidak bisa dihubungi") dan status "Degraded" di
Operations — bukan bug, servisnya memang belum dinyalakan. Tapi ini tetap gap UX nyata: aplikasi tidak
memberi sinyal "kamu sedang menjalankan stack partial", hanya menampilkan 502 mentah yang terlihat
seperti kerusakan.

### 3. Klaim inti produk (penghematan biaya AI) belum pernah diuji terhadap biaya nyata

Kill switch hosted-calls konsisten OFF sepanjang development. Evidence "hemat token 77.86%"
(`docs/comparative-ecx-evidence.md`) berasal dari local model (`gemma4:latest` via endpoint kompatibel
Ollama), bukan dari panggilan hosted (Claude/GPT/OpenRouter) yang membebankan biaya nyata. Fitur utama
produk ini — cost optimizer — belum divalidasi terhadap kondisi yang justru ingin dioptimasi.

### 4. Model lokal masih memakai alias mutable (`gemma4:latest`)

Alias `:latest` bisa berubah isinya kapan saja tanpa disadari — buruk untuk reproducibility
eval/benchmark. Sudah diflag di audit internal sendiri dan sudah ada rencana perbaikan
(`docs/immutable-local-model-identity-plan.md`), tapi belum dieksekusi.

### 5. Backup/restore punya lubang yang diketahui: state Sync & Connect tidak ikut ter-restore

Didokumentasikan secara jujur (bukan disembunyikan) di evidence backup/restore, tapi tetap berarti
sebagian state akan hilang jika suatu saat diperlukan restore dari backup.

### 6. Checklist walkthrough UX resmi belum pernah dijalankan sesuai prosedurnya

`docs/ux-runtime-walkthrough-checklist.md` mensyaratkan: commit tersinkron dengan `origin/main`,
`ECORIONE_COST_KILL_SWITCH=1` di-set eksplisit, Temporal harus reachable, dan harus menjalankan
`pnpm dev:phase4` (stack penuh) — baru menjalankan 12 langkah UX terdokumentasi plus defect ledger.
Sesi perbaikan UI kali ini menyentuh beberapa area yang tumpang tindih dengan checklist tersebut
(navigasi, tampilan mobile, dsb.), tapi belum dijalankan sesuai prosedur resminya (masih di `pnpm dev`
biasa, bukan `dev:phase4` dengan precondition lengkap). Ini gerbang yang menurut dokumen sendiri harus
dilewati sebelum lanjut ke immutable model identity → deployment.

### 7. Ditemukan langsung: satu file test tidak pernah dijalankan

`apps/ai/app/page.hydration.test.tsx` ada dan isinya valid, tapi `include` glob di config vitest hanya
menangkap `*.test.ts`, bukan `*.test.tsx` — sehingga selama ini tidak pernah dieksekusi oleh `pnpm test`.
Dampaknya kecil, tapi berarti angka "112 file test" punya satu yang silent-skip dari CI/local run.

### 8. Fitur attach di composer Ai (hasil kerja sesi ini) masih UI-only

Tombol "+" untuk unggah file/foto/tambah folder/catatan manual di halaman Ai belum terhubung ke backend
upload — belum ada endpoint untuk itu. Saat ini lampiran hanya ditempel sebagai teks polos ke pesan yang
dikirim, bukan benar-benar diproses sebagai file. Perlu ditandai eksplisit di sini supaya tidak
terlupakan sebagai "fitur setengah jadi" di kemudian hari.

### 9. Production blocker yang sudah dicatat sendiri oleh repo

Kalau suatu saat sistem ini dipakai di luar laptop pribadi: credential vault belum production-grade,
spend budget belum durable-terhadap-restart, belum ada acceptance test MCP eksternal nyata, belum ada
full-history secret scan, dan eval suite produk (30–40 kasus tugas nyata) belum ada — 333 unit/integration
test diakui sendiri oleh `docs/final-audit-2026-09-09.md` bukan pengganti eval suite tersebut.

## Rekomendasi urutan prioritas

1. Jalankan validasi UX walkthrough resmi (temuan #6) — gerbang yang paling dekat dan sudah terdefinisi
   jelas prosedurnya.
2. Pin model lokal ke identitas immutable (temuan #4) — kecil dan murah untuk dibereskan.
3. Jalankan minimal satu hosted call nyata untuk memvalidasi klaim cost-saving (temuan #3) — paling
   menentukan apakah value inti produk benar-benar terbukti.
4. Baru pertimbangkan production blockers (temuan #9) kalau memang berniat mengeluarkan sistem ini dari
   laptop pribadi.
