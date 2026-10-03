import { describe, expect, it } from "vitest";
import {
  ProjectGoogleDriveIngestResponseSchema,
  type GoogleDriveSelectedFile,
  type ProjectGoogleDriveIngestResponse,
  type ProjectSourceRole,
} from "@ecorione/shared-schema";
import {
  GoogleDriveOperationError,
  ingestGoogleDriveSelection,
} from "./google-drive-ingest-batch";

function file(id: string, name: string): GoogleDriveSelectedFile {
  return { id, name, mimeType: "text/plain" };
}

function response(
  fileId: string,
  index: number,
  role: ProjectSourceRole,
): ProjectGoogleDriveIngestResponse {
  const hex = (index + 1).toString(16).padStart(64, "0");
  const artifactId = `art_${hex}`;
  return ProjectGoogleDriveIngestResponseSchema.parse({
    operationId: `op_drive_batch_${index + 1}`,
    projectId: "prj_personal",
    workspaceId: "ws_personal",
    fileId,
    fileName: `File ${index + 1}`,
    sourceMimeType: "text/plain",
    snapshotMimeType: "text/plain",
    artifact: {
      id: artifactId,
      path: `cas/${artifactId}`,
      description: `Google Drive: File ${index + 1}`,
      mimeType: "text/plain",
      sizeBytes: index + 1,
      scope: "personal",
      sensitivity: "RESTRICTED",
      syncClass: "LOCAL_ONLY",
    },
    source: {
      binding: {
        projectId: "prj_personal",
        workspaceId: "ws_personal",
        resourceType: "artifact",
        resourceId: artifactId,
        owner: "Artifact",
        role,
        createdAt: "2026-10-03T18:00:00.000Z",
      },
      availability: "AVAILABLE",
      metadata: { id: artifactId },
      unavailableReason: null,
    },
    state: "READY",
  });
}

describe("Google Drive multi-file ingest orchestration", () => {
  it("preserves successful files when another selected file fails", async () => {
    const files = [
      file("drive-file-1", "Alpha.txt"),
      file("drive-file-2", "Beta.txt"),
      file("drive-file-3", "Gamma.txt"),
    ];
    const calls: Array<{ fileId: string; role: ProjectSourceRole }> = [];

    const result = await ingestGoogleDriveSelection(
      files,
      "reference",
      async (fileId, role) => {
        calls.push({ fileId, role });
        if (fileId === "drive-file-2") {
          throw new Error("synthetic permission denied");
        }
        return response(fileId, fileId === "drive-file-1" ? 0 : 2, role);
      },
    );

    expect(calls).toEqual([
      { fileId: "drive-file-1", role: "reference" },
      { fileId: "drive-file-2", role: "reference" },
      { fileId: "drive-file-3", role: "reference" },
    ]);
    expect(result.successes.map((item) => item.fileId)).toEqual([
      "drive-file-1",
      "drive-file-3",
    ]);
    expect(result.failures).toEqual([
      {
        file: files[1],
        message: "synthetic permission denied",
        type: null,
      },
    ]);
    expect(result.feedback).toBe(
      "Google Drive: 2 snapshot tersimpan. 1 gagal — Beta.txt: synthetic permission denied",
    );
  });

  it("does not retry or duplicate successful files after a partial failure", async () => {
    const files = [
      file("drive-file-a", "A.txt"),
      file("drive-file-b", "B.txt"),
      file("drive-file-c", "C.txt"),
    ];
    const callCounts = new Map<string, number>();

    const result = await ingestGoogleDriveSelection(files, "source", async (fileId, role) => {
      callCounts.set(fileId, (callCounts.get(fileId) ?? 0) + 1);
      if (fileId === "drive-file-b") throw new Error("synthetic rate limit");
      return response(fileId, fileId === "drive-file-a" ? 0 : 2, role);
    });

    expect(Object.fromEntries(callCounts)).toEqual({
      "drive-file-a": 1,
      "drive-file-b": 1,
      "drive-file-c": 1,
    });
    expect(result.successes).toHaveLength(2);
    expect(result.failures).toHaveLength(1);
  });

  it("stops after reconnect-required while preserving earlier successes", async () => {
    const files = [
      file("drive-file-r1", "Ready.txt"),
      file("drive-file-r2", "Expired.txt"),
      file("drive-file-r3", "Skipped.txt"),
      file("drive-file-r4", "Also skipped.txt"),
    ];
    const calls: string[] = [];

    const result = await ingestGoogleDriveSelection(files, "source", async (fileId, role) => {
      calls.push(fileId);
      if (fileId === "drive-file-r2") {
        throw new GoogleDriveOperationError(
          "GOOGLE_DRIVE_RECONNECT_REQUIRED",
          "Google Drive authorization perlu dihubungkan ulang.",
        );
      }
      return response(fileId, 0, role);
    });

    expect(calls).toEqual(["drive-file-r1", "drive-file-r2"]);
    expect(result.successes.map((item) => item.fileId)).toEqual(["drive-file-r1"]);
    expect(result.failures).toEqual([
      {
        file: files[1],
        message: "Google Drive authorization perlu dihubungkan ulang.",
        type: "GOOGLE_DRIVE_RECONNECT_REQUIRED",
      },
    ]);
    expect(result.skipped.map((item) => item.id)).toEqual([
      "drive-file-r3",
      "drive-file-r4",
    ]);
    expect(result.reconnectRequired).toBe(true);
    expect(result.feedback).toBe(
      "Google Drive: 1 snapshot tersimpan. 1 gagal — Expired.txt: Google Drive authorization perlu dihubungkan ulang. 2 belum dicoba karena Google Drive perlu dihubungkan ulang.",
    );
  });

  it("reports a clean all-success batch", async () => {
    const files = [file("drive-file-x", "X.txt"), file("drive-file-y", "Y.txt")];

    const result = await ingestGoogleDriveSelection(files, "source", async (fileId, role) =>
      response(fileId, fileId === "drive-file-x" ? 0 : 1, role),
    );

    expect(result.successes).toHaveLength(2);
    expect(result.failures).toEqual([]);
    expect(result.feedback).toBe("Google Drive: 2 snapshot tersimpan.");
  });

  it("reports all failures without inventing successful snapshots", async () => {
    const files = [file("drive-file-m", "M.txt"), file("drive-file-n", "N.txt")];

    const result = await ingestGoogleDriveSelection(files, "source", async (fileId) => {
      throw new Error(`blocked ${fileId}`);
    });

    expect(result.successes).toEqual([]);
    expect(result.failures.map((failure) => failure.file.id)).toEqual([
      "drive-file-m",
      "drive-file-n",
    ]);
    expect(result.feedback).toBe(
      "Google Drive: 0 snapshot tersimpan. 2 gagal — M.txt: blocked drive-file-m; N.txt: blocked drive-file-n",
    );
  });

  it("uses a deterministic fallback for non-Error failures", async () => {
    const result = await ingestGoogleDriveSelection(
      [file("drive-file-z", "Z.txt")],
      "source",
      async () => Promise.reject("synthetic non-error"),
    );

    expect(result.successes).toEqual([]);
    expect(result.failures).toMatchObject([
      {
        file: { id: "drive-file-z", name: "Z.txt" },
        message: "ingestion gagal",
      },
    ]);
    expect(result.feedback).toBe(
      "Google Drive: 0 snapshot tersimpan. 1 gagal — Z.txt: ingestion gagal",
    );
  });
});
