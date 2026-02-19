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
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 30;
const LOAD_MORE_SIZE = 20;
/** Start prefetching when cursor is this many rows from the bottom */
const PRELOAD_AHEAD = 10;

interface CategoryDef {
  id: string;
  label: string;
  apiValue: string;
  /** True for live/real-time feeds that don't support pagination */
  live?: boolean;
}

const CATEGORIES: CategoryDef[] = [
  { id: "trending",      label: "Hot",      apiValue: "trending"       },
  { id: "all",           label: "All",      apiValue: "all"            },
  { id: "sports_live",   label: "Live ⚡",  apiValue: "sports_live", live: true },
  { id: "Sports",        label: "Sports",   apiValue: "Sports"         },
  { id: "Politics",      label: "Politics", apiValue: "Politics"       },
  { id: "Crypto",        label: "Crypto",   apiValue: "Crypto"         },
  { id: "Business",      label: "Biz",      apiValue: "Business"       },
  { id: "AI",            label: "AI",       apiValue: "AI"             },
  { id: "Tech",          label: "Tech",     apiValue: "Tech"           },
  { id: "Science",       label: "Science",  apiValue: "Science"        },
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
// Helpers
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

  const [activeCategory, setActiveCategory] = createSignal("trending");
  const [loading, setLoading] = createSignal(false);
  const [loadingMore, setLoadingMore] = createSignal(false);
  const [hasMore, setHasMore] = createSignal(true);
  /** How many items have been fetched for each category so far */
  const [offsets, setOffsets] = createSignal<Record<string, number>>({});

  // Respects search + watchlist on top of the category-scoped loaded set
  const displayMarkets = createMemo(() => getFilteredMarkets());

  // ── Category switch ────────────────────────────────────────────────────────
  createEffect(on(activeCategory, (category) => {
    const cat = CATEGORIES.find((c) => c.id === category);
    if (!cat) return;

    let cancelled = false;
    setLoading(true);
    setHasMore(true);
    setOffsets((prev) => ({ ...prev, [category]: 0 }));

    void (async () => {
      try {
        const markets = await fetchForCategory(cat.apiValue, PAGE_SIZE, 0);
        if (cancelled) return;
        setMarkets(markets);
        setOffsets((prev) => ({ ...prev, [category]: markets.length }));
        // Live feeds don't support cursor pagination
        setHasMore(!cat.live && markets.length >= PAGE_SIZE);
      } catch {
        // Keep existing data on error
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }));

  // ── Infinite scroll: auto-load next page when cursor nears the end ─────────
  createEffect(() => {
    const idx = highlightedIndex();
    const total = displayMarkets().length;
    if (
      total > 0
      && idx >= total - PRELOAD_AHEAD
      && !loadingMore()
      && !loading()
      && hasMore()
    ) {
      void loadMore();
    }
  });

  async function loadMore() {
    const category = activeCategory();
    const cat = CATEGORIES.find((c) => c.id === category);
    if (!cat || cat.live || loadingMore()) return;

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
          {(cat) => {
            const active = () => activeCategory() === cat.id;
            return (
              <box
                height={1}
                paddingLeft={1}
                paddingRight={1}
                backgroundColor={active() ? theme.accent : theme.backgroundPanel}
                onMouseDown={() => setActiveCategory(cat.id)}
              >
                <text
                  content={cat.label}
                  fg={active() ? theme.background : cat.live ? theme.error : theme.textMuted}
                />
              </box>
            );
          }}
        </For>
        <box flexGrow={1} />
        <Show when={loading() || loadingMore()}>
          <text content="◌ " fg={theme.textMuted} />
        </Show>
      </box>

      {/* ── Column headers ────────────────────────────────────────────────── */}
      <box height={1} width="100%" backgroundColor={theme.backgroundPanel} flexDirection="row">
        <text content="   #" fg={theme.textMuted} width={4} />
        <text content="  Market" fg={theme.textMuted} width={27} />
        <text content="Prob  " fg={theme.textMuted} width={7} />
        <text content=" Volume" fg={theme.textMuted} width={9} />
        <text content="  24h%" fg={theme.textMuted} width={7} />
      </box>

      {/* ── Separator ─────────────────────────────────────────────────────── */}
      <box height={1} width="100%">
        <text
          content="────────────────────────────────────────────────────────────────"
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
          when={!appState.loading && !loading()}
          fallback={
            <box padding={1}>
              <text content="Loading markets…" fg={theme.textMuted} />
            </box>
          }
        >
          <Show
            when={displayMarkets().length > 0}
            fallback={
              <box padding={1}>
                <text content="No markets found" fg={theme.textMuted} />
              </box>
            }
          >
            <For each={displayMarkets()}>
              {(market, index) => {
                const isHighlighted = () => index() === highlightedIndex();
                const watched = () => isWatched(market.id);

                // Leading outcome (highest price) — for probability display
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

                return (
                  <box
                    width="100%"
                    flexDirection="row"
                    backgroundColor={isHighlighted() ? theme.highlight : undefined}
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

                    {/* Live badge */}
                    <text
                      content={isLiveSports && activeCategory() === "sports_live" ? "⚡" : " "}
                      fg={theme.error}
                      width={2}
                    />

                    {/* Title */}
                    <text
                      content={truncateString(market.title, 23)}
                      fg={isHighlighted() ? theme.highlightText : theme.text}
                      width={24}
                    />

                    {/* Probability */}
                    <text
                      content={probStr.padStart(7)}
                      fg={probFg()}
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
