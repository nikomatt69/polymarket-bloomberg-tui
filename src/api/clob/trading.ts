/**
 * Polymarket CLOB API - Trading
 * Order placement, cancellation, and history
 * Base: https://clob.polymarket.com
 */

import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygon } from "viem/chains";
import {
  ApiCredentials,
  fetchOrCreateApiCredentials,
  getClobL2Headers,
  loadWalletConfig,
} from "../../auth/wallet";
import { Order, PlacedOrder, OrderStatus } from "../../types/orders";

const CLOB_BASE = "https://clob.polymarket.com";

interface ClobSignedOrder {
  salt: number;
  maker: string;
  signer: string;
  taker: string;
  tokenId: string;
  makerAmount: string;
  takerAmount: string;
  expiration: string;
  nonce: string;
  feeRateBps: string;
  side: string;
  signatureType: number;
  signature: string;
}

interface ClobOrderPayload {
  order: ClobSignedOrder;
  owner: string;
  orderType: "GTC" | "FOK" | "GTD";
  postOnly?: boolean;
}

interface ClobOrderResponse {
  success?: boolean;
  orderId?: string;
  orderID?: string;
  status?: string;
  errorMsg?: string;
  error?: string;
}

interface ClobOpenOrder {
  id?: string;
  orderId?: string;
  asset_id?: string;
  side?: string;
  original_size?: string;
  size_matched?: string;
  size?: string;
  price?: string;
  status?: string;
  created_at?: string;
  market?: string;
  outcome?: string;
}

interface ClobTrade {
  id?: string;
  taker_order_id?: string;
  asset_id?: string;
  side?: string;
  size?: string;
  price?: string;
  status?: string;
  match_time?: string;
  last_update?: string;
  outcome?: string;
  market?: string;
  type?: string;
}

function parseNumber(value: unknown, fallback: number = 0): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function mapOrderErrorMessage(rawError: string | undefined, status: number): string {
  const msg = (rawError ?? "").toUpperCase();

  if (status === 401 || msg.includes("UNAUTHORIZED")) {
    return "Order rejected: authentication failed. Reconnect wallet to refresh API credentials.";
  }
  if (msg.includes("INVALID_ORDER_NOT_ENOUGH_BALANCE")) {
    return "Order rejected: insufficient balance or token allowance for this trade.";
  }
  if (msg.includes("INVALID_ORDER_MIN_TICK_SIZE")) {
    return "Order rejected: price does not respect market tick size.";
  }
  if (msg.includes("INVALID_ORDER_MIN_SIZE")) {
    return "Order rejected: size is below the market minimum order size.";
  }
  if (msg.includes("INVALID_ORDER_EXPIRATION")) {
    return "Order rejected: expiration is invalid or too close to current time.";
  }
  if (msg.includes("FOK_ORDER_NOT_FILLED_ERROR")) {
    return "FOK order rejected: no immediate full fill available at this price.";
  }
  if (msg.includes("INVALID_POST_ONLY_ORDER")) {
    return "Post-only order rejected because it crosses the current book.";
  }
  if (msg.includes("MARKET_NOT_READY")) {
    return "Order rejected: market is not ready to accept new orders.";
  }
  if (msg.includes("ORDER_DELAYED") || msg.includes("DELAYING_ORDER_ERROR")) {
    return "Order delayed by exchange matching conditions. Retry after a short refresh.";
  }
  if (rawError && rawError.trim().length > 0) {
    return `Order rejected: ${rawError}`;
  }
  return `Order rejected with HTTP ${status}`;
}

function mapCancelErrorMessage(rawError: string | undefined, status: number): string {
  const msg = (rawError ?? "").toUpperCase();

  if (status === 401 || msg.includes("UNAUTHORIZED")) {
    return "Cancel rejected: authentication failed. Reconnect wallet to refresh API credentials.";
  }
  if (msg.includes("ORDER") && msg.includes("NOT") && msg.includes("FOUND")) {
    return "Cancel rejected: order no longer exists or was already finalized.";
  }
  if (rawError && rawError.trim().length > 0) {
    return `Cancel rejected: ${rawError}`;
  }
  return `Cancel rejected with HTTP ${status}`;
}

function normalizeStatus(status?: string): OrderStatus {
  const value = (status ?? "").toUpperCase();
  if (value === "MATCHED") return "MATCHED";
  if (value === "FILLED") return "FILLED";
  if (value === "UNMATCHED") return "UNMATCHED";
  if (value === "DELAYED") return "DELAYED";
  if (value === "CANCELED" || value === "CANCELLED") return "CANCELLED";
  return "LIVE";
}

async function getAuthContext(): Promise<{
  privateKey: `0x${string}`;
  creds: ApiCredentials;
}> {
  const config = loadWalletConfig();
  if (!config?.privateKey) {
    throw new Error("No wallet connected");
  }

  const privateKey = config.privateKey as `0x${string}`;
  const credsFromConfig =
    config.apiKey && config.apiSecret && config.apiPassphrase
      ? {
          apiKey: config.apiKey,
          apiSecret: config.apiSecret,
          apiPassphrase: config.apiPassphrase,
        }
      : null;

  const creds = credsFromConfig ?? (await fetchOrCreateApiCredentials(privateKey));
  if (!creds) {
    throw new Error("Unable to derive CLOB API credentials");
  }

  return { privateKey, creds };
}

async function createL2Headers(
  privateKey: `0x${string}`,
  creds: ApiCredentials,
  method: string,
  requestPath: string,
  body?: string,
): Promise<Record<string, string>> {
  const headers = await getClobL2Headers(privateKey, creds, {
    method,
    requestPath,
    body,
  });

  return {
    ...headers,
    "Content-Type": "application/json",
  };
}

async function buildSignedOrder(
  privateKey: `0x${string}`,
  tokenId: string,
  side: "BUY" | "SELL",
  price: number,
  shares: number,
  orderType: "GTC" | "FOK" | "GTD",
): Promise<ClobSignedOrder> {
  const account = privateKeyToAccount(privateKey);
  const CTF_EXCHANGE = "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E";

  const SCALE = 1_000_000n;
  const priceScaled = BigInt(Math.round(price * 1_000_000));
  const sharesScaled = BigInt(Math.round(shares * 1_000_000));
  const usdcAmount = (priceScaled * sharesScaled) / SCALE;

  const makerAmount = (side === "BUY" ? usdcAmount : sharesScaled).toString();
  const takerAmount = (side === "BUY" ? sharesScaled : usdcAmount).toString();

  const salt = Math.floor(Math.random() * 1_000_000_000);
  const expiration = orderType === "GTD" ? String(Math.floor(Date.now() / 1000) + 86_400) : "0";

  const domain = {
    name: "Polymarket CTF Exchange",
    version: "1",
    chainId: 137,
    verifyingContract: CTF_EXCHANGE as `0x${string}`,
  };

  const types = {
    Order: [
      { name: "salt", type: "uint256" },
      { name: "maker", type: "address" },
      { name: "signer", type: "address" },
      { name: "taker", type: "address" },
      { name: "tokenId", type: "uint256" },
      { name: "makerAmount", type: "uint256" },
      { name: "takerAmount", type: "uint256" },
      { name: "expiration", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "feeRateBps", type: "uint256" },
      { name: "side", type: "uint8" },
      { name: "signatureType", type: "uint8" },
    ],
  };

  const message = {
    salt: BigInt(salt),
    maker: account.address,
    signer: account.address,
    taker: "0x0000000000000000000000000000000000000000" as `0x${string}`,
    tokenId: BigInt(tokenId),
    makerAmount: BigInt(makerAmount),
    takerAmount: BigInt(takerAmount),
    expiration: BigInt(expiration),
    nonce: 0n,
    feeRateBps: 0n,
    side: side === "BUY" ? 0n : 1n,
    signatureType: 0n,
  };

  const walletClient = createWalletClient({
    account,
    chain: polygon,
    transport: http("https://polygon-rpc.com"),
  });

  const signature = await walletClient.signTypedData({
    domain,
    types,
    primaryType: "Order",
    message,
  });

  return {
    salt,
    maker: account.address,
    signer: account.address,
    taker: "0x0000000000000000000000000000000000000000",
    tokenId,
    makerAmount,
    takerAmount,
    expiration,
    nonce: "0",
    feeRateBps: "0",
    side,
    signatureType: 0,
    signature,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Order Placement
// ─────────────────────────────────────────────────────────────────────────────

export async function placeOrder(order: Order): Promise<PlacedOrder> {
  const { privateKey, creds } = await getAuthContext();
  const signedOrder = await buildSignedOrder(
    privateKey,
    order.tokenId,
    order.side,
    order.price,
    order.shares,
    order.type,
  );

  const payload: ClobOrderPayload = {
    order: signedOrder,
    owner: creds.apiKey,
    orderType: order.type,
    ...(order.postOnly ? { postOnly: true } : {}),
  };
  const body = JSON.stringify(payload);

  const headers = await createL2Headers(privateKey, creds, "POST", "/order", body);
  const response = await fetch(`${CLOB_BASE}/order`, {
    method: "POST",
    headers,
    body,
  });

  const data = (await response.json()) as ClobOrderResponse;
  if (!response.ok || data.errorMsg || data.success === false) {
    const errorText = data.errorMsg ?? data.error;
    throw new Error(mapOrderErrorMessage(errorText, response.status));
  }

  const orderId = data.orderId ?? data.orderID ?? "";
  const status = normalizeStatus(data.status);

  return {
    orderId,
    tokenId: order.tokenId,
    side: order.side,
    price: order.price,
    originalSize: order.shares,
    sizeMatched: status === "MATCHED" || status === "FILLED" ? order.shares : 0,
    sizeRemaining: status === "MATCHED" || status === "FILLED" ? 0 : order.shares,
    status,
    createdAt: Date.now(),
    postOnly: order.postOnly,
    marketTitle: order.marketTitle,
    outcomeTitle: order.outcomeTitle,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Order Cancellation
// ─────────────────────────────────────────────────────────────────────────────

export async function cancelOrder(orderId: string): Promise<boolean> {
  const { privateKey, creds } = await getAuthContext();
  const body = JSON.stringify({ orderID: orderId });
  const headers = await createL2Headers(privateKey, creds, "DELETE", "/order", body);

  const response = await fetch(`${CLOB_BASE}/order`, {
    method: "DELETE",
    headers,
    body,
  });

  const data = (await response.json()) as {
    canceled?: string[];
    not_canceled?: Record<string, string>;
    error?: string;
    errorMsg?: string;
  };

  if (!response.ok) {
    const reason = data.errorMsg ?? data.error ?? `HTTP ${response.status}`;
    throw new Error(mapCancelErrorMessage(reason, response.status));
  }

  const canceled = Array.isArray(data.canceled) && data.canceled.includes(orderId);
  if (!canceled) {
    const reason = data.not_canceled?.[orderId] ?? "order not cancelable";
    throw new Error(`Cancel rejected: ${reason}`);
  }

  return true;
}

async function cancelWithBody(
  requestPath: string,
  body: string | undefined,
): Promise<{ canceled: string[]; notCanceled: Record<string, string> }> {
  const { privateKey, creds } = await getAuthContext();
  const headers = await createL2Headers(privateKey, creds, "DELETE", requestPath, body);

  const response = await fetch(`${CLOB_BASE}${requestPath}`, {
    method: "DELETE",
    headers,
    ...(body ? { body } : {}),
  });

  const data = (await response.json()) as {
    canceled?: string[];
    not_canceled?: Record<string, string>;
    error?: string;
    errorMsg?: string;
  };

  if (!response.ok) {
    const reason = data.errorMsg ?? data.error;
    throw new Error(mapCancelErrorMessage(reason, response.status));
  }

  return {
    canceled: Array.isArray(data.canceled) ? data.canceled : [],
    notCanceled: data.not_canceled ?? {},
  };
}

export async function cancelAllOrders(): Promise<{ canceled: string[]; notCanceled: Record<string, string> }> {
  return cancelWithBody("/cancel-all", undefined);
}

export async function cancelOrdersBulk(orderIds: string[]): Promise<{ canceled: string[]; notCanceled: Record<string, string> }> {
  if (orderIds.length === 0) {
    return { canceled: [], notCanceled: {} };
  }

  const body = JSON.stringify(orderIds);
  return cancelWithBody("/orders", body);
}

export async function cancelOrdersForAssetIds(assetIds: string[]): Promise<{ canceled: string[]; notCanceled: Record<string, string> }> {
  const uniqueIds = Array.from(new Set(assetIds.filter(Boolean)));
  if (uniqueIds.length === 0) {
    return { canceled: [], notCanceled: {} };
  }

  const aggregate: { canceled: string[]; notCanceled: Record<string, string> } = {
    canceled: [],
    notCanceled: {},
  };

  for (const assetId of uniqueIds) {
    const body = JSON.stringify({ asset_id: assetId });
    const result = await cancelWithBody("/cancel-market-orders", body);
    aggregate.canceled.push(...result.canceled);
    Object.assign(aggregate.notCanceled, result.notCanceled);
  }

  return aggregate;
}

// ─────────────────────────────────────────────────────────────────────────────
// Order History
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchOpenOrders(): Promise<PlacedOrder[]> {
  try {
    const { privateKey, creds } = await getAuthContext();
    const requestPath = "/data/orders";
    const headers = await createL2Headers(privateKey, creds, "GET", requestPath);

    const response = await fetch(`${CLOB_BASE}${requestPath}`, { headers });
    if (!response.ok) return [];

    const payload = (await response.json()) as unknown;
    const rows = Array.isArray(payload)
      ? (payload as ClobOpenOrder[])
      : Array.isArray((payload as { data?: unknown[] })?.data)
        ? ((payload as { data: ClobOpenOrder[] }).data)
        : [];

    return rows
      .map((row) => {
        const originalSize = parseNumber(row.original_size ?? row.size, 0);
        const sizeMatched = parseNumber(row.size_matched, 0);
        return {
          orderId: row.id ?? row.orderId ?? "",
          tokenId: row.asset_id ?? "",
          side: (row.side?.toUpperCase() === "SELL" ? "SELL" : "BUY") as "BUY" | "SELL",
          price: parseNumber(row.price, 0),
          originalSize,
          sizeMatched,
          sizeRemaining: Math.max(0, originalSize - sizeMatched),
          status: normalizeStatus(row.status),
          createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
          marketTitle: row.market,
          outcomeTitle: row.outcome,
        } as PlacedOrder;
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export async function fetchTradeHistory(): Promise<PlacedOrder[]> {
  try {
    const { privateKey, creds } = await getAuthContext();
    const requestPath = "/data/trades";
    const headers = await createL2Headers(privateKey, creds, "GET", requestPath);

    const response = await fetch(`${CLOB_BASE}${requestPath}`, { headers });
    if (!response.ok) return [];

    const payload = (await response.json()) as unknown;
    const rows = Array.isArray(payload)
      ? (payload as ClobTrade[])
      : Array.isArray((payload as { data?: unknown[] })?.data)
        ? ((payload as { data: ClobTrade[] }).data)
        : [];

    return rows
      .map((trade) => {
        const size = parseNumber(trade.size, 0);
        return {
          orderId: trade.taker_order_id ?? trade.id ?? "",
          tokenId: trade.asset_id ?? "",
          side: (trade.side?.toUpperCase() === "SELL" ? "SELL" : "BUY") as "BUY" | "SELL",
          price: parseNumber(trade.price, 0),
          originalSize: size,
          sizeMatched: size,
          sizeRemaining: 0,
          status: "FILLED" as OrderStatus,
          createdAt: trade.match_time
            ? new Date(trade.match_time).getTime()
            : trade.last_update
              ? new Date(trade.last_update).getTime()
              : Date.now(),
          marketTitle: trade.market,
          outcomeTitle: trade.outcome,
        } as PlacedOrder;
      })
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 50);
  } catch {
    return [];
  }
}
