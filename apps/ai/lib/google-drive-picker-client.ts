import {
  GoogleDrivePickerSelectionSchema,
  type GoogleDrivePickerSelection,
  type GoogleDrivePickerSessionResponse,
} from "@ecorione/shared-schema";

export const GOOGLE_PICKER_SCRIPT_URL = "https://apis.google.com/js/api.js" as const;

interface GooglePickerInstance {
  setVisible(visible: boolean): void;
}

interface GooglePickerDocsView {
  setMode(mode: unknown): GooglePickerDocsView;
}

interface GooglePickerBuilder {
  setOAuthToken(token: string): GooglePickerBuilder;
  setDeveloperKey(key: string): GooglePickerBuilder;
  setAppId(appId: string): GooglePickerBuilder;
  addView(view: GooglePickerDocsView): GooglePickerBuilder;
  enableFeature(feature: unknown): GooglePickerBuilder;
  setCallback(callback: (data: Record<string, unknown>) => void): GooglePickerBuilder;
  build(): GooglePickerInstance;
}

export interface GooglePickerNamespace {
  readonly PickerBuilder: new () => GooglePickerBuilder;
  readonly DocsView: new (viewId: unknown) => GooglePickerDocsView;
  readonly ViewId: { readonly DOCS: unknown };
  readonly DocsViewMode: { readonly LIST: unknown };
  readonly Feature: { readonly MULTISELECT_ENABLED: unknown };
  readonly Action: { readonly PICKED: string; readonly CANCEL: string };
  readonly Response: { readonly ACTION: string; readonly DOCUMENTS: string };
  readonly Document: {
    readonly ID: string;
    readonly NAME: string;
    readonly MIME_TYPE: string;
  };
}

interface GoogleApiLoader {
  load(
    api: "picker",
    options: {
      readonly callback: () => void;
      readonly onerror: () => void;
      readonly timeout: number;
      readonly ontimeout: () => void;
    },
  ): void;
}

interface PickerBrowserWindow extends Window {
  gapi?: GoogleApiLoader | undefined;
  google?: { picker?: GooglePickerNamespace | undefined } | undefined;
}

let pickerApiPromise: Promise<GooglePickerNamespace> | null = null;

function pickerWindow(): PickerBrowserWindow {
  return window as PickerBrowserWindow;
}

function resolvedPicker(): GooglePickerNamespace | null {
  return pickerWindow().google?.picker ?? null;
}

function loadPickerModule(): Promise<GooglePickerNamespace> {
  const current = resolvedPicker();
  if (current !== null) return Promise.resolve(current);

  const gapi = pickerWindow().gapi;
  if (gapi === undefined) return Promise.reject(new Error("Google API loader belum tersedia."));

  return new Promise((resolve, reject) => {
    gapi.load("picker", {
      callback: () => {
        const picker = resolvedPicker();
        if (picker === null) {
          reject(new Error("Google Picker API tidak tersedia setelah loader selesai."));
          return;
        }
        resolve(picker);
      },
      onerror: () => reject(new Error("Google Picker API gagal dimuat.")),
      timeout: 10_000,
      ontimeout: () => reject(new Error("Google Picker API melewati batas waktu.")),
    });
  });
}

export function loadGooglePickerApi(): Promise<GooglePickerNamespace> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.reject(new Error("Google Picker hanya tersedia di browser."));
  }
  const current = resolvedPicker();
  if (current !== null) return Promise.resolve(current);
  if (pickerApiPromise !== null) return pickerApiPromise;

  pickerApiPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${GOOGLE_PICKER_SCRIPT_URL}"]`,
    );
    const loaded = (): void => {
      if (pickerWindow().gapi === undefined) {
        reject(new Error("Google API loader tidak tersedia."));
        return;
      }
      resolve();
    };

    if (existing !== null) {
      if (pickerWindow().gapi !== undefined) {
        loaded();
        return;
      }
      existing.addEventListener("load", loaded, { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Script Google Picker gagal dimuat.")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = GOOGLE_PICKER_SCRIPT_URL;
    script.async = true;
    script.addEventListener("load", loaded, { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error("Script Google Picker gagal dimuat.")),
      { once: true },
    );
    document.head.appendChild(script);
  })
    .then(() => loadPickerModule())
    .catch((error: unknown) => {
      pickerApiPromise = null;
      throw error;
    });

  return pickerApiPromise;
}

export function pickGoogleDriveFilesWithApi(
  pickerApi: GooglePickerNamespace,
  session: GoogleDrivePickerSessionResponse,
): Promise<GoogleDrivePickerSelection | null> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const settle = (value: GoogleDrivePickerSelection | null): void => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    try {
      const view = new pickerApi.DocsView(pickerApi.ViewId.DOCS).setMode(
        pickerApi.DocsViewMode.LIST,
      );
      const picker = new pickerApi.PickerBuilder()
        .setOAuthToken(session.accessToken)
        .setDeveloperKey(session.developerKey)
        .setAppId(session.appId)
        .addView(view)
        .enableFeature(pickerApi.Feature.MULTISELECT_ENABLED)
        .setCallback((data) => {
          const action = data[pickerApi.Response.ACTION];
          if (action === pickerApi.Action.CANCEL) {
            settle(null);
            return;
          }
          if (action !== pickerApi.Action.PICKED || settled) return;

          const rawDocuments = data[pickerApi.Response.DOCUMENTS];
          if (!Array.isArray(rawDocuments)) {
            settled = true;
            reject(new Error("Google Picker tidak mengembalikan daftar file."));
            return;
          }
          const files = rawDocuments.map((raw) => {
            if (typeof raw !== "object" || raw === null) return null;
            const document = raw as Record<string, unknown>;
            return {
              id: document[pickerApi.Document.ID],
              name: document[pickerApi.Document.NAME],
              mimeType: document[pickerApi.Document.MIME_TYPE],
            };
          });
          const parsed = GoogleDrivePickerSelectionSchema.safeParse({ files });
          if (!parsed.success) {
            settled = true;
            reject(new Error("Pilihan Google Drive tidak sesuai kontrak ECORIONE."));
            return;
          }
          settle(parsed.data);
        })
        .build();

      picker.setVisible(true);
    } catch (error) {
      settled = true;
      reject(error);
    }
  });
}

export async function pickGoogleDriveFiles(
  session: GoogleDrivePickerSessionResponse,
): Promise<GoogleDrivePickerSelection | null> {
  return pickGoogleDriveFilesWithApi(await loadGooglePickerApi(), session);
}
