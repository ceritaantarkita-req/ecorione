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

const runPromise = worker.run();

if (process.env.ECORIONE_FLOW_WORKER_READY_IPC === "1" && process.send !== undefined) {
  const ready = (async () => {
    const deadline = Date.now() + 15_000;
    while (worker.getState() !== "RUNNING") {
      const state = worker.getState();
      if (state === "STOPPING" || state === "DRAINING" || state === "DRAINED" || state === "STOPPED") {
        throw new Error(`Flow worker stopped before readiness: ${state}`);
      }
      if (Date.now() >= deadline) {
        throw new Error(`Timed out waiting for Flow worker RUNNING state; current=${state}`);
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 10));
    }
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
