/** Content-addressed byte store for Artifact. */
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { artifactIdFromDigest, digestFromArtifactId, type ArtifactId } from "@ecorione/shared-schema";

export interface StoredBlob {
  readonly id: ArtifactId;
  readonly digest: string;
  readonly path: string;
  readonly sizeBytes: number;
  readonly deduplicated: boolean;
}

export class ArtifactIntegrityError extends Error {}

export class ArtifactStore {
  readonly root: string;
  constructor(root: string) {
    this.root = resolve(root);
    mkdirSync(this.root, { recursive: true });
  }

  pathForDigest(digest: string): string {
    return join(this.root, digest.slice(0, 2), digest);
  }

  put(content: Uint8Array): StoredBlob {
    const digest = createHash("sha256").update(content).digest("hex");
    const id = artifactIdFromDigest(digest);
    const path = this.pathForDigest(digest);
    mkdirSync(dirname(path), { recursive: true });
    try {
      const stat = statSync(path);
      if (stat.size !== content.byteLength) throw new ArtifactIntegrityError(`Ukuran blob CAS ${id} tidak cocok.`);
      const existingDigest = createHash("sha256").update(readFileSync(path)).digest("hex");
      if (existingDigest !== digest) throw new ArtifactIntegrityError(`Hash blob CAS ${id} tidak cocok.`);
      return { id, digest, path, sizeBytes: content.byteLength, deduplicated: true };
    } catch (err) {
      if (!(err instanceof Error) || !("code" in err) || (err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }

    const tmp = `${path}.tmp-${process.pid}-${randomUUID()}`;
    try {
      writeFileSync(tmp, content, { flag: "wx" });
      renameSync(tmp, path);
    } catch (err) {
      try { unlinkSync(tmp); } catch { /* no-op */ }
      throw err;
    }
    return { id, digest, path, sizeBytes: content.byteLength, deduplicated: false };
  }

  read(id: ArtifactId): Buffer {
    const digest = digestFromArtifactId(id);
    const path = this.pathForDigest(digest);
    const content = readFileSync(path);
    const actual = createHash("sha256").update(content).digest("hex");
    if (actual !== digest) throw new ArtifactIntegrityError(`Hash blob CAS ${id} berubah di disk.`);
    return content;
  }
}
