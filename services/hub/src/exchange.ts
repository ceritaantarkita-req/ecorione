import { createHash } from "node:crypto";
import {
  ECX_VERSION,
  EcxPlanResponseSchema,
  assertId,
  type EcxCandidate,
  type EcxPlanRequest,
  type EcxPlanResponse,
  type EventId,
} from "@ecorione/shared-schema";

function normalizedCapabilities(candidate: EcxCandidate): Set<string> {
  return new Set(candidate.capabilities.map((value) => value.trim().toLowerCase()));
}

function overlapScore(need: readonly string[], candidate: EcxCandidate): number {
  const capabilities = normalizedCapabilities(candidate);
  return new Set(need.map((value) => value.trim().toLowerCase())).size === 0
    ? 0
    : [...new Set(need.map((value) => value.trim().toLowerCase()))].filter((value) =>
        capabilities.has(value),
      ).length;
}

function deterministicPacketId(input: EcxPlanRequest, recipient: string): EventId {
  const digest = createHash("sha256")
    .update(
      JSON.stringify({
        version: ECX_VERSION,
        historySessionId: input.historySessionId ?? null,
        requestedAt: input.requestedAt,
        operationId: input.operationId,
        sender: input.sender,
        recipient,
        intent: input.intent,
        task: input.task,
        need: input.need,
        refs: input.refs,
        budget: input.budget,
        responseMode: input.responseMode,
      }),
    )
    .digest("hex");
  return assertId("event", `evt_${digest.slice(0, 24)}`);
}

export interface EcxPlannerOptions {
  readonly makePacketId?: (() => EventId) | undefined;
}

export function planEcx(
  input: EcxPlanRequest,
  options: EcxPlannerOptions = {},
): EcxPlanResponse {
  const selected = input.candidates
    .map((candidate) => ({ candidate, score: overlapScore(input.need, candidate) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      if (left.candidate.estimatedCost !== right.candidate.estimatedCost) {
        return left.candidate.estimatedCost - right.candidate.estimatedCost;
      }
      return left.candidate.agentId.localeCompare(right.candidate.agentId);
    })
    .slice(0, input.maxRecipients);

  const packets = selected.map(({ candidate }) => ({
    version: ECX_VERSION,
    packetId: options.makePacketId?.() ?? deterministicPacketId(input, candidate.agentId),
    operationId: input.operationId,
    sender: input.sender,
    recipient: candidate.agentId,
    intent: input.intent,
    task: input.task,
    need: [...input.need],
    refs: [...input.refs],
    budget: input.budget,
    responseMode: input.responseMode,
  }));
  const packetBytes = packets.reduce(
    (total, packet) => total + Buffer.byteLength(JSON.stringify(packet), "utf8"),
    0,
  );
  return EcxPlanResponseSchema.parse({
    packets,
    metrics: {
      candidateCount: input.candidates.length,
      recipientCount: packets.length,
      packetBytes,
    },
  });
}
