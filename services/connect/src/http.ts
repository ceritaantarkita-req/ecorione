/** Route HTTP Connect — provider gateway and local runtime boundary. */
import { ToolDefinitionSchema } from "@ecorione/context-assembly";
import {
  CoreMemorySchema,
  MultimodalInferRequestSchema,
  OperationIdSchema,
  SensitivitySchema,
} from "@ecorione/shared-schema";
import {
  BadGatewayError,
  createServer,
  HttpError,
  parseOrBadRequest,
} from "@ecorione/shared-server";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ExactMatchCache } from "./cache.js";
import { nowIso } from "./clock.js";
import { complete, type CompleteDeps } from "./complete.js";
import { CredentialVaultError, type ProviderCredentialReader } from "./credential-vault.js";
import { registerOutboundMcpRoutes } from "./mcp-client/http.js";
import type { McpManager } from "./mcp-client/manager.js";
import { inferMultimodal, type MultimodalAdapter } from "./multimodal.js";
import { DEFAULT_HOSTED_PROVIDER, type HostedProviderId } from "./provider-types.js";
import {
  CostKillSwitchError,
  MissingCredentialError,
  ProviderError,
} from "./providers/errors.js";
import type { LocalRuntimeId } from "./providers/local-runtime.js";
import { SpendBudgetError, SpendBudgetExceededError } from "./spend-budget.js";

export const DEFAULT_MULTIMODAL_BODY_LIMIT_BYTES = 32 * 1024 * 1024;

function toHttpError(err: unknown): unknown {
  if (err instanceof CostKillSwitchError)
    return new HttpError(503, "COST_KILL_SWITCH_ACTIVE", err.message);
  if (err instanceof CredentialVaultError)
    return new HttpError(503, "CREDENTIAL_VAULT_UNAVAILABLE", err.message);
  if (err instanceof SpendBudgetExceededError)
    return new HttpError(429, "SPEND_BUDGET_EXCEEDED", err.message);
  if (err instanceof SpendBudgetError)
    return new HttpError(503, "SPEND_BUDGET_UNAVAILABLE", err.message);
  if (err instanceof MissingCredentialError) return new BadGatewayError(err.message);
  if (err instanceof ProviderError) return new BadGatewayError(err.message);
  return err;
}

const StablePrefixBodySchema = z.object({
  systemPrompt: z.string(),
  toolDefinitions: z.array(ToolDefinitionSchema),
  coreMemory: CoreMemorySchema,
});

const CompleteBodySchema = z.object({
  target: z.enum(["hosted", "local"]),
  prefix: StablePrefixBodySchema,
  dynamicText: z.string(),
  userMessage: z.string().min(1),
  sensitivity: SensitivitySchema,
  operationId: OperationIdSchema,
  now: z.string().datetime({ offset: false }),
});

export interface BuildConnectServerOptions {
  readonly token?: string | undefined;
  readonly logger?: boolean | undefined;
  readonly credentialVault?: ProviderCredentialReader | undefined;
  readonly hostedProvider?: HostedProviderId | undefined;
  /** Development-only fallbacks when no credential vault is configured. */
  readonly anthropicApiKey?: string | undefined;
  readonly openrouterApiKey?: string | undefined;
  readonly openaiApiKey?: string | undefined;
  readonly localRuntime?: LocalRuntimeId | undefined;
  readonly localBaseUrl: string;
  readonly localModelTag: string;
  readonly hostedCallsEnabled?: boolean | undefined;
  readonly spendBudget?: CompleteDeps["spendBudget"] | undefined;
  readonly cache?: ExactMatchCache | undefined;
  readonly mcpManager?: McpManager | undefined;
  readonly localMultimodalAdapter?: MultimodalAdapter | undefined;
  readonly hostedMultimodalAdapter?: MultimodalAdapter | undefined;
  readonly multimodalBodyLimitBytes?: number | undefined;
}

export function buildConnectServer(options: BuildConnectServerOptions): FastifyInstance {
  const app = createServer({
    name: "connect",
    token: options.token,
    logger: options.logger,
    bodyLimit: options.multimodalBodyLimitBytes ?? DEFAULT_MULTIMODAL_BODY_LIMIT_BYTES,
  });
  const hostedProvider = options.hostedProvider ?? DEFAULT_HOSTED_PROVIDER;
  const deps: CompleteDeps = {
    credentialVault: options.credentialVault,
    hostedProvider,
    anthropicApiKey: options.anthropicApiKey,
    openrouterApiKey: options.openrouterApiKey,
    openaiApiKey: options.openaiApiKey,
    localRuntime: options.localRuntime,
    localBaseUrl: options.localBaseUrl,
    localModelTag: options.localModelTag,
    cache: options.cache ?? new ExactMatchCache(),
    hostedCallsEnabled: options.hostedCallsEnabled ?? true,
    spendBudget: options.spendBudget,
  };

  if (options.mcpManager !== undefined) registerOutboundMcpRoutes(app, options.mcpManager);

  app.post("/v1/complete", async (req) => {
    const body = parseOrBadRequest(CompleteBodySchema, req.body);
    const controller = new AbortController();
    const abort = (): void => controller.abort();
    req.raw.once("aborted", abort);
    try {
      return await complete(deps, body, controller.signal);
    } catch (err) {
      throw toHttpError(err);
    } finally {
      req.raw.off("aborted", abort);
    }
  });

  app.post("/v1/multimodal/infer", async (req) => {
    const body = parseOrBadRequest(MultimodalInferRequestSchema, req.body);
    const controller = new AbortController();
    const abort = (): void => controller.abort();
    req.raw.once("aborted", abort);
    try {
      return await inferMultimodal(
        {
          localAdapter: options.localMultimodalAdapter,
          hostedAdapter: options.hostedMultimodalAdapter,
          hostedProvider,
          hostedCallsEnabled: options.hostedCallsEnabled ?? true,
          spendBudget: options.spendBudget,
        },
        body,
        nowIso(),
        controller.signal,
      );
    } catch (err) {
      throw toHttpError(err);
    } finally {
      req.raw.off("aborted", abort);
    }
  });

  return app;
}
