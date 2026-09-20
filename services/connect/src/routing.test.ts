import { describe, expect, it } from "vitest";
import { LOCAL_PINNED_MODEL, route } from "./routing.js";

describe("route", () => {
  it("target local selalu ke model lokal, apa pun provider/sensitivitasnya", () => {
    const decision = route({
      target: "local",
      sensitivity: "RESTRICTED",
      hostedProvider: "openai",
    });
    expect(decision).toEqual({ model: LOCAL_PINNED_MODEL, routeReason: "local-consolidation" });
  });

  it("default provider tetap Anthropic untuk backward compatibility", () => {
    expect(route({ target: "hosted", sensitivity: "INTERNAL" }).model).toBe(
      "claude-sonnet-4-5-20250929",
    );
    expect(route({ target: "hosted", sensitivity: "RESTRICTED" }).model).toBe(
      "claude-opus-4-1-20250805",
    );
  });

  it("OpenRouter memakai pinned Claude identities yang sama, bukan auto-router", () => {
    expect(
      route({ target: "hosted", sensitivity: "INTERNAL", hostedProvider: "openrouter" }),
    ).toEqual({
      model: "claude-sonnet-4-5-20250929",
      routeReason: "default-hosted",
    });
    expect(
      route({ target: "hosted", sensitivity: "RESTRICTED", hostedProvider: "openrouter" }),
    ).toEqual({
      model: "claude-opus-4-1-20250805",
      routeReason: "sensitivity-restricted",
    });
  });

  it("menghormati model verified pilihan user untuk hosted non-RESTRICTED", () => {
    expect(
      route({
        target: "hosted",
        sensitivity: "INTERNAL",
        hostedProvider: "openrouter",
        hostedModel: "claude-opus-4-1-20250805",
      }),
    ).toEqual({
      model: "claude-opus-4-1-20250805",
      routeReason: "selected-hosted",
    });
  });

  it("RESTRICTED tetap memakai governed high-quality model meski user memilih model standar", () => {
    expect(
      route({
        target: "hosted",
        sensitivity: "RESTRICTED",
        hostedProvider: "openai",
        hostedModel: "gpt-5.6-terra",
      }),
    ).toEqual({
      model: "gpt-5.6-sol",
      routeReason: "sensitivity-restricted",
    });
  });

  it("menolak pasangan provider/model yang belum diverifikasi", () => {
    expect(() =>
      route({
        target: "hosted",
        sensitivity: "INTERNAL",
        hostedProvider: "openrouter",
        hostedModel: "gpt-5.6-terra",
      }),
    ).toThrow(/belum diverifikasi/u);
  });

  it("OpenAI mapping deterministik: Terra normal, Sol RESTRICTED", () => {
    expect(
      route({ target: "hosted", sensitivity: "PUBLIC", hostedProvider: "openai" }),
    ).toEqual({
      model: "gpt-5.6-terra",
      routeReason: "default-hosted",
    });
    expect(
      route({ target: "hosted", sensitivity: "RESTRICTED", hostedProvider: "openai" }),
    ).toEqual({
      model: "gpt-5.6-sol",
      routeReason: "sensitivity-restricted",
    });
  });
});
