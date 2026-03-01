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
      fetch: async (req) => {
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

export function registerPolymarketTools(server: MCPServer): void {
  // ── Market data tools ──────────────────────────────────────────────────────

  server.registerTool(
    {
      name: "polymarket_get_markets",
      description: "Fetch top prediction markets from Polymarket",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "number", description: "Number of markets to fetch (default 20)" } },
      },
    },
    async (params) => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getMarkets } = require("../api/polymarket") as typeof import("../api/polymarket");
      return await getMarkets((params.limit as number) || 20);
    }
  );

  server.registerTool(
    {
      name: "polymarket_search_markets",
      description: "Search markets by keyword query",
      inputSchema: {
        type: "object",
        properties: { query: { type: "string", description: "Search keyword" } },
        required: ["query"],
      },
    },
    async (params) => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getMarkets } = require("../api/polymarket") as typeof import("../api/polymarket");
      const markets = await getMarkets(100);
      const q = ((params.query as string) || "").toLowerCase();
      return markets.filter(
        (m: { title: string; description?: string }) =>
          m.title.toLowerCase().includes(q) ||
          (m.description && m.description.toLowerCase().includes(q))
      );
    }
  );

  server.registerTool(
    {
      name: "polymarket_get_market_details",
      description: "Get detailed info for a specific market by ID",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string", description: "Market ID" } },
        required: ["id"],
      },
    },
    async (params) => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getMarketDetails } = require("../api/polymarket") as typeof import("../api/polymarket");
      return await getMarketDetails(params.id as string);
    }
  );

  server.registerTool(
    {
      name: "polymarket_get_price_history",
      description: "Get price history for a market",
      inputSchema: {
        type: "object",
        properties: {
          marketId: { type: "string", description: "Market ID" },
          timeframe: { type: "string", description: "Timeframe: 1h, 4h, 1d, 5d, 1w, 1M, all" },
        },
        required: ["marketId"],
      },
    },
    async (params) => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getPriceHistory } = require("../api/polymarket") as typeof import("../api/polymarket");
      return await getPriceHistory(params.marketId as string, ((params.timeframe as string) || "1d") as import("../types/market").Timeframe);
    }
  );

  // ── Order management tools ─────────────────────────────────────────────────

  server.registerTool(
    {
      name: "polymarket_place_order",
      description: "Place a buy or sell order on Polymarket",
      inputSchema: {
        type: "object",
        properties: {
          tokenId: { type: "string", description: "Outcome token ID" },
          side: { type: "string", enum: ["BUY", "SELL"] },
          price: { type: "number", description: "Price 0-1" },
          shares: { type: "number", description: "Number of shares" },
          orderType: { type: "string", enum: ["GTC", "FOK", "GTD"], description: "Order type" },
        },
        required: ["tokenId", "side", "price", "shares"],
      },
    },
    async (params) => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { placeOrder } = require("../api/orders") as typeof import("../api/orders");
      return await placeOrder({
        tokenId: params.tokenId as string,
        side: params.side as "BUY" | "SELL",
        price: params.price as number,
        shares: params.shares as number,
        type: ((params.orderType as string) || "GTC") as "GTC" | "FOK" | "GTD",
      });
    }
  );

  server.registerTool(
    {
      name: "polymarket_cancel_order",
      description: "Cancel an open order by order ID",
      inputSchema: {
        type: "object",
        properties: { orderId: { type: "string", description: "Order ID to cancel" } },
        required: ["orderId"],
      },
    },
    async (params) => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { cancelOrder } = require("../api/orders") as typeof import("../api/orders");
      return await cancelOrder(params.orderId as string);
    }
  );

  server.registerTool(
    {
      name: "polymarket_get_portfolio",
      description: "Fetch current portfolio positions",
      inputSchema: { type: "object", properties: {} },
    },
    async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { fetchUserPositions } = require("../hooks/usePositions") as typeof import("../hooks/usePositions");
      return await fetchUserPositions();
    }
  );

  server.registerTool(
    {
      name: "polymarket_get_orders",
      description: "Fetch open orders",
      inputSchema: { type: "object", properties: {} },
    },
    async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { fetchOpenOrders } = require("../api/orders") as typeof import("../api/orders");
      return await fetchOpenOrders();
    }
  );

  // ── Scanner tool ───────────────────────────────────────────────────────────

  server.registerTool(
    {
      name: "polymarket_scan_markets",
      description: "Run market scanner for volume spikes, price movements, and arbitrage opportunities",
      inputSchema: { type: "object", properties: {} },
    },
    async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { MarketScanner } = require("../automation/scanner") as typeof import("../automation/scanner");
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { appState } = require("../state") as typeof import("../state");
      const scanner = new MarketScanner();
      const marketInfos = appState.markets.map((m) => ({
        id: m.id,
        question: m.title,
        volume: m.volume24h,
        prices: m.outcomes.map((o) => o.price),
        outcomes: m.outcomes.map((o) => o.title),
        liquidity: m.liquidity,
      }));
      return scanner.scanMarkets(marketInfos);
    }
  );

  // ── News tool ──────────────────────────────────────────────────────────────

  server.registerTool(
    {
      name: "polymarket_get_news",
      description: "Fetch recent news articles filtered by query",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
          limit: { type: "number", description: "Max results (default 10)" },
        },
      },
    },
    async (params) => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { fetchNewsForQuery } = require("../api/news") as typeof import("../api/news");
      return await fetchNewsForQuery((params.query as string) || "", (params.limit as number) || 10);
    }
  );

  // ── Resources ──────────────────────────────────────────────────────────────

  server.registerResource(
    { uri: "polymarket://markets", name: "Current Markets", mimeType: "application/json" },
    async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { appState } = require("../state") as typeof import("../state");
      return JSON.stringify(appState.markets, null, 2);
    }
  );

  server.registerResource(
    { uri: "polymarket://portfolio", name: "Portfolio Positions", mimeType: "application/json" },
    async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { fetchUserPositions } = require("../hooks/usePositions") as typeof import("../hooks/usePositions");
      const positions = await fetchUserPositions();
      return JSON.stringify(positions, null, 2);
    }
  );

  server.registerResource(
    { uri: "polymarket://alerts", name: "Price Alerts", mimeType: "application/json" },
    async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { alertsState } = require("../hooks/useAlerts") as typeof import("../hooks/useAlerts");
      return JSON.stringify(alertsState.alerts, null, 2);
    }
  );
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
  try {
    writeFileSync(path, JSON.stringify(rules, null, 2));
  } catch {
    console.error("Failed to save rules");
  }
}
