import { describe, expect, it } from "vitest";
import { snapshotMcpResource } from "./mcp-resource-source.js";

describe("snapshotMcpResource", () => {
  it("snapshots one text resource", () => {
    const result = snapshotMcpResource("drive", "gdrive://file/1", {
      contents: [
        {
          uri: "gdrive://file/1",
          mimeType: "text/plain",
          text: "hello",
        },
      ],
    });
    expect(result).toMatchObject({
      serverId: "drive",
      resourceUri: "gdrive://file/1",
      mimeType: "text/plain",
      sizeBytes: 5,
      contentBase64: Buffer.from("hello").toString("base64"),
    });
  });

  it("joins multiple text parts without inventing binary multipart semantics", () => {
    const result = snapshotMcpResource("drive", "gdrive://doc/2", {
      contents: [
        { uri: "gdrive://doc/2#1", mimeType: "text/plain", text: "one" },
        { uri: "gdrive://doc/2#2", mimeType: "text/plain", text: "two" },
      ],
    });
    expect(Buffer.from(result.contentBase64, "base64").toString("utf8")).toBe("one\n\ntwo");
    expect(result.mimeType).toBe("text/plain");
  });

  it("accepts one binary blob and preserves mime type", () => {
    const bytes = Buffer.from([1, 2, 3, 4]);
    const result = snapshotMcpResource("drive", "gdrive://file/3", {
      contents: [
        {
          uri: "gdrive://file/3",
          mimeType: "application/pdf",
          blob: bytes.toString("base64"),
        },
      ],
    });
    expect(result.mimeType).toBe("application/pdf");
    expect(Buffer.from(result.contentBase64, "base64")).toEqual(bytes);
  });

  it("rejects mixed multipart resources and invalid base64", () => {
    expect(() =>
      snapshotMcpResource("drive", "gdrive://mixed", {
        contents: [
          { uri: "gdrive://mixed#text", text: "hello" },
          { uri: "gdrive://mixed#blob", blob: Buffer.from("x").toString("base64") },
        ],
      }),
    ).toThrow(/multipart campuran/);

    expect(() =>
      snapshotMcpResource("drive", "gdrive://bad", {
        contents: [{ uri: "gdrive://bad", blob: "not-base64!!" }],
      }),
    ).toThrow(/base64 valid/);
  });

  it("enforces the configured byte limit after decoding", () => {
    expect(() =>
      snapshotMcpResource(
        "drive",
        "gdrive://large",
        { contents: [{ uri: "gdrive://large", text: "12345" }] },
        4,
      ),
    ).toThrow(/melewati batas 4 byte/);
  });
});
