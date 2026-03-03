import { For, Show, createSignal } from "solid-js";
import { useTheme } from "../context/theme";
import { watchlistState, removeFromWatchlist, toggleWatchlistFilter } from "../hooks/useWatchlist";
import { appState, selectMarket, setWatchlistPanelOpen } from "../state";
import { PanelHeader, Separator } from "./ui/panel-components";

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
      <PanelHeader
        title="WATCHLIST"
        icon="★"
        subtitle={`${watchedMarkets().length} markets  │  Filter: ${watchlistState.filterActive ? "ON" : "OFF"}`}
        onClose={handleClose}
      >
        <box onMouseDown={toggleWatchlistFilter}>
          <text
            content={watchlistState.filterActive ? " ● FILTER ON " : " ○ Filter off "}
            fg={watchlistState.filterActive ? theme.success : theme.textMuted}
          />
        </box>
      </PanelHeader>

      {/* Column headers */}
      <box height={1} width="100%" flexDirection="row" backgroundColor={theme.backgroundPanel} paddingLeft={3}>
        <text content={"MARKET".padEnd(42)} fg={theme.textMuted} width={42} />
        <text content={"VOLUME".padStart(12)} fg={theme.textMuted} width={12} />
        <text content={"24H %".padStart(10)} fg={theme.textMuted} width={10} />
        <text content={"YES¢".padStart(7)} fg={theme.textMuted} width={7} />
      </box>

      <Separator type="heavy" />

      <box flexDirection="column" flexGrow={1}>
        <Show
          when={watchedMarkets().length > 0}
          fallback={
            <box flexGrow={1} paddingLeft={2} paddingTop={2}>
              <text content="★ No markets in watchlist yet" fg={theme.textMuted} />
              <text content="" />
              <text content="Press [X] while browsing markets to add them here." fg={theme.textMuted} />
              <text content="Press [F] to toggle watchlist filter mode." fg={theme.textMuted} />
            </box>
          }
        >
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
                      fg={isSelected() ? theme.highlightText : (market.outcomes?.[0]?.price ?? 0) > 0.6 ? theme.success : theme.textMuted}
                      width={7}
                    />
                  </box>
                );
              }}
            </For>
          </scrollbox>
        </Show>
      </box>

      {/* Footer */}
      <Separator type="light" />
      <box height={1} flexDirection="row" paddingLeft={2} backgroundColor={theme.backgroundPanel}>
        <text content="[↑↓] Navigate   " fg={theme.textMuted} />
        <text content="[Click] Select   " fg={theme.textMuted} />
        <box onMouseDown={() => {
          const market = watchedMarkets()[selectedIdx()];
          if (market) {
            removeFromWatchlist(market.id);
            setSelectedIdx(i => Math.max(0, i - 1));
          }
        }}>
          <text content="[D] Remove   " fg={theme.error} />
        </box>
        <box onMouseDown={toggleWatchlistFilter}>
          <text content="[F] Toggle Filter   " fg={theme.textMuted} />
        </box>
        <box onMouseDown={handleClose}>
          <text content="[ESC] Close" fg={theme.textMuted} />
        </box>
      </box>
    </box>
  );
}
