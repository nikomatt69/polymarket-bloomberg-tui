/**
 * Backward-compatible Polymarket API facade.
 * Canonical implementations live under src/api/gamma and src/api/clob.
 */

import type {
  Category,
  Event,
  Market,
  PriceHistory,
  Series,
  Tag,
  Timeframe,
} from "../types/market";
import {
  clearPriceHistoryCache,
  getBatchLastTradeSnapshots,
  getBatchMidpoints,
  getBatchPrices,
  getCurrentPrice as getCanonicalCurrentPrice,
  getLastTradeSnapshot,
  getMarketDepth as getCanonicalMarketDepth,
  getMarketQuotes as getCanonicalMarketQuotes,
  getMidpointPrice as getCanonicalMidpointPrice,
  getOrderBookSummaries as getCanonicalOrderBookSummaries,
  getOrderBookSummary as getCanonicalOrderBookSummary,
  getPriceHistory as getCanonicalPriceHistory,
} from "./clob/prices";
import { CLOB_INTERVAL_BY_TIMEFRAME } from "./queries";
import type {
  LastTradeSnapshot,
  MarketDepth,
  MarketQuote,
  OrderBookSummary,
} from "./clob/prices";
import { getSpread as getCanonicalSpread, getSpreadsMap } from "./clob/misc";
import {
  getAllMarkets as getAllGammaMarkets,
  getLiveSportsMarkets as getLiveSportsGammaMarkets,
  getMarketDetails as getGammaMarketDetails,
  getMarkets as getGammaMarkets,
  getMarketsByCategory as getGammaMarketsByCategory,
  getTrendingMarkets as getGammaTrendingMarkets,
  searchMarkets as searchGammaMarkets,
} from "./gamma/markets";
import { getActiveEvents as getGammaActiveEvents } from "./gamma/events";
import { getCategories as getGammaCategories } from "./gamma/categories";
import { getSeries as getGammaSeries, getMarketsBySeries as getGammaMarketsBySeries } from "./gamma/series";
import { getTags as getGammaTags, getMarketsByTag as getGammaMarketsByTag } from "./gamma/tags";

const CLOB_API_BASE = "https://clob.polymarket.com";

export type { OrderBookSummary, MarketQuote, MarketDepth, LastTradeSnapshot };

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

export interface TokenInfo {
  assetId: string;
  symbol: string;
  name: string;
  decimals: number;
  color: string;
  icon?: string;
}

export interface MarketStatus {
  marketId: string;
  status: "open" | "closed" | "resolved" | "pending";
  resolvedOutcome?: string;
  resolutionDate?: string;
}

export interface GlobalMetrics {
  totalVolume24h: number;
  totalMarkets: number;
  activeMarkets: number;
  topCategories: Array<{ category: string; volume: number }>;
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

function dedupeMarkets(markets: Market[]): Market[] {
  const deduped = new Map<string, Market>();
  for (const market of markets) {
    if (!deduped.has(market.id)) {
      deduped.set(market.id, market);
    }
  }
  return Array.from(deduped.values());
}

function toUnixSeconds(value: Date | string | number | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "number") {
    return value > 1_000_000_000_000 ? Math.floor(value / 1000) : Math.floor(value);
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : undefined;
}

export function clearMarketCache(): void {
  clearPriceHistoryCache();
}

export async function getMarkets(limit: number = 50, offset: number = 0): Promise<Market[]> {
  try {
    return await getGammaMarkets(limit, offset);
  } catch (error) {
    console.error("Failed to fetch markets:", error);
    return [];
  }
}

export async function getAllMarkets(limit: number = 100, offset: number = 0): Promise<Market[]> {
  try {
    return await getAllGammaMarkets(limit, offset);
  } catch (error) {
    console.error("Failed to fetch all markets:", error);
    return [];
  }
}

export async function getMarketDetails(marketId: string): Promise<Market | null> {
  try {
    return await getGammaMarketDetails(marketId);
  } catch (error) {
    console.error("Failed to fetch market details:", error);
    return null;
  }
}

export async function getMarketsByCategory(category: string, limit: number = 50, offset: number = 0): Promise<Market[]> {
  try {
    return await getGammaMarketsByCategory(category, limit, offset);
  } catch (error) {
    console.error("Failed to fetch markets by category:", error);
    return [];
  }
}

export async function getAllMarketsByCategory(category: string, limit: number = 100, offset: number = 0): Promise<Market[]> {
  const allMarkets: Market[] = [];
  let currentOffset = offset;
  let previousBatchKey = "";

  while (true) {
    const batch = await getMarketsByCategory(category, limit, currentOffset);
    if (batch.length === 0) break;

    const batchKey = batch.map((market) => market.id).join(",");
    if (batchKey === previousBatchKey) break;

    allMarkets.push(...batch);
    previousBatchKey = batchKey;

    if (batch.length < limit) break;
    currentOffset += limit;
  }

  return dedupeMarkets(allMarkets);
}

export async function searchMarkets(query: string): Promise<Market[]> {
  try {
    return await searchGammaMarkets(query);
  } catch (error) {
    console.error("Failed to search markets:", error);
    return [];
  }
}

export async function getTrendingMarkets(limit: number = 20): Promise<Market[]> {
  try {
    return await getGammaTrendingMarkets(limit, 0);
  } catch (error) {
    console.error("Failed to fetch trending markets:", error);
    return [];
  }
}

export async function getPriceHistory(
  marketId: string,
  timeframe: Timeframe = "1d",
  tokenIdOrStart?: string | number | Date,
  startOrEnd?: Date | string | number,
  endTs?: Date | string | number,
): Promise<PriceHistory | null> {
  try {
    const tokenIdOverride = typeof tokenIdOrStart === "string"
      && (
        startOrEnd !== undefined
        || endTs !== undefined
        || Number.isNaN(Date.parse(tokenIdOrStart))
        || tokenIdOrStart.startsWith("0x")
        || tokenIdOrStart.startsWith("outcome_")
      )
      ? tokenIdOrStart
      : undefined;

    const startTs = tokenIdOverride ? toUnixSeconds(startOrEnd) : toUnixSeconds(tokenIdOrStart as Date | string | number | undefined);
    const resolvedEndTs = tokenIdOverride ? toUnixSeconds(endTs) : toUnixSeconds(startOrEnd);

    if (!tokenIdOverride) {
      return await getCanonicalPriceHistory(marketId, timeframe, startTs, resolvedEndTs);
    }

    const params = new URLSearchParams();
    params.set("market", tokenIdOverride);
    params.set("interval", CLOB_INTERVAL_BY_TIMEFRAME[timeframe]);
    if (startTs !== undefined) params.set("startTs", String(startTs));
    if (resolvedEndTs !== undefined) params.set("endTs", String(resolvedEndTs));

    const response = await fetch(`${CLOB_API_BASE}/prices-history?${params.toString()}`);
    if (!response.ok) return null;

    const data = (await response.json()) as { history?: Array<{ t: number; p: number | string }> };
    if (!Array.isArray(data.history) || data.history.length === 0) return null;

    return {
      marketId,
      outcomeId: tokenIdOverride,
      timeframe,
      data: data.history.map((point) => ({
        timestamp: point.t * 1000,
        price: normalizeProbability(point.p, 0),
        outcomeId: tokenIdOverride,
      })),
    };
  } catch (error) {
    console.error("Failed to fetch price history:", error);
    return null;
  }
}

export async function getOrderBookSummary(tokenId: string): Promise<OrderBookSummary | null> {
  try {
    return await getCanonicalOrderBookSummary(tokenId);
  } catch {
    return null;
  }
}

export async function getOrderBookSummaries(tokenIds: string[]): Promise<Record<string, OrderBookSummary>> {
  try {
    return await getCanonicalOrderBookSummaries(tokenIds);
  } catch {
    return {};
  }
}

export async function getCurrentPrice(tokenId: string, side: "BUY" | "SELL" = "BUY"): Promise<number | null> {
  try {
    return await getCanonicalCurrentPrice(tokenId, side);
  } catch {
    return null;
  }
}

export async function getBatchMarketPrices(
  entries: Array<{ tokenId: string; side: "BUY" | "SELL" }>,
): Promise<Record<string, number>> {
  try {
    return await getBatchPrices(entries);
  } catch {
    return {};
  }
}

export async function getMidpointPrice(tokenId: string): Promise<number | null> {
  try {
    return await getCanonicalMidpointPrice(tokenId);
  } catch {
    return null;
  }
}

export async function getMidpointPrices(tokenIds: string[]): Promise<Record<string, number>> {
  try {
    return await getBatchMidpoints(tokenIds);
  } catch {
    return {};
  }
}

export async function getLastTradePrice(tokenId: string): Promise<LastTradeSnapshot | null> {
  try {
    return await getLastTradeSnapshot(tokenId);
  } catch {
    return null;
  }
}

export async function getLastTradePrices(tokenIds: string[]): Promise<Record<string, LastTradeSnapshot>> {
  try {
    return await getBatchLastTradeSnapshots(tokenIds);
  } catch {
    return {};
  }
}

export async function getSpread(tokenId: string): Promise<number | null> {
  try {
    const response = await getCanonicalSpread(tokenId);
    return response ? normalizeProbability(response.spread, 0) : null;
  } catch {
    return null;
  }
}

export async function getSpreads(tokenIds: string[]): Promise<Record<string, number>> {
  try {
    return await getSpreadsMap(tokenIds);
  } catch {
    return {};
  }
}

export async function getMarketQuotes(marketId: string): Promise<MarketQuote[]> {
  try {
    return await getCanonicalMarketQuotes(marketId);
  } catch {
    return [];
  }
}

export async function getMarketDepth(tokenId: string, levels: number = 10): Promise<MarketDepth | null> {
  try {
    return await getCanonicalMarketDepth(tokenId, levels);
  } catch {
    return null;
  }
}

export async function getActiveEvents(limit: number = 50): Promise<Event[]> {
  try {
    return await getGammaActiveEvents(limit, 0);
  } catch (error) {
    console.error("Failed to fetch active events:", error);
    return [];
  }
}

export async function getMarketsBySeries(seriesSlug: string, limit: number = 50): Promise<Market[]> {
  try {
    return await getGammaMarketsBySeries(seriesSlug, limit);
  } catch (error) {
    console.error("Failed to fetch markets by series:", error);
    return [];
  }
}

export async function getMarketsByTag(tagSlug: string, limit: number = 50): Promise<Market[]> {
  try {
    return await getGammaMarketsByTag(tagSlug, limit, 0);
  } catch (error) {
    console.error("Failed to fetch markets by tag:", error);
    return [];
  }
}

export async function getSeries(): Promise<Series[]> {
  try {
    return await getGammaSeries();
  } catch (error) {
    console.error("Failed to fetch series:", error);
    return [];
  }
}

export async function getTags(): Promise<Tag[]> {
  try {
    return await getGammaTags();
  } catch (error) {
    console.error("Failed to fetch tags:", error);
    return [];
  }
}

export async function getCategories(): Promise<Category[]> {
  try {
    return await getGammaCategories();
  } catch (error) {
    console.error("Failed to fetch categories:", error);
    return [];
  }
}

export async function getLiveSportsMarkets(): Promise<Market[]> {
  try {
    return await getLiveSportsGammaMarkets();
  } catch (error) {
    console.error("Failed to fetch live sports markets:", error);
    return [];
  }
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
  const results: Record<string, TokenInfo> = {};

  await Promise.all(
    Array.from(new Set(tokenIds.filter(Boolean))).map(async (tokenId) => {
      const info = await getTokenInfo(tokenId);
      if (info) {
        results[tokenId] = info;
      }
    }),
  );

  return results;
}

export async function getMarketStatus(marketId: string): Promise<MarketStatus | null> {
  const market = await getMarketDetails(marketId);
  if (!market) return null;

  const status = market.resolved ? "resolved" : market.closed ? "closed" : market.outcomes.length > 0 ? "open" : "pending";

  return {
    marketId,
    status,
    resolutionDate: market.resolutionDate?.toISOString(),
  };
}

export async function getGlobalMetrics(): Promise<GlobalMetrics> {
  try {
    const markets = await getAllMarkets(200);
    const totalVolume24h = markets.reduce((sum, market) => sum + market.volume24h, 0);
    const categoryVolume = new Map<string, number>();

    for (const market of markets) {
      const key = (market.category ?? "general").trim() || "general";
      categoryVolume.set(key, (categoryVolume.get(key) ?? 0) + market.volume24h);
    }

    return {
      totalVolume24h,
      totalMarkets: markets.length,
      activeMarkets: markets.filter((market) => !market.closed).length,
      topCategories: Array.from(categoryVolume.entries())
        .map(([category, volume]) => ({ category, volume }))
        .sort((a, b) => b.volume - a.volume)
        .slice(0, 5),
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
