import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ChatRequestSchema } from "@ecorione/shared-schema";

const base = {
  sessionId: "sess_cloud_consent",
  message: "User-approved continuity",
  projectId: "prj_personal",
  workspaceId: "ws_personal",
};

describe("Local-to-cloud context consent contract", () => {
  it("allows only an explicit local opt-in", () => {
    expect(
      ChatRequestSchema.safeParse({
        ...base,
        target: "local",
        cloudShare: true,
      }).success,
    ).toBe(true);
    expect(
      ChatRequestSchema.safeParse({
        ...base,
        target: "hosted",
        cloudShare: true,
      }).success,
    ).toBe(false);
    expect(
      ChatRequestSchema.safeParse({
        ...base,
        cloudShare: true,
      }).success,
    ).toBe(false);
    expect(
      ChatRequestSchema.parse({
        ...base,
        target: "local",
      }).cloudShare,
    ).toBeUndefined();
  });

  it("shows clear user consent, resets it after each message and on route/session changes", () => {
    const page = readFileSync("apps/ai/app/page.tsx", "utf8");
    expect(page).toContain("Izinkan pesan Local berikutnya disimpan sebagai Cloud Allowed");
    expect(page).toContain("Tidak berlaku untuk riwayat lama");
    expect(page).toContain("setCloudShare(false)");
    expect(page).toContain('target === "local" && cloudShare && attachments.length === 0');
    expect(page).toContain("cloudShare: true");
    expect(page).toContain("setCloudShare(event.target.checked)");
  });
});
