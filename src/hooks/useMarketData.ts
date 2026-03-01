/**
 * Custom hook for fetching market data from Polymarket API
 */

import { createEffect, onCleanup } from "solid-js";
import {
  getMarkets,
  getMarketDetails,
  getPriceHistory,
} from "../api/polymarket";
import { Timeframe } from "../types/market";
import {
  setMarkets,
  setLoading,
  setError,
  appState,
  getSelectedMarket,
} from "../state";
import { Market, PriceHistory } from "../types/market";
import { evaluateAlerts } from "./useAlerts";
import { MarketScanner } from "../automation/scanner";
import { loadRules, checkAllRules, executeAction } from "../automation/rules";
import { setAutomationRules, setScannerAlerts } from "../state";

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
 * Hook to fetch all markets on startup
 */
export function useMarketsFetch(): void {
  createEffect(async () => {
    setLoading(true);
    setError(null);

    try {
      const markets = await getMarkets(50);
      setMarkets(markets);
      evaluateAlerts(markets);
      void runAutomationCycle(markets);
      setError(null);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to fetch markets";
      setError(errorMsg);
      console.error("Error fetching markets:", error);
    } finally {
      setLoading(false);
    }
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
        // Update market in list with new details
        setMarkets([
          ...appState.markets.map((m) =>
            m.id === details.id ? details : m
          ),
        ]);
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
        const markets = await getMarkets(50);
        setMarkets(markets);
        evaluateAlerts(markets);
        void runAutomationCycle(markets);
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
  setLoading(true);
  try {
    const markets = await getMarkets(50);
    setMarkets(markets);
    evaluateAlerts(markets);
    void runAutomationCycle(markets);
    setError(null);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Refresh failed";
    setError(errorMsg);
    console.error("Error refreshing markets:", error);
  } finally {
    setLoading(false);
  }
}
