import { readFileSync, writeFileSync, existsSync } from "fs";
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

export interface MCPServerConfig {
  port?: number;
  apiKey?: string;
}

export class MCPServer {
  private tools: Map<string, MCPTool> = new Map();
  private handlers: Map<string, MCPHandler> = new Map();
  private resources: Map<string, MCPResource> = new Map();
  private resourceReaders: Map<string, () => Promise<string>> = new Map();
  private config: MCPServerConfig = {};

  constructor(private name: string = "polymarket-tui") {}

  setConfig(config: MCPServerConfig): void {
    this.config = { ...this.config, ...config };
  }

  registerTool(tool: MCPTool, handler: MCPHandler): void {
    this.tools.set(tool.name, tool);
    this.handlers.set(tool.name, handler);
  }

  registerResource(resource: MCPResource, reader: () => Promise<string>): void {
    this.resources.set(resource.uri, resource);
    this.resourceReaders.set(resource.uri, reader);
  }

  registerNativeTools(getMarkets: () => unknown, getPortfolio: () => unknown, getPositions: () => unknown): void {
    this.registerTool(
      {
        name: "get_markets",
        description: "Get list of trending markets from Polymarket",
        inputSchema: {
          type: "object",
          properties: {
            limit: { type: "number", description: "Number of markets to return (default 10)" },
            category: { type: "string", description: "Filter by category" },
          },
        },
      },
      async (params) => {
        const { limit = 10, category } = params as { limit?: number; category?: string };
        const markets = getMarkets() as { question: string; volume: number; id: string; outcomes: { outcome: string; price: number }[] }[];
        let filtered = markets;
        if (category) {
          filtered = filtered.filter((m: any) => m.category === category);
        }
        return filtered.slice(0, limit).map((m) => ({
          id: m.id,
          question: m.question,
          volume: m.volume,
          outcomes: m.outcomes?.map((o) => ({ outcome: o.outcome, price: o.price })),
        }));
      }
    );

    this.registerTool(
      {
        name: "get_portfolio",
        description: "Get user's portfolio summary with P&L",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      async () => {
        const portfolio = getPortfolio() as { totalValue: number; totalCashPnl: number; positionCount: number };
        return portfolio || { totalValue: 0, totalCashPnl: 0, positionCount: 0 };
      }
    );

    this.registerTool(
      {
        name: "get_positions",
        description: "Get user's current positions",
        inputSchema: {
          type: "object",
          properties: {
            minValue: { type: "number", description: "Minimum position value filter" },
          },
        },
      },
      async (params) => {
        const { minValue = 0 } = params as { minValue?: number };
        const positions = getPositions() as { outcome: string; currentValue: number; cashPnl: number }[];
        return (positions || [])
          .filter((p) => p.currentValue >= minValue)
          .map((p) => ({
            outcome: p.outcome,
            value: p.currentValue,
            pnl: p.cashPnl,
          }));
      }
    );

    this.registerTool(
      {
        name: "search_markets",
        description: "Search markets by keyword",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query" },
            limit: { type: "number", description: "Number of results (default 10)" },
          },
        },
      },
      async (params) => {
        const { query = "", limit = 10 } = params as { query?: string; limit?: number };
        const markets = getMarkets() as { question: string; id: string }[];
        const q = query.toLowerCase();
        return markets
          .filter((m: any) => m.question?.toLowerCase().includes(q))
          .slice(0, limit)
          .map((m: any) => ({ id: m.id, question: m.question }));
      }
    );

    this.registerTool(
      {
        name: "get_market_details",
        description: "Get detailed information about a specific market",
        inputSchema: {
          type: "object",
          properties: {
            marketId: { type: "string", description: "Market ID" },
          },
        },
      },
      async (params) => {
        const { marketId } = params as { marketId: string };
        const markets = getMarkets() as any[];
        const market = markets.find((m) => m.id === marketId);
        if (!market) return { error: "Market not found" };
        return {
          id: market.id,
          question: market.question,
          volume: market.volume,
          liquidity: market.liquidity,
          outcomes: market.outcomes,
          description: market.description,
        };
      }
    );

    this.registerResource(
      { uri: "portfolio://summary", name: "Portfolio Summary", mimeType: "application/json" },
      async () => JSON.stringify(getPortfolio(), null, 2)
    );

    this.registerResource(
      { uri: "positions://current", name: "Current Positions", mimeType: "application/json" },
      async () => JSON.stringify(getPositions(), null, 2)
    );
  }

  private checkApiKey(apiKey?: string): boolean {
    if (!this.config.apiKey) return true;
    return apiKey === this.config.apiKey;
  }

  async handleRequest(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    try {
      const apiKey = request.params?._apiKey as string | undefined;
      if (!this.checkApiKey(apiKey)) {
        return {
          jsonrpc: "2.0",
          id: request.id,
          error: { code: -32601, message: "Invalid API key" },
        };
      }

      const params = { ...request.params };
      delete params._apiKey;

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
          const toolParams = params as { name: string; arguments?: Record<string, unknown> };
          const handler = this.handlers.get(toolParams.name);
          if (!handler) {
            return {
              jsonrpc: "2.0",
              id: request.id,
              error: {
                code: -32601,
                message: `Tool not found: ${toolParams.name}`,
              },
            };
          }
          const result = await handler(toolParams.arguments || {});
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
          const rParams = params as { uri: string };
          const reader = this.resourceReaders.get(rParams.uri);
          if (!reader) {
            return {
              jsonrpc: "2.0",
              id: request.id,
              error: {
                code: -32601,
                message: `Resource not found: ${rParams.uri}`,
              },
            };
          }
          const content = await reader();
          return {
            jsonrpc: "2.0",
            id: request.id,
            result: {
              contents: [{ uri: rParams.uri, mimeType: "application/json", text: content }],
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
    const self = this;
    const server = Bun.serve({
      port: port || this.config.port || 3000,
      async fetch(req) {
        const url = new URL(req.url);
        if (url.pathname === "/mcp" && req.method === "POST") {
          const request = (await req.json()) as JSONRPCRequest;
          const response = await self.handleRequest(request);
          return new Response(JSON.stringify(response), {
            headers: { "Content-Type": "application/json" },
          });
        }
        if (url.pathname === "/health" && req.method === "GET") {
          return new Response(JSON.stringify({ status: "ok", server: self.name }), {
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
  const dir = join(homedir(), ".polymarket-tui");
  try {
    writeFileSync(path, JSON.stringify(rules, null, 2));
  } catch {
    console.error("Failed to save rules");
  }
}

export function getConfigPath(): string {
  return join(homedir(), ".polymarket-tui", "mcp.json");
}

export function loadMCPConfig(): MCPServerConfig {
  try {
    const path = getConfigPath();
    if (existsSync(path)) {
      return JSON.parse(readFileSync(path, "utf-8"));
    }
  } catch {}
  return {};
}

export function saveMCPConfig(config: MCPServerConfig): void {
  const path = getConfigPath();
  const dir = join(homedir(), ".polymarket-tui");
  try {
    writeFileSync(path, JSON.stringify(config, null, 2));
  } catch {
    console.error("Failed to save MCP config");
  }
}
