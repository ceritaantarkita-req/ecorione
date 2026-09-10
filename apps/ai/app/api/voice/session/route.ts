import { VoiceSessionCreateRequestSchema } from "@ecorione/shared-schema";
import { proxyToHub } from "../../../lib/proxy";

export async function POST(request: Request): Promise<Response> {
  return proxyToHub(request, VoiceSessionCreateRequestSchema, "/v1/voice/sessions");
}
