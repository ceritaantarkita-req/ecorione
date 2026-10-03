import { describe, expect, it } from "vitest";
import {
  GOOGLE_DRIVE_API_ORIGIN,
  GoogleDriveSource,
  GoogleDriveSourceError,
  type GoogleDriveApiTransport,
} from "./google-drive-source.js";
import { GoogleDriveOAuthUpstreamError } from "./google-drive-token.js";

function bytes(value: string): Uint8Array {
  return Buffer.from(value, "utf8");
}

function source(options?: {
  readonly metadata?: Record<string, unknown>;
  readonly content?: Uint8Array;
  readonly metadataStatus?: number;
  readonly contentStatus?: number;
  readonly refreshToken?: string | undefined;
}) {
  const calls: Array<{ url: string; accessToken: string; maxBytes: number }> = [];
  const metadata = options?.metadata ?? {
    id: "file-123",
    name: "Quarterly plan.pdf",
    mimeType: "application/pdf",
    size: "11",
    modifiedTime: "2026-10-03T01:00:00.000Z",
    capabilities: { canDownload: true },
  };
  const transport: GoogleDriveApiTransport = async (url, accessToken, _timeoutMs, maxBytes) => {
    calls.push({ url: url.toString(), accessToken, maxBytes });
    if (calls.length === 1) {
      return {
        statusCode: options?.metadataStatus ?? 200,
        body: bytes(JSON.stringify(metadata)),
      };
    }
    return {
      statusCode: options?.contentStatus ?? 200,
      body: options?.content ?? bytes("hello world"),
    };
  };
  const refreshCalls: string[] = [];
  const adapter = new GoogleDriveSource({
    vault: {
      get() {
        return options?.refreshToken === undefined
          ? "refresh-token-private-123456"
          : options.refreshToken;
      },
    },
    oauthClient: {
      async refreshAccessToken(refreshToken) {
        refreshCalls.push(refreshToken);
        return {
          accessToken: "access-token-ephemeral",
          expiresInSeconds: 3600,
          scope: "https://www.googleapis.com/auth/drive.file",
        };
      },
    },
    transport,
  });
  return { adapter, calls, refreshCalls };
}

describe("GoogleDriveSource", () => {
  it("downloads an explicitly selected blob file through fixed Drive endpoints", async () => {
    const { adapter, calls, refreshCalls } = source();
    const result = await adapter.fetchSelectedFile("ws_personal", "file-123");

    expect(result).toMatchObject({
      fileId: "file-123",
      name: "Quarterly plan.pdf",
      sourceMimeType: "application/pdf",
      snapshotMimeType: "application/pdf",
      sizeBytes: 11,
    });
    expect(Buffer.from(result.contentBase64, "base64").toString("utf8")).toBe("hello world");
    expect(refreshCalls).toEqual(["refresh-token-private-123456"]);
    expect(calls).toHaveLength(2);
    expect(new URL(calls[0]!.url).origin).toBe(GOOGLE_DRIVE_API_ORIGIN);
    expect(new URL(calls[0]!.url).pathname).toBe("/drive/v3/files/file-123");
    expect(new URL(calls[0]!.url).searchParams.get("supportsAllDrives")).toBe("true");
    expect(new URL(calls[1]!.url).searchParams.get("alt")).toBe("media");
    expect(calls.every((call) => call.accessToken === "access-token-ephemeral")).toBe(true);
    expect(calls.every((call) => !call.url.includes("access-token-ephemeral"))).toBe(true);
  });

  it("exports supported Google-native files to deterministic snapshot formats", async () => {
    const cases = [
      {
        sourceMimeType: "application/vnd.google-apps.document",
        snapshotMimeType: "text/markdown",
      },
      {
        sourceMimeType: "application/vnd.google-apps.spreadsheet",
        snapshotMimeType: "application/pdf",
      },
      {
        sourceMimeType: "application/vnd.google-apps.presentation",
        snapshotMimeType: "text/plain",
      },
      {
        sourceMimeType: "application/vnd.google-apps.drawing",
        snapshotMimeType: "application/pdf",
      },
    ] as const;

    for (const candidate of cases) {
      const { adapter, calls } = source({
        metadata: {
          id: "file-123",
          name: "Native file",
          mimeType: candidate.sourceMimeType,
          modifiedTime: "2026-10-03T01:00:00.000Z",
          capabilities: { canDownload: true },
        },
      });
      const result = await adapter.fetchSelectedFile("ws_personal", "file-123");
      expect(result.snapshotMimeType).toBe(candidate.snapshotMimeType);
      const download = new URL(calls[1]!.url);
      expect(download.pathname).toBe("/drive/v3/files/file-123/export");
      expect(download.searchParams.get("mimeType")).toBe(candidate.snapshotMimeType);
      expect(download.searchParams.has("alt")).toBe(false);
    }
  });

  it("fails closed for unsupported Google-native types instead of incomplete snapshots", async () => {
    const { adapter } = source({
      metadata: {
        id: "file-123",
        name: "Folder",
        mimeType: "application/vnd.google-apps.folder",
        capabilities: { canDownload: true },
      },
    });
    await expect(adapter.fetchSelectedFile("ws_personal", "file-123")).rejects.toMatchObject({
      code: "GOOGLE_DRIVE_FILE_UNSUPPORTED",
      statusCode: 415,
    });
  });

  it("honors Drive download restrictions before fetching content", async () => {
    const { adapter, calls } = source({
      metadata: {
        id: "file-123",
        name: "Restricted.pdf",
        mimeType: "application/pdf",
        size: "100",
        capabilities: { canDownload: false },
      },
    });
    await expect(adapter.fetchSelectedFile("ws_personal", "file-123")).rejects.toMatchObject({
      code: "GOOGLE_DRIVE_FILE_DOWNLOAD_DENIED",
      statusCode: 403,
    });
    expect(calls).toHaveLength(1);
  });

  it("rejects declared blob size above the Artifact ceiling before content download", async () => {
    const { adapter, calls } = source({
      metadata: {
        id: "file-123",
        name: "Huge.bin",
        mimeType: "application/octet-stream",
        size: String(20 * 1024 * 1024 + 1),
        capabilities: { canDownload: true },
      },
    });
    await expect(adapter.fetchSelectedFile("ws_personal", "file-123")).rejects.toMatchObject({
      code: "GOOGLE_DRIVE_FILE_TOO_LARGE",
      statusCode: 413,
    });
    expect(calls).toHaveLength(1);
  });

  it("requires an existing encrypted refresh-token connection", async () => {
    const calls: string[] = [];
    const adapter = new GoogleDriveSource({
      vault: { get: () => undefined },
      oauthClient: {
        async refreshAccessToken() {
          calls.push("refresh");
          throw new Error("must not run");
        },
      },
      transport: async () => {
        calls.push("transport");
        throw new Error("must not run");
      },
    });
    await expect(adapter.fetchSelectedFile("ws_personal", "file-123")).rejects.toMatchObject({
      code: "GOOGLE_DRIVE_NOT_CONNECTED",
      statusCode: 409,
    });
    expect(calls).toEqual([]);
  });

  it("sanitizes OAuth refresh failures into source-boundary errors", async () => {
    const rejected = new GoogleDriveSource({
      vault: { get: () => "refresh-token-private-123456" },
      oauthClient: {
        async refreshAccessToken() {
          throw new GoogleDriveOAuthUpstreamError(
            502,
            "GOOGLE_DRIVE_OAUTH_REJECTED",
            "private invalid_grant detail",
          );
        },
      },
      transport: async () => {
        throw new Error("must not run");
      },
    });
    await expect(
      rejected.fetchSelectedFile("ws_personal", "file-123"),
    ).rejects.toMatchObject({
      code: "GOOGLE_DRIVE_NOT_CONNECTED",
      statusCode: 409,
      message: "Google Drive authorization perlu dihubungkan ulang.",
    });

    const timeout = new GoogleDriveSource({
      vault: { get: () => "refresh-token-private-123456" },
      oauthClient: {
        async refreshAccessToken() {
          throw new GoogleDriveOAuthUpstreamError(
            504,
            "GOOGLE_DRIVE_OAUTH_TIMEOUT",
            "private timeout detail",
          );
        },
      },
      transport: async () => {
        throw new Error("must not run");
      },
    });
    await expect(timeout.fetchSelectedFile("ws_personal", "file-123")).rejects.toMatchObject({
      code: "GOOGLE_DRIVE_API_TIMEOUT",
      statusCode: 504,
    });
  });

  it("rejects non-Personal Workspace and upstream identity mismatch", async () => {
    const first = source();
    await expect(
      first.adapter.fetchSelectedFile("ws_other", "file-123"),
    ).rejects.toBeInstanceOf(GoogleDriveSourceError);

    const second = source({
      metadata: {
        id: "different-file",
        name: "Unexpected.pdf",
        mimeType: "application/pdf",
        size: "10",
        capabilities: { canDownload: true },
      },
    });
    await expect(
      second.adapter.fetchSelectedFile("ws_personal", "file-123"),
    ).rejects.toMatchObject({
      code: "GOOGLE_DRIVE_API_INVALID_RESPONSE",
      statusCode: 502,
    });
  });
});
