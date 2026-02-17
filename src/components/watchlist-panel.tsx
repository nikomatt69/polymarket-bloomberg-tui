import { For, Show, createSignal, createEffect } from "solid-js";
import { useTheme } from "../context/theme";
import { watchlistState, addToWatchlist, removeFromWatchlist, toggleWatchlistFilter } from "../hooks/useWatchlist";
import { appState, selectMarket, highlightedIndex, navigateToIndex } from "../state";

function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len - 1) + "…" : str;
}

export function WatchlistPanel() {
  const { theme } = useTheme();
  const [selectedIdx, setSelectedIdx] = createSignal(0);

  const watchedMarkets = () => 
    appState.markets.filter(m => watchlistState.marketIds.includes(m.id));

  const handleKeyDown = (key: string) => {
    const markets = watchedMarkets();
    if (markets.length === 0) return;

    if (key === "up" || key === "k") {
      setSelectedIdx(i => Math.max(0, i - 1));
    } else if (key === "down" || key === "j") {
      setSelectedIdx(i => Math.min(markets.length - 1, i + 1));
    } else if (key === "enter") {
      const market = markets[selectedIdx()];
      if (market) {
        selectMarket(market.id);
      }
    } else if (key === "d" || key === "Delete") {
      const market = markets[selectedIdx()];
      if (market) {
        removeFromWatchlist(market.id);
        if (selectedIdx() >= markets.length - 1) {
          setSelectedIdx(i => Math.max(0, i - 1));
        }
      }
    }
  };

  return (
    <box
      position="absolute"
      top={2}
      left="10%"
      width="80%"
      height={20}
      backgroundColor={theme.backgroundPanel}
      flexDirection="column"
      zIndex={160}
    >
      <box height={1} width="100%" backgroundColor={theme.primary} flexDirection="row">
        <text content=" WATCHLIST " fg={theme.highlightText} width={14} />
        <box flexGrow={1} />
        <text 
          content={watchlistState.filterActive ? " [FILTER ON] " : " [ALL MARKETS] "} 
          fg={watchlistState.filterActive ? theme.success : theme.textMuted} 
        />
        <text content={` ${watchedMarkets().length} markets `} fg={theme.highlightText} />
        <text content=" [ESC] Close " fg={theme.highlightText} width={14} />
      </box>

      <box flexDirection="column" flexGrow={1} paddingLeft={1} paddingTop={1}>
        <Show
          when={watchedMarkets().length > 0}
          fallback={
            <box flexGrow={1} justifyContent="center" alignItems="center">
              <text content="No markets in watchlist" fg={theme.textMuted} />
              <text content="" />
              <text content="Press (W) on any market to add it" fg={theme.textMuted} />
            </box>
          }
        >
          <box flexDirection="row" width="100%">
            <text content="#" fg={theme.textMuted} width={3} />
            <text content="MARKET" fg={theme.textMuted} width={40} />
            <text content="VOLUME" fg={theme.textMuted} width={12} />
            <text content="24H %" fg={theme.textMuted} width={10} />
            <text content="OUTCOMES" fg={theme.textMuted} width={10} />
          </box>

          <scrollbox flexGrow={1} width="100%">
            <For each={watchedMarkets()}>
              {(market, i) => (
                <box 
                  flexDirection="row" 
                  width="100%"
                >
                  <text 
                    content={selectedIdx() === i() ? "▶" : " "} 
                    fg={selectedIdx() === i() ? theme.accent : theme.text} 
                    width={3} 
                  />
                  <text 
                    content={truncate(market.title, 39)} 
                    fg={selectedIdx() === i() ? theme.textBright : theme.text} 
                    width={40} 
                  />
                  <text 
                    content={`$${(market.volume24h / 1000).toFixed(1)}K`.padStart(11, " ")} 
                    fg={theme.textMuted} 
                    width={12} 
                  />
                  <text 
                    content={`${market.change24h >= 0 ? "+" : ""}${market.change24h.toFixed(1)}%`.padStart(9, " ")} 
                    fg={market.change24h >= 0 ? theme.success : theme.error} 
                    width={10} 
                  />
                  <text 
                    content={`${market.outcomes?.length || 2}`} 
                    fg={theme.textMuted} 
                    width={10} 
                  />
                </box>
              )}
            </For>
          </scrollbox>
        </Show>

        <text content="" />
        <text content="  [ENTER] Select  [D] Remove  [F] Toggle Filter  ↑↓ Navigate" fg={theme.textMuted} />
      </box>
    </box>
  );
}
