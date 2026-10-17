import { createServer, request, type ServerResponse } from "node:http";
import { once } from "node:events";
import { expect, it } from "vitest";
import { buildConnectServer } from "./http.js";
import { prefix } from "./test-helpers.js";

it.each(["ollama", "openai-compatible"] as const)(
  "cancels %s inference when the caller disconnects after sending its body",
  async (localRuntime) => {
    let modelResponse: ServerResponse | undefined;
    let started!: () => void;
    let cancelled!: () => void;
    const modelStarted = new Promise<void>((resolve) => {
      started = resolve;
    });
    const modelCancelled = new Promise<boolean>((resolve) => {
      cancelled = () => resolve(true);
    });
    const model = createServer((req, res) => {
      req.resume();
      req.once("end", () => {
        modelResponse = res;
        res.once("close", cancelled);
        started();
      });
    });
    model.listen(0, "127.0.0.1");
    await once(model, "listening");
    const address = model.address();
    if (address === null || typeof address === "string") throw new Error("Missing model port");
    const app = buildConnectServer({
      localRuntime,
      localBaseUrl: `http://127.0.0.1:${address.port}/v1`,
      localModelTag: "test-local",
      hostedCallsEnabled: false,
    });
    const url = await app.listen({ port: 0, host: "127.0.0.1" });
    const caller = request(`${url}/v1/complete`, {
      method: "POST",
      headers: { "content-type": "application/json" },
    });
    caller.on("error", () => {});
    caller.end(
      JSON.stringify({
        target: "local",
        prefix: prefix(),
        dynamicText: "",
        userMessage: "test cancellation",
        sensitivity: "INTERNAL",
        operationId: "op_cancel",
        now: "2026-10-16T10:00:00.000Z",
      }),
    );
    let deadline: ReturnType<typeof setTimeout> | undefined;
    try {
      await modelStarted;
      caller.destroy();
      const stopped = await Promise.race([
        modelCancelled,
        new Promise<boolean>((resolve) => {
          deadline = setTimeout(() => resolve(false), 1000);
        }),
      ]);
      expect(stopped).toBe(true);
    } finally {
      clearTimeout(deadline);
      caller.destroy();
      modelResponse?.end(JSON.stringify({ choices: [{ message: { content: "done" } }] }));
      model.closeAllConnections();
      model.close();
      app.server.closeAllConnections();
      await app.close();
    }
  },
);
