import { createFlowWorker } from "./worker.js";

const temporalAddress = process.env.ECORIONE_TEMPORAL_ADDRESS ?? "127.0.0.1:7233";
const temporalNamespace = process.env.ECORIONE_TEMPORAL_NAMESPACE ?? "default";
const token = process.env.ECORIONE_INTERNAL_TOKEN || undefined;
const hubUrl = process.env.ECORIONE_HUB_URL ?? "http://127.0.0.1:17024";
const connectUrl = process.env.ECORIONE_CONNECT_URL ?? "http://127.0.0.1:17023";
const sandboxUrl = process.env.ECORIONE_SANDBOX_URL ?? "http://127.0.0.1:17026";
const rndUrl = process.env.ECORIONE_RND_URL ?? "http://127.0.0.1:17021";

const worker = await createFlowWorker({
  temporalAddress,
  temporalNamespace,
  hubUrl,
  connectUrl,
  sandboxUrl,
  rndUrl,
  token,
});

await worker.run();
