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

export type WsMessage = WsBookSnapshot | WsPriceChange | WsTrade;

type MessageHandler = (msg: WsMessage) => void;
type StatusHandler = (status: WsStatus) => void;

const CLOB_WS_URL = "wss://ws-subscriptions-clob.polymarket.com/ws/market";
const MAX_RECONNECT_DELAY_MS = 30_000;

/**
 * Creates an auto-reconnecting WebSocket manager for CLOB market data.
 * Subscribes to real-time book snapshots, price changes, and last trade prices.
 */
export function createClobWebSocket() {
  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
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

  function handleRawMessage(raw: unknown) {
    if (!Array.isArray(raw)) return;

    for (const item of raw) {
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
        const changes = Array.isArray((item as Record<string, unknown>).changes)
          ? ((item as Record<string, unknown>).changes as Array<Record<string, unknown>>)
          : [];

        for (const change of changes) {
          const side = (change.side as string) === "BUY" ? "BUY" : "SELL";
          const msg: WsPriceChange = {
            type: "price_change",
            assetId: String((item as Record<string, unknown>).asset_id ?? ""),
            side,
            price: typeof change.price === "string" ? parseFloat(change.price) : Number(change.price),
            size: typeof change.size === "string" ? parseFloat(change.size) : Number(change.size),
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
      }
    }
  }

  function sendSubscribe(assetIds: string[]) {
    if (ws?.readyState === WebSocket.OPEN && assetIds.length > 0) {
      ws.send(
        JSON.stringify({
          type: "subscribe",
          assets_ids: assetIds,
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
      if (currentAssetIds.length > 0) {
        sendSubscribe(currentAssetIds);
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string);
        handleRawMessage(data);
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onerror = () => {
      // onclose will handle reconnection
    };

    ws.onclose = () => {
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

    /** Subscribe to market asset IDs for real-time updates. */
    subscribe(assetIds: string[]) {
      currentAssetIds = Array.from(new Set(assetIds.filter(Boolean)));
      sendSubscribe(currentAssetIds);
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
      ws?.close();
      ws = null;
      messageHandlers.clear();
      statusHandlers.clear();
    },
  };
}
