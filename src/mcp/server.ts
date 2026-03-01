import { readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface MCPResource {
  uri: string;
  name: string;
  mimeType: string;
}

export interface JSONRPCRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface JSONRPCResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export type MCPHandler = (params: Record<string, unknown>) => Promise<unknown>;

export class MCPServer {
  private tools: Map<string, MCPTool> = new Map();
  private handlers: Map<string, MCPHandler> = new Map();
  private resources: Map<string, MCPResource> = new Map();
  private resourceReaders: Map<string, () => Promise<string>> = new Map();

  constructor(private name: string = "polymarket-tui") {}

  registerTool(tool: MCPTool, handler: MCPHandler): void {
    this.tools.set(tool.name, tool);
    this.handlers.set(tool.name, handler);
  }

  registerResource(resource: MCPResource, reader: () => Promise<string>): void {
    this.resources.set(resource.uri, resource);
    this.resourceReaders.set(resource.uri, reader);
  }

  async handleRequest(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    try {
      switch (request.method) {
        case "initialize": {
          return {
            jsonrpc: "2.0",
            id: request.id,
            result: {
              protocolVersion: "2024-11-05",
              capabilities: {
                tools: {},
                resources: {},
              },
              serverInfo: {
                name: this.name,
                version: "1.0.0",
              },
            },
          };
        }

        case "tools/list": {
          return {
            jsonrpc: "2.0",
            id: request.id,
            result: {
              tools: Array.from(this.tools.values()),
            },
          };
        }

        case "tools/call": {
          const params = request.params as { name: string; arguments?: Record<string, unknown> };
          const handler = this.handlers.get(params.name);
          if (!handler) {
            return {
              jsonrpc: "2.0",
              id: request.id,
              error: {
                code: -32601,
                message: `Tool not found: ${params.name}`,
              },
            };
          }
          const result = await handler(params.arguments || {});
          return {
            jsonrpc: "2.0",
            id: request.id,
            result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] },
          };
        }

        case "resources/list": {
          return {
            jsonrpc: "2.0",
            id: request.id,
            result: {
              resources: Array.from(this.resources.values()),
            },
          };
        }

        case "resources/read": {
          const params = request.params as { uri: string };
          const reader = this.resourceReaders.get(params.uri);
          if (!reader) {
            return {
              jsonrpc: "2.0",
              id: request.id,
              error: {
                code: -32601,
                message: `Resource not found: ${params.uri}`,
              },
            };
          }
          const content = await reader();
          return {
            jsonrpc: "2.0",
            id: request.id,
            result: {
              contents: [{ uri: params.uri, mimeType: "application/json", text: content }],
            },
          };
        }

        default:
          return {
            jsonrpc: "2.0",
            id: request.id,
            error: {
              code: -32601,
              message: `Method not found: ${request.method}`,
            },
          };
      }
    } catch (error) {
      return {
        jsonrpc: "2.0",
        id: request.id,
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : "Internal error",
          data: error,
        },
      };
    }
  }

  async runStdio(): Promise<void> {
    const { stdin, stdout } = await import("process");

    let buffer = "";
    stdin.setEncoding("utf8");

    stdin.on("data", (chunk) => {
      buffer += chunk;
      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        if (line.trim()) {
          try {
            const request = JSON.parse(line) as JSONRPCRequest;
            this.handleRequest(request).then((response) => {
              stdout.write(JSON.stringify(response) + "\n");
            });
          } catch {}
        }
      }
    });
  }

  async runHttp(port: number = 3000): Promise<void> {
    const server = Bun.serve({
      port,
      async fetch(req) {
        const url = new URL(req.url);
        if (url.pathname === "/mcp" && req.method === "POST") {
          const request = (await req.json()) as JSONRPCRequest;
          const response = await this.handleRequest(request);
          return new Response(JSON.stringify(response), {
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response("Not Found", { status: 404 });
      },
    });
    console.log(`MCP server running on http://localhost:${server.port}/mcp`);
  }
}

export function getRulesPath(): string {
  return join(homedir(), ".polymarket-tui", "rules.json");
}

export function loadRules(): unknown[] {
  try {
    const path = getRulesPath();
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return [];
  }
}

export function saveRules(rules: unknown[]): void {
  const path = getRulesPath();
  const dir = path.replace(/[/\\][^/\\]*$/, "");
  try {
    writeFileSync(path, JSON.stringify(rules, null, 2));
  } catch {
    console.error("Failed to save rules");
  }
}
