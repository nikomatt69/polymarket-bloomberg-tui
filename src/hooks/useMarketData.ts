/**
 * Custom hook for fetching market data from Polymarket API
 */

import { createEffect, onCleanup } from "solid-js";
import {
  getMarkets,
  getMarketDetails,
  getPriceHistory,
  getMarketsByCategory,
  clearMarketCache,
} from "../api/polymarket";
import { Timeframe } from "../types/market";
import {
  setMarkets,
  setLoading,
  setError,
  appState,
  getSelectedMarket,
  selectedCategory,
  showToast,
} from "../state";
import { Market, PriceHistory } from "../types/market";
import { evaluateAlerts } from "./useAlerts";
import { MarketScanner } from "../automation/scanner";
import { loadRules, checkAllRules, executeAction } from "../automation/rules";
import { setAutomationRules, setScannerAlerts } from "../state";
import { initializeWebSocket, subscribe } from "../api/websocket";
import { walletState } from "../state";
import { fetchUserPositions, invalidateAndRefreshPositions } from "./usePositions";

const marketScanner = new MarketScanner();
const priceMap = new Map<string, number>();

async function runAutomationCycle(markets: Market[]): Promise<void> {
  try {
    const marketData = markets.map((m) => ({
      id: m.id,
      title: m.title,
      outcomes: m.outcomes.map((o) => ({
        outcome: o.title,
        price: o.price,
        volume: o.volume24h,
        tokenId: o.id,
      })),
    }));

    const marketInfos = markets.map((m) => ({
      id: m.id,
      question: m.title,
      volume: m.volume24h,
      prices: m.outcomes.map((o) => o.price),
      outcomes: m.outcomes.map((o) => o.title),
      liquidity: m.liquidity,
    }));

    const scanResults = marketScanner.scanMarkets(marketInfos);
    setScannerAlerts(scanResults);

    const rules = loadRules();
    setAutomationRules(rules);

    const triggered = checkAllRules(rules, marketData, [], priceMap);
    for (const rule of triggered) {
      const market = marketData.find((m) => m.id === rule.trigger.marketId || m.title.includes(rule.trigger.marketId || ""));
      void executeAction(rule.action, { market });
    }

    // Update price map for next cycle
    for (const m of marketData) {
      const outcome = m.outcomes.find((o) => o.outcome === "Yes") ?? m.outcomes[0];
      if (outcome) priceMap.set(m.id, outcome.price);
    }
  } catch (e) {
    console.error("[Automation] Error in cycle:", e);
  }
}

/**
 * Subscribe to token IDs of selected market only (for order book/details)
 */
function subscribeToMarketTokens(market: Market | undefined): void {
  if (!market) return;
  const tokenIds: string[] = [];
  for (const o of market.outcomes) {
    if (o.id && !o.id.startsWith("outcome_")) tokenIds.push(o.id);
  }
  if (tokenIds.length > 0) subscribe(tokenIds);
}

/**
 * Hook to fetch all markets on startup (initial load only — category switching
 * is owned by MarketList component to avoid double-fetches).
 */
export function useMarketsFetch(): void {
  // Initialize WS singleton on first mount
  initializeWebSocket();

  // One-shot initial load — does NOT react to selectedCategory signal.
  // MarketList handles all category-switching fetches.
  createEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const markets = await getMarkets(50);
        if (cancelled) return;
        setMarkets(markets);
        evaluateAlerts(markets);
        void runAutomationCycle(markets);
        subscribeToMarketTokens(getSelectedMarket());
        setError(null);
      } catch (error) {
        if (cancelled) return;
        const errorMsg = error instanceof Error ? error.message : "Failed to fetch markets";
        setError(errorMsg);
        showToast(errorMsg, "error");
        console.error("Error fetching markets:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  });
}

/**
 * Hook to fetch detailed market info when selected market changes
 */
export function useSelectedMarketDetails(): Market | undefined {
  const selected = getSelectedMarket();

  createEffect(async () => {
    if (!appState.selectedMarketId) return;

    try {
      const details = await getMarketDetails(appState.selectedMarketId);
      if (details) {
        setMarkets([
          ...appState.markets.map((m) =>
            m.id === details.id ? details : m
          ),
        ]);
        // Subscribe to this market's tokens for real-time updates
        const tokenIds = details.outcomes
          .map((o) => o.id)
          .filter((id) => id && !id.startsWith("outcome_"));
        if (tokenIds.length > 0) subscribe(tokenIds);
      }
    } catch (error) {
      console.error("Error fetching market details:", error);
    }
  });

  return selected;
}

/**
 * Hook to fetch price history when market or timeframe changes
 */
export async function usePriceHistory(
  marketId: string | null,
  timeframe: Timeframe
): Promise<PriceHistory | null> {
  if (!marketId) return null;

  try {
    const history = await getPriceHistory(marketId, timeframe);
    return history;
  } catch (error) {
    console.error("Error fetching price history:", error);
    return null;
  }
}

/**
 * Hook to set up periodic market refresh
 */
export function useRefreshInterval(intervalMs: number = 30000): void {
  createEffect(() => {
    const interval = setInterval(async () => {
      try {
        // Refresh the currently visible markets.
        // selectedCategory() is read here intentionally to refresh the right set,
        // but only on a timer — not reactive — so no double-fetch with MarketList.
        const category = selectedCategory();
        const markets = category && category !== "All" && category !== "trending" && category !== "all"
          ? await getMarketsByCategory(category, 50)
          : await getMarkets(50);

        setMarkets(markets);
        evaluateAlerts(markets);
        void runAutomationCycle(markets);
        subscribeToMarketTokens(getSelectedMarket());

        // Also refresh positions if wallet is connected
        if (walletState.connected && walletState.address) {
          void fetchUserPositions();
        }
      } catch (error) {
        console.error("Error refreshing markets:", error);
      }
    }, intervalMs);

    onCleanup(() => clearInterval(interval));
  });
}

/**
 * Manual refresh trigger
 */
export async function manualRefresh(): Promise<void> {
  // Clear cache on manual refresh to force fresh fetch
  clearMarketCache();
  setLoading(true);
  try {
    const category = selectedCategory();
    const markets = category && category !== "All" && category !== "trending" && category !== "all"
      ? await getMarketsByCategory(category, 50)
      : await getMarkets(50);

    setMarkets(markets);
    evaluateAlerts(markets);
    void runAutomationCycle(markets);
    subscribeToMarketTokens(getSelectedMarket());
    setError(null);

    // Also invalidate positions cache and refresh positions
    if (walletState.connected && walletState.address) {
      invalidateAndRefreshPositions();
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Refresh failed";
    setError(errorMsg);
    showToast(errorMsg, "error");
    console.error("Error refreshing markets:", error);
  } finally {
    setLoading(false);
  }
}
