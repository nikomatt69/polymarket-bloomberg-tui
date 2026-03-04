/**
 * Market list panel with category tabs, pagination, and inline probability.
 *
 * Category switching clears and reloads markets (first PAGE_SIZE items).
 * When the keyboard cursor reaches within PRELOAD_AHEAD rows of the bottom,
 * the next page is automatically fetched and appended (infinite scroll).
 *
 * The displayed list is always the filtered view from getFilteredMarkets(),
 * which applies search-query and watchlist filters on top of the loaded set.
 */

import { For, Show, createMemo, createSignal, createEffect, on } from "solid-js";
import {
  appState,
  highlightedIndex,
  getFilteredMarkets,
  navigateToIndex,
  setMarkets,
  appendMarkets,
  marketListCategoryId,
  setMarketListCategoryId,
} from "../state";
import { formatVolume, formatChange, truncateString } from "../utils/format";
import { useTheme } from "../context/theme";
import { isWatched, watchlistState } from "../hooks/useWatchlist";
import {
  getMarketsByCategory,
  getTrendingMarkets,
  getMarkets,
  getLiveSportsMarkets,
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

/** 3-letter category badge label */
function getCategoryBadge(category: string | undefined): string {
  const cat = (category ?? "").toLowerCase();
  if (cat.includes("sport")) return "SPO";
  if (cat.includes("polit")) return "POL";
  if (cat.includes("crypto")) return "CRY";
  if (cat.includes("business") || cat.includes("econ")) return "BIZ";
  if (cat.includes("ai")) return " AI";
  if (cat.includes("tech")) return "TEC";
  if (cat.includes("science")) return "SCI";
  if (cat.includes("entertain")) return "ENT";
  return "GEN";
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

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 30;
const LOAD_MORE_SIZE = 20;
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
}

export const CATEGORIES: CategoryDef[] = [
  { id: "trending",      label: "Hot🔥",   apiValue: "trending"       },
  { id: "all",           label: "All",      apiValue: "all"            },
  { id: "closing_soon",  label: "Soon⚠",   apiValue: "all",  virtual: true },
  { id: "watchlist_cat", label: "★Watch",  apiValue: "all",  virtual: true },
  { id: "sports_live",   label: "Live⚡",  apiValue: "sports_live", live: true },
  { id: "Sports",        label: "Sports",   apiValue: "Sports"         },
  { id: "Politics",      label: "Politics", apiValue: "Politics"       },
  { id: "Crypto",        label: "Crypto",   apiValue: "Crypto"         },
  { id: "Business",      label: "Biz",      apiValue: "Business"       },
  { id: "AI",            label: "AI",       apiValue: "AI"             },
  { id: "Tech",          label: "Tech",     apiValue: "Tech"           },
  { id: "Science",       label: "Sci",      apiValue: "Science"        },
  { id: "Entertainment", label: "Ent",      apiValue: "Entertainment"  },
];

// ─────────────────────────────────────────────────────────────────────────────
// API router
// ─────────────────────────────────────────────────────────────────────────────

async function fetchForCategory(
  apiValue: string,
  limit: number,
  offset: number,
) {
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

  const [localLoading, setLocalLoading] = createSignal(false);
  const [loadingMore, setLoadingMore] = createSignal(false);
  const [hasMore, setHasMore] = createSignal(true);
  const [offsets, setOffsets] = createSignal<Record<string, number>>({});

  // Virtual category filters applied on top of getFilteredMarkets()
  const displayMarkets = createMemo(() => {
    const base = getFilteredMarkets();
    const cat = activeCategory();

    if (cat === "closing_soon") {
      const cutoff = Date.now() + 7 * 24 * 60 * 60 * 1000;
      return base.filter(m => m.resolutionDate && m.resolutionDate.getTime() < cutoff && !m.closed);
    }

    if (cat === "watchlist_cat") {
      return base.filter(m => isWatched(m.id));
    }

    return base;
  });

  // ── Category switch ────────────────────────────────────────────────────────
  createEffect(on(activeCategory, (category) => {
    const cat = CATEGORIES.find((c) => c.id === category);
    if (!cat) return;

    // Virtual categories only filter already-loaded data — no fresh fetch needed
    if (cat.virtual) {
      setHasMore(false);
      return;
    }

    let cancelled = false;
    setLocalLoading(true);
    setHasMore(true);
    setOffsets((prev) => ({ ...prev, [category]: 0 }));

    void (async () => {
      try {
        const markets = await fetchForCategory(cat.apiValue, PAGE_SIZE, 0);
        if (cancelled) return;
        setMarkets(markets);
        setOffsets((prev) => ({ ...prev, [category]: markets.length }));
        setHasMore(!cat.live && markets.length >= PAGE_SIZE);
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

  async function loadMore() {
    const category = activeCategory();
    const cat = CATEGORIES.find((c) => c.id === category);
    if (!cat || cat.live || cat.virtual || loadingMore()) return;

    setLoadingMore(true);
    const currentOffset = offsets()[category] ?? 0;

    try {
      const markets = await fetchForCategory(cat.apiValue, LOAD_MORE_SIZE, currentOffset);
      if (markets.length > 0) {
        appendMarkets(markets);
        setOffsets((prev) => ({ ...prev, [category]: currentOffset + markets.length }));
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
                  onMouseDown={() => setActiveCategory(cat.id)}
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
        <Show when={localLoading() || loadingMore()}>
          <text content="◌ " fg={theme.textMuted} />
        </Show>
      </box>

      {/* ── Column headers ─────────────────────────────────────────────────── */}
      <box height={1} width="100%" backgroundColor={theme.backgroundPanel} flexDirection="row">
        <text content="  #" fg={theme.textMuted} width={4} />
        <text content=" Market" fg={theme.textMuted} width={19} />
        <text content="Cat" fg={theme.textMuted} width={4} />
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

                const lead = market.outcomes.length > 0
                  ? market.outcomes.reduce((b, o) => (o.price > b.price ? o : b))
                  : null;

                const probStr = lead ? probLabel(lead.price, lead.title) : " --  ";

                const probFg = () => {
                  if (isHighlighted()) return theme.highlightText;
                  if (!lead) return theme.textMuted;
                  if (lead.price >= 0.66) return theme.success;
                  if (lead.price <= 0.34) return theme.error;
                  return theme.warning;
                };

                const isLiveSports =
                  activeCategory() === "sports_live"
                  || (market.category ?? "").toLowerCase().includes("sport");

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

                    {/* Category badge */}
                    <text
                      content={catBadge}
                      fg={isHighlighted() ? theme.highlightText : theme.primary}
                      width={4}
                    />

                    {/* Probability */}
                    <text
                      content={probStr.padStart(6)}
                      fg={probFg()}
                      width={7}
                    />

                    {/* Trend sparkline */}
                    <text
                      content={isLiveSports && activeCategory() === "sports_live" ? "⚡" + generateMiniSparkline(market.change24h, 5) : generateMiniSparkline(market.change24h)}
                      fg={isHighlighted() ? theme.highlightText : market.change24h > 0 ? theme.success : market.change24h < 0 ? theme.error : theme.textMuted}
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
                      : `  ─── ${offsets()[activeCategory()] ?? 0} loaded · ↓ for more ───`
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
