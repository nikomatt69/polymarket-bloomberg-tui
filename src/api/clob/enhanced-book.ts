/**
 * Enhanced order book manager with analytics and caching.
 * Provides real-time order book state with derived metrics.
 */

import { createSignal } from "solid-js";
import { createClobWebSocket, WsStatus, WsBookSnapshot, WsPriceChange, WsTrade } from "../ws";
import { getMarketDepth, OrderBookSummary, MarketDepth } from "./prices";

export interface BookLevel {
  price: number;
  size: number;
}

export interface OrderBookState {
  bids: BookLevel[];
  asks: BookLevel[];
  lastUpdateTs: number | null;
  hash: string | null;
}

export interface OrderBookAnalytics {
  // Spread metrics
  spread: number | null;
  spreadBps: number | null;
  spreadPercent: number | null;
  
  // Depth metrics
  totalBidDepth: number;
  totalAskDepth: number;
  maxBidSize: number;
  maxAskSize: number;
  imbalance: number; // 0-1, 0.5 = balanced
  
  // VWAP
  vwap: number | null;
  
  // Mid-market
  midPrice: number | null;
  
  // Imbalance direction
  imbalanceDirection: "bid" | "ask" | "balanced";
  
  // Time-weighted spread (if tracking)
  avgSpread: number | null;
}

// Track spread history for averaging
const spreadHistory = new Map<string, { spreads: number[]; lastUpdate: number }>();

function computeAnalytics(book: OrderBookState, maxLevels: number = 20): OrderBookAnalytics {
  const bids = book.bids.slice(0, maxLevels);
  const asks = book.asks.slice(0, maxLevels);
  
  const bestBid = bids[0]?.price ?? 0;
  const bestAsk = asks[0]?.price ?? 0;
  
  // Spread metrics
  const spread = bestAsk > 0 && bestBid > 0 ? bestAsk - bestBid : null;
  const midPrice = bestBid > 0 && bestAsk > 0 ? (bestBid + bestAsk) / 2 : null;
  const spreadBps = spread !== null && midPrice !== null && midPrice > 0 
    ? (spread / midPrice) * 10000 
    : null;
  const spreadPercent = spread !== null && midPrice !== null && midPrice > 0
    ? (spread / midPrice) * 100
    : null;
  
  // Depth metrics
  const totalBidDepth = bids.reduce((s, b) => s + b.size, 0);
  const totalAskDepth = asks.reduce((s, a) => s + a.size, 0);
  const maxBidSize = bids.reduce((m, b) => Math.max(m, b.size), 0);
  const maxAskSize = asks.reduce((m, a) => Math.max(m, a.size), 0);
  
  // Imbalance (0-1, 0.5 = balanced)
  const totalDepth = totalBidDepth + totalAskDepth;
  const imbalance = totalDepth > 0 ? totalBidDepth / totalDepth : 0.5;
  const imbalanceDirection = imbalance > 0.6 ? "bid" : imbalance < 0.4 ? "ask" : "balanced";
  
  // VWAP from all levels
  const levels = [...bids, ...asks];
  const sumPV = levels.reduce((s, l) => s + l.price * l.size, 0);
  const sumV = levels.reduce((s, l) => s + l.size, 0);
  const vwap = sumV > 0 ? sumPV / sumV : null;
  
  return {
    spread,
    spreadBps,
    spreadPercent,
    totalBidDepth,
    totalAskDepth,
    maxBidSize,
    maxAskSize,
    imbalance,
    vwap,
    midPrice,
    imbalanceDirection,
    avgSpread: null, // Computed externally
  };
}

// Request deduplication
const pendingRequests = new Map<string, Promise<unknown>>();
const requestCache = new Map<string, { data: unknown; expires: number }>();
const CACHE_TTL_MS = 5_000; // 5 second cache
const REQUEST_DEDUP_WINDOW_MS = 2_000; // 2 second dedup window

export async function dedupRequest<T>(
  key: string,
  factory: () => Promise<T>
): Promise<T> {
  // Check cache first
  const cached = requestCache.get(key);
  if (cached && Date.now() < cached.expires) {
    return cached.data as T;
  }
  
  // Check pending requests
  const pending = pendingRequests.get(key);
  if (pending) {
    return pending as Promise<T>;
  }
  
  // Execute request
  const promise = factory() as Promise<T>;
  pendingRequests.set(key, promise);
  
  try {
    const result = await promise;
    requestCache.set(key, { data: result, expires: Date.now() + CACHE_TTL_MS });
    return result;
  } finally {
    pendingRequests.delete(key);
  }
}

export function clearRequestCache(): void {
  requestCache.clear();
}

// Order book manager class
export class OrderBookManager {
  private ws: ReturnType<typeof createClobWebSocket> | null = null;
  private currentTokenId: string | null = null;
  private onUpdateCallbacks = new Set<(book: OrderBookState, analytics: OrderBookAnalytics) => void>();
  private onStatusCallbacks = new Set<(status: WsStatus) => void>();
  private onTradeCallbacks = new Set<(trade: WsTrade) => void>();
  private cancelFlag = false;
  
  private store: OrderBookState = {
    bids: [],
    asks: [],
    lastUpdateTs: null,
    hash: null,
  };
  
  private analytics: OrderBookAnalytics = {
    spread: null,
    spreadBps: null,
    spreadPercent: null,
    totalBidDepth: 0,
    totalAskDepth: 0,
    maxBidSize: 0,
    maxAskSize: 0,
    imbalance: 0.5,
    vwap: null,
    midPrice: null,
    imbalanceDirection: "balanced",
    avgSpread: null,
  };
  
  constructor() {}
  
  subscribe(tokenId: string): void {
    if (tokenId === this.currentTokenId && this.ws) return;
    
    this.cancelFlag = true;
    this.ws?.destroy();
    this.ws = null;
    this.currentTokenId = tokenId;
    this.cancelFlag = false;
    
    // Create new WebSocket
    this.ws = createClobWebSocket();
    
    // Fetch initial snapshot
    void this.fetchInitialSnapshot(tokenId);
    
    // Set up handlers
    this.ws.onStatus((status) => {
      this.onStatusCallbacks.forEach((cb) => cb(status));
    });
    
    this.ws.onMessage((msg) => {
      if (this.cancelFlag) return;
      
      if (msg.type === "book") {
        const snap = msg as WsBookSnapshot;
        this.store = {
          bids: snap.bids.filter((l) => l.size > 0).sort((a, b) => b.price - a.price),
          asks: snap.asks.filter((l) => l.size > 0).sort((a, b) => a.price - b.price),
          lastUpdateTs: Date.now(),
          hash: snap.timestamp,
        };
        this.analytics = computeAnalytics(this.store);
        this.notifyUpdate();
      } else if (msg.type === "price_change") {
        const delta = msg as WsPriceChange;
        this.applyPriceChange(delta);
      } else if (msg.type === "last_trade_price") {
        const trade = msg as WsTrade;
        this.onTradeCallbacks.forEach((cb) => cb(trade));
      }
    });
    
    this.ws.connect();
    this.ws.subscribe([tokenId]);
  }
  
  private async fetchInitialSnapshot(tokenId: string): Promise<void> {
    try {
      const depth = await dedupRequest(
        `depth:${tokenId}`,
        () => getMarketDepth(tokenId, 20)
      );
      
      if (this.cancelFlag || !depth) return;
      
      this.store = {
        bids: depth.bids.map((l) => ({ price: l.price, size: l.size })),
        asks: depth.asks.map((l) => ({ price: l.price, size: l.size })),
        lastUpdateTs: Date.now(),
        hash: null,
      };
      this.analytics = computeAnalytics(this.store);
      this.notifyUpdate();
    } catch (error) {
      console.error("Failed to fetch initial depth:", error);
    }
  }
  
  private applyPriceChange(delta: WsPriceChange): void {
    const key = delta.side === "BUY" ? "bids" : "asks";
    const levels = this.store[key];
    
    const idx = levels.findIndex((l) => Math.abs(l.price - delta.price) < 1e-8);
    
    if (delta.size <= 0) {
      if (idx >= 0) {
        levels.splice(idx, 1);
      }
    } else if (idx >= 0) {
      levels[idx].size = delta.size;
    } else {
      levels.push({ price: delta.price, size: delta.size });
      levels.sort((a, b) => key === "bids" ? b.price - a.price : a.price - b.price);
    }
    
    this.store = {
      ...this.store,
      [key]: [...levels],
      lastUpdateTs: Date.now(),
    };
    this.analytics = computeAnalytics(this.store);
    this.notifyUpdate();
  }
  
  private notifyUpdate(): void {
    this.onUpdateCallbacks.forEach((cb) => cb(this.store, this.analytics));
  }
  
  getSnapshot(): { store: OrderBookState; analytics: OrderBookAnalytics } {
    return { store: this.store, analytics: this.analytics };
  }
  
  onUpdate(cb: (book: OrderBookState, analytics: OrderBookAnalytics) => void): () => void {
    this.onUpdateCallbacks.add(cb);
    return () => this.onUpdateCallbacks.delete(cb);
  }
  
  onStatus(cb: (status: WsStatus) => void): () => void {
    this.onStatusCallbacks.add(cb);
    return () => this.onStatusCallbacks.delete(cb);
  }
  
  onTrade(cb: (trade: WsTrade) => void): () => void {
    this.onTradeCallbacks.add(cb);
    return () => this.onTradeCallbacks.delete(cb);
  }
  
  destroy(): void {
    this.cancelFlag = true;
    this.ws?.destroy();
    this.ws = null;
    this.currentTokenId = null;
    this.onUpdateCallbacks.clear();
    this.onStatusCallbacks.clear();
    this.onTradeCallbacks.clear();
  }
}

// Circuit breaker for API failures
export class CircuitBreaker {
  private failures = 0;
  private lastFailure = 0;
  private state: "closed" | "open" | "half-open" = "closed";
  private readonly threshold: number;
  private readonly resetTimeout: number;
  
  constructor(threshold = 5, resetTimeoutMs = 30_000) {
    this.threshold = threshold;
    this.resetTimeout = resetTimeoutMs;
  }
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      if (Date.now() - this.lastFailure > this.resetTimeout) {
        this.state = "half-open";
      } else {
        throw new Error("Circuit breaker is open");
      }
    }
    
    try {
      const result = await fn();
      if (this.state === "half-open") {
        this.state = "closed";
        this.failures = 0;
      }
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailure = Date.now();
      
      if (this.failures >= this.threshold) {
        this.state = "open";
      }
      throw error;
    }
  }
  
  getState(): "closed" | "open" | "half-open" {
    return this.state;
  }
  
  reset(): void {
    this.state = "closed";
    this.failures = 0;
  }
}

// Global circuit breaker instance
export const clobCircuitBreaker = new CircuitBreaker(5, 30_000);

// Batch request manager for efficient API calls
export class BatchRequestManager {
  private pending = new Map<string, Set<{
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }>>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly batchDelay: number;
  
  constructor(batchDelayMs = 100) {
    this.batchDelay = batchDelayMs;
  }
  
  async request<T>(key: string, factory: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.pending.has(key)) {
        this.pending.set(key, new Set());
      }
      
      const callbacks = this.pending.get(key)!;
      callbacks.add({ resolve: resolve as (value: unknown) => void, reject });
      
      // Clear existing timer
      const existingTimer = this.timers.get(key);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }
      
      // Set new timer
      this.timers.set(
        key,
        setTimeout(async () => {
          this.timers.delete(key);
          const cbs = this.pending.get(key);
          this.pending.delete(key);
          
          if (!cbs || cbs.size === 0) return;
          
          try {
            const result = await factory();
            cbs.forEach(({ resolve }) => resolve(result));
          } catch (error) {
            cbs.forEach(({ reject }) => reject(error as Error));
          }
        }, this.batchDelay)
      );
    });
  }
  
  clear(): void {
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();
    this.pending.clear();
  }
}

export const batchManager = new BatchRequestManager(100);