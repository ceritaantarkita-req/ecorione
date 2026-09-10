import { createFlowWorker } from "./worker.js";

const temporalAddress = process.env.ECORIONE_TEMPORAL_ADDRESS ?? "127.0.0.1:7233";
const temporalNamespace = process.env.ECORIONE_TEMPORAL_NAMESPACE ?? "default";
const token = process.env.ECORIONE_INTERNAL_TOKEN || undefined;
const hubUrl = process.env.ECORIONE_HUB_URL ?? "http://127.0.0.1:17024";
const connectUrl = process.env.ECORIONE_CONNECT_URL ?? "http://127.0.0.1:17023";
const contextUrl = process.env.ECORIONE_CONTEXT_URL ?? "http://127.0.0.1:17022";
const artifactUrl = process.env.ECORIONE_ARTIFACT_URL ?? "http://127.0.0.1:17025";
const spaceUrl = process.env.ECORIONE_SPACE_URL ?? "http://127.0.0.1:17027";
const sandboxUrl = process.env.ECORIONE_SANDBOX_URL ?? "http://127.0.0.1:17026";
const rndUrl = process.env.ECORIONE_RND_URL ?? "http://127.0.0.1:17021";
const flowUrl = process.env.ECORIONE_FLOW_URL ?? "http://127.0.0.1:17028";
const csv = (value: string | undefined): string[] =>
  value
    ?.split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0) ?? [];
const worker = await createFlowWorker({
  temporalAddress,
  temporalNamespace,
  hubUrl,
  connectUrl,
  contextUrl,
  artifactUrl,
  spaceUrl,
  sandboxUrl,
  rndUrl,
  flowUrl,
  token,
  httpHostAllowlist: csv(process.env.ECORIONE_FLOW_HTTP_HOST_ALLOWLIST),
  ownerApiAllowlist: csv(process.env.ECORIONE_FLOW_OWNER_API_ALLOWLIST),
});
const runPromise = worker.run();
if (process.env.ECORIONE_FLOW_WORKER_READY_IPC === "1" && process.send !== undefined) {
  const ready = (async () => {
    for (let attempt = 0; attempt < 1500; attempt += 1) {
      const state = worker.getState();
      if (state === "RUNNING") return;
      if (
        state === "STOPPING" ||
        state === "DRAINING" ||
        state === "DRAINED" ||
        state === "STOPPED"
      )
        throw new Error(`Flow worker stopped before readiness: ${state}`);
      await new Promise<void>((resolve) => setTimeout(resolve, 10));
    }
    throw new Error(
      `Timed out waiting for Flow worker RUNNING state; current=${worker.getState()}`,
    );
  })();
  await Promise.race([
    ready,
    runPromise.then(
      () => {
        throw new Error("Flow worker run loop stopped before readiness.");
      },
      (error: unknown) => Promise.reject(error),
    ),
  ]);
  process.send({ type: "ECORIONE_FLOW_WORKER_READY" });
}
await runPromise;
