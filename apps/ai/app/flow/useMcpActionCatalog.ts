"use client";

import { useEffect, useState } from "react";
import type {
  McpActionServerOption,
  McpActionToolOption,
} from "./FlowPageSections";
import { errorMessage } from "./flow-page-model";

export function useMcpActionCatalog({
  workspaceId,
  workspaceReady,
  scope,
  sensitivity,
}: {
  workspaceId: string;
  workspaceReady: boolean;
  scope: string;
  sensitivity: string;
}) {
  const [servers, setServers] = useState<McpActionServerOption[]>([]);
  const [toolsByServer, setToolsByServer] = useState<
    Record<string, McpActionToolOption[]>
  >({});
  const [discoveryServerId, setDiscoveryServerId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceReady) return;
    let cancelled = false;
    setToolsByServer({});
    setMessage(null);
    void fetch(`/api/mcp-actions/servers?workspaceId=${encodeURIComponent(workspaceId)}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as {
          servers?: McpActionServerOption[];
        } | null;
        if (!response.ok || body?.servers === undefined) {
          throw new Error(errorMessage(body, `MCP server list gagal (${response.status}).`));
        }
        if (!cancelled) setServers(body.servers);
      })
      .catch((reason) => {
        if (!cancelled) {
          setServers([]);
          setMessage(
            `MCP action catalog gagal: ${reason instanceof Error ? reason.message : String(reason)}`,
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, workspaceReady]);

  async function discoverTools(serverId: string): Promise<void> {
    if (serverId.length === 0 || discoveryServerId !== null || !workspaceReady) return;
    setDiscoveryServerId(serverId);
    try {
      const response = await fetch(
        `/api/mcp-actions/servers/${encodeURIComponent(serverId)}/discover`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ workspaceId, scope, sensitivity }),
        },
      );
      const body = (await response.json().catch(() => null)) as {
        tools?: McpActionToolOption[];
        errors?: { tools?: string };
      } | null;
      if (!response.ok || body?.tools === undefined) {
        setMessage(errorMessage(body, `MCP discovery gagal (${response.status}).`));
        return;
      }
      setToolsByServer((current) => ({ ...current, [serverId]: body.tools ?? [] }));
      const enabled = body.tools.filter((tool) => tool.enabled).length;
      setMessage(
        `MCP ${serverId}: ${String(enabled)} enabled tool(s) dari ${String(body.tools.length)} discovered.${body.errors?.tools ? ` Tool discovery warning: ${body.errors.tools}` : ""}`,
      );
    } finally {
      setDiscoveryServerId(null);
    }
  }

  return {
    servers,
    toolsByServer,
    discoveryServerId,
    message,
    discoverTools,
  };
}
