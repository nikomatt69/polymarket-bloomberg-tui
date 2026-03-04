/**
 * pmxtjs optional client wrappers.
 *
 * pmxtjs runs through the PMXT sidecar server and can expose additional
 * market primitives (markets, events, OHLCV, execution simulation) in a
 * normalized interface. We keep it optional and non-authoritative:
 * direct Polymarket APIs remain the primary data source in this project.
 */

import { Polymarket } from "pmxtjs";
import type { ExecutionPriceResult, OrderBook, PriceCandle, Trade, UnifiedMarket } from "pmxtjs";

export interface PmxtOrderBookSummary {
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
  lastTradeSide: "BUY" | "SELL" | null;
}

export interface PmxtClientOptions {
  baseUrl?: string;
  autoStartServer?: boolean;
}

let _client: Polymarket | null = null;
let _clientKey = "";

function optionsKey(options?: PmxtClientOptions): string {
  const baseUrl = options?.baseUrl ?? "";
  const autoStart = options?.autoStartServer === false ? "0" : "1";
  return `${baseUrl}|${autoStart}`;
}

function createClient(options?: PmxtClientOptions): Polymarket {
  return new Polymarket({
    ...(options?.baseUrl ? { baseUrl: options.baseUrl } : {}),
    ...(options?.autoStartServer === false ? { autoStartServer: false } : {}),
  });
}

export function getPolymarketPublicClient(options?: PmxtClientOptions): Polymarket {
  const key = optionsKey(options);
  if (!_client || _clientKey !== key) {
    _client = createClient(options);
    _clientKey = key;
  }
  return _client;
}

export async function closePolymarketClient(): Promise<void> {
  if (_client) {
    await _client.close();
    _client = null;
    _clientKey = "";
  }
}

function mapOrderBookToSummary(marketId: string, tokenId: string, book: OrderBook): PmxtOrderBookSummary {
  const bids = Array.isArray(book.bids) ? book.bids : [];
  const asks = Array.isArray(book.asks) ? book.asks : [];

  const bestBid = bids.length > 0 ? bids[0].price : null;
  const bestAsk = asks.length > 0 ? asks[0].price : null;
  const midpoint = bestBid !== null && bestAsk !== null
    ? (bestBid + bestAsk) / 2
    : bestBid ?? bestAsk;
  const spread = bestBid !== null && bestAsk !== null ? Math.max(0, bestAsk - bestBid) : null;
  const spreadBps = midpoint && spread !== null ? (spread / midpoint) * 10_000 : null;

  return {
    marketId,
    tokenId,
    bestBid,
    bestAsk,
    midpoint,
    spread,
    spreadBps,
    bidDepth: bids.reduce((sum, level) => sum + level.size, 0),
    askDepth: asks.reduce((sum, level) => sum + level.size, 0),
    minOrderSize: null,
    tickSize: null,
    updatedAt: book.timestamp ?? Date.now(),
    negRisk: false,
    lastTradePrice: midpoint,
    lastTradeSide: null,
  };
}

/**
 * Fetch order book via pmxtjs and map to the internal OrderBookSummary format.
 */
export async function fetchOrderBookViaPmxt(
  marketId: string,
  tokenId: string,
  options?: PmxtClientOptions,
): Promise<PmxtOrderBookSummary | null> {
  try {
    const client = getPolymarketPublicClient(options);
    const book: OrderBook = await client.fetchOrderBook(tokenId);
    return mapOrderBookToSummary(marketId, tokenId, book);
  } catch (err) {
    console.warn("pmxtjs fetchOrderBook failed:", err);
    return null;
  }
}

export async function fetchMarketViaPmxt(
  marketId: string,
  options?: PmxtClientOptions,
): Promise<UnifiedMarket | null> {
  try {
    const client = getPolymarketPublicClient(options);

    try {
      return await client.fetchMarket({ marketId });
    } catch {
      return await client.fetchMarket({ id: marketId });
    }
  } catch (err) {
    console.warn("pmxtjs fetchMarket failed:", err);
    return null;
  }
}

export async function fetchMarketsViaPmxt(
  params: { query?: string; limit?: number; offset?: number } = {},
  options?: PmxtClientOptions,
): Promise<UnifiedMarket[]> {
  try {
    const client = getPolymarketPublicClient(options);
    return await client.fetchMarkets(params);
  } catch (err) {
    console.warn("pmxtjs fetchMarkets failed:", err);
    return [];
  }
}

export async function fetchCandlesViaPmxt(
  tokenId: string,
  resolution: "1m" | "5m" | "15m" | "1h" | "6h" | "1d" = "1h",
  limit: number = 200,
  options?: PmxtClientOptions,
): Promise<PriceCandle[]> {
  try {
    const client = getPolymarketPublicClient(options);
    return await client.fetchOHLCV(tokenId, { resolution, limit });
  } catch (err) {
    console.warn("pmxtjs fetchOHLCV failed:", err);
    return [];
  }
}

export async function fetchTradesViaPmxt(
  tokenId: string,
  resolution: "1m" | "5m" | "15m" | "1h" | "6h" | "1d" = "1h",
  limit: number = 200,
  options?: PmxtClientOptions,
): Promise<Trade[]> {
  try {
    const client = getPolymarketPublicClient(options);
    return await client.fetchTrades(tokenId, { resolution, limit });
  } catch (err) {
    console.warn("pmxtjs fetchTrades failed:", err);
    return [];
  }
}

export async function getExecutionPriceViaPmxt(
  tokenId: string,
  side: "BUY" | "SELL",
  amount: number,
  options?: PmxtClientOptions,
): Promise<ExecutionPriceResult | null> {
  try {
    const client = getPolymarketPublicClient(options);
    const book = await client.fetchOrderBook(tokenId);
    return await client.getExecutionPriceDetailed(book, side === "BUY" ? "buy" : "sell", amount);
  } catch (err) {
    console.warn("pmxtjs getExecutionPrice failed:", err);
    return null;
  }
}
