/**
 * Polymarket CLOB API - Miscellaneous Endpoints
 * Base: https://clob.polymarket.com
 */

const CLOB_API_BASE = "https://clob.polymarket.com";

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

export async function getSpread(tokenId: string): Promise<SpreadResponse | null> {
  try {
    const response = await fetch(`${CLOB_API_BASE}/prices/spread?token_id=${tokenId}`);

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
    const response = await fetch(`${CLOB_API_BASE}/prices/spreads`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token_ids: tokenIds }),
    });

    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as SpreadResponse[];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
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
    const response = await fetch(`${CLOB_API_BASE}/order-books`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token_ids: tokenIds }),
    });

    if (!response.ok) {
      return {};
    }

    const data = (await response.json()) as Record<string, {
      bids: Array<{ price: string; size: string }>;
      asks: Array<{ price: string; size: string }>;
      market?: string;
      asset_id?: string;
      timestamp?: string;
    }>;
    return data;
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
// Cancel Order by Hash API
// ─────────────────────────────────────────────────────────────────────────────

export async function cancelOrderByHash(orderHash: string): Promise<{ success: boolean; message?: string }> {
  try {
    const response = await fetch(`${CLOB_API_BASE}/orders/cancel-by-hash`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ order_hash: orderHash }),
    });

    if (!response.ok) {
      const error = (await response.json()) as { message?: string };
      return { success: false, message: error.message || "Failed to cancel order" };
    }

    return { success: true };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Unknown error" };
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
