/**
 * Global application state using SolidJS signals and store
 */

import { createSignal, createEffect } from "solid-js";
import { createStore } from "solid-js/store";
import { AppState, PersistentState, Market, WalletState } from "./types/market";
import { homedir } from "os";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

type PersistedThemeMode = "dark" | "light";

interface RawPersistedConfig extends Partial<PersistentState> {
  [key: string]: unknown;
}

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

// Portfolio panel visibility signal
export const [portfolioOpen, setPortfolioOpen] = createSignal(false);

// Order history panel visibility signal
export const [orderHistoryOpen, setOrderHistoryOpen] = createSignal(false);

// Order form signals
export const [orderFormOpen, setOrderFormOpen] = createSignal(false);
export const [orderFormTokenId, setOrderFormTokenId] = createSignal("");
export const [orderFormSide, setOrderFormSide] = createSignal<"BUY" | "SELL">("BUY");
export const [orderFormMarketTitle, setOrderFormMarketTitle] = createSignal("");
export const [orderFormOutcomeTitle, setOrderFormOutcomeTitle] = createSignal("");
export const [orderFormCurrentPrice, setOrderFormCurrentPrice] = createSignal(0);
export const [orderFormPriceInput, setOrderFormPriceInput] = createSignal("");
export const [orderFormSharesInput, setOrderFormSharesInput] = createSignal("");
export const [orderFormFocusField, setOrderFormFocusField] = createSignal<"price" | "shares">("price");
export const [orderFormType, setOrderFormType] = createSignal<"GTC" | "FOK" | "GTD">("GTC");
export const [orderFormPostOnly, setOrderFormPostOnly] = createSignal(false);

// Order history selected index for cancel
export const [orderHistorySelectedIdx, setOrderHistorySelectedIdx] = createSignal(0);
export const [orderHistoryTradeSelectedIdx, setOrderHistoryTradeSelectedIdx] = createSignal(0);
export const [orderHistorySection, setOrderHistorySection] = createSignal<"open" | "trades">("open");

// Panel visibility signals
export const [indicatorsPanelOpen, setIndicatorsPanelOpen] = createSignal(false);
export const [sentimentPanelOpen, setSentimentPanelOpen] = createSignal(false);
export const [comparisonPanelOpen, setComparisonPanelOpen] = createSignal(false);
export const [comparisonSelectMode, setComparisonSelectMode] = createSignal(false);
export const [comparisonSelectedMarketId, setComparisonSelectedMarketId] = createSignal<string | null>(null);
export const [watchlistPanelOpen, setWatchlistPanelOpen] = createSignal(false);
export const [accountStatsOpen, setAccountStatsOpen] = createSignal(false);

// Settings panel visibility and active tab signals
export const [settingsPanelOpen, setSettingsPanelOpen] = createSignal(false);
export const [settingsPanelTab, setSettingsPanelTab] = createSignal<"theme" | "account" | "display" | "keys">("theme");

// Shortcuts panel visibility signal
export const [shortcutsPanelOpen, setShortcutsPanelOpen] = createSignal(false);

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

function isSortBy(value: unknown): value is AppState["sortBy"] {
  return value === "volume" || value === "change" || value === "name";
}

function isTimeframe(value: unknown): value is AppState["timeframe"] {
  return value === "1d" || value === "5d" || value === "7d" || value === "all";
}

function isThemeMode(value: unknown): value is PersistedThemeMode {
  return value === "dark" || value === "light";
}

function readPersistedConfigRaw(): RawPersistedConfig {
  try {
    const configPath = getConfigPath();
    const data = readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(data) as unknown;

    if (parsed && typeof parsed === "object") {
      return parsed as RawPersistedConfig;
    }
  } catch {
    // config does not exist or is invalid
  }
  return {};
}

function writePersistedConfigRaw(config: RawPersistedConfig): void {
  const configPath = getConfigPath();
  writeFileSync(configPath, JSON.stringify(config, null, 2));
}

/**
 * Load persistent state from disk
 */
export function loadPersistedState(): PersistentState | null {
  const raw = readPersistedConfigRaw();

  const selectedMarketId = raw.selectedMarketId;
  const searchQuery = raw.searchQuery;
  const sortBy = raw.sortBy;
  const timeframe = raw.timeframe;

  if (
    !(selectedMarketId === null || typeof selectedMarketId === "string")
    || typeof searchQuery !== "string"
    || !isSortBy(sortBy)
    || !isTimeframe(timeframe)
  ) {
    return null;
  }

  return {
    selectedMarketId,
    searchQuery,
    sortBy,
    timeframe,
    themeMode: isThemeMode(raw.themeMode) ? raw.themeMode : undefined,
    themeName: typeof raw.themeName === "string" ? raw.themeName : undefined,
  };
}

/**
 * Save persistent state to disk
 */
export function savePersistedState(): void {
  try {
    const existing = readPersistedConfigRaw();
    const nextConfig: RawPersistedConfig = {
      ...existing,
      selectedMarketId: appState.selectedMarketId,
      searchQuery: appState.searchQuery,
      sortBy: appState.sortBy,
      timeframe: appState.timeframe,
    };
    writePersistedConfigRaw(nextConfig);
  } catch (error) {
    console.error("Failed to save persistent state:", error);
  }
}

export interface PersistedThemePreferences {
  themeMode?: PersistedThemeMode;
  themeName?: string;
}

export function loadPersistedThemePreferences(): PersistedThemePreferences {
  const raw = readPersistedConfigRaw();
  return {
    themeMode: isThemeMode(raw.themeMode) ? raw.themeMode : undefined,
    themeName:
      typeof raw.themeName === "string" && raw.themeName.trim().length > 0
        ? raw.themeName
        : undefined,
  };
}

export function savePersistedThemePreferences(preferences: PersistedThemePreferences): void {
  try {
    const existing = readPersistedConfigRaw();
    const nextConfig: RawPersistedConfig = { ...existing };

    if (preferences.themeMode !== undefined) {
      nextConfig.themeMode = preferences.themeMode;
    }
    if (preferences.themeName !== undefined) {
      nextConfig.themeName = preferences.themeName;
    }

    writePersistedConfigRaw(nextConfig);
  } catch (error) {
    console.error("Failed to save theme preferences:", error);
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
  // lazy import to avoid circular dependency
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { watchlistState } = require("./hooks/useWatchlist") as typeof import("./hooks/useWatchlist");

  let filtered = [...appState.markets];

  // Apply watchlist filter when active
  if (watchlistState.filterActive && watchlistState.marketIds.length > 0) {
    filtered = filtered.filter((m) => watchlistState.marketIds.includes(m.id));
  }

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
 * Navigate directly to a market by its index in the filtered list
 */
export function navigateToIndex(index: number): void {
  const filtered = getFilteredMarkets();
  if (filtered.length === 0 || index < 0 || index >= filtered.length) return;
  setHighlightedIndex(index);
  selectMarket(filtered[index].id);
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
