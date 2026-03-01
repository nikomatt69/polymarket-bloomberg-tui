/**
 * Polymarket WebSocket client for real-time market data
 * Uses the CLOB WebSocket API for market updates
 */

import { setConnectionStatus, wsConnectionStatus, addMarketUpdate } from "../state";

export type WsEventType =
  | "connect"
  | "disconnect"
  | "market_update"
  | "price_change"
  | "order_book"
  | "trade"
  | "error";

export interface WsMarketUpdate {
  type: "price_change" | "order_book" | "trade";
  tokenId: string;
  marketId?: string;
  price?: number;
  bid?: number;
  ask?: number;
  size?: number;
  side?: "BUY" | "SELL";
  timestamp: number;
}

export interface WsMessage {
  event: string;
  data?: unknown;
  channel?: string;
}

const WS_URL = "wss://clob.polymarket.com/ws";

const RECONNECT_DELAYS = [1000, 2000, 5000, 10000, 30000];
const MAX_RECONNECT_ATTEMPTS = 10;
const PING_INTERVAL = 30000;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private subscribedTokens: Set<string> = new Set();
  private isConnecting = false;
  private lastConnectedAt: number | null = null;
  private messageHandlers: Map<WsEventType, Set<(data: unknown) => void>> = new Map();

  constructor() {
    for (const type of [
      "connect",
      "disconnect",
      "market_update",
      "price_change",
      "order_book",
      "trade",
      "error",
    ] as WsEventType[]) {
      this.messageHandlers.set(type, new Set());
    }
  }

  on(event: WsEventType, handler: (data: unknown) => void): () => void {
    this.messageHandlers.get(event)!.add(handler);
    return () => this.messageHandlers.get(event)!.delete(handler);
  }

  private emit(event: WsEventType, data: unknown): void {
    this.messageHandlers.get(event)?.forEach((handler) => {
      try {
        handler(data);
      } catch (err) {
        console.error(`WebSocket handler error for ${event}:`, err);
      }
    });
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    setConnectionStatus("connecting");

    try {
      this.ws = new WebSocket(WS_URL);

      this.ws.onopen = () => {
        this.isConnecting = false;
        this.reconnectAttempt = 0;
        this.lastConnectedAt = Date.now();
        setConnectionStatus("connected");
        this.emit("connect", { timestamp: Date.now() });
        this.resubscribe();
        this.startPing();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onclose = (event) => {
        this.isConnecting = false;
        this.stopPing();

        if (!event.wasClean) {
          setConnectionStatus("disconnected");
          this.emit("disconnect", { code: event.code, reason: event.reason });
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        this.isConnecting = false;
        console.error("WebSocket error:", error);
        this.emit("error", { error });
      };
    } catch (error) {
      this.isConnecting = false;
      setConnectionStatus("error");
      this.emit("error", { error });
      this.scheduleReconnect();
    }
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data) as WsMessage;

      if (message.channel === "market" || message.channel === "prices") {
        const payload = message.data as Record<string, unknown>;
        const tokenId = (payload.asset_id as string) || (payload.token_id as string);

        if (tokenId) {
          const update: WsMarketUpdate = {
            type: "price_change",
            tokenId,
            marketId: payload.condition_id as string | undefined,
            price: payload.price ? parseFloat(String(payload.price)) : undefined,
            bid: payload.bid ? parseFloat(String(payload.bid)) : undefined,
            ask: payload.ask ? parseFloat(String(payload.ask)) : undefined,
            timestamp: Date.now(),
          };

          addMarketUpdate(update);
          this.emit("market_update", update);
          this.emit("price_change", update);
        }
      } else if (message.channel === "orderbook") {
        const payload = message.data as Record<string, unknown>;
        const tokenId = (payload.asset_id as string) || (payload.token_id as string);

        if (tokenId) {
          const update: WsMarketUpdate = {
            type: "order_book",
            tokenId,
            marketId: payload.condition_id as string | undefined,
            timestamp: Date.now(),
          };
          this.emit("market_update", update);
          this.emit("order_book", update);
        }
      } else if (message.channel === "trades" || message.event === "trade") {
        const payload = message.data as Record<string, unknown>;
        const tokenId = (payload.asset_id as string) || (payload.token_id as string);

        if (tokenId) {
          const update: WsMarketUpdate = {
            type: "trade",
            tokenId,
            marketId: payload.condition_id as string | undefined,
            price: payload.price ? parseFloat(String(payload.price)) : undefined,
            size: payload.size ? parseFloat(String(payload.size)) : undefined,
            side: payload.side as "BUY" | "SELL" | undefined,
            timestamp: Date.now(),
          };
          this.emit("market_update", update);
          this.emit("trade", update);
        }
      }
    } catch {
      // Ignore non-JSON messages
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempt >= MAX_RECONNECT_ATTEMPTS) {
      setConnectionStatus("error");
      return;
    }

    const delay = RECONNECT_DELAYS[Math.min(this.reconnectAttempt, RECONNECT_DELAYS.length - 1)];
    this.reconnectAttempt++;

    setConnectionStatus("reconnecting");

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private startPing(): void {
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ event: "ping" }));
      }
    }, PING_INTERVAL);
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  subscribe(tokenIds: string[]): void {
    tokenIds.forEach((id) => this.subscribedTokens.add(id));

    if (this.ws?.readyState === WebSocket.OPEN && tokenIds.length > 0) {
      const marketsMessage = {
        type: "subscribe",
        channel: "markets",
        token_ids: tokenIds,
      };
      this.ws.send(JSON.stringify(marketsMessage));

      const tradesMessage = {
        type: "subscribe",
        channel: "trades",
        token_ids: tokenIds,
      };
      this.ws.send(JSON.stringify(tradesMessage));
    }
  }

  unsubscribe(tokenIds: string[]): void {
    tokenIds.forEach((id) => this.subscribedTokens.delete(id));

    if (this.ws?.readyState === WebSocket.OPEN && tokenIds.length > 0) {
      const marketsMessage = {
        type: "unsubscribe",
        channel: "markets",
        token_ids: tokenIds,
      };
      this.ws.send(JSON.stringify(marketsMessage));
    }
  }

  private resubscribe(): void {
    if (this.subscribedTokens.size > 0) {
      this.subscribe(Array.from(this.subscribedTokens));
    }
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.stopPing();

    if (this.ws) {
      this.ws.close(1000, "Client disconnect");
      this.ws = null;
    }

    setConnectionStatus("disconnected");
    this.reconnectAttempt = MAX_RECONNECT_ATTEMPTS;
  }

  getStatus(): "connected" | "disconnected" | "connecting" | "reconnecting" | "error" {
    return wsConnectionStatus();
  }

  getLastConnectedAt(): number | null {
    return this.lastConnectedAt;
  }

  getSubscribedTokens(): string[] {
    return Array.from(this.subscribedTokens);
  }
}

let wsClientInstance: WebSocketClient | null = null;

export function getWebSocketClient(): WebSocketClient {
  if (!wsClientInstance) {
    wsClientInstance = new WebSocketClient();
  }
  return wsClientInstance;
}

export function initializeWebSocket(): void {
  const client = getWebSocketClient();
  client.connect();
}

export function disconnectWebSocket(): void {
  const client = getWebSocketClient();
  client.disconnect();
}
