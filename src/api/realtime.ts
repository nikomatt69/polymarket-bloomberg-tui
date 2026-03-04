/**
 * Polymarket real-time WebSocket clients
 *
 * PolymarketRealtimeClient  → wss://ws-live-data.polymarket.com  (RTDS)
 * createSportsWebSocket()   → wss://sports-api.polymarket.com/ws (Sports events)
 */

const RTDS_URL = "wss://ws-live-data.polymarket.com";
const SPORTS_WS_URL = "wss://sports-api.polymarket.com/ws";
const PING_INTERVAL_MS = 5000;

export type RealtimeStatus = "connecting" | "connected" | "disconnected";

// RTDS correct subscription format
interface RtdsSubscription {
  topic: string;
  type: string;
  filters?: string; // JSON-stringified filters object
}

interface RtdsSubscribeMessage {
  subscriptions: RtdsSubscription[];
}

export class PolymarketRealtimeClient {
  private ws: WebSocket | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private autoReconnect = true;
  private reconnectDelay = 1000;
  private pendingSubscriptions: RtdsSubscribeMessage[] = [];

  constructor(
    private readonly onConnect: () => void,
    private readonly onMessage: (topic: string, type: string, payload: unknown) => void,
    private readonly onStatusChange: (status: RealtimeStatus) => void,
  ) {}

  connect(): void {
    this.autoReconnect = true;
    this.reconnectDelay = 1000;
    this._open();
  }

  private _open(): void {
    this.onStatusChange("connecting");

    const ws = new WebSocket(RTDS_URL);
    this.ws = ws;

    ws.onopen = () => {
      this.reconnectDelay = 1000;
      this.onStatusChange("connected");
      this.onConnect();

      // Replay any subscriptions queued before connection
      for (const sub of this.pendingSubscriptions) {
        this._send(sub);
      }
      this.pendingSubscriptions = [];

      // Keep-alive ping (RTDS accepts JSON ping)
      this.pingTimer = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping" }));
        }
      }, PING_INTERVAL_MS);
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        const raw = typeof event.data === "string" ? event.data : String(event.data ?? "");
        const msg = JSON.parse(raw) as Record<string, unknown>;
        // RTDS message shape: {topic, type, data}
        const topic = typeof msg.topic === "string" ? msg.topic : "unknown";
        const type = typeof msg.type === "string" ? msg.type : "unknown";
        this.onMessage(topic, type, msg.data ?? msg);
      } catch {
        // ignore malformed frames
      }
    };

    ws.onerror = () => {
      // onclose will fire next and handle reconnect
    };

    ws.onclose = () => {
      this._clearPing();
      this.ws = null;
      this.onStatusChange("disconnected");
      if (this.autoReconnect) {
        setTimeout(() => this._open(), this.reconnectDelay);
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
      }
    };
  }

  /**
   * Subscribe to an RTDS topic+type with optional filters.
   * Correct format: {subscriptions:[{topic, type, filters: JSON.stringify({...})}]}
   *
   * Topics: activity/trades, activity/orders_matched, comments/comment_created,
   *         crypto_prices/update, equity_prices/update
   * Use type "*" for wildcard.
   */
  subscribe(topic: string, type: string, filters?: Record<string, string>): void {
    const subscription: RtdsSubscription = {
      topic,
      type,
      ...(filters ? { filters: JSON.stringify(filters) } : {}),
    };
    const msg: RtdsSubscribeMessage = { subscriptions: [subscription] };
    if (this.ws?.readyState === WebSocket.OPEN) {
      this._send(msg);
    } else {
      this.pendingSubscriptions.push(msg);
    }
  }

  /**
   * Subscribe to multiple topics at once.
   */
  subscribeMany(subs: Array<{ topic: string; type: string; filters?: Record<string, string> }>): void {
    const msg: RtdsSubscribeMessage = {
      subscriptions: subs.map(({ topic, type, filters }) => ({
        topic,
        type,
        ...(filters ? { filters: JSON.stringify(filters) } : {}),
      })),
    };
    if (this.ws?.readyState === WebSocket.OPEN) {
      this._send(msg);
    } else {
      this.pendingSubscriptions.push(msg);
    }
  }

  disconnect(): void {
    this.autoReconnect = false;
    this._clearPing();
    this.ws?.close();
    this.ws = null;
    this.pendingSubscriptions = [];
  }

  private _send(msg: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private _clearPing(): void {
    if (this.pingTimer !== null) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }
}

// ── Sports WebSocket ───────────────────────────────────────────────────────

export interface SportResult {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  period: string;
  status: string;
}

type SportsMessageHandler = (result: SportResult) => void;
type SportsStatusHandler = (status: RealtimeStatus) => void;

/**
 * Creates an auto-reconnecting Sports WebSocket.
 * URL: wss://sports-api.polymarket.com/ws
 * Heartbeat: server sends "ping", client responds "pong"
 * Subscribe: {type:"market", assets_ids:[...tokenIds]}
 * Messages: event_type="sport_result"
 */
export function createSportsWebSocket() {
  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectCount = 0;
  let destroyed = false;
  let currentTokenIds: string[] = [];

  const messageHandlers = new Set<SportsMessageHandler>();
  const statusHandlers = new Set<SportsStatusHandler>();

  function emitStatus(status: RealtimeStatus) {
    statusHandlers.forEach((fn) => fn(status));
  }

  function sendSubscribe(tokenIds: string[]) {
    if (ws?.readyState === WebSocket.OPEN && tokenIds.length > 0) {
      ws.send(JSON.stringify({ type: "market", assets_ids: tokenIds }));
    }
  }

  function handleRawMessage(raw: unknown) {
    const entries = Array.isArray(raw) ? raw : raw && typeof raw === "object" ? [raw] : [];
    for (const item of entries) {
      if (!item || typeof item !== "object") continue;
      const r = item as Record<string, unknown>;
      const eventType = r.event_type as string | undefined;
      if (eventType === "sport_result") {
        const result: SportResult = {
          gameId: String(r.game_id ?? r.gameId ?? ""),
          homeTeam: String(r.home_team ?? r.homeTeam ?? ""),
          awayTeam: String(r.away_team ?? r.awayTeam ?? ""),
          homeScore: Number(r.home_score ?? r.homeScore ?? 0),
          awayScore: Number(r.away_score ?? r.awayScore ?? 0),
          period: String(r.period ?? ""),
          status: String(r.status ?? ""),
        };
        messageHandlers.forEach((fn) => fn(result));
      }
    }
  }

  function connect() {
    if (destroyed) return;
    emitStatus("connecting");
    ws = new WebSocket(SPORTS_WS_URL);

    ws.onopen = () => {
      reconnectCount = 0;
      emitStatus("connected");
      if (currentTokenIds.length > 0) {
        sendSubscribe(currentTokenIds);
      }
    };

    ws.onmessage = (event) => {
      const rawPayload = typeof event.data === "string" ? event.data : String(event.data ?? "");
      if (rawPayload.trim().toLowerCase() === "ping") {
        // Server heartbeat — respond with pong
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send("pong");
        }
        return;
      }
      try {
        const data = JSON.parse(rawPayload);
        handleRawMessage(data);
      } catch {
        // Ignore malformed
      }
    };

    ws.onerror = () => {};

    ws.onclose = () => {
      if (destroyed) return;
      emitStatus("disconnected");
      const delay = Math.min(1_000 * Math.pow(2, reconnectCount), 30_000);
      reconnectCount += 1;
      reconnectTimer = setTimeout(() => connect(), delay);
    };
  }

  return {
    connect() { connect(); },
    subscribe(tokenIds: string[]) {
      currentTokenIds = Array.from(new Set(tokenIds.filter(Boolean)));
      sendSubscribe(currentTokenIds);
    },
    onMessage(handler: SportsMessageHandler): () => void {
      messageHandlers.add(handler);
      return () => messageHandlers.delete(handler);
    },
    onStatus(handler: SportsStatusHandler): () => void {
      statusHandlers.add(handler);
      return () => statusHandlers.delete(handler);
    },
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
