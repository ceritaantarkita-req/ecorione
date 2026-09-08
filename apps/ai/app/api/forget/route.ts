/**
 * Proxy `POST /v1/memory/forget` ke Hub — lihat `app/api/chat/route.ts` untuk alasan
 * proxy ini ada, dan `lib/proxy.ts` untuk logika bersama.
 */

import { ForgetFactRequestSchema } from "@ecorione/shared-schema";
import { proxyToHub } from "../../../lib/proxy";

export async function POST(request: Request): Promise<Response> {
  return proxyToHub(request, ForgetFactRequestSchema, "/v1/memory/forget");
}
