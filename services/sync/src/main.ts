import { resolve } from "node:path";
import { bindHost, resolveRepoRuntimePath } from "@ecorione/shared-server";
import { openSyncDatabase } from "./db.js";
import { buildSyncServer } from "./http.js";

const REPO_ROOT = resolve(import.meta.dirname, "../../..");
const port = Number(process.env.ECORIONE_SYNC_PORT ?? "17011");
const dbPath = resolveRepoRuntimePath(REPO_ROOT, process.env.ECORIONE_SYNC_DB_PATH, "data/sync.db");
const ownerToken = process.env.ECORIONE_SYNC_OWNER_TOKEN;
const connectMcpUrl = process.env.ECORIONE_MCP_URL ?? "http://127.0.0.1:17010";

if (ownerToken === undefined || ownerToken.length < 24) {
  throw new Error(
    "ECORIONE_SYNC_OWNER_TOKEN wajib diisi minimal 24 karakter sebelum Sync dijalankan.",
  );
}

const db = openSyncDatabase(dbPath);
const app = buildSyncServer(db, { ownerToken, connectMcpUrl, logger: true });

app
  .listen({ port, host: bindHost() })
  .then(() => {
    app.log.info(`Sync jalan di http://${bindHost()}:${String(port)}`);
  })
  .catch((error: unknown) => {
    app.log.error(error);
    db.close();
    process.exit(1);
  });
