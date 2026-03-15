/**
 * Custom hook for fetching market data from Polymarket API
 */

import { createSignal, onCleanup } from "solid-js";
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

// Request deduplication to prevent overlapping fetches
let pendingFetch: Promise<Market[]> | null = null;

/**
 * Hook to fetch all markets on startup
 */
export function useMarketsFetch(): void {
  // Use a signal to track if initial fetch is done
  const [initialFetchDone, setInitialFetchDone] = createSignal(false);
  
  // Use a simple flag to track if we should fetch
  if (!initialFetchDone()) {
    setLoading(true);
    setError(null);

    const fetchMarkets = async () => {
      try {
        // Use deduplicated fetch
        if (!pendingFetch) {
          pendingFetch = getMarkets(50);
        }
        const markets = await pendingFetch;
        pendingFetch = null;
        
        setMarkets(markets);
        evaluateAlerts(markets);
        setError(null);
        setInitialFetchDone(true);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Failed to fetch markets";
        setError(errorMsg);
        console.error("Error fetching markets:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMarkets();
  }
}

/**
 * Hook to fetch detailed market info when selected market changes
 */
export function useSelectedMarketDetails(): Market | undefined {
  const selected = getSelectedMarket();
  let currentMarketId: string | null = null;
  
  // Track when selected market changes
  const checkAndFetch = () => {
    const newMarketId = appState.selectedMarketId;
    if (!newMarketId || newMarketId === currentMarketId) return;
    
    currentMarketId = newMarketId;
    
    getMarketDetails(newMarketId)
      .then((details) => {
        if (details) {
          setMarkets([
            ...appState.markets.map((m) =>
              m.id === details.id ? details : m
            ),
          ]);
        }
      })
      .catch((error) => {
        console.error("Error fetching market details:", error);
      });
  };
  
  // Check on first run and whenever selectedMarketId changes
  checkAndFetch();
  
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

// Track if refresh is in progress to prevent overlapping
let refreshInProgress = false;

/**
 * Hook to set up periodic market refresh
 */
export function useRefreshInterval(intervalMs: number = 30000): void {
  let intervalId: ReturnType<typeof setInterval> | null = null;
  
  const doRefresh = async () => {
    // Skip if already refreshing
    if (refreshInProgress) return;
    
    refreshInProgress = true;
    try {
      // Use deduplicated fetch
      if (!pendingFetch) {
        pendingFetch = getMarkets(50);
      }
      const markets = await pendingFetch;
      pendingFetch = null;
      
      setMarkets(markets);
      evaluateAlerts(markets);
    } catch (error) {
      console.error("Error refreshing markets:", error);
    } finally {
      refreshInProgress = false;
    }
  };
  
  // Start the interval
  intervalId = setInterval(doRefresh, intervalMs);
  
  // Cleanup on unmount
  onCleanup(() => {
    if (intervalId) {
      clearInterval(intervalId);
    }
  });
}

/**
 * Manual refresh trigger
 */
export async function manualRefresh(): Promise<void> {
  // Skip if already refreshing
  if (refreshInProgress) return;
  
  setLoading(true);
  try {
    // Use deduplicated fetch
    if (!pendingFetch) {
      pendingFetch = getMarkets(50);
    }
    const markets = await pendingFetch;
    pendingFetch = null;
    
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