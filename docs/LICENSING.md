# Model lisensi: open core

ecorione open source di bawah [MIT](../LICENSE) — dan tetap begitu selamanya untuk semua
kode yang sudah dirilis. Dokumen ini menjelaskan batas antara yang **selalu open source**
dan yang jadi **kandidat komersial** nanti, supaya tidak ada kejutan "rug pull" di
kemudian hari — komitmen ini sendiri adalah bagian dari kepercayaan yang dijual proyek
open source.

## Prinsip

1. **Kode yang sudah dirilis MIT tidak pernah ditarik balik ke closed source.** Fork
   siapa pun tetap sah selamanya, sesuai izin lisensi MIT itu sendiri — dokumen ini cuma
   bisa menentukan lisensi kode yang *belum* ditulis.
2. **Mesin inti (self-hosted) selalu gratis dan open source.** Kalau bagian ini
   ditutup, proposisi "local-first, kamu pegang kendali penuh" di `README.md` jadi
   omong kosong.
3. **Yang berpotensi berbayar adalah yang butuh infrastruktur terkelola** — relay,
   hosting, dashboard tim — bukan fitur inti yang jalan di mesin sendiri.

## Selalu open source (MIT)

Modul yang sudah dibangun di Fase 1, dan akan seterusnya:

| Modul | Kenapa selalu open |
|---|---|
| **Ai** | Interface chat — kalau ini closed, orang tidak bisa percaya apa yang dikirim ke model |
| **Hub** | Policy engine, approval gate, audit log — kontrol otonomi harus bisa diaudit siapa pun |
| **Connect** | Provider + optimizer — logika biaya/caching harus bisa diverifikasi, bukan dipercaya buta |
| **Context** | Memori 4 tier — data pengguna disimpan lokal, kode yang menyentuhnya harus terbuka |
| **RnD** | Trace store + eval harness — transparansi ke bagaimana sistem dievaluasi |
| `packages/shared-*`, `packages/context-assembly` | Fondasi bersama, tidak ada nilai jual berdiri sendiri |

## Kandidat tier berbayar (belum dibangun — Fase 3/4 di `prd.md` §23)

Belum ada kode untuk modul-modul ini, jadi belum ada komitmen lisensi yang mengikat —
tapi arah saat ini:

| Modul | Kenapa kandidat berbayar |
|---|---|
| **Sync** | Relay lintas device + jembatan HTTPS publik butuh server yang di-maintain terus — biaya operasional nyata, bukan cuma kode |
| **Space** | Workspace UI lanjutan — nilai tambah di atas mesin inti, bukan prasyarat pakai ecorione |
| **Flow** | Workflow di atas durable execution — kebutuhan tim/power-user, bukan pengguna individu |
| **Sandbox** | Eksekusi terisolasi berskala — governance/compliance yang lebih relevan untuk tim/enterprise |

**Artifact** dan **AutoClick** belum diputuskan arahnya — keduanya bisa masuk salah satu
sisi tergantung kebutuhan saat mulai dibangun.

## Struktur teknis saat modul berbayar mulai dibangun

Modul berbayar **tidak masuk repo publik ini**. Rencana: repo privat terpisah (misal
`ecorione-cloud`) yang mengimpor `@ecorione/shared-schema`, `@ecorione/shared-server`,
dkk dari repo ini sebagai dependency biasa — bukan fork, bukan modifikasi kode inti.
Repo publik tidak pernah butuh tahu repo privat itu ada.

## Mengubah dokumen ini

Perubahan skema (modul pindah kategori, tier baru) dicatat sebagai baris baru di
[`DECISIONS.md`](DECISIONS.md), mengacu balik ke sini — bukan diam-diam mengedit tabel
di atas tanpa jejak.
