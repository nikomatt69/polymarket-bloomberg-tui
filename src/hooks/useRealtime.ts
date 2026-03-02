/**
 * SolidJS hook for Polymarket real-time WebSocket subscriptions.
 * Subscribes to live trade activity for the currently selected market.
 */

import { onMount, onCleanup, createEffect } from "solid-js";
import { PolymarketRealtimeClient } from "../api/realtime";
import { appState, setRealtimeConnected } from "../state";

export function useRealtimeData(): void {
  let client: PolymarketRealtimeClient | null = null;
  // Track the last subscribed slug so we can avoid redundant re-subscribes
  let subscribedSlug = "";

  function subscribeToMarket(slug: string): void {
    if (!slug || slug === subscribedSlug) return;
    subscribedSlug = slug;
    // channel "live_activity" with market_slug subscribes to trades for that market
    client?.subscribe("live_activity", undefined, slug);
  }

  onMount(() => {
    client = new PolymarketRealtimeClient(
      // onConnect
      () => {
        setRealtimeConnected(true);
        subscribedSlug = ""; // reset so next effect re-subscribes
        const market = appState.markets.find((m) => m.id === appState.selectedMarketId);
        const slug = (market as unknown as { slug?: string })?.slug ?? "";
        subscribeToMarket(slug);
      },
      // onMessage
      (_topic: string, type: string, _payload: unknown) => {
        // Live trade data — the order book panel and position data
        // are already refreshed by the 30s poll cycle. Here we just
        // set a flag that can trigger a faster manual refresh if needed.
        if (type === "trade" || type === "order_filled" || type === "orders_matched") {
          // Trigger a lightweight state update if desired — currently
          // we rely on the 30s interval; this hook keeps WS alive for future use.
        }
      },
      // onStatusChange
      (status) => {
        setRealtimeConnected(status === "connected");
      },
    );

    client.connect();
  });

  // Re-subscribe when selected market changes
  createEffect(() => {
    const marketId = appState.selectedMarketId;
    const market = appState.markets.find((m) => m.id === marketId);
    const slug = (market as unknown as { slug?: string })?.slug ?? "";
    if (client && slug) {
      subscribeToMarket(slug);
    }
  });

  onCleanup(() => {
    client?.disconnect();
    client = null;
    setRealtimeConnected(false);
  });
}
