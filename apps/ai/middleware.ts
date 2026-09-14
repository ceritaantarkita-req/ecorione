/**
 * Gerbang same-origin untuk setiap request mutasi yang masuk ke `apps/ai`.
 *
 * Ditaruh di middleware, bukan di tiap route handler, supaya route baru ikut terlindungi
 * secara default — audit 2026-09-14 menemukan 15 route handler yang semuanya mengasumsikan
 * same-origin tanpa pernah memverifikasinya. Logika keputusannya ada di
 * `lib/request-origin.ts` supaya bisa diuji tanpa menjalankan runtime Next.
 */
import { NextResponse, type NextRequest } from "next/server";
import { checkRequestOrigin, parseAllowedOrigins } from "./lib/request-origin";

export function middleware(request: NextRequest): NextResponse {
  const verdict = checkRequestOrigin({
    method: request.method,
    secFetchSite: request.headers.get("sec-fetch-site"),
    origin: request.headers.get("origin"),
    host: request.headers.get("host"),
    allowedOrigins: parseAllowedOrigins(process.env.ECORIONE_AI_ALLOWED_ORIGINS),
  });

  if (verdict.allowed) return NextResponse.next();

  return NextResponse.json(
    {
      error: {
        type: "FORBIDDEN_ORIGIN",
        message: "Request lintas-origin ditolak.",
        detail: verdict.reason,
      },
    },
    { status: 403, headers: { "cache-control": "no-store" } },
  );
}

export const config = {
  /**
   * Seluruh path kecuali aset build Next dan favicon. Method aman tetap lolos di dalam
   * `checkRequestOrigin`, jadi matcher ini sengaja lebar: yang dilindungi bukan cuma
   * `/api`, tapi juga Server Action yang di-POST ke route halaman.
   */
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
