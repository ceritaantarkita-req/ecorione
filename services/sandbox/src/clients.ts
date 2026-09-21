/** Clients for Hub policy/authority and RnD trace boundaries. */
import {
  CapabilityAuthorizationResultSchema,
  PolicyVerdictSchema,
  type ActionRequest,
  type CapabilityAuthorizationRequest,
  type CapabilityAuthorizationResult,
  type OperationId,
  type PolicyVerdict,
} from "@ecorione/shared-schema";
import { httpJson } from "@ecorione/shared-server";

const DEFAULT_SANDBOX_CONTROL_TIMEOUT_MS = 10_000;

export interface SandboxControlPlane {
  authorize(request: CapabilityAuthorizationRequest): Promise<CapabilityAuthorizationResult>;
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
  timeoutMs?: number | undefined;
}): SandboxControlPlane {
  const timeoutMs = input.timeoutMs ?? DEFAULT_SANDBOX_CONTROL_TIMEOUT_MS;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) {
    throw new Error("Sandbox control-plane timeout harus integer 1..60000 ms.");
  }
  const signal = () => AbortSignal.timeout(timeoutMs);
  return {
    async authorize(request) {
      return CapabilityAuthorizationResultSchema.parse(
        await httpJson<unknown>(`${input.hubUrl}/v1/authority/authorize`, {
          token: input.token,
          body: request,
          signal: signal(),
        }),
      );
    },
    async evaluate(request) {
      return PolicyVerdictSchema.parse(
        await httpJson<unknown>(`${input.hubUrl}/v1/actions/evaluate`, {
          token: input.token,
          body: request,
          signal: signal(),
        }),
      );
    },
    async trace(span) {
      await httpJson(`${input.rndUrl}/v1/traces`, {
        token: input.token,
        signal: signal(),
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
