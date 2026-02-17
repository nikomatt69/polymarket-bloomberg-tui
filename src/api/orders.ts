/**
 * Polymarket CLOB order API
 * Uses L1 ECDSA auth (getClobAuthHeaders) for all mutating requests
 * and L2 API-key auth for order placement (per CLOB docs)
 */

import { Order, PlacedOrder, OrderStatus } from "../types/orders";
import { getClobAuthHeaders } from "../auth/wallet";
import { loadWalletConfig } from "../auth/wallet";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygon } from "viem/chains";

const CLOB_BASE = "https://clob.polymarket.com";

interface ClobOrderPayload {
  order: {
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
  };
  owner: string;
  orderType: string;
}

interface ClobOrderResponse {
  orderId?: string;
  orderID?: string;
  status?: string;
  errorMsg?: string;
}

interface ClobOpenOrder {
  id?: string;
  orderId?: string;
  asset_id?: string;
  side?: string;
  original_size?: string;
  size_matched?: string;
  price?: string;
  status?: string;
  created_at?: string;
  associate_trades?: Array<{ matched_amount?: string }>;
}

/**
 * Build and sign a CLOB EIP-712 order
 * Polymarket uses a custom EIP-712 domain for their CTF Exchange contract
 */
async function buildSignedOrder(
  privateKey: `0x${string}`,
  tokenId: string,
  side: "BUY" | "SELL",
  price: number,
  shares: number,
  orderType: "GTC" | "FOK" | "GTD"
): Promise<ClobOrderPayload> {
  const account = privateKeyToAccount(privateKey);

  // CTF Exchange on Polygon
  const CTF_EXCHANGE = "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E";

  // price and size as integers (USDC has 6 decimals, shares have 6 decimals)
  // makerAmount: what we give, takerAmount: what we want
  // BUY: give USDC (price * shares * 1e6), receive shares (shares * 1e6)
  // SELL: give shares (shares * 1e6), receive USDC (price * shares * 1e6)
  const SCALE = 1_000_000n;
  const priceScaled = BigInt(Math.round(price * 1_000_000));
  const sharesScaled = BigInt(Math.round(shares * 1_000_000));
  const usdcAmount = (priceScaled * sharesScaled) / SCALE;

  const makerAmount = (side === "BUY" ? usdcAmount : sharesScaled).toString();
  const takerAmount = (side === "BUY" ? sharesScaled : usdcAmount).toString();

  const salt = Math.floor(Math.random() * 1_000_000_000);
  const expiration = orderType === "GTD"
    ? String(Math.floor(Date.now() / 1000) + 86400)
    : "0";

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

  const orderMessage = {
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
    message: orderMessage,
  });

  return {
    order: {
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
      side: side === "BUY" ? "BUY" : "SELL",
      signatureType: 0,
      signature,
    },
    owner: account.address,
    orderType,
  };
}

/**
 * Place an order on the CLOB
 */
export async function placeOrder(order: Order): Promise<PlacedOrder> {
  const config = loadWalletConfig();
  if (!config?.privateKey) throw new Error("No wallet connected");

  const pk = config.privateKey as `0x${string}`;
  const headers = await getClobAuthHeaders(pk);

  const payload = await buildSignedOrder(
    pk,
    order.tokenId,
    order.side,
    order.price,
    order.shares,
    order.type
  );

  const response = await fetch(`${CLOB_BASE}/order`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json() as ClobOrderResponse;

  if (!response.ok || data.errorMsg) {
    throw new Error(data.errorMsg ?? `Order failed: ${response.status}`);
  }

  const orderId = data.orderId ?? data.orderID ?? `local_${Date.now()}`;

  return {
    orderId,
    tokenId: order.tokenId,
    side: order.side,
    price: order.price,
    originalSize: order.shares,
    sizeMatched: 0,
    sizeRemaining: order.shares,
    status: (data.status as OrderStatus) ?? "LIVE",
    createdAt: Date.now(),
    marketTitle: order.marketTitle,
    outcomeTitle: order.outcomeTitle,
  };
}

/**
 * Cancel an open order
 */
export async function cancelOrder(orderId: string): Promise<boolean> {
  const config = loadWalletConfig();
  if (!config?.privateKey) throw new Error("No wallet connected");

  const pk = config.privateKey as `0x${string}`;
  const headers = await getClobAuthHeaders(pk);

  const response = await fetch(`${CLOB_BASE}/order/${orderId}`, {
    method: "DELETE",
    headers: { ...headers, "Content-Type": "application/json" },
  });

  return response.ok;
}

/**
 * Fetch open orders for the connected wallet
 */
export async function fetchOpenOrders(): Promise<PlacedOrder[]> {
  const config = loadWalletConfig();
  if (!config?.privateKey || !config?.address) return [];

  const pk = config.privateKey as `0x${string}`;
  const headers = await getClobAuthHeaders(pk);

  const response = await fetch(
    `${CLOB_BASE}/orders?maker_address=${config.address}`,
    { headers }
  );

  if (!response.ok) return [];

  const data = await response.json();
  if (!Array.isArray(data)) return [];

  return (data as ClobOpenOrder[]).map((o) => ({
    orderId: o.id ?? o.orderId ?? "",
    tokenId: o.asset_id ?? "",
    side: (o.side?.toUpperCase() ?? "BUY") as "BUY" | "SELL",
    price: parseFloat(o.price ?? "0"),
    originalSize: parseFloat(o.original_size ?? "0"),
    sizeMatched: parseFloat(o.size_matched ?? "0"),
    sizeRemaining:
      parseFloat(o.original_size ?? "0") - parseFloat(o.size_matched ?? "0"),
    status: (o.status?.toUpperCase() ?? "LIVE") as OrderStatus,
    createdAt: o.created_at ? new Date(o.created_at).getTime() : Date.now(),
  }));
}

/**
 * Fetch trade history (filled orders) for the connected wallet
 */
export async function fetchTradeHistory(): Promise<PlacedOrder[]> {
  const config = loadWalletConfig();
  if (!config?.privateKey || !config?.address) return [];

  const pk = config.privateKey as `0x${string}`;
  const headers = await getClobAuthHeaders(pk);

  const response = await fetch(
    `${CLOB_BASE}/trades?maker_address=${config.address}&limit=50`,
    { headers }
  );

  if (!response.ok) return [];

  const data = await response.json();
  if (!Array.isArray(data)) return [];

  return (data as ClobOpenOrder[]).map((o) => ({
    orderId: o.id ?? o.orderId ?? "",
    tokenId: o.asset_id ?? "",
    side: (o.side?.toUpperCase() ?? "BUY") as "BUY" | "SELL",
    price: parseFloat(o.price ?? "0"),
    originalSize: parseFloat(o.original_size ?? "0"),
    sizeMatched: parseFloat(
      o.associate_trades?.[0]?.matched_amount ?? o.size_matched ?? "0"
    ),
    sizeRemaining: 0,
    status: "FILLED" as OrderStatus,
    createdAt: o.created_at ? new Date(o.created_at).getTime() : Date.now(),
  }));
}
