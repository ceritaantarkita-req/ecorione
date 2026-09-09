import { proxyToSpace } from "../../../../lib/space-proxy";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  return proxyToSpace(request, `/v1/pages${url.search}`, "GET");
}

export async function POST(request: Request): Promise<Response> {
  return proxyToSpace(request, "/v1/pages", "POST");
}
