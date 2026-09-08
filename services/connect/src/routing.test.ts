import { describe, expect, it } from "vitest";
import { LOCAL_PINNED_MODEL, route } from "./routing.js";

describe("route", () => {
  it("target local selalu ke model lokal, apa pun sensitivitasnya", () => {
    const decision = route({ target: "local", sensitivity: "RESTRICTED" });
    expect(decision).toEqual({ model: LOCAL_PINNED_MODEL, routeReason: "local-consolidation" });
  });

  it("target hosted + sensitivity RESTRICTED → Opus (kualitas tertinggi)", () => {
    const decision = route({ target: "hosted", sensitivity: "RESTRICTED" });
    expect(decision).toEqual({
      model: "claude-opus-4-1-20250805",
      routeReason: "sensitivity-restricted",
    });
  });

  it("target hosted + sensitivity biasa → default hosted (Sonnet)", () => {
    for (const sensitivity of ["PUBLIC", "INTERNAL", "SENSITIVE"] as const) {
      const decision = route({ target: "hosted", sensitivity });
      expect(decision).toEqual({
        model: "claude-sonnet-4-5-20250929",
        routeReason: "default-hosted",
      });
    }
  });

  it("aturan local menang atas aturan sensitivity (urutan aturan, bukan prioritas gerbang)", () => {
    // target local + RESTRICTED tetap ke model lokal — model lokal berperan
    // classifier/extractor, bukan agent loop (ADR-04), jadi gerbang sensitivity untuk
    // agent loop tidak relevan di jalur ini.
    const decision = route({ target: "local", sensitivity: "RESTRICTED" });
    expect(decision.routeReason).toBe("local-consolidation");
  });
});
