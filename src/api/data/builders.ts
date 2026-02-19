/**
 * Polymarket Data API - Builder Endpoints
 * Base: https://data-api.polymarket.com
 */

const DATA_API_BASE = "https://data-api.polymarket.com";

// ─────────────────────────────────────────────────────────────────────────────
// Builder Leaderboard API
// ─────────────────────────────────────────────────────────────────────────────

export interface BuilderEntry {
  rank: number;
  address: string;
  name: string | null;
  volume: number;
  tradeCount: number;
  uniqueTraders: number;
  revenue: number;
  marketCount: number;
}

export interface BuilderLeaderboardResponse {
  timeframe: string;
  entries: BuilderEntry[];
}

export async function fetchBuilderLeaderboard(
  limit: number = 100,
  timeframe: "daily" | "weekly" | "monthly" | "allTime" = "weekly"
): Promise<BuilderLeaderboardResponse | null> {
  try {
    const response = await fetch(
      `${DATA_API_BASE}/builders/leaderboard?limit=${limit}&timeframe=${timeframe}`
    );

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as BuilderLeaderboardResponse;
    return data;
  } catch (error) {
    console.error("Failed to fetch builder leaderboard:", error);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Builder Stats API
// ─────────────────────────────────────────────────────────────────────────────

export interface BuilderStats {
  address: string;
  name: string | null;
  totalVolume: number;
  totalTrades: number;
  totalRevenue: number;
  totalMarkets: number;
  uniqueTraders: number;
  avgSpread: number;
  topMarkets: Array<{
    marketId: string;
    question: string;
    volume: number;
  }>;
}

export async function fetchBuilderStats(address: string): Promise<BuilderStats | null> {
  try {
    const response = await fetch(`${DATA_API_BASE}/builders/${address}/stats`);

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as BuilderStats;
    return data;
  } catch (error) {
    console.error("Failed to fetch builder stats:", error);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Builder Markets API
// ─────────────────────────────────────────────────────────────────────────────

export interface BuilderMarket {
  marketId: string;
  question: string;
  volume: number;
  liquidity: number;
  traderCount: number;
  createdAt: string;
}

export async function fetchBuilderMarkets(
  address: string,
  limit: number = 50,
  offset: number = 0
): Promise<BuilderMarket[]> {
  try {
    const response = await fetch(
      `${DATA_API_BASE}/builders/${address}/markets?limit=${limit}&offset=${offset}`
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }

    return data as BuilderMarket[];
  } catch (error) {
    console.error("Failed to fetch builder markets:", error);
    return [];
  }
}
