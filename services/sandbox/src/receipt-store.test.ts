import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SandboxReceiptStore } from "./receipt-store.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "ecorione-sandbox-receipt-"));
  roots.push(root);
  return root;
}

describe("SandboxReceiptStore lock cleanup", () => {
  it("menghapus lock jika metadata gagal ditulis setelah exclusive create", () => {
    const root = tempRoot();
    const key = "sandbox-lock-write-failure";
    const store = new SandboxReceiptStore(root, {
      writeLockMetadata() {
        throw new Error("simulated lock metadata write failure");
      },
    });

    expect(() => store.acquire(key)).toThrow("simulated lock metadata write failure");
    expect(readdirSync(root).filter((name) => name.endsWith(".lock"))).toEqual([]);

    const retryStore = new SandboxReceiptStore(root);
    const lease = retryStore.acquire(key);
    expect(readdirSync(root).filter((name) => name.endsWith(".lock"))).toHaveLength(1);
    lease.release();
    expect(readdirSync(root).filter((name) => name.endsWith(".lock"))).toEqual([]);
  });
});
