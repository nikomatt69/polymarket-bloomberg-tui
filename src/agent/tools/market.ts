/**
 * Market tools - market lookup, snapshots, and analysis.
 */

import { z } from "zod";
import {
  getCurrentPrice,
  getLastTradePrice,
  getMarketDepth,
  getMarketDetails,
  getOrderBookSummary,
  searchMarkets,
} from "../../api/polymarket";
import type { ToolDefinition, ToolResult } from "../tool";
import type { AgentContext } from "../tool";

export const SearchMarketsSchema = z.object({
  query: z.string().min(1).describe("Search query for markets"),
  limit: z.number().int().min(1).max(25).optional().default(10).describe("Max results to return"),
});

export const GetMarketDetailsSchema = z.object({
  marketId: z.string().min(1).describe("The market ID"),
});

export const GetMarketPriceSchema = z.object({
  tokenId: z.string().min(1).describe("The token or outcome ID"),
});

export const GetOrderBookSchema = z.object({
  tokenId: z.string().min(1).describe("The token or outcome ID"),
  levels: z.number().int().min(1).max(10).optional().default(5).describe("Book depth levels per side"),
});

export const AnalyzeMarketSchema = z.object({
  marketId: z.string().min(1).describe("The market ID to analyze"),
});

export const CompareOutcomesSchema = z.object({
  marketId: z.string().min(1).describe("The market ID"),
});

function computeFreshness(updatedAt: number | null): { stale: boolean; ageMs: number | null } {
  if (!updatedAt) {
    return { stale: true, ageMs: null };
  }

  const ageMs = Math.max(0, Date.now() - updatedAt);
  return {
    stale: ageMs > 30_000,
    ageMs,
  };
}

function getLiquidityRating(liquidity: number): "excellent" | "good" | "fair" | "poor" {
  if (liquidity >= 100_000) return "excellent";
  if (liquidity >= 50_000) return "good";
  if (liquidity >= 10_000) return "fair";
  return "poor";
}

function getSpreadRating(spreadBps: number | null): "tight" | "moderate" | "wide" | "unknown" {
  if (spreadBps === null) return "unknown";
  if (spreadBps < 100) return "tight";
  if (spreadBps < 250) return "moderate";
  return "wide";
}

async function buildMarketSnapshot(tokenId: string, levels: number = 5): Promise<ToolResult> {
  const [summary, depth, lastTrade, buyPrice, sellPrice] = await Promise.all([
    getOrderBookSummary(tokenId),
    getMarketDepth(tokenId, levels),
    getLastTradePrice(tokenId),
    getCurrentPrice(tokenId, "BUY"),
    getCurrentPrice(tokenId, "SELL"),
  ]);

  if (!summary) {
    return { success: false, error: "Unable to fetch a live order book snapshot for this token." };
  }

  const freshness = computeFreshness(summary.updatedAt);

  return {
    success: true,
    data: {
      tokenId,
      bestBid: summary.bestBid,
      bestAsk: summary.bestAsk,
      midpoint: summary.midpoint,
      spread: summary.spread,
      spreadBps: summary.spreadBps,
      bidDepth: summary.bidDepth,
      askDepth: summary.askDepth,
      minOrderSize: summary.minOrderSize,
      tickSize: summary.tickSize,
      negRisk: summary.negRisk,
      lastTradePrice: summary.lastTradePrice,
      lastTradeSide: lastTrade?.side ?? null,
      marketBuyPrice: buyPrice,
      marketSellPrice: sellPrice,
      stale: freshness.stale,
      snapshotAgeMs: freshness.ageMs,
      bids: depth?.bids ?? [],
      asks: depth?.asks ?? [],
    },
    metadata: {
      stale: freshness.stale,
    },
  };
}

export async function searchMarketsTool(args: z.infer<typeof SearchMarketsSchema>, _ctx: AgentContext): Promise<ToolResult> {
  try {
    const markets = await searchMarkets(args.query);
    const limited = markets.slice(0, args.limit ?? 10);
    return {
      success: true,
      data: {
        query: args.query,
        count: markets.length,
        returned: limited.length,
        markets: limited.map((market, index) => ({
          index,
          id: market.id,
          title: market.title,
          category: market.category,
          volume24h: market.volume24h,
          liquidity: market.liquidity,
          change24h: market.change24h,
          leadOutcome: market.outcomes[0]?.title ?? null,
          leadPrice: market.outcomes[0]?.price ?? null,
          closed: market.closed,
          resolved: market.resolved,
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

export async function getMarketDetailsTool(args: z.infer<typeof GetMarketDetailsSchema>, _ctx: AgentContext): Promise<ToolResult> {
  try {
    const market = await getMarketDetails(args.marketId);
    if (!market) {
      return { success: false, error: "Market not found." };
    }

    return {
      success: true,
      data: {
        id: market.id,
        title: market.title,
        description: market.description,
        category: market.category,
        volume24h: market.volume24h,
        volume: market.volume,
        liquidity: market.liquidity,
        change24h: market.change24h,
        closed: market.closed,
        resolved: market.resolved,
        resolutionDate: market.resolutionDate?.toISOString() ?? null,
        outcomes: market.outcomes.map((outcome) => ({
          tokenId: outcome.id,
          title: outcome.title,
          price: outcome.price,
          volume: outcome.volume,
          liquidity: outcome.liquidity,
        })),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to load market details",
    };
  }
}

export async function getMarketPriceTool(args: z.infer<typeof GetMarketPriceSchema>, _ctx: AgentContext): Promise<ToolResult> {
  return buildMarketSnapshot(args.tokenId, 1);
}

export async function getOrderBookTool(args: z.infer<typeof GetOrderBookSchema>, _ctx: AgentContext): Promise<ToolResult> {
  return buildMarketSnapshot(args.tokenId, args.levels ?? 5);
}

export async function analyzeMarketTool(args: z.infer<typeof AnalyzeMarketSchema>, _ctx: AgentContext): Promise<ToolResult> {
  try {
    const market = await getMarketDetails(args.marketId);
    if (!market) {
      return { success: false, error: "Market not found." };
    }

    const leadOutcome = market.outcomes[0] ?? null;
    const leadSnapshot = leadOutcome ? await buildMarketSnapshot(leadOutcome.id, 5) : null;
    const leadData = leadSnapshot?.success ? (leadSnapshot.data as Record<string, unknown>) : null;
    const spreadBps = typeof leadData?.spreadBps === "number" ? leadData.spreadBps : null;
    const liquidityRating = getLiquidityRating(market.liquidity);
    const spreadRating = getSpreadRating(spreadBps);
    const warnings: string[] = [];

    if (leadData?.stale === true) {
      warnings.push("Lead outcome quote is stale; refresh before trading.");
    }
    if (liquidityRating === "poor") {
      warnings.push("Low liquidity increases slippage and cancel risk.");
    }
    if (spreadRating === "wide") {
      warnings.push("Spread is wide; passive pricing is safer than crossing the book.");
    }

    return {
      success: true,
      data: {
        market: {
          id: market.id,
          title: market.title,
          category: market.category,
          volume24h: market.volume24h,
          liquidity: market.liquidity,
          change24h: market.change24h,
          closed: market.closed,
          resolved: market.resolved,
          resolutionDate: market.resolutionDate?.toISOString() ?? null,
          liquidityRating,
          spreadRating,
        },
        outcomes: market.outcomes.map((outcome) => ({
          tokenId: outcome.id,
          title: outcome.title,
          price: outcome.price,
          impliedProbability: outcome.price * 100,
          volume: outcome.volume,
          liquidity: outcome.liquidity,
        })),
        leadSnapshot: leadData,
        warnings,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Market analysis failed",
    };
  }
}

export async function compareOutcomesTool(args: z.infer<typeof CompareOutcomesSchema>, _ctx: AgentContext): Promise<ToolResult> {
  try {
    const market = await getMarketDetails(args.marketId);
    if (!market) {
      return { success: false, error: "Market not found." };
    }

    const probabilitySum = market.outcomes.reduce((sum, outcome) => sum + outcome.price, 0);

    return {
      success: true,
      data: {
        marketId: market.id,
        marketTitle: market.title,
        probabilitySum,
        probabilitySumPct: probabilitySum * 100,
        outcomes: market.outcomes
          .map((outcome) => ({
            tokenId: outcome.id,
            title: outcome.title,
            price: outcome.price,
            impliedProbability: outcome.price * 100,
            volume: outcome.volume,
            liquidity: outcome.liquidity,
          }))
          .sort((left, right) => right.price - left.price),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Outcome comparison failed",
    };
  }
}

export const tools: ToolDefinition<z.ZodType>[] = [
  {
    id: "market.search_markets",
    name: "search_markets",
    category: "discovery",
    description: "Search Polymarket markets by keyword and return the strongest matching results.",
    parameters: SearchMarketsSchema,
    examples: ["search_markets({ query: \"fed rates\", limit: 5 })"],
    riskLevel: "low",
    readOnly: true,
    requiresWallet: false,
    requiresSelectedMarket: false,
    requiresConfirmation: false,
    executesTrade: false,
    mutatesUi: false,
    enabledModes: ["scout", "analyst", "trader", "operator", "safe"],
  },
  {
    id: "market.get_market_details",
    name: "get_market_details",
    category: "market",
    description: "Fetch rich metadata and outcome pricing for one market.",
    parameters: GetMarketDetailsSchema,
    examples: ["get_market_details({ marketId: \"12345\" })"],
    riskLevel: "low",
    readOnly: true,
    requiresWallet: false,
    requiresSelectedMarket: false,
    requiresConfirmation: false,
    executesTrade: false,
    mutatesUi: false,
    enabledModes: ["scout", "analyst", "trader", "operator", "safe"],
  },
  {
    id: "market.get_market_price",
    name: "get_market_price",
    category: "market",
    description: "Get the latest executable quote context for one outcome token.",
    parameters: GetMarketPriceSchema,
    examples: ["get_market_price({ tokenId: \"1001\" })"],
    riskLevel: "low",
    readOnly: true,
    requiresWallet: false,
    requiresSelectedMarket: false,
    requiresConfirmation: false,
    executesTrade: false,
    mutatesUi: false,
    enabledModes: ["analyst", "trader", "operator", "safe"],
  },
  {
    id: "market.get_order_book",
    name: "get_order_book",
    category: "market",
    description: "Inspect live order book depth, spread, tick size, and minimum size for one token.",
    parameters: GetOrderBookSchema,
    examples: ["get_order_book({ tokenId: \"1001\", levels: 5 })"],
    riskLevel: "low",
    readOnly: true,
    requiresWallet: false,
    requiresSelectedMarket: false,
    requiresConfirmation: false,
    executesTrade: false,
    mutatesUi: false,
    enabledModes: ["analyst", "trader", "operator", "safe"],
  },
  {
    id: "market.analyze_market",
    name: "analyze_market",
    category: "analysis",
    description: "Summarize market quality, liquidity, spread, and tradability warnings.",
    parameters: AnalyzeMarketSchema,
    examples: ["analyze_market({ marketId: \"12345\" })"],
    riskLevel: "low",
    readOnly: true,
    requiresWallet: false,
    requiresSelectedMarket: false,
    requiresConfirmation: false,
    executesTrade: false,
    mutatesUi: false,
    enabledModes: ["analyst", "trader", "operator", "safe"],
  },
  {
    id: "market.compare_outcomes",
    name: "compare_outcomes",
    category: "analysis",
    description: "Compare all outcomes in one market and inspect implied probability structure.",
    parameters: CompareOutcomesSchema,
    examples: ["compare_outcomes({ marketId: \"12345\" })"],
    riskLevel: "low",
    readOnly: true,
    requiresWallet: false,
    requiresSelectedMarket: false,
    requiresConfirmation: false,
    executesTrade: false,
    mutatesUi: false,
    enabledModes: ["analyst", "trader", "operator", "safe"],
  },
];

export const executors: Record<string, (args: Record<string, unknown>, ctx: AgentContext) => Promise<ToolResult>> = {
  search_markets: async (args, ctx) => searchMarketsTool(SearchMarketsSchema.parse(args), ctx),
  get_market_details: async (args, ctx) => getMarketDetailsTool(GetMarketDetailsSchema.parse(args), ctx),
  get_market_price: async (args, ctx) => getMarketPriceTool(GetMarketPriceSchema.parse(args), ctx),
  get_order_book: async (args, ctx) => getOrderBookTool(GetOrderBookSchema.parse(args), ctx),
  analyze_market: async (args, ctx) => analyzeMarketTool(AnalyzeMarketSchema.parse(args), ctx),
  compare_outcomes: async (args, ctx) => compareOutcomesTool(CompareOutcomesSchema.parse(args), ctx),
};
