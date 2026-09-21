# ecorione — Design Document (Visual & UI/UX)

Status: **APPROVED v1.2 / IMPLEMENTED AT PCS-04 BOUNDARY** — reconciled 2026-09-21. v1.2 mempertahankan identitas visual inti (dark premium, gold restrained, Fraunces/Manrope/IBM Plex Mono) dan menambahkan arahan product-UI pasca real-browser review: hierarki lebih kuat, keterbacaan lebih tinggi, Simple/Advanced separation, state yang eksplisit, dan konsistensi lintas Ai/Projects/Work/Brain/Space/Flow/Operations/Settings. PCS-04 closed the corresponding visual/IA implementation on PR #197; PCS-06 later passed integrated rendered-browser acceptance.

Riwayat: DRAFT v0.1 (hangat, terracotta/sage — ditolak, kurang premium/netral) → DRAFT v0.2 (gelap mewah, gold+graphite — arah disetujui tapi struktur halaman masih generik/"AI slop") → DRAFT v0.3 (nama modul tidak lagi bernama "InMyX", lihat `prd.md` §18; bentuk halaman diganti konsep dokumen perencanaan distrik) → DRAFT v0.4 (toggle pratinjau tema disederhanakan jadi Terang/Gelap saja, opsi "Sistem" dihapus; neutral terang awal → broken white) → DRAFT v0.5 (dasar mode terang `--bg` diputihkan penuh jadi `#FFFFFF`, sebelumnya broken-white `#FAF9F6` masih dirasa kurang putih) → **APPROVED v1.0** (disetujui, siap jadi basis Fase 0).
Pasangan dokumen: `prd.md` (produk + arsitektur teknis), dokumen ini (identitas visual & UI/UX)

---

## 1. Konsep & Filosofi Brand

**"Rione"** = distrik/kawasan kota. ecorione adalah kawasan yang **direncanakan dengan cermat** — kebalikan dari ekosistem InMy lama yang tumbuh liar. Nuansanya: distrik privat yang eksklusif, gelap, tenang, detail sedikit tapi berkualitas tinggi.

Konsep ini sekarang juga membentuk penamaan: dalam sebuah kawasan yang terencana, bangunan-bangunan tidak masing-masing punya nama merek sendiri (bukan "Toko A", "Toko B" dengan brand berbeda) — mereka disebut dengan fungsinya, karena semua orang tahu mereka bagian dari kawasan yang sama. Karena itu modul-modul ecorione dipanggil **Ai, Hub, Connect, Context, Sync, Space, Flow, Artifact, Sandbox, RnD, Cache, IR, AutoClick** — bukan "InMyAI", "InMyHub", dst.

### Kenapa revisi visual ini perlu

Draf v0.2 (dark + gold + serif + grid kartu) sudah lebih baik dari draf hangat pertama, tapi bentuk halamannya masih generik: section berurut dengan nomor "01/02/03", eyebrow kecil di atas judul, grid swatch, frame browser titik-tiga untuk mockup. Itu **pola template**, bukan sesuatu yang datang dari subjeknya. Revisi ini mengganti bentuknya dengan sesuatu yang hanya masuk akal untuk ecorione: **dokumen perencanaan distrik** — title block ala gambar arsitek, tabel spesifikasi material/huruf, dan yang paling penting: **denah kawasan** — gambar skematik yang benar-benar menempatkan 13 modul sebagai kavling di sepanjang satu jalan utama (Hub), dengan jarak dari pusat jalan mencerminkan prioritas build (P0 di dekat pusat kawasan, P2 di pinggir).

### Prinsip Desain Visual

1. **Gelap sebagai identitas utama.** Dark bukan cuma mode opsional — ini nuansa dasar produk.
2. **Netral dulu, warna belakangan.** Gold hanya muncul di titik yang benar-benar penting.
3. **Bentuk mengikuti konsep, bukan template.** Struktur halaman/dokumen harus punya alasan yang datang dari subjek (rione, denah, spesifikasi bangunan) — bukan pola "hero → fitur → CTA" generik.
4. **Presisi, bukan dekorasi.** Hairline, spacing terhitung, tipografi kontras tegas.

---

## 2. Palet Warna

(Tidak berubah dari v0.2 — ini bagian yang sudah disetujui.)

### Dark (identitas utama)

| Token | Hex | Peran |
|---|---|---|
| `--bg` | `#0B0B0C` | Dasar |
| `--surface` | `#151517` | Card/panel |
| `--surface-2` | `#1C1C1F` | Elemen di atas card |
| `--border` | `#2A2A2D` | Garis pembatas |
| `--text` | `#EDEAE2` | Teks utama |
| `--text-muted` | `#8B8880` | Teks sekunder |
| `--accent` (gold) | `#C9A961` | Satu-satunya warna "berbicara" |
| `--accent-strong` | `#DBBE7E` | Hover/active |
| `--success` | `#5E8770` | Status aktif |
| `--warning` | `#B9793E` | Status perlu perhatian |
| `--danger` | `#A6564A` | Status error |

### Light ("quiet luxury", putih penuh — revisi v0.5)

Revisi berjenjang: abu-abu awal (`#EAE7DF` dst) terlalu khaki/kotor → diganti "broken white" (`#FAF9F6`) → masih dirasa kurang putih terang, jadi dasar (`--bg`) sekarang **putih penuh**, sama seperti `--surface`. Kartu/panel dibedakan dari latar murni lewat hairline border (`--border`), bukan lagi lewat beda rona latar — konsisten dengan prinsip "hairline, bukan shadow" yang sudah dipakai di komponen lain.

| Token | Hex |
|---|---|
| `--bg` | `#FFFFFF` |
| `--surface` | `#FFFFFF` |
| `--surface-2` | `#F6F5F0` |
| `--surface-3` | `#EFEDE5` |
| `--border` | `#E4E0D4` |
| `--text` | `#1C1B17` |
| `--text-muted` | `#7C786D` |
| `--accent` | `#9C7A3B` |

Gold tidak pernah dipakai sebagai warna latar besar — hanya garis, teks, ikon, dan elemen aksi kecil.

---

## 3. Tipografi

Tidak berubah dari v0.2: **Fraunces** (display) + **Manrope** (body) + **IBM Plex Mono** (kode/data teknis).

Tambahan dari revisi ini: karena bentuk dokumen sekarang meniru gambar teknis/arsitektur, mono dipakai lebih sering dari sebelumnya — untuk label field title block, kode plat, dan penomoran, konsisten dengan konvensi gambar kerja arsitek/insinyur (bukan cuma untuk kode).

---

## 4. Denah Kawasan — elemen sentral yang baru

Bagian paling penting dari revisi ini: sebuah **diagram denah** (site plan) yang menempatkan modul-modul sebagai kavling di sepanjang satu jalur horizontal berlabel "Hub — poros utama". Aturan penempatannya bukan estetika semata:

- **Urutan kiri→kanan mengikuti prioritas build** dari `prd.md` §6: P0 di sisi kiri/pusat kawasan → P1 di tengah → P2 di pinggir.
- **Posisi atas/bawah jalur** murni untuk ritme visual (tidak membawa makna).
- Setiap kavling terhubung ke jalur utama lewat garis pendek — visualisasi literal dari prinsip arsitektur "semua modul terhubung lewat Hub, tidak ada akses langsung antar modul".

Ini menggantikan grid kartu warna-warni generik dari draf sebelumnya dengan sesuatu yang benar-benar spesifik untuk ecorione — tidak bisa dipakai ulang begitu saja untuk produk lain.

### Revisi C — denah mengikuti riset teknis

Setelah `research.md` selesai dan `prd.md` naik ke v2.0, denah diperbarui supaya tidak berbohong soal isi kawasan:

- **13 kavling → 11.** Cache dilebur ke Connect, IR dilebur ke Context + Artifact. Keduanya ditandai di bawah denah sebagai garis putus-putus dengan label "DILEBUR — REVISI C", bukan dihapus diam-diam. Dalam bahasa dokumen perencanaan, kavling yang digabung ke tetangganya tetap tercatat di lembar revisi — itu justru bagian dari kejujuran gambar kerja.
- **RnD naik ke P1** (jadi garis tegas, bukan putus-putus) karena ia sekarang memegang trace store & eval harness.
- **AutoClick turun ke P2** dan jadi satu-satunya kavling bergaris putus-putus — labelnya berubah dari "EVALUASI" jadi **"CADANGAN"**, karena statusnya bukan "belum dievaluasi" melainkan "sengaja tidak dibangun kecuali API tidak mencukupi".
- Susunan kiri→kanan dirapatkan jadi 10 kavling berselang-seling (Hub tetap jadi jalurnya, bukan kavling), dengan jarak antar kavling seragam 168px pada viewBox 900×460.

Arti visual yang tetap dipegang: **garis tegas emas = P0**, garis tegas netral = P1, **garis putus-putus = tidak dibangun sekarang**.

---

## 5. Logo & Brand Mark

Tidak berubah dari v0.2: konsep **"Segel Kawasan"** — bentuk geometris tipis (garis, bukan blok solid), digambar dengan garis emas tipis di atas latar gelap.

---

## 6. Spacing, Radius, Elevation

Tidak berubah dari v0.2 (grid 4px, radius 6-14px, shadow minim, hairline sebagai pemisah utama) — lihat mockup untuk eksekusi konkret.

---

## 7. Komponen & Pola Layout

Komponen dasar (tombol, status, input) tidak berubah dari v0.2. Yang berubah: cara menampilkannya di dokumen ini — bukan lagi "grid kartu komponen" generik, tapi sebagai **"perlengkapan"** (fittings) dalam format tabel spesifikasi, konsisten dengan bahasa dokumen perencanaan distrik.

Mockup layar (Hub, Ai) ditampilkan sebagai **plat** (plate) bernomor dengan keterangan di bawahnya — seperti lembar gambar kerja — bukan sebagai screenshot di dalam frame browser palsu.

---

## 8. Aksesibilitas

Tidak berubah dari v0.2: kontras AA, status selalu disertai label teks, focus state jelas.

---

## 9. Dark & Light Mode

Dark tetap identitas utama, light didukung penuh sebagai varian "quiet luxury" — sekarang dengan neutral "broken white" (§2). Untuk pratinjau/demo, kontrol tema cukup 2 opsi (Terang/Gelap); opsi "ikuti sistem" tidak perlu ditampilkan sebagai pilihan eksplisit karena hasilnya selalu identik dengan salah satu dari dua opsi itu, tergantung OS pengguna — cukup membingungkan tanpa menambah nilai.

---

## 10. Next Steps

- ~~Mockup revisi (konsep dokumen perencanaan distrik + denah kawasan) sudah dipublikasikan — menunggu review.~~ Disetujui 2026-09-07.
- Finalisasi file logo (SVG) berdasarkan konsep "Segel Kawasan".
- Terapkan penamaan baru (Ai, Hub, Connect, dst) secara konsisten begitu masuk fase implementasi kode (nama folder, package, dan string UI).
- Uji kontras aksesibilitas gold-on-dark untuk teks kecil sebelum dipakai di komponen produksi.
- Turunkan token warna (§2) jadi `packages/shared-ui` (CSS custom properties) begitu Fase 0 dimulai — lihat `prd.md` §10, §22.

---

## 11. Post-Closure Product UI Addendum — 2026-09-20

Real browser use after PE-08 showed that the approved visual identity is still valid, but the implemented product surfaces need a stronger product hierarchy. The next UI work follows the post-closure roadmap and uses these rules:

1. **Simple in front, governed underneath.** Normal users see provider connection, model choice, chat/history, project/work context, and clear status. Vault, SHA-256 identity, raw base URLs, spend controls, MCP JSON, and other operator internals move behind Advanced surfaces.
2. **Readability before decoration.** Dark remains the primary identity, but contrast between background, panels, controls, disabled states, warnings, and secondary text must be visibly stronger. Native controls must not become unreadable on Windows/Chrome.
3. **Hierarchy before whitespace.** Large empty areas are only acceptable when intentional. Primary task content should have a bounded readable width, stable alignment, and clear section rhythm.
4. **Primary vs advanced navigation.** Ai, Projects, Work, and Brain are primary product surfaces. Flow, Operations, and Settings may expose advanced/operator depth without making the whole product feel like a developer console.
5. **State must be explicit.** Examples: `OpenRouter · Connected`, `Local AI · Not connected`, `Hosted · OpenRouter · Claude Sonnet 4.5`, `Flow run · Failed — authority denied`. Do not make users infer state from disabled controls or raw HTTP errors.
6. **Provider/model controls are product controls.** The chat selector should show the active route/provider/model clearly. OpenRouter should expose verified model choices when supported; governed/recommended routing remains available for pinned/evidence-sensitive use.
7. **Session continuity is part of UX.** Leaving Ai and returning must not visually reset the conversation. Active chat/history/new-chat affordances are required.
8. **Consistent component scale.** Buttons, inputs, selects, tabs, cards, tables, empty states, and inspector panels use consistent height, type size, spacing, focus, hover, disabled, success, warning, and error treatment.
9. **Technical language is progressive disclosure.** User-facing copy should prefer task language; operator/internal terms remain available where they add real control.
10. **No backend ownership shortcut.** UI simplification must not bypass Hub authority, Connect Vault/provider ownership, Context ownership, Temporal durability, or other accepted architecture.

### Immediate visual targets

- fix dark-mode dropdown/option readability;
- increase small-text readability in Settings, Work, Flow, and Operations;
- reduce near-black-on-black ambiguity between page, panel, and input surfaces;
- make primary actions and status indicators easier to scan;
- simplify Settings into Basic and Advanced sections;
- make Ai composer/provider/model state understandable without knowing `local` vs `hosted` internals;
- keep the current restrained premium identity rather than replacing it with a colorful dashboard aesthetic.

This addendum was the visual baseline for PCS-04 and related PCS-01..PCS-03 product surfaces. That implementation is now CLOSED / PASS at the documented PCS boundaries, with integrated rendered-browser regression closed under PCS-06. Any new visual redesign requires a new explicit scope rather than reopening this addendum.