/**
 * Entrypoint produksi RnD. Baca env, buka DB, jalankan server.
 */

import { resolve } from "node:path";
import { bindHost, resolveRepoRuntimePath } from "@ecorione/shared-server";
import { openRndDatabase } from "./db.js";
import { buildRndServer } from "./http.js";

const REPO_ROOT = resolve(import.meta.dirname, "../../..");

const port = Number(process.env.ECORIONE_RND_PORT ?? "17021");
const dbPath = resolveRepoRuntimePath(
  REPO_ROOT,
  process.env.ECORIONE_RND_DB_PATH,
  "data/rnd.db",
);
const datasetRoot = resolveRepoRuntimePath(
  REPO_ROOT,
  process.env.ECORIONE_RND_DATASET_ROOT,
  "data/rnd-datasets",
);
const token = process.env.ECORIONE_INTERNAL_TOKEN || undefined;

const db = openRndDatabase(dbPath);
const app = buildRndServer(db, { token, logger: true, datasetRoot });

app
  .listen({ port, host: bindHost() })
  .then(() => {
    app.log.info(`RnD trace/dataset store jalan di http://${bindHost()}:${String(port)}`);
  })
  .catch((err: unknown) => {
    app.log.error(err);
    process.exit(1);
  });
