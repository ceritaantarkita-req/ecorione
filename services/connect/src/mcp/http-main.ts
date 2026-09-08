/** MCP Streamable HTTP entrypoint. Connect remains loopback-only; Sync/tunnel provides reachability. */
import { ScopeSchema, SensitivitySchema } from "@ecorione/shared-schema";
import { z } from "zod";
import { buildMcpHttpServer, mcpAuthConfig } from "./http.js";
import { parseHandleKey } from "./handle.js";

const host = process.env.ECORIONE_MCP_HOST ?? "127.0.0.1";
if (host !== "127.0.0.1") {
  throw new Error("ECORIONE_MCP_HOST wajib 127.0.0.1; exposure publik hanya lewat Sync/tunnel (ADR-16).");
}
const port = Number(process.env.ECORIONE_MCP_PORT ?? "17010");
const issuer = process.env.ECORIONE_MCP_OAUTH_ISSUER;
const resource = process.env.ECORIONE_MCP_RESOURCE;
const jwksUrl = process.env.ECORIONE_MCP_JWKS_URL;
const handleKeyRaw = process.env.ECORIONE_MCP_HANDLE_KEY;
if (issuer === undefined || resource === undefined || jwksUrl === undefined) {
  throw new Error("MCP HTTP butuh ECORIONE_MCP_OAUTH_ISSUER, ECORIONE_MCP_RESOURCE, dan ECORIONE_MCP_JWKS_URL.");
}
if (handleKeyRaw === undefined) {
  throw new Error("MCP HTTP butuh ECORIONE_MCP_HANDLE_KEY base64url 32-byte agar handle tetap valid selama restart.");
}
const defaultMemoryScopes = z.array(ScopeSchema).min(1).parse(
  (process.env.ECORIONE_MCP_SCOPES ?? "personal")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);
const defaultMaxSensitivity = SensitivitySchema.parse(process.env.ECORIONE_MCP_MAX_SENSITIVITY ?? "INTERNAL");
const allowedOrigins = (process.env.ECORIONE_MCP_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const app = buildMcpHttpServer({
  hubUrl: process.env.ECORIONE_HUB_URL ?? "http://127.0.0.1:17024",
  internalToken: process.env.ECORIONE_INTERNAL_TOKEN || undefined,
  handleKey: parseHandleKey(handleKeyRaw),
  logger: true,
  auth: mcpAuthConfig({ issuer, resource, jwksUrl, allowedOrigins, defaultMemoryScopes, defaultMaxSensitivity }),
});

app.listen({ port, host }).then(() => {
  app.log.info(`Connect MCP HTTP jalan di http://${host}:${String(port)}/mcp`);
}).catch((error: unknown) => {
  app.log.error(error);
  process.exit(1);
});
