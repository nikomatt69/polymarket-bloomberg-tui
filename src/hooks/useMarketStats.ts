/**
 * Market Stats and Volume History Hook
 * Provides comprehensive market statistics and historical volume data
 */

import { createSignal, createEffect, onCleanup } from "solid-js";
import { getMarketStats, getHistoricalVolume, MarketStats, VolumeData } from "../api/clob/additional";
import { clobCircuitBreaker, dedupRequest } from "../api/clob/enhanced-book";

export interface EnhancedMarketStats extends MarketStats {
  // Derived metrics
  liquidityRatio: number; // liquidity / volume24hr
  turnoverRate: number; // volume24hr / openInterest
  priceVelocity: number; // Change in last 1h
  spreadScore: number; // 0-100, higher = tighter spread
  depthScore: number; // 0-100, higher = more depth
}

export interface VolumeProfile {
  hourlyVolumes: Map<number, number>; // hour timestamp -> volume
  dailyVolumes: Map<string, number>; // date string -> volume
  weeklyVolumes: Map<string, number>; // week string -> volume
  peakVolumeHour: number | null;
  peakVolumeDay: string | null;
  volumeDistribution: number[]; // Normalized volume per bucket
}

export interface UseMarketStatsOptions {
  tokenId: string;
  autoRefresh?: boolean;
  refreshIntervalMs?: number;
}

export interface UseMarketStatsResult {
  stats: () => EnhancedMarketStats | null;
  volumeHistory: () => VolumeData[];
  loading: () => boolean;
  error: () => string | null;
  lastUpdate: () => number | null;
  refresh: () => Promise<void>;
}

export interface UseVolumeHistoryOptions {
  marketId: string;
  timeframe?: "24h" | "7d" | "30d" | "all";
  autoRefresh?: boolean;
  refreshIntervalMs?: number;
}

export interface UseVolumeHistoryResult {
  volumeData: () => VolumeData[];
  volumeProfile: () => VolumeProfile | null;
  loading: () => boolean;
  error: () => string | null;
  refresh: () => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Market Stats Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useMarketStats(options: UseMarketStatsOptions): UseMarketStatsResult {
  const {
    tokenId,
    autoRefresh = true,
    refreshIntervalMs = 30_000, // 30 seconds
  } = options;

  const [stats, setStats] = createSignal<EnhancedMarketStats | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [lastUpdate, setLastUpdate] = createSignal<number | null>(null);

  const computeEnhancedStats = (raw: MarketStats): EnhancedMarketStats => {
    // Liquidity ratio
    const liquidityRatio = raw.volume24hr > 0 ? raw.liquidity / raw.volume24hr : 0;

    // Turnover rate (if openInterest available)
    const turnoverRate = raw.openInterest > 0 ? raw.volume24hr / raw.openInterest : 0;

    // Price velocity (simplified - based on last trade time)
    const lastTradeTime = raw.lastTradeTime ? new Date(raw.lastTradeTime).getTime() : Date.now();
    const minutesSinceTrade = (Date.now() - lastTradeTime) / 60_000;
    const priceVelocity = Math.max(0, 1 - minutesSinceTrade / 60); // Decays over 1 hour

    // Spread score (0-100)
    // Assuming we fetch spread separately, here we estimate from volume
    const spreadScore = raw.volume24hr > 1_000_000 ? 90 :
                        raw.volume24hr > 500_000 ? 75 :
                        raw.volume24hr > 100_000 ? 60 :
                        raw.volume24hr > 50_000 ? 45 : 30;

    // Depth score (0-100)
    const depthScore = raw.liquidity > 1_000_000 ? 95 :
                       raw.liquidity > 500_000 ? 80 :
                       raw.liquidity > 100_000 ? 60 :
                       raw.liquidity > 50_000 ? 40 : 20;

    return {
      ...raw,
      liquidityRatio,
      turnoverRate,
      priceVelocity,
      spreadScore,
      depthScore,
    };
  };

  const fetchStats = async () => {
    if (!tokenId) return;

    setLoading(true);
    setError(null);

    try {
      const rawStats = await dedupRequest(
        `stats:${tokenId}`,
        () => clobCircuitBreaker.execute(() => getMarketStats(tokenId))
      );

      if (rawStats) {
        const enhanced = computeEnhancedStats(rawStats);
        setStats(enhanced);
        setLastUpdate(Date.now());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch market stats");
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  createEffect(() => {
    void fetchStats();
  });

  // Auto-refresh
  createEffect(() => {
    if (!autoRefresh || !tokenId) return;

    const timer = setInterval(() => {
      void fetchStats();
    }, refreshIntervalMs);

    onCleanup(() => clearInterval(timer));
  });

  // For now, volume history is fetched separately
  const [volumeHistory, setVolumeHistory] = createSignal<VolumeData[]>([]);

  return {
    stats,
    volumeHistory,
    loading,
    error,
    lastUpdate,
    refresh: fetchStats,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Volume History Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useVolumeHistory(options: UseVolumeHistoryOptions): UseVolumeHistoryResult {
  const {
    marketId,
    timeframe = "7d",
    autoRefresh = true,
    refreshIntervalMs = 60_000, // 1 minute
  } = options;

  const [volumeData, setVolumeData] = createSignal<VolumeData[]>([]);
  const [volumeProfile, setVolumeProfile] = createSignal<VolumeProfile | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const buildVolumeProfile = (data: VolumeData[]): VolumeProfile => {
    const hourlyVolumes = new Map<number, number>();
    const dailyVolumes = new Map<string, number>();
    const weeklyVolumes = new Map<string, number>();

    let maxVolume = 0;
    let peakVolumeHour: number | null = null;
    let peakVolumeDay: string | null = null;

    for (const item of data) {
      const date = new Date(item.date);
      const hourTs = Math.floor(date.getTime() / (60 * 60 * 1000)) * 60 * 60 * 1000;
      const dayStr = date.toISOString().split("T")[0]!;
      const weekStr = getWeekString(date);

      // Aggregate hourly
      hourlyVolumes.set(hourTs, (hourlyVolumes.get(hourTs) ?? 0) + item.volume);

      // Aggregate daily
      dailyVolumes.set(dayStr, (dailyVolumes.get(dayStr) ?? 0) + item.volume);

      // Aggregate weekly
      weeklyVolumes.set(weekStr, (weeklyVolumes.get(weekStr) ?? 0) + item.volume);

      if (item.volume > maxVolume) {
        maxVolume = item.volume;
        peakVolumeHour = hourTs;
        peakVolumeDay = dayStr;
      }
    }

    // Compute volume distribution (normalize by max)
    const volumes = Array.from(dailyVolumes.values());
    const maxDailyVol = Math.max(...volumes, 1);
    const volumeDistribution = volumes.map((v) => v / maxDailyVol);

    return {
      hourlyVolumes,
      dailyVolumes,
      weeklyVolumes,
      peakVolumeHour,
      peakVolumeDay,
      volumeDistribution,
    };
  };

  const fetchVolumeHistory = async () => {
    if (!marketId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await dedupRequest(
        `volume:${marketId}:${timeframe}`,
        () => clobCircuitBreaker.execute(() => getHistoricalVolume(marketId, timeframe))
      );

      setVolumeData(data);
      const profile = buildVolumeProfile(data);
      setVolumeProfile(profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch volume history");
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  createEffect(() => {
    void fetchVolumeHistory();
  });

  // Auto-refresh
  createEffect(() => {
    if (!autoRefresh || !marketId) return;

    const timer = setInterval(() => {
      void fetchVolumeHistory();
    }, refreshIntervalMs);

    onCleanup(() => clearInterval(timer));
  });

  return {
    volumeData,
    volumeProfile,
    loading,
    error,
    refresh: fetchVolumeHistory,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Global Stats Hook
// ─────────────────────────────────────────────────────────────────────────────

export interface GlobalStats {
  totalVolume24h: number;
  totalVolume7d: number;
  totalVolume30d: number;
  activeMarkets: number;
  totalMarkets: number;
  avgSpread: number;
  topCategory: string;
  topCategoryVolume: number;
  newMarkets24h: number;
  resolvedMarkets24h: number;
}

export interface UseGlobalStatsResult {
  globalStats: () => GlobalStats | null;
  loading: () => boolean;
  error: () => string | null;
  lastUpdate: () => number | null;
  refresh: () => Promise<void>;
}

const globalStatsCache = new Map<string, { data: GlobalStats; expires: number }>();
const GLOBAL_STATS_CACHE_TTL = 60_000; // 1 minute

export function useGlobalStats(): UseGlobalStatsResult {
  const [globalStats, setGlobalStats] = createSignal<GlobalStats | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [lastUpdate, setLastUpdate] = createSignal<number | null>(null);

  const fetchGlobalStats = async () => {
    const cacheKey = "global";
    const cached = globalStatsCache.get(cacheKey);
    
    if (cached && Date.now() < cached.expires) {
      setGlobalStats(cached.data);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch aggregated data from multiple sources
      const { getAllMarkets } = await import("../api/gamma/markets");
      const markets = await getAllMarkets(200);

      // Compute global stats
      const totalVolume24h = markets.reduce((sum, m) => sum + m.volume24h, 0);
      const totalVolume7d = totalVolume24h * 7; // Estimate
      const totalVolume30d = totalVolume24h * 30; // Estimate
      const activeMarkets = markets.filter((m) => !m.closed && !m.resolved).length;
      const totalMarkets = markets.length;

      // Compute average spread from outcomes
      let totalSpread = 0;
      let spreadCount = 0;
      for (const market of markets) {
        if (market.outcomes.length >= 2) {
          const prices = market.outcomes.map((o) => o.price).sort();
          totalSpread += (prices[1]! - prices[0]!) * 100;
          spreadCount++;
        }
      }
      const avgSpread = spreadCount > 0 ? totalSpread / spreadCount : 0;

      // Find top category
      const categoryVolumes = new Map<string, number>();
      for (const market of markets) {
        const cat = market.category ?? "general";
        categoryVolumes.set(cat, (categoryVolumes.get(cat) ?? 0) + market.volume24h);
      }
      let topCategory = "general";
      let topCategoryVolume = 0;
      for (const [cat, vol] of categoryVolumes.entries()) {
        if (vol > topCategoryVolume) {
          topCategoryVolume = vol;
          topCategory = cat;
        }
      }

      const stats: GlobalStats = {
        totalVolume24h,
        totalVolume7d,
        totalVolume30d,
        activeMarkets,
        totalMarkets,
        avgSpread,
        topCategory,
        topCategoryVolume,
        newMarkets24h: 0, // Would need time-based filtering
        resolvedMarkets24h: 0,
      };

      setGlobalStats(stats);
      globalStatsCache.set(cacheKey, { data: stats, expires: Date.now() + GLOBAL_STATS_CACHE_TTL });
      setLastUpdate(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch global stats");
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  createEffect(() => {
    void fetchGlobalStats();
  });

  // Auto-refresh every 60 seconds
  createEffect(() => {
    const timer = setInterval(() => {
      void fetchGlobalStats();
    }, 60_000);

    onCleanup(() => clearInterval(timer));
  });

  return {
    globalStats,
    loading,
    error,
    lastUpdate,
    refresh: fetchGlobalStats,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

function getWeekString(date: Date): string {
  const year = date.getFullYear();
  const weekNum = getWeekNumber(date);
  return `${year}-W${weekNum.toString().padStart(2, "0")}`;
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// Format large numbers for display
export function formatVolumeCompact(value: number): string {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toFixed(0);
}

// Compute volume trend direction
export function computeVolumeTrend(volumeData: VolumeData[]): "up" | "down" | "stable" {
  if (volumeData.length < 2) return "stable";

  const halfLen = Math.floor(volumeData.length / 2);
  const firstHalf = volumeData.slice(0, halfLen);
  const secondHalf = volumeData.slice(halfLen);

  const firstAvg = firstHalf.reduce((a, b) => a + b.volume, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b.volume, 0) / secondHalf.length;

  const ratio = secondAvg / (firstAvg || 1);
  if (ratio > 1.15) return "up";
  if (ratio < 0.85) return "down";
  return "stable";
}

// Compute average daily volume
export function computeAvgDailyVolume(volumeData: VolumeData[]): number {
  if (volumeData.length === 0) return 0;
  return volumeData.reduce((sum, d) => sum + d.volume, 0) / volumeData.length;
}

// Detect volume spikes
export function detectVolumeSpikes(volumeData: VolumeData[]): number[] {
  if (volumeData.length < 7) return [];

  const avg = computeAvgDailyVolume(volumeData);
  const stdDev = Math.sqrt(
    volumeData.reduce((sum, d) => sum + Math.pow(d.volume - avg, 2), 0) / volumeData.length
  );

  const threshold = avg + 2 * stdDev;
  const spikes: number[] = [];

  for (const data of volumeData) {
    if (data.volume > threshold) {
      spikes.push(data.volume);
    }
  }

  return spikes;
}

// ─────────────────────────────────────────────────────────────────────────────
// Market Comparison Helper
// ─────────────────────────────────────────────────────────────────────────────

export interface MarketComparison {
  marketId: string;
  title: string;
  volume24h: number;
  liquidity: number;
  spread: number;
  change24h: number;
  stats?: EnhancedMarketStats;
}

export async function fetchMarketComparison(marketIds: string[]): Promise<MarketComparison[]> {
  const results: MarketComparison[] = [];

  const { getMarketDetails } = await import("../api/gamma/markets");

  for (const marketId of marketIds) {
    try {
      const market = await getMarketDetails(marketId);
      if (!market) continue;

      const prices = market.outcomes.map((o) => o.price).sort();
      const spread = prices.length >= 2 ? (prices[1]! - prices[0]!) * 100 : 0;

      results.push({
        marketId,
        title: market.title,
        volume24h: market.volume24h,
        liquidity: market.liquidity,
        spread,
        change24h: market.change24h,
      });
    } catch {
      // Skip failed markets
    }
  }

  return results;
}