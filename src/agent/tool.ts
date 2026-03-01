/**
 * Agent Tool Definitions - Nikcli-style structured tool registry for Polymarket
 */

import { z } from "zod";
import type { Market, Outcome } from "../types/market";

// ─────────────────────────────────────────────────────────────────────────────
// Context Types
// ─────────────────────────────────────────────────────────────────────────────

export interface TUIContext {
  // Market context
  selectedMarket: Market | null;
  selectedMarketId: string | null;
  selectedOutcome: Outcome | null;

  // UI State
  currentView: "market" | "portfolio";
  currentPanel: string | null;
  highlightedIndex: number;

  // Wallet
  walletConnected: boolean;
  walletAddress: string | null;
  balance: number;

  // Data counts
  marketsCount: number;
  positionsCount: number;
  openOrdersCount: number;
  watchlistCount: number;
  alertsCount: number;

  // Filters & Settings
  sortBy: "volume" | "change" | "name" | "liquidity" | "volatility";
  timeframe: "1h" | "4h" | "1d" | "5d" | "1w" | "1M" | "all";
  watchlistFilterActive: boolean;

  // Panels
  panels: {
    portfolio: boolean;
    orderForm: boolean;
    alerts: boolean;
    settings: boolean;
    orderHistory: boolean;
    watchlist: boolean;
    sentiment: boolean;
    indicators: boolean;
    comparison: boolean;
    accountStats: boolean;
  };
}

export interface AgentContext {
  sessionID: string;
  messageID: string;
  abort: AbortSignal;
  tuiContext: TUIContext;
  timestamp: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool Categories
// ─────────────────────────────────────────────────────────────────────────────

export type ToolCategory = "market" | "portfolio" | "order" | "alert" | "discovery" | "analysis" | "navigation" | "ui";

// ─────────────────────────────────────────────────────────────────────────────
// Tool Result Type
// ─────────────────────────────────────────────────────────────────────────────

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool Definition Interface
// ─────────────────────────────────────────────────────────────────────────────

export interface ToolDefinition<Params extends z.ZodType> {
  id: string;
  name: string;
  category: ToolCategory;
  description: string;
  parameters: Params;
  examples?: string[];
  requiresWallet?: boolean;
  executesTrade?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool Registry
// ─────────────────────────────────────────────────────────────────────────────

export namespace AgentTool {
  export type AnyParams = z.ZodType;
  export type Executor = (args: Record<string, unknown>, ctx: AgentContext) => Promise<ToolResult>;

  export interface Definition {
    id: string;
    name: string;
    category: ToolCategory;
    description: string;
    parameters: AnyParams;
    examples?: string[];
    requiresWallet: boolean;
    executesTrade: boolean;
    execute: Executor;
  }

  // Registry storage
  const registry = new Map<string, Definition>();

  export function register(tool: Definition): void {
    registry.set(tool.id, tool);
  }

  export function get(id: string): Definition | undefined {
    return registry.get(id);
  }

  export function getAll(): Definition[] {
    return Array.from(registry.values());
  }

  export function getByCategory(category: ToolCategory): Definition[] {
    return getAll().filter((t) => t.category === category);
  }

  export function getCategories(): ToolCategory[] {
    return ["market", "portfolio", "order", "alert", "discovery", "analysis", "navigation", "ui"];
  }

  export function getWalletTools(): Definition[] {
    return getAll().filter((t) => t.requiresWallet);
  }

  export function getTradingTools(): Definition[] {
    return getAll().filter((t) => t.executesTrade);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Zod Schemas for Tools
// ─────────────────────────────────────────────────────────────────────────────

// Market tools
export const searchMarketsParams = z.object({
  query: z.string().describe("Search query for markets"),
  limit: z.number().optional().default(10).describe("Max results to return"),
});

export const getMarketDetailsParams = z.object({
  marketId: z.string().describe("The market ID"),
});

export const getMarketPriceParams = z.object({
  tokenId: z.string().describe("The token/outcome ID"),
});

export const getOrderBookParams = z.object({
  tokenId: z.string().describe("The token/outcome ID"),
});

export const navigateToMarketParams = z.object({
  index: z.number().describe("The index number in the market list"),
});

// Portfolio tools
export const getPortfolioParams = z.object({});
export const getBalanceParams = z.object({});
export const getPositionsDetailsParams = z.object({});
export const getTradeHistoryParams = z.object({});
export const getOpenOrdersParams = z.object({});

// Watchlist tools
export const getWatchlistParams = z.object({});
export const addWatchlistParams = z.object({
  marketId: z.string().describe("The market ID to add"),
});
export const removeWatchlistParams = z.object({
  marketId: z.string().describe("The market ID to remove"),
});

// Alert tools
export const getAlertsParams = z.object({});
export const createAlertParams = z.object({
  marketId: z.string().describe("The market ID"),
  outcomeTitle: z.string().describe("The outcome title"),
  condition: z.enum(["above", "below"]).describe("Price condition"),
  threshold: z.number().describe("Price threshold (0-1)"),
  metric: z.enum(["price", "volume", "liquidity"]).optional().default("price"),
});
export const deleteAlertParams = z.object({
  alertId: z.string().describe("The alert ID to delete"),
});

// Order tools
export const placeOrderParams = z.object({
  tokenId: z.string().describe("The token/outcome ID to trade"),
  side: z.enum(["BUY", "SELL"]).describe("Buy or Sell"),
  price: z.number().describe("Price per share (e.g., 0.65 for 65%)"),
  shares: z.number().describe("Number of shares to trade"),
  marketTitle: z.string().optional().describe("The market title (optional, for display)"),
  outcomeTitle: z.string().optional().describe("The outcome title (optional, for display)"),
  postOnly: z.boolean().optional().default(false).describe("If true, order only matches if it doesn't cross the spread"),
  type: z.enum(["GTC", "FOK", "GTD"]).optional().default("GTC").describe("Order type"),
});

export const cancelOrderParams = z.object({
  orderId: z.string().describe("The order ID to cancel"),
});

// Discovery tools
export const getCategoriesParams = z.object({});
export const searchByCategoryParams = z.object({
  category: z.string().describe("Category to search (e.g., politics, sports, crypto, economics, entertainment)"),
});
export const getTrendingMarketsParams = z.object({
  limit: z.number().optional().default(20).describe("Max results"),
});
export const getSportsMarketsParams = z.object({});
export const getLiveEventsParams = z.object({});
export const getEventsParams = z.object({});
export const getSeriesMarketsParams = z.object({
  seriesSlug: z.string().describe("Series slug (e.g., nba, nfl, election-2024, crypto)"),
});
export const getAllSeriesParams = z.object({});
export const getAllTagsParams = z.object({});
export const getMarketsByTagParams = z.object({
  tagSlug: z.string().describe("Tag slug to filter markets"),
});

// Navigation & UI tools
export const setTimeframeParams = z.object({
  timeframe: z.enum(["1h", "4h", "1d", "5d", "1w", "1M", "all"]).describe("Timeframe"),
});
export const setSortByParams = z.object({
  sort: z.enum(["volume", "change", "name"]).describe("Sort method"),
});
export const refreshMarketsParams = z.object({});

// UI tools
export const openWalletModalParams = z.object({});
export const openPortfolioParams = z.object({});
export const openOrderFormParams = z.object({
  tokenId: z.string().describe("The token/outcome ID"),
  marketTitle: z.string().describe("The market title"),
  outcomeTitle: z.string().describe("The outcome title"),
  price: z.number().describe("Current price of the outcome"),
  side: z.enum(["BUY", "SELL"]).describe("Buy or Sell"),
});

// Analysis tools
export const analyzeMarketParams = z.object({
  marketId: z.string().describe("The market ID to analyze"),
});

export const compareOutcomesParams = z.object({
  marketId: z.string().describe("The market ID"),
});

// ─────────────────────────────────────────────────────────────────────────────
// Helper Types for Tool Results
// ─────────────────────────────────────────────────────────────────────────────

export interface MarketSearchResult {
  id: string;
  title: string;
  volume24h: number;
  price: string;
  change24h?: number;
}

export interface MarketDetailsResult {
  id: string;
  title: string;
  description?: string;
  volume24h: number;
  volume: number;
  liquidity: number;
  change24h: number;
  outcomes: Array<{
    title: string;
    price: string;
    volume: number;
    liquidity: number;
  }>;
  resolutionDate?: string;
  closed: boolean;
  resolved: boolean;
}

export interface PositionDetail {
  tokenId: string;
  outcomeTitle: string;
  marketTitle: string;
  size: number;
  avgPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
}

export interface OrderBookEntry {
  price: string;
  size: string;
}

export interface OrderDetails {
  orderId: string;
  side: string;
  price: number;
  shares: number;
  status: string;
}

export interface TradeDetails {
  orderId: string;
  side: string;
  price: number;
  size: number;
  timestamp: string;
  marketTitle: string;
  outcomeTitle: string;
}

export interface CategoryInfo {
  slug: string;
  name: string;
  marketsCount: number;
}

export interface EventInfo {
  id: string;
  title: string;
  seriesName?: string;
  status?: string;
  startDate?: string;
  marketsCount: number;
}

export interface SeriesInfo {
  id: string;
  slug: string;
  name: string;
  description?: string;
  category?: string;
}

export interface TagInfo {
  id: string;
  slug: string;
  name: string;
  category?: string;
}
