/**
 * Route HTTP Connect — `docs/api-fase1.md` §Connect. Satu endpoint inti: `POST /v1/complete`.
 */

import { ToolDefinitionSchema } from "@ecorione/context-assembly";
import {
  CoreMemorySchema,
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
import { complete, type CompleteDeps } from "./complete.js";
import { CredentialVaultError, type ProviderCredentialReader } from "./credential-vault.js";
import {
  CostKillSwitchError,
  MissingCredentialError,
  ProviderError,
} from "./providers/errors.js";
import { SpendBudgetError, SpendBudgetExceededError } from "./spend-budget.js";

/** Memetakan kegagalan provider/kredensial/kontrol operator ke error HTTP eksplisit. */
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
  /** Production credential source; raw provider keys never leave Connect. */
  readonly credentialVault?: ProviderCredentialReader | undefined;
  /** Development-only fallback when no vault is configured. */
  readonly anthropicApiKey?: string | undefined;
  readonly localBaseUrl: string;
  readonly localModelTag: string;
  /** Emergency operator cost control. Default true supaya upgrade tidak mengubah perilaku. */
  readonly hostedCallsEnabled?: boolean | undefined;
  /** Durable cumulative budget; hosted cache misses reserve before provider dispatch. */
  readonly spendBudget?: CompleteDeps["spendBudget"] | undefined;
  /** Diinjeksikan supaya test bisa memeriksa isi cache secara langsung kalau perlu. */
  readonly cache?: ExactMatchCache | undefined;
}

export function buildConnectServer(options: BuildConnectServerOptions): FastifyInstance {
  const app = createServer({ name: "connect", token: options.token, logger: options.logger });
  const deps: CompleteDeps = {
    credentialVault: options.credentialVault,
    anthropicApiKey: options.anthropicApiKey,
    localBaseUrl: options.localBaseUrl,
    localModelTag: options.localModelTag,
    cache: options.cache ?? new ExactMatchCache(),
    hostedCallsEnabled: options.hostedCallsEnabled ?? true,
    spendBudget: options.spendBudget,
  };

  app.post("/v1/complete", async (req) => {
    const body = parseOrBadRequest(CompleteBodySchema, req.body);
    try {
      return await complete(deps, body);
    } catch (err) {
      throw toHttpError(err);
    }
  });

  return app;
}
