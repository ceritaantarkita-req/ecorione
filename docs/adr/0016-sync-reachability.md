# ADR-16 — Reachability Sync v1 memakai tunnel pihak ketiga

**Status:** Diterima · 2026-09-09 · Sumber: `docs/fase2.md` §2, `research.md` §4.3

## Konteks

Connect inbound pada Fase 2 punya dua transport: stdio untuk klien yang berjalan di mesin
pengguna, dan Streamable HTTP untuk klien hosted. Connect sendiri wajib tetap bind ke
`127.0.0.1`; mesin pengguna pada umumnya tidak punya alamat publik, TLS, atau port masuk
yang dapat dijangkau layanan hosted.

Tiga opsi yang sudah dibandingkan di `docs/fase2.md`:

1. tunnel pihak ketiga yang dijalankan pengguna;
2. relay yang dioperasikan ecorione;
3. port-forward + DDNS + TLS yang dikelola pengguna.

Masalah reachability ini tidak diselesaikan oleh protokol MCP. Karena Sync juga membawa
data `SYNC_ENCRYPTED`, keputusan reachability tidak boleh membuat relay atau tunnel menjadi
pemilik kunci plaintext.

## Keputusan

**Fase 2 v1 memakai opsi A: tunnel pihak ketiga / self-hosted bridge.**

`services/sync` menjalankan bridge lokal yang hanya bind loopback. Pengguna boleh
menempatkan Cloudflare Tunnel, ngrok, reverse proxy miliknya sendiri, atau mekanisme HTTPS
setara di depan bridge tersebut. Repo publik tidak mengelola relay publik ecorione.

Kontrak Sync lokal dirancang transport-agnostik: bridge menerima request publik yang sudah
melewati HTTPS edge dan meneruskannya ke Connect MCP loopback; relay device memakai koneksi
keluar dan blob ciphertext. Dengan kontrak ini, **opsi B** (relay terkelola ecorione) dapat
ditambahkan kemudian tanpa mengubah API lokal atau format blob. Implementasi relay terkelola,
kalau dipilih kelak, butuh ADR baru dan mengikuti batas lisensi di `docs/LICENSING.md`.

Opsi C tidak menjadi jalur resmi v1 karena port-forward, DDNS, dan pengelolaan sertifikat
memberi beban setup/support terbesar serta memperluas permukaan konfigurasi keamanan.

## Invarian keamanan

- Connect MCP HTTP tetap bind `127.0.0.1`; Sync tidak boleh membuat Connect listen publik.
- Sync bridge juga default loopback. Exposure publik dilakukan oleh HTTPS edge yang dipilih
  pengguna, bukan dengan mengubah bind host service menjadi `0.0.0.0` secara diam-diam.
- Request MCP tetap harus lolos autentikasi/audience/scope di resource server Connect; tunnel
  bukan boundary otorisasi.
- Data `SYNC_ENCRYPTED` dienkripsi end-to-end sebelum masuk relay. Sync/relay tidak menerima
  kunci plaintext dan tidak mengubah ciphertext.
- `LOCAL_ONLY` tidak pernah masuk jalur relay.

## Konsekuensi

- Fase 2 bisa dipakai tanpa ecorione mengoperasikan infrastruktur publik.
- UX setup hosted-client v1 lebih teknis karena pengguna harus menyiapkan tunnel/HTTPS edge.
- E2E otomatis menguji reverse-proxy lokal tanpa bergantung layanan tunnel eksternal; uji
  tunnel sungguhan tetap langkah manual deployment dan harus dilaporkan terpisah.
- Opsi relay terkelola tetap terbuka sebagai evolusi produk, tetapi tidak boleh diselipkan ke
  repo publik tanpa keputusan arsitektur/lisensi baru.
