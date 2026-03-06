/**
 * Polymarket CLOB API - Trading
 * Order placement, cancellation, and history
 * Base: https://clob.polymarket.com
 */

import { createWalletClient, http, getAddress, getCreate2Address, encodePacked, encodeAbiParameters, keccak256 } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygon } from "viem/chains";
import {
  ApiCredentials,
  fetchOrCreateApiCredentials,
  getClobL2Headers,
  loadWalletConfig,
  getClobAuthHeaders,
  fetchWithTimeout,
  parseApiCredentials,
  persistApiCredentialsForFunder,
  loadApiCredentialsForFunder,
} from "../../auth/wallet";
import { Order, PlacedOrder, OrderStatus } from "../../types/orders";

const CLOB_BASE = "https://clob.polymarket.com";
const GEO_BLOCK_URL = "https://polymarket.com/api/geoblock";
const GEO_BLOCK_CACHE_TTL_MS = 60_000;
const MAX_CANCEL_IDS_PER_REQUEST = 3000;

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
  orderType: "GTC" | "FOK" | "GTD" | "FAK";
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

interface ClobPagedResponse<T> {
  data?: T[];
  count?: number;
  limit?: number;
  next_cursor?: string;
}

interface ClobOrderScoringResponse {
  scoring?: boolean;
}

interface GeoblockResponse {
  blocked?: boolean;
  ip?: string;
  country?: string;
  region?: string;
}

let geoblockCache: {
  checkedAt: number;
  result: GeoblockResponse;
} | null = null;

function parseNumber(value: unknown, fallback: number = 0): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function parseTimestampMs(value: unknown): number {
  const parsed = parseNumber(value, Date.now());
  if (!Number.isFinite(parsed)) return Date.now();
  return parsed < 1_000_000_000_000 ? Math.round(parsed * 1000) : Math.round(parsed);
}

function parseSize(value: unknown): number {
  if (typeof value === "string") {
    const trimmed = value.trim();
    const parsed = parseNumber(trimmed, 0);
    if (trimmed.includes(".")) return parsed;
    return parsed / 1_000_000;
  }

  if (typeof value === "number") {
    return Number.isInteger(value) ? value / 1_000_000 : value;
  }

  const parsed = parseNumber(value, 0);
  return Number.isInteger(parsed) ? parsed / 1_000_000 : parsed;
}

async function parseJsonSafe<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
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
  if (value.includes("MATCHED")) return "MATCHED";
  if (value.includes("FILLED")) return "FILLED";
  if (value.includes("UNMATCHED")) return "UNMATCHED";
  if (value.includes("DELAYED")) return "DELAYED";
  if (value.includes("CANCELED") || value.includes("CANCELLED")) return "CANCELLED";
  if (value === "MATCHED") return "MATCHED";
  if (value === "FILLED") return "FILLED";
  if (value === "UNMATCHED") return "UNMATCHED";
  if (value === "DELAYED") return "DELAYED";
  if (value === "CANCELED" || value === "CANCELLED") return "CANCELLED";
  return "LIVE";
}

async function getGeoblockStatus(): Promise<GeoblockResponse | null> {
  const now = Date.now();
  if (geoblockCache && now - geoblockCache.checkedAt < GEO_BLOCK_CACHE_TTL_MS) {
    return geoblockCache.result;
  }

  try {
    const response = await fetch(GEO_BLOCK_URL);
    if (!response.ok) return null;

    const result = (await response.json()) as GeoblockResponse;
    geoblockCache = { checkedAt: now, result };
    return result;
  } catch {
    return null;
  }
}

async function ensureTradingAllowed(): Promise<void> {
  const geoblock = await getGeoblockStatus();
  if (!geoblock?.blocked) return;

  const region = geoblock.region ? `-${geoblock.region}` : "";
  throw new Error(`Trading unavailable from your region (${geoblock.country ?? "unknown"}${region}).`);
}

async function sendHeartbeat(privateKey: `0x${string}`, creds: ApiCredentials, heartbeatId?: string): Promise<string | undefined> {
  const requestPath = "/heartbeats";
  const headers = await createL2Headers(privateKey, creds, "POST", requestPath);
  const response = await fetch(`${CLOB_BASE}${requestPath}`, {
    method: "POST",
    headers,
  });

  if (!response.ok) {
    throw new Error(`Heartbeat rejected with HTTP ${response.status}`);
  }

  try {
    const data = await response.json() as { heartbeat_id?: string };
    return data.heartbeat_id;
  } catch {
    return undefined;
  }
}

function extractPagedRows<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) {
    return payload as T[];
  }

  if (payload && typeof payload === "object" && Array.isArray((payload as { data?: unknown[] }).data)) {
    return (payload as { data: T[] }).data;
  }

  return [];
}

function extractNextCursor(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const nextCursor = (payload as ClobPagedResponse<unknown>).next_cursor;
  if (typeof nextCursor !== "string" || nextCursor.length === 0) {
    return null;
  }
  return nextCursor;
}

function appendCursor(requestPath: string, cursor: string): string {
  const separator = requestPath.includes("?") ? "&" : "?";
  return `${requestPath}${separator}next_cursor=${encodeURIComponent(cursor)}`;
}

async function fetchAllPagedRows<T>(
  privateKey: `0x${string}`,
  creds: ApiCredentials,
  baseRequestPath: string,
  maxPages: number = 30,
): Promise<T[]> {
  const rows: T[] = [];
  let cursor: string | null = null;

  for (let page = 0; page < maxPages; page += 1) {
    const requestPath = cursor ? appendCursor(baseRequestPath, cursor) : baseRequestPath;
    const headers = await createL2Headers(privateKey, creds, "GET", requestPath);
    const response = await fetch(`${CLOB_BASE}${requestPath}`, { headers });
    if (!response.ok) {
      break;
    }

    const payload = (await parseJsonSafe<unknown>(response)) as unknown;
    if (payload === null) {
      break;
    }

    rows.push(...extractPagedRows<T>(payload));

    const nextCursor = extractNextCursor(payload);
    if (!nextCursor || nextCursor === cursor) {
      break;
    }

    cursor = nextCursor;
  }

  return rows;
}

async function resolveMarketByAssetId(
  privateKey: `0x${string}`,
  creds: ApiCredentials,
  assetId: string,
): Promise<string | null> {
  const requestPath = `/orders?asset_id=${encodeURIComponent(assetId)}`;
  const headers = await createL2Headers(privateKey, creds, "GET", requestPath);
  const response = await fetch(`${CLOB_BASE}${requestPath}`, { headers });
  if (!response.ok) return null;

  const payload = (await response.json()) as unknown;
  const rows = extractPagedRows<ClobOpenOrder>(payload);
  const market = rows.find((row) => row.asset_id === assetId && row.market)?.market ?? rows[0]?.market;
  return market ?? null;
}

async function getAuthContext(): Promise<{
  privateKey: `0x${string}`;
  creds: ApiCredentials;
  funderAddress?: string;
}> {
  const config = loadWalletConfig();
  if (!config?.privateKey) {
    throw new Error("No wallet connected");
  }

  const privateKey = config.privateKey as `0x${string}`;
  const funderAddress = config.funderAddress;

  let creds: ApiCredentials | null = null;

  if (funderAddress && funderAddress.toLowerCase() !== privateKeyToAccount(privateKey).address.toLowerCase()) {
    creds = loadApiCredentialsForFunder(funderAddress);
    if (!creds) {
      creds = await fetchOrCreateApiCredentialsForFunder(privateKey, funderAddress);
    }
  } else {
    creds = config.apiKey && config.apiSecret && config.apiPassphrase
      ? {
          apiKey: config.apiKey,
          apiSecret: config.apiSecret,
          apiPassphrase: config.apiPassphrase,
        }
      : null;
    if (!creds) {
      creds = await fetchOrCreateApiCredentials(privateKey);
    }
  }

  if (!creds) {
    throw new Error("Unable to derive CLOB API credentials");
  }

  return { privateKey, creds, funderAddress };
}

async function fetchOrCreateApiCredentialsForFunder(
  eoaPrivateKey: `0x${string}`,
  funderAddress: string
): Promise<ApiCredentials | null> {
  const cached = loadApiCredentialsForFunder(funderAddress);
  if (cached) return cached;

  try {
    const l1Headers = await getClobAuthHeaders(eoaPrivateKey, 0);

    const deriveResponse = await fetchWithTimeout(`${CLOB_BASE}/auth/derive-api-key`, {
      method: "GET",
      headers: {
        ...l1Headers,
        "Content-Type": "application/json",
      },
    });

    if (deriveResponse.ok) {
      const derivedPayload = await deriveResponse.json();
      const derived = parseApiCredentials(derivedPayload);
      if (derived) {
        persistApiCredentialsForFunder(funderAddress, derived);
        return derived;
      }
    }

    const createResponse = await fetchWithTimeout(`${CLOB_BASE}/auth/api-key`, {
      method: "POST",
      headers: {
        ...l1Headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    if (!createResponse.ok) {
      return null;
    }

    const createdPayload = await createResponse.json();
    const created = parseApiCredentials(createdPayload);
    if (created) {
      persistApiCredentialsForFunder(funderAddress, created);
      return created;
    }
  } catch {
    // fall through
  }

  return null;
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

const CTF_EXCHANGE = "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E";
const NEG_RISK_CTF_EXCHANGE = "0xC5d563A36AE78145C45a50134d48A1215220f80a";

const PROXY_FACTORY_POLYGON = "0xaB45c5A4B0c941a2F231C04C3f49182e1A254052";
const SAFE_FACTORY_POLYGON = "0xaacFeEa03eb1561C4e67d661e40682Bd20E3541b";
const PROXY_INIT_CODE_HASH = "0xd21df8dc65880a8606f09fe0ce3df9b8869287ab0b058be05aa9e8af6330a00b";
const SAFE_INIT_CODE_HASH = "0x2bce2127ff07fb632d16c8347c4ebf501f4841168bed00d9e6ef715ddb6fcecf";

function derivePolymarketProxyWallet(eoaAddress: string): string {
  return getCreate2Address({
    bytecodeHash: PROXY_INIT_CODE_HASH as `0x${string}`,
    from: PROXY_FACTORY_POLYGON as `0x${string}`,
    salt: keccak256(encodePacked(["address"], [eoaAddress as `0x${string}`])),
  });
}

function derivePolymarketSafeWallet(eoaAddress: string): string {
  return getCreate2Address({
    bytecodeHash: SAFE_INIT_CODE_HASH as `0x${string}`,
    from: SAFE_FACTORY_POLYGON as `0x${string}`,
    salt: keccak256(encodeAbiParameters([{ name: "owner", type: "address" }], [eoaAddress as `0x${string}`])),
  });
}

// signatureType: 0 = EOA, 1 = POLY_PROXY, 2 = POLY_GNOSIS_SAFE
function resolveSignatureType(eoaAddress: string, funderAddress: string | undefined): number {
  if (!funderAddress || funderAddress.toLowerCase() === eoaAddress.toLowerCase()) return 0;
  
  const funderLower = funderAddress.toLowerCase();
  const proxyAddr = derivePolymarketProxyWallet(eoaAddress).toLowerCase();
  const safeAddr = derivePolymarketSafeWallet(eoaAddress).toLowerCase();
  
  if (funderLower === proxyAddr) return 1;
  if (funderLower === safeAddr) return 2;
  
  return 2;
}

async function buildSignedOrder(
  privateKey: `0x${string}`,
  tokenId: string,
  side: "BUY" | "SELL",
  price: number,
  shares: number,
  orderType: "GTC" | "FOK" | "GTD" | "FAK",
  funderAddress?: string,
  negRisk?: boolean,
): Promise<ClobSignedOrder> {
  const account = privateKeyToAccount(privateKey);
  const exchangeAddress = negRisk ? NEG_RISK_CTF_EXCHANGE : CTF_EXCHANGE;
  const rawMaker = (funderAddress && funderAddress.trim()) ? funderAddress.trim() : account.address;
  const maker = getAddress(rawMaker); // normalize to EIP-55 checksum
  const signatureType = resolveSignatureType(account.address, funderAddress);

  const SCALE = 1_000_000n;
  const priceScaled = BigInt(Math.round(price * 1_000_000));
  const sharesScaled = BigInt(Math.round(shares * 1_000_000));
  const usdcAmount = (priceScaled * sharesScaled) / SCALE;

  const makerAmount = (side === "BUY" ? usdcAmount : sharesScaled).toString();
  const takerAmount = (side === "BUY" ? sharesScaled : usdcAmount).toString();

  const salt = Math.floor(Math.random() * 1_000_000_000);
  // GTD: 24h from now. GTC/FOK/FAK: "0"
  const expiration = orderType === "GTD" ? String(Math.floor(Date.now() / 1000) + 86_400) : "0";

  const domain = {
    name: "Polymarket CTF Exchange",
    version: "1",
    chainId: 137,
    verifyingContract: exchangeAddress as `0x${string}`,
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
    maker: maker as `0x${string}`,
    signer: account.address,
    taker: "0x0000000000000000000000000000000000000000" as `0x${string}`,
    tokenId: BigInt(tokenId),
    makerAmount: BigInt(makerAmount),
    takerAmount: BigInt(takerAmount),
    expiration: BigInt(expiration),
    nonce: 0n,
    feeRateBps: 0n,
    side: side === "BUY" ? 0n : 1n,
    signatureType: BigInt(signatureType),
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
    maker,
    signer: account.address,
    taker: "0x0000000000000000000000000000000000000000",
    tokenId,
    makerAmount,
    takerAmount,
    expiration,
    nonce: "0",
    feeRateBps: "0",
    side,
    signatureType,
    signature,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Order Placement
// ─────────────────────────────────────────────────────────────────────────────

export async function placeOrder(order: Order): Promise<PlacedOrder> {
  await ensureTradingAllowed();
  const { privateKey, creds, funderAddress } = await getAuthContext();
  const signedOrder = await buildSignedOrder(
    privateKey,
    order.tokenId,
    order.side,
    order.price,
    order.shares,
    order.type,
    funderAddress,
    order.negRisk,
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

  const data = (await parseJsonSafe<ClobOrderResponse>(response)) ?? {};
  if (!response.ok || data.errorMsg || data.success === false) {
    const errorText = data.errorMsg ?? data.error;
    throw new Error(mapOrderErrorMessage(errorText, response.status));
  }

  const orderId = data.orderId ?? data.orderID ?? "";
  const status = normalizeStatus(data.status);

  void sendHeartbeat(privateKey, creds).catch(() => {
    // Best-effort safety signal; order placement result is authoritative.
  });

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
// Batch Order Placement (max 15 per call)
// ─────────────────────────────────────────────────────────────────────────────

export async function placeBatchOrders(orders: Order[]): Promise<PlacedOrder[]> {
  if (orders.length === 0) return [];
  if (orders.length > 15) throw new Error("Batch order limit is 15 orders per call");

  await ensureTradingAllowed();
  const { privateKey, creds, funderAddress } = await getAuthContext();

  const signedOrders = await Promise.all(
    orders.map((order) =>
      buildSignedOrder(
        privateKey,
        order.tokenId,
        order.side,
        order.price,
        order.shares,
        order.type,
        funderAddress,
        order.negRisk,
      )
    )
  );

  const payloads: ClobOrderPayload[] = signedOrders.map((signedOrder, i) => ({
    order: signedOrder,
    owner: creds.apiKey,
    orderType: orders[i].type,
    ...(orders[i].postOnly ? { postOnly: true } : {}),
  }));

  const body = JSON.stringify(payloads);
  const headers = await createL2Headers(privateKey, creds, "POST", "/orders", body);
  const response = await fetch(`${CLOB_BASE}/orders`, {
    method: "POST",
    headers,
    body,
  });

  const data = (await parseJsonSafe<ClobOrderResponse[] | ClobOrderResponse>(response)) ?? { error: `HTTP ${response.status}` };

  if (!response.ok) {
    const single = Array.isArray(data) ? data[0] : data;
    const errorText = single?.errorMsg ?? single?.error;
    throw new Error(mapOrderErrorMessage(errorText, response.status));
  }

  const results = Array.isArray(data) ? data : [data];
  const failed = results.filter((item) => item.success === false || Boolean(item.errorMsg) || Boolean(item.error));
  if (failed.length === results.length && failed.length > 0) {
    const firstFailure = failed[0];
    throw new Error(mapOrderErrorMessage(firstFailure.errorMsg ?? firstFailure.error, response.status));
  }

  return results.map((item, i) => {
    const orderId = item.orderId ?? item.orderID ?? "";
    const status = normalizeStatus(item.status);
    const order = orders[i];
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
    } as PlacedOrder;
  });
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

  const data = (await parseJsonSafe<{
    canceled?: string[];
    not_canceled?: Record<string, string>;
    error?: string;
    errorMsg?: string;
  }>(response)) ?? {};

  if (!response.ok) {
    const reason = data.errorMsg ?? data.error ?? `HTTP ${response.status}`;
    throw new Error(mapCancelErrorMessage(reason, response.status));
  }

  const canceled = Array.isArray(data.canceled) && data.canceled.includes(orderId);
  if (!canceled) {
    const reason = data.not_canceled?.[orderId] ?? "order not cancelable";
    throw new Error(`Cancel rejected: ${reason}`);
  }

  void sendHeartbeat(privateKey, creds).catch(() => {
    // Best-effort safety signal after cancel mutation.
  });

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

  const data = (await parseJsonSafe<{
    canceled?: string[];
    not_canceled?: Record<string, string>;
    error?: string;
    errorMsg?: string;
  }>(response)) ?? {};

  if (!response.ok) {
    const reason = data.errorMsg ?? data.error;
    throw new Error(mapCancelErrorMessage(reason, response.status));
  }

  void sendHeartbeat(privateKey, creds).catch(() => {
    // Best-effort safety signal after cancel mutation.
  });

  return {
    canceled: Array.isArray(data.canceled) ? data.canceled : [],
    notCanceled: data.not_canceled ?? {},
  };
}

export async function cancelAllOrders(): Promise<{ canceled: string[]; notCanceled: Record<string, string> }> {
  return cancelWithBody("/cancel-all", undefined);
}

export async function cancelOrdersBulk(orderIds: string[]): Promise<{ canceled: string[]; notCanceled: Record<string, string> }> {
  const uniqueOrderIds = Array.from(new Set(orderIds.filter(Boolean)));
  if (uniqueOrderIds.length === 0) {
    return { canceled: [], notCanceled: {} };
  }

  if (uniqueOrderIds.length <= MAX_CANCEL_IDS_PER_REQUEST) {
    const body = JSON.stringify(uniqueOrderIds);
    return cancelWithBody("/orders", body);
  }

  const aggregate = { canceled: [] as string[], notCanceled: {} as Record<string, string> };
  for (let i = 0; i < uniqueOrderIds.length; i += MAX_CANCEL_IDS_PER_REQUEST) {
    const chunk = uniqueOrderIds.slice(i, i + MAX_CANCEL_IDS_PER_REQUEST);
    const body = JSON.stringify(chunk);
    const result = await cancelWithBody("/orders", body);
    aggregate.canceled.push(...result.canceled);
    Object.assign(aggregate.notCanceled, result.notCanceled);
  }

  return aggregate;
}

export async function cancelOrdersForAssetIds(assetIds: string[]): Promise<{ canceled: string[]; notCanceled: Record<string, string> }> {
  const uniqueIds = Array.from(new Set(assetIds.filter(Boolean)));
  if (uniqueIds.length === 0) {
    return { canceled: [], notCanceled: {} };
  }

  const { privateKey, creds } = await getAuthContext();
  const aggregate: { canceled: string[]; notCanceled: Record<string, string> } = {
    canceled: [],
    notCanceled: {},
  };

  for (const assetId of uniqueIds) {
    const market = await resolveMarketByAssetId(privateKey, creds, assetId);
    const body = JSON.stringify(
      market ? { market, asset_id: assetId } : { asset_id: assetId }
    );
    const result = await cancelWithBody("/cancel-market-orders", body);
    aggregate.canceled.push(...result.canceled);
    Object.assign(aggregate.notCanceled, result.notCanceled);
  }

  return aggregate;
}

export async function getOrderScoringStatus(orderId: string): Promise<boolean | null> {
  if (!orderId) return null;

  try {
    const { privateKey, creds } = await getAuthContext();
    const requestPath = `/order-scoring?order_id=${encodeURIComponent(orderId)}`;
    const headers = await createL2Headers(privateKey, creds, "GET", requestPath);

    const response = await fetch(`${CLOB_BASE}${requestPath}`, { headers });
    if (!response.ok) return null;

    const payload = await parseJsonSafe<ClobOrderScoringResponse>(response);
    if (!payload || typeof payload.scoring !== "boolean") return null;
    return payload.scoring;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Order History
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchOpenOrders(): Promise<PlacedOrder[]> {
  try {
    const { privateKey, creds } = await getAuthContext();
    const rows = await fetchAllPagedRows<ClobOpenOrder>(privateKey, creds, "/orders");

    return rows
      .map((row) => {
        const originalSize = parseSize(row.original_size ?? row.size);
        const sizeMatched = parseSize(row.size_matched);
        return {
          orderId: row.id ?? row.orderId ?? "",
          tokenId: row.asset_id ?? "",
          side: (row.side?.toUpperCase() === "SELL" ? "SELL" : "BUY") as "BUY" | "SELL",
          price: parseNumber(row.price, 0),
          originalSize,
          sizeMatched,
          sizeRemaining: Math.max(0, originalSize - sizeMatched),
          status: normalizeStatus(row.status),
          createdAt: parseTimestampMs(row.created_at),
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
    const { privateKey, creds, funderAddress } = await getAuthContext();
    // Trades are recorded against the funder/proxy wallet, not the EOA signer
    const makerAddress = funderAddress ?? privateKeyToAccount(privateKey).address;
    const basePath = `/trades?maker_address=${encodeURIComponent(makerAddress)}`;
    const rows = await fetchAllPagedRows<ClobTrade>(privateKey, creds, basePath);

    return rows
      .map((trade) => {
        const size = parseSize(trade.size);
        return {
          orderId: trade.taker_order_id ?? trade.id ?? "",
          tokenId: trade.asset_id ?? "",
          side: (trade.side?.toUpperCase() === "SELL" ? "SELL" : "BUY") as "BUY" | "SELL",
          price: parseNumber(trade.price, 0),
          originalSize: size,
          sizeMatched: size,
          sizeRemaining: 0,
          status: "FILLED" as OrderStatus,
          createdAt: parseTimestampMs(trade.match_time ?? trade.last_update),
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

let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
let currentHeartbeatId: string | undefined = undefined;

export function startHeartbeat(): void {
  if (heartbeatInterval !== null) return;

  heartbeatInterval = setInterval(async () => {
    try {
      const { privateKey, creds } = await getAuthContext();
      currentHeartbeatId = await sendHeartbeat(privateKey, creds, currentHeartbeatId);
    } catch {
      // Silently ignore heartbeat errors - will retry on next interval
    }
  }, 5000);
}

export function stopHeartbeat(): void {
  if (heartbeatInterval !== null) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
    currentHeartbeatId = undefined;
  }
}
