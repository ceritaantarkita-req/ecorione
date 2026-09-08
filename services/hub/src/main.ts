/**
 * Entrypoint produksi Hub. Baca env, buka DB, jalankan server.
 */

import { resolve } from "node:path";
import { bindHost } from "@ecorione/shared-server";
import { openHubDatabase } from "./db.js";
import { buildHubServer } from "./http.js";

/**
 * Default **hanya** dipakai kalau `ECORIONE_HUB_DB_PATH` kosong di `.env` — dijangkarkan
 * ke lokasi modul ini (bukan `process.cwd()`) supaya `pnpm dev` tetap menulis ke satu
 * `./data/` di akar repo, persis seperti yang didokumentasikan `.env.example`, apa pun
 * direktori kerja saat proses ini dijalankan (`pnpm --filter` mengubah cwd ke folder
 * paket, bukan akar repo — default relatif-ke-cwd akan diam-diam mencar ke
 * `services/hub/data/`).
 */
const DEFAULT_DB_PATH = resolve(import.meta.dirname, "../../../data/hub.db");

const port = Number(process.env.ECORIONE_HUB_PORT ?? "17024");
const dbPath = process.env.ECORIONE_HUB_DB_PATH ?? DEFAULT_DB_PATH;
const token = process.env.ECORIONE_INTERNAL_TOKEN || undefined;
const contextUrl = process.env.ECORIONE_CONTEXT_URL ?? "http://127.0.0.1:17022";
const connectUrl = process.env.ECORIONE_CONNECT_URL ?? "http://127.0.0.1:17023";
const rndUrl = process.env.ECORIONE_RND_URL ?? "http://127.0.0.1:17021";

const db = openHubDatabase(dbPath);
const app = buildHubServer(db, {
  token,
  logger: true,
  contextUrl,
  connectUrl,
  rndUrl,
  internalToken: token,
});

app
  .listen({ port, host: bindHost() })
  .then(() => {
    app.log.info(`Hub jalan di http://${bindHost()}:${String(port)}`);
  })
  .catch((err: unknown) => {
    app.log.error(err);
    process.exit(1);
  });
