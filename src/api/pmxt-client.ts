/**
 * pmxtjs public client — used only for market data (orderbook, candles, etc.)
 * No private key is passed; signing stays in trading.ts via viem.
 */

import { Polymarket } from "pmxtjs";
import type { OrderBook } from "pmxtjs";
import type { OrderBookSummary } from "./polymarket";

let _client: Polymarket | null = null;

export function getPolymarketPublicClient(): Polymarket {
  if (!_client) {
    _client = new Polymarket();
  }
  return _client;
}

export async function closePolymarketClient(): Promise<void> {
  if (_client) {
    await _client.close();
    _client = null;
  }
}

/**
 * Fetch order book via pmxtjs and map to the internal OrderBookSummary format.
 */
export async function fetchOrderBookViaPmxt(
  marketId: string,
  tokenId: string,
): Promise<OrderBookSummary | null> {
  try {
    const client = getPolymarketPublicClient();
    const book: OrderBook = await client.fetchOrderBook(tokenId);

    const bids = book.bids ?? [];
    const asks = book.asks ?? [];

    const bestBid = bids.length > 0 ? bids[0].price : null;
    const bestAsk = asks.length > 0 ? asks[0].price : null;
    const midpoint = bestBid !== null && bestAsk !== null ? (bestBid + bestAsk) / 2 : null;
    const spread = bestBid !== null && bestAsk !== null ? bestAsk - bestBid : null;
    const spreadBps = spread !== null && midpoint !== null && midpoint > 0
      ? (spread / midpoint) * 10000
      : null;

    const bidDepth = bids.reduce((sum, lvl) => sum + lvl.size, 0);
    const askDepth = asks.reduce((sum, lvl) => sum + lvl.size, 0);

    return {
      marketId,
      tokenId,
      bestBid,
      bestAsk,
      midpoint,
      spread,
      spreadBps,
      bidDepth,
      askDepth,
      minOrderSize: null,
      tickSize: null,
      updatedAt: book.timestamp ?? Date.now(),
      negRisk: false,
    };
  } catch (err) {
    console.warn("pmxtjs fetchOrderBook failed:", err);
    return null;
  }
}
