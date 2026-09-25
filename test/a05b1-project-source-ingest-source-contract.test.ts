import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("A-05b.1 direct Project source ingestion contract", () => {
  const uploadRoute = readFileSync(
    "apps/ai/app/api/projects/[id]/sources/upload/route.ts",
    "utf8",
  );
  const picker = readFileSync("apps/ai/app/projects/ProjectSources.tsx", "utf8");

  it("stores raw bytes in Artifact and binds only the resulting artifact through Hub", () => {
    expect(uploadRoute).toContain("${artifactUrl()}");
    expect(uploadRoute).toContain("/v1/artifacts");
    expect(uploadRoute).toContain('resourceType: "artifact"');
    expect(uploadRoute).toContain("/sources");
    expect(uploadRoute).toContain('syncClass: "LOCAL_ONLY"');
  });

  it("does not reuse chat/session multimodal ingestion", () => {
    expect(uploadRoute).not.toContain("/v1/multimodal/analyze");
    expect(uploadRoute).not.toContain("sessionId");
    expect(uploadRoute).not.toContain("historyEventId");
    expect(uploadRoute).not.toContain("ingestAttachment");
  });

  it("keeps extraction/indexing out of A-05b.1 and exposes direct upload in Projects", () => {
    expect(picker).toContain("${endpoint}/upload");
    expect(picker).toContain("OCR/indexing");
    expect(picker).toContain("belum dijalankan");
    expect(uploadRoute).not.toContain("ocr");
    expect(uploadRoute).not.toContain("vision");
    expect(uploadRoute).not.toContain("transcribe");
  });
});
