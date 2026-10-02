import { discoverMcpActionServer } from "../../../../../../lib/mcp-action-proxy";

type RouteContext = { params: Promise<{ serverId: string }> };

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const { serverId } = await context.params;
  return discoverMcpActionServer(request, serverId);
}
