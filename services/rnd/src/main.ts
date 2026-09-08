/**
 * Entrypoint produksi RnD. Baca env, buka DB, jalankan server.
 */

import { resolve } from "node:path";
import { bindHost } from "@ecorione/shared-server";
import { openRndDatabase } from "./db.js";
import { buildRndServer } from "./http.js";

/**
 * Default **hanya** dipakai kalau `ECORIONE_RND_DB_PATH` kosong di `.env` — dijangkarkan
 * ke lokasi modul ini (bukan `process.cwd()`) supaya `pnpm dev` tetap menulis ke satu
 * `./data/` di akar repo, persis seperti yang didokumentasikan `.env.example`, apa pun
 * direktori kerja saat proses ini dijalankan (`pnpm --filter` mengubah cwd ke folder
 * paket, bukan akar repo — default relatif-ke-cwd akan diam-diam mencar ke
 * `services/rnd/data/`).
 */
const DEFAULT_DB_PATH = resolve(import.meta.dirname, "../../../data/rnd.db");

const port = Number(process.env.ECORIONE_RND_PORT ?? "17021");
const dbPath = process.env.ECORIONE_RND_DB_PATH ?? DEFAULT_DB_PATH;
const token = process.env.ECORIONE_INTERNAL_TOKEN || undefined;

const db = openRndDatabase(dbPath);
const app = buildRndServer(db, { token, logger: true });

app
  .listen({ port, host: bindHost() })
  .then(() => {
    app.log.info(`RnD trace store jalan di http://${bindHost()}:${String(port)}`);
  })
  .catch((err: unknown) => {
    app.log.error(err);
    process.exit(1);
  });
