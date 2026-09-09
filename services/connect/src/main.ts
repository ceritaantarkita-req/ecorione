/**
 * Entrypoint produksi Connect. Baca env, jalankan server.
 */

import { bindHost } from "@ecorione/shared-server";
import { buildConnectServer } from "./http.js";

const port = Number(process.env.ECORIONE_CONNECT_PORT ?? "17023");
const token = process.env.ECORIONE_INTERNAL_TOKEN || undefined;
const anthropicApiKey = process.env.ANTHROPIC_API_KEY || undefined;
const localBaseUrl = process.env.ECORIONE_LOCAL_BASE_URL ?? "http://127.0.0.1:11434/v1";
const localModelTag = process.env.ECORIONE_LOCAL_MODEL ?? "qwen3:8b-instruct-q4_K_M";
const hostedCallsEnabled = process.env.ECORIONE_COST_KILL_SWITCH !== "1";

const app = buildConnectServer({
  token,
  logger: true,
  anthropicApiKey,
  localBaseUrl,
  localModelTag,
  hostedCallsEnabled,
});

app
  .listen({ port, host: bindHost() })
  .then(() => {
    app.log.info(`Connect jalan di http://${bindHost()}:${String(port)}`);
  })
  .catch((err: unknown) => {
    app.log.error(err);
    process.exit(1);
  });
