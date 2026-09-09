/** Clients for Hub policy and RnD trace boundaries. */
import {
  PolicyVerdictSchema,
  type ActionRequest,
  type OperationId,
  type PolicyVerdict,
} from "@ecorione/shared-schema";
import { httpJson } from "@ecorione/shared-server";

export interface SandboxControlPlane {
  evaluate(request: ActionRequest): Promise<PolicyVerdict>;
  trace(input: {
    name: string;
    operationId: OperationId;
    recordedAt: string;
    attributes: Record<string, string | number | boolean | string[]>;
  }): Promise<void>;
}

export function createSandboxControlPlane(input: {
  hubUrl: string;
  rndUrl: string;
  token?: string | undefined;
}): SandboxControlPlane {
  return {
    async evaluate(request) {
      return PolicyVerdictSchema.parse(
        await httpJson<unknown>(`${input.hubUrl}/v1/actions/evaluate`, {
          token: input.token,
          body: request,
        }),
      );
    },
    async trace(span) {
      await httpJson(`${input.rndUrl}/v1/traces`, {
        token: input.token,
        body: {
          name: span.name,
          attributes: span.attributes,
          operationId: span.operationId,
          recordedAt: span.recordedAt,
        },
      });
    },
  };
}
