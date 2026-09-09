import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import {
  StdioClientTransport,
  getDefaultEnvironment,
} from "@modelcontextprotocol/client/stdio";
import type { WorkspaceId } from "@ecorione/shared-schema";
import type {
  McpClientFacade,
  McpClientFactory,
  McpCredentialReader,
  McpProtocolEra,
  McpRemoteResource,
  McpRemoteTool,
  McpServerConfig,
  McpToolCallResult,
} from "./types.js";

export class McpTransportDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "McpTransportDeniedError";
  }
}

export class McpCredentialMissingError extends Error {
  constructor(ref: string) {
    super(`Credential MCP tidak ditemukan: ${ref}.`);
    this.name = "McpCredentialMissingError";
  }
}

export class McpClientTimeoutError extends Error {
  constructor(label: string, timeoutMs: number) {
    super(`${label} melewati timeout ${String(timeoutMs)}ms.`);
    this.name = "McpClientTimeoutError";
  }
}

async function withTimeout<T>(promise: Promise<T>, label: string, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new McpClientTimeoutError(label, timeoutMs)), timeoutMs);
        timer.unref();
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

function protocolEra(client: Client): McpProtocolEra {
  const era = client.getProtocolEra();
  return era === "modern" || era === "legacy" ? era : "unknown";
}

class SdkMcpClientFacade implements McpClientFacade {
  constructor(
    private readonly client: Client,
    readonly protocolEra: McpProtocolEra,
  ) {}

  async listTools(timeoutMs: number): Promise<readonly McpRemoteTool[]> {
    const result = await withTimeout(this.client.listTools(), "MCP tools/list", timeoutMs);
    return result.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema,
    }));
  }

  async listResources(timeoutMs: number): Promise<readonly McpRemoteResource[]> {
    const result = await withTimeout(this.client.listResources(), "MCP resources/list", timeoutMs);
    return result.resources.map((resource) => ({
      uri: resource.uri,
      name: resource.name,
      description: resource.description,
      mimeType: resource.mimeType,
    }));
  }

  async callTool(
    name: string,
    args: Readonly<Record<string, unknown>>,
    timeoutMs: number,
  ): Promise<McpToolCallResult> {
    const result = await withTimeout(
      this.client.callTool({ name, arguments: { ...args } }),
      `MCP tools/call ${name}`,
      timeoutMs,
    );
    return result as McpToolCallResult;
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}

function splitAllowlist(raw: string | readonly string[]): ReadonlySet<string> {
  const values =
    typeof raw === "string"
      ? raw
          .split(",")
          .map((value) => value.trim())
          .filter((value) => value.length > 0)
      : [...raw];
  return new Set(values);
}

export class SdkMcpClientFactory implements McpClientFactory {
  private readonly stdioAllowlist: ReadonlySet<string>;

  constructor(
    private readonly credentials: McpCredentialReader | undefined,
    stdioAllowlist: string | readonly string[] = [],
  ) {
    this.stdioAllowlist = splitAllowlist(stdioAllowlist);
  }

  private secret(ref: string): string {
    const secret = this.credentials?.get(ref);
    if (secret === undefined) throw new McpCredentialMissingError(ref);
    return secret;
  }

  async connect(config: McpServerConfig, workspaceId: WorkspaceId): Promise<McpClientFacade> {
    const client = new Client(
      { name: "ecorione-connect", version: "0.1.0" },
      {
        versionNegotiation: { mode: "auto" },
        cachePartition: workspaceId,
        listMaxPages: 32,
      },
    );

    let transport: StreamableHTTPClientTransport | StdioClientTransport;
    if (config.transport.type === "streamable-http") {
      const credentialRef = config.transport.credentialRef;
      transport = new StreamableHTTPClientTransport(new URL(config.transport.url), {
        authProvider:
          credentialRef === undefined
            ? undefined
            : {
                token: async () => this.secret(credentialRef),
              },
      });
    } else {
      if (!this.stdioAllowlist.has(config.transport.command)) {
        throw new McpTransportDeniedError(
          `Command stdio MCP tidak ada di ECORIONE_MCP_STDIO_ALLOWLIST: ${config.transport.command}.`,
        );
      }
      const env: Record<string, string> = {
        ...getDefaultEnvironment(),
        ...config.transport.env,
      };
      if (
        config.transport.credentialRef !== undefined &&
        config.transport.credentialEnv !== undefined
      ) {
        env[config.transport.credentialEnv] = this.secret(config.transport.credentialRef);
      }
      transport = new StdioClientTransport({
        command: config.transport.command,
        args: [...config.transport.args],
        cwd: config.transport.cwd,
        env,
        stderr: "pipe",
      });
    }

    try {
      await withTimeout(client.connect(transport), `MCP connect ${config.id}`, config.connectTimeoutMs);
      return new SdkMcpClientFacade(client, protocolEra(client));
    } catch (error) {
      await client.close().catch(() => undefined);
      throw error;
    }
  }
}
