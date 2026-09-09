# ADR-16 — Reachability Sync v1 memakai tunnel pihak ketiga

**Status:** Diterima · 2026-09-09 · external HTTPS acceptance terverifikasi 2026-09-09 · Sumber: `docs/fase2.md` §2, `research.md` §4.3

## Konteks

Connect inbound pada Fase 2 punya dua transport: stdio untuk klien yang berjalan di mesin pengguna, dan Streamable HTTP untuk klien hosted. Connect sendiri wajib tetap bind ke `127.0.0.1`; mesin pengguna pada umumnya tidak punya alamat publik, TLS, atau port masuk yang dapat dijangkau layanan hosted.

Tiga opsi yang sudah dibandingkan di `docs/fase2.md`:

1. tunnel pihak ketiga yang dijalankan pengguna;
2. relay yang dioperasikan ecorione;
3. port-forward + DDNS + TLS yang dikelola pengguna.

Masalah reachability ini tidak diselesaikan oleh protokol MCP. Karena Sync juga membawa data `SYNC_ENCRYPTED`, keputusan reachability tidak boleh membuat relay atau tunnel menjadi pemilik kunci plaintext.

## Keputusan

**Fase 2 v1 memakai opsi A: tunnel pihak ketiga / self-hosted bridge.**

`services/sync` menjalankan bridge lokal yang default bind loopback. Pengguna boleh menempatkan Cloudflare Tunnel, ngrok, reverse proxy miliknya sendiri, atau mekanisme HTTPS setara di depan bridge tersebut. Repo publik tidak mengelola relay publik ecorione.

Kontrak Sync lokal dirancang transport-agnostik: bridge menerima request publik yang sudah melewati HTTPS edge dan meneruskannya ke Connect MCP loopback; relay device memakai koneksi keluar dan blob ciphertext. Dengan kontrak ini, **opsi B** (relay terkelola ecorione) dapat ditambahkan kemudian tanpa mengubah API lokal atau format blob. Implementasi relay terkelola, kalau dipilih kelak, butuh ADR baru dan mengikuti batas lisensi di `docs/LICENSING.md`.

Opsi C tidak menjadi jalur resmi v1 karena port-forward, DDNS, dan pengelolaan sertifikat memberi beban setup/support terbesar serta memperluas permukaan konfigurasi keamanan.

## OAuth discovery pada edge publik

MCP HTTP adalah OAuth protected resource. Ketika request tidak memiliki token valid atau scope yang cukup, Connect mengirim `WWW-Authenticate` yang memuat:

- `resource_metadata` yang menunjuk URL Protected Resource Metadata untuk **resource publik**;
- scope minimum yang dibutuhkan request/tool;
- `invalid_token` atau `insufficient_scope`.

Sync meneruskan challenge tersebut tanpa mengubahnya. HTTPS edge tidak menjadi authorization boundary: issuer, audience/resource, signature JWKS, expiry/not-before, Origin, OAuth scope, memory scope, dan sensitivity tetap diverifikasi di Connect.

## Invarian keamanan

- Connect MCP HTTP tetap bind `127.0.0.1`; Sync/tunnel tidak boleh membuat Connect listen publik.
- Sync bridge default loopback. Exposure publik dilakukan oleh HTTPS edge yang dipilih pengguna, bukan dengan mengubah bind host service menjadi `0.0.0.0` secara diam-diam.
- Request MCP tetap harus lolos autentikasi/audience/scope di resource server Connect; tunnel bukan boundary otorisasi.
- `WWW-Authenticate resource_metadata` harus menunjuk resource publik yang benar; challenge tidak boleh bocor ke URL loopback.
- Data `SYNC_ENCRYPTED` dienkripsi end-to-end sebelum masuk relay. Sync/relay tidak menerima kunci plaintext dan tidak mengubah ciphertext.
- `LOCAL_ONLY` tidak pernah masuk jalur relay.

## Evidence external HTTPS acceptance

Repository memiliki workflow `.github/workflows/mcp-external-acceptance.yml` dan runner `scripts/mcp-external-https-acceptance.mjs`. Acceptance memakai dua public HTTPS Quick Tunnel sementara: satu untuk OAuth/JWKS dan satu untuk Sync MCP bridge. Connect tetap loopback. Binary `cloudflared` dipin ke release `2026.8.3` dan checksum SHA-256 diverifikasi sebelum dijalankan.

Acceptance membuktikan secara nyata:

1. public Protected Resource Metadata reachable melalui HTTPS;
2. 401 challenge membawa `resource_metadata` dan scope minimum;
3. Connect mengambil JWKS melalui public HTTPS dan memverifikasi JWT issuer/audience/signature;
4. `server/discover` dan `tools/list` berjalan melalui tunnel;
5. `tools/call memory_search` melintasi public HTTPS -> Sync -> Connect -> Hub tepat satu kali;
6. insufficient scope, malformed JWT, Origin terlarang, dan routing-header mismatch gagal tertutup;
7. process/tunnel dibersihkan pada akhir acceptance.

Gate external-network tidak mengubah kegagalan tunnel/provider jaringan menjadi skip/pass. Ketergantungan eksternal yang gagal tetap menghasilkan workflow failure yang terlihat.

## Konsekuensi

- Fase 2 bisa dipakai tanpa ecorione mengoperasikan infrastruktur publik.
- UX setup hosted-client v1 lebih teknis karena pengguna harus menyiapkan tunnel/HTTPS edge dan authorization server/JWKS.
- Reverse-proxy lokal tetap diuji deterministik di test suite, sedangkan dedicated external workflow membuktikan reachability HTTPS nyata ketika file MCP/Sync terkait berubah atau workflow dijalankan manual.
- Quick Tunnel di acceptance adalah test transport sementara, **bukan** managed relay ecorione dan bukan deployment recipe produksi.
- Opsi relay terkelola tetap terbuka sebagai evolusi produk, tetapi tidak boleh diselipkan ke repo publik tanpa keputusan arsitektur/lisensi baru.
