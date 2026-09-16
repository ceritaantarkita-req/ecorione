import { assertId, type EcxPacket } from "@ecorione/shared-schema";
import { describe, expect, it } from "vitest";
import { selectEcxReferenceIndexes } from "./exchange-selector.js";

function artifactRef(id: string) {
  return { kind: "artifact" as const, artifactId: assertId("artifact", id) };
}

function packet(overrides: Partial<EcxPacket> = {}): EcxPacket {
  return {
    version: 1,
    packetId: assertId("event", "evt_selector001"),
    operationId: assertId("operation", "op_selector001"),
    sender: "agent:planner",
    recipient: "agent:reviewer",
    intent: "comparative-evidence",
    task:
      'Return JSON with exactly these keys: {"supplier":"","leadTimeDays":0,"maxFirstBatchUnits":0}. Preserve strings exactly and use JSON numbers for numeric fields.',
    need: ["procurement", "verification"],
    refs: [
      artifactRef("art_selector001"),
      artifactRef("art_selector002"),
      artifactRef("art_selector003"),
      artifactRef("art_selector004"),
      artifactRef("art_selector005"),
    ],
    budget: { maxHydratedBytes: 16_384 },
    responseMode: "delta",
    ...overrides,
  };
}

describe("ECX automatic reference selector", () => {
  it("selects authoritative procurement evidence over legacy/noise references", () => {
    const selected = selectEcxReferenceIndexes(
      packet(),
      [
        {
          index: 0,
          text: "legacy budget history. Earlier drafts do not state the final supplier, lead time, or first batch quantity.",
        },
        {
          index: 1,
          text: "older atlas proposal. Non-authoritative vendor marketing without the requested final delivery facts.",
        },
        {
          index: 2,
          text: "FINAL PROCUREMENT AWARD. Approved supplier: Boreal Systems. Award status: final.",
        },
        {
          index: 3,
          text: "generic compliance appendix without the requested commercial delivery facts.",
        },
        {
          index: 4,
          text: "FINAL DELIVERY COMMITMENT. Lead time: 12 days. Maximum first batch: 320 units.",
        },
      ],
      { maxRefs: 2 },
    );

    expect(new Set(selected)).toEqual(new Set([2, 4]));
  });

  it("uses deterministic index ordering when descriptors have no semantic overlap", () => {
    const selected = selectEcxReferenceIndexes(
      packet({ task: "Find a completely absent concept.", need: ["absent-concept"] }),
      [
        { index: 3, text: "alpha beta gamma" },
        { index: 1, text: "delta epsilon zeta" },
      ],
      { maxRefs: 1 },
    );

    expect(selected).toEqual([1]);
  });

  it("returns no selection for a packet with no references", () => {
    expect(
      selectEcxReferenceIndexes(packet({ refs: [] }), [], {
        maxRefs: 4,
      }),
    ).toEqual([]);
  });
});
