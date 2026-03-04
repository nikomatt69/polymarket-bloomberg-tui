/**
 * Polymarket Data API - Activity
 * User activity and transaction history
 * Base: https://data-api.polymarket.com
 */

const DATA_API_BASE = "https://data-api.polymarket.com";
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_ACTIVITY_PAGE_LIMIT = 500;

export interface ActivityItem {
  id: string;
  type: "TRADE" | "SPLIT" | "MERGE" | "REDEEM" | "REWARD" | "CONVERSION" | "trade" | "deposit" | "withdrawal" | "transfer" | "redeem";
  asset?: string;
  outcome?: string;
  marketTitle?: string;
  side?: "buy" | "sell";
  size?: number;
  price?: number;
  value?: number;
  timestamp: number;
  status: "pending" | "completed" | "failed";
  txHash?: string;
}

interface DataApiActivity {
  id?: string;
  type?: string;
  asset?: string;
  outcome?: string;
  title?: string;
  side?: string;
  size?: number;
  price?: number;
  value?: number;
  timestamp?: number;
  status?: string;
  transactionHash?: string;
}

interface FetchActivityOptions {
  type?: string;
  start?: number;
  end?: number;
  offset?: number;
  maxPages?: number;
}

interface DataApiActivityResponse {
  data?: DataApiActivity[];
  activity?: DataApiActivity[];
  trades?: DataApiActivity[];
}

function parseNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
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
      throw new Error(`Activity API error: ${response.status}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

function extractActivityRows(payload: unknown): DataApiActivity[] {
  if (Array.isArray(payload)) {
    return payload as DataApiActivity[];
  }
  if (payload && typeof payload === "object") {
    const result = payload as DataApiActivityResponse;
    if (Array.isArray(result.data)) return result.data;
    if (Array.isArray(result.activity)) return result.activity;
    if (Array.isArray(result.trades)) return result.trades;
  }
  return [];
}

function parseStatus(value: string | undefined): ActivityItem["status"] {
  const normalized = (value ?? "").toLowerCase();
  if (normalized === "pending") return "pending";
  if (normalized === "failed") return "failed";
  return "completed";
}

function parseSide(value: string | undefined): ActivityItem["side"] {
  if (!value) return undefined;
  return value.toLowerCase() === "sell" ? "sell" : "buy";
}

function parseTimestampMs(value: unknown): number {
  const parsed = parseNumber(value, Date.now());
  if (!Number.isFinite(parsed)) return Date.now();
  return parsed < 1_000_000_000_000 ? Math.round(parsed * 1000) : Math.round(parsed);
}

function parseActivityItem(raw: DataApiActivity): ActivityItem {
  const type = (raw.type ?? "trade") as ActivityItem["type"];
  const status = parseStatus(raw.status);

  return {
    id: raw.id ?? `activity-${Date.now()}-${Math.random()}`,
    type,
    asset: raw.asset,
    outcome: raw.outcome,
    marketTitle: raw.title,
    side: parseSide(raw.side),
    size: parseNumber(raw.size, 0),
    price: parseNumber(raw.price, 0),
    value: parseNumber(raw.value, 0),
    timestamp: parseTimestampMs(raw.timestamp),
    status,
    txHash: raw.transactionHash,
  };
}

export async function fetchActivity(
  address: string,
  limit: number = 50,
  options: FetchActivityOptions = {}
): Promise<ActivityItem[]> {
  try {
    const requestedTotal = Math.max(1, limit);
    const pageLimit = Math.min(MAX_ACTIVITY_PAGE_LIMIT, requestedTotal);
    const maxPages = Math.max(1, options.maxPages ?? 10);
    let offset = Math.max(0, options.offset ?? 0);
    const rows: DataApiActivity[] = [];

    for (let page = 0; page < maxPages && rows.length < requestedTotal; page += 1) {
      const params = new URLSearchParams();
      params.set("user", address);
      params.set("limit", String(Math.min(pageLimit, requestedTotal - rows.length)));
      params.set("offset", String(offset));
      if (options.type) params.set("type", options.type);
      if (options.start !== undefined) params.set("start", String(options.start));
      if (options.end !== undefined) params.set("end", String(options.end));

      const payload = await fetchJson<unknown>(`/activity?${params.toString()}`);
      const pageRows = extractActivityRows(payload);
      if (pageRows.length === 0) break;

      rows.push(...pageRows);
      if (pageRows.length < Math.min(pageLimit, requestedTotal - rows.length + pageRows.length)) {
        break;
      }
      offset += pageRows.length;
    }

    return rows.slice(0, requestedTotal).map(parseActivityItem);
  } catch (error) {
    console.error("Failed to fetch activity:", error);
    return [];
  }
}

export async function fetchRecentActivity(address: string, hours: number = 24): Promise<ActivityItem[]> {
  const cutoff = Math.floor((Date.now() - hours * 60 * 60 * 1000) / 1000);
  return fetchActivity(address, 100, { start: cutoff });
}

export async function fetchMarketTrades(marketId: string, limit: number = 50): Promise<ActivityItem[]> {
  try {
    const requestedTotal = Math.max(1, limit);
    const pageLimit = Math.min(MAX_ACTIVITY_PAGE_LIMIT, requestedTotal);
    const rows: DataApiActivity[] = [];
    let offset = 0;

    for (let page = 0; page < 10 && rows.length < requestedTotal; page += 1) {
      const params = new URLSearchParams();
      params.set("market", marketId);
      params.set("limit", String(Math.min(pageLimit, requestedTotal - rows.length)));
      params.set("offset", String(offset));

      const payload = await fetchJson<unknown>(`/trades?${params.toString()}`);
      const pageRows = extractActivityRows(payload);
      if (pageRows.length === 0) break;

      rows.push(...pageRows);
      if (pageRows.length < Math.min(pageLimit, requestedTotal - rows.length + pageRows.length)) {
        break;
      }
      offset += pageRows.length;
    }

    return rows.slice(0, requestedTotal).map(parseActivityItem);
  } catch (error) {
    console.error("Failed to fetch market trades:", error);
    return [];
  }
}
