/**
 * Polymarket real-time WebSocket client
 * Inline implementation of wss://ws-live-data.polymarket.com protocol
 * (no external package required — Bun has native WebSocket global)
 */

const WS_URL = "wss://ws-live-data.polymarket.com";
const PING_INTERVAL_MS = 5000;

export type RealtimeStatus = "connecting" | "connected" | "disconnected";

interface WsSubscribeMessage {
  type: "subscribe";
  channel: string;
  market_slug?: string;
  asset_id?: string;
  clob_auth?: {
    key: string;
    secret: string;
    passphrase: string;
  };
}

export class PolymarketRealtimeClient {
  private ws: WebSocket | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private autoReconnect = true;
  private reconnectDelay = 1000;
  private pendingSubscriptions: WsSubscribeMessage[] = [];

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

    const ws = new WebSocket(WS_URL);
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

      // Keep-alive ping
      this.pingTimer = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping" }));
        }
      }, PING_INTERVAL_MS);
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data as string) as Record<string, unknown>;
        const topic = typeof msg.channel === "string" ? msg.channel : "unknown";
        const type  = typeof msg.event   === "string" ? msg.event   :
                      typeof msg.type    === "string" ? msg.type    : "unknown";
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

  subscribe(channel: string, assetId?: string, marketSlug?: string): void {
    const msg: WsSubscribeMessage = {
      type: "subscribe",
      channel,
      ...(assetId    ? { asset_id: assetId }       : {}),
      ...(marketSlug ? { market_slug: marketSlug } : {}),
    };
    if (this.ws?.readyState === WebSocket.OPEN) {
      this._send(msg);
    } else {
      this.pendingSubscriptions.push(msg);
    }
  }

  subscribeWithClobAuth(
    channel: string,
    creds: { key: string; secret: string; passphrase: string },
    assetId?: string,
  ): void {
    const msg: WsSubscribeMessage = {
      type: "subscribe",
      channel,
      clob_auth: creds,
      ...(assetId ? { asset_id: assetId } : {}),
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
