import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FileRuntimeSettings, MutableLocalModelTagError } from "./runtime-settings.js";

const defaults = {
  hostedProvider: "anthropic" as const,
  localRuntime: "openai-compatible" as const,
  localBaseUrl: "http://127.0.0.1:11434/v1",
  localModelTag: "model-a",
  hostedCallsEnabled: true,
  defaultChatTarget: "local" as const,
};

describe("FileRuntimeSettings", () => {
  it("memiliki revision monotonic dan file owner mode tanpa secret", () => {
    const dir = mkdtempSync(join(tmpdir(), "ecorione-settings-"));
    const path = join(dir, "settings.json");
    const store = new FileRuntimeSettings(path, defaults);
    expect(store.get()).toMatchObject({
      revision: 0,
      settings: { ...defaults, hostedModel: "governed" },
    });
    const next = store.update({
      hostedProvider: "openai",
      localModelTag: "model-b",
      defaultChatTarget: "hosted",
    });
    expect(next.revision).toBe(1);
    expect(next.settings.hostedProvider).toBe("openai");
    expect(next.settings.defaultChatTarget).toBe("hosted");
    expect(readFileSync(path, "utf8")).not.toContain("API_KEY");
  });

  it("migrasi baca file v1 lama memakai default chat target local", () => {
    const dir = mkdtempSync(join(tmpdir(), "ecorione-settings-"));
    const path = join(dir, "settings.json");
    writeFileSync(
      path,
      JSON.stringify({
        version: 1,
        revision: 7,
        settings: {
          hostedProvider: "anthropic",
          localRuntime: "openai-compatible",
          localBaseUrl: "http://127.0.0.1:11434/v1",
          localModelTag: "model-a",
          hostedCallsEnabled: true,
        },
      }),
      "utf8",
    );

    const store = new FileRuntimeSettings(path, defaults);
    expect(store.get()).toMatchObject({
      revision: 7,
      settings: { defaultChatTarget: "local", hostedModel: "governed" },
    });
  });

  it("menyimpan model hosted verified dan reset ke governed ketika provider berubah", () => {
    const dir = mkdtempSync(join(tmpdir(), "ecorione-settings-"));
    const store = new FileRuntimeSettings(join(dir, "settings.json"), defaults);

    expect(
      store.update({ hostedModel: "claude-opus-4-1-20250805" }).settings.hostedModel,
    ).toBe("claude-opus-4-1-20250805");

    const switched = store.update({ hostedProvider: "openai" });
    expect(switched.settings).toMatchObject({
      hostedProvider: "openai",
      hostedModel: "governed",
    });

    expect(() =>
      store.update({ hostedModel: "claude-sonnet-4-5-20250929" }),
    ).toThrow(/belum diverifikasi/u);
    expect(
      store.update({ hostedModel: "gpt-5.6-sol" }).settings.hostedModel,
    ).toBe("gpt-5.6-sol");
  });

  it("menolak credential/fragment dan protocol non-http pada local runtime URL", () => {
    const dir = mkdtempSync(join(tmpdir(), "ecorione-settings-"));
    const store = new FileRuntimeSettings(join(dir, "settings.json"), defaults);
    expect(() => store.update({ localBaseUrl: "http://user:pass@host/v1" })).toThrow();
    expect(() => store.update({ localBaseUrl: "file:///tmp/model" })).toThrow();
  });

  it("menolak localBaseUrl yang keluar dari loopback/private", () => {
    // Audit 2026-09-14 S1-3: PUT lintas-origin mengubah localBaseUrl jadi
    // https://evil.example/v1 dan diterima. Host publik sekarang ditolak di skema.
    const dir = mkdtempSync(join(tmpdir(), "ecorione-settings-"));
    const store = new FileRuntimeSettings(join(dir, "settings.json"), defaults);
    expect(() => store.update({ localBaseUrl: "https://evil.example/v1" })).toThrow(
      /loopback\/private/u,
    );
    expect(() => store.update({ localBaseUrl: "https://8.8.8.8/v1" })).toThrow();
    expect(store.get().settings.localBaseUrl).toBe("http://127.0.0.1:11434/v1");
  });

  it("meloloskan LAN, container, dan host.docker.internal", () => {
    const dir = mkdtempSync(join(tmpdir(), "ecorione-settings-"));
    const store = new FileRuntimeSettings(join(dir, "settings.json"), defaults);
    for (const url of [
      "http://192.168.1.50:11434/v1",
      "http://host.docker.internal:11434/v1",
      "http://ollama:11434/v1",
      "http://[::1]:11434/v1",
    ]) {
      expect(store.update({ localBaseUrl: url }).settings.localBaseUrl).toBe(url);
    }
  });

  it("menolak tag model lokal yang mutable tanpa digest terpin", () => {
    // Audit 2026-09-14 S2-4: W13 menambah digest tapi tetap tidak menolak alias lokal
    // yang mutable, jadi nama model di evidence tidak mengikat apa pun.
    const dir = mkdtempSync(join(tmpdir(), "ecorione-settings-"));
    const store = new FileRuntimeSettings(join(dir, "settings.json"), defaults);
    const mutableTag = "gemma4:latest"; // naming-gate:allow
    expect(() => store.update({ localModelTag: mutableTag })).toThrow(
      MutableLocalModelTagError,
    );
    expect(store.get().settings.localModelTag).toBe("model-a");
  });

  it("meloloskan alias mutable ketika digest ikut dinyatakan", () => {
    const dir = mkdtempSync(join(tmpdir(), "ecorione-settings-"));
    const store = new FileRuntimeSettings(join(dir, "settings.json"), defaults);
    const next = store.update({
      localModelTag: "gemma4:latest", // naming-gate:allow
      localModelDigest: "a".repeat(64),
    });
    expect(next.settings.localModelDigest).toBe(`sha256:${"a".repeat(64)}`);
  });

  it("tetap bisa membaca instalasi lama yang terlanjur menyimpan alias mutable", () => {
    // Gerbang sengaja hanya di jalur mutasi: file lama harus tetap bisa di-boot dan
    // terbaca sebagai tidak-terpin, bukan membuat Connect gagal start setelah upgrade.
    const dir = mkdtempSync(join(tmpdir(), "ecorione-settings-"));
    const path = join(dir, "settings.json");
    writeFileSync(
      path,
      JSON.stringify({
        version: 1,
        revision: 3,
        settings: {
          ...defaults,
          localModelTag: "gemma4:latest", // naming-gate:allow
          localModelDigest: null,
        },
      }),
      "utf8",
    );
    const store = new FileRuntimeSettings(path, defaults);
    expect(store.get().settings.localModelDigest ?? null).toBeNull();
  });

  it("menghormati opt-out operator yang eksplisit", () => {
    const dir = mkdtempSync(join(tmpdir(), "ecorione-settings-"));
    const store = new FileRuntimeSettings(join(dir, "settings.json"), defaults);
    const prior = process.env.ECORIONE_LOCAL_BASE_URL_ALLOW_PUBLIC;
    process.env.ECORIONE_LOCAL_BASE_URL_ALLOW_PUBLIC = "1";
    try {
      expect(
        store.update({ localBaseUrl: "https://gpu.example/v1" }).settings.localBaseUrl,
      ).toBe("https://gpu.example/v1");
    } finally {
      if (prior === undefined) delete process.env.ECORIONE_LOCAL_BASE_URL_ALLOW_PUBLIC;
      else process.env.ECORIONE_LOCAL_BASE_URL_ALLOW_PUBLIC = prior;
    }
  });
});
