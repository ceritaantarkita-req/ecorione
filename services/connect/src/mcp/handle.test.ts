import { describe, expect, it } from "vitest";
import { mintHandle, openHandle, openRequestState, sealRequestState } from "./handle.js";

const KEY = Buffer.alloc(32, 7);
const NOW = 1_800_000_000_000;

describe("MCP handle AEAD", () => {
  it("round-trip dan terikat principal", () => {
    const token = mintHandle(KEY, {
      principalId: "alice",
      allowedScopes: ["personal"],
      maxSensitivity: "INTERNAL",
      delivery: "local",
    }, NOW, 10_000);
    expect(openHandle(KEY, token, "alice", NOW + 1).allowedScopes).toEqual(["personal"]);
    expect(() => openHandle(KEY, token, "bob", NOW + 1)).toThrow(/principal/i);
  });

  it("menolak handle kedaluwarsa", () => {
    const token = mintHandle(KEY, {
      principalId: "alice",
      allowedScopes: ["personal"],
      maxSensitivity: "INTERNAL",
      delivery: "hosted",
    }, NOW, 10);
    expect(() => openHandle(KEY, token, "alice", NOW + 10)).toThrow(/kedaluwarsa/i);
  });

  it("requestState terikat principal + digest request", () => {
    const request = { method: "tools/call", params: { name: "memory_propose", arguments: { text: "x" } } };
    const token = sealRequestState(KEY, "alice", request, { step: 1 }, NOW, 10_000);
    expect(openRequestState<{ step: number }>(KEY, token, "alice", request, NOW + 1)).toEqual({ step: 1 });
    expect(() => openRequestState(KEY, token, "alice", { ...request, method: "tools/list" }, NOW + 1)).toThrow(/request/i);
  });
});
