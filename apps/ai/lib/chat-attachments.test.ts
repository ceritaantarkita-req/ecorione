import { describe, expect, it, vi } from "vitest";
import {
  MAX_COMPOSER_ATTACHMENTS,
  attachmentCanBeRemoved,
  attachmentChipLabel,
  attachmentNeedsUpload,
  attachmentsReadyForSend,
  buildAttachmentAwareMessage,
  uploadChatAttachment,
  uploadPendingChatAttachments,
  type ChatAttachment,
} from "./chat-attachments";

function fileAttachment(overrides: Partial<ChatAttachment> = {}): ChatAttachment {
  return {
    id: "att-1",
    kind: "file",
    label: "File: report.pdf",
    state: "ready",
    ...overrides,
  };
}

describe("attachment composer helpers", () => {
  it("never injects file labels as fake prompt content", () => {
    expect(buildAttachmentAwareMessage("Tolong ringkas", [fileAttachment()])).toBe(
      "Tolong ringkas",
    );
    expect(buildAttachmentAwareMessage("", [fileAttachment()])).toBe(
      "Analisis lampiran yang saya kirim.",
    );
  });

  it("preserves manual notes as actual user-authored prompt content", () => {
    const note: ChatAttachment = {
      id: "att-note",
      kind: "note",
      label: "Catatan: Fokus bagian risiko",
      noteText: "Fokus bagian risiko",
      state: "ready",
    };
    expect(buildAttachmentAwareMessage("Ringkas dokumen", [fileAttachment(), note])).toBe(
      "Ringkas dokumen\n\nFokus bagian risiko",
    );
  });

  it("treats staged files as removable and sendable, but blocks in-flight/error files", () => {
    const staged = fileAttachment({ state: "staged" });
    expect(attachmentsReadyForSend([staged])).toBe(true);
    expect(attachmentNeedsUpload(staged)).toBe(true);
    expect(attachmentCanBeRemoved(staged)).toBe(true);

    expect(attachmentsReadyForSend([fileAttachment({ state: "uploading" })])).toBe(false);
    expect(attachmentCanBeRemoved(fileAttachment({ state: "uploading" }))).toBe(false);
    expect(attachmentsReadyForSend([fileAttachment({ state: "error" })])).toBe(false);
  });

  it("does not offer fake removal after an attachment has entered session Context", () => {
    const uploaded = fileAttachment({
      artifactId: `art_${"a".repeat(64)}`,
      contextEpisodeId: "epi_attachmentclient001",
    });
    expect(attachmentNeedsUpload(uploaded)).toBe(false);
    expect(attachmentCanBeRemoved(uploaded)).toBe(false);
  });

  it("surfaces compact chip status without changing the underlying label", () => {
    expect(attachmentChipLabel(fileAttachment({ state: "uploading" }))).toContain("mengunggah");
    expect(attachmentChipLabel(fileAttachment({ state: "error" }))).toContain("gagal");
    expect(attachmentChipLabel(fileAttachment({ state: "staged" }))).toBe("File: report.pdf");
    expect(attachmentChipLabel(fileAttachment())).toBe("File: report.pdf");
    expect(MAX_COMPOSER_ATTACHMENTS).toBe(20);
  });
});

describe("uploadChatAttachment", () => {
  it("posts the real File with session and route, then returns governed pointer metadata", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          attachment: {
            artifactId: `art_${"a".repeat(64)}`,
            contextEpisodeId: "epi_attachmentclient001",
            state: "READY",
          },
        }),
        { status: 201 },
      ),
    );
    const file = new File(["hello"], "notes.txt", { type: "text/plain" });

    const result = await uploadChatAttachment(
      { sessionId: "sess_attachmentclient001", target: "local", file },
      fetchImpl,
    );

    expect(result).toEqual({
      artifactId: `art_${"a".repeat(64)}`,
      contextEpisodeId: "epi_attachmentclient001",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe("/api/attachments");
    expect(init?.method).toBe("POST");
    const body = init?.body;
    expect(body).toBeInstanceOf(FormData);
    const form = body as FormData;
    expect(form.get("sessionId")).toBe("sess_attachmentclient001");
    expect(form.get("target")).toBe("local");
    expect((form.get("file") as File).name).toBe("notes.txt");
  });

  it("uses the structured API error instead of raw HTTP payload noise", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "ATTACHMENT_UPSTREAM_UNAVAILABLE",
            message: "Artifact tidak tersedia untuk lampiran.",
          },
        }),
        { status: 502 },
      ),
    );
    const file = new File(["hello"], "notes.txt", { type: "text/plain" });

    await expect(
      uploadChatAttachment(
        { sessionId: "sess_attachmentclient001", target: "local", file },
        fetchImpl,
      ),
    ).rejects.toThrow("Artifact tidak tersedia untuk lampiran.");
  });

  it("fails closed when a successful endpoint returns malformed metadata", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ attachment: { state: "READY" } }), { status: 201 }),
      );
    const file = new File(["hello"], "notes.txt", { type: "text/plain" });

    await expect(
      uploadChatAttachment(
        { sessionId: "sess_attachmentclient001", target: "local", file },
        fetchImpl,
      ),
    ).rejects.toThrow("Respons lampiran tidak valid.");
  });
});

describe("uploadPendingChatAttachments", () => {
  it("preserves successful pointers when another file fails", async () => {
    const first = new File(["one"], "one.txt", { type: "text/plain" });
    const second = new File(["two"], "two.txt", { type: "text/plain" });
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            attachment: {
              artifactId: `art_${"b".repeat(64)}`,
              contextEpisodeId: "epi_attachmentbatch001",
              state: "READY",
            },
          }),
          { status: 201 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              code: "ATTACHMENT_UPSTREAM_UNAVAILABLE",
              message: "Hub tidak tersedia untuk lampiran.",
            },
          }),
          { status: 502 },
        ),
      );

    const result = await uploadPendingChatAttachments(
      [
        fileAttachment({ id: "att-1", file: first, state: "uploading" }),
        fileAttachment({ id: "att-2", file: second, state: "uploading" }),
      ],
      { sessionId: "sess_attachmentbatch001", target: "local" },
      fetchImpl,
    );

    expect(result[0]).toMatchObject({
      state: "ready",
      artifactId: `art_${"b".repeat(64)}`,
      contextEpisodeId: "epi_attachmentbatch001",
    });
    expect(result[1]).toMatchObject({
      state: "error",
      error: "Hub tidak tersedia untuk lampiran.",
    });
  });

  it("does not upload notes or file pointers that are already governed", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const note: ChatAttachment = {
      id: "att-note",
      kind: "note",
      label: "Catatan: tetap lokal",
      noteText: "tetap lokal",
      state: "ready",
    };
    const uploaded = fileAttachment({
      artifactId: `art_${"c".repeat(64)}`,
      contextEpisodeId: "epi_attachmentbatch002",
    });

    const result = await uploadPendingChatAttachments(
      [note, uploaded],
      { sessionId: "sess_attachmentbatch002", target: "local" },
      fetchImpl,
    );

    expect(result).toEqual([note, uploaded]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
