/**
 * Market Tool - Search and analyze Polymarket markets
 */

import { z } from "zod";
import { searchMarkets, getMarketDetails } from "../../api/polymarket";
import type { ToolDefinition, ToolResult } from "../tool";
import type { AgentContext } from "../tool";

// Import helper functions from assistant.ts
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getMarketPrice: fetchMarketPrice, getOrderBook: fetchOrderBook } = require("../../api/assistant") as {
  getMarketPrice: (tokenId: string) => Promise<{ price: number; bid: number; ask: number } | null>;
  getOrderBook: (tokenId: string) => Promise<{ bids: { price: string; size: string }[]; asks: { price: string; size: string }[] }>;
};

// ─────────────────────────────────────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────────────────────────────────────

export const SearchMarketsSchema = z.object({
  query: z.string().describe("Search query for markets"),
  limit: z.number().optional().default(10).describe("Max results to return"),
});

export const GetMarketDetailsSchema = z.object({
  marketId: z.string().describe("The market ID"),
});

export const GetMarketPriceSchema = z.object({
  tokenId: z.string().describe("The token/outcome ID"),
});

export const GetOrderBookSchema = z.object({
  tokenId: z.string().describe("The token/outcome ID"),
});

export const AnalyzeMarketSchema = z.object({
  marketId: z.string().describe("The market ID to analyze"),
});

export const CompareOutcomesSchema = z.object({
  marketId: z.string().describe("The market ID"),
});

// ─────────────────────────────────────────────────────────────────────────────
// Prompts
// ─────────────────────────────────────────────────────────────────────────────

export const PROMPTS = {
  search_markets: {
    description: "Search for prediction markets by keyword",
    instructions: `Use this when:
- User asks to "find", "search", "look for" markets
- User mentions a topic they want to trade on
- User wants to explore markets about a specific subject

Example: "Find markets about AI" → search_markets({ query: "AI" })`,
    example: `search_markets({ query: "Bitcoin" })`,
  },

  get_market_details: {
    description: "Get detailed information about a specific market",
    instructions: `Use this when:
- User wants more info about a specific market
- User asks about volume, liquidity, outcomes
- User wants to see all outcomes and their prices

Always show: volume, liquidity, outcomes with prices.`,
    example: `get_market_details({ marketId: "abc123" })`,
  },

  get_market_price: {
    description: "Get the current price (bid/ask) for a specific token",
    instructions: `Use this when:
- User asks for current price
- Before placing an order to confirm price
- Checking if price has changed

Returns: price, bid, ask, spread.`,
    example: `get_market_price({ tokenId: "token123" })`,
  },

  get_order_book: {
    description: "Get the order book (bids and asks) for liquidity analysis",
    instructions: `Use this when:
- User wants to trade and you need to check liquidity
- Analyzing bid/ask spread
- Before placing orders to ensure good execution

Show: best bid, best ask, spread, top 5 levels each side.`,
    example: `get_order_book({ tokenId: "token123" })`,
  },

  analyze_market: {
    description: "Analyze a market for trading opportunities",
    instructions: `Use this to provide a comprehensive analysis:
- Current prices and probabilities
- Volume and liquidity assessment
- Risk evaluation
- Trading recommendation

Always include: volume > $100k = good liquidity check.`,
    example: `analyze_market({ marketId: "abc123" })`,
  },

  compare_outcomes: {
    description: "Compare outcomes within a market",
    instructions: `Use this to compare probabilities:
- Show all outcomes with prices
- Calculate implied probability
- Identify mispricings vs other markets`,
    example: `compare_outcomes({ marketId: "abc123" })`,
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Tool Implementations
// ─────────────────────────────────────────────────────────────────────────────

export async function searchMarketsTool(args: z.infer<typeof SearchMarketsSchema>, ctx: AgentContext): Promise<ToolResult> {
  try {
    const markets = await searchMarkets(args.query);
    const limited = markets.slice(0, args.limit ?? 10);

    return {
      success: true,
      data: {
        query: args.query,
        count: markets.length,
        returned: limited.length,
        markets: limited.map((m) => ({
          id: m.id,
          title: m.title,
          volume24h: m.volume24h,
          price: m.outcomes[0]?.price.toFixed(2) || "N/A",
          change24h: m.change24h,
          liquidity: m.liquidity,
        })),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Search failed",
    };
  }
}

export async function getMarketDetailsTool(args: z.infer<typeof GetMarketDetailsSchema>, ctx: AgentContext): Promise<ToolResult> {
  try {
    const market = await getMarketDetails(args.marketId);

    if (!market) {
      return { success: false, error: "Market not found" };
    }

    return {
      success: true,
      data: {
        id: market.id,
        title: market.title,
        description: market.description,
        volume24h: market.volume24h,
        volume: market.volume,
        liquidity: market.liquidity,
        change24h: market.change24h,
        outcomes: market.outcomes.map((o) => ({
          title: o.title,
          price: o.price.toFixed(2),
          volume: o.volume,
          liquidity: o.liquidity,
        })),
        resolutionDate: market.resolutionDate?.toISOString(),
        closed: market.closed,
        resolved: market.resolved,
        category: market.category,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get market details",
    };
  }
}

export async function getMarketPriceTool(args: z.infer<typeof GetMarketPriceSchema>, ctx: AgentContext): Promise<ToolResult> {
  try {
    const priceData = await fetchMarketPrice(args.tokenId);

    if (!priceData) {
      return { success: false, error: "Could not fetch price for this token" };
    }

    return {
      success: true,
      data: {
        tokenId: args.tokenId,
        price: priceData.price,
        bid: priceData.bid,
        ask: priceData.ask,
        spread: (priceData.ask - priceData.bid).toFixed(4),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get price",
    };
  }
}

export async function getOrderBookTool(args: z.infer<typeof GetOrderBookSchema>, ctx: AgentContext): Promise<ToolResult> {
  try {
    const orderBook = await fetchOrderBook(args.tokenId);

    return {
      success: true,
      data: {
        tokenId: args.tokenId,
        bids: orderBook.bids,
        asks: orderBook.asks,
        bestBid: orderBook.bids[0]?.price || null,
        bestAsk: orderBook.asks[0]?.price || null,
        spread: orderBook.bids[0] && orderBook.asks[0]
          ? (parseFloat(orderBook.asks[0].price) - parseFloat(orderBook.bids[0].price)).toFixed(4)
          : null,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get order book",
    };
  }
}

export async function analyzeMarketTool(args: z.infer<typeof AnalyzeMarketSchema>, ctx: AgentContext): Promise<ToolResult> {
  try {
    const market = await getMarketDetails(args.marketId);
    if (!market) {
      return { success: false, error: "Market not found" };
    }

    // Get price for first outcome
    const firstOutcome = market.outcomes[0];
    let orderBook = null;
    let priceData = null;

    if (firstOutcome) {
      try {
        priceData = await fetchMarketPrice(firstOutcome.id);
        orderBook = await fetchOrderBook(firstOutcome.id);
      } catch {
        // Ignore price fetching errors
      }
    }

    const liquidityRating = market.liquidity > 100000 ? "EXCELLENT" : market.liquidity > 50000 ? "GOOD" : market.liquidity > 10000 ? "FAIR" : "POOR";
    const spreadValue = orderBook?.bids[0] && orderBook?.asks[0]
      ? parseFloat(orderBook.asks[0].price) - parseFloat(orderBook.bids[0].price)
      : null;
    const spreadRating = spreadValue !== null ? (spreadValue < 0.02 ? "TIGHT" : spreadValue < 0.05 ? "MODERATE" : "WIDE") : "N/A";

    return {
      success: true,
      data: {
        market: {
          id: market.id,
          title: market.title,
          volume24h: market.volume24h,
          liquidity: market.liquidity,
          change24h: market.change24h,
          liquidityRating,
          spreadRating,
        },
        outcomes: market.outcomes.map((o) => ({
          title: o.title,
          price: o.price.toFixed(2),
          impliedProbability: (o.price * 100).toFixed(1) + "%",
        })),
        priceData: priceData ? {
          price: priceData.price,
          bid: priceData.bid,
          ask: priceData.ask,
          spread: spreadValue?.toFixed(4),
        } : null,
        recommendation: liquidityRating === "POOR"
          ? "AVOID - Low liquidity may cause slippage"
          : spreadRating === "WIDE"
          ? "CAUTION - Wide spread"
          : "LIQUID - Good for trading",
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Analysis failed",
    };
  }
}

export async function compareOutcomesTool(args: z.infer<typeof CompareOutcomesSchema>, ctx: AgentContext): Promise<ToolResult> {
  try {
    const market = await getMarketDetails(args.marketId);

    if (!market) {
      return { success: false, error: "Market not found" };
    }

    if (market.outcomes.length < 2) {
      return { success: false, error: "Not enough outcomes to compare" };
    }

    const totalProbability = market.outcomes.reduce((sum, o) => sum + o.price * 100, 0);

    return {
      success: true,
      data: {
        marketTitle: market.title,
        outcomes: market.outcomes.map((o) => ({
          title: o.title,
          price: o.price.toFixed(2),
          impliedProbability: (o.price * 100).toFixed(1) + "%",
          volume: o.volume,
          liquidity: o.liquidity,
        })).sort((a, b) => parseFloat(b.price) - parseFloat(a.price)),
        totalProbability: totalProbability.toFixed(1) + "%",
        analysis: totalProbability > 102
          ? "Sum > 100% indicates potential arbitrage opportunity"
          : totalProbability < 98
          ? "Sum < 100% indicates efficient pricing"
          : "Sum ≈ 100% indicates normal binary market",
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Comparison failed",
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool Definitions
// ─────────────────────────────────────────────────────────────────────────────

export const tools: ToolDefinition<z.ZodType>[] = [
  {
    id: "market.search_markets",
    name: "search_markets",
    category: "market",
    description: PROMPTS.search_markets.description,
    parameters: {} as unknown as z.ZodType,
    examples: [PROMPTS.search_markets.example],
    requiresWallet: false,
    executesTrade: false,
  },
  {
    id: "market.get_market_details",
    name: "get_market_details",
    category: "market",
    description: PROMPTS.get_market_details.description,
    parameters: {} as unknown as z.ZodType,
    examples: [PROMPTS.get_market_details.example],
    requiresWallet: false,
    executesTrade: false,
  },
  {
    id: "market.get_market_price",
    name: "get_market_price",
    category: "market",
    description: PROMPTS.get_market_price.description,
    parameters: {} as unknown as z.ZodType,
    examples: [PROMPTS.get_market_price.example],
    requiresWallet: false,
    executesTrade: false,
  },
  {
    id: "market.get_order_book",
    name: "get_order_book",
    category: "market",
    description: PROMPTS.get_order_book.description,
    parameters: {} as unknown as z.ZodType,
    examples: [PROMPTS.get_order_book.example],
    requiresWallet: false,
    executesTrade: false,
  },
  {
    id: "market.analyze_market",
    name: "analyze_market",
    category: "analysis",
    description: PROMPTS.analyze_market.description,
    parameters: {} as unknown as z.ZodType,
    examples: [PROMPTS.analyze_market.example],
    requiresWallet: false,
    executesTrade: false,
  },
  {
    id: "market.compare_outcomes",
    name: "compare_outcomes",
    category: "analysis",
    description: PROMPTS.compare_outcomes.description,
    parameters: {} as unknown as z.ZodType,
    examples: [PROMPTS.compare_outcomes.example],
    requiresWallet: false,
    executesTrade: false,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Execute Map
// ─────────────────────────────────────────────────────────────────────────────

export const executors: Record<string, (args: Record<string, unknown>, ctx: AgentContext) => Promise<ToolResult>> = {
  search_markets: async (args, ctx) => searchMarketsTool(args as z.infer<typeof SearchMarketsSchema>, ctx),
  get_market_details: async (args, ctx) => getMarketDetailsTool(args as z.infer<typeof GetMarketDetailsSchema>, ctx),
  get_market_price: async (args, ctx) => getMarketPriceTool(args as z.infer<typeof GetMarketPriceSchema>, ctx),
  get_order_book: async (args, ctx) => getOrderBookTool(args as z.infer<typeof GetOrderBookSchema>, ctx),
  analyze_market: async (args, ctx) => analyzeMarketTool(args as z.infer<typeof AnalyzeMarketSchema>, ctx),
  compare_outcomes: async (args, ctx) => compareOutcomesTool(args as z.infer<typeof CompareOutcomesSchema>, ctx),
};
