/** Server-only runtime configuration for Ai route handlers. */
const DEFAULT_HUB_URL = "http://127.0.0.1:17024";
const DEFAULT_SPACE_URL = "http://127.0.0.1:17027";
const DEFAULT_FLOW_URL = "http://127.0.0.1:17028";

export function hubUrl(): string {
  const value = process.env.ECORIONE_HUB_URL;
  return value !== undefined && value.length > 0 ? value : DEFAULT_HUB_URL;
}
export function spaceUrl(): string {
  const value = process.env.ECORIONE_SPACE_URL;
  return value !== undefined && value.length > 0 ? value : DEFAULT_SPACE_URL;
}
export function flowUrl(): string {
  const value = process.env.ECORIONE_FLOW_URL;
  return value !== undefined && value.length > 0 ? value : DEFAULT_FLOW_URL;
}
export function internalToken(): string | undefined {
  const value = process.env.ECORIONE_INTERNAL_TOKEN;
  return value !== undefined && value.length > 0 ? value : undefined;
}
