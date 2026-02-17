/**
 * Global application state using SolidJS signals and store
 */

import { createSignal, createEffect } from "solid-js";
import { createStore } from "solid-js/store";
import { AppState, PersistentState, Market, WalletState } from "./types/market";
import { homedir } from "os";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

// Default app state
const initialState: AppState = {
  markets: [],
  selectedMarketId: null,
  searchQuery: "",
  sortBy: "volume",
  timeframe: "7d",
  loading: false,
  error: null,
  lastRefresh: new Date(),
};

// Create reactive store
export const [appState, setAppState] = createStore<AppState>(initialState);

// Wallet state store
const initialWalletState: WalletState = {
  address: null,
  connected: false,
  balance: 0,
  loading: false,
  error: null,
};
export const [walletState, setWalletState] = createStore<WalletState>(initialWalletState);

// Create signals for reactive values
export const [highlightedIndex, setHighlightedIndex] = createSignal(0);
export const [isRefreshing, setIsRefreshing] = createSignal(false);

// Wallet modal visibility and input mode signals
export const [walletModalOpen, setWalletModalOpen] = createSignal(false);
export const [walletModalMode, setWalletModalMode] = createSignal<"view" | "enter">("view");
export const [walletModalInput, setWalletModalInput] = createSignal("");

/**
 * Get path to config directory
 */
function getConfigPath(): string {
  const configDir = join(homedir(), ".polymarket-tui");
  try {
    mkdirSync(configDir, { recursive: true });
  } catch (e) {
    // Directory might already exist
  }
  return join(configDir, "config.json");
}

/**
 * Load persistent state from disk
 */
export function loadPersistedState(): PersistentState | null {
  try {
    const configPath = getConfigPath();
    const data = readFileSync(configPath, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    return null;
  }
}

/**
 * Save persistent state to disk
 */
export function savePersistedState(): void {
  try {
    const configPath = getConfigPath();
    const persistentState: PersistentState = {
      selectedMarketId: appState.selectedMarketId,
      searchQuery: appState.searchQuery,
      sortBy: appState.sortBy,
      timeframe: appState.timeframe,
    };
    writeFileSync(configPath, JSON.stringify(persistentState, null, 2));
  } catch (error) {
    console.error("Failed to save persistent state:", error);
  }
}

/**
 * Initialize state from persisted config
 */
export function initializeState(): void {
  const persisted = loadPersistedState();
  if (persisted) {
    setAppState("selectedMarketId", persisted.selectedMarketId);
    setAppState("searchQuery", persisted.searchQuery);
    setAppState("sortBy", persisted.sortBy);
    setAppState("timeframe", persisted.timeframe);
  }
}

/**
 * Get filtered and sorted markets based on current state
 */
export function getFilteredMarkets(): Market[] {
  let filtered = [...appState.markets];

  // Apply search filter
  if (appState.searchQuery) {
    const query = appState.searchQuery.toLowerCase();
    filtered = filtered.filter(
      (m) =>
        m.title.toLowerCase().includes(query) ||
        (m.description && m.description.toLowerCase().includes(query))
    );
  }

  // Apply sorting
  switch (appState.sortBy) {
    case "volume":
      filtered.sort((a, b) => b.volume24h - a.volume24h);
      break;
    case "change":
      filtered.sort((a, b) => b.change24h - a.change24h);
      break;
    case "name":
      filtered.sort((a, b) => a.title.localeCompare(b.title));
      break;
  }

  return filtered;
}

/**
 * Select a market by ID
 */
export function selectMarket(marketId: string | null): void {
  setAppState("selectedMarketId", marketId);
  savePersistedState();
}

/**
 * Update search query
 */
export function updateSearchQuery(query: string): void {
  setAppState("searchQuery", query);
  setHighlightedIndex(0);
}

/**
 * Update sort method
 */
export function setSortBy(sortBy: "volume" | "change" | "name"): void {
  setAppState("sortBy", sortBy);
  savePersistedState();
}

/**
 * Update chart timeframe
 */
export function setTimeframe(timeframe: "1d" | "5d" | "7d" | "all"): void {
  setAppState("timeframe", timeframe);
  savePersistedState();
}

/**
 * Set loading state
 */
export function setLoading(loading: boolean): void {
  setAppState("loading", loading);
}

/**
 * Set error message
 */
export function setError(error: string | null): void {
  setAppState("error", error);
}

/**
 * Update markets list
 */
export function setMarkets(markets: Market[]): void {
  setAppState("markets", markets);
  setAppState("lastRefresh", new Date());
}

/**
 * Get currently selected market
 */
export function getSelectedMarket(): Market | undefined {
  return appState.markets.find((m) => m.id === appState.selectedMarketId);
}

/**
 * Navigate to next market in filtered list
 */
export function navigateNext(): void {
  const filtered = getFilteredMarkets();
  if (filtered.length === 0) return;

  const idx = highlightedIndex();
  const nextIdx = (idx + 1) % filtered.length;
  setHighlightedIndex(nextIdx);
  selectMarket(filtered[nextIdx].id);
}

/**
 * Navigate to previous market in filtered list
 */
export function navigatePrev(): void {
  const filtered = getFilteredMarkets();
  if (filtered.length === 0) return;

  const idx = highlightedIndex();
  const prevIdx = (idx - 1 + filtered.length) % filtered.length;
  setHighlightedIndex(prevIdx);
  selectMarket(filtered[prevIdx].id);
}
