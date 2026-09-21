/** Durable file-backed Sandbox receipts keyed by idempotency key hash. */
import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import {
  SandboxExecutionReceiptSchema,
  type SandboxExecutionReceipt,
} from "@ecorione/shared-schema";

export class SandboxReceiptBusyError extends Error {
  constructor() {
    super("Sandbox idempotency key sedang diproses.");
    this.name = "SandboxReceiptBusyError";
  }
}

export interface SandboxReceiptLease {
  release(): void;
}

export class SandboxReceiptStore {
  readonly root: string;
  constructor(root: string) {
    this.root = resolve(root);
    mkdirSync(this.root, { recursive: true });
  }

  private pathForKey(key: string): string {
    const digest = createHash("sha256").update(key).digest("hex");
    return join(this.root, `${digest}.json`);
  }

  acquire(key: string): SandboxReceiptLease {
    const lockPath = `${this.pathForKey(key)}.lock`;
    let fd: number;
    try {
      fd = openSync(lockPath, "wx", 0o600);
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: unknown }).code === "EEXIST"
      ) {
        throw new SandboxReceiptBusyError();
      }
      throw error;
    }
    writeFileSync(fd, `${String(process.pid)}\n`, "utf8");
    let released = false;
    return {
      release() {
        if (released) return;
        released = true;
        closeSync(fd);
        unlinkSync(lockPath);
      },
    };
  }

  get(key: string): SandboxExecutionReceipt | null {
    const path = this.pathForKey(key);
    if (!existsSync(path)) return null;
    return SandboxExecutionReceiptSchema.parse(JSON.parse(readFileSync(path, "utf8")));
  }

  put(key: string, receipt: SandboxExecutionReceipt): void {
    const parsed = SandboxExecutionReceiptSchema.parse(receipt);
    const path = this.pathForKey(key);
    const tmp = `${path}.tmp-${process.pid}-${randomUUID()}`;
    writeFileSync(tmp, `${JSON.stringify(parsed)}\n`, { flag: "wx" });
    renameSync(tmp, path);
  }
}
