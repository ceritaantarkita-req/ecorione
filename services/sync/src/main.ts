import { resolve } from "node:path";
import { bindHost } from "@ecorione/shared-server";
import { openSyncDatabase } from "./db.js";
import { buildSyncServer } from "./http.js";

const DEFAULT_DB_PATH = resolve(import.meta.dirname, "../../../data/sync.db");
const port = Number(process.env.ECORIONE_SYNC_PORT ?? "17011");
const dbPath = process.env.ECORIONE_SYNC_DB_PATH ?? DEFAULT_DB_PATH;
const ownerToken = process.env.ECORIONE_SYNC_OWNER_TOKEN;
const connectMcpUrl = process.env.ECORIONE_MCP_URL ?? "http://127.0.0.1:17010";

if (ownerToken === undefined || ownerToken.length < 24) {
  throw new Error("ECORIONE_SYNC_OWNER_TOKEN wajib diisi minimal 24 karakter sebelum Sync dijalankan.");
}

const db = openSyncDatabase(dbPath);
const app = buildSyncServer(db, { ownerToken, connectMcpUrl, logger: true });

app.listen({ port, host: bindHost() }).then(() => {
  app.log.info(`Sync jalan di http://${bindHost()}:${String(port)}`);
}).catch((error: unknown) => {
  app.log.error(error);
  db.close();
  process.exit(1);
});
