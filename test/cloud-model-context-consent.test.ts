import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ChatRequestSchema } from "../packages/shared-schema/src/index.js";

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
    const controls = readFileSync("apps/ai/app/ChatPageSections.tsx", "utf8");
    expect(controls).toContain("Izinkan pesan Local berikutnya disimpan sebagai Cloud Allowed");
    expect(controls).toContain("Tidak berlaku untuk riwayat lama");
    expect(page).toContain("setCloudShare(false)");
    expect(page).toContain('target === "local" && cloudShare && attachments.length === 0');
    expect(page).toContain("cloudShare: true");
    expect(controls).toContain("onChange(event.target.checked)");
    expect(page).toContain("onChange={setCloudShare}");
  });
});
