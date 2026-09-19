import { createHmac, timingSafeEqual } from "node:crypto";
import {
  TriggerFireResponseSchema,
  WebhookIngressDeliverySchema,
} from "@ecorione/shared-schema";
import { HttpError, httpJson, parseOrBadRequest } from "@ecorione/shared-server";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ProviderCredentialReader } from "./credential-vault.js";

const WebhookParamsSchema = z.object({
  hookId: z
    .string()
    .min(16)
    .max(64)
    .regex(/^[a-z0-9][a-z0-9_-]*$/),
});

export interface ConnectWebhookOptions {
  readonly flowUrl: string;
  readonly internalToken?: string | undefined;
  readonly credentialVault?: ProviderCredentialReader | undefined;
  /** Development-only fallback when the encrypted vault is not configured. */
  readonly developmentRootSecret?: string | undefined;
}

export function deriveWebhookToken(rootSecret: string, hookId: string): string {
  return createHmac("sha256", rootSecret)
    .update(`ecorione-webhook-v1\0${hookId}`, "utf8")
    .digest("base64url");
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function tokenMatches(actual: string | undefined, expected: string): boolean {
  if (actual === undefined) return false;
  const left = Buffer.from(actual, "utf8");
  const right = Buffer.from(expected, "utf8");
  return left.byteLength === right.byteLength && timingSafeEqual(left, right);
}

export function registerConnectWebhookRoutes(
  app: FastifyInstance,
  options: ConnectWebhookOptions,
): void {
  const rootSecret = (): string => {
    const secret =
      options.credentialVault?.get("webhook", "tokens") ?? options.developmentRootSecret;
    if (secret === undefined || secret.length < 16) {
      throw new HttpError(
        503,
        "WEBHOOK_SECRET_NOT_CONFIGURED",
        "Webhook root secret belum dikonfigurasi di Connect Vault.",
      );
    }
    return secret;
  };

  app.get<{ Params: { hookId: string } }>(
    "/v1/settings/webhooks/:hookId/token",
    async (req) => {
      const { hookId } = parseOrBadRequest(WebhookParamsSchema, req.params);
      return { hookId, token: deriveWebhookToken(rootSecret(), hookId) };
    },
  );

  app.post<{ Params: { hookId: string } }>("/v1/webhooks/:hookId", async (req) => {
    const { hookId } = parseOrBadRequest(WebhookParamsSchema, req.params);
    const expected = deriveWebhookToken(rootSecret(), hookId);
    const actual = headerValue(req.headers["x-ecorione-webhook-token"]);
    if (!tokenMatches(actual, expected)) {
      throw new HttpError(401, "WEBHOOK_UNAUTHORIZED", "Token webhook tidak valid.");
    }
    const delivery = parseOrBadRequest(WebhookIngressDeliverySchema, req.body);

    return TriggerFireResponseSchema.parse(
      await httpJson(`${options.flowUrl}/v1/webhooks/${encodeURIComponent(hookId)}`, {
        method: "POST",
        token: options.internalToken,
        body: delivery,
      }),
    );
  });
}
