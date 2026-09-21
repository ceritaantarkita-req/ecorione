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

export interface SandboxReceiptStoreOptions {
  readonly writeLockMetadata?: (fd: number, metadata: string) => void;
}

function cleanupFailedLockAcquisition(fd: number, lockPath: string): void {
  try {
    closeSync(fd);
  } catch {
    // Best effort: still attempt unlink so a close failure does not skip stale-lock cleanup.
  }
  try {
    unlinkSync(lockPath);
  } catch {
    // Preserve the original acquisition failure; later retries still fail closed if cleanup failed.
  }
}

export class SandboxReceiptStore {
  readonly root: string;
  private readonly writeLockMetadata: (fd: number, metadata: string) => void;

  constructor(root: string, options: SandboxReceiptStoreOptions = {}) {
    this.root = resolve(root);
    mkdirSync(this.root, { recursive: true });
    this.writeLockMetadata =
      options.writeLockMetadata ??
      ((fd, metadata) => {
        writeFileSync(fd, metadata, "utf8");
      });
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

    try {
      this.writeLockMetadata(fd, `${String(process.pid)}\n`);
    } catch (error) {
      cleanupFailedLockAcquisition(fd, lockPath);
      throw error;
    }

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
