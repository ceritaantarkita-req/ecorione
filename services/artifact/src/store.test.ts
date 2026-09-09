import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ArtifactIntegrityError, ArtifactStore } from "./store.js";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function makeStore(): ArtifactStore {
  const dir = mkdtempSync(join(tmpdir(), "ecorione-artifact-"));
  dirs.push(dir);
  return new ArtifactStore(dir);
}

describe("ArtifactStore", () => {
  it("deduplicates identical bytes to one SHA-256 blob", () => {
    const store = makeStore();
    const first = store.put(Buffer.from("same-content"));
    const second = store.put(Buffer.from("same-content"));
    expect(first.id).toBe(second.id);
    expect(first.deduplicated).toBe(false);
    expect(second.deduplicated).toBe(true);
    expect(store.read(first.id).toString("utf8")).toBe("same-content");
  });

  it("fails closed when a CAS blob is modified on disk", () => {
    const store = makeStore();
    const stored = store.put(Buffer.from("original"));
    writeFileSync(stored.path, Buffer.from("tampered"));
    expect(() => store.read(stored.id)).toThrow(ArtifactIntegrityError);
  });
});
