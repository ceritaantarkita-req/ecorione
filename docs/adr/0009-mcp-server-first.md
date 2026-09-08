# ADR-09 — Server MCP dulu, klien MCP kedua; semua fungsi lewat tools

**Status:** Diterima · 2026-09-07 · Sumber: `research.md` §4

## Konteks

Spec MCP **2026-07-28 adalah penulisan ulang yang breaking**: stateless, handshake
`initialize` dihapus, session tingkat protokol hilang, dan RPC baru `server/discover`
menjadi wajib.

**Sampling, Roots, dan Logging dideprecate.** Migrasi yang disarankan spec, verbatim:
*"integrate directly with LLM provider APIs instead of Sampling."*

Realitas dukungan klien lebih pahit dari pitch:

- Konektor Claude API: *"only tool calls are currently supported"*.
- ChatGPT: Pro = read/fetch saja; deep research read-only; **agent mode tidak memakai
  custom app sama sekali**.
- Resources dan prompts praktis hanya hidup di klien IDE.

Dan asisten hosted **tidak bisa menjangkau localhost** — butuh HTTPS publik.

## Keputusan

ecorione adalah **server MCP** (permukaan utama) dan **klien MCP** (sekunder, untuk ingest).

Semua fungsi wajib jalan lewat **tools**; resources didefinisikan tapi diperlakukan sebagai
bonus. Permukaan tool sengaja kecil: `memory_search`, `memory_get`, `memory_propose`,
`memory_recent`, `memory_open`.

**Jangan bangun apa pun di atas Sampling.** Panggil API provider atau model lokal langsung.

Sebagai klien, konten dari server pihak ketiga **tidak pernah mengalir tanpa label** ke
memori yang kemudian disajikan balik ke Claude — itu jalur pencucian konten terinjeksi.

## Konsekuensi

- Klaim yang dikomunikasikan: *"satu memori, bisa dipanggil sebagai tool dari semua
  asisten besar; jadi konteks ambient di klien IDE; akses tulis sejauh host mengizinkan."*
  **Bukan** "semua AI otomatis mengingat".
- Sync naik jadi prasyarat pitch inti, bukan pelengkap: ia yang menyediakan jembatan HTTPS.
- Harus mendukung era stateful dan stateless selama jendela deprecation (minimum 12 bulan).
