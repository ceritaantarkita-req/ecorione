import { VoiceCloseRequestSchema } from "@ecorione/shared-schema";
import { proxyToHub } from "../../../../lib/proxy";

export async function POST(request: Request): Promise<Response> {
  return proxyToHub(request, VoiceCloseRequestSchema, "/v1/voice/close");
}
