import { resolve } from "node:path";
import { bindHost } from "@ecorione/shared-server";
import { openFlowDatabase } from "./db.js";
import { FlowGraphRepository } from "./graph-repository.js";
import { buildFlowServer } from "./http.js";
import { createFlowTemporalClient } from "./temporal-client.js";

const port = Number(process.env.ECORIONE_FLOW_PORT ?? "17028");
const temporalAddress = process.env.ECORIONE_TEMPORAL_ADDRESS ?? "127.0.0.1:7233";
const temporalNamespace = process.env.ECORIONE_TEMPORAL_NAMESPACE ?? "default";
const hubUrl = process.env.ECORIONE_HUB_URL ?? "http://127.0.0.1:17024";
const token = process.env.ECORIONE_INTERNAL_TOKEN || undefined;
const dbPath =
  process.env.ECORIONE_FLOW_DB ?? resolve(import.meta.dirname, "../../../data/flow.sqlite");
const db = openFlowDatabase(dbPath);
const temporal = await createFlowTemporalClient({
  address: temporalAddress,
  namespace: temporalNamespace,
});
const app = buildFlowServer(temporal, {
  hubUrl,
  token,
  logger: true,
  graphRepository: new FlowGraphRepository(db),
});
app.addHook("onClose", async () => db.close());
app
  .listen({ port, host: bindHost() })
  .then(() => app.log.info(`Flow jalan di http://${bindHost()}:${String(port)}`))
  .catch((err: unknown) => {
    app.log.error(err);
    db.close();
    process.exit(1);
  });
