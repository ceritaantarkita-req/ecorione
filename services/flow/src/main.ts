import { bindHost } from "@ecorione/shared-server";
import { buildFlowServer } from "./http.js";
import { createFlowTemporalClient } from "./temporal-client.js";

const port = Number(process.env.ECORIONE_FLOW_PORT ?? "17028");
const temporalAddress = process.env.ECORIONE_TEMPORAL_ADDRESS ?? "127.0.0.1:7233";
const temporalNamespace = process.env.ECORIONE_TEMPORAL_NAMESPACE ?? "default";
const hubUrl = process.env.ECORIONE_HUB_URL ?? "http://127.0.0.1:17024";
const token = process.env.ECORIONE_INTERNAL_TOKEN || undefined;

const temporal = await createFlowTemporalClient({
  address: temporalAddress,
  namespace: temporalNamespace,
});
const app = buildFlowServer(temporal, { hubUrl, token, logger: true });

app
  .listen({ port, host: bindHost() })
  .then(() => app.log.info(`Flow jalan di http://${bindHost()}:${String(port)}`))
  .catch((err: unknown) => {
    app.log.error(err);
    process.exit(1);
  });
