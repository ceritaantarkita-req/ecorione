import { proxyToSpace } from "../../../../lib/space-proxy";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  return proxyToSpace(request, `/v1/core-memory${url.search}`, "GET");
}
