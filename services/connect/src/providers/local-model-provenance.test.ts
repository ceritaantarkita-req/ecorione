import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_PROVENANCE_TTL_MS,
  LocalModelDigestMismatchError,
  LocalModelProvenanceResolver,
  provenanceBaseUrl,
  resolveLocalModelProvenance,
  type FetchLike,
} from "./local-model-provenance.js";

const DIGEST_A = `sha256:${"a".repeat(64)}`;
const DIGEST_B = `sha256:${"b".repeat(64)}`;

function tagsResponse(models: unknown): FetchLike {
  return () =>
    Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ models }) });
}

const unreachable: FetchLike = () => Promise.reject(new Error("ECONNREFUSED"));

describe("provenanceBaseUrl", () => {
  it("membuang sufiks /v1 karena API native ada di root", () => {
    expect(provenanceBaseUrl("http://127.0.0.1:11434/v1")).toBe("http://127.0.0.1:11434");
    expect(provenanceBaseUrl("http://127.0.0.1:11434/v1/")).toBe("http://127.0.0.1:11434");
    expect(provenanceBaseUrl("http://127.0.0.1:11434")).toBe("http://127.0.0.1:11434");
  });

  it("membiarkan prefix lain apa adanya", () => {
    expect(provenanceBaseUrl("http://gpu.lan:8000/openai/v1")).toBe(
      "http://gpu.lan:8000/openai",
    );
    expect(provenanceBaseUrl("bukan-url")).toBeNull();
  });
});

describe("resolveLocalModelProvenance", () => {
  it("memverifikasi deklarasi operator terhadap digest yang dilaporkan runtime", async () => {
    const result = await resolveLocalModelProvenance({
      baseUrl: "http://127.0.0.1:11434/v1",
      modelTag: "qwen3:8b",
      declaredDigest: DIGEST_A,
      fetchImpl: tagsResponse([{ name: "qwen3:8b", digest: DIGEST_A }]),
    });
    expect(result).toMatchObject({ status: "verified", digest: DIGEST_A });
  });

  it("mengadopsi digest runtime ketika operator tidak mendeklarasikan apa pun", async () => {
    const result = await resolveLocalModelProvenance({
      baseUrl: "http://127.0.0.1:11434/v1",
      modelTag: "qwen3:8b",
      declaredDigest: null,
      fetchImpl: tagsResponse([{ name: "qwen3:8b", digest: DIGEST_A.slice("sha256:".length) }]),
    });
    expect(result).toMatchObject({ status: "resolved", digest: DIGEST_A });
  });

  it("gagal tertutup ketika runtime melayani model lain dari yang dideklarasikan", async () => {
    await expect(
      resolveLocalModelProvenance({
        baseUrl: "http://127.0.0.1:11434/v1",
        modelTag: "qwen3:8b",
        declaredDigest: DIGEST_A,
        fetchImpl: tagsResponse([{ name: "qwen3:8b", digest: DIGEST_B }]),
      }),
    ).rejects.toBeInstanceOf(LocalModelDigestMismatchError);
  });

  it("melaporkan declared-unverified — bukan pinned — saat runtime tanpa provenance API", async () => {
    // Inti perbaikan audit S2-5: ini keadaan yang dulu dilaporkan sebagai `pinned`.
    const result = await resolveLocalModelProvenance({
      baseUrl: "http://127.0.0.1:11434/v1",
      modelTag: "qwen3:8b",
      declaredDigest: DIGEST_A,
      fetchImpl: unreachable,
    });
    expect(result.status).toBe("declared-unverified");
    expect(result.digest).toBe(DIGEST_A);
    expect(result.detail).toBeDefined();
  });

  it("melaporkan unverified ketika tidak ada deklarasi maupun provenance", async () => {
    const result = await resolveLocalModelProvenance({
      baseUrl: "http://127.0.0.1:11434/v1",
      modelTag: "qwen3:8b",
      declaredDigest: null,
      fetchImpl: unreachable,
    });
    expect(result).toMatchObject({ status: "unverified", digest: null });
  });

  it("mencocokkan selector tanpa tag dengan normalisasi default runtime", async () => {
    const result = await resolveLocalModelProvenance({
      baseUrl: "http://127.0.0.1:11434/v1",
      modelTag: "gemma4",
      declaredDigest: null,
      fetchImpl: tagsResponse([{ name: "gemma4:latest", digest: DIGEST_B }]), // naming-gate:allow
    });
    expect(result).toMatchObject({ status: "resolved", digest: DIGEST_B });
  });

  it("tidak menganggap model yang tidak dilaporkan sebagai terverifikasi", async () => {
    const result = await resolveLocalModelProvenance({
      baseUrl: "http://127.0.0.1:11434/v1",
      modelTag: "qwen3:8b",
      declaredDigest: null,
      fetchImpl: tagsResponse([{ name: "model-lain", digest: DIGEST_A }]),
    });
    expect(result.status).toBe("unverified");
  });

  it("menolak digest yang bentuknya tidak valid dari runtime", async () => {
    const result = await resolveLocalModelProvenance({
      baseUrl: "http://127.0.0.1:11434/v1",
      modelTag: "qwen3:8b",
      declaredDigest: null,
      fetchImpl: tagsResponse([{ name: "qwen3:8b", digest: "bukan-digest" }]),
    });
    expect(result.status).toBe("unverified");
  });

  it("tidak menganggap respons non-OK sebagai provenance", async () => {
    const result = await resolveLocalModelProvenance({
      baseUrl: "http://127.0.0.1:11434/v1",
      modelTag: "qwen3:8b",
      declaredDigest: null,
      fetchImpl: () =>
        Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) }),
    });
    expect(result.status).toBe("unverified");
  });
});

describe("LocalModelProvenanceResolver", () => {
  const input = {
    baseUrl: "http://127.0.0.1:11434/v1",
    modelTag: "qwen3:8b",
    declaredDigest: null,
  };

  it("menahan panggilan berulang selama TTL", async () => {
    const fetchImpl = vi.fn(tagsResponse([{ name: "qwen3:8b", digest: DIGEST_A }]));
    let clock = 1_000;
    const resolver = new LocalModelProvenanceResolver(
      DEFAULT_PROVENANCE_TTL_MS,
      fetchImpl as unknown as FetchLike,
      () => clock,
    );

    await resolver.resolve(input);
    await resolver.resolve(input);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    // `ollama pull` bisa mengganti isi tag kapan saja — itu justru yang dijaga, jadi
    // cache harus kedaluwarsa, bukan disimpan selamanya.
    clock += DEFAULT_PROVENANCE_TTL_MS + 1;
    await resolver.resolve(input);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("tidak memakai ulang hasil ketika boundary identitas berubah", async () => {
    const fetchImpl = vi.fn(tagsResponse([{ name: "qwen3:8b", digest: DIGEST_A }]));
    const resolver = new LocalModelProvenanceResolver(
      DEFAULT_PROVENANCE_TTL_MS,
      fetchImpl as unknown as FetchLike,
      () => 1_000,
    );
    await resolver.resolve(input);
    await resolver.resolve({ ...input, modelTag: "model-lain" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
