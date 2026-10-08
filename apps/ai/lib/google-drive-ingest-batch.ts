import type {
  GoogleDriveSelectedFile,
  ProjectGoogleDriveIngestResponse,
  ProjectSourceRole,
} from "@ecorione/shared-schema";

export class GoogleDriveOperationError extends Error {
  constructor(
    readonly type: string | null,
    message: string,
  ) {
    super(message);
    this.name = "GoogleDriveOperationError";
  }
}

export interface GoogleDriveBatchFailure {
  readonly file: GoogleDriveSelectedFile;
  readonly message: string;
  readonly type: string | null;
}

export interface GoogleDriveBatchResult {
  readonly successes: readonly ProjectGoogleDriveIngestResponse[];
  readonly failures: readonly GoogleDriveBatchFailure[];
  readonly skipped: readonly GoogleDriveSelectedFile[];
  readonly reconnectRequired: boolean;
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
  const skipped: GoogleDriveSelectedFile[] = [];
  let reconnectRequired = false;

  for (const [index, file] of files.entries()) {
    try {
      successes.push(await ingest(file.id, role));
    } catch (error) {
      const typed = error instanceof GoogleDriveOperationError ? error : null;
      failures.push({
        file,
        message: error instanceof Error ? error.message : "ingestion gagal",
        type: typed?.type ?? null,
      });

      if (typed?.type === "GOOGLE_DRIVE_RECONNECT_REQUIRED") {
        reconnectRequired = true;
        skipped.push(...files.slice(index + 1));
        break;
      }
    }
  }

  return {
    successes,
    failures,
    skipped,
    reconnectRequired,
    feedback: [
      `Google Drive: ${String(successes.length)} snapshot tersimpan.`,
      failures.length === 0
        ? ""
        : `${String(failures.length)} gagal — ${failures
            .map((failure) => `${failure.file.name}: ${failure.message}`)
            .join("; ")}`,
      skipped.length === 0
        ? ""
        : `${String(skipped.length)} belum dicoba karena Google Drive perlu dihubungkan ulang.`,
    ]
      .filter((part) => part.length > 0)
      .join(" "),
  };
}
