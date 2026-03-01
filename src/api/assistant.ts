/**
 * AI Assistant API integration using AI SDK (Vercel) with streaming
 * with tool calling support for Polymarket operations
 * Now uses the new agent module architecture
 */

import { streamText, tool, zodSchema } from "ai";
import { z } from "zod";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import {
  getActiveAIProvider,
  ChatMessage,
  ToolCall,
  appState,
  getSelectedMarket,
  navigateToIndex,
  setSortBy,
  setTimeframe,
  walletState,
  chatMessages,
  setChatMessages,
  chatLoading,
  setChatLoading,
} from "../state";
import { Timeframe } from "../types/market";
import {
  searchMarkets,
  getMarketDetails,
  getMarketsByCategory,
  getCategories,
  getActiveEvents,
  getMarketsBySeries,
  getMarketsByTag,
  getTrendingMarkets,
  getLiveSportsMarkets,
  getSeries,
  getTags,
} from "./polymarket";
import { fetchUserPositions } from "../hooks/usePositions";
import { loadAlerts, alertsState } from "../hooks/useAlerts";
import { toggleWatchlist, watchlistState } from "../hooks/useWatchlist";
import { setWalletModalOpen, setPortfolioOpen, setOrderFormOpen, setOrderFormSide, setOrderFormTokenId, setOrderFormMarketTitle, setOrderFormOutcomeTitle, setOrderFormCurrentPrice, setOrderFormPriceInput, setOrderFormSharesInput, setOrderFormPostOnly, setOrderFormFocusField } from "../state";
import { manualRefresh } from "../hooks/useMarketData";
import { placeOrder, cancelOrder, fetchOpenOrders, fetchTradeHistory } from "./orders";
import { positionsState } from "../hooks/usePositions";
import { getTUIContext, formatTUIContextForPrompt } from "../agent/context";
import { AgentSession } from "../agent/session";
import * as agentTools from "../agent/tools";

const DEFAULT_MODEL = "claude-sonnet-4-20250514";

const CLOB_BASE = "https://clob.polymarket.com";

// Helper function to fetch order book for a token
export async function getOrderBook(tokenId: string): Promise<{ bids: { price: string; size: string }[]; asks: { price: string; size: string }[] }> {
  try {
    const response = await fetch(`${CLOB_BASE}/orderbook?asset_id=${tokenId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch order book: ${response.status}`);
    }
    const data = (await response.json()) as { bids?: { price: string; size: string }[]; asks?: { price: string; size: string }[] };
    return {
      bids: (data.bids || []).slice(0, 10),
      asks: (data.asks || []).slice(0, 10),
    };
  } catch {
    return { bids: [], asks: [] };
  }
}

// Helper function to get current price for a token
export async function getMarketPrice(tokenId: string): Promise<{ price: number; bid: number; ask: number } | null> {
  try {
    const response = await fetch(`${CLOB_BASE}/prices?asset_id=${tokenId}`);
    if (!response.ok) return null;
    const data = (await response.json()) as Array<{ price?: string; bid?: string; ask?: string }>;
    if (Array.isArray(data) && data.length > 0) {
      return {
        price: parseFloat(data[0].price || "0"),
        bid: parseFloat(data[0].bid || "0"),
        ask: parseFloat(data[0].ask || "0"),
      };
    }
    return null;
  } catch {
    return null;
  }
}

// Helper function to get positions with PnL calculation
function getPositionsDetails(): { positions: Array<{
  tokenId: string;
  outcomeTitle: string;
  marketTitle: string;
  size: number;
  avgPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
}>; totalPnL: number } {
  const positions = positionsState.positions || [];
  let totalPnL = 0;

  const detailed = positions.map((pos) => {
    const size = pos.size || 0;
    const avgPrice = pos.avgPrice || 0;
    const currentPrice = pos.curPrice || avgPrice;
    const pnl = pos.cashPnl || 0;
    const pnlPercent = pos.percentPnl || 0;

    totalPnL += pnl;

    return {
      tokenId: pos.asset,
      outcomeTitle: pos.outcome || "Unknown",
      marketTitle: pos.title || "Unknown",
      size,
      avgPrice,
      currentPrice,
      pnl,
      pnlPercent,
    };
  });

  return { positions: detailed, totalPnL };
}

// Helper function to calculate optimal trade size based on balance
function calculateTradeSize(balance: number, riskPercent: number = 5, price?: number): number {
  const maxAmount = (balance * riskPercent) / 100;
  if (price && price > 0) {
    return Math.floor(maxAmount / price);
  }
  return Math.floor(maxAmount);
}

// Helper function to format market analysis for AI
function formatMarketAnalysis(market: {
  title: string;
  volume24h: number;
  liquidity: number;
  outcomes: Array<{ title: string; price: number; volume: number; liquidity: number }>;
}): string {
  const lines = [
    `📊 ${market.title}`,
    `Volume 24h: $${market.volume24h.toLocaleString()}`,
    `Liquidity: $${market.liquidity.toLocaleString()}`,
    "",
    "Outcomes:",
  ];

  for (const outcome of market.outcomes) {
    lines.push(
      `  • ${outcome.title}: ${outcome.price.toFixed(2)} (Vol: $${outcome.volume?.toLocaleString() || "N/A"})`
    );
  }

  return lines.join("\n");
}

function resolveAssistantModel():
  | { model: unknown; providerName: string; providerModelId: string }
  | { error: string } {
  const provider = getActiveAIProvider();
  if (!provider) {
    return { error: "No AI provider configured. Open Settings > PROVIDERS to configure one." };
  }

  const apiKey = (provider.apiKey ?? "").trim();
  if (!apiKey) {
    return {
      error: `Provider \"${provider.name}\" has no API key. Open Settings > PROVIDERS and add the key.`,
    };
  }

  const modelId = provider.model.trim() || DEFAULT_MODEL;
  const baseUrl = provider.baseUrl.trim();

  if (provider.kind === "anthropic") {
    const anthropic = createAnthropic({
      apiKey,
      baseURL: baseUrl,
    });
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      model: anthropic(modelId) as any,
      providerName: provider.name,
      providerModelId: modelId,
    };
  }

  const openai = createOpenAI({
    apiKey,
    baseURL: baseUrl,
    headers:
      provider.kind === "openrouter"
        ? {
            "HTTP-Referer": "https://polymarket-tui.local",
            "X-Title": "Polymarket Bloomberg TUI",
          }
        : undefined,
  });

  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model: openai(modelId) as any,
    providerName: provider.name,
    providerModelId: modelId,
  };
}

async function executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "search_markets": {
      const query = args.query as string;
      const markets = await searchMarkets(query);
      if (markets.length === 0) {
        return { success: true, message: `No markets found for "${query}"` };
      }
      const results = markets.slice(0, 10).map((m, i) => ({
        index: i,
        id: m.id,
        title: m.title,
        volume24h: m.volume24h,
        price: m.outcomes[0]?.price.toFixed(2) || "N/A",
      }));
      return { success: true, count: markets.length, markets: results };
    }

    case "get_market_details": {
      const marketId = args.marketId as string;
      const market = await getMarketDetails(marketId);
      if (!market) {
        return { success: false, error: "Market not found" };
      }
      return {
        success: true,
        market: {
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
        },
      };
    }

    case "get_portfolio": {
      if (!walletState.connected) {
        return { success: false, error: "Wallet not connected" };
      }
      await fetchUserPositions();
      return { success: true, message: "Portfolio panel opened" };
    }

    case "get_balance": {
      if (!walletState.connected) {
        return { success: false, error: "Wallet not connected" };
      }
      return { success: true, balance: walletState.balance };
    }

    case "get_watchlist": {
      return { success: true, marketIds: watchlistState.marketIds, count: watchlistState.marketIds.length };
    }

    case "add_watchlist": {
      const marketId = args.marketId as string;
      toggleWatchlist(marketId);
      return { success: true, message: `Added ${marketId} to watchlist` };
    }

    case "remove_watchlist": {
      const marketId = args.marketId as string;
      toggleWatchlist(marketId);
      return { success: true, message: `Removed ${marketId} from watchlist` };
    }

    case "get_alerts": {
      loadAlerts();
      const alerts = alertsState.alerts;
      return { success: true, count: alerts.length, alerts: alerts.map((a) => ({
        id: a.id,
        marketTitle: a.marketTitle,
        outcomeTitle: a.outcomeTitle,
        condition: a.condition,
        metric: a.metric,
        threshold: a.threshold,
        status: a.status,
      })) };
    }

    case "open_wallet_modal": {
      setWalletModalOpen(true);
      return { success: true, message: "Wallet modal opened" };
    }

    case "open_portfolio": {
      setPortfolioOpen(true);
      return { success: true, message: "Portfolio panel opened" };
    }

    case "open_order_form": {
      setOrderFormSide(args.side as "BUY" | "SELL");
      setOrderFormTokenId(args.tokenId as string);
      setOrderFormMarketTitle(args.marketTitle as string);
      setOrderFormOutcomeTitle(args.outcomeTitle as string);
      setOrderFormCurrentPrice(args.price as number);
      setOrderFormPriceInput((args.price as number).toFixed(4));
      setOrderFormSharesInput("");
      setOrderFormPostOnly(false);
      setOrderFormFocusField("shares");
      setOrderFormOpen(true);
      return { success: true, message: "Order form opened" };
    }

    case "navigate_to_market": {
      const index = args.index as number;
      navigateToIndex(index);
      const market = getSelectedMarket();
      return { success: true, message: `Navigated to: ${market?.title || "market"}` };
    }

    case "set_timeframe": {
      const timeframe = args.timeframe as Timeframe;
      setTimeframe(timeframe);
      return { success: true, message: `Timeframe set to ${timeframe}` };
    }

    case "set_sort_by": {
      const sort = args.sort as "volume" | "change" | "name";
      setSortBy(sort);
      return { success: true, message: `Sorted by ${sort}` };
    }

    case "refresh_markets": {
      manualRefresh();
      return { success: true, message: "Refreshing markets..." };
    }

    case "place_order": {
      if (!walletState.connected) {
        return { success: false, error: "Wallet not connected. Use open_wallet_modal first." };
      }
      const tokenId = args.tokenId as string;
      const side = args.side as "BUY" | "SELL";
      const price = args.price as number;
      const shares = args.shares as number;
      const marketTitle = args.marketTitle as string;
      const outcomeTitle = args.outcomeTitle as string;
      const postOnly = args.postOnly as boolean ?? false;

      if (!tokenId || !side || !price || !shares) {
        return { success: false, error: "Missing required parameters: tokenId, side, price, shares" };
      }

      try {
        const order = await placeOrder({
          tokenId,
          side,
          price,
          shares,
          type: "GTC",
          postOnly,
          marketTitle: marketTitle || "",
          outcomeTitle: outcomeTitle || "",
        });
        return {
          success: true,
          message: `Order placed successfully!`,
          order: {
            orderId: order.orderId,
            side: order.side,
            price: order.price,
            shares: order.originalSize,
            status: order.status,
          },
        };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Failed to place order" };
      }
    }

    case "get_order_book": {
      const tokenId = args.tokenId as string;
      if (!tokenId) {
        return { success: false, error: "tokenId is required" };
      }
      const orderBook = await getOrderBook(tokenId);
      return {
        success: true,
        tokenId,
        bids: orderBook.bids,
        asks: orderBook.asks,
        bestBid: orderBook.bids[0]?.price || null,
        bestAsk: orderBook.asks[0]?.price || null,
        spread: orderBook.bids[0] && orderBook.asks[0]
          ? (parseFloat(orderBook.asks[0].price) - parseFloat(orderBook.bids[0].price)).toFixed(4)
          : null,
      };
    }

    case "get_open_orders": {
      if (!walletState.connected) {
        return { success: false, error: "Wallet not connected" };
      }
      const orders = await fetchOpenOrders();
      return {
        success: true,
        count: orders.length,
        orders: orders.map((o) => ({
          orderId: o.orderId,
          tokenId: o.tokenId,
          side: o.side,
          price: o.price,
          size: o.originalSize,
          filled: o.sizeMatched,
          remaining: o.sizeRemaining,
          status: o.status,
          createdAt: new Date(o.createdAt).toISOString(),
          marketTitle: o.marketTitle,
          outcomeTitle: o.outcomeTitle,
        })),
      };
    }

    case "get_trade_history": {
      if (!walletState.connected) {
        return { success: false, error: "Wallet not connected" };
      }
      const trades = await fetchTradeHistory();
      return {
        success: true,
        count: trades.length,
        trades: trades.map((t) => ({
          orderId: t.orderId,
          tokenId: t.tokenId,
          side: t.side,
          price: t.price,
          size: t.originalSize,
          status: t.status,
          timestamp: new Date(t.createdAt).toISOString(),
          marketTitle: t.marketTitle,
          outcomeTitle: t.outcomeTitle,
        })),
      };
    }

    case "cancel_order": {
      if (!walletState.connected) {
        return { success: false, error: "Wallet not connected" };
      }
      const orderId = args.orderId as string;
      if (!orderId) {
        return { success: false, error: "orderId is required" };
      }
      try {
        await cancelOrder(orderId);
        return { success: true, message: `Order ${orderId} cancelled successfully` };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Failed to cancel order" };
      }
    }

    case "get_positions_details": {
      if (!walletState.connected) {
        return { success: false, error: "Wallet not connected" };
      }
      await fetchUserPositions();
      const details = getPositionsDetails();
      return {
        success: true,
        count: details.positions.length,
        totalPnL: details.totalPnL,
        positions: details.positions,
      };
    }

    case "get_market_price": {
      const tokenId = args.tokenId as string;
      if (!tokenId) {
        return { success: false, error: "tokenId is required" };
      }
      const priceData = await getMarketPrice(tokenId);
      if (!priceData) {
        return { success: false, error: "Could not fetch price for this token" };
      }
      return {
        success: true,
        tokenId,
        price: priceData.price,
        bid: priceData.bid,
        ask: priceData.ask,
        spread: (priceData.ask - priceData.bid).toFixed(4),
      };
    }

    case "search_by_category": {
      const category = args.category as string;
      if (!category) {
        return { success: false, error: "category is required" };
      }
      const markets = await getMarketsByCategory(category, 20);
      if (markets.length === 0) {
        return { success: true, message: `No markets found for category "${category}"`, count: 0, markets: [] };
      }
      return {
        success: true,
        count: markets.length,
        category,
        markets: markets.slice(0, 10).map((m) => ({
          id: m.id,
          title: m.title,
          volume24h: m.volume24h,
          price: m.outcomes[0]?.price.toFixed(2) || "N/A",
          category: m.category,
        })),
      };
    }

    case "get_categories": {
      const categories = await getCategories();
      return {
        success: true,
        count: categories.length,
        categories: categories.map((c) => ({
          slug: c.slug,
          name: c.name,
          marketsCount: c.marketsCount,
        })),
      };
    }

    case "get_live_events": {
      const events = await getActiveEvents(30);
      const liveEvents = events.filter((e) => e.status === "live");
      return {
        success: true,
        count: liveEvents.length,
        events: liveEvents.slice(0, 15).map((e) => ({
          id: e.id,
          title: e.title,
          seriesName: e.seriesName,
          startDate: e.startDate,
          endDate: e.endDate,
          marketsCount: e.markets.length,
        })),
      };
    }

    case "get_events": {
      const events = await getActiveEvents(50);
      return {
        success: true,
        count: events.length,
        events: events.slice(0, 20).map((e) => ({
          id: e.id,
          title: e.title,
          seriesName: e.seriesName,
          status: e.status,
          startDate: e.startDate,
          marketsCount: e.markets.length,
        })),
      };
    }

    case "get_sports_markets": {
      const markets = await getLiveSportsMarkets();
      if (markets.length === 0) {
        return { success: true, message: "No live sports markets found", count: 0, markets: [] };
      }
      return {
        success: true,
        count: markets.length,
        markets: markets.slice(0, 15).map((m) => ({
          id: m.id,
          title: m.title,
          volume24h: m.volume24h,
          liquidity: m.liquidity,
          outcomes: m.outcomes.slice(0, 2).map((o) => ({
            title: o.title,
            price: o.price.toFixed(2),
          })),
        })),
      };
    }

    case "get_trending_markets": {
      const markets = await getTrendingMarkets(20);
      return {
        success: true,
        count: markets.length,
        markets: markets.slice(0, 15).map((m) => ({
          id: m.id,
          title: m.title,
          volume24h: m.volume24h,
          change24h: m.change24h,
          price: m.outcomes[0]?.price.toFixed(2) || "N/A",
        })),
      };
    }

    case "get_series_markets": {
      const seriesSlug = args.seriesSlug as string;
      if (!seriesSlug) {
        return { success: false, error: "seriesSlug is required" };
      }
      const markets = await getMarketsBySeries(seriesSlug, 20);
      if (markets.length === 0) {
        return { success: true, message: `No markets found for series "${seriesSlug}"`, count: 0, markets: [] };
      }
      return {
        success: true,
        count: markets.length,
        seriesSlug,
        markets: markets.slice(0, 10).map((m) => ({
          id: m.id,
          title: m.title,
          volume24h: m.volume24h,
          price: m.outcomes[0]?.price.toFixed(2) || "N/A",
        })),
      };
    }

    case "get_all_series": {
      const series = await getSeries();
      return {
        success: true,
        count: series.length,
        series: series.map((s) => ({
          id: s.id,
          slug: s.slug,
          name: s.name,
          description: s.description,
          category: s.category,
        })),
      };
    }

    case "get_all_tags": {
      const tags = await getTags();
      return {
        success: true,
        count: tags.length,
        tags: tags.slice(0, 50).map((t) => ({
          id: t.id,
          slug: t.slug,
          name: t.name,
          category: t.category,
        })),
      };
    }

    case "get_markets_by_tag": {
      const tagSlug = args.tagSlug as string;
      if (!tagSlug) {
        return { success: false, error: "tagSlug is required" };
      }
      const markets = await getMarketsByTag(tagSlug, 20);
      if (markets.length === 0) {
        return { success: true, message: `No markets found for tag "${tagSlug}"`, count: 0, markets: [] };
      }
      return {
        success: true,
        count: markets.length,
        tagSlug,
        markets: markets.slice(0, 10).map((m) => ({
          id: m.id,
          title: m.title,
          volume24h: m.volume24h,
          price: m.outcomes[0]?.price.toFixed(2) || "N/A",
        })),
      };
    }

    default:
      return { success: false, error: `Unknown tool: ${name}` };
  }
}

// Zod schemas for tool parameters
const searchMarketsSchema = z.object({
  query: z.string().describe("Search query for markets"),
});

const getMarketDetailsSchema = z.object({
  marketId: z.string().describe("The market ID"),
});

const emptySchema = z.object({});

const addWatchlistSchema = z.object({
  marketId: z.string().describe("The market ID to add"),
});

const removeWatchlistSchema = z.object({
  marketId: z.string().describe("The market ID to remove"),
});

const openOrderFormSchema = z.object({
  tokenId: z.string().describe("The token/outcome ID"),
  marketTitle: z.string().describe("The market title"),
  outcomeTitle: z.string().describe("The outcome title"),
  price: z.number().describe("Current price of the outcome"),
  side: z.enum(["BUY", "SELL"]).describe("Buy or Sell"),
});

const navigateToMarketSchema = z.object({
  index: z.number().describe("The index number in the market list"),
});

const setTimeframeSchema = z.object({
  timeframe: z.enum(["1h", "4h", "1d", "5d", "1w", "1M", "all"]).describe("Timeframe"),
});

const setSortBySchema = z.object({
  sort: z.enum(["volume", "change", "name"]).describe("Sort method"),
});

const placeOrderSchema = z.object({
  tokenId: z.string().describe("The token/outcome ID to trade"),
  side: z.enum(["BUY", "SELL"]).describe("Buy or Sell"),
  price: z.number().describe("Price per share (e.g., 0.65 for 65%)"),
  shares: z.number().describe("Number of shares to trade"),
  marketTitle: z.string().optional().describe("The market title (optional, for display)"),
  outcomeTitle: z.string().optional().describe("The outcome title (optional, for display)"),
  postOnly: z.boolean().optional().describe("If true, order only matches if it doesn't cross the spread"),
});

const getOrderBookSchema = z.object({
  tokenId: z.string().describe("The token/outcome ID"),
});

const cancelOrderSchema = z.object({
  orderId: z.string().describe("The order ID to cancel"),
});

const getMarketPriceSchema = z.object({
  tokenId: z.string().describe("The token/outcome ID"),
});

const searchByCategorySchema = z.object({
  category: z.string().describe("Category to search (e.g., politics, sports, crypto, economics, entertainment)"),
});

const getSeriesMarketsSchema = z.object({
  seriesSlug: z.string().describe("Series slug (e.g., nba, nfl, election-2024, crypto)"),
});

const getMarketsByTagSchema = z.object({
  tagSlug: z.string().describe("Tag slug to filter markets"),
});

// Create tools using AI SDK's tool() helper with Zod schemas
const tools = {
  search_markets: tool({
    description: "Search for prediction markets by keyword",
    parameters: zodSchema(searchMarketsSchema),
    execute: async (args) => executeTool("search_markets", args as Record<string, unknown>),
  }),
  get_market_details: tool({
    description: "Get detailed information about a specific market",
    parameters: zodSchema(getMarketDetailsSchema),
    execute: async (args) => executeTool("get_market_details", args as Record<string, unknown>),
  }),
  get_portfolio: tool({
    description: "Get the user's current positions and portfolio",
    parameters: zodSchema(emptySchema),
    execute: async (args) => executeTool("get_portfolio", args as Record<string, unknown>),
  }),
  get_balance: tool({
    description: "Get the user's USDC wallet balance",
    parameters: zodSchema(emptySchema),
    execute: async (args) => executeTool("get_balance", args as Record<string, unknown>),
  }),
  get_watchlist: tool({
    description: "Get the user's watchlist",
    parameters: zodSchema(emptySchema),
    execute: async (args) => executeTool("get_watchlist", args as Record<string, unknown>),
  }),
  add_watchlist: tool({
    description: "Add a market to the user's watchlist",
    parameters: zodSchema(addWatchlistSchema),
    execute: async (args) => executeTool("add_watchlist", args as Record<string, unknown>),
  }),
  remove_watchlist: tool({
    description: "Remove a market from the user's watchlist",
    parameters: zodSchema(removeWatchlistSchema),
    execute: async (args) => executeTool("remove_watchlist", args as Record<string, unknown>),
  }),
  get_alerts: tool({
    description: "Get the user's price alerts",
    parameters: zodSchema(emptySchema),
    execute: async (args) => executeTool("get_alerts", args as Record<string, unknown>),
  }),
  open_wallet_modal: tool({
    description: "Open the wallet connection modal",
    parameters: zodSchema(emptySchema),
    execute: async (args) => executeTool("open_wallet_modal", args as Record<string, unknown>),
  }),
  open_portfolio: tool({
    description: "Open the portfolio panel",
    parameters: zodSchema(emptySchema),
    execute: async (args) => executeTool("open_portfolio", args as Record<string, unknown>),
  }),
  open_order_form: tool({
    description: "Open the order form for a specific outcome",
    parameters: zodSchema(openOrderFormSchema),
    execute: async (args) => executeTool("open_order_form", args as Record<string, unknown>),
  }),
  navigate_to_market: tool({
    description: "Navigate to a market by index in the list",
    parameters: zodSchema(navigateToMarketSchema),
    execute: async (args) => executeTool("navigate_to_market", args as Record<string, unknown>),
  }),
  set_timeframe: tool({
    description: "Set the chart timeframe",
    parameters: zodSchema(setTimeframeSchema),
    execute: async (args) => executeTool("set_timeframe", args as Record<string, unknown>),
  }),
  set_sort_by: tool({
    description: "Set the market sort method",
    parameters: zodSchema(setSortBySchema),
    execute: async (args) => executeTool("set_sort_by", args as Record<string, unknown>),
  }),
  refresh_markets: tool({
    description: "Refresh the market data",
    parameters: zodSchema(emptySchema),
    execute: async (args) => executeTool("refresh_markets", args as Record<string, unknown>),
  }),
  place_order: tool({
    description: "Place a real order (buy or sell) on Polymarket. Executes the trade immediately.",
    parameters: zodSchema(placeOrderSchema),
    execute: async (args) => executeTool("place_order", args as Record<string, unknown>),
  }),
  get_order_book: tool({
    description: "Get the order book (bids and asks) for a specific token to analyze liquidity and spread",
    parameters: zodSchema(getOrderBookSchema),
    execute: async (args) => executeTool("get_order_book", args as Record<string, unknown>),
  }),
  get_open_orders: tool({
    description: "Get all currently open orders (not yet filled or cancelled)",
    parameters: zodSchema(emptySchema),
    execute: async (args) => executeTool("get_open_orders", args as Record<string, unknown>),
  }),
  get_trade_history: tool({
    description: "Get the user's trade history (filled/executed trades)",
    parameters: zodSchema(emptySchema),
    execute: async (args) => executeTool("get_trade_history", args as Record<string, unknown>),
  }),
  cancel_order: tool({
    description: "Cancel a specific open order by its order ID",
    parameters: zodSchema(cancelOrderSchema),
    execute: async (args) => executeTool("cancel_order", args as Record<string, unknown>),
  }),
  get_positions_details: tool({
    description: "Get detailed information about current positions with PnL calculations",
    parameters: zodSchema(emptySchema),
    execute: async (args) => executeTool("get_positions_details", args as Record<string, unknown>),
  }),
  get_market_price: tool({
    description: "Get the current price (bid/ask) for a specific token",
    parameters: zodSchema(getMarketPriceSchema),
    execute: async (args) => executeTool("get_market_price", args as Record<string, unknown>),
  }),
  search_by_category: tool({
    description: "Search markets by category (politics, sports, crypto, economics, entertainment, science, etc.)",
    parameters: zodSchema(searchByCategorySchema),
    execute: async (args) => executeTool("search_by_category", args as Record<string, unknown>),
  }),
  get_categories: tool({
    description: "Get all available market categories",
    parameters: zodSchema(emptySchema),
    execute: async (args) => executeTool("get_categories", args as Record<string, unknown>),
  }),
  get_live_events: tool({
    description: "Get currently live/in-play events (live sports, ongoing events)",
    parameters: zodSchema(emptySchema),
    execute: async (args) => executeTool("get_live_events", args as Record<string, unknown>),
  }),
  get_events: tool({
    description: "Get all active events (live + upcoming)",
    parameters: zodSchema(emptySchema),
    execute: async (args) => executeTool("get_events", args as Record<string, unknown>),
  }),
  get_sports_markets: tool({
    description: "Get live sports markets (NBA, NFL, Soccer, UFC, etc.)",
    parameters: zodSchema(emptySchema),
    execute: async (args) => executeTool("get_sports_markets", args as Record<string, unknown>),
  }),
  get_trending_markets: tool({
    description: "Get trending/popular markets by volume",
    parameters: zodSchema(emptySchema),
    execute: async (args) => executeTool("get_trending_markets", args as Record<string, unknown>),
  }),
  get_series_markets: tool({
    description: "Get markets for a specific series (e.g., nba, nfl, election-2024, crypto)",
    parameters: zodSchema(getSeriesMarketsSchema),
    execute: async (args) => executeTool("get_series_markets", args as Record<string, unknown>),
  }),
  get_all_series: tool({
    description: "Get all available series (NBA, NFL, Elections, Crypto, etc.)",
    parameters: zodSchema(emptySchema),
    execute: async (args) => executeTool("get_all_series", args as Record<string, unknown>),
  }),
  get_all_tags: tool({
    description: "Get all available tags for market categorization",
    parameters: zodSchema(emptySchema),
    execute: async (args) => executeTool("get_all_tags", args as Record<string, unknown>),
  }),
  get_markets_by_tag: tool({
    description: "Get markets filtered by a specific tag",
    parameters: zodSchema(getMarketsByTagSchema),
    execute: async (args) => executeTool("get_markets_by_tag", args as Record<string, unknown>),
  }),
};

export interface AssistantMessage {
  role: "user" | "assistant";
  content: string;
}

export async function sendMessageToAssistantStream(
  onChunk?: (text: string) => void
): Promise<{ response: string; toolCalls?: ToolCall[] }> {
  const resolved = resolveAssistantModel();
  if ("error" in resolved) {
    return {
      response: resolved.error,
      toolCalls: [],
    };
  }

  const balance = walletState.balance;
  const systemPrompt = `You are a **Polymarket Trading Agent** - an AI-powered trading assistant for Polymarket prediction markets.

## Your Role
You are NOT just a chatbot. You are a trading agent that can ANALYZE markets, CALCULATE positions, and EXECUTE real trades on behalf of the user.

## Trading Capabilities
You have access to powerful trading tools:
- **place_order**: Execute real trades (BUY/SELL) with real money
- **get_order_book**: Analyze liquidity, bid/ask spread
- **get_market_price**: Get current prices
- **get_open_orders**: Monitor pending orders
- **get_trade_history**: Review past trades
- **cancel_order**: Manage/cancel open orders
- **get_positions_details**: View positions with PnL calculations
- **search_markets**: Find markets by keyword

## Market Discovery Capabilities
You can help users explore ALL types of Polymarket markets:
- **get_categories**: List all categories (politics, sports, crypto, economics, entertainment, science)
- **search_by_category**: Filter markets by category
- **get_trending_markets**: Show most popular markets by volume
- **get_sports_markets**: Find live sports markets (NBA, NFL, Soccer, UFC, etc.)
- **get_live_events**: Find currently live/in-play events
- **get_events**: List all active events (live + upcoming)
- **get_all_series**: Get series like NBA, NFL, Election markets, Crypto events
- **get_series_markets**: Get markets for a specific series
- **get_all_tags**: Get all available tags
- **get_markets_by_tag**: Filter markets by tag

## How to Help Users Explore Markets
- If user asks about "sports", use get_sports_markets
- If user asks about "trending" or "popular", use get_trending_markets
- If user asks about "live" or "in-play", use get_live_events
- If user asks about specific series (NBA, NFL, Crypto), use get_series_markets
- If user asks about categories, use get_categories first then search_by_category

## Trading Best Practices
1. **Before placing any trade**:
   - Always check the order book for liquidity (use get_order_book)
   - Analyze the spread - tight spreads = better execution
   - Never trade illiquid markets (low volume = slippage risk)

2. **Position Sizing** (IMPORTANT):
   - NEVER risk more than 5-10% of total balance on a single trade
   - Calculate position size: max_shares = (balance * 0.05) / price
   - Example: If balance is $1000 and price is $0.50, max shares = (1000 * 0.05) / 0.50 = 100 shares

3. **Risk Management**:
   - Prediction markets are binary options - treat them as such
   - Don't average down - each trade is independent
   - Set mental stop-losses (e.g., "if price drops 20%, consider exiting")

4. **Market Analysis**:
   - Volume matters: >$100k = good liquidity
   - Check 24h volume and change
   - Look for markets with tight bid/ask spreads (<0.02)

## Workflow for Trading Requests
When user wants to trade:
1. Ask for clarification if needed (which market, how much, which outcome)
2. Use get_order_book to check liquidity first
3. Use get_market_price to confirm current price
4. Calculate appropriate position size
5. Execute with place_order
6. Confirm execution results

## Current User State
- Wallet connected: ${walletState.connected}
- Current USDC balance: $${balance?.toFixed(2) || "0.00"}
- Markets loaded: ${appState.markets.length}
- Current sort: ${appState.sortBy}
- Current timeframe: ${appState.timeframe}
- Active provider: ${resolved.providerName}

## Agent Reasoning Loop (IMPORTANT)
You work in a LOOP of thinking → tool calling → observing results → thinking more → more tools → final answer.

1. **THINK**: Analyze the user's request and plan your approach
2. **ACT**: Call appropriate tools to gather data
3. **OBSERVE**: Look at the tool results carefully
4. **REFINE**: If needed, call more tools to get additional info
5. **ANSWER**: Provide a complete, actionable response

When exploring markets:
- Start by getting categories/series/tags to understand what's available
- Then fetch specific markets based on user's interests
- Analyze the results before responding

When trading:
- Check wallet balance first
- Get order book to check liquidity
- Calculate position size
- Place the order
- Confirm the result

## Guidelines
- Be proactive - suggest trades when you see opportunities
- Always warn about risks when placing trades
- Show your reasoning: "Let me check X first, then Y, then I'll do Z"
- If balance is low, inform the user
- Use get_positions_details to check existing positions before adding more to same market

IMPORTANT: When you call tools, show them in your response as:
-> tool_name: {"param": "value"} = result

This helps the user understand what you're doing.

Respond in the same language as the user. Be concise but thorough on trading matters.`;

  const messages = chatMessages();
  const aiMessages: { role: "user" | "assistant"; content: string }[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // Get TUI context for session
  const tuiContext = getTUIContext();

  try {
    const result = streamText({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      model: resolved.model as any,
      system: systemPrompt,
      messages: aiMessages,
      tools,
      maxSteps: 15,
      temperature: 0.7,
      onError: (error) => {
        console.error("Stream error:", error);
      },
    });

    let fullText = "";
    const toolCalls: ToolCall[] = [];

    // Process the stream and track tool calls
    for await (const chunk of result.textStream) {
      fullText += chunk;
      onChunk?.(chunk);
    }

    // Get tool calls from the result if available
    // The AI SDK executes tools automatically, but we can track them
    // by looking at tool call messages in the result

    return { response: fullText, toolCalls };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return {
      response: `Error: ${errorMessage}`,
      toolCalls: [],
    };
  }
}

export function getToolDefinitions() {
  return tools;
}
