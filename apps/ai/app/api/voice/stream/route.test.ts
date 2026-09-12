import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

let originalHubUrl: string | undefined;
let originalToken: string | undefined;

beforeEach(() => {
  originalHubUrl = process.env.ECORIONE_HUB_URL;
  originalToken = process.env.ECORIONE_INTERNAL_TOKEN;
  process.env.ECORIONE_HUB_URL = "http://hub.local";
  process.env.ECORIONE_INTERNAL_TOKEN = "voice-test-token";
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalHubUrl === undefined) delete process.env.ECORIONE_HUB_URL;
  else process.env.ECORIONE_HUB_URL = originalHubUrl;
  if (originalToken === undefined) delete process.env.ECORIONE_INTERNAL_TOKEN;
  else process.env.ECORIONE_INTERNAL_TOKEN = originalToken;
});

describe("GET /api/voice/stream", () => {
  it("meneruskan SSE ke Hub dengan bearer, no-store, dan redirect fail-closed", async () => {
    const fetchMock = vi.fn(
      async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
        expect(String(input)).toBe(
          "http://hub.local/v1/voice/stream?sessionId=sess_voice_test&after=4",
        );
        expect(init?.cache).toBe("no-store");
        expect(init?.redirect).toBe("error");
        expect(init?.headers).toEqual({
          accept: "text/event-stream",
          authorization: "Bearer voice-test-token",
        });
        return new Response("data: ok\n\n", {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        });
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new Request("http://ai.local/api/voice/stream?sessionId=sess_voice_test&after=4"),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "text/event-stream; charset=utf-8",
    );
    expect(await response.text()).toBe("data: ok\n\n");
  });

  it("kegagalan owner/redirect fetch menjadi 502 eksplisit", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("redirect blocked");
      }),
    );

    const response = await GET(
      new Request("http://ai.local/api/voice/stream?sessionId=sess_voice_test&after=-1"),
    );

    expect(response.status).toBe(502);
    expect(((await response.json()) as { error: { type: string } }).error.type).toBe(
      "UPSTREAM_UNAVAILABLE",
    );
  });

  it("query invalid ditolak sebelum memanggil Hub", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new Request("http://ai.local/api/voice/stream?sessionId=invalid"),
    );

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
