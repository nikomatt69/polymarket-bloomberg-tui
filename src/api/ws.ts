/**
 * WebSocket manager for CLOB real-time streaming
 * Connects to wss://ws-subscriptions-clob.polymarket.com/ws/
 * Provides auto-reconnecting WebSocket with exponential backoff
 */

export type WsStatus = "connecting" | "connected" | "disconnected";

export interface BookLevel {
  price: number;
  size: number;
}

export interface WsBookSnapshot {
  type: "book";
  assetId: string;
  bids: BookLevel[];
  asks: BookLevel[];
  timestamp: string;
}

export interface WsPriceChange {
  type: "price_change";
  assetId: string;
  side: "BUY" | "SELL";
  price: number;
  size: number;
  timestamp: string;
}

export interface WsTrade {
  type: "last_trade_price";
  assetId: string;
  price: number;
  size: number;
  side: "BUY" | "SELL";
  timestamp: string;
}

export interface WsTickSizeChange {
  type: "tick_size_change";
  assetId: string;
  newSize: number;
  oldSize: number;
  timestamp: string;
}

export interface WsBestBidAsk {
  type: "best_bid_ask";
  assetId: string;
  bid: number;
  ask: number;
  timestamp: string;
}

export interface WsNewMarket {
  type: "new_market";
  conditionId: string;
  timestamp: string;
}

export interface WsMarketResolved {
  type: "market_resolved";
  conditionId: string;
  resolution: string;
  timestamp: string;
}

// User channel message types
export interface WsUserTrade {
  type: "trade";
  tradeId: string;
  orderId: string;
  assetId: string;
  side: "BUY" | "SELL";
  price: number;
  size: number;
  status: "MATCHED" | "MINED" | "CONFIRMED" | "RETRYING" | "FAILED";
  timestamp: string;
  maker: boolean;
}

export interface WsUserOrder {
  type: "order";
  orderId: string;
  assetId: string;
  side: "BUY" | "SELL";
  price: number;
  originalSize: number;
  sizeMatched: number;
  status: "live" | "matched" | "delayed" | "unmatched" | "cancelled";
  timestamp: string;
}

export type WsMessage = WsBookSnapshot | WsPriceChange | WsTrade | WsTickSizeChange | WsBestBidAsk | WsNewMarket | WsMarketResolved;
export type WsUserMessage = WsUserTrade | WsUserOrder;

type MessageHandler = (msg: WsMessage) => void;
type UserMessageHandler = (msg: WsUserMessage) => void;
type StatusHandler = (status: WsStatus) => void;

const CLOB_WS_URL = "wss://ws-subscriptions-clob.polymarket.com/ws/market";
const MAX_RECONNECT_DELAY_MS = 30_000;
const HEARTBEAT_INTERVAL_MS = 20_000;

/**
 * Creates an auto-reconnecting WebSocket manager for CLOB market data.
 * Subscribes to real-time book snapshots, price changes, and last trade prices.
 */
export function createClobWebSocket() {
  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let reconnectCount = 0;
  let destroyed = false;
  let currentAssetIds: string[] = [];

  const messageHandlers = new Set<MessageHandler>();
  const statusHandlers = new Set<StatusHandler>();

  function emitStatus(status: WsStatus) {
    statusHandlers.forEach((fn) => fn(status));
  }

  function parseLevel(raw: { price: string | number; size: string | number }): BookLevel {
    return {
      price: typeof raw.price === "string" ? parseFloat(raw.price) : raw.price,
      size: typeof raw.size === "string" ? parseFloat(raw.size) : raw.size,
    };
  }

  function parseNumber(raw: unknown): number {
    if (typeof raw === "number") return raw;
    if (typeof raw === "string") return Number.parseFloat(raw);
    return Number.NaN;
  }

  function stopHeartbeat() {
    if (heartbeatTimer !== null) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  function startHeartbeat() {
    stopHeartbeat();
    heartbeatTimer = setInterval(() => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send("PING");
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  function handleRawMessage(raw: unknown) {
    const entries = Array.isArray(raw)
      ? raw
      : raw && typeof raw === "object"
        ? [raw]
        : [];

    for (const item of entries) {
      if (!item || typeof item !== "object") continue;

      const eventType = (item as Record<string, unknown>).event_type as string | undefined;

      if (eventType === "book") {
        const bids = Array.isArray((item as Record<string, unknown>).bids)
          ? ((item as Record<string, unknown>).bids as Array<{ price: string | number; size: string | number }>).map(parseLevel)
          : [];
        const asks = Array.isArray((item as Record<string, unknown>).asks)
          ? ((item as Record<string, unknown>).asks as Array<{ price: string | number; size: string | number }>).map(parseLevel)
          : [];

        const msg: WsBookSnapshot = {
          type: "book",
          assetId: String((item as Record<string, unknown>).asset_id ?? ""),
          bids,
          asks,
          timestamp: String((item as Record<string, unknown>).timestamp ?? ""),
        };
        messageHandlers.forEach((fn) => fn(msg));
      } else if (eventType === "price_change") {
        const priceChanges = Array.isArray((item as Record<string, unknown>).price_changes)
          ? ((item as Record<string, unknown>).price_changes as Array<Record<string, unknown>>)
          : Array.isArray((item as Record<string, unknown>).changes)
            ? ((item as Record<string, unknown>).changes as Array<Record<string, unknown>>)
            : [];

        for (const change of priceChanges) {
          const side = (change.side as string) === "BUY" ? "BUY" : "SELL";
          const assetId = String(change.asset_id ?? (item as Record<string, unknown>).asset_id ?? "");
          const price = parseNumber(change.price);
          const size = parseNumber(change.size);
          if (!assetId || !Number.isFinite(price) || !Number.isFinite(size)) continue;

          const msg: WsPriceChange = {
            type: "price_change",
            assetId,
            side,
            price,
            size,
            timestamp: String((item as Record<string, unknown>).timestamp ?? ""),
          };
          messageHandlers.forEach((fn) => fn(msg));
        }
      } else if (eventType === "last_trade_price") {
        const side = (item as Record<string, unknown>).side === "BUY" ? "BUY" : "SELL";
        const price = (item as Record<string, unknown>).price;
        const size = (item as Record<string, unknown>).size;

        const msg: WsTrade = {
          type: "last_trade_price",
          assetId: String((item as Record<string, unknown>).asset_id ?? ""),
          price: typeof price === "string" ? parseFloat(price) : Number(price),
          size: typeof size === "string" ? parseFloat(size) : Number(size),
          side,
          timestamp: String((item as Record<string, unknown>).timestamp ?? ""),
        };
        messageHandlers.forEach((fn) => fn(msg));
      } else if (eventType === "tick_size_change") {
        const msg: WsTickSizeChange = {
          type: "tick_size_change",
          assetId: String((item as Record<string, unknown>).asset_id ?? ""),
          newSize: parseNumber((item as Record<string, unknown>).new_size),
          oldSize: parseNumber((item as Record<string, unknown>).old_size),
          timestamp: String((item as Record<string, unknown>).timestamp ?? ""),
        };
        messageHandlers.forEach((fn) => fn(msg));
      } else if (eventType === "best_bid_ask") {
        const msg: WsBestBidAsk = {
          type: "best_bid_ask",
          assetId: String((item as Record<string, unknown>).asset_id ?? ""),
          bid: parseNumber((item as Record<string, unknown>).bid),
          ask: parseNumber((item as Record<string, unknown>).ask),
          timestamp: String((item as Record<string, unknown>).timestamp ?? ""),
        };
        messageHandlers.forEach((fn) => fn(msg));
      } else if (eventType === "new_market") {
        const msg: WsNewMarket = {
          type: "new_market",
          conditionId: String((item as Record<string, unknown>).condition_id ?? ""),
          timestamp: String((item as Record<string, unknown>).timestamp ?? ""),
        };
        messageHandlers.forEach((fn) => fn(msg));
      } else if (eventType === "market_resolved") {
        const msg: WsMarketResolved = {
          type: "market_resolved",
          conditionId: String((item as Record<string, unknown>).condition_id ?? ""),
          resolution: String((item as Record<string, unknown>).resolution ?? ""),
          timestamp: String((item as Record<string, unknown>).timestamp ?? ""),
        };
        messageHandlers.forEach((fn) => fn(msg));
      }
    }
  }

  function sendInitialSubscribe(assetIds: string[]) {
    if (ws?.readyState === WebSocket.OPEN && assetIds.length > 0) {
      ws.send(
        JSON.stringify({
          type: "market",
          assets_ids: assetIds,
          custom_feature_enabled: true,
        })
      );
    }
  }

  function sendDynamicSubscribe(assetIds: string[]) {
    if (ws?.readyState === WebSocket.OPEN && assetIds.length > 0) {
      ws.send(
        JSON.stringify({
          operation: "subscribe",
          assets_ids: assetIds,
          custom_feature_enabled: true,
        })
      );
    }
  }

  function connect() {
    if (destroyed) return;

    emitStatus("connecting");
    ws = new WebSocket(CLOB_WS_URL);

    ws.onopen = () => {
      reconnectCount = 0;
      emitStatus("connected");
      startHeartbeat();
      if (currentAssetIds.length > 0) {
        sendInitialSubscribe(currentAssetIds);
      }
    };

    ws.onmessage = (event) => {
      const rawPayload = typeof event.data === "string" ? event.data : String(event.data ?? "");
      const normalized = rawPayload.trim().toUpperCase();

      if (normalized === "PONG") {
        return;
      }

      try {
        const data = JSON.parse(rawPayload);
        handleRawMessage(data);
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onerror = () => {
      // onclose will handle reconnection
    };

    ws.onclose = () => {
      stopHeartbeat();
      if (destroyed) return;
      emitStatus("disconnected");
      const delay = Math.min(1_000 * Math.pow(2, reconnectCount), MAX_RECONNECT_DELAY_MS);
      reconnectCount += 1;
      reconnectTimer = setTimeout(() => connect(), delay);
    };
  }

  return {
    /** Connect to the WebSocket and start streaming. */
    connect() {
      connect();
    },

    /** Subscribe to additional market asset IDs for real-time updates (accumulates). */
    subscribe(assetIds: string[]) {
      const incoming = assetIds.filter(Boolean);
      const merged = Array.from(new Set([...currentAssetIds, ...incoming]));
      const newIds = merged.filter((id) => !currentAssetIds.includes(id));
      currentAssetIds = merged;
      // Only send the delta — avoid re-subscribing already-subscribed tokens
      if (newIds.length > 0) sendDynamicSubscribe(newIds);
    },

    /** Replace the full subscription set (use when switching market context). */
    setSubscription(assetIds: string[]) {
      currentAssetIds = Array.from(new Set(assetIds.filter(Boolean)));
      if (ws?.readyState === WebSocket.OPEN && currentAssetIds.length > 0) {
        sendInitialSubscribe(currentAssetIds);
      }
    },

    /** Register a handler for incoming messages. Returns an unsubscribe function. */
    onMessage(handler: MessageHandler): () => void {
      messageHandlers.add(handler);
      return () => messageHandlers.delete(handler);
    },

    /** Register a handler for connection status changes. Returns an unsubscribe function. */
    onStatus(handler: StatusHandler): () => void {
      statusHandlers.add(handler);
      return () => statusHandlers.delete(handler);
    },

    /** Close the WebSocket and stop reconnection attempts. */
    destroy() {
      destroyed = true;
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      stopHeartbeat();
      ws?.close();
      ws = null;
      messageHandlers.clear();
      statusHandlers.clear();
    },
  };
}

export interface UserWsCredentials {
  apiKey: string;
  secret: string;
  passphrase: string;
}

/**
 * Creates an auto-reconnecting WebSocket for authenticated user order/trade events.
 * Connects to wss://ws-subscriptions-clob.polymarket.com/ws/user
 */
export function createUserWebSocket(creds: UserWsCredentials, conditionIds: string[]) {
  const USER_WS_URL = "wss://ws-subscriptions-clob.polymarket.com/ws/user";

  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let reconnectCount = 0;
  let destroyed = false;
  let currentConditionIds: string[] = [...conditionIds];

  const messageHandlers = new Set<UserMessageHandler>();
  const statusHandlers = new Set<StatusHandler>();

  function emitStatus(status: WsStatus) {
    statusHandlers.forEach((fn) => fn(status));
  }

  function parseNumber(raw: unknown): number {
    if (typeof raw === "number") return raw;
    if (typeof raw === "string") return Number.parseFloat(raw);
    return Number.NaN;
  }

  function stopHeartbeat() {
    if (heartbeatTimer !== null) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  function startHeartbeat() {
    stopHeartbeat();
    heartbeatTimer = setInterval(() => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send("PING");
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  function sendSubscribe() {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          auth: {
            apiKey: creds.apiKey,
            secret: creds.secret,
            passphrase: creds.passphrase,
          },
          markets: currentConditionIds,
          type: "user",
        })
      );
    }
  }

  function handleRawMessage(raw: unknown) {
    const entries = Array.isArray(raw) ? raw : raw && typeof raw === "object" ? [raw] : [];

    for (const item of entries) {
      if (!item || typeof item !== "object") continue;
      const r = item as Record<string, unknown>;
      const eventType = r.event_type as string | undefined;

      if (eventType === "trade") {
        const msg: WsUserTrade = {
          type: "trade",
          tradeId: String(r.trade_id ?? r.id ?? ""),
          orderId: String(r.order_id ?? r.taker_order_id ?? ""),
          assetId: String(r.asset_id ?? ""),
          side: r.side === "SELL" ? "SELL" : "BUY",
          price: parseNumber(r.price),
          size: parseNumber(r.size),
          status: (r.status as WsUserTrade["status"]) ?? "MATCHED",
          timestamp: String(r.timestamp ?? ""),
          maker: r.maker === true,
        };
        messageHandlers.forEach((fn) => fn(msg));
      } else if (eventType === "order") {
        const msg: WsUserOrder = {
          type: "order",
          orderId: String(r.order_id ?? r.id ?? ""),
          assetId: String(r.asset_id ?? ""),
          side: r.side === "SELL" ? "SELL" : "BUY",
          price: parseNumber(r.price),
          originalSize: parseNumber(r.original_size),
          sizeMatched: parseNumber(r.size_matched ?? 0),
          status: (r.status as WsUserOrder["status"]) ?? "live",
          timestamp: String(r.timestamp ?? ""),
        };
        messageHandlers.forEach((fn) => fn(msg));
      }
    }
  }

  function connect() {
    if (destroyed) return;
    emitStatus("connecting");
    ws = new WebSocket(USER_WS_URL);

    ws.onopen = () => {
      reconnectCount = 0;
      emitStatus("connected");
      startHeartbeat();
      sendSubscribe();
    };

    ws.onmessage = (event) => {
      const rawPayload = typeof event.data === "string" ? event.data : String(event.data ?? "");
      const normalized = rawPayload.trim().toUpperCase();
      if (normalized === "PONG") return;
      try {
        const data = JSON.parse(rawPayload);
        handleRawMessage(data);
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onerror = () => { };

    ws.onclose = () => {
      stopHeartbeat();
      if (destroyed) return;
      emitStatus("disconnected");
      const delay = Math.min(1_000 * Math.pow(2, reconnectCount), MAX_RECONNECT_DELAY_MS);
      reconnectCount += 1;
      reconnectTimer = setTimeout(() => connect(), delay);
    };
  }

  return {
    connect() { connect(); },
    updateConditionIds(ids: string[]) {
      currentConditionIds = Array.from(new Set(ids.filter(Boolean)));
      sendSubscribe();
    },
    onMessage(handler: UserMessageHandler): () => void {
      messageHandlers.add(handler);
      return () => messageHandlers.delete(handler);
    },
    onStatus(handler: StatusHandler): () => void {
      statusHandlers.add(handler);
      return () => statusHandlers.delete(handler);
    },
    destroy() {
      destroyed = true;
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      stopHeartbeat();
      ws?.close();
      ws = null;
      messageHandlers.clear();
      statusHandlers.clear();
    },
  };
}
