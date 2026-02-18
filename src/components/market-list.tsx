import { For, Show, createMemo, createSignal, createEffect } from "solid-js";
import { appState, highlightedIndex, getFilteredMarkets, navigateToIndex, setMarkets } from "../state";
import { formatVolume, formatChange, truncateString } from "../utils/format";
import { useTheme } from "../context/theme";
import { isWatched, watchlistState } from "../hooks/useWatchlist";
import { getMarketsByCategory, getTrendingMarkets } from "../api/polymarket";

const CATEGORIES = [
  { id: "trending", label: "Trending", emoji: "🔥" },
  { id: "politics", label: "Politics", emoji: "🏛️" },
  { id: "sports", label: "Sports", emoji: "⚽" },
  { id: "crypto", label: "Crypto", emoji: "₿" },
  { id: "economics", label: "Economics", emoji: "📈" },
  { id: "entertainment", label: "Entertainment", emoji: "🎬" },
  { id: "science", label: "Science", emoji: "🔬" },
];

export function MarketList() {
  const { theme } = useTheme();
  const [activeCategory, setActiveCategory] = createSignal("trending");
  const [loading, setLoading] = createSignal(false);

  // Fetch markets when category changes
  createEffect(() => {
    const category = activeCategory();
    if (category === "trending") return; // Already loaded

    setLoading(true);
    void (async () => {
      try {
        let markets;
        if (category === "all") {
          markets = await getTrendingMarkets(50);
        } else {
          markets = await getMarketsByCategory(category, 50);
        }
        if (markets.length > 0) {
          setMarkets(markets);
        }
      } catch (e) {
        console.error("Failed to fetch markets:", e);
      } finally {
        setLoading(false);
      }
    })();
  });

  const filterLabel = () => watchlistState.filterActive ? " [★WATCH]" : "";

  const handleCategoryClick = (categoryId: string) => {
    setActiveCategory(categoryId);
  };

  return (
    <box flexDirection="column" width="100%">
      {/* Category buttons */}
      <box width="100%" flexDirection="row" gap={0} height={1}>
        <For each={CATEGORIES}>
          {(cat) => (
            <box
              width={cat.id === "trending" ? 10 : 11}
              height={1}
              backgroundColor={activeCategory() === cat.id ? theme.accent : theme.backgroundPanel}
              onMouseDown={() => handleCategoryClick(cat.id)}
            >
              <text
                content={`${cat.emoji}`}
                fg={activeCategory() === cat.id ? theme.background : theme.textMuted}
              />
            </box>
          )}
        </For>
      </box>

      {/* Category labels */}
      <box width="100%" flexDirection="row" gap={0} height={1}>
        <For each={CATEGORIES}>
          {(cat) => (
            <box
              width={cat.id === "trending" ? 10 : 11}
              height={1}
              backgroundColor={activeCategory() === cat.id ? theme.accent : undefined}
              onMouseDown={() => handleCategoryClick(cat.id)}
            >
              <text
                content={cat.label}
                fg={activeCategory() === cat.id ? theme.background : theme.textMuted}
              />
            </box>
          )}
        </For>
      </box>

      {/* Separator */}
      <box height={1} width="100%" backgroundColor={theme.borderSubtle}>
        <text content="────────────────────────────────────────────────────────────────" fg={theme.border} />
      </box>

      {/* Loading indicator */}
      <Show when={loading()}>
        <text content="Loading markets..." fg={theme.accent} />
      </Show>

      {/* Watchlist indicator */}
      <Show when={watchlistState.filterActive}>
        <text content={`★ Watchlist filter active (F to toggle)${filterLabel()}`} fg={theme.accent} />
      </Show>

      {/* Market list */}
      <scrollbox flexGrow={1} width="100%" paddingLeft={1}>
        <Show
          when={!appState.loading && !loading()}
          fallback={
            <box padding={1}>
              <text content="Loading markets..." fg={theme.textMuted} />
            </box>
          }
        >
          <Show
            when={appState.markets.length > 0}
            fallback={
              <box padding={1}>
                <text content="No markets found" fg={theme.textMuted} />
              </box>
            }
          >
            <For each={appState.markets}>
              {(market, index) => {
                const isHighlighted = () => index() === highlightedIndex();
                const watched = () => isWatched(market.id);
                const changeStr = formatChange(market.change24h);
                const title = truncateString(market.title, 31);
                const volStr = formatVolume(market.volume24h);
                const cat = market.category || "general";

                return (
                  <box
                    width="100%"
                    backgroundColor={isHighlighted() ? theme.highlight : undefined}
                    onMouseDown={() => navigateToIndex(index())}
                  >
                    <text
                      content={isHighlighted() ? "▶" : " "}
                      fg={isHighlighted() ? theme.highlightText : theme.textMuted}
                      width={2}
                    />
                    <text
                      content={watched() ? "★" : " "}
                      fg={isHighlighted() ? theme.highlightText : theme.accent}
                      width={2}
                    />
                    <text
                      content={(index() + 1).toString().padStart(2, " ")}
                      fg={isHighlighted() ? theme.highlightText : theme.textMuted}
                      width={3}
                    />
                    <text
                      content={title}
                      fg={isHighlighted() ? theme.highlightText : theme.text}
                      width={33}
                    />
                    <text
                      content={`[${cat.slice(0,4).toUpperCase()}]`}
                      fg={isHighlighted() ? theme.highlightText : theme.textMuted}
                      width={7}
                    />
                    <text
                      content={volStr}
                      fg={isHighlighted() ? theme.highlightText : theme.textMuted}
                      width={10}
                    />
                    <text
                      content={changeStr}
                      fg={
                        isHighlighted()
                          ? theme.highlightText
                          : market.change24h >= 0
                            ? theme.success
                            : theme.error
                      }
                      width={8}
                    />
                  </box>
                );
              }}
            </For>
          </Show>
        </Show>
      </scrollbox>
    </box>
  );
}
