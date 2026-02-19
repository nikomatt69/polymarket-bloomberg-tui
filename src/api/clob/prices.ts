/**
 * Polymarket CLOB API - Prices & Order Book
 * Base: https://clob.polymarket.com
 */

import { PriceHistory, PricePoint } from "../../types/market";

const CLOB_API_BASE = "https://clob.polymarket.com";

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

// ─────────────────────────────────────────────────────────────────────────────
// Price History API
// ─────────────────────────────────────────────────────────────────────────────

export async function getPriceHistory(
  marketId: string,
  timeframe: "1d" | "5d" | "7d" | "all" = "7d"
): Promise<PriceHistory | null> {
  try {
    // Import here to avoid circular dependency
    const { getMarketDetails } = await import("../gamma/markets");

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

// ─────────────────────────────────────────────────────────────────────────────
// Market Quotes API
// ─────────────────────────────────────────────────────────────────────────────

export async function getMarketQuotes(marketId: string): Promise<MarketQuote[]> {
  const { getMarketDetails } = await import("../gamma/markets");

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

    const data = (await response.json()) as ClobBookResponse;
    const bids = Array.isArray(data.bids) ? data.bids : [];
    const asks = Array.isArray(data.asks) ? data.asks : [];

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
// Current Price API
// ─────────────────────────────────────────────────────────────────────────────

export async function getCurrentPrice(tokenId: string): Promise<number | null> {
  try {
    const response = await fetch(`${CLOB_API_BASE}/price?token_id=${tokenId}`);
    if (!response.ok) return null;

    const data = (await response.json()) as { price?: number | string } | null;
    if (!data?.price) return null;

    const price = parseNumeric(data.price, 0);
    return price > 1 ? price / 100 : price;
  } catch {
    return null;
  }
}

export async function getMidpointPrice(tokenId: string): Promise<number | null> {
  try {
    const response = await fetch(`${CLOB_API_BASE}/midpoint?token_id=${tokenId}`);
    if (!response.ok) return null;

    const data = (await response.json()) as { midpoint?: number | string } | null;
    if (!data?.midpoint) return null;

    const price = parseNumeric(data.midpoint, 0);
    return price > 1 ? price / 100 : price;
  } catch {
    return null;
  }
}
