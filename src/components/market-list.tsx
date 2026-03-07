/**
 * Market list panel with category tabs, pagination, and inline probability.
 *
 * Category switching clears and reloads markets (first PAGE_SIZE items).
 * When the keyboard cursor reaches within PRELOAD_AHEAD rows of the bottom,
 * the next page is automatically fetched and appended (infinite scroll).
 *
 * The displayed list is always the filtered view from getFilteredMarkets(),
 * which applies search-query and watchlist filters on top of the loaded set.
 *
 * Live WS price updates (from addMarketUpdate) are overlaid on each row so
 * probabilities reflect real-time data without a full market refresh.
 */

import { For, Show, createMemo, createSignal, createEffect, on } from "solid-js";
import {
  appState,
  highlightedIndex,
  setHighlightedIndex,
  getFilteredMarkets,
  navigateToIndex,
  setMarkets,
  appendMarkets,
  marketListCategoryId,
  setMarketListCategoryId,
  wsConnectionStatus,
  rtdsConnected,
  userWsConnected,
  sportsScores,
  getLastPrice,
  isDetachedSelectedMarket,
  selectMarket,
  setSelectedCategory,
  selectedSubCategory,
  setSelectedSubCategory,
} from "../state";
import { formatVolume, formatChange, truncateString } from "../utils/format";
import { Market } from "../types/market";
import { useTheme } from "../context/theme";
import { isWatched, watchlistState } from "../hooks/useWatchlist";
import {
  getMarketsByCategory,
  getAllMarketsByCategory,
  getTrendingMarkets,
  getMarkets,
  getAllMarkets,
  getLiveSportsMarkets,
  getMarketsByTag,
  getCategories,
} from "../api/polymarket";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function generateMiniSparkline(change24h: number, width: number = 6): string {
  const chars = "▁▂▃▄▅▆▇█";
  if (change24h === 0) return "──────";

  const normalized = Math.min(1, Math.max(-1, change24h / 20));
  const charIdx = Math.floor((normalized + 1) / 2 * (chars.length - 1));
  const char = chars[charIdx] || "─";

  if (change24h > 0) {
    return "▲" + char.repeat(width - 1);
  } else {
    return "▼" + char.repeat(width - 1);
  }
}

/** Category emoji + 3-letter badge */
const BADGE_MAP: Record<string, string> = {
  sports:         "⚽SPO",
  politics:       "🏛POL",
  crypto:         "₿CRY",
  cryptocurrency: "₿CRY",
  business:       "💼BIZ",
  economics:      "💼BIZ",
  "ai":           "🤖 AI",
  "artificial-intelligence": "🤖 AI",
  tech:           "💻TEC",
  technology:     "💻TEC",
  science:        "🔬SCI",
  entertainment:  "🎬ENT",
  "pop-culture":  "🎬ENT",
  world:          "🌍WLD",
  health:         "🏥HLT",
  climate:        "🌿CLM",
  "climate-and-environment": "🌿CLM",
};

function getCategoryBadge(category: string | undefined): string {
  const cat = (category ?? "").toLowerCase().trim();
  for (const [key, badge] of Object.entries(BADGE_MAP)) {
    if (cat.includes(key)) return badge;
  }
  return "   GEN";
}

/** Expiry info for the Exp column */
function formatExpiry(resolutionDate: Date | undefined): { text: string; level: "ok" | "warn" | "critical" } {
  if (!resolutionDate) return { text: " ---", level: "ok" };
  const diffMs = resolutionDate.getTime() - Date.now();
  if (diffMs <= 0) return { text: "RES!", level: "critical" };
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days === 0) return { text: `${hours}h⚡`, level: "critical" };
  if (days <= 2) return { text: `${days}d⚠ `, level: "warn" };
  if (days <= 7) return { text: `  ${days}d `, level: "warn" };
  if (days > 30) return { text: `${Math.floor(days / 30)}mo `, level: "ok" };
  return { text: `${days.toString().padStart(2, " ")}d  `, level: "ok" };
}

/** WS connection dot: ● connected, ○ connecting, · disconnected */
function wsStatusDot(status: string): { char: string; level: "ok" | "warn" | "off" } {
  if (status === "connected") return { char: "●", level: "ok" };
  if (status === "connecting" || status === "reconnecting") return { char: "○", level: "warn" };
  return { char: "·", level: "off" };
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;
const LOAD_MORE_SIZE = 50;
/** Start prefetching when cursor is this many rows from the bottom */
const PRELOAD_AHEAD = 10;

export interface CategoryDef {
  id: string;
  label: string;
  apiValue: string;
  /** True for live/real-time feeds that don't support pagination */
  live?: boolean;
  /** True for client-side virtual categories (no separate API call needed) */
  virtual?: boolean;
  /** Whether this category has sub-categories */
  hasSubCategories?: boolean;
  /** Parent category ID for sub-categories */
  parentId?: string;
}

export const SUB_CATEGORIES: Record<string, CategoryDef[]> = {
  Sports: [
    { id: "basketball", label: "NBA", apiValue: "basketball", parentId: "Sports" },
    { id: "nfl", label: "NFL", apiValue: "nfl", parentId: "Sports" },
    { id: "soccer", label: "Soccer", apiValue: "soccer", parentId: "Sports" },
    { id: "mlb", label: "MLB", apiValue: "mlb", parentId: "Sports" },
    { id: "nhl", label: "NHL", apiValue: "nhl", parentId: "Sports" },
    { id: "boxing-mma", label: "MMA", apiValue: "boxing-mma", parentId: "Sports" },
    { id: "tennis", label: "Tennis", apiValue: "tennis", parentId: "Sports" },
    { id: "golf", label: "Golf", apiValue: "golf", parentId: "Sports" },
    { id: "football", label: "CFB", apiValue: "football", parentId: "Sports" },
    { id: "esports", label: "Esports", apiValue: "esports", parentId: "Sports" },
    { id: "racing", label: "Racing", apiValue: "racing", parentId: "Sports" },
    { id: "olympics", label: "Olympics", apiValue: "olympics", parentId: "Sports" },
  ],
  Politics: [
    { id: "elections", label: "Elections", apiValue: "elections", parentId: "Politics" },
    { id: "trump", label: "Trump", apiValue: "trump", parentId: "Politics" },
    { id: "biden", label: "Biden", apiValue: "biden", parentId: "Politics" },
    { id: "us-politics", label: "US Pol", apiValue: "us-politics", parentId: "Politics" },
    { id: "global-politics", label: "Global", apiValue: "global-politics", parentId: "Politics" },
    { id: "courts", label: "Courts", apiValue: "courts", parentId: "Politics" },
    { id: "polls", label: "Polls", apiValue: "polls", parentId: "Politics" },
  ],
  Crypto: [
    { id: "bitcoin", label: "Bitcoin", apiValue: "bitcoin", parentId: "Crypto" },
    { id: "ethereum", label: "Ethereum", apiValue: "ethereum", parentId: "Crypto" },
    { id: "solana", label: "Solana", apiValue: "solana", parentId: "Crypto" },
    { id: "defi", label: "DeFi", apiValue: "defi", parentId: "Crypto" },
  ],
  Business: [
    { id: "economy", label: "Economy", apiValue: "economy", parentId: "Business" },
    { id: "fed-interest-rates", label: "Fed", apiValue: "fed-interest-rates", parentId: "Business" },
    { id: "finance", label: "Finance", apiValue: "finance", parentId: "Business" },
    { id: "tech", label: "Tech", apiValue: "tech", parentId: "Business" },
  ],
  Tech: [
    { id: "ai", label: "AI", apiValue: "ai", parentId: "Tech" },
    { id: "chat-bots", label: "Chatbots", apiValue: "chat-bots", parentId: "Tech" },
  ],
  Science: [
    { id: "climate-and-weather", label: "Climate", apiValue: "climate-and-weather", parentId: "Science" },
    { id: "space", label: "Space", apiValue: "space", parentId: "Science" },
  ],
  Entertainment: [
    { id: "film-and-tv", label: "Film/TV", apiValue: "film-and-tv", parentId: "Entertainment" },
    { id: "music", label: "Music", apiValue: "music", parentId: "Entertainment" },
    { id: "celebrities", label: "Celebs", apiValue: "celebrities", parentId: "Entertainment" },
  ],
};

export const CATEGORIES: CategoryDef[] = [
  { id: "trending",      label: "Hot🔥",   apiValue: "trending"       },
  { id: "all",           label: "All",      apiValue: "all"            },
  { id: "closing_soon",  label: "Soon⚠",   apiValue: "all",  virtual: true },
  { id: "watchlist_cat", label: "★Watch",  apiValue: "all",  virtual: true },
  { id: "sports_live",   label: "Live⚡",  apiValue: "sports_live", live: true },
  { id: "Sports",        label: "⚽Sports",  apiValue: "Sports", hasSubCategories: true },
  { id: "Politics",      label: "🏛Pol",    apiValue: "Politics", hasSubCategories: true },
  { id: "Crypto",        label: "₿Crypto",  apiValue: "Crypto", hasSubCategories: true },
  { id: "Business",      label: "💼Biz",    apiValue: "Business", hasSubCategories: true },
  { id: "AI",            label: "🤖AI",     apiValue: "AI"             },
  { id: "Tech",          label: "💻Tech",   apiValue: "Tech", hasSubCategories: true },
  { id: "Science",       label: "🔬Sci",    apiValue: "Science", hasSubCategories: true },
  { id: "Entertainment", label: "🎬Ent",    apiValue: "Entertainment", hasSubCategories: true },
  { id: "World",         label: "🌍World",  apiValue: "World"          },
  { id: "Health",        label: "🏥Health", apiValue: "Health"         },
  { id: "Climate",       label: "🌿Clim",  apiValue: "Climate"        },
];

// ─────────────────────────────────────────────────────────────────────────────
// API router
// ─────────────────────────────────────────────────────────────────────────────

async function fetchForCategory(
  apiValue: string,
  limit: number,
  offset: number,
  tagSlug?: string,
  showAll: boolean = false,
) {
  // If we have a tag slug (sub-category), use getMarketsByTag
  if (tagSlug) {
    return getMarketsByTag(tagSlug, limit);
  }

  // Use "All" APIs when showAllMarkets is enabled
  if (showAll) {
    switch (apiValue) {
      case "trending":
        return getTrendingMarkets(limit); // Trending doesn't have closed variant
      case "all":
        return getAllMarkets(limit, offset);
      case "sports_live":
        return getLiveSportsMarkets(); // Live sports doesn't have closed variant
      default:
        return getAllMarketsByCategory(apiValue, limit, offset);
    }
  }

  switch (apiValue) {
    case "trending":
      return getTrendingMarkets(limit);
    case "all":
      return getMarkets(limit, offset);
    case "sports_live":
      return getLiveSportsMarkets();
    default:
      return getMarketsByCategory(apiValue, limit, offset);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────────────────────

function probLabel(price: number, title: string): string {
  const pct = Math.round(price * 100);
  const short = title.length > 3 ? title.slice(0, 3).toUpperCase() : title.toUpperCase();
  return `${pct}%${short}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function MarketList() {
  const { theme } = useTheme();

  const activeCategory = marketListCategoryId;
  const setActiveCategory = setMarketListCategoryId;
  const activateCategory = (categoryId: string) => {
    setSelectedSubCategory(null);
    setActiveCategory(categoryId);
  };

  const [localLoading, setLocalLoading] = createSignal(false);
  const [loadingMore, setLoadingMore] = createSignal(false);
  const [hasMore, setHasMore] = createSignal(true);
  const [offsets, setOffsets] = createSignal<Record<string, number>>({});
  const [showAllMarkets, setShowAllMarkets] = createSignal(false); // Toggle to show closed markets
  // Category cache: stores markets per category key to avoid re-fetching
  const [categoryCache, setCategoryCache] = createSignal<Record<string, Market[]>>({});
  const [loadedFetchKey, setLoadedFetchKey] = createSignal("");

  // Virtual category filters applied on top of getFilteredMarkets()
  const displayMarkets = createMemo(() => getFilteredMarkets());

  // ── Sync selectedCategory signal (drives useMarketData category-aware fetch)
  createEffect(on(activeCategory, (cat) => {
    const def = CATEGORIES.find(c => c.id === cat);
    setSelectedCategory(def?.apiValue ?? "All");
    // Reset sub-category when changing main category
    setSelectedSubCategory(null);
  }));

  // Get current category definition
  const currentCategoryDef = () => CATEGORIES.find(c => c.id === activeCategory());

  // Check if current category has sub-categories
  const hasSubCategories = () => currentCategoryDef()?.hasSubCategories === true;

  // Get sub-categories for current category
  const currentSubCategories = () => {
    const cat = currentCategoryDef();
    if (!cat) return [];
    return SUB_CATEGORIES[cat.apiValue] || [];
  };

  // Active sub-category
  const activeSubCategory = selectedSubCategory;

  const effectiveSubCategory = createMemo(() => {
    const subCategoryId = activeSubCategory();
    if (!subCategoryId) return null;

    return currentSubCategories().some((entry) => entry.id === subCategoryId) ? subCategoryId : null;
  });

  const currentFetchKey = createMemo(() => (
    effectiveSubCategory() ? `${activeCategory()}:${effectiveSubCategory()}` : activeCategory()
  ));

  // ── Category switch with caching ─────────────────────────────────────────────
  createEffect(on([activeCategory, effectiveSubCategory], ([category, subCat]) => {
    const cat = CATEGORIES.find((c) => c.id === category);
    if (!cat) return;

    // Virtual categories only filter already-loaded data — no fresh fetch needed
    if (cat.virtual) {
      setHasMore(false);
      return;
    }

    // Use a key that includes both category and sub-category
    const fetchKey = subCat ? `${category}:${subCat}` : category;

    // Check cache first
    const cached = categoryCache()[fetchKey];
    if (cached && cached.length > 0) {
      // Use cached data
      setMarkets(cached);
      setOffsets((prev) => ({ ...prev, [fetchKey]: cached.length }));
      setHasMore(!cat.live && !subCat && cached.length >= PAGE_SIZE);
      setLoadedFetchKey(fetchKey);
      setLocalLoading(false);
      return;
    }

    let cancelled = false;
    setLocalLoading(true);
    setHasMore(true);
    setOffsets((prev) => ({ ...prev, [fetchKey]: 0 }));

    void (async () => {
      try {
        // If we have a sub-category, use its tag slug
        const tagSlug = subCat || undefined;
        const markets = await fetchForCategory(cat.apiValue, PAGE_SIZE, 0, tagSlug, showAllMarkets());
        if (cancelled) return;
        // Cache the results
        setCategoryCache((prev) => ({ ...prev, [fetchKey]: markets }));
        setMarkets(markets);
        setOffsets((prev) => ({ ...prev, [fetchKey]: markets.length }));
        setHasMore(!cat.live && !subCat && markets.length >= PAGE_SIZE);
        setLoadedFetchKey(fetchKey);
      } catch {
        // Keep existing data on error
      } finally {
        if (!cancelled) setLocalLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }));

  // ── Infinite scroll ────────────────────────────────────────────────────────
  createEffect(() => {
    const idx = highlightedIndex();
    const total = displayMarkets().length;
    if (
      total > 0
      && idx >= total - PRELOAD_AHEAD
      && !loadingMore()
      && !localLoading()
      && hasMore()
    ) {
      void loadMore();
    }
  });

  createEffect(on(displayMarkets, (markets) => {
    if (markets.length === 0) {
      if (highlightedIndex() !== 0) {
        setHighlightedIndex(0);
      }
      if (!isDetachedSelectedMarket() && appState.selectedMarketId !== null) {
        selectMarket(null);
      }
      return;
    }

    const selectedIndex = appState.selectedMarketId
      ? markets.findIndex((market) => market.id === appState.selectedMarketId)
      : -1;

    if (selectedIndex >= 0) {
      if (highlightedIndex() !== selectedIndex) {
        setHighlightedIndex(selectedIndex);
      }
      if (isDetachedSelectedMarket()) {
        selectMarket(markets[selectedIndex].id);
      }
      return;
    }

    if (isDetachedSelectedMarket()) {
      return;
    }

    const nextIndex = Math.max(0, Math.min(highlightedIndex(), markets.length - 1));
    navigateToIndex(nextIndex);
  }));

  createEffect(on([currentFetchKey, loadedFetchKey, () => appState.markets], ([fetchKey, loadedKey, markets]) => {
    const cat = CATEGORIES.find((entry) => entry.id === activeCategory());
    if (!cat || cat.virtual || fetchKey !== loadedKey) return;

    setCategoryCache((prev) => {
      const previousMarkets = prev[fetchKey] ?? [];
      let nextMarkets = markets;

      if (markets.length > 0 && markets.length <= PAGE_SIZE && previousMarkets.length > markets.length) {
        const refreshedIds = new Set(markets.map((market) => market.id));
        nextMarkets = [
          ...markets,
          ...previousMarkets.filter((market) => !refreshedIds.has(market.id)),
        ];
      }

      return { ...prev, [fetchKey]: nextMarkets };
    });
    setOffsets((prev) => ({
      ...prev,
      [fetchKey]: Math.max(prev[fetchKey] ?? 0, markets.length),
    }));
  }));

  async function loadMore() {
    const category = activeCategory();
    const subCat = effectiveSubCategory();
    const cat = CATEGORIES.find((c) => c.id === category);
    if (!cat || cat.live || cat.virtual || loadingMore() || Boolean(subCat)) return;

    setLoadingMore(true);
    const fetchKey = subCat ? `${category}:${subCat}` : category;
    const currentOffset = offsets()[fetchKey] ?? 0;

    try {
      const tagSlug = subCat || undefined;
      const markets = await fetchForCategory(cat.apiValue, LOAD_MORE_SIZE, currentOffset, tagSlug, showAllMarkets());
      if (markets.length > 0) {
        appendMarkets(markets);
        setOffsets((prev) => ({ ...prev, [fetchKey]: currentOffset + markets.length }));
        setHasMore(markets.length >= LOAD_MORE_SIZE);
      } else {
        setHasMore(false);
      }
    } catch {
      // silently ignore
    } finally {
      setLoadingMore(false);
    }
  }

  // ── WS status indicator ────────────────────────────────────────────────────
  const clobDot = () => wsStatusDot(wsConnectionStatus());
  const rtdsDot = () => wsStatusDot(rtdsConnected() ? "connected" : "disconnected");
  const userDot = () => wsStatusDot(userWsConnected() ? "connected" : "disconnected");

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <box flexDirection="column" width="100%">

      {/* ── Category bar ──────────────────────────────────────────────────── */}
      <box width="100%" flexDirection="row" height={1}>
        <For each={CATEGORIES}>
          {(cat, catIdx) => {
            const active = () => activeCategory() === cat.id;
            const needsSep = () => catIdx() === 2 || catIdx() === 4 || catIdx() === 5;
            return (
              <>
                <Show when={needsSep()}>
                  <text content="│" fg={theme.borderSubtle} />
                </Show>
                <box
                  height={1}
                  paddingLeft={1}
                  paddingRight={1}
                  backgroundColor={active() ? theme.accent : theme.backgroundPanel}
                  onMouseDown={() => activateCategory(cat.id)}
                >
                  <text
                    content={cat.label}
                    fg={active() ? theme.background : cat.live ? theme.error : cat.virtual ? theme.warning : theme.textMuted}
                  />
                </box>
              </>
            );
          }}
        </For>
        <box flexGrow={1} />
        {/* WS status indicators: CLOB · RTDS · User */}
        <text
          content={`${clobDot().char}C `}
          fg={clobDot().level === "ok" ? theme.success : clobDot().level === "warn" ? theme.warning : theme.borderSubtle}
        />
        <text
          content={`${rtdsDot().char}R `}
          fg={rtdsDot().level === "ok" ? theme.success : rtdsDot().level === "warn" ? theme.warning : theme.borderSubtle}
        />
        <text
          content={`${userDot().char}U `}
          fg={userDot().level === "ok" ? theme.success : userDot().level === "warn" ? theme.warning : theme.borderSubtle}
        />
        <Show when={localLoading() || loadingMore()}>
          <text content="◌ " fg={theme.textMuted} />
        </Show>
      </box>

      {/* ── Sub-category bar (shown when category has sub-categories) ───────────── */}
      <Show when={hasSubCategories()}>
        <box width="100%" flexDirection="row" height={1} backgroundColor={theme.backgroundPanel}>
          <text content="  " fg={theme.textMuted} />
          <For each={currentSubCategories()}>
            {(subCat) => {
                const active = () => effectiveSubCategory() === subCat.id;
              return (
                <box
                  height={1}
                  paddingLeft={1}
                  paddingRight={1}
                  backgroundColor={active() ? theme.accent : "transparent"}
                  onMouseDown={() => setSelectedSubCategory(active() ? null : subCat.id)}
                >
                  <text
                    content={subCat.label}
                    fg={active() ? theme.background : theme.textMuted}
                  />
                </box>
              );
            }}
          </For>
          <Show when={effectiveSubCategory()}>
            <text content=" │" fg={theme.textMuted} />
            <box
              height={1}
              paddingLeft={1}
              paddingRight={1}
              onMouseDown={() => setSelectedSubCategory(null)}
            >
              <text content="✕ Clear" fg={theme.error} />
            </box>
          </Show>
        </box>
      </Show>

      {/* ── Column headers ─────────────────────────────────────────────────── */}
      <box height={1} width="100%" backgroundColor={theme.backgroundPanel} flexDirection="row">
        <text content="  #" fg={theme.textMuted} width={4} />
        <text content=" Market" fg={theme.textMuted} width={19} />
        <text content="Cat " fg={theme.textMuted} width={5} />
        <text content=" Prob " fg={theme.textMuted} width={7} />
        <text content="Trend " fg={theme.textMuted} width={7} />
        <text content="Volume " fg={theme.textMuted} width={9} />
        <text content=" 24h%" fg={theme.textMuted} width={7} />
        <text content="Exp" fg={theme.textMuted} width={5} />
      </box>

      {/* ── Separator with count ──────────────────────────────────────────── */}
      <box height={1} width="100%">
        <text
          content={`─── ${displayMarkets().length} markets ` + "─".repeat(Math.max(0, 50 - displayMarkets().length.toString().length))}
          fg={theme.borderSubtle}
        />
      </box>

      {/* ── Watchlist filter banner ───────────────────────────────────────── */}
      <Show when={watchlistState.filterActive}>
        <box height={1} paddingLeft={1} backgroundColor={theme.accentMuted}>
          <text content="★ Watchlist filter active · [F] to disable" fg={theme.accent} />
        </box>
      </Show>

      {/* ── Market rows ───────────────────────────────────────────────────── */}
      <scrollbox flexGrow={1} width="100%">
        <Show
          when={!appState.loading && !localLoading()}
          fallback={
            <box padding={1}>
              <text content="◌ Loading markets…" fg={theme.textMuted} />
            </box>
          }
        >
          <Show
            when={displayMarkets().length > 0}
            fallback={
              <box padding={1}>
                <text
                  content={
                    activeCategory() === "closing_soon"
                      ? "No markets closing within 7 days"
                      : activeCategory() === "watchlist_cat"
                        ? "No markets in watchlist (X to add)"
                        : "No markets found"
                  }
                  fg={theme.textMuted}
                />
              </box>
            }
          >
            <For each={displayMarkets()}>
              {(market, index) => {
                const isHighlighted = () => index() === highlightedIndex();
                const watched = () => isWatched(market.id);

                // Best leading outcome from static data
                const staticLead = market.outcomes.length > 0
                  ? market.outcomes.reduce((b, o) => (o.price > b.price ? o : b))
                  : null;

                // Overlay live WS price if available for the leading token
                const livePrice = () => staticLead ? getLastPrice(staticLead.id) : undefined;
                const leadPrice = () => livePrice() ?? staticLead?.price ?? 0;
                const isLive = () => livePrice() !== undefined;

                const probStr = () => {
                  if (!staticLead) return " --  ";
                  const pct = Math.round(leadPrice() * 100);
                  const short = staticLead.title.length > 3
                    ? staticLead.title.slice(0, 3).toUpperCase()
                    : staticLead.title.toUpperCase();
                  return `${pct}%${short}`;
                };

                const probFg = () => {
                  if (isHighlighted()) return theme.highlightText;
                  if (!staticLead) return theme.textMuted;
                  if (leadPrice() >= 0.66) return theme.success;
                  if (leadPrice() <= 0.34) return theme.error;
                  return theme.warning;
                };

                const isSports =
                  activeCategory() === "sports_live" || activeCategory() === "Sports"
                  || (market.category ?? "").toLowerCase().includes("sport");

                // Live sports score for this market (if any token maps to a game)
                const sportsScore = () => {
                  if (!isSports) return null;
                  const scores = sportsScores();
                  if (market.slug && scores[market.slug]) {
                    return scores[market.slug];
                  }
                  // Match by any token id or market id
                  const key = Object.keys(scores).find(k =>
                    k === market.id || market.outcomes.some(o => o.id === k) || scores[k]?.slug === market.slug
                  );
                  return key ? scores[key] : null;
                };

                const expiry = () => formatExpiry(market.resolutionDate);

                // Tint rows closing within 3 days
                const rowBg = () => {
                  if (isHighlighted()) return theme.highlight;
                  if (market.resolutionDate) {
                    const msLeft = market.resolutionDate.getTime() - Date.now();
                    if (msLeft > 0 && msLeft < 3 * 24 * 60 * 60 * 1000) return theme.warningMuted;
                  }
                  return undefined;
                };

                const catBadge = getCategoryBadge(market.category);

                // Trend: for sports show live score if available, else sparkline
                const trendStr = () => {
                  const score = sportsScore();
                  if (score) {
                    const h = String(score.homeScore ?? 0).padStart(2);
                    const a = String(score.awayScore ?? 0).padStart(2);
                    return `${h}-${a}`;
                  }
                  return isSports && activeCategory() === "sports_live"
                    ? "⚡" + generateMiniSparkline(market.change24h, 5)
                    : generateMiniSparkline(market.change24h);
                };

                return (
                  <box
                    width="100%"
                    flexDirection="row"
                    backgroundColor={rowBg()}
                    onMouseDown={() => navigateToIndex(index())}
                  >
                    {/* Selection / watchlist indicator */}
                    <text
                      content={isHighlighted() ? "▶" : watched() ? "★" : " "}
                      fg={isHighlighted() ? theme.highlightText : watched() ? theme.accent : theme.textMuted}
                      width={2}
                    />

                    {/* Row index */}
                    <text
                      content={(index() + 1).toString().padStart(2)}
                      fg={isHighlighted() ? theme.highlightText : theme.textMuted}
                      width={3}
                    />

                    {/* Title */}
                    <text
                      content={truncateString(market.title, 18)}
                      fg={isHighlighted() ? theme.highlightText : theme.text}
                      width={19}
                    />

                    {/* Category badge (emoji + 3 chars) */}
                    <text
                      content={catBadge.slice(-4)}
                      fg={isHighlighted() ? theme.highlightText : theme.primary}
                      width={5}
                    />

                    {/* Probability — ⚡ prefix if live WS data */}
                    <text
                      content={(isLive() ? "⚡" : " ") + probStr().padStart(5)}
                      fg={probFg()}
                      width={7}
                    />

                    {/* Trend sparkline or live score */}
                    <text
                      content={trendStr()}
                      fg={
                        isHighlighted()
                          ? theme.highlightText
                          : sportsScore()
                            ? theme.accent
                            : market.change24h > 0
                              ? theme.success
                              : market.change24h < 0
                                ? theme.error
                                : theme.textMuted
                      }
                      width={7}
                    />

                    {/* Volume */}
                    <text
                      content={formatVolume(market.volume24h).padStart(8)}
                      fg={isHighlighted() ? theme.highlightText : theme.textMuted}
                      width={9}
                    />

                    {/* 24h change */}
                    <text
                      content={formatChange(market.change24h).padStart(6)}
                      fg={
                        isHighlighted()
                          ? theme.highlightText
                          : market.change24h >= 0
                            ? theme.success
                            : theme.error
                      }
                      width={7}
                    />

                    {/* Expiry */}
                    <text
                      content={expiry().text}
                      fg={
                        isHighlighted()
                          ? theme.highlightText
                          : expiry().level === "critical"
                            ? theme.error
                            : expiry().level === "warn"
                              ? theme.warning
                              : theme.textMuted
                      }
                      width={5}
                    />
                  </box>
                );
              }}
            </For>

            {/* ── Pagination sentinel ─────────────────────────────────── */}
            <Show when={hasMore() || loadingMore()}>
              <box height={1} width="100%">
                <text
                  content={
                    loadingMore()
                      ? "  ◌ Loading more markets…"
                      : `  ─── ${offsets()[effectiveSubCategory() ? `${activeCategory()}:${effectiveSubCategory()}` : activeCategory()] ?? 0} loaded · ↓ for more ───`
                  }
                  fg={theme.textMuted}
                />
              </box>
            </Show>

            <Show when={!hasMore() && !loadingMore() && displayMarkets().length > 0}>
              <box height={1} width="100%">
                <text
                  content={`  ─── all ${displayMarkets().length} markets loaded ───`}
                  fg={theme.borderSubtle}
                />
              </box>
            </Show>
          </Show>
        </Show>
      </scrollbox>
    </box>
  );
}
