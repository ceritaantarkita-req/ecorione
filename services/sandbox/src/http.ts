/** HTTP boundary for Sandbox execution. */
import { SandboxExecutionRequestSchema } from "@ecorione/shared-schema";
import {
  BadRequestError,
  ConflictError,
  createServer,
  parseOrBadRequest,
} from "@ecorione/shared-server";
import type { FastifyInstance } from "fastify";
import {
  SandboxApprovalRequiredError,
  SandboxBoundaryError,
  type SandboxExecutor,
} from "./executor.js";

export interface BuildSandboxServerOptions {
  readonly token?: string | undefined;
  readonly logger?: boolean | undefined;
}

export function buildSandboxServer(
  executor: SandboxExecutor,
  options: BuildSandboxServerOptions = {},
): FastifyInstance {
  const app = createServer({ name: "sandbox", token: options.token, logger: options.logger });
  app.post("/v1/executions", async (req, reply) => {
    const body = parseOrBadRequest(SandboxExecutionRequestSchema, req.body);
    try {
      return await reply.code(201).send(await executor.execute(body));
    } catch (err) {
      if (err instanceof SandboxApprovalRequiredError) throw new ConflictError(err.message);
      if (err instanceof SandboxBoundaryError) throw new BadRequestError(err.message);
      throw err;
    }
  });
  return app;
}
