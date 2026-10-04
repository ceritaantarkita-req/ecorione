import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Session 12D Google Drive Picker browser boundary", () => {
  const pickerClient = readFileSync("apps/ai/lib/google-drive-picker-client.ts", "utf8");
  const proxy = readFileSync("apps/ai/lib/google-drive-proxy.ts", "utf8");
  const ui = readFileSync("apps/ai/app/projects/ProjectSources.tsx", "utf8");
  const batch = readFileSync("apps/ai/lib/google-drive-ingest-batch.ts", "utf8");
  const callback = readFileSync(
    "apps/ai/app/api/integrations/google-drive/callback/route.ts",
    "utf8",
  );
  const pickerSession = readFileSync(
    "apps/ai/app/api/integrations/google-drive/picker-session/route.ts",
    "utf8",
  );
  const connect = readFileSync("services/connect/src/google-drive-http.ts", "utf8");
  const connectServer = readFileSync("services/connect/src/http.ts", "utf8");
  const driveSource = readFileSync("services/connect/src/google-drive-source.ts", "utf8");
  const main = readFileSync("services/connect/src/main.ts", "utf8");
  const nextConfig = readFileSync("apps/ai/next.config.ts", "utf8");
  const packageJson = readFileSync("package.json", "utf8");

  it("keeps executable Picker callback coverage in the mock acceptance command", () => {
    expect(packageJson).toContain('"acceptance:google-drive:mock"');
    expect(packageJson).toContain("apps/ai/lib/google-drive-picker-client.test.ts");
  });

  it("uses only the official Google Picker script and iframe origins", () => {
    expect(pickerClient).toContain(
      'GOOGLE_PICKER_SCRIPT_URL = "https://apis.google.com/js/api.js"',
    );
    expect(nextConfig).toContain("https://apis.google.com");
    expect(nextConfig).toContain("frame-src 'self' https://docs.google.com");
    expect(nextConfig).not.toContain("https://*.google.com");
    expect(nextConfig).not.toContain("https://*.googleusercontent.com");
  });

  it("keeps Picker least-privilege and explicit-selection-only", () => {
    expect(pickerClient).toContain("DocsViewMode.LIST");
    expect(pickerClient).toContain("Feature.MULTISELECT_ENABLED");
    expect(pickerClient).toContain("GoogleDrivePickerSelectionSchema.safeParse");
    expect(ui).toContain("Pilih file Drive");
    expect(ui).toContain("ingestGoogleDriveSelection");
    expect(ui).toContain("if (batch.successes.length > 0)");
    expect(ui).toContain("setFeedback(batch.feedback)");
    expect(ui).toContain("/ingest-google-drive");
    expect(ui).not.toContain('{ value: "google-drive"');
    expect(ui).toContain("tidak mengindeks seluruh Drive");
  });

  it("stops multi-file ingestion after auth loss and surfaces reconnect UX", () => {
    expect(batch).toContain('typed?.type === "GOOGLE_DRIVE_RECONNECT_REQUIRED"');
    expect(batch).toContain("skipped.push(...files.slice(index + 1))");
    expect(batch).toContain("reconnectRequired = true");
    expect(ui).toContain("driveReconnectRequired");
    expect(ui).toContain('"GOOGLE_DRIVE_RECONNECT_REQUIRED"');
    expect(ui).toContain("Putuskan untuk hubungkan ulang");
    expect(ui).toContain(
      "Perlu dihubungkan ulang. Putuskan koneksi lama lalu hubungkan kembali.",
    );
  });

  it("never persists the Picker bearer token in browser storage", () => {
    for (const source of [pickerClient, ui, pickerSession, proxy]) {
      expect(source).not.toContain("localStorage");
      expect(source).not.toContain("sessionStorage");
      expect(source).not.toContain("indexedDB");
    }
    expect(proxy).toContain('"cache-control": "no-store, private"');
    expect(proxy).toContain('pragma: "no-cache"');
    expect(pickerClient).toContain(".setOAuthToken(session.accessToken)");
  });

  it("keeps refresh-token custody server-side and mints only ephemeral access", () => {
    expect(connect).toContain('"/v1/integrations/google-drive/picker-session"');
    expect(connect).toContain("client.refreshAccessToken(refreshToken)");
    expect(connect).toContain("disconnectGoogleDrive(vault)");
    expect(driveSource).toContain("this.options.onAuthorizationRejected?.()");
    expect(connectServer).toContain("onAuthorizationRejected:");
    expect(connectServer).toContain("disconnectGoogleDrive(options.credentialVaultAdmin!)");
    expect(connect).toContain("GoogleDrivePickerSessionResponseSchema.parse");
    expect(main).toContain("ECORIONE_GOOGLE_DRIVE_PICKER_API_KEY");
    expect(main).toContain("ECORIONE_GOOGLE_DRIVE_PICKER_APP_ID");
    expect(ui).not.toContain("refreshToken");
    expect(pickerClient).not.toContain("refreshToken");
  });

  it("terminates OAuth callback on Ai and revalidates safe return navigation", () => {
    expect(callback).toContain("GoogleDriveOAuthCallbackResponseSchema.safeParse");
    expect(callback).toContain("new URL(result.data.returnPath, url.origin)");
    expect(callback).toContain("status: 303");
    expect(callback).toContain('"cache-control": "no-store, private"');
  });

  it("keeps Drive connection as a dedicated connector rather than generic registry", () => {
    expect(ui).toContain("<strong>Google Drive</strong>");
    expect(ui).toContain("Hubungkan Google Drive");
    expect(ui).toContain("Refresh Drive snapshot");
    expect(ui).toContain("await loadDriveStatus().catch(() => undefined)");
    expect(ui).not.toContain('resourceType: "google-drive"');
  });
});
