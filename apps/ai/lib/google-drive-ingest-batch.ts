import type {
  GoogleDriveSelectedFile,
  ProjectGoogleDriveIngestResponse,
  ProjectSourceRole,
} from "@ecorione/shared-schema";

export interface GoogleDriveBatchFailure {
  readonly file: GoogleDriveSelectedFile;
  readonly message: string;
}

export interface GoogleDriveBatchResult {
  readonly successes: readonly ProjectGoogleDriveIngestResponse[];
  readonly failures: readonly GoogleDriveBatchFailure[];
  readonly feedback: string;
}

export async function ingestGoogleDriveSelection(
  files: readonly GoogleDriveSelectedFile[],
  role: ProjectSourceRole,
  ingest: (
    fileId: string,
    role: ProjectSourceRole,
  ) => Promise<ProjectGoogleDriveIngestResponse>,
): Promise<GoogleDriveBatchResult> {
  const successes: ProjectGoogleDriveIngestResponse[] = [];
  const failures: GoogleDriveBatchFailure[] = [];

  for (const file of files) {
    try {
      successes.push(await ingest(file.id, role));
    } catch (error) {
      failures.push({
        file,
        message: error instanceof Error ? error.message : "ingestion gagal",
      });
    }
  }

  return {
    successes,
    failures,
    feedback: [
      `Google Drive: ${String(successes.length)} snapshot tersimpan.`,
      failures.length === 0
        ? ""
        : `${String(failures.length)} gagal — ${failures
            .map((failure) => `${failure.file.name}: ${failure.message}`)
            .join("; ")}`,
    ]
      .filter((part) => part.length > 0)
      .join(" "),
  };
}
