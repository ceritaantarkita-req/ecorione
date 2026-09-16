import { describe, expect, it } from "vitest";
import { selectEcxReferenceIndexes } from "../services/hub/src/exchange-selector.ts";
import {
  AUTO_SELECTION,
  FIXTURES,
  referenceSelectionMetrics,
} from "../scripts/comparative-evidence.mjs";

describe("W17 no-oracle selector fixture contract", () => {
  for (const fixture of FIXTURES) {
    it(`selects every oracle-required ref for ${fixture.id} without receiving oracle indexes`, () => {
      const packet = {
        intent: "comparative-evidence",
        task: fixture.prompt,
        need: fixture.need,
      };
      const descriptors = fixture.documents.map((document, index) => ({
        index,
        text: [document.id, document.content].join("\n"),
      }));

      const selected = selectEcxReferenceIndexes(packet, descriptors, {
        maxRefs: AUTO_SELECTION.maxRefs,
      });
      const metrics = referenceSelectionMetrics(selected, fixture.relevantRefIndexes);

      expect(selected.length).toBeGreaterThan(0);
      expect(selected.length).toBeLessThanOrEqual(AUTO_SELECTION.maxRefs);
      expect(new Set(selected).size).toBe(selected.length);
      expect(metrics.recall).toBe(1);
    });
  }
});
