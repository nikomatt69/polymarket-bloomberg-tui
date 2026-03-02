/**
 * QuickActions — Docked action bar for fast access to markets and AI suggestions
 * Can be positioned at bottom or as sidebar
 */

import { createMemo, Show, For } from "solid-js";
import { useTheme } from "../context/theme";
import { appState, getSelectedMarket } from "../state";
import { positionsState } from "../hooks/usePositions";
import { watchlistState } from "../hooks/useWatchlist";
import { trendArrow, fmtNumber, fmtPct } from "../utils/charts";
import type { Market } from "../types/market";

export function QuickActions() {
  const { theme } = useTheme();

  const topMarkets = createMemo(() => {
    return [...appState.markets]
      .sort((a, b) => b.volume24h - a.volume24h)
      .slice(0, 5);
  });

  const recentPositions = createMemo(() => {
    return positionsState.positions.slice(0, 3);
  });

  const selectedMarket = createMemo(() => getSelectedMarket());

  return (
    <box
      flexDirection="column"
      width="100%"
      backgroundColor={theme.backgroundPanel}
      paddingTop={0}
    >
      {/* Quick Actions Row */}
      <box flexDirection="row" height={1} paddingLeft={1}>
        <text content="◈ QUICK: " fg={theme.accent} />
        
        <box flexDirection="row" paddingLeft={1}>
          <text content="[" fg={theme.textMuted} />
          <text content="O" fg={theme.success} />
          <text content="] Buy" fg={theme.text} />
        </box>
        
        <box flexDirection="row" paddingLeft={2}>
          <text content="[" fg={theme.textMuted} />
          <text content="S" fg={theme.error} />
          <text content="] Sell" fg={theme.text} />
        </box>
        
        <box flexDirection="row" paddingLeft={2}>
          <text content="[" fg={theme.textMuted} />
          <text content="X" fg={theme.accent} />
          <text content="] Watch" fg={theme.text} />
        </box>
        
        <box flexDirection="row" paddingLeft={2}>
          <text content="[" fg={theme.textMuted} />
          <text content="Enter" fg={theme.primary} />
          <text content="] AI Chat" fg={theme.text} />
        </box>

        <box flexGrow={1} />

        {/* Selected Market Quick Info */}
        <Show when={selectedMarket()}>
          {(market: () => Market | undefined) => (
            <Show when={market()}>
              {(m: () => Market) => (
                <box flexDirection="row">
                  <text content="◈ " fg={theme.accent} />
                  <text content={m().title.slice(0, 25)} fg={theme.text} />
                  <text content=" " />
                  <text 
                    content={`${(m().outcomes[0]?.price * 100).toFixed(1)}¢`} 
                    fg={m().change24h >= 0 ? theme.success : theme.error} 
                  />
                  <text content=" " />
                  <text 
                    content={trendArrow(m().outcomes[0]?.price || 0, (m().outcomes[0]?.price || 0) - (m().change24h / 100))}
                    fg={m().change24h >= 0 ? theme.success : theme.error}
                  />
                </box>
              )}
            </Show>
          )}
        </Show>
      </box>

      {/* Market Ticker Row */}
      <box flexDirection="row" height={1} paddingLeft={1}>
        <text content="TRENDING: " fg={theme.textMuted} />
        
        <For each={topMarkets()}>
          {(m: Market, idx: () => number) => (
            <box flexDirection="row" paddingRight={2}>
              <text content={`${idx() + 1}.`} fg={theme.textMuted} />
              <text content={m.title.slice(0, 15)} fg={theme.text} />
              <text content=" " />
              <text 
                content={`${fmtPct(m.change24h)}`}
                fg={m.change24h >= 0 ? theme.success : theme.error}
              />
              <text content=" │" fg={theme.borderSubtle} />
            </box>
          )}
        </For>

        <box flexGrow={1} />

        {/* Position Count */}
        <Show when={positionsState.positions.length > 0}>
          <text content={`Pos: ${positionsState.positions.length}`} fg={theme.textMuted} />
          <text content=" │" fg={theme.borderSubtle} />
        </Show>

        {/* Watchlist Count */}
        <Show when={watchlistState.marketIds.length > 0}>
          <text content={`Watch: ${watchlistState.marketIds.length}`} fg={theme.accent} />
        </Show>
      </box>
    </box>
  );
}
