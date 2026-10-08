import { describe, expect, it } from "vitest";
import {
  GoogleDrivePickerSessionResponseSchema,
  type GoogleDriveSelectedFile,
} from "@ecorione/shared-schema";
import {
  pickGoogleDriveFilesWithApi,
  type GooglePickerNamespace,
} from "./google-drive-picker-client";

const SESSION = GoogleDrivePickerSessionResponseSchema.parse({
  workspaceId: "ws_personal",
  scope: "https://www.googleapis.com/auth/drive.file",
  accessToken: "synthetic-picker-access-token",
  expiresAt: "2026-10-04T04:00:00.000Z",
  developerKey: "synthetic_picker_key_123456",
  appId: "123456789012",
});

type PickerCallback = (data: Record<string, unknown>) => void;

function fixture() {
  let callback: PickerCallback | null = null;
  const state = {
    oauthToken: null as string | null,
    developerKey: null as string | null,
    appId: null as string | null,
    viewId: null as unknown,
    viewMode: null as unknown,
    feature: null as unknown,
    visible: false,
  };

  class DocsView {
    constructor(viewId: unknown) {
      state.viewId = viewId;
    }

    setMode(mode: unknown): DocsView {
      state.viewMode = mode;
      return this;
    }
  }

  class PickerBuilder {
    setOAuthToken(token: string): PickerBuilder {
      state.oauthToken = token;
      return this;
    }

    setDeveloperKey(key: string): PickerBuilder {
      state.developerKey = key;
      return this;
    }

    setAppId(appId: string): PickerBuilder {
      state.appId = appId;
      return this;
    }

    addView(_view: DocsView): PickerBuilder {
      return this;
    }

    enableFeature(feature: unknown): PickerBuilder {
      state.feature = feature;
      return this;
    }

    setCallback(next: PickerCallback): PickerBuilder {
      callback = next;
      return this;
    }

    build() {
      return {
        setVisible(visible: boolean): void {
          state.visible = visible;
        },
      };
    }
  }

  const pickerApi = {
    PickerBuilder,
    DocsView,
    ViewId: { DOCS: "docs-view" },
    DocsViewMode: { LIST: "list-mode" },
    Feature: { MULTISELECT_ENABLED: "multi-select" },
    Action: { PICKED: "picked", CANCEL: "cancel" },
    Response: { ACTION: "action", DOCUMENTS: "documents" },
    Document: { ID: "id", NAME: "name", MIME_TYPE: "mimeType" },
  } as unknown as GooglePickerNamespace;

  return {
    pickerApi,
    state,
    emit(data: Record<string, unknown>): void {
      if (callback === null) throw new Error("Picker callback belum terpasang.");
      callback(data);
    },
  };
}

function pickedDocuments(files: readonly GoogleDriveSelectedFile[]) {
  return {
    action: "picked",
    documents: files.map((file) => ({
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
    })),
  };
}

describe("Google Drive Picker client acceptance seam", () => {
  it("configures LIST + multi-select and returns only selected file metadata", async () => {
    const mock = fixture();
    const selected = [
      {
        id: "file-blob-1",
        name: "contract.pdf",
        mimeType: "application/pdf",
      },
      {
        id: "file-doc-1",
        name: "Quarterly plan",
        mimeType: "application/vnd.google-apps.document",
      },
    ] satisfies GoogleDriveSelectedFile[];

    const resultPromise = pickGoogleDriveFilesWithApi(mock.pickerApi, SESSION);

    expect(mock.state).toMatchObject({
      oauthToken: SESSION.accessToken,
      developerKey: SESSION.developerKey,
      appId: SESSION.appId,
      viewId: "docs-view",
      viewMode: "list-mode",
      feature: "multi-select",
      visible: true,
    });

    mock.emit(pickedDocuments(selected));

    await expect(resultPromise).resolves.toEqual({ files: selected });
    const result = await resultPromise;
    expect(JSON.stringify(result)).not.toContain(SESSION.accessToken);
    expect(JSON.stringify(result)).not.toContain(SESSION.developerKey);
  });

  it("returns null when the operator cancels Picker", async () => {
    const mock = fixture();
    const resultPromise = pickGoogleDriveFilesWithApi(mock.pickerApi, SESSION);

    mock.emit({ action: "cancel" });

    await expect(resultPromise).resolves.toBeNull();
  });

  it("rejects PICKED without a document array", async () => {
    const mock = fixture();
    const resultPromise = pickGoogleDriveFilesWithApi(mock.pickerApi, SESSION);

    mock.emit({ action: "picked", documents: "not-an-array" });

    await expect(resultPromise).rejects.toThrow(
      "Google Picker tidak mengembalikan daftar file.",
    );
  });

  it("rejects empty, duplicate, and oversized selections", async () => {
    const cases: Array<readonly GoogleDriveSelectedFile[]> = [
      [],
      [
        { id: "duplicate-id", name: "One", mimeType: "text/plain" },
        { id: "duplicate-id", name: "Two", mimeType: "text/plain" },
      ],
      Array.from({ length: 21 }, (_, index) => ({
        id: `file-${String(index + 1)}`,
        name: `File ${String(index + 1)}`,
        mimeType: "text/plain",
      })),
    ];

    for (const selected of cases) {
      const mock = fixture();
      const resultPromise = pickGoogleDriveFilesWithApi(mock.pickerApi, SESSION);

      mock.emit(pickedDocuments(selected));

      await expect(resultPromise).rejects.toThrow(
        "Pilihan Google Drive tidak sesuai kontrak ECORIONE.",
      );
    }
  });

  it("rejects malformed document metadata before ingestion", async () => {
    const mock = fixture();
    const resultPromise = pickGoogleDriveFilesWithApi(mock.pickerApi, SESSION);

    mock.emit({
      action: "picked",
      documents: [{ id: "file-1", name: "", mimeType: "text/plain" }],
    });

    await expect(resultPromise).rejects.toThrow(
      "Pilihan Google Drive tidak sesuai kontrak ECORIONE.",
    );
  });
});
