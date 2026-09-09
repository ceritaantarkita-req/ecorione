import { EcxPlanRequestSchema, assertId } from "@ecorione/shared-schema";
import { describe, expect, it } from "vitest";
import { planEcx } from "./exchange.js";

const request = EcxPlanRequestSchema.parse({
  operationId: assertId("operation", "op_ecxplan001"),
  requestedAt: "2026-09-09T00:00:00.000Z",
  sender: "agent:planner",
  intent: "review",
  task: "Review security and correctness of the proposed change.",
  need: ["security", "correctness"],
  refs: [
    {
      kind: "history",
      sessionId: assertId("session", "sess_ecx001"),
      afterSeq: 10,
      throughSeq: 15,
    },
  ],
  budget: { maxHydratedBytes: 12_000 },
  responseMode: "delta",
  candidates: [
    { agentId: "agent:security-expensive", capabilities: ["security"], estimatedCost: 5 },
    {
      agentId: "agent:reviewer",
      capabilities: ["security", "correctness"],
      estimatedCost: 4,
    },
    {
      agentId: "agent:reviewer-cheap",
      capabilities: ["security", "correctness"],
      estimatedCost: 2,
    },
    { agentId: "agent:writer", capabilities: ["copywriting"], estimatedCost: 0.1 },
  ],
  maxRecipients: 1,
});

describe("ECX sparse planner", () => {
  it("selects by capability overlap, then cost, and does not broadcast", () => {
    const result = planEcx(request, {
      makePacketId: () => assertId("event", "evt_ecxpacket001"),
    });
    expect(result.metrics.candidateCount).toBe(4);
    expect(result.metrics.recipientCount).toBe(1);
    expect(result.packets[0]?.recipient).toBe("agent:reviewer-cheap");
    expect(result.packets[0]?.refs).toEqual(request.refs);
  });

  it("returns no packet when no capability matches", () => {
    const result = planEcx(
      EcxPlanRequestSchema.parse({
        ...request,
        need: ["finance"],
        candidates: [
          { agentId: "agent:writer", capabilities: ["copywriting"], estimatedCost: 0 },
        ],
      }),
    );
    expect(result.packets).toEqual([]);
    expect(result.metrics.recipientCount).toBe(0);
  });

  it("keeps references as references instead of embedding referenced content", () => {
    const result = planEcx(request, {
      makePacketId: () => assertId("event", "evt_ecxpacket002"),
    });
    const encoded = JSON.stringify(result.packets[0]);
    expect(encoded).toContain('"kind":"history"');
    expect(encoded).not.toContain("full history payload");
    expect(result.metrics.packetBytes).toBe(Buffer.byteLength(encoded, "utf8"));
  });

  it("pointer-first packet stays smaller than an equivalent inline-history fixture", () => {
    const result = planEcx(request, {
      makePacketId: () => assertId("event", "evt_ecxpacket003"),
    });
    const packet = result.packets[0];
    expect(packet).toBeDefined();
    const inlineFixture = {
      ...packet,
      refs: [],
      inlineHistory: "x".repeat(8_000),
    };
    expect(result.metrics.packetBytes).toBeLessThan(
      Buffer.byteLength(JSON.stringify(inlineFixture), "utf8"),
    );
  });

  it("is deterministic by default and ignores candidate input order", () => {
    const first = planEcx(request);
    const second = planEcx(request);
    const permuted = planEcx(
      EcxPlanRequestSchema.parse({
        ...request,
        candidates: [...request.candidates].reverse(),
      }),
    );

    expect(second).toEqual(first);
    expect(permuted.packets).toEqual(first.packets);
    expect(permuted.metrics.packetBytes).toBe(first.metrics.packetBytes);
  });

  it("rejects duplicate candidate identities before planning", () => {
    const duplicate = request.candidates[0];
    expect(() =>
      EcxPlanRequestSchema.parse({
        ...request,
        candidates: [duplicate, duplicate],
      }),
    ).toThrow(/candidate agentId tidak boleh duplikat/);
  });
});
