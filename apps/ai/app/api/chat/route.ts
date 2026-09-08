/**
 * Proxy `POST /v1/chat` ke Hub.
 *
 * Ada supaya `ECORIONE_INTERNAL_TOKEN` tidak pernah sampai ke bundle client — browser
 * memanggil route ini (same-origin, tanpa token), lalu route ini yang memanggil Hub
 * membawa token dari `process.env` (server-side saja). Lihat `lib/proxy.ts` untuk logika
 * bersama dengan `app/api/forget/route.ts`.
 */

import { ChatRequestSchema } from "@ecorione/shared-schema";
import { proxyToHub } from "../../../lib/proxy";

export async function POST(request: Request): Promise<Response> {
  return proxyToHub(request, ChatRequestSchema, "/v1/chat");
}
