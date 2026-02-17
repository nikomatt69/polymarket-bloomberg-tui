/**
 * Custom hook for fetching market data from Polymarket API
 */

import { createEffect } from "solid-js";
import {
  getMarkets,
  getMarketDetails,
  getPriceHistory,
} from "../api/polymarket";
import {
  setMarkets,
  setLoading,
  setError,
  appState,
  getSelectedMarket,
} from "../state";
import { Market, PriceHistory } from "../types/market";
import { evaluateAlerts } from "./useAlerts";

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
  timeframe: "1d" | "5d" | "7d" | "all"
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
      } catch (error) {
        console.error("Error refreshing markets:", error);
      }
    }, intervalMs);

    return () => clearInterval(interval);
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
    setError(null);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Refresh failed";
    setError(errorMsg);
    console.error("Error refreshing markets:", error);
  } finally {
    setLoading(false);
  }
}
