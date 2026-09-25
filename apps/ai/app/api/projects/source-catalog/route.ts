import { WorkspaceIdSchema } from "@ecorione/shared-schema";
import { connectUrl, contextUrl, flowUrl, internalToken, spaceUrl } from "../../../../lib/env";
import { jsonError } from "../../../../lib/proxy";

type ResourceType = "artifact" | "space-page" | "flow-graph" | "mcp-server";

interface CatalogItem {
  readonly resourceType: ResourceType;
  readonly resourceId: string;
  readonly label: string;
  readonly detail: string;
}

interface OwnerResult {
  readonly items: CatalogItem[];
  readonly warning?: string;
}

function headers(): Record<string, string> {
  const result: Record<string, string> = {};
  const token = internalToken();
  if (token !== undefined) result.authorization = `Bearer ${token}`;
  return result;
}

async function json(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: headers(),
    redirect: "error",
    cache: "no-store",
  });
  const body: unknown = await response.json().catch(() => undefined);
  if (!response.ok) throw new Error(`HTTP ${String(response.status)}`);
  return body;
}

function object(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

async function artifacts(): Promise<OwnerResult> {
  try {
    const params = new URLSearchParams({
      scope: "personal",
      maxSensitivity: "RESTRICTED",
      hostedEligible: "0",
    });
    const body = object(await json(`${contextUrl()}/v1/artifacts?${params.toString()}`));
    const pointers = Array.isArray(body?.pointers) ? body.pointers : [];
    const items = pointers.flatMap((pointer): CatalogItem[] => {
      const value = object(pointer);
      const resourceId = text(value?.id);
      if (resourceId === null) return [];
      const description = text(value?.description) ?? resourceId;
      const mimeType = text(value?.mimeType) ?? "artifact";
      return [
        {
          resourceType: "artifact",
          resourceId,
          label: description,
          detail: mimeType,
        },
      ];
    });
    return { items };
  } catch {
    return { items: [], warning: "Artifact catalog tidak tersedia." };
  }
}

async function pages(workspaceId: string): Promise<OwnerResult> {
  try {
    const body = object(
      await json(`${spaceUrl()}/v1/pages?workspaceId=${encodeURIComponent(workspaceId)}`),
    );
    const values = Array.isArray(body?.pages) ? body.pages : [];
    const items = values.flatMap((page): CatalogItem[] => {
      const value = object(page);
      const resourceId = text(value?.id);
      if (resourceId === null) return [];
      const label = text(value?.title) ?? resourceId;
      const scope = text(value?.scope) ?? "space";
      return [{ resourceType: "space-page", resourceId, label, detail: scope }];
    });
    return { items };
  } catch {
    return { items: [], warning: "Space catalog tidak tersedia." };
  }
}

async function graphs(workspaceId: string): Promise<OwnerResult> {
  try {
    const body = object(
      await json(`${flowUrl()}/v1/graphs?workspaceId=${encodeURIComponent(workspaceId)}`),
    );
    const values = Array.isArray(body?.graphs) ? body.graphs : [];
    const items = values.flatMap((graph): CatalogItem[] => {
      const value = object(graph);
      const resourceId = text(value?.graphId);
      if (resourceId === null) return [];
      const label = text(value?.name) ?? resourceId;
      const version =
        typeof value?.currentVersion === "number" ? `v${String(value.currentVersion)}` : "flow";
      return [{ resourceType: "flow-graph", resourceId, label, detail: version }];
    });
    return { items };
  } catch {
    return { items: [], warning: "Flow catalog tidak tersedia." };
  }
}

async function mcpServers(workspaceId: string): Promise<OwnerResult> {
  try {
    const body = object(
      await json(
        `${connectUrl()}/v1/mcp-outbound/servers?workspaceId=${encodeURIComponent(workspaceId)}`,
      ),
    );
    const values = Array.isArray(body?.servers) ? body.servers : [];
    const items = values.flatMap((server): CatalogItem[] => {
      const value = object(server);
      const resourceId = text(value?.id);
      if (resourceId === null) return [];
      const label = text(value?.displayName) ?? resourceId;
      const enabled = value?.enabled === true ? "enabled" : "disabled";
      return [{ resourceType: "mcp-server", resourceId, label, detail: enabled }];
    });
    return { items };
  } catch {
    return { items: [], warning: "MCP catalog tidak tersedia." };
  }
}

export async function GET(request: Request): Promise<Response> {
  const workspaceId = WorkspaceIdSchema.safeParse(
    new URL(request.url).searchParams.get("workspaceId"),
  );
  if (!workspaceId.success) return jsonError(400, "BAD_REQUEST", "workspaceId tidak valid.");

  const results = await Promise.all([
    artifacts(),
    pages(workspaceId.data),
    graphs(workspaceId.data),
    mcpServers(workspaceId.data),
  ]);
  return Response.json({
    items: results.flatMap((result) => result.items),
    warnings: results.flatMap((result) =>
      result.warning === undefined ? [] : [result.warning],
    ),
  });
}
