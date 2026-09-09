/** Sandbox service entrypoint. */
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { bindHost } from "@ecorione/shared-server";
import { createSandboxControlPlane } from "./clients.js";
import { SandboxExecutor } from "./executor.js";
import { buildSandboxServer } from "./http.js";
import { SandboxReceiptStore } from "./receipt-store.js";

const port = Number(process.env.ECORIONE_SANDBOX_PORT ?? "17026");
const token = process.env.ECORIONE_INTERNAL_TOKEN || undefined;
const hubUrl = process.env.ECORIONE_HUB_URL ?? "http://127.0.0.1:17024";
const rndUrl = process.env.ECORIONE_RND_URL ?? "http://127.0.0.1:17021";
const workspaceRoot =
  process.env.ECORIONE_SANDBOX_WORKSPACE_ROOT ??
  resolve(import.meta.dirname, "../../../data/workspaces");
const receiptRoot =
  process.env.ECORIONE_SANDBOX_RECEIPT_DIR ??
  resolve(import.meta.dirname, "../../../data/sandbox-receipts");
mkdirSync(workspaceRoot, { recursive: true });

const control = createSandboxControlPlane({ hubUrl, rndUrl, token });
const receipts = new SandboxReceiptStore(receiptRoot);
const executor = new SandboxExecutor(workspaceRoot, control, receipts);
const app = buildSandboxServer(executor, { token, logger: true });

app
  .listen({ port, host: bindHost() })
  .then(() => app.log.info(`Sandbox jalan di http://${bindHost()}:${String(port)}`))
  .catch((err: unknown) => {
    app.log.error(err);
    process.exit(1);
  });
