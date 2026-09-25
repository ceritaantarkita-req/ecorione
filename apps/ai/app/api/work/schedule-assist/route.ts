import { ScheduleAssistRequestSchema } from "@ecorione/shared-schema";
import { proxyToHub } from "../../../../lib/proxy";

export async function POST(request: Request): Promise<Response> {
  return proxyToHub(request, ScheduleAssistRequestSchema, "/v1/work/schedule/assist");
}
