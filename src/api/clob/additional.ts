/**
 * Polymarket CLOB API - Additional Endpoints
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
// Fills (Trade History) API
// ─────────────────────────────────────────────────────────────────────────────

export interface Fill {
  id: string;
  orderId: string;
  side: "BUY" | "SELL";
  price: number;
  size: number;
  amount: number;
  fee: number;
  feeRate: number;
  market: string;
  assetId: string;
  timestamp: string;
  tradeId: string;
}

export async function getFills(
  address: string,
  limit: number = 100,
  before?: string
): Promise<Fill[]> {
  try {
    const params = new URLSearchParams({
      address,
      limit: String(limit),
    });

    if (before) {
      params.set("before", before);
    }

    const response = await fetch(`${CLOB_API_BASE}/fills?${params}`);

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }

    return data.map((fill: Fill) => ({
      ...fill,
      price: parseNumeric(fill.price),
      size: parseNumeric(fill.size),
      amount: parseNumeric(fill.amount),
      fee: parseNumeric(fill.fee),
      feeRate: parseNumeric(fill.feeRate),
    }));
  } catch (error) {
    console.error("Failed to fetch fills:", error);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Assets API
// ─────────────────────────────────────────────────────────────────────────────

export interface Asset {
  assetId: string;
  symbol: string;
  name: string;
  decimals: number;
  domain: string;
  iconUrl: string | null;
  color: string | null;
}

export async function getAssets(): Promise<Asset[]> {
  try {
    const response = await fetch(`${CLOB_API_BASE}/assets`);

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }

    return data as Asset[];
  } catch (error) {
    console.error("Failed to fetch assets:", error);
    return [];
  }
}

export async function getAssetById(assetId: string): Promise<Asset | null> {
  try {
    const response = await fetch(`${CLOB_API_BASE}/assets/${assetId}`);

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as Asset;
    return data;
  } catch (error) {
    console.error("Failed to fetch asset:", error);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Candles API
// ─────────────────────────────────────────────────────────────────────────────

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export async function getCandles(
  tokenId: string,
  interval: "1m" | "5m" | "15m" | "1h" | "4h" | "1d" = "1h",
  limit: number = 100
): Promise<Candle[]> {
  try {
    const response = await fetch(
      `${CLOB_API_BASE}/candles?token_id=${tokenId}&interval=${interval}&limit=${limit}`
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }

    return data.map((candle: Candle) => ({
      time: candle.time,
      open: parseNumeric(candle.open),
      high: parseNumeric(candle.high),
      low: parseNumeric(candle.low),
      close: parseNumeric(candle.close),
      volume: parseNumeric(candle.volume),
    }));
  } catch (error) {
    console.error("Failed to fetch candles:", error);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Market Stats API
// ─────────────────────────────────────────────────────────────────────────────

export interface MarketStats {
  market: string;
  assetId: string;
  volume24hr: number;
  volume7d: number;
  volumeTotal: number;
  liquidity: number;
  lastTradePrice: number;
  lastTradeSize: number;
  lastTradeTime: string;
  openInterest: number;
}

export async function getMarketStats(tokenId: string): Promise<MarketStats | null> {
  try {
    const response = await fetch(`${CLOB_API_BASE}/market/${tokenId}/stats`);

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as MarketStats;
    return {
      ...data,
      volume24hr: parseNumeric(data.volume24hr),
      volume7d: parseNumeric(data.volume7d),
      volumeTotal: parseNumeric(data.volumeTotal),
      liquidity: parseNumeric(data.liquidity),
      lastTradePrice: parseNumeric(data.lastTradePrice),
      lastTradeSize: parseNumeric(data.lastTradeSize),
      openInterest: parseNumeric(data.openInterest),
    };
  } catch (error) {
    console.error("Failed to fetch market stats:", error);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Historical Volume API
// ─────────────────────────────────────────────────────────────────────────────

export interface VolumeData {
  date: string;
  volume: number;
  tradeCount: number;
}

export async function getHistoricalVolume(
  marketId: string,
  timeframe: "24h" | "7d" | "30d" | "all" = "7d"
): Promise<VolumeData[]> {
  try {
    const response = await fetch(
      `${CLOB_API_BASE}/history/volume?market=${marketId}&timeframe=${timeframe}`
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }

    return data.map((d: VolumeData) => ({
      date: d.date,
      volume: parseNumeric(d.volume),
      tradeCount: parseNumeric(d.tradeCount),
    }));
  } catch (error) {
    console.error("Failed to fetch historical volume:", error);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Aggregated Order Book API
// ─────────────────────────────────────────────────────────────────────────────

export interface AggregatedOrder {
  price: number;
  size: number;
  orders: number;
}

export interface AggregatedBook {
  bids: AggregatedOrder[];
  asks: AggregatedOrder[];
  market: string;
  timestamp: string;
}

export async function getAggregatedOrderBook(
  tokenId: string,
  depth: number = 10
): Promise<AggregatedBook | null> {
  try {
    const response = await fetch(
      `${CLOB_API_BASE}/book/aggregated?token_id=${tokenId}&depth=${depth}`
    );

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as AggregatedBook;
    return {
      ...data,
      bids: data.bids.map((b) => ({
        price: parseNumeric(b.price),
        size: parseNumeric(b.size),
        orders: parseNumeric(b.orders),
      })),
      asks: data.asks.map((a) => ({
        price: parseNumeric(a.price),
        size: parseNumeric(a.size),
        orders: parseNumeric(a.orders),
      })),
    };
  } catch (error) {
    console.error("Failed to fetch aggregated order book:", error);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//api Keys Management
// ─────────────────────────────────────────────────────────────────────────────

export interface ApiKey {
  key: string;
  secret: string;
  label: string;
  createdAt: string;
  expiresAt: string | null;
  lastUsed: string | null;
}

export async function getApiKeys(address: string): Promise<ApiKey[]> {
  try {
    const response = await fetch(`${CLOB_API_BASE}/api-keys?address=${address}`);

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }

    return data as ApiKey[];
  } catch (error) {
    console.error("Failed to fetch api keys:", error);
    return [];
  }
}

export async function createApiKey(
  address: string,
  label: string
): Promise<ApiKey | null> {
  try {
    const response = await fetch(`${CLOB_API_BASE}/api-keys`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ address, label }),
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as ApiKey;
    return data;
  } catch (error) {
    console.error("Failed to create api key:", error);
    return null;
  }
}

export async function deleteApiKey(keyId: string): Promise<boolean> {
  try {
    const response = await fetch(`${CLOB_API_BASE}/api-keys/${keyId}`, {
      method: "DELETE",
    });

    return response.ok;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// User Info API
// ─────────────────────────────────────────────────────────────────────────────

export interface UserInfo {
  address: string;
  username: string | null;
  email: string | null;
  verified: boolean;
  kyc: boolean;
  createdAt: string;
  volume30d: number;
  tradeCount: number;
}

export async function getUserInfo(address: string): Promise<UserInfo | null> {
  try {
    const response = await fetch(`${CLOB_API_BASE}/users/${address}`);

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as UserInfo;
    return {
      ...data,
      volume30d: parseNumeric(data.volume30d),
      tradeCount: parseNumeric(data.tradeCount),
    };
  } catch (error) {
    console.error("Failed to fetch user info:", error);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Gas Estimate API
// ─────────────────────────────────────────────────────────────────────────────

export interface GasEstimate {
  gasEstimate: string;
  gasPrice: string;
  totalCost: string;
  network: string;
}

export async function estimateGas(
  tokenId: string,
  side: "BUY" | "SELL",
  size: number,
  price: number
): Promise<GasEstimate | null> {
  try {
    const response = await fetch(`${CLOB_API_BASE}/estimate-gas`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token_id: tokenId, side, size, price }),
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as GasEstimate;
    return data;
  } catch (error) {
    console.error("Failed to estimate gas:", error);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Transactions API
// ─────────────────────────────────────────────────────────────────────────────

export interface Transaction {
  hash: string;
  type: "buy" | "sell" | "transfer" | "redeem" | "mint";
  status: "pending" | "confirmed" | "failed";
  blockNumber: number;
  timestamp: string;
  from: string;
  to: string;
  tokenId: string;
  amount: string;
  price: number;
  gasUsed: string;
}

export async function getTransactions(
  address: string,
  limit: number = 50,
  type?: string
): Promise<Transaction[]> {
  try {
    const params = new URLSearchParams({
      address,
      limit: String(limit),
    });

    if (type) {
      params.set("type", type);
    }

    const response = await fetch(`${CLOB_API_BASE}/transactions?${params}`);

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }

    return data.map((tx: Transaction) => ({
      ...tx,
      price: parseNumeric(tx.price),
      blockNumber: parseNumeric(tx.blockNumber),
    }));
  } catch (error) {
    console.error("Failed to fetch transactions:", error);
    return [];
  }
}
