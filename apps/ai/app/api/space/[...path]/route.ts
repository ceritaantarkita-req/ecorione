import { proxyToSpace } from "../../../../lib/space-proxy";

type RouteContext = { params: Promise<{ path: string[] }> };
type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

async function forward(request: Request, context: RouteContext, method: Method): Promise<Response> {
  const { path } = await context.params;
  if (path.length === 0) return new Response("Not Found", { status: 404 });
  const encoded = path.map((segment) => encodeURIComponent(segment)).join("/");
  const url = new URL(request.url);
  return proxyToSpace(request, `/v1/${encoded}${url.search}`, method);
}

export async function GET(request: Request, context: RouteContext) {
  return forward(request, context, "GET");
}
export async function POST(request: Request, context: RouteContext) {
  return forward(request, context, "POST");
}
export async function PUT(request: Request, context: RouteContext) {
  return forward(request, context, "PUT");
}
export async function PATCH(request: Request, context: RouteContext) {
  return forward(request, context, "PATCH");
}
export async function DELETE(request: Request, context: RouteContext) {
  return forward(request, context, "DELETE");
}
