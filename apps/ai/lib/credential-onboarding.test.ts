import { describe, expect, it } from "vitest";
import { credentialSaveReady } from "./credential-onboarding";

describe("credentialSaveReady", () => {
  it("menolak secret kosong", () => {
    expect(
      credentialSaveReady({
        secret: "",
        provider: "openai",
        revision: 1,
        connectionTestReady: true,
        test: { provider: "openai", revision: 1, pass: true },
      }),
    ).toBe(false);
  });

  it("mengizinkan credential-only provider disimpan tanpa klaim connection test", () => {
    expect(
      credentialSaveReady({
        secret: "secret",
        provider: "kimi",
        revision: 2,
        connectionTestReady: false,
        test: null,
      }),
    ).toBe(true);
  });

  it("mewajibkan PASS yang cocok untuk provider test-ready", () => {
    expect(
      credentialSaveReady({
        secret: "secret",
        provider: "openai",
        revision: 3,
        connectionTestReady: true,
        test: null,
      }),
    ).toBe(false);

    expect(
      credentialSaveReady({
        secret: "secret",
        provider: "openai",
        revision: 3,
        connectionTestReady: true,
        test: { provider: "openai", revision: 3, pass: true },
      }),
    ).toBe(true);
  });

  it("menolak test stale, provider berbeda, atau test gagal", () => {
    for (const test of [
      { provider: "openai", revision: 2, pass: true },
      { provider: "anthropic", revision: 3, pass: true },
      { provider: "openai", revision: 3, pass: false },
    ]) {
      expect(
        credentialSaveReady({
          secret: "secret",
          provider: "openai",
          revision: 3,
          connectionTestReady: true,
          test,
        }),
      ).toBe(false);
    }
  });
});
