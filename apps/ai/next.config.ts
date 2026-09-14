import type { NextConfig } from "next";

/**
 * Header keamanan untuk seluruh permukaan Ai.
 *
 * Audit 2026-09-14 menemukan `next.config.ts` kosong: tidak ada CSP, tidak ada proteksi
 * framing, tidak ada `nosniff`. Karena Ai adalah satu-satunya modul yang sengaja dibuka
 * ke browser sekaligus pemegang `ECORIONE_INTERNAL_TOKEN`, permukaan itulah yang paling
 * butuh pembatasan. Gerbang same-origin untuk request mutasi ada di `middleware.ts`;
 * header di bawah menutup sisanya (framing, sniffing, kebocoran referrer, eksfiltrasi
 * lewat sub-resource).
 *
 * `'unsafe-inline'` pada `script-src` masih diperlukan karena Next 15 menyuntikkan
 * bootstrap inline tanpa nonce pada App Router statis. Menaikkannya ke CSP ber-nonce
 * dicatat sebagai pekerjaan lanjutan, bukan diklaim sudah selesai.
 *
 * `microphone` sengaja tidak dimatikan di `Permissions-Policy`: jalur voice
 * (`lib/voice-client.ts`) memerlukannya.
 */
const isDev = process.env.NODE_ENV === "development";

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), payment=(), usb=()" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
