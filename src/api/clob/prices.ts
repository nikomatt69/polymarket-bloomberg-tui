/**
 * Polymarket CLOB API - Prices & Order Book
 * Base: https://clob.polymarket.com
 */

import { PriceHistory, PricePoint, Timeframe } from "../../types/market";
import {
  CLOB_BATCH_MARKET_DATA_LIMIT,
  CLOB_INTERVAL_BY_TIMEFRAME,
  buildClobMarketPriceBatchRequest,
  buildClobTokenBatchRequest,
  chunkArray,
} from "../queries";

const CLOB_API_BASE = "https://clob.polymarket.com";

// ─────────────────────────────────────────────────────────────────────────────
// Price History Cache
// ─────────────────────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  expires: number;
}

const priceHistoryCache = new Map<string, CacheEntry<PriceHistory>>();
const CACHE_TTL_MS = 60_000; // 1 minute

function getCacheKey(marketId: string, timeframe: Timeframe): string {
  return `${marketId}:${timeframe}`;
}

export async function getPriceHistoryCached(
  marketId: string,
  timeframe: Timeframe = "1d"
): Promise<PriceHistory | null> {
  const key = getCacheKey(marketId, timeframe);
  const cached = priceHistoryCache.get(key);

  if (cached && Date.now() < cached.expires) {
    return cached.data;
  }

  const result = await getPriceHistory(marketId, timeframe);

  if (result) {
    priceHistoryCache.set(key, {
      data: result,
      expires: Date.now() + CACHE_TTL_MS,
    });
  }

  return result;
}

export function clearPriceHistoryCache(): void {
  priceHistoryCache.clear();
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
  hash?: string;
  bids?: ClobBookLevel[];
  asks?: ClobBookLevel[];
  min_order_size?: string;
  tick_size?: string;
  neg_risk?: boolean;
  last_trade_price?: string;
}

interface ClobSinglePriceResponse {
  price?: string | number;
}

interface ClobPriceMapResponse {
  [tokenId: string]: Record<string, string | number> | undefined;
}

interface ClobMidpointMapResponse {
  [tokenId: string]: string | number | undefined;
}

interface ClobLastTradeResponse {
  price?: string | number;
  side?: "BUY" | "SELL" | "";
}

interface ClobBatchLastTradeResponseItem {
  token_id: string;
  price: string | number;
  side?: "BUY" | "SELL" | "";
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
  negRisk: boolean;
  lastTradePrice: number | null;
  hash?: string;
}

export interface LastTradeSnapshot {
  price: number;
  side: "BUY" | "SELL" | null;
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

function normalizeProbability(value: unknown, fallback: number = 0): number {
  const parsed = parseNumeric(value, fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed > 1 ? parsed / 100 : parsed;
}

function normalizeSide(value: unknown): "BUY" | "SELL" | null {
  return value === "BUY" || value === "SELL" ? value : null;
}

function toTimestampMs(value: string | number | undefined): number | null {
  if (value === undefined) return null;

  if (typeof value === "string" && /\D/.test(value)) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const parsed = parseNumeric(value, Number.NaN);
  if (!Number.isFinite(parsed)) return null;
  return parsed < 1_000_000_000_000 ? Math.round(parsed * 1000) : Math.round(parsed);
}

function buildOrderBookSummary(book: ClobBookResponse, fallbackTokenId: string): OrderBookSummary | null {
  const tokenId = book.asset_id ?? fallbackTokenId;
  if (!tokenId) return null;

  const bids = Array.isArray(book.bids) ? book.bids : [];
  const asks = Array.isArray(book.asks) ? book.asks : [];
  const bestBid = bids.length > 0 ? normalizeProbability(bids[0].price, 0) : null;
  const bestAsk = asks.length > 0 ? normalizeProbability(asks[0].price, 0) : null;
  const midpoint =
    bestBid !== null && bestAsk !== null
      ? (bestBid + bestAsk) / 2
      : bestBid !== null
        ? bestBid
        : bestAsk;
  const spread = bestBid !== null && bestAsk !== null ? Math.max(0, bestAsk - bestBid) : null;
  const spreadBps = midpoint !== null && midpoint > 0 && spread !== null ? (spread / midpoint) * 10_000 : null;

  return {
    marketId: book.market ?? "",
    tokenId,
    bestBid,
    bestAsk,
    midpoint,
    spread,
    spreadBps,
    bidDepth: bids.reduce((sum, level) => sum + parseNumeric(level.size, 0), 0),
    askDepth: asks.reduce((sum, level) => sum + parseNumeric(level.size, 0), 0),
    minOrderSize: book.min_order_size ? parseNumeric(book.min_order_size, 0) : null,
    tickSize: book.tick_size ? normalizeProbability(book.tick_size, 0) : null,
    updatedAt: toTimestampMs(book.timestamp),
    negRisk: book.neg_risk === true,
    lastTradePrice: book.last_trade_price ? normalizeProbability(book.last_trade_price, 0) : null,
    hash: book.hash,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Price History API
// ─────────────────────────────────────────────────────────────────────────────

export async function getPriceHistory(
  marketId: string,
  timeframe: Timeframe = "1d",
  startTs?: number,
  endTs?: number
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

    const priceHistoryParams = new URLSearchParams();
    priceHistoryParams.set("market", tokenId);
    priceHistoryParams.set("interval", CLOB_INTERVAL_BY_TIMEFRAME[timeframe]);
    if (startTs !== undefined) priceHistoryParams.set("startTs", String(startTs));
    if (endTs !== undefined) priceHistoryParams.set("endTs", String(endTs));

    const response = await fetch(
      `${CLOB_API_BASE}/prices-history?${priceHistoryParams.toString()}`
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
         return normalizeProbability(point.p, 0);
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
    return buildOrderBookSummary(data, tokenId);
  } catch {
    return null;
  }
}

export async function getOrderBookSummaries(tokenIds: string[]): Promise<Record<string, OrderBookSummary>> {
  const unique = Array.from(new Set(tokenIds.filter(Boolean)));
  if (unique.length === 0) return {};

  try {
    const result: Record<string, OrderBookSummary> = {};

    for (const batch of chunkArray(unique, CLOB_BATCH_MARKET_DATA_LIMIT)) {
      const body = JSON.stringify(buildClobTokenBatchRequest(batch));
      const response = await fetch(`${CLOB_API_BASE}/books`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      if (!response.ok) {
        // Fall back to individual calls for this batch
        const entries = await Promise.all(
          batch.map(async (tokenId) => [tokenId, await getOrderBookSummary(tokenId)] as const)
        );
        for (const [tokenId, summary] of entries) {
          if (summary) result[tokenId] = summary;
        }
        continue;
      }

      const data = await response.json();
      const books = Array.isArray(data) ? data : [];

      for (const bookData of books) {
        const book = bookData as ClobBookResponse;
        const summary = buildOrderBookSummary(book, book.asset_id ?? "");
        if (summary) {
          result[summary.tokenId] = summary;
        }
      }
    }

    return result;
  } catch {
    // Full fallback to individual calls
    const entries = await Promise.all(
      unique.map(async (tokenId) => [tokenId, await getOrderBookSummary(tokenId)] as const)
    );
    const result: Record<string, OrderBookSummary> = {};
    for (const [tokenId, summary] of entries) {
      if (summary) result[tokenId] = summary;
    }
    return result;
  }
}

export async function getBatchPrices(
  entriesOrTokenIds: string[] | Array<{ tokenId: string; side: "BUY" | "SELL" }>,
  defaultSide: "BUY" | "SELL" = "BUY",
): Promise<Record<string, number>> {
  if (entriesOrTokenIds.length === 0) return {};
  try {
    const result: Record<string, number> = {};

    const entries = typeof entriesOrTokenIds[0] === "string"
      ? (entriesOrTokenIds as string[]).map((tokenId) => ({ tokenId, side: defaultSide }))
      : (entriesOrTokenIds as Array<{ tokenId: string; side: "BUY" | "SELL" }>).filter((entry) => entry.tokenId.trim().length > 0);

    for (const batch of chunkArray(entries, CLOB_BATCH_MARKET_DATA_LIMIT)) {
      const body = JSON.stringify(buildClobMarketPriceBatchRequest(batch));
      const response = await fetch(`${CLOB_API_BASE}/prices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      if (!response.ok) continue;

      const data = (await response.json()) as ClobPriceMapResponse;
      for (const entry of batch) {
        const tokenPrices = data[entry.tokenId];
        if (!tokenPrices || typeof tokenPrices !== "object") continue;
        const rawPrice = tokenPrices[entry.side] ?? tokenPrices[defaultSide];
        if (rawPrice === undefined) continue;
        result[entry.tokenId] = normalizeProbability(rawPrice, 0);
      }
    }

    return result;
  } catch {
    return {};
  }
}

export async function getBatchMidpoints(tokenIds: string[]): Promise<Record<string, number>> {
  if (tokenIds.length === 0) return {};
  try {
    const result: Record<string, number> = {};

    for (const batch of chunkArray(tokenIds, CLOB_BATCH_MARKET_DATA_LIMIT)) {
      const response = await fetch(`${CLOB_API_BASE}/midpoints`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildClobTokenBatchRequest(batch)),
      });
      if (!response.ok) continue;

      const data = (await response.json()) as ClobMidpointMapResponse;
      for (const tokenId of batch) {
        const rawMidpoint = data[tokenId];
        if (rawMidpoint === undefined) continue;
        result[tokenId] = normalizeProbability(rawMidpoint, 0);
      }
    }

    return result;
  } catch {
    return {};
  }
}

export async function getLastTradeSnapshot(tokenId: string): Promise<LastTradeSnapshot | null> {
  try {
    const response = await fetch(`${CLOB_API_BASE}/last-trade-price?token_id=${tokenId}`);
    if (!response.ok) return null;

    const data = (await response.json()) as ClobLastTradeResponse | null;
    return {
      price: normalizeProbability(data?.price, 0.5),
      side: normalizeSide(data?.side),
    };
  } catch {
    return null;
  }
}

export async function getLastTradePrice(tokenId: string): Promise<number | null> {
  const snapshot = await getLastTradeSnapshot(tokenId);
  return snapshot?.price ?? null;
}

export async function getBatchLastTradeSnapshots(tokenIds: string[]): Promise<Record<string, LastTradeSnapshot>> {
  if (tokenIds.length === 0) return {};

  try {
    const result: Record<string, LastTradeSnapshot> = {};

    for (const batch of chunkArray(tokenIds, CLOB_BATCH_MARKET_DATA_LIMIT)) {
      const response = await fetch(`${CLOB_API_BASE}/last-trades-prices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildClobTokenBatchRequest(batch)),
      });
      if (!response.ok) continue;

      const data = (await response.json()) as ClobBatchLastTradeResponseItem[];
      if (!Array.isArray(data)) continue;

      for (const item of data) {
        result[item.token_id] = {
          price: normalizeProbability(item.price, 0.5),
          side: normalizeSide(item.side),
        };
      }
    }

    return result;
  } catch {
    return {};
  }
}

export async function getBatchLastTradePrices(tokenIds: string[]): Promise<Record<string, number>> {
  try {
    const snapshots = await getBatchLastTradeSnapshots(tokenIds);
    const result: Record<string, number> = {};
    for (const [tokenId, snapshot] of Object.entries(snapshots)) {
      result[tokenId] = snapshot.price;
    }
    return result;
  } catch {
    return {};
  }
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

export async function getCurrentPrice(tokenId: string, side: "BUY" | "SELL" = "BUY"): Promise<number | null> {
  try {
    const response = await fetch(`${CLOB_API_BASE}/price?token_id=${tokenId}&side=${side}`);
    if (!response.ok) return null;

    const data = (await response.json()) as ClobSinglePriceResponse | null;
    if (!data?.price) return null;

    return normalizeProbability(data.price, 0);
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

    return normalizeProbability(data.midpoint, 0);
  } catch {
    return null;
  }
}
