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
type PersistedActiveView = "market" | "portfolio";

export type AIProviderKind = "anthropic" | "openrouter" | "custom";

export interface AIProviderConfig {
  id: string;
  name: string;
  kind: AIProviderKind;
  baseUrl: string;
  model: string;
  apiKey?: string;
}

export interface AIProviderSettings {
  activeProviderId: string;
  providers: AIProviderConfig[];
}

type ProviderEditableField = "apiKey" | "baseUrl" | "model";

const DEFAULT_AI_PROVIDERS: AIProviderConfig[] = [
  {
    id: "openrouter",
    name: "OpenRouter",
    kind: "openrouter",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "anthropic/claude-sonnet-4",
    apiKey: "",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    kind: "anthropic",
    baseUrl: "https://api.anthropic.com",
    model: "claude-sonnet-4-20250514",
    apiKey: "",
  },
];

const DEFAULT_ACTIVE_AI_PROVIDER_ID = "openrouter";

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

// Main view state (unifies layout mode)
const [activeMainViewSignal, setActiveMainViewSignal] = createSignal<PersistedActiveView>("market");
export const activeMainView = activeMainViewSignal;

export function setActiveMainView(view: PersistedActiveView): void {
  setActiveMainViewSignal(view);
  savePersistedState();
}

// Compatibility wrappers
export function portfolioOpen(): boolean {
  return activeMainViewSignal() === "portfolio";
}

export function setPortfolioOpen(open: boolean): void {
  setActiveMainView(open ? "portfolio" : "market");
}

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
export const [settingsPanelTab, setSettingsPanelTab] = createSignal<"theme" | "providers" | "account" | "display" | "keys">("theme");
export const [settingsThemeQuery, setSettingsThemeQuery] = createSignal("");
export const [settingsThemeSearchEditing, setSettingsThemeSearchEditing] = createSignal(false);

// Search input focus state: while typing, global shortcuts must be blocked
export const [searchInputFocused, setSearchInputFocused] = createSignal(false);

function serializeProvider(provider: AIProviderConfig): AIProviderConfig {
  return {
    id: provider.id,
    name: provider.name,
    kind: provider.kind,
    baseUrl: normalizeBaseUrl(provider.baseUrl),
    model: provider.model,
    apiKey: provider.apiKey ?? "",
  };
}

const initialAiProviderSettings = normalizeAiProviderSettings(readPersistedConfigRaw());

export const [aiProviderState, setAiProviderState] = createStore<AIProviderSettings>(initialAiProviderSettings);

export const [settingsSelectedProviderId, setSettingsSelectedProviderId] = createSignal(
  initialAiProviderSettings.activeProviderId,
);

function saveAiProviderSettingsToConfig(settings: AIProviderSettings): void {
  try {
    const existing = readPersistedConfigRaw();
    const nextConfig: RawPersistedConfig = {
      ...existing,
      aiActiveProviderId: settings.activeProviderId,
      aiProviders: settings.providers.map(serializeProvider),
    };
    writePersistedConfigRaw(nextConfig);
  } catch (error) {
    console.error("Failed to save AI provider settings:", error);
  }
}

function syncSelectedProviderId(): void {
  const selected = settingsSelectedProviderId();
  if (!aiProviderState.providers.some((p) => p.id === selected)) {
    setSettingsSelectedProviderId(aiProviderState.activeProviderId);
  }
}

export function getActiveAIProvider(): AIProviderConfig | null {
  const selected = aiProviderState.providers.find((provider) => provider.id === aiProviderState.activeProviderId);
  if (selected) return selected;
  return aiProviderState.providers[0] ?? null;
}

export function setActiveAIProvider(providerId: string): boolean {
  if (!aiProviderState.providers.some((provider) => provider.id === providerId)) {
    return false;
  }

  setAiProviderState("activeProviderId", providerId);
  saveAiProviderSettingsToConfig({
    activeProviderId: providerId,
    providers: aiProviderState.providers,
  });
  return true;
}

export function updateAIProviderField(
  providerId: string,
  field: ProviderEditableField,
  value: string,
): boolean {
  const index = aiProviderState.providers.findIndex((provider) => provider.id === providerId);
  if (index === -1) {
    return false;
  }

  const trimmed = field === "apiKey" ? value.trim() : value;
  const normalized = field === "baseUrl" ? normalizeBaseUrl(trimmed) : trimmed;

  setAiProviderState("providers", index, field, normalized);
  saveAiProviderSettingsToConfig({
    activeProviderId: aiProviderState.activeProviderId,
    providers: aiProviderState.providers,
  });
  return true;
}

export function addAIProvider(provider: {
  id: string;
  name: string;
  baseUrl: string;
  model: string;
  apiKey?: string;
  kind?: AIProviderKind;
}): { ok: true } | { ok: false; error: string } {
  const id = provider.id.trim();
  const name = provider.name.trim();
  const baseUrl = normalizeBaseUrl(provider.baseUrl.trim());
  const model = provider.model.trim();
  const apiKey = (provider.apiKey ?? "").trim();
  const kind = provider.kind ?? "custom";

  if (!id) return { ok: false, error: "Provider id is required" };
  if (!/^[a-z0-9][a-z0-9-_]{1,31}$/i.test(id)) {
    return { ok: false, error: "Provider id must be 2-32 chars (letters, numbers, - or _)" };
  }
  if (aiProviderState.providers.some((entry) => entry.id === id)) {
    return { ok: false, error: `Provider \"${id}\" already exists` };
  }
  if (!name) return { ok: false, error: "Provider name is required" };
  if (!baseUrl || !/^https?:\/\//i.test(baseUrl)) {
    return { ok: false, error: "Base URL must start with http:// or https://" };
  }
  if (!model) return { ok: false, error: "Model id is required" };

  const nextProvider: AIProviderConfig = {
    id,
    name,
    kind,
    baseUrl,
    model,
    apiKey,
  };

  const nextProviders = [...aiProviderState.providers, nextProvider];
  setAiProviderState("providers", nextProviders);
  saveAiProviderSettingsToConfig({
    activeProviderId: aiProviderState.activeProviderId,
    providers: nextProviders,
  });
  return { ok: true };
}

export function removeAIProvider(providerId: string): { ok: true } | { ok: false; error: string } {
  if (providerId === "openrouter" || providerId === "anthropic") {
    return { ok: false, error: "Built-in providers cannot be removed" };
  }

  const nextProviders = aiProviderState.providers.filter((provider) => provider.id !== providerId);
  if (nextProviders.length === aiProviderState.providers.length) {
    return { ok: false, error: "Provider not found" };
  }

  const nextActive =
    aiProviderState.activeProviderId === providerId
      ? nextProviders.find((p) => p.id === "openrouter")?.id
        ?? nextProviders[0]?.id
        ?? DEFAULT_ACTIVE_AI_PROVIDER_ID
      : aiProviderState.activeProviderId;

  setAiProviderState({
    activeProviderId: nextActive,
    providers: nextProviders,
  });
  saveAiProviderSettingsToConfig({
    activeProviderId: nextActive,
    providers: nextProviders,
  });
  syncSelectedProviderId();
  return { ok: true };
}

export function maskSecret(value: string | undefined): string {
  if (!value) return "(empty)";
  if (value.length <= 8) return "*".repeat(value.length);
  return `${value.slice(0, 4)}${"*".repeat(Math.max(4, value.length - 8))}${value.slice(-4)}`;
}



// Shortcuts panel visibility signal
export const [shortcutsPanelOpen, setShortcutsPanelOpen] = createSignal(false);

// Chat/Assistant state signals
export const [chatInputFocused, setChatInputFocused] = createSignal(false);
export const [chatInputValue, setChatInputValue] = createSignal("");
export const [chatMessages, setChatMessages] = createSignal<ChatMessage[]>([]);
export const [chatLoading, setChatLoading] = createSignal(false);

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
}

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

function isActiveView(value: unknown): value is PersistedActiveView {
  return value === "market" || value === "portfolio";
}

function isProviderKind(value: unknown): value is AIProviderKind {
  return value === "anthropic" || value === "openrouter" || value === "custom";
}

function sanitizeProviderText(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function sanitizeProviderConfig(value: unknown, fallbackIndex: number): AIProviderConfig | null {
  if (!value || typeof value !== "object") return null;

  const raw = value as Record<string, unknown>;
  const id = sanitizeProviderText(raw.id, `custom-${fallbackIndex}`);
  const name = sanitizeProviderText(raw.name, id);
  const kind = isProviderKind(raw.kind) ? raw.kind : "custom";
  const baseUrl = normalizeBaseUrl(
    sanitizeProviderText(
      raw.baseUrl,
      kind === "anthropic"
        ? "https://api.anthropic.com"
        : "https://openrouter.ai/api/v1",
    ),
  );
  const model = sanitizeProviderText(
    raw.model,
    kind === "anthropic" ? "claude-sonnet-4-20250514" : "anthropic/claude-sonnet-4",
  );
  const apiKey = typeof raw.apiKey === "string" ? raw.apiKey.trim() : "";

  return {
    id,
    name,
    kind,
    baseUrl,
    model,
    apiKey,
  };
}

function mergeProviderWithDefault(provider: AIProviderConfig): AIProviderConfig {
  const fallback = DEFAULT_AI_PROVIDERS.find((x) => x.id === provider.id);
  if (!fallback) {
    return provider;
  }

  return {
    ...fallback,
    ...provider,
    baseUrl: normalizeBaseUrl(provider.baseUrl || fallback.baseUrl),
    model: provider.model || fallback.model,
    name: provider.name || fallback.name,
  };
}

function normalizeAiProviderSettings(raw: RawPersistedConfig): AIProviderSettings {
  const merged = new Map<string, AIProviderConfig>();
  for (const provider of DEFAULT_AI_PROVIDERS) {
    merged.set(provider.id, { ...provider });
  }

  const storedProviders = Array.isArray(raw.aiProviders) ? raw.aiProviders : [];
  storedProviders.forEach((entry, idx) => {
    const parsed = sanitizeProviderConfig(entry, idx);
    if (!parsed) return;

    if (merged.has(parsed.id)) {
      merged.set(parsed.id, mergeProviderWithDefault(parsed));
    } else {
      merged.set(parsed.id, parsed);
    }
  });

  const legacyAnthropicKey =
    typeof raw.anthropicApiKey === "string" && raw.anthropicApiKey.trim().length > 0
      ? raw.anthropicApiKey.trim()
      : "";

  if (legacyAnthropicKey) {
    const anthropic = merged.get("anthropic");
    if (anthropic && !anthropic.apiKey) {
      merged.set("anthropic", { ...anthropic, apiKey: legacyAnthropicKey });
    }
  }

  const providers = Array.from(merged.values());
  const configuredOpenRouter = providers.find((p) => p.id === "openrouter" && p.apiKey);
  const configuredAnthropic = providers.find((p) => p.id === "anthropic" && p.apiKey);
  const storedActiveProvider = typeof raw.aiActiveProviderId === "string" ? raw.aiActiveProviderId : undefined;

  const activeProviderId =
    (storedActiveProvider && providers.some((p) => p.id === storedActiveProvider) && storedActiveProvider)
    || configuredOpenRouter?.id
    || configuredAnthropic?.id
    || providers.find((p) => p.id === DEFAULT_ACTIVE_AI_PROVIDER_ID)?.id
    || providers[0]?.id
    || DEFAULT_ACTIVE_AI_PROVIDER_ID;

  return {
    activeProviderId,
    providers,
  };
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
  writeFileSync(configPath, JSON.stringify(config, null, 2), { mode: 0o600 });
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
    activeView: isActiveView(raw.activeView) ? raw.activeView : undefined,
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
      activeView: activeMainViewSignal(),
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

export function loadAnthropicApiKey(): string | null {
  const raw = readPersistedConfigRaw();
  return typeof raw.anthropicApiKey === "string" && raw.anthropicApiKey.trim().length > 0
    ? raw.anthropicApiKey
    : null;
}

export function saveAnthropicApiKey(apiKey: string): void {
  try {
    const existing = readPersistedConfigRaw();
    const nextConfig: RawPersistedConfig = { ...existing, anthropicApiKey: apiKey };
    writePersistedConfigRaw(nextConfig);
  } catch (error) {
    console.error("Failed to save Anthropic API key:", error);
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
    setActiveMainViewSignal(persisted.activeView === "portfolio" ? "portfolio" : "market");
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
