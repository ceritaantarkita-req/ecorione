import { proxyToSpace } from "../../../../../lib/space-proxy";

export async function PUT(
  request: Request,
  context: { params: Promise<{ label: string }> },
): Promise<Response> {
  const { label } = await context.params;
  return proxyToSpace(request, `/v1/core-memory/${encodeURIComponent(label)}`, "PUT");
}
