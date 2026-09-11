/** Space service entrypoint. */
import { resolve } from "node:path";
import { bindHost, resolveRepoRuntimePath } from "@ecorione/shared-server";
import { openSpaceDatabase } from "./db.js";
import { buildSpaceServer } from "./http.js";
import { SpaceStore } from "./store.js";

const REPO_ROOT = resolve(import.meta.dirname, "../../..");
const port = Number(process.env.ECORIONE_SPACE_PORT ?? "17027");
const token = process.env.ECORIONE_INTERNAL_TOKEN || undefined;
const contextUrl = process.env.ECORIONE_CONTEXT_URL ?? "http://127.0.0.1:17022";
const flowUrl = process.env.ECORIONE_FLOW_URL ?? "http://127.0.0.1:17029";
const dbPath = resolveRepoRuntimePath(
  REPO_ROOT,
  process.env.ECORIONE_SPACE_DB_PATH,
  "data/space.db",
);

const db = openSpaceDatabase(dbPath);
const store = new SpaceStore(db);
const app = buildSpaceServer(store, {
  token,
  logger: true,
  contextUrl,
  flowUrl,
  internalToken: token,
});
app.addHook("onClose", async () => db.close());

app
  .listen({ port, host: bindHost() })
  .then(() => app.log.info(`Space jalan di http://${bindHost()}:${String(port)}`))
  .catch((err: unknown) => {
    app.log.error(err);
    process.exit(1);
  });
