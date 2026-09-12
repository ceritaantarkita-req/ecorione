const OWNER_PROXY_ORIGIN = "http://owner-proxy.local";

export type NormalizedOwnerProxyPath = {
  pathname: string;
  search: string;
  path: string;
  searchParams: URLSearchParams;
};

/**
 * Normalize an internal owner-proxy path without allowing a caller to escape the
 * expected owner API namespace through dot segments, absolute URLs, backslashes,
 * or fragments. Query strings are preserved for the owner-specific proxy to
 * validate further.
 */
export function normalizeOwnerProxyPath(
  rawPath: string,
  requiredPrefix = "/v1/",
): NormalizedOwnerProxyPath | null {
  if (!rawPath.startsWith("/") || rawPath.includes("\\") || rawPath.includes("#")) return null;

  const [rawPathname = ""] = rawPath.split("?", 1);
  if (rawPathname.split("/").some((segment) => segment === "." || segment === "..")) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(rawPath, OWNER_PROXY_ORIGIN);
  } catch {
    return null;
  }

  if (parsed.origin !== OWNER_PROXY_ORIGIN || !parsed.pathname.startsWith(requiredPrefix)) {
    return null;
  }

  return {
    pathname: parsed.pathname,
    search: parsed.search,
    path: `${parsed.pathname}${parsed.search}`,
    searchParams: parsed.searchParams,
  };
}
