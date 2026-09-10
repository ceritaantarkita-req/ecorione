import { proxyToConnectSettings } from "../../../../lib/settings-proxy";

type RouteContext = { params: Promise<{ path: string[] }> };
async function forward(
  request: Request,
  context: RouteContext,
  method: "GET" | "POST" | "PUT" | "DELETE",
): Promise<Response> {
  const { path } = await context.params;
  if (path.length === 0 || path.some((segment) => !/^[A-Za-z0-9._-]+$/.test(segment)))
    return new Response("Not Found", { status: 404 });
  const url = new URL(request.url);
  return proxyToConnectSettings(request, `/v1/${path.join("/")}${url.search}`, method);
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
export async function DELETE(request: Request, context: RouteContext) {
  return forward(request, context, "DELETE");
}
