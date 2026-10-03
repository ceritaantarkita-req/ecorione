import { describe, expect, it } from "vitest";
import {
  GOOGLE_DRIVE_FILE_SCOPE,
  GoogleDriveConnectionStatusSchema,
  GoogleDriveFileFetchRequestSchema,
  GoogleDriveFileFetchResponseSchema,
  GoogleDriveOAuthCallbackRequestSchema,
  GoogleDriveOAuthStartRequestSchema,
  GoogleDrivePickerSelectionSchema,
} from "./google-drive.js";

describe("Google Drive shared contracts", () => {
  it("locks the least-privilege Drive scope", () => {
    expect(GOOGLE_DRIVE_FILE_SCOPE).toBe("https://www.googleapis.com/auth/drive.file");
  });

  it("accepts bounded concrete file selections", () => {
    expect(
      GoogleDrivePickerSelectionSchema.parse({
        files: [
          {
            id: "1AbCdEf_-123",
            name: "Quarterly plan",
            mimeType: "application/vnd.google-apps.document",
          },
        ],
      }),
    ).toMatchObject({ files: [{ id: "1AbCdEf_-123" }] });

    expect(() => GoogleDrivePickerSelectionSchema.parse({ files: [] })).toThrow();
    expect(() =>
      GoogleDrivePickerSelectionSchema.parse({
        files: Array.from({ length: 21 }, (_, index) => ({
          id: `file-${String(index)}`,
          name: `File ${String(index)}`,
          mimeType: "text/plain",
        })),
      }),
    ).toThrow();
  });

  it("keeps OAuth return navigation same-origin", () => {
    expect(
      GoogleDriveOAuthStartRequestSchema.parse({
        workspaceId: "ws_personal",
        returnPath: "/projects/prj_personal",
      }),
    ).toMatchObject({ workspaceId: "ws_personal" });
    expect(() =>
      GoogleDriveOAuthStartRequestSchema.parse({
        workspaceId: "ws_personal",
        returnPath: "//evil.example/path",
      }),
    ).toThrow();
  });

  it("validates callback code/error exclusivity", () => {
    expect(
      GoogleDriveOAuthCallbackRequestSchema.parse({
        code: "authorization-code",
        state: "s".repeat(43),
      }),
    ).toMatchObject({ code: "authorization-code" });
    expect(() =>
      GoogleDriveOAuthCallbackRequestSchema.parse({
        code: "authorization-code",
        error: "access_denied",
        state: "s".repeat(43),
      }),
    ).toThrow();
    expect(() =>
      GoogleDriveOAuthCallbackRequestSchema.parse({
        state: "s".repeat(43),
      }),
    ).toThrow();
  });

  it("bounds selected-file fetch contracts to Personal Workspace and 20 MiB", () => {
    expect(
      GoogleDriveFileFetchRequestSchema.parse({
        workspaceId: "ws_personal",
        fileId: "1AbCdEf_-123",
      }),
    ).toMatchObject({ fileId: "1AbCdEf_-123" });
    expect(() =>
      GoogleDriveFileFetchRequestSchema.parse({
        workspaceId: "ws_other",
        fileId: "1AbCdEf_-123",
      }),
    ).toThrow();

    expect(
      GoogleDriveFileFetchResponseSchema.parse({
        fileId: "1AbCdEf_-123",
        name: "Quarterly plan.md",
        sourceMimeType: "application/vnd.google-apps.document",
        snapshotMimeType: "text/markdown",
        modifiedTime: "2026-10-03T00:00:00.000Z",
        sizeBytes: 12,
        contentBase64: "SGVsbG8gd29ybGQh",
      }),
    ).toMatchObject({ snapshotMimeType: "text/markdown" });
    expect(() =>
      GoogleDriveFileFetchResponseSchema.parse({
        fileId: "1AbCdEf_-123",
        name: "oversize.bin",
        sourceMimeType: "application/octet-stream",
        snapshotMimeType: "application/octet-stream",
        modifiedTime: null,
        sizeBytes: 20 * 1024 * 1024 + 1,
        contentBase64: "AA==",
      }),
    ).toThrow();
  });

  it("never includes token material in connection status", () => {
    const status = GoogleDriveConnectionStatusSchema.parse({
      provider: "google-drive",
      workspaceId: "ws_personal",
      available: true,
      connected: true,
      pickerAvailable: true,
      scope: GOOGLE_DRIVE_FILE_SCOPE,
      updatedAt: "2026-10-03T00:00:00.000Z",
    });
    expect(Object.keys(status).sort()).toEqual([
      "available",
      "connected",
      "pickerAvailable",
      "provider",
      "scope",
      "updatedAt",
      "workspaceId",
    ]);
  });
});
