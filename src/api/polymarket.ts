/**
 * Polymarket API client for fetching market data
 * Uses Gamma API for markets and CLOB API for price history and trading
 */

import { Market, Outcome, PriceHistory, PricePoint, Event, Series, Tag, Category } from "../types/market";

const GAMMA_API_BASE = "https://gamma-api.polymarket.com";
const CLOB_API_BASE = "https://clob.polymarket.com";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface GammaMarket {
  id: string;
  question: string | null;
  conditionId: string;
  slug: string | null;
  endDate: string | null;
  category: string | null;
  liquidity: string | null;
  description: string | null;
  outcomes: string | null;
  outcomePrices: string | null;
  volume: string | null;
  active: boolean | null;
  closed: boolean | null;
  volumeNum: number | null;
  liquidityNum: number | null;
  volume24hr: number | null;
  oneDayPriceChange: number | null;
  clobTokenIds: string | null;
  groupItemTitle?: string | null;
  tags?: string[] | null;
}

interface GammaEvent {
  id: string;
  title: string;
  slug: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  seriesId?: string;
  seriesTitle?: string;
  markets?: GammaMarket[];
  tags?: string[];
  active?: boolean;
}

interface GammaSeries {
  id: string;
  slug: string;
  title: string;
  description?: string;
  imageUrl?: string;
  category?: string;
}

interface GammaTag {
  id: string;
  slug: string;
  name: string;
  category?: string;
}

interface ClobPriceHistoryResponse {
  history?: Array<{ t: number; p: number | string }>;
}

interface ClobBookLevel {
  price: string;
  size: string;
}

interface ClobBookResponse {
  market?: string;
  asset_id?: string;
  timestamp?: string;
  bids?: ClobBookLevel[];
  asks?: ClobBookLevel[];
  min_order_size?: string;
  tick_size?: string;
  neg_risk?: boolean;
}

export interface OrderBookSummary {
  marketId: string;
  tokenId: string;
  bestBid: number | null;
  bestAsk: number | null;
  midpoint: number | null;
  spread: number | null;
  spreadBps: number | null;
  bidDepth: number;
  askDepth: number;
  minOrderSize: number | null;
  tickSize: number | null;
  updatedAt: number | null;
}

export interface MarketQuote {
  tokenId: string;
  outcome: string;
  price: number;
  bid: number;
  ask: number;
  spread: number;
  volume24h: number;
  liquidity: number;
}

export interface MarketDepth {
  bids: Array<{ price: number; size: number; total: number }>;
  asks: Array<{ price: number; size: number; total: number }>;
  spread: number;
  midPrice: number;
}

export interface TradeInfo {
  orderId: string;
  side: "BUY" | "SELL";
  price: number;
  size: number;
  status: string;
  marketTitle: string;
  outcomeTitle: string;
  timestamp: string;
}

export interface PositionInfo {
  asset: string;
  outcome: string;
  marketId: string;
  marketTitle: string;
  size: number;
  avgPrice: number;
  curPrice: number;
  cashPnl: number;
  percentPnl: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

function parseNumeric(value: unknown, fallback: number = 0): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function parseJsonArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function parseGammaMarket(market: GammaMarket): Market {
  const outcomes = parseJsonArray(market.outcomes);
  const outcomePrices = parseJsonArray(market.outcomePrices).map((value) => parseNumeric(value, 0.5));
  const clobTokenIds = parseJsonArray(market.clobTokenIds);

  const normalizedOutcomes = outcomes.length > 0 ? outcomes : ["Yes", "No"];

  const outcomeList: Outcome[] = normalizedOutcomes.map((title: string, i: number) => ({
    id: clobTokenIds[i] || `outcome_${i}`,
    title,
    price: parseNumeric(outcomePrices[i], 0.5),
    volume24h: 0,
    volume: 0,
    liquidity: 0,
    change24h: 0,
  }));

  return {
    id: market.id,
    title: market.question || "Unknown Market",
    description: market.description || "",
    outcomes: outcomeList,
    volume24h: parseNumeric(market.volume24hr, 0),
    volume: parseNumeric(market.volume, 0),
    liquidity: parseNumeric(market.liquidity, parseNumeric(market.liquidityNum, 0)),
    change24h: parseNumeric(market.oneDayPriceChange, 0),
    openInterest: 0,
    resolutionDate: market.endDate ? new Date(market.endDate) : undefined,
    totalTrades: 0,
    category: market.category || "general",
    closed: market.closed || false,
    resolved: false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Market Data API
// ─────────────────────────────────────────────────────────────────────────────

export async function getMarkets(limit: number = 50, offset: number = 0): Promise<Market[]> {
  const response = await fetch(
    `${GAMMA_API_BASE}/markets?limit=${limit}&offset=${offset}&closed=false&order=volumeNum&ascending=false`
  );

  if (!response.ok) {
    throw new Error(`Gamma API error: ${response.status}`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error("Unexpected Gamma API response format");
  }

  return data
    .map((item) => parseGammaMarket(item as GammaMarket))
    .filter((market) => market.outcomes.length > 0);
}

export async function getMarketDetails(marketId: string): Promise<Market | null> {
  try {
    const response = await fetch(`${GAMMA_API_BASE}/markets?id=${marketId}`);

    if (!response.ok) {
      throw new Error(`Gamma API error: ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      return null;
    }

    return parseGammaMarket(data[0]);
  } catch (error) {
    console.error("Failed to fetch market details:", error);
    return null;
  }
}

export async function getMarketsByCategory(category: string, limit: number = 50, offset: number = 0): Promise<Market[]> {
  try {
    const response = await fetch(
      `${GAMMA_API_BASE}/markets?limit=${limit}&offset=${offset}&closed=false&category=${encodeURIComponent(category)}&order=volumeNum&ascending=false`
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }

    return data
      .map((item) => parseGammaMarket(item as GammaMarket))
      .filter((market) => market.outcomes.length > 0);
  } catch (error) {
    console.error("Failed to fetch markets by category:", error);
    return [];
  }
}

export async function searchMarkets(query: string): Promise<Market[]> {
  const allMarkets = await getMarkets(100);
  return allMarkets.filter(
    (m) =>
      m.title.toLowerCase().includes(query.toLowerCase()) ||
      (m.description && m.description.toLowerCase().includes(query.toLowerCase()))
  );
}

export async function getTrendingMarkets(limit: number = 20): Promise<Market[]> {
  return getMarkets(limit);
}

// ─────────────────────────────────────────────────────────────────────────────
// Price History API
// ─────────────────────────────────────────────────────────────────────────────

export async function getPriceHistory(
  marketId: string,
  timeframe: "1d" | "5d" | "7d" | "all" = "7d"
): Promise<PriceHistory | null> {
  try {
    const marketDetails = await getMarketDetails(marketId);
    if (!marketDetails || marketDetails.outcomes.length === 0) {
      return null;
    }

    const tokenId = marketDetails.outcomes[0]?.id;
    if (!tokenId) {
      return null;
    }

    const intervalMap: Record<string, string> = {
      "1d": "1h",
      "5d": "6h",
      "7d": "1d",
      "all": "max",
    };

    const response = await fetch(
      `${CLOB_API_BASE}/prices-history?market=${tokenId}&interval=${intervalMap[timeframe]}`
    );

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as ClobPriceHistoryResponse;

    if (!data.history || !Array.isArray(data.history)) {
      return null;
    }

    const pricePoints: PricePoint[] = data.history.map((point) => ({
      timestamp: point.t * 1000,
      price: (() => {
        const raw = parseNumeric(point.p, 0);
        return raw > 1 ? raw / 100 : raw;
      })(),
      outcomeId: tokenId,
    }));

    if (pricePoints.length === 0) {
      return null;
    }

    return {
      marketId,
      outcomeId: tokenId,
      data: pricePoints,
      timeframe,
    };
  } catch (error) {
    console.error("Failed to fetch price history:", error);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Order Book API
// ─────────────────────────────────────────────────────────────────────────────

export async function getOrderBookSummary(tokenId: string): Promise<OrderBookSummary | null> {
  try {
    const response = await fetch(`${CLOB_API_BASE}/book?token_id=${tokenId}`);
    if (!response.ok) return null;

    const json = await response.json();
    if (!json) return null;

    const data = json as ClobBookResponse;
    const bids = Array.isArray(data?.bids) ? data.bids : [];
    const asks = Array.isArray(data?.asks) ? data.asks : [];

    const bestBid = bids.length > 0 ? parseNumeric(bids[0].price, 0) : null;
    const bestAsk = asks.length > 0 ? parseNumeric(asks[0].price, 0) : null;
    const midpoint =
      bestBid !== null && bestAsk !== null
        ? (bestBid + bestAsk) / 2
        : bestBid !== null
          ? bestBid
          : bestAsk;
    const spread = bestBid !== null && bestAsk !== null ? Math.max(0, bestAsk - bestBid) : null;
    const spreadBps =
      midpoint !== null && midpoint > 0 && spread !== null
        ? (spread / midpoint) * 10_000
        : null;
    const bidDepth = bids.reduce((sum, level) => sum + parseNumeric(level.size, 0), 0);
    const askDepth = asks.reduce((sum, level) => sum + parseNumeric(level.size, 0), 0);

    return {
      marketId: data.market ?? "",
      tokenId: data.asset_id ?? tokenId,
      bestBid,
      bestAsk,
      midpoint,
      spread,
      spreadBps,
      bidDepth,
      askDepth,
      minOrderSize: data.min_order_size ? parseNumeric(data.min_order_size, 0) : null,
      tickSize: data.tick_size ? parseNumeric(data.tick_size, 0) : null,
      updatedAt: data.timestamp ? new Date(data.timestamp).getTime() : null,
    };
  } catch {
    return null;
  }
}

export async function getOrderBookSummaries(tokenIds: string[]): Promise<Record<string, OrderBookSummary>> {
  const unique = Array.from(new Set(tokenIds.filter(Boolean)));
  if (unique.length === 0) return {};

  const entries = await Promise.all(
    unique.map(async (tokenId) => [tokenId, await getOrderBookSummary(tokenId)] as const)
  );

  const result: Record<string, OrderBookSummary> = {};
  for (const [tokenId, summary] of entries) {
    if (summary) {
      result[tokenId] = summary;
    }
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Market Quotes API
// ─────────────────────────────────────────────────────────────────────────────

export async function getMarketQuotes(marketId: string): Promise<MarketQuote[]> {
  const market = await getMarketDetails(marketId);
  if (!market) return [];

  const quotes: MarketQuote[] = [];

  for (const outcome of market.outcomes) {
    const orderBook = await getOrderBookSummary(outcome.id);

    quotes.push({
      tokenId: outcome.id,
      outcome: outcome.title,
      price: outcome.price,
      bid: orderBook?.bestBid ?? outcome.price,
      ask: orderBook?.bestAsk ?? outcome.price,
      spread: orderBook?.spread ?? 0,
      volume24h: market.volume24h,
      liquidity: market.liquidity,
    });
  }

  return quotes;
}

// ─────────────────────────────────────────────────────────────────────────────
// Market Depth API
// ─────────────────────────────────────────────────────────────────────────────

export async function getMarketDepth(tokenId: string, levels: number = 10): Promise<MarketDepth | null> {
  try {
    const response = await fetch(`${CLOB_API_BASE}/book?token_id=${tokenId}`);
    if (!response.ok) return null;

    const json = await response.json();
    if (!json) return null;

    const data = json as ClobBookResponse;
    const bids = Array.isArray(data?.bids) ? data.bids : [];
    const asks = Array.isArray(data?.asks) ? data.asks : [];

    let bidTotal = 0;
    const bidLevels = bids.slice(0, levels).map((level) => {
      const size = parseNumeric(level.size, 0);
      bidTotal += size;
      return { price: parseNumeric(level.price, 0), size, total: bidTotal };
    });

    let askTotal = 0;
    const askLevels = asks.slice(0, levels).map((level) => {
      const size = parseNumeric(level.size, 0);
      askTotal += size;
      return { price: parseNumeric(level.price, 0), size, total: askTotal };
    });

    const bestBid = bidLevels[0]?.price ?? 0;
    const bestAsk = askLevels[0]?.price ?? 0;
    const spread = bestAsk - bestBid;
    const midPrice = (bestBid + bestAsk) / 2;

    return {
      bids: bidLevels,
      asks: askLevels,
      spread,
      midPrice,
    };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Events & Series API
// ─────────────────────────────────────────────────────────────────────────────

export async function getActiveEvents(limit: number = 50): Promise<Event[]> {
  try {
    const response = await fetch(
      `${GAMMA_API_BASE}/events?limit=${limit}&active=true`
    );

    if (!response.ok) {
      throw new Error(`Gamma API error: ${response.status}`);
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }

    return data.map((item: GammaEvent) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      slug: item.slug,
      startDate: item.startDate,
      endDate: item.endDate,
      seriesId: item.seriesId,
      seriesName: item.seriesTitle,
      markets: (item.markets || []).map((m) => parseGammaMarket(m)).filter((market) => market.outcomes.length > 0),
      tags: item.tags,
      status: item.endDate && new Date(item.endDate) < new Date() ? "resolved" : (item.active ? "live" : "upcoming"),
    }));
  } catch (error) {
    console.error("Failed to fetch active events:", error);
    return [];
  }
}

export async function getMarketsBySeries(seriesSlug: string, limit: number = 50): Promise<Market[]> {
  try {
    const response = await fetch(
      `${GAMMA_API_BASE}/markets?limit=${limit}&closed=false&series=${encodeURIComponent(seriesSlug)}&order=volumeNum&ascending=false`
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }

    return data
      .map((item) => parseGammaMarket(item as GammaMarket))
      .filter((market) => market.outcomes.length > 0);
  } catch (error) {
    console.error("Failed to fetch markets by series:", error);
    return [];
  }
}

export async function getMarketsByTag(tagSlug: string, limit: number = 50): Promise<Market[]> {
  try {
    const response = await fetch(
      `${GAMMA_API_BASE}/markets?limit=${limit}&closed=false&tag=${encodeURIComponent(tagSlug)}&order=volumeNum&ascending=false`
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }

    return data
      .map((item) => parseGammaMarket(item as GammaMarket))
      .filter((market) => market.outcomes.length > 0);
  } catch (error) {
    console.error("Failed to fetch markets by tag:", error);
    return [];
  }
}

export async function getSeries(): Promise<Series[]> {
  try {
    const response = await fetch(`${GAMMA_API_BASE}/series`);

    if (!response.ok) {
      throw new Error(`Gamma API error: ${response.status}`);
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }

    return data.map((item: GammaSeries) => ({
      id: item.id,
      slug: item.slug,
      name: item.title,
      description: item.description,
      imageUrl: item.imageUrl,
      category: item.category,
    }));
  } catch (error) {
    console.error("Failed to fetch series:", error);
    return [];
  }
}

export async function getTags(): Promise<Tag[]> {
  try {
    const response = await fetch(`${GAMMA_API_BASE}/tags`);

    if (!response.ok) {
      throw new Error(`Gamma API error: ${response.status}`);
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }

    return data.map((item: GammaTag) => ({
      id: item.id,
      slug: item.slug,
      name: item.name,
      category: item.category,
    }));
  } catch (error) {
    console.error("Failed to fetch tags:", error);
    return [];
  }
}

export async function getCategories(): Promise<Category[]> {
  try {
    const response = await fetch(`${GAMMA_API_BASE}/categories`);

    if (!response.ok) {
      throw new Error(`Gamma API error: ${response.status}`);
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }

    return data.map((item: { category?: string; slug?: string; count?: number }) => ({
      slug: item.category || item.slug || "",
      name: item.category || item.slug || "",
      marketsCount: item.count || 0,
    }));
  } catch (error) {
    console.error("Failed to fetch categories:", error);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sports Markets API
// ─────────────────────────────────────────────────────────────────────────────

export async function getLiveSportsMarkets(): Promise<Market[]> {
  try {
    const response = await fetch(
      `${GAMMA_API_BASE}/markets?limit=200&closed=false&order=volumeNum&ascending=false`
    );

    if (!response.ok) {
      throw new Error(`Gamma API error: ${response.status}`);
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }

    const sportsKeywords = [
      "nba", "nfl", "nhl", "mlb", "ncaa", "soccer", "football",
      "basketball", "baseball", "hockey", "ufc", "mma", "tennis",
      "golf", "boxing", "cricket", "rugby", "world cup", "olympics"
    ];

    return data
      .map((item) => parseGammaMarket(item as GammaMarket))
      .filter((market) => {
        if (market.outcomes.length === 0) return false;
        const titleLower = market.title.toLowerCase();
        const categoryLower = (market.category || "").toLowerCase();
        return sportsKeywords.some((kw) => titleLower.includes(kw) || categoryLower.includes(kw));
      })
      .slice(0, 50);
  } catch (error) {
    console.error("Failed to fetch live sports markets:", error);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Token Info API
// ─────────────────────────────────────────────────────────────────────────────

export interface TokenInfo {
  assetId: string;
  symbol: string;
  name: string;
  decimals: number;
  color: string;
  icon?: string;
}

export async function getTokenInfo(tokenId: string): Promise<TokenInfo | null> {
  try {
    const response = await fetch(`${CLOB_API_BASE}/token?asset_id=${tokenId}`);
    if (!response.ok) return null;

    const data = (await response.json()) as Record<string, unknown>;
    return {
      assetId: (data.asset_id as string) ?? tokenId,
      symbol: (data.symbol as string) ?? "UNKNOWN",
      name: (data.name as string) ?? "Unknown Token",
      decimals: parseNumeric(data.decimals, 6),
      color: (data.color as string) ?? "#000000",
      icon: data.icon as string | undefined,
    };
  } catch {
    return null;
  }
}

export async function getMultipleTokenInfo(tokenIds: string[]): Promise<Record<string, TokenInfo>> {
  const unique = Array.from(new Set(tokenIds.filter(Boolean)));
  const results: Record<string, TokenInfo> = {};

  await Promise.all(
    unique.map(async (tokenId) => {
      const info = await getTokenInfo(tokenId);
      if (info) {
        results[tokenId] = info;
      }
    })
  );

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Market Status API
// ─────────────────────────────────────────────────────────────────────────────

export interface MarketStatus {
  marketId: string;
  status: "open" | "closed" | "resolved" | "pending";
  resolvedOutcome?: string;
  resolutionDate?: string;
}

export async function getMarketStatus(marketId: string): Promise<MarketStatus | null> {
  try {
    const response = await fetch(`${GAMMA_API_BASE}/markets?id=${marketId}`);
    if (!response.ok) return null;

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    const market = data[0];

    return {
      marketId,
      status: market.closed ? "closed" : market.resolved ? "resolved" : "open",
      resolvedOutcome: market.resolvedOutcome ?? undefined,
      resolutionDate: market.endDate ?? undefined,
    };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Global Metrics API
// ─────────────────────────────────────────────────────────────────────────────

export interface GlobalMetrics {
  totalVolume24h: number;
  totalMarkets: number;
  activeMarkets: number;
  topCategories: Array<{ category: string; volume: number }>;
}

export async function getGlobalMetrics(): Promise<GlobalMetrics> {
  try {
    const [markets, categories] = await Promise.all([
      getMarkets(100),
      getCategories(),
    ]);

    const totalVolume24h = markets.reduce((sum, m) => sum + m.volume24h, 0);
    const topCategories = categories
      .map((c) => ({
        category: c.name,
        volume: c.marketsCount * 1000000, // Estimate
      }))
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 5);

    return {
      totalVolume24h,
      totalMarkets: markets.length,
      activeMarkets: markets.filter((m) => !m.closed).length,
      topCategories,
    };
  } catch {
    return {
      totalVolume24h: 0,
      totalMarkets: 0,
      activeMarkets: 0,
      topCategories: [],
    };
  }
}
