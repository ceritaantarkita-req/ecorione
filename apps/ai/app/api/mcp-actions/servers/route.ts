import { listMcpActionServers } from "../../../../lib/mcp-action-proxy";

export async function GET(request: Request): Promise<Response> {
  return listMcpActionServers(request);
}
