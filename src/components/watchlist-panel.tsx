import { For, Show, createSignal } from "solid-js";
import { useTheme } from "../context/theme";
import { watchlistState, removeFromWatchlist, toggleWatchlistFilter } from "../hooks/useWatchlist";
import { appState, selectMarket, setWatchlistPanelOpen } from "../state";

function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len - 1) + "…" : str;
}

export function WatchlistPanel() {
  const { theme } = useTheme();
  const [selectedIdx, setSelectedIdx] = createSignal(0);

  const watchedMarkets = () =>
    appState.markets.filter(m => watchlistState.marketIds.includes(m.id));

  const handleClose = () => setWatchlistPanelOpen(false);

  return (
    <box
      position="absolute"
      top={2}
      left="8%"
      width="84%"
      height={22}
      backgroundColor={theme.panelModal}
      flexDirection="column"
      zIndex={160}
    >
      {/* Header */}
      <box height={1} width="100%" backgroundColor={theme.primary} flexDirection="row">
        <text content=" ◈ WATCHLIST " fg={theme.highlightText} />
        <box flexGrow={1} />
        <box onMouseDown={toggleWatchlistFilter}>
          <text
            content={watchlistState.filterActive ? " [FILTER ON] " : " [FILTER OFF] "}
            fg={watchlistState.filterActive ? theme.success : theme.textMuted}
          />
        </box>
        <text content={` ${watchedMarkets().length} markets `} fg={theme.highlightText} />
        <box onMouseDown={handleClose}>
          <text content=" [ESC] ✕ " fg={theme.highlightText} />
        </box>
      </box>

      {/* Separator */}
      <box height={1} width="100%" backgroundColor={theme.primaryMuted} />

      <box flexDirection="column" flexGrow={1} paddingLeft={2} paddingTop={1}>
        <Show
          when={watchedMarkets().length > 0}
          fallback={
            <box flexGrow={1}>
              <text content="No markets in watchlist — press [X] on any market to add it" fg={theme.textMuted} />
            </box>
          }
        >
          {/* Column headers */}
          <box flexDirection="row" width="100%">
            <text content="   " fg={theme.textMuted} width={3} />
            <text content="MARKET" fg={theme.textMuted} width={42} />
            <text content="VOLUME" fg={theme.textMuted} width={12} />
            <text content="24H %" fg={theme.textMuted} width={10} />
            <text content="YES¢" fg={theme.textMuted} width={7} />
          </box>

          <scrollbox flexGrow={1} width="100%">
            <For each={watchedMarkets()}>
              {(market, i) => {
                const isSelected = () => selectedIdx() === i();
                return (
                  <box
                    flexDirection="row"
                    width="100%"
                    backgroundColor={isSelected() ? theme.highlight : undefined}
                    onMouseDown={() => {
                      setSelectedIdx(i());
                      selectMarket(market.id);
                    }}
                  >
                    <text content={isSelected() ? " ▶ " : "   "} fg={theme.primary} width={3} />
                    <text
                      content={truncate(market.title, 41)}
                      fg={isSelected() ? theme.highlightText : theme.text}
                      width={42}
                    />
                    <text
                      content={`$${(market.volume24h / 1000).toFixed(1)}K`.padStart(11, " ")}
                      fg={isSelected() ? theme.highlightText : theme.textMuted}
                      width={12}
                    />
                    <text
                      content={`${market.change24h >= 0 ? "+" : ""}${market.change24h.toFixed(1)}%`.padStart(9, " ")}
                      fg={market.change24h >= 0 ? theme.success : theme.error}
                      width={10}
                    />
                    <text
                      content={`${((market.outcomes?.[0]?.price ?? 0) * 100).toFixed(1)}¢`.padStart(6, " ")}
                      fg={isSelected() ? theme.highlightText : theme.textMuted}
                      width={7}
                    />
                  </box>
                );
              }}
            </For>
          </scrollbox>
        </Show>

        <text content="" />
        <box flexDirection="row" gap={3}>
          <text content="[↑↓] Navigate" fg={theme.textMuted} />
          <text content="[ENTER/Click] Select" fg={theme.textMuted} />
          <box onMouseDown={() => {
            const market = watchedMarkets()[selectedIdx()];
            if (market) {
              removeFromWatchlist(market.id);
              setSelectedIdx(i => Math.max(0, i - 1));
            }
          }}>
            <text content="[D] Remove" fg={theme.error} />
          </box>
          <box onMouseDown={toggleWatchlistFilter}>
            <text content="[F] Toggle Filter" fg={theme.textMuted} />
          </box>
          <box onMouseDown={handleClose}>
            <text content="[ESC] Close" fg={theme.textMuted} />
          </box>
        </box>
      </box>
    </box>
  );
}
