# ADR-34 — Batas Kepercayaan Permukaan Browser Ai

Status: Accepted
Date: 2026-09-14

## Konteks

Audit 2026-09-14 membuktikan end-to-end terhadap stack yang hidup bahwa seluruh permukaan
HTTP `apps/ai` bisa dioperasikan oleh situs web mana pun yang sedang dibuka pengguna.

Penyebabnya struktural, bukan satu bug: route handler Ai tidak meminta kredensial apa pun
dari browser karena Ai sendiri yang menyuntikkan `ECORIONE_INTERNAL_TOKEN` server-side ke
Hub/Connect. Dari sudut pandang Hub/Connect, setiap request yang sampai ke handler sudah
terautentikasi. Ai tidak pernah memverifikasi bahwa request itu benar-benar berasal dari
UI-nya sendiri — tidak ada `middleware.ts`, tidak ada pemeriksaan `Origin` maupun
`Sec-Fetch-Site`, dan `next.config.ts` kosong tanpa CSP atau header keamanan.

Bukti yang direproduksi: `PUT` lintas-origin dari `https://evil.example` dengan
`Content-Type: text/plain` (simple request, tanpa preflight) dan tanpa token apa pun
membalas `200` dan mengubah `localBaseUrl` Connect dari `http://127.0.0.1:11434/v1`
menjadi `https://evil.example/v1`. Artinya seluruh percakapan bertanda "Local" — beserta
memori/konteks yang terhidrasi ke dalam prompt — bisa diarahkan ke server pihak ketiga
sementara UI tetap menulis "Local". Permukaan lain (`/api/attachments`, `/api/chat`,
`/api/forget`, Space/Flow/MCP) terbuka lewat jalur yang sama.

Pola pertahanannya sudah ada di repo (`services/connect/src/mcp/auth.ts` punya
`validateOrigin()`), tapi tidak pernah dipasang di permukaan yang justru dibuka ke browser.

## Keputusan

Ai memperlakukan setiap request mutasi sebagai tidak tepercaya sampai terbukti same-origin,
dan pembuktian itu dilakukan di satu tempat, bukan di tiap handler.

1. `apps/ai/middleware.ts` menolak semua method mutasi (POST/PUT/PATCH/DELETE) dengan
   `403 FORBIDDEN_ORIGIN` kecuali `Sec-Fetch-Site: same-origin`, dengan fallback
   pencocokan `Origin` terhadap host yang dilayani ketika header itu tidak dikirim.
   Matcher-nya sengaja lebar (seluruh path kecuali aset build) supaya route baru ikut
   terlindungi secara default; method aman diloloskan di dalam predikatnya.
2. Keputusannya berada di fungsi murni `apps/ai/lib/request-origin.ts` supaya bisa diuji
   tanpa menjalankan runtime Next, termasuk kasus serangan yang dibuktikan audit.
3. Request tanpa `Sec-Fetch-Site` maupun `Origin` diloloskan: browser selalu mengirim
   minimal salah satunya pada request non-GET, jadi ketiadaan keduanya berarti klien
   non-browser (curl, smoke test launcher), yang bukan vektor CSRF.
4. `ECORIONE_AI_ALLOWED_ORIGINS` menambah origin tepercaya untuk deployment di belakang
   reverse proxy dengan hostname berbeda.
5. `next.config.ts` memasang CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options`,
   `Referrer-Policy`, COOP/CORP, `Permissions-Policy`, dan mematikan `X-Powered-By`.

## Konsekuensi

Route handler baru tidak perlu mengingat untuk memeriksa origin; yang perlu diingat adalah
jangan memberi efek samping pada method aman, karena method aman tidak dijaga di sini.

`'unsafe-inline'` pada `script-src` masih diperlukan oleh bootstrap inline Next 15 tanpa
nonce. CSP ber-nonce dicatat sebagai pekerjaan lanjutan dan tidak diklaim sudah selesai.

Gerbang ini melindungi permukaan Ai, bukan permukaan owner service. Hub/Connect tetap
mensyaratkan bearer token internal dan tetap menjadi authority atas policy dan kredensial.
