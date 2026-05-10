/**
 * Enhanced WebSocket Order Book Hook
 * Provides real-time order book with delta updates and snapshot handling
 */

import { createSignal, createEffect, onCleanup, batch } from "solid-js";
import { createClobWebSocket, WsStatus, WsBookSnapshot, WsPriceChange, WsTrade, WsTickSizeChange } from "../api/ws";
import { getMarketDepth, MarketDepth } from "../api/clob/prices";
import { dedupRequest, CircuitBreaker } from "../api/clob/enhanced-book";

export interface OrderBookLevel {
  price: number;
  size: number;
  orders?: number; // For aggregated books
}

export interface OrderBookSnapshot {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  timestamp: number;
  hash?: string;
}

export interface OrderBookDelta {
  side: "BUY" | "SELL";
  price: number;
  size: number;
  timestamp: number;
}

export interface TradeInfo {
  price: number;
  size: number;
  side: "BUY" | "SELL";
  timestamp: number;
}

export interface OrderBookState {
  snapshot: OrderBookSnapshot;
  deltas: OrderBookDelta[];
  trades: TradeInfo[];
  status: WsStatus;
  lastUpdate: number;
  latency: number | null;
  reconnectCount: number;
}

export interface UseOrderBookOptions {
  tokenId: string;
  initialDepth?: number;
  maxDepth?: number;
  subscribeOnMount?: boolean;
  autoReconnect?: boolean;
  onTrade?: (trade: TradeInfo) => void;
  onTickSizeChange?: (oldSize: number, newSize: number) => void;
}

export interface UseOrderBookResult {
  state: () => OrderBookState;
  status: () => WsStatus;
  lastTrade: () => TradeInfo | null;
  isConnected: () => boolean;
  connect: () => void;
  disconnect: () => void;
  subscribe: (tokenIds: string[]) => void;
  unsubscribe: (tokenIds: string[]) => void;
  refresh: () => Promise<void>;
}

// Trade tape for recent trades
const TRADE_TAPE_SIZE = 50;
const PRICE_CHANGE_QUEUE_MAX = 100;

export function useOrderBook(options: UseOrderBookOptions): UseOrderBookResult {
  const {
    tokenId,
    initialDepth = 20,
    maxDepth = 20,
    subscribeOnMount = true,
    autoReconnect = true,
    onTrade,
    onTickSizeChange,
  } = options;

  const [state, setState] = createSignal<OrderBookState>({
    snapshot: { bids: [], asks: [], timestamp: 0 },
    deltas: [],
    trades: [],
    status: "disconnected",
    lastUpdate: 0,
    latency: null,
    reconnectCount: 0,
  });

  const [lastTrade, setLastTrade] = createSignal<TradeInfo | null>(null);
  const [ws, setWs] = createSignal<ReturnType<typeof createClobWebSocket> | null>(null);

  let subscribedTokenIds: string[] = [];

  const updateState = (updates: Partial<OrderBookState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  };

  const applyBookSnapshot = (snapshot: WsBookSnapshot) => {
    const bids: OrderBookLevel[] = snapshot.bids
      .filter((l) => l.size > 0)
      .sort((a, b) => b.price - a.price)
      .slice(0, maxDepth)
      .map((l) => ({ price: l.price, size: l.size }));

    const asks: OrderBookLevel[] = snapshot.asks
      .filter((l) => l.size > 0)
      .sort((a, b) => a.price - b.price)
      .slice(0, maxDepth)
      .map((l) => ({ price: l.price, size: l.size }));

    batch(() => {
      setState((prev) => ({
        ...prev,
        snapshot: { bids, asks, timestamp: Date.now(), hash: snapshot.timestamp },
        lastUpdate: Date.now(),
      }));
    });
  };

  const applyPriceChange = (delta: WsPriceChange) => {
    setState((prev) => {
      const key = delta.side === "BUY" ? "bids" : "asks";
      const levels = [...prev.snapshot[key]];
      
      const idx = levels.findIndex((l) => Math.abs(l.price - delta.price) < 1e-8);
      
      if (delta.size <= 0) {
        // Remove level
        if (idx >= 0) {
          levels.splice(idx, 1);
        }
      } else if (idx >= 0) {
        // Update existing level
        levels[idx] = { ...levels[idx], size: delta.size };
      } else {
        // Add new level
        levels.push({ price: delta.price, size: delta.size });
        levels.sort((a, b) => key === "bids" ? b.price - a.price : a.price - b.price);
      }

      const newDelta: OrderBookDelta = {
        side: delta.side,
        price: delta.price,
        size: delta.size,
        timestamp: Date.now(),
      };

      const newDeltas = [...prev.deltas, newDelta].slice(-PRICE_CHANGE_QUEUE_MAX);

      return {
        ...prev,
        snapshot: {
          ...prev.snapshot,
          [key]: levels.slice(0, maxDepth),
        },
        deltas: newDeltas,
        lastUpdate: Date.now(),
      };
    });
  };

  const applyTrade = (trade: WsTrade) => {
    const tradeInfo: TradeInfo = {
      price: trade.price,
      size: trade.size,
      side: trade.side,
      timestamp: Date.now(),
    };

    batch(() => {
      setLastTrade(tradeInfo);
      setState((prev) => ({
        ...prev,
        trades: [...prev.trades, tradeInfo].slice(-TRADE_TAPE_SIZE),
        lastUpdate: Date.now(),
      }));
    });

    onTrade?.(tradeInfo);
  };

  const connect = () => {
    const websocket = createClobWebSocket();

    websocket.onStatus((status) => {
      setState((prev) => ({
        ...prev,
        status,
        reconnectCount: status === "connected" ? 0 : prev.reconnectCount,
      }));
    });

    websocket.onMessage((msg) => {
      if (msg.type === "book") {
        applyBookSnapshot(msg as WsBookSnapshot);
      } else if (msg.type === "price_change") {
        applyPriceChange(msg as WsPriceChange);
      } else if (msg.type === "last_trade_price") {
        applyTrade(msg as WsTrade);
      } else if (msg.type === "tick_size_change") {
        const tickMsg = msg as WsTickSizeChange;
        onTickSizeChange?.(tickMsg.oldSize, tickMsg.newSize);
      }
    });

    setWs(websocket);
    websocket.connect();

    if (tokenId && subscribeOnMount) {
      websocket.subscribe([tokenId]);
      subscribedTokenIds = [tokenId];
    }
  };

  const disconnect = () => {
    const w = ws();
    if (w) {
      w.destroy();
      setWs(null);
    }
    subscribedTokenIds = [];
  };

  const subscribe = (tokenIds: string[]) => {
    const w = ws();
    if (w) {
      w.subscribe(tokenIds);
      subscribedTokenIds = [...new Set([...subscribedTokenIds, ...tokenIds])];
    }
  };

  const unsubscribe = (tokenIds: string[]) => {
    const w = ws();
    if (w) {
      w.unsubscribe(tokenIds);
      subscribedTokenIds = subscribedTokenIds.filter((id) => !tokenIds.includes(id));
    }
  };

  const refresh = async () => {
    if (!tokenId) return;

    try {
      const depth = await dedupRequest(
        `depth:${tokenId}`,
        () => getMarketDepth(tokenId, initialDepth)
      );

      if (depth) {
        setState((prev) => ({
          ...prev,
          snapshot: {
            bids: depth.bids.map((l) => ({ price: l.price, size: l.size })),
            asks: depth.asks.map((l) => ({ price: l.price, size: l.size })),
            timestamp: Date.now(),
          },
          lastUpdate: Date.now(),
        }));
      }
    } catch (error) {
      console.error("Failed to refresh order book:", error);
    }
  };

  // Auto-connect on mount
  createEffect(() => {
    if (subscribeOnMount && tokenId) {
      connect();
    }

    onCleanup(() => {
      disconnect();
    });
  });

  return {
    state,
    status: () => state().status,
    lastTrade,
    isConnected: () => state().status === "connected",
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    refresh,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Order Book Analytics
// ─────────────────────────────────────────────────────────────────────────────

export interface OrderBookAnalytics {
  spread: number | null;
  spreadBps: number | null;
  midPrice: number | null;
  totalBidDepth: number;
  totalAskDepth: number;
  bidAskRatio: number;
  imbalance: number;
  imbalanceDirection: "bid" | "ask" | "balanced";
  vwap: number | null;
  maxBidLevel: number;
  maxAskLevel: number;
  bidDepthAtMid: number;
  askDepthAtMid: number;
}

export function computeOrderBookAnalytics(book: OrderBookSnapshot): OrderBookAnalytics {
  const bids = book.bids;
  const asks = book.asks;

  const bestBid = bids[0]?.price ?? 0;
  const bestAsk = asks[0]?.price ?? 0;

  // Spread metrics
  const spread = bestBid > 0 && bestAsk > 0 ? bestAsk - bestBid : null;
  const midPrice = bestBid > 0 && bestAsk > 0 ? (bestBid + bestAsk) / 2 : null;
  const spreadBps = spread !== null && midPrice !== null && midPrice > 0
    ? (spread / midPrice) * 10000
    : null;

  // Depth metrics
  const totalBidDepth = bids.reduce((sum, b) => sum + b.size, 0);
  const totalAskDepth = asks.reduce((sum, a) => sum + a.size, 0);
  const bidAskRatio = totalAskDepth > 0 ? totalBidDepth / totalAskDepth : 1;

  // Imbalance (0-1, 0.5 = balanced)
  const totalDepth = totalBidDepth + totalAskDepth;
  const imbalance = totalDepth > 0 ? totalBidDepth / totalDepth : 0.5;
  const imbalanceDirection = imbalance > 0.6 ? "bid" : imbalance < 0.4 ? "ask" : "balanced";

  // VWAP
  const levels = [...bids, ...asks];
  const sumPV = levels.reduce((sum, l) => sum + l.price * l.size, 0);
  const sumV = levels.reduce((sum, l) => sum + l.size, 0);
  const vwap = sumV > 0 ? sumPV / sumV : null;

  // Max levels
  const maxBidLevel = bids.length;
  const maxAskLevel = asks.length;

  // Depth at mid price
  const bidDepthAtMid = bids.filter((b) => b.price >= (midPrice ?? 0)).reduce((sum, b) => sum + b.size, 0);
  const askDepthAtMid = asks.filter((a) => a.price <= (midPrice ?? 0)).reduce((sum, a) => sum + a.size, 0);

  return {
    spread,
    spreadBps,
    midPrice,
    totalBidDepth,
    totalAskDepth,
    bidAskRatio,
    imbalance,
    imbalanceDirection,
    vwap,
    maxBidLevel,
    maxAskLevel,
    bidDepthAtMid,
    askDepthAtMid,
  };
}

// Format analytics for display
export function formatOrderBookAnalytics(a: OrderBookAnalytics): string {
  const parts: string[] = [];

  if (a.midPrice !== null) {
    parts.push(`Mid: ${(a.midPrice * 100).toFixed(2)}¢`);
  }
  if (a.spread !== null) {
    parts.push(`Spr: ${(a.spread * 100).toFixed(2)}¢`);
  }
  if (a.spreadBps !== null) {
    parts.push(`(${a.spreadBps.toFixed(1)}bps)`);
  }

  parts.push(`Bid: ${a.totalBidDepth.toFixed(0)}`);
  parts.push(`Ask: ${a.totalAskDepth.toFixed(0)}`);

  const imbLabel = a.imbalanceDirection === "bid" ? "BID" : a.imbalanceDirection === "ask" ? "ASK" : "BAL";
  parts.push(`Imb: ${imbLabel}`);

  if (a.vwap !== null) {
    parts.push(`VWAP: ${(a.vwap * 100).toFixed(2)}¢`);
  }

  return parts.join(" | ");
}