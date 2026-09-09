import type { McpAuthConfig } from "./auth.js";

export type McpOAuthScope = "memory:read" | "memory:write" | "memory:delete";

export function protectedResourceMetadataUrl(resource: string): string {
  const url = new URL(resource);
  if (url.search.length > 0 || url.hash.length > 0) {
    throw new Error("MCP resource URL tidak boleh memiliki query atau fragment.");
  }
  const suffix = url.pathname === "/" ? "" : url.pathname.replace(/\/$/u, "");
  url.pathname = `/.well-known/oauth-protected-resource${suffix}`;
  return url.toString();
}

function quoted(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

export function bearerChallenge(
  config: Pick<McpAuthConfig, "resource">,
  scope: McpOAuthScope,
  error: "invalid_token" | "insufficient_scope",
): string {
  return [
    `Bearer resource_metadata="${quoted(protectedResourceMetadataUrl(config.resource))}"`,
    `scope="${quoted(scope)}"`,
    `error="${error}"`,
  ].join(", ");
}
