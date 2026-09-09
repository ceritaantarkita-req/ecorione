/**
 * Entrypoint produksi Hub. Baca env, buka DB, jalankan server.
 */

import { resolve } from "node:path";
import { bindHost } from "@ecorione/shared-server";
import { openHubDatabase } from "./db.js";
import { buildHubServer } from "./http.js";
import { registerHubMultimodal } from "./multimodal-bootstrap.js";

/** Default DB dijangkarkan ke lokasi modul, bukan process.cwd(). */
const DEFAULT_DB_PATH = resolve(import.meta.dirname, "../../../data/hub.db");

const port = Number(process.env.ECORIONE_HUB_PORT ?? "17024");
const dbPath = process.env.ECORIONE_HUB_DB_PATH ?? DEFAULT_DB_PATH;
const token = process.env.ECORIONE_INTERNAL_TOKEN || undefined;
const contextUrl = process.env.ECORIONE_CONTEXT_URL ?? "http://127.0.0.1:17022";
const connectUrl = process.env.ECORIONE_CONNECT_URL ?? "http://127.0.0.1:17023";
const rndUrl = process.env.ECORIONE_RND_URL ?? "http://127.0.0.1:17021";
const artifactUrl = process.env.ECORIONE_ARTIFACT_URL ?? "http://127.0.0.1:17025";

const db = openHubDatabase(dbPath);
const app = buildHubServer(db, {
  token,
  logger: true,
  contextUrl,
  connectUrl,
  rndUrl,
  artifactUrl,
  internalToken: token,
});
registerHubMultimodal(app, db, { contextUrl, connectUrl, artifactUrl, internalToken: token });

app
  .listen({ port, host: bindHost() })
  .then(() => {
    app.log.info(`Hub jalan di http://${bindHost()}:${String(port)}`);
  })
  .catch((err: unknown) => {
    app.log.error(err);
    process.exit(1);
  });
