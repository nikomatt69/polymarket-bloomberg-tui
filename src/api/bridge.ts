/**
 * Polymarket Bridge API
 * Base: https://bridge-api.polymarket.com
 */

const BRIDGE_API_BASE = "https://bridge-api.polymarket.com";

// Cache for static bridge data
const CACHE_TTL_MS = 300_000; // 5 minutes

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const bridgeAssetsCache: CacheEntry<BridgeAsset[]> | null = null;
const bridgeStatusCache: CacheEntry<BridgeStatusResponse> | null = null;

function getCachedData<T>(entry: CacheEntry<T> | null): T | null {
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) return null;
  return entry.data;
}

let _bridgeAssetsCache: CacheEntry<BridgeAsset[]> | null = null;
let _bridgeStatusCache: CacheEntry<BridgeStatusResponse> | null = null;

function getBridgeAssetsCached(): BridgeAsset[] | null {
  if (!_bridgeAssetsCache) return null;
  if (Date.now() - _bridgeAssetsCache.timestamp > CACHE_TTL_MS) return null;
  return _bridgeAssetsCache.data;
}

function setBridgeAssetsCached(data: BridgeAsset[]): void {
  _bridgeAssetsCache = { data, timestamp: Date.now() };
}

function getBridgeStatusCached(): BridgeStatusResponse | null {
  if (!_bridgeStatusCache) return null;
  if (Date.now() - _bridgeStatusCache.timestamp > CACHE_TTL_MS) return null;
  return _bridgeStatusCache.data;
}

function setBridgeStatusCached(data: BridgeStatusResponse): void {
  _bridgeStatusCache = { data, timestamp: Date.now() };
}

// ─────────────────────────────────────────────────────────────────────────────
// Deposit Addresses API
// ─────────────────────────────────────────────────────────────────────────────

export interface DepositAddressRequest {
  asset: string;
  sourceChain: string;
  destinationChain: string;
}

export interface DepositAddressResponse {
  address: string;
  memo?: string;
  chain: string;
  asset: string;
  expiresAt: string;
}

export async function getDepositAddress(
  asset: string,
  sourceChain: string,
  destinationChain: string = "polygon"
): Promise<DepositAddressResponse | null> {
  try {
    const response = await fetch(`${BRIDGE_API_BASE}/bridge/deposit-addresses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        asset,
        sourceChain,
        destinationChain,
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as DepositAddressResponse;
    return data;
  } catch (error) {
    console.error("Failed to get deposit address:", error);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Withdrawal Addresses API
// ─────────────────────────────────────────────────────────────────────────────

export interface WithdrawalAddressRequest {
  asset: string;
  sourceChain: string;
  destinationChain: string;
}

export interface WithdrawalAddressResponse {
  address: string;
  chain: string;
  asset: string;
}

export async function getWithdrawalAddress(
  asset: string,
  sourceChain: string = "polygon",
  destinationChain: string
): Promise<WithdrawalAddressResponse | null> {
  try {
    const response = await fetch(`${BRIDGE_API_BASE}/bridge/withdrawal-addresses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        asset,
        sourceChain,
        destinationChain,
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as WithdrawalAddressResponse;
    return data;
  } catch (error) {
    console.error("Failed to get withdrawal address:", error);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Bridge Quote API
// ─────────────────────────────────────────────────────────────────────────────

export interface BridgeQuoteRequest {
  asset: string;
  amount: string;
  sourceChain: string;
  destinationChain: string;
}

export interface BridgeFee {
  amount: string;
  asset: string;
}

export interface BridgeQuoteResponse {
  sourceChain: string;
  destinationChain: string;
  asset: string;
  amount: string;
  estimatedReceiveAmount: string;
  estimatedDuration: string;
  fees: BridgeFee[];
  priceImpact: number | null;
}

export async function getBridgeQuote(
  asset: string,
  amount: string,
  sourceChain: string,
  destinationChain: string
): Promise<BridgeQuoteResponse | null> {
  try {
    const params = new URLSearchParams({
      asset,
      amount,
      sourceChain,
      destinationChain,
    });

    const response = await fetch(`${BRIDGE_API_BASE}/bridge/quote?${params}`);

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as BridgeQuoteResponse;
    return data;
  } catch (error) {
    console.error("Failed to get bridge quote:", error);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Bridge Assets API
// ─────────────────────────────────────────────────────────────────────────────

export interface BridgeAsset {
  asset: string;
  name: string;
  symbol: string;
  decimals: number;
  chains: string[];
  minAmount: string;
  maxAmount: string | null;
}

export async function getBridgeAssets(): Promise<BridgeAsset[]> {
  // Check cache first
  const cached = getBridgeAssetsCached();
  if (cached) return cached;

  try {
    const response = await fetch(`${BRIDGE_API_BASE}/bridge/assets`);

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }

    const assets = data as BridgeAsset[];
    setBridgeAssetsCached(assets);
    return assets;
  } catch (error) {
    console.error("Failed to get bridge assets:", error);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Bridge Status API
// ─────────────────────────────────────────────────────────────────────────────

export interface ChainStatus {
  chain: string;
  status: "operational" | "degraded" | "down";
  avgConfirmationTime: string | null;
}

export interface BridgeStatusResponse {
  overall: "operational" | "degraded" | "down";
  chains: ChainStatus[];
  lastUpdated: string;
}

export async function getBridgeStatus(): Promise<BridgeStatusResponse | null> {
  // Check cache first
  const cached = getBridgeStatusCached();
  if (cached) return cached;

  try {
    const response = await fetch(`${BRIDGE_API_BASE}/bridge/status`);

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as BridgeStatusResponse;
    setBridgeStatusCached(data);
    return data;
  } catch (error) {
    console.error("Failed to get bridge status:", error);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Bridge Transactions API
// ─────────────────────────────────────────────────────────────────────────────

export interface BridgeTransaction {
  id: string;
  hash: string;
  asset: string;
  amount: string;
  sourceChain: string;
  destinationChain: string;
  status: "pending" | "confirmed" | "failed";
  createdAt: string;
  confirmedAt: string | null;
}

export async function getBridgeTransactions(
  address: string,
  limit: number = 50,
  offset: number = 0
): Promise<BridgeTransaction[]> {
  try {
    const params = new URLSearchParams({
      address,
      limit: String(limit),
      offset: String(offset),
    });

    const response = await fetch(`${BRIDGE_API_BASE}/bridge/transactions?${params}`);

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }

    return data as BridgeTransaction[];
  } catch (error) {
    console.error("Failed to get bridge transactions:", error);
    return [];
  }
}
