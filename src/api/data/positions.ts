/**
 * Polymarket Data API - Positions
 * Base: https://data-api.polymarket.com
 */

import { Position, PortfolioSummary } from "../../types/positions";

const DATA_API_BASE = "https://data-api.polymarket.com";
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_PAGE_LIMIT = 500;
const CACHE_TTL_MS = 60_000; // 60 seconds

interface CacheEntry {
  data: Position[];
  timestamp: number;
}

const positionsCache = new Map<string, CacheEntry>();

export function getCachedPositions(address: string): Position[] | null {
  const entry = positionsCache.get(address.toLowerCase());
  if (!entry) return null;

  const now = Date.now();
  if (now - entry.timestamp > CACHE_TTL_MS) {
    positionsCache.delete(address.toLowerCase());
    return null;
  }

  return entry.data;
}

export function setCachedPositions(address: string, positions: Position[]): void {
  positionsCache.set(address.toLowerCase(), {
    data: positions,
    timestamp: Date.now(),
  });
}

export function invalidatePositionsCache(): void {
  positionsCache.clear();
}

interface FetchPositionsOptions {
  sizeThreshold?: number;
  sortBy?: string;
  limit?: number;
  offset?: number;
  maxPages?: number;
}

interface DataApiPosition {
  asset: string;
  conditionId: string;
  size: number;
  avgPrice: number;
  currentValue: number;
  cashPnl: number;
  percentPnl: number;
  curPrice: number;
  outcome: string;
  title: string;
  endDate: string | null;
  redeemable: boolean;
  initialValue: number;
}

interface DataApiPositionsResponse {
  data?: DataApiPosition[];
  positions?: DataApiPosition[];
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
      throw new Error(`Data API error: ${response.status}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

function extractPositions(payload: unknown): DataApiPosition[] {
  if (Array.isArray(payload)) {
    return payload as DataApiPosition[];
  }
  if (payload && typeof payload === "object") {
    const result = payload as DataApiPositionsResponse;
    if (Array.isArray(result.data)) return result.data;
    if (Array.isArray(result.positions)) return result.positions;
  }
  return [];
}

function mapPosition(raw: DataApiPosition): Position {
  return {
    asset: raw.asset,
    conditionId: raw.conditionId,
    size: raw.size ?? 0,
    avgPrice: raw.avgPrice ?? 0,
    currentValue: raw.currentValue ?? 0,
    cashPnl: raw.cashPnl ?? 0,
    percentPnl: raw.percentPnl ?? 0,
    curPrice: raw.curPrice ?? 0,
    outcome: raw.outcome ?? "",
    title: raw.title ?? "Unknown Market",
    endDate: raw.endDate ?? null,
    redeemable: raw.redeemable ?? false,
    initialValue: raw.initialValue ?? 0,
  };
}

export async function fetchPositions(
  address: string,
  options: FetchPositionsOptions = {}
): Promise<Position[]> {
  // Check cache first (only for default fetch without options)
  if (!options.sizeThreshold && !options.sortBy && !options.offset) {
    const cached = getCachedPositions(address);
    if (cached) {
      return cached;
    }
  }

  const requestedTotal = Math.max(1, options.limit ?? 100);
  const maxPages = Math.max(1, options.maxPages ?? 10);
  const pageLimit = Math.min(MAX_PAGE_LIMIT, requestedTotal);
  let offset = Math.max(0, options.offset ?? 0);
  const rows: DataApiPosition[] = [];

  for (let page = 0; page < maxPages && rows.length < requestedTotal; page += 1) {
    const params = new URLSearchParams();
    params.set("user", address);
    params.set("limit", String(Math.min(pageLimit, requestedTotal - rows.length)));
    params.set("offset", String(offset));
    if (options.sizeThreshold !== undefined) params.set("sizeThreshold", String(options.sizeThreshold));
    if (options.sortBy) params.set("sortBy", options.sortBy);

    const payload = await fetchJson<unknown>(`/positions?${params.toString()}`);
    const pageRows = extractPositions(payload);
    if (pageRows.length === 0) break;

    rows.push(...pageRows);
    if (pageRows.length < Math.min(pageLimit, requestedTotal - rows.length + pageRows.length)) {
      break;
    }
    offset += pageRows.length;
  }

  const positions = rows.slice(0, requestedTotal).map(mapPosition);

  // Cache the result (only for default fetch)
  if (!options.sizeThreshold && !options.sortBy && !options.offset) {
    setCachedPositions(address, positions);
  }

  return positions;
}

export function calculatePortfolioSummary(positions: Position[]): PortfolioSummary {
  if (positions.length === 0) {
    return { totalValue: 0, totalCashPnl: 0, totalPercentPnl: 0, positionCount: 0 };
  }

  const totalValue = positions.reduce((sum, p) => sum + p.currentValue, 0);
  const totalCashPnl = positions.reduce((sum, p) => sum + p.cashPnl, 0);
  const totalInitial = positions.reduce((sum, p) => sum + p.initialValue, 0);
  const totalPercentPnl = totalInitial > 0 ? (totalCashPnl / totalInitial) * 100 : 0;

  return {
    totalValue,
    totalCashPnl,
    totalPercentPnl,
    positionCount: positions.length,
  };
}

export async function getPositionByAsset(address: string, assetId: string): Promise<Position | null> {
  const positions = await fetchPositions(address);
  return positions.find(p => p.asset === assetId) || null;
}

export async function getActivePositions(address: string): Promise<Position[]> {
  const positions = await fetchPositions(address);
  return positions.filter(p => p.size > 0);
}

export async function getRedeemablePositions(address: string): Promise<Position[]> {
  const positions = await fetchPositions(address);
  return positions.filter(p => p.redeemable);
}

export async function fetchPortfolioValue(address: string): Promise<number> {
  try {
    const data = await fetchJson<{ user?: string; value?: number | string } | null>(`/value?user=${encodeURIComponent(address)}`);
    if (!data || data.value === undefined || data.value === null) return 0;
    return parseNumber(data.value, 0);
  } catch {
    return 0;
  }
}
