/** Artifact service entrypoint. */
import { resolve } from "node:path";
import { bindHost } from "@ecorione/shared-server";
import { createContextMetadataClient } from "./context-client.js";
import { buildArtifactServer } from "./http.js";
import { ArtifactStore } from "./store.js";

const port = Number(process.env.ECORIONE_ARTIFACT_PORT ?? "17025");
const token = process.env.ECORIONE_INTERNAL_TOKEN || undefined;
const contextUrl = process.env.ECORIONE_CONTEXT_URL ?? "http://127.0.0.1:17022";
const root =
  process.env.ECORIONE_ARTIFACT_DIR ?? resolve(import.meta.dirname, "../../../data/artifacts");

const store = new ArtifactStore(root);
const metadata = createContextMetadataClient(contextUrl, token);
const app = buildArtifactServer(store, metadata, { token, logger: true });

app
  .listen({ port, host: bindHost() })
  .then(() => {
    app.log.info(`Artifact jalan di http://${bindHost()}:${String(port)}`);
  })
  .catch((err: unknown) => {
    app.log.error(err);
    process.exit(1);
  });
