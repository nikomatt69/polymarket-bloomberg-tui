/**
 * Polymarket Data API - Miscellaneous Endpoints
 * Base: https://data-api.polymarket.com
 */

const DATA_API_BASE = "https://data-api.polymarket.com";
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_PAGE_LIMIT = 500;

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

interface DataApiArrayPayload<T> {
  data?: T[];
  entries?: T[];
  results?: T[];
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(`${DATA_API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(init?.headers ?? {}),
      },
    });

    if (!response.ok) {
      throw new Error(`Data API error: ${response.status}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

function extractArrayRows<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) {
    return payload as T[];
  }

  if (payload && typeof payload === "object") {
    const result = payload as DataApiArrayPayload<T>;
    if (Array.isArray(result.entries)) return result.entries;
    if (Array.isArray(result.results)) return result.results;
    if (Array.isArray(result.data)) return result.data;
  }

  return [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Closed Positions API
// ─────────────────────────────────────────────────────────────────────────────

export interface ClosedPosition {
  asset: string;
  conditionId: string;
  size: number;
  avgPrice: number;
  salePrice: number;
  realizedPnl: number;
  realizedPnlPercent: number;
  outcome: string;
  title: string;
  endDate: string | null;
  closedAt: string;
}

export async function fetchClosedPositions(
  address: string,
  limit: number = 100,
  offset: number = 0,
  maxPages: number = 10,
): Promise<ClosedPosition[]> {
  try {
    const requestedTotal = Math.max(1, limit);
    const pageLimit = Math.min(MAX_PAGE_LIMIT, requestedTotal);
    const rows: ClosedPosition[] = [];
    const seen = new Set<string>();
    let pageOffset = Math.max(0, offset);

    for (let page = 0; page < Math.max(1, maxPages) && rows.length < requestedTotal; page += 1) {
      const requestLimit = Math.min(pageLimit, requestedTotal - rows.length);
      const params = new URLSearchParams({
        user: address,
        limit: String(requestLimit),
        offset: String(pageOffset),
      });

      const payload = await fetchJson<unknown>(`/positions/closed?${params.toString()}`);
      const pageRows = extractArrayRows<ClosedPosition>(payload);
      if (pageRows.length === 0) break;

      let added = 0;
      for (const row of pageRows) {
        const key = `${row.asset}-${row.conditionId}-${row.closedAt}`;
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
    console.error("Failed to fetch closed positions:", error);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Position Values API
// ─────────────────────────────────────────────────────────────────────────────

export interface PositionValue {
  asset: string;
  conditionId: string;
  size: number;
  currentPrice: number;
  value: number;
  timestamp: string;
}

export interface PositionValuesResponse {
  user: string;
  totalValue: number;
  positions: PositionValue[];
  timestamp: string;
}

export async function fetchPositionValues(address: string): Promise<PositionValuesResponse | null> {
  try {
    const params = new URLSearchParams({ user: address });
    const response = await fetch(`${DATA_API_BASE}/positions/value?${params.toString()}`);

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as PositionValuesResponse;
    return data;
  } catch (error) {
    console.error("Failed to fetch position values:", error);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Trader Leaderboard API
// ─────────────────────────────────────────────────────────────────────────────

export interface TraderLeaderboardEntry {
  rank: number;
  address: string;
  realizedPnl: number;
  realizedPnlPercent: number;
  volume: number;
  tradeCount: number;
  winRate: number;
  activeMarkets: number;
}

export interface TraderLeaderboardResponse {
  timeframe: string;
  entries: TraderLeaderboardEntry[];
}

export async function fetchTraderLeaderboard(
  limit: number = 100,
  timeframe: "daily" | "weekly" | "monthly" | "allTime" = "weekly"
): Promise<TraderLeaderboardResponse | null> {
  try {
    const requestedTotal = Math.max(1, limit);
    const pageLimit = Math.min(MAX_PAGE_LIMIT, requestedTotal);
    const entries: TraderLeaderboardEntry[] = [];
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

      const payload = await fetchJson<unknown>(`/trader-leaderboard?${params.toString()}`);
      if (payload && typeof payload === "object") {
        const candidate = (payload as { timeframe?: unknown }).timeframe;
        if (typeof candidate === "string" && candidate.length > 0) {
          resolvedTimeframe = candidate;
        }
      }

      const pageRows = extractArrayRows<TraderLeaderboardEntry>(payload);
      if (pageRows.length === 0) break;

      let added = 0;
      for (const row of pageRows) {
        const key = row.address || `${row.rank}-${row.volume}`;
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
    console.error("Failed to fetch trader leaderboard:", error);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public Trader Profiles API
// ─────────────────────────────────────────────────────────────────────────────

export interface TraderProfile {
  address: string;
  username: string | null;
  bio: string | null;
  avatarUrl: string | null;
  totalVolume: number;
  realizedPnl: number;
  tradeCount: number;
  winRate: number;
  rank: number | null;
  joinedAt: string;
  socialLinks: Record<string, string>;
}

export async function fetchTraderProfile(address: string): Promise<TraderProfile | null> {
  try {
    const response = await fetch(`${DATA_API_BASE}/profiles/${encodeURIComponent(address)}`);

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as TraderProfile;
    return data;
  } catch (error) {
    console.error("Failed to fetch trader profile:", error);
    return null;
  }
}

export async function searchTraderProfiles(query: string, limit: number = 10): Promise<TraderProfile[]> {
  try {
    const response = await fetch(
      `${DATA_API_BASE}/profiles/search?q=${encodeURIComponent(query)}&limit=${limit}`
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }

    return data as TraderProfile[];
  } catch (error) {
    console.error("Failed to search trader profiles:", error);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Market Makers API
// ─────────────────────────────────────────────────────────────────────────────

export interface MarketMakerStats {
  address: string;
  volume: number;
  spread: number;
  efficiency: number;
  activeMarkets: number;
}

export async function fetchMarketMakers(limit: number = 50): Promise<MarketMakerStats[]> {
  try {
    const response = await fetch(`${DATA_API_BASE}/market-makers?limit=${limit}`);

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }

    return data as MarketMakerStats[];
  } catch (error) {
    console.error("Failed to fetch market makers:", error);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Portfolio Analytics API
// ─────────────────────────────────────────────────────────────────────────────

export interface PortfolioAnalytics {
  totalValue: number;
  totalPnL: number;
  totalPnLPercent: number;
  dailyPnL: number;
  weeklyPnL: number;
  monthlyPnL: number;
  realizedPnL: number;
  unrealizedPnL: number;
  winRate: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  avgWinSize: number;
  avgLossSize: number;
  largestWin: number;
  largestLoss: number;
  avgHoldingPeriod: number;
  SharpeRatio: number;
}

export async function fetchPortfolioAnalytics(address: string): Promise<PortfolioAnalytics | null> {
  try {
    const params = new URLSearchParams({ user: address });
    const response = await fetch(`${DATA_API_BASE}/portfolio/analytics?${params.toString()}`);

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as PortfolioAnalytics;
    return data;
  } catch (error) {
    console.error("Failed to fetch portfolio analytics:", error);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Notifications API
// ─────────────────────────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  type: "price_alert" | "trade" | "position" | "system";
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  data?: Record<string, unknown>;
}

export async function fetchNotifications(
  address: string,
  limit: number = 50,
  unreadOnly: boolean = false
): Promise<Notification[]> {
  try {
    const requestedTotal = Math.max(1, limit);
    const pageLimit = Math.min(MAX_PAGE_LIMIT, requestedTotal);
    const rows: Notification[] = [];
    const seen = new Set<string>();
    let offset = 0;

    for (let page = 0; page < 10 && rows.length < requestedTotal; page += 1) {
      const requestLimit = Math.min(pageLimit, requestedTotal - rows.length);
      const params = new URLSearchParams({
        user: address,
        limit: String(requestLimit),
        offset: String(offset),
      });

      if (unreadOnly) {
        params.set("unread", "true");
      }

      const payload = await fetchJson<unknown>(`/notifications?${params.toString()}`);
      const pageRows = extractArrayRows<Notification>(payload);
      if (pageRows.length === 0) break;

      let added = 0;
      for (const row of pageRows) {
        const key = row.id || `${row.type}-${row.createdAt}-${row.title}`;
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

      offset += pageRows.length;
    }

    return rows.slice(0, requestedTotal);
  } catch (error) {
    console.error("Failed to fetch notifications:", error);
    return [];
  }
}

export async function markNotificationRead(notificationId: string): Promise<boolean> {
  try {
    const response = await fetch(`${DATA_API_BASE}/notifications/${notificationId}/read`, {
      method: "POST",
    });

    return response.ok;
  } catch {
    return false;
  }
}

export async function markAllNotificationsRead(address: string): Promise<boolean> {
  try {
    const response = await fetch(`${DATA_API_BASE}/notifications/read-all`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ user: address }),
    });

    return response.ok;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Referral Stats API
// ─────────────────────────────────────────────────────────────────────────────

export interface ReferralStats {
  referrer: string;
  totalReferred: number;
  activeReferred: number;
  totalVolume: number;
  totalCommission: number;
  commissionPaid: number;
  pendingCommission: number;
}

export async function fetchReferralStats(address: string): Promise<ReferralStats | null> {
  try {
    const params = new URLSearchParams({ referrer: address });
    const response = await fetch(`${DATA_API_BASE}/referral/stats?${params.toString()}`);

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as ReferralStats;
    return data;
  } catch (error) {
    console.error("Failed to fetch referral stats:", error);
    return null;
  }
}

export interface ReferralLink {
  code: string;
  url: string;
  createdAt: string;
  clicks: number;
  conversions: number;
}

export async function createReferralLink(): Promise<ReferralLink | null> {
  try {
    const response = await fetch(`${DATA_API_BASE}/referral/link`, {
      method: "POST",
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as ReferralLink;
    return data;
  } catch (error) {
    console.error("Failed to create referral link:", error);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// User Settings API
// ─────────────────────────────────────────────────────────────────────────────

export interface UserSettings {
  theme: "light" | "dark";
  currency: string;
  notifications: {
    priceAlerts: boolean;
    trades: boolean;
    system: boolean;
    email: boolean;
  };
  display: {
    showPnL: boolean;
    showVolume: boolean;
    compactNumbers: boolean;
  };
}

export async function fetchUserSettings(address: string): Promise<UserSettings | null> {
  try {
    const response = await fetch(`${DATA_API_BASE}/users/${encodeURIComponent(address)}/settings`);

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as UserSettings;
    return data;
  } catch (error) {
    console.error("Failed to fetch user settings:", error);
    return null;
  }
}

export async function updateUserSettings(address: string, settings: Partial<UserSettings>): Promise<boolean> {
  try {
    const response = await fetch(`${DATA_API_BASE}/users/${encodeURIComponent(address)}/settings`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(settings),
    });

    return response.ok;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Watchlist API
// ─────────────────────────────────────────────────────────────────────────────

export interface WatchlistItem {
  marketId: string;
  addedAt: string;
}

export async function fetchWatchlist(address: string): Promise<WatchlistItem[]> {
  try {
    const params = new URLSearchParams({ user: address });
    const response = await fetch(`${DATA_API_BASE}/watchlist?${params.toString()}`);

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }

    return data as WatchlistItem[];
  } catch (error) {
    console.error("Failed to fetch watchlist:", error);
    return [];
  }
}

export async function addToWatchlist(address: string, marketId: string): Promise<boolean> {
  try {
    const response = await fetch(`${DATA_API_BASE}/watchlist`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ user: address, marketId }),
    });

    return response.ok;
  } catch {
    return false;
  }
}

export async function removeFromWatchlist(address: string, marketId: string): Promise<boolean> {
  try {
    const params = new URLSearchParams({ user: address });
    const response = await fetch(`${DATA_API_BASE}/watchlist/${encodeURIComponent(marketId)}?${params.toString()}`, {
      method: "DELETE",
    });

    return response.ok;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Price Alerts API
// ─────────────────────────────────────────────────────────────────────────────

export interface PriceAlert {
  id: string;
  user: string;
  marketId: string;
  outcome: string;
  targetPrice: number;
  condition: "above" | "below";
  triggered: boolean;
  createdAt: string;
  triggeredAt: string | null;
}

export async function fetchPriceAlerts(address: string): Promise<PriceAlert[]> {
  try {
    const params = new URLSearchParams({ user: address });
    const response = await fetch(`${DATA_API_BASE}/alerts?${params.toString()}`);

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }

    return data as PriceAlert[];
  } catch (error) {
    console.error("Failed to fetch price alerts:", error);
    return [];
  }
}

export async function createPriceAlert(
  address: string,
  marketId: string,
  outcome: string,
  targetPrice: number,
  condition: "above" | "below"
): Promise<PriceAlert | null> {
  try {
    const response = await fetch(`${DATA_API_BASE}/alerts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ user: address, marketId, outcome, targetPrice, condition }),
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as PriceAlert;
    return data;
  } catch (error) {
    console.error("Failed to create price alert:", error);
    return null;
  }
}

export async function deletePriceAlert(alertId: string): Promise<boolean> {
  try {
    const response = await fetch(`${DATA_API_BASE}/alerts/${alertId}`, {
      method: "DELETE",
    });

    return response.ok;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Market Comments API
// ─────────────────────────────────────────────────────────────────────────────

export interface MarketComment {
  id: string;
  marketId: string;
  user: string;
  content: string;
  likes: number;
  replies: number;
  createdAt: string;
}

export async function fetchMarketComments(marketId: string, limit: number = 50): Promise<MarketComment[]> {
  try {
    const requestedTotal = Math.max(1, limit);
    const pageLimit = Math.min(MAX_PAGE_LIMIT, requestedTotal);
    const rows: MarketComment[] = [];
    const seen = new Set<string>();
    let offset = 0;

    for (let page = 0; page < 10 && rows.length < requestedTotal; page += 1) {
      const requestLimit = Math.min(pageLimit, requestedTotal - rows.length);
      const params = new URLSearchParams({
        market: marketId,
        limit: String(requestLimit),
        offset: String(offset),
      });

      const payload = await fetchJson<unknown>(`/comments?${params.toString()}`);
      const pageRows = extractArrayRows<MarketComment>(payload);
      if (pageRows.length === 0) break;

      let added = 0;
      for (const row of pageRows) {
        const key = row.id || `${row.user}-${row.createdAt}-${row.content}`;
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

      offset += pageRows.length;
    }

    return rows.slice(0, requestedTotal);
  } catch (error) {
    console.error("Failed to fetch market comments:", error);
    return [];
  }
}

export async function postComment(marketId: string, content: string): Promise<MarketComment | null> {
  try {
    const response = await fetch(`${DATA_API_BASE}/comments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ marketId, content }),
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as MarketComment;
    return data;
  } catch (error) {
    console.error("Failed to post comment:", error);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Global Stats API
// ─────────────────────────────────────────────────────────────────────────────

export interface GlobalStats {
  totalVolume24h: number;
  totalVolume7d: number;
  totalVolume30d: number;
  totalMarkets: number;
  activeMarkets: number;
  totalTraders: number;
  newTraders24h: number;
  topCategories: Array<{ category: string; volume: number; markets: number }>;
}

export async function fetchGlobalStats(): Promise<GlobalStats | null> {
  try {
    const response = await fetch(`${DATA_API_BASE}/global-stats`);

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as GlobalStats;
    return data;
  } catch (error) {
    console.error("Failed to fetch global stats:", error);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Featured Markets API
// ─────────────────────────────────────────────────────────────────────────────

export interface FeaturedMarket {
  id: string;
  question: string;
  slug: string;
  volume: number;
  imageUrl: string | null;
}

export async function fetchFeaturedMarkets(): Promise<FeaturedMarket[]> {
  try {
    const response = await fetch(`${DATA_API_BASE}/featured`);

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }

    return data as FeaturedMarket[];
  } catch (error) {
    console.error("Failed to fetch featured markets:", error);
    return [];
  }
}
