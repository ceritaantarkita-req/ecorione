import { VoiceInterruptRequestSchema } from "@ecorione/shared-schema";
import { proxyToHub } from "../../../../lib/proxy";

export async function POST(request: Request): Promise<Response> {
  return proxyToHub(request, VoiceInterruptRequestSchema, "/v1/voice/interrupt");
}
