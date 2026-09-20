import { describe, expect, it } from "vitest";
import {
  GOVERNED_HOSTED_MODEL,
  hostedModelCatalog,
  hostedModelSupported,
} from "./hosted-model-catalog.js";

describe("hosted model catalog", () => {
  it("exposes only verified provider/model pairs", () => {
    expect(hostedModelCatalog("openrouter").map((model) => model.id)).toEqual([
      "claude-sonnet-4-5-20250929",
      "claude-opus-4-1-20250805",
    ]);
    expect(hostedModelCatalog("openai").map((model) => model.id)).toEqual([
      "gpt-5.6-terra",
      "gpt-5.6-sol",
    ]);
  });

  it("always permits governed routing and rejects cross-provider model pairs", () => {
    expect(hostedModelSupported("openrouter", GOVERNED_HOSTED_MODEL)).toBe(true);
    expect(hostedModelSupported("openrouter", "claude-sonnet-4-5-20250929")).toBe(true);
    expect(hostedModelSupported("openrouter", "gpt-5.6-terra")).toBe(false);
    expect(hostedModelSupported("openai", "claude-sonnet-4-5-20250929")).toBe(false);
  });
});
