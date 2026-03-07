/**
 * SolidJS hook for Polymarket real-time WebSocket subscriptions.
 * RTDS: activity/trades, crypto_prices/update for the selected market.
 * Sports WS: live score updates when a sports market is selected.
 */

import { onMount, onCleanup, createEffect } from "solid-js";
import { PolymarketRealtimeClient, createSportsWebSocket } from "../api/realtime";
import { appState, setRealtimeConnected, setRtdsConnected, setSportsWsConnected, setSportsScore } from "../state";

export function useRealtimeData(): void {
  let rtdsClient: PolymarketRealtimeClient | null = null;
  let sportsWs: ReturnType<typeof createSportsWebSocket> | null = null;
  let lastSubscribedSlug = "";

  function subscribeToMarketActivity(slug: string): void {
    if (!slug || slug === lastSubscribedSlug) return;
    lastSubscribedSlug = slug;
    // Subscribe to activity trades for the selected market via correct RTDS format
    rtdsClient?.subscribe("activity", "trades", { event_slug: slug });
  }

  function ensureSportsSocket(): void {
    if (!sportsWs) {
      sportsWs = createSportsWebSocket();
      sportsWs.onStatus((status) => setSportsWsConnected(status === "connected"));
      sportsWs.onMessage((result) => {
        setSportsScore(result.gameId, {
          slug: result.slug,
          homeTeam: result.homeTeam,
          awayTeam: result.awayTeam,
          homeScore: result.homeScore,
          awayScore: result.awayScore,
          period: result.period,
          status: result.status,
        });
      });
      sportsWs.connect();
    }
  }

  onMount(() => {
    rtdsClient = new PolymarketRealtimeClient(
      // onConnect
      () => {
        setRtdsConnected(true);
        setRealtimeConnected(true);
        lastSubscribedSlug = ""; // reset so next effect re-subscribes

        // Subscribe to global crypto price updates (no filter = wildcard)
        rtdsClient?.subscribe("crypto_prices", "update");

        // Subscribe to selected market
        const market = appState.markets.find((m) => m.id === appState.selectedMarketId);
        const slug = (market as unknown as { slug?: string })?.slug ?? "";
        subscribeToMarketActivity(slug);
      },
      // onMessage
      (_topic: string, type: string, _payload: unknown) => {
        if (type === "trade" || type === "orders_matched") {
          // Live trade events — future enhancement: update order book panel state
        }
      },
      // onStatusChange
      (status) => {
        const connected = status === "connected";
        setRtdsConnected(connected);
        setRealtimeConnected(connected);
      },
    );

    rtdsClient.connect();
  });

  // Re-subscribe to RTDS when selected market changes
  createEffect(() => {
    const marketId = appState.selectedMarketId;
    const market = appState.markets.find((m) => m.id === marketId);
    const slug = (market as unknown as { slug?: string })?.slug ?? "";
    const category = (market as unknown as { category?: string })?.category ?? "";

    if (rtdsClient && slug) {
      subscribeToMarketActivity(slug);
    }

    // Connect Sports WS when a sports market is selected
    const isSportsMarket = category.toLowerCase().includes("sport") ||
      (market?.title ?? "").toLowerCase().match(/\b(nba|nfl|nhl|mlb|soccer|football|basketball|cricket|rugby|ufc|tennis|golf)\b/) !== null;

    if (isSportsMarket && market) {
      ensureSportsSocket();
    }
  });

  onCleanup(() => {
    rtdsClient?.disconnect();
    rtdsClient = null;
    sportsWs?.destroy();
    sportsWs = null;
    setRtdsConnected(false);
    setRealtimeConnected(false);
    setSportsWsConnected(false);
  });
}
