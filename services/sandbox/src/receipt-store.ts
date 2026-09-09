/** Durable file-backed Sandbox receipts keyed by idempotency key hash. */
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  SandboxExecutionReceiptSchema,
  type SandboxExecutionReceipt,
} from "@ecorione/shared-schema";

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
