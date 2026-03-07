/**
 * Polymarket CLOB API - Miscellaneous Endpoints
 * Base: https://clob.polymarket.com
 */

const CLOB_API_BASE = "https://clob.polymarket.com";
const CLOB_BATCH_MARKET_DATA_LIMIT = 500;

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
// Spread API
// ─────────────────────────────────────────────────────────────────────────────

export interface SpreadResponse {
  asset_id: string;
  bid: string;
  ask: string;
  spread: string;
  spread_bps: string;
}

function chunkArray<T>(values: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  const size = Math.max(1, Math.floor(chunkSize));
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

export async function getSpread(tokenId: string): Promise<SpreadResponse | null> {
  try {
    const response = await fetch(`${CLOB_API_BASE}/spread?token_id=${tokenId}`);

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as SpreadResponse;
    return data;
  } catch {
    return null;
  }
}

export async function getSpreads(tokenIds: string[]): Promise<SpreadResponse[]> {
  if (tokenIds.length === 0) return [];

  try {
    const spreads = await getSpreadsMap(tokenIds);
    return Object.entries(spreads).map(([asset_id, spread]) => ({
      asset_id,
      bid: "",
      ask: "",
      spread: String(spread),
      spread_bps: "",
    }));
  } catch {
    return [];
  }
}

export async function getSpreadsMap(tokenIds: string[]): Promise<Record<string, number>> {
  if (tokenIds.length === 0) return {};

  try {
    const result: Record<string, number> = {};

    for (const batch of chunkArray(tokenIds, CLOB_BATCH_MARKET_DATA_LIMIT)) {
      const response = await fetch(`${CLOB_API_BASE}/spreads`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(batch.map((token_id) => ({ token_id }))),
      });

      if (!response.ok) {
        continue;
      }

      const data = (await response.json()) as Record<string, string>;
      for (const [tokenId, spread] of Object.entries(data)) {
        const numericSpread = parseNumeric(spread, Number.NaN);
        if (Number.isFinite(numericSpread)) {
          result[tokenId] = numericSpread > 1 ? numericSpread / 100 : numericSpread;
        }
      }
    }

    return result;
  } catch {
    return {};
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Fee Rates API
// ─────────────────────────────────────────────────────────────────────────────

export interface FeeRate {
  maker_fee_rate: string;
  taker_fee_rate: string;
  volume_bucket: number;
}

export interface FeeRatesResponse {
  asset_id: string;
  fees: FeeRate[];
}

export async function getFeeRates(tokenId: string): Promise<FeeRatesResponse | null> {
  try {
    const response = await fetch(`${CLOB_API_BASE}/fee-rates?token_id=${tokenId}`);

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as FeeRatesResponse;
    return data;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tick Size API
// ─────────────────────────────────────────────────────────────────────────────

export interface TickSizeResponse {
  tick_size: string;
  min_order_size: string;
}

export async function getTickSize(tokenId: string): Promise<TickSizeResponse | null> {
  try {
    const response = await fetch(`${CLOB_API_BASE}/tick-size?token_id=${tokenId}`);

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as TickSizeResponse;
    return data;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Order Books API (multiple at once)
// ─────────────────────────────────────────────────────────────────────────────

export async function getMultipleOrderBooks(tokenIds: string[]): Promise<Record<string, {
  bids: Array<{ price: string; size: string }>;
  asks: Array<{ price: string; size: string }>;
  market?: string;
  asset_id?: string;
  timestamp?: string;
}>> {
  if (tokenIds.length === 0) return {};

  try {
    // POST /books accepts [{token_id: "..."}] and returns array of book objects
    const response = await fetch(`${CLOB_API_BASE}/books`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tokenIds.map((token_id) => ({ token_id }))),
    });

    if (!response.ok) return {};

    const books = (await response.json()) as Array<{
      bids: Array<{ price: string; size: string }>;
      asks: Array<{ price: string; size: string }>;
      market?: string;
      asset_id?: string;
      timestamp?: string;
    }>;

    if (!Array.isArray(books)) return {};

    // Re-key result by asset_id for O(1) lookup
    const result: Record<string, typeof books[0]> = {};
    for (const book of books) {
      if (book.asset_id) result[book.asset_id] = book;
    }
    return result;
  } catch {
    return {};
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Order Details API
// ─────────────────────────────────────────────────────────────────────────────

export interface OrderDetails {
  orderID: string;
  assetId: string;
  side: "BUY" | "SELL";
  price: number;
  size: number;
  filledSize: number;
  status: "open" | "filled" | "cancelled" | "partially_filled";
  createdAt: string;
  updatedAt: string;
  hash?: string;
}

export async function getOrderDetails(orderId: string): Promise<OrderDetails | null> {
  try {
    const response = await fetch(`${CLOB_API_BASE}/order/${encodeURIComponent(orderId)}`);

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as OrderDetails;
    return data;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Server Time API — use before EIP-712 signing for clock sync
// ─────────────────────────────────────────────────────────────────────────────

export async function getServerTime(): Promise<number | null> {
  try {
    const response = await fetch(`${CLOB_API_BASE}/time`);
    if (!response.ok) return null;
    const data = (await response.json()) as { time?: number | string } | null;
    if (!data?.time) return null;
    const t = parseNumeric(data.time, 0);
    // Server returns Unix seconds; normalize to ms if needed
    return t < 1_000_000_000_000 ? Math.round(t * 1000) : Math.round(t);
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Connection health check
// ─────────────────────────────────────────────────────────────────────────────

export async function isMarketHealthy(): Promise<boolean> {
  try {
    const response = await fetch(`${CLOB_API_BASE}/ok`);
    return response.ok;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Health Check API
// ─────────────────────────────────────────────────────────────────────────────

export interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  version: string;
  services: Record<string, "up" | "down">;
}

export async function getHealthStatus(): Promise<HealthStatus | null> {
  try {
    const response = await fetch(`${CLOB_API_BASE}/health`);

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as HealthStatus;
    return data;
  } catch {
    return null;
  }
}
