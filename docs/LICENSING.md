# Model lisensi: open core

ecorione open source di bawah [MIT](../LICENSE) — dan tetap begitu selamanya untuk semua
kode yang sudah dirilis. Dokumen ini menjelaskan batas antara yang **selalu open source**
dan yang jadi **kandidat komersial** nanti, supaya tidak ada kejutan "rug pull".

## Prinsip

1. **Kode yang sudah dirilis MIT tidak pernah ditarik balik ke closed source.**
2. **Mesin inti self-hosted selalu gratis dan open source.** Kalau bagian ini ditutup,
   proposisi local-first dan kontrol pengguna menjadi tidak bisa diaudit.
3. **Yang berpotensi berbayar adalah infrastruktur terkelola** — relay publik, hosting,
   dashboard tim, operasi skala — bukan protokol atau client lokal yang dibutuhkan agar
   pengguna dapat self-host.

## Selalu open source (MIT)

| Modul / bagian | Kenapa selalu open |
|---|---|
| **Ai** | Interface chat; apa yang dikirim ke model harus dapat diaudit |
| **Hub** | Policy, approval, durable state, audit log |
| **Connect** | Provider, optimizer, MCP inbound; routing/cost/trust boundary harus dapat diverifikasi |
| **Context** | Memori 4 tier; data pengguna lokal |
| **RnD** | Trace + eval evidence |
| **Sync local/self-hosted** | Device pairing, E2E relay protocol/client, dan MCP bridge lokal adalah bagian dari kemampuan self-hosted; ADR-16 |
| `packages/shared-*`, `packages/context-assembly` | Fondasi kontrak bersama |

## Kandidat tier berbayar / repo privat

| Bagian | Batasnya |
|---|---|
| **Managed Sync relay/cloud** | Infrastruktur publik yang dioperasikan ecorione, bukan `services/sync` lokal; biaya uptime/traffic nyata |
| **Space advanced/team** | Fitur workspace/tim di atas backend self-hosted yang terbuka; keputusan komersial final belum dikunci |
| **Flow managed** | Hosting/operasi durable execution untuk tim; definisi integrasi inti tetap harus dapat diaudit |
| **Sandbox managed** | Isolasi berskala, governance/compliance, image registry dan operasi enterprise |

**Artifact** dan **AutoClick** belum diputuskan arah komersialnya. Keputusan lisensi tidak
boleh mengubah lisensi kode MIT yang sudah pernah dirilis.

## Struktur teknis untuk layanan berbayar

Kode managed/cloud tidak masuk repo publik ini. Repo privat dapat mengimpor paket publik
`@ecorione/shared-schema`, `@ecorione/shared-server`, dan kontrak lain sebagai dependency;
repo publik tidak boleh bergantung pada keberadaan repo privat agar mode self-hosted jalan.

## Mengubah dokumen ini

Perubahan kategori dicatat sebagai baris baru di [`DECISIONS.md`](DECISIONS.md), bukan
mengubah tabel diam-diam.
