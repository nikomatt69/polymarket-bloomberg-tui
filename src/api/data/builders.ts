/**
 * Polymarket Data API - Builder Endpoints
 * Base: https://data-api.polymarket.com
 */

const DATA_API_BASE = "https://data-api.polymarket.com";
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_PAGE_LIMIT = 500;

interface BuilderListPayload<T> {
  data?: T[];
  entries?: T[];
  markets?: T[];
}

async function fetchJson<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(`${DATA_API_BASE}${path}`, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Builder API error: ${response.status}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

function extractRows<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) {
    return payload as T[];
  }

  if (payload && typeof payload === "object") {
    const listPayload = payload as BuilderListPayload<T>;
    if (Array.isArray(listPayload.entries)) return listPayload.entries;
    if (Array.isArray(listPayload.markets)) return listPayload.markets;
    if (Array.isArray(listPayload.data)) return listPayload.data;
  }

  return [];
}

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
    const requestedTotal = Math.max(1, limit);
    const pageLimit = Math.min(MAX_PAGE_LIMIT, requestedTotal);
    const entries: BuilderEntry[] = [];
    const seen = new Set<string>();
    let offset = 0;
    let resolvedTimeframe: string = timeframe;

    for (let page = 0; page < 10 && entries.length < requestedTotal; page += 1) {
      const requestLimit = Math.min(pageLimit, requestedTotal - entries.length);
      const params = new URLSearchParams({
        limit: String(requestLimit),
        timeframe,
        offset: String(offset),
      });

      const payload = await fetchJson<unknown>(`/builders/leaderboard?${params.toString()}`);
      if (payload && typeof payload === "object") {
        const candidate = (payload as { timeframe?: unknown }).timeframe;
        if (typeof candidate === "string" && candidate.length > 0) {
          resolvedTimeframe = candidate;
        }
      }

      const pageRows = extractRows<BuilderEntry>(payload);
      if (pageRows.length === 0) break;

      let added = 0;
      for (const row of pageRows) {
        const key = row.address || `${row.rank}-${row.name ?? "unknown"}-${row.volume}`;
        if (!seen.has(key)) {
          seen.add(key);
          entries.push(row);
          added += 1;
        }
        if (entries.length >= requestedTotal) break;
      }

      if (added === 0 || pageRows.length < requestLimit) {
        break;
      }

      offset += pageRows.length;
    }

    return {
      timeframe: resolvedTimeframe,
      entries: entries.slice(0, requestedTotal),
    };
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
    return await fetchJson<BuilderStats>(`/builders/${encodeURIComponent(address)}/stats`);
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
    const requestedTotal = Math.max(1, limit);
    const pageLimit = Math.min(MAX_PAGE_LIMIT, requestedTotal);
    const rows: BuilderMarket[] = [];
    const seen = new Set<string>();
    let pageOffset = Math.max(0, offset);

    for (let page = 0; page < 10 && rows.length < requestedTotal; page += 1) {
      const requestLimit = Math.min(pageLimit, requestedTotal - rows.length);
      const params = new URLSearchParams({
        limit: String(requestLimit),
        offset: String(pageOffset),
      });

      const payload = await fetchJson<unknown>(
        `/builders/${encodeURIComponent(address)}/markets?${params.toString()}`
      );
      const pageRows = extractRows<BuilderMarket>(payload);
      if (pageRows.length === 0) break;

      let added = 0;
      for (const row of pageRows) {
        const key = row.marketId || `${row.question}-${row.createdAt}`;
        if (!seen.has(key)) {
          seen.add(key);
          rows.push(row);
          added += 1;
        }
        if (rows.length >= requestedTotal) break;
      }

      if (added === 0 || pageRows.length < requestLimit) {
        break;
      }

      pageOffset += pageRows.length;
    }

    return rows.slice(0, requestedTotal);
  } catch (error) {
    console.error("Failed to fetch builder markets:", error);
    return [];
  }
}
