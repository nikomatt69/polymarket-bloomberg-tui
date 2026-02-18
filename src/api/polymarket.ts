/**
 * Polymarket API client for fetching market data
 * Uses Gamma API for markets and CLOB API for price history
 */

import { Market, Outcome, PriceHistory, PricePoint } from "../types/market";

const GAMMA_API_BASE = "https://gamma-api.polymarket.com";
const CLOB_API_BASE = "https://clob.polymarket.com";

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

export async function getMarkets(limit: number = 50): Promise<Market[]> {
  const response = await fetch(
    `${GAMMA_API_BASE}/markets?limit=${limit}&closed=false&order=volumeNum&ascending=false`
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

export async function getOrderBookSummary(tokenId: string): Promise<OrderBookSummary | null> {
  try {
    const response = await fetch(`${CLOB_API_BASE}/book?token_id=${tokenId}`);
    if (!response.ok) return null;

    const data = (await response.json()) as ClobBookResponse;
    const bids = Array.isArray(data.bids) ? data.bids : [];
    const asks = Array.isArray(data.asks) ? data.asks : [];

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

export async function searchMarkets(query: string): Promise<Market[]> {
  const allMarkets = await getMarkets(100);
  return allMarkets.filter(
    (m) =>
      m.title.toLowerCase().includes(query.toLowerCase()) ||
      (m.description && m.description.toLowerCase().includes(query.toLowerCase()))
  );
}
