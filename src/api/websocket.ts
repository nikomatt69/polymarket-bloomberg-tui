/**
 * Polymarket WebSocket facade
 * Wires createClobWebSocket / createUserWebSocket from ws.ts into app state
 */

import { addMarketUpdate, setConnectionStatus, setUserWsConnected } from "../state";
import {
  createClobWebSocket,
  createUserWebSocket,
  type WsMessage,
  type WsUserMessage,
  type UserWsCredentials,
} from "./ws";

// ── Singleton CLOB market WS ───────────────────────────────────────────────

let clobWs: ReturnType<typeof createClobWebSocket> | null = null;
let clobWsStarted = false;

export function initializeWebSocket(): void {
  if (clobWs) return; // already initialized

  clobWs = createClobWebSocket();

  clobWs.onStatus((status) => {
    setConnectionStatus(status === "connected" ? "connected" : status === "connecting" ? "connecting" : "disconnected");
  });

  clobWs.onMessage((msg: WsMessage) => {
    if (msg.type === "price_change" || msg.type === "last_trade_price" || msg.type === "best_bid_ask") {
      const price = msg.type === "best_bid_ask"
        ? (msg.bid + msg.ask) / 2
        : msg.type === "last_trade_price"
          ? msg.price
          : msg.price;

      addMarketUpdate({
        tokenId: msg.assetId,
        price,
        ...(msg.type === "price_change" ? { side: msg.side, size: msg.size } : {}),
        ...(msg.type === "best_bid_ask" ? { bid: msg.bid, ask: msg.ask } : {}),
        timestamp: Date.now(),
      });
    }
  });
}

export function subscribe(tokenIds: string[]): void {
  if (!clobWs) initializeWebSocket();
  if (!clobWsStarted) {
    clobWs!.connect();
    clobWsStarted = true;
  }
  clobWs!.subscribe(tokenIds);
}

export function unsubscribe(tokenIds: string[]): void {
  if (!clobWs) return;
  clobWs.unsubscribe(tokenIds);
}

export function disconnectWebSocket(): void {
  clobWs?.destroy();
  clobWs = null;
  clobWsStarted = false;
  setConnectionStatus("disconnected");
}

// ── Singleton User WS ──────────────────────────────────────────────────────

let userWs: ReturnType<typeof createUserWebSocket> | null = null;
const userMessageHandlers = new Set<(msg: WsUserMessage) => void>();

export function initializeUserWebSocket(creds: UserWsCredentials, conditionIds: string[]): void {
  if (userWs) {
    // Refresh subscriptions
    userWs.updateConditionIds(conditionIds);
    return;
  }

  userWs = createUserWebSocket(creds, conditionIds);

  userWs.onStatus((status) => {
    setUserWsConnected(status === "connected");
  });

  userWs.onMessage((msg) => {
    userMessageHandlers.forEach((fn) => fn(msg));
  });

  userWs.connect();
}

export function onUserMessage(handler: (msg: WsUserMessage) => void): () => void {
  userMessageHandlers.add(handler);
  return () => userMessageHandlers.delete(handler);
}

export function disconnectUserWebSocket(): void {
  userWs?.destroy();
  userWs = null;
  userMessageHandlers.clear();
  setUserWsConnected(false);
}

export function getWebSocketClient() {
  return {
    subscribe: (tokenIds: string[]) => subscribe(tokenIds),
    unsubscribe: (tokenIds: string[]) => unsubscribe(tokenIds),
    disconnect: () => disconnectWebSocket(),
  };
}
