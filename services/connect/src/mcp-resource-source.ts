import {
  ExternalMcpResourceFetchResponseSchema,
  type ExternalMcpResourceFetchResponse,
} from "@ecorione/shared-schema";
import { BadRequestError } from "@ecorione/shared-server";
import type { McpResourceReadResult } from "./mcp-client/types.js";
import { DEFAULT_EXTERNAL_SOURCE_MAX_BYTES } from "./source-fetch.js";

function strictBase64(value: string): Buffer {
  if (
    value.length === 0 ||
    value.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/u.test(value)
  ) {
    throw new BadRequestError("MCP resource blob bukan base64 valid.");
  }
  const bytes = Buffer.from(value, "base64");
  const normalized = bytes.toString("base64").replace(/=+$/u, "");
  if (normalized !== value.replace(/=+$/u, "")) {
    throw new BadRequestError("MCP resource blob bukan base64 valid.");
  }
  return bytes;
}

function ensureSize(bytes: Buffer, maxBytes: number): Buffer {
  if (bytes.byteLength === 0) throw new BadRequestError("MCP resource kosong.");
  if (bytes.byteLength > maxBytes) {
    throw new BadRequestError(
      `MCP resource melewati batas ${String(maxBytes)} byte.`,
    );
  }
  return bytes;
}

export function snapshotMcpResource(
  serverId: string,
  resourceUri: string,
  result: McpResourceReadResult,
  maxBytes = DEFAULT_EXTERNAL_SOURCE_MAX_BYTES,
): ExternalMcpResourceFetchResponse {
  if (result.contents.length === 0) {
    throw new BadRequestError("MCP resource tidak mengembalikan content.");
  }

  const allText = result.contents.every((part) => part.text !== undefined);
  let bytes: Buffer;
  let mimeType: string;

  if (allText) {
    const text = result.contents.map((part) => part.text ?? "").join("\n\n");
    bytes = ensureSize(Buffer.from(text, "utf8"), maxBytes);
    const mimeTypes = new Set(
      result.contents
        .map((part) => part.mimeType)
        .filter((value): value is string => value !== undefined),
    );
    mimeType =
      mimeTypes.size === 1
        ? ([...mimeTypes][0] ?? "text/plain")
        : "text/plain";
  } else if (
    result.contents.length === 1 &&
    result.contents[0]?.blob !== undefined &&
    result.contents[0].text === undefined
  ) {
    bytes = ensureSize(strictBase64(result.contents[0].blob), maxBytes);
    mimeType = result.contents[0].mimeType ?? "application/octet-stream";
  } else {
    throw new BadRequestError(
      "MCP resource multipart campuran belum didukung untuk snapshot Project.",
    );
  }

  return ExternalMcpResourceFetchResponseSchema.parse({
    serverId,
    resourceUri,
    mimeType,
    sizeBytes: bytes.byteLength,
    contentBase64: bytes.toString("base64"),
  });
}
