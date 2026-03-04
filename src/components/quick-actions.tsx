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
    >
      {/* Quick Actions Row */}
      <box flexDirection="row" height={1} paddingLeft={1}>
        <text content="◈ " fg={theme.accent} />

        {/* Action buttons with colored key highlights */}
        <box flexDirection="row" paddingRight={1}>
          <text content="[" fg={theme.borderSubtle} />
          <text content="O" fg={theme.success} />
          <text content="] Buy" fg={theme.textMuted} />
        </box>
        <text content=" │ " fg={theme.borderSubtle} />
        <box flexDirection="row" paddingRight={1}>
          <text content="[" fg={theme.borderSubtle} />
          <text content="S" fg={theme.error} />
          <text content="] Sell" fg={theme.textMuted} />
        </box>
        <text content=" │ " fg={theme.borderSubtle} />
        <box flexDirection="row" paddingRight={1}>
          <text content="[" fg={theme.borderSubtle} />
          <text content="X" fg={theme.accent} />
          <text content="] Watch" fg={theme.textMuted} />
        </box>
        <text content=" │ " fg={theme.borderSubtle} />
        <box flexDirection="row" paddingRight={1}>
          <text content="[" fg={theme.borderSubtle} />
          <text content="H" fg={theme.primary} />
          <text content="] Orders" fg={theme.textMuted} />
        </box>
        <text content=" │ " fg={theme.borderSubtle} />
        <box flexDirection="row" paddingRight={1}>
          <text content="[" fg={theme.borderSubtle} />
          <text content="Enter" fg={theme.primary} />
          <text content="] AI" fg={theme.textMuted} />
        </box>

        <box flexGrow={1} />

        {/* Selected Market Quick Info */}
        <Show when={selectedMarket()}>
          {(market: () => Market | undefined) => (
            <Show when={market()}>
              {(m: () => Market) => {
                const price = m().outcomes[0]?.price ?? 0;
                const pricePct = (price * 100).toFixed(1);
                const changeDir = m().change24h >= 0 ? "▲" : "▼";
                return (
                  <box flexDirection="row">
                    <text content="◈ " fg={theme.accent} />
                    <text content={m().title.slice(0, 24)} fg={theme.text} />
                    <text content=" " />
                    <text content={`${pricePct}¢`} fg={m().change24h >= 0 ? theme.success : theme.error} />
                    <text content=" " />
                    <text content={changeDir} fg={m().change24h >= 0 ? theme.success : theme.error} />
                    <text content=" " />
                  </box>
                );
              }}
            </Show>
          )}
        </Show>
      </box>

      {/* Market Ticker Row */}
      <box flexDirection="row" height={1} paddingLeft={1}>
        <text content="▲HOT " fg={theme.accent} />
        <For each={topMarkets()}>
          {(m: Market, idx: () => number) => (
            <box flexDirection="row">
              <text content={`${idx() + 1}.`} fg={theme.textMuted} />
              <text content={m.title.slice(0, 14)} fg={theme.text} />
              <text content=" " />
              <text content={m.change24h >= 0 ? "▲" : "▼"} fg={m.change24h >= 0 ? theme.success : theme.error} />
              <text
                content={fmtPct(m.change24h)}
                fg={m.change24h >= 0 ? theme.success : theme.error}
              />
              <text content=" │ " fg={theme.borderSubtle} />
            </box>
          )}
        </For>

        <box flexGrow={1} />

        <Show when={positionsState.positions.length > 0}>
          <text content={`Pos:${positionsState.positions.length} `} fg={theme.textMuted} />
        </Show>
        <Show when={watchlistState.marketIds.length > 0}>
          <text content="★" fg={theme.warning} />
          <text content={`${watchlistState.marketIds.length} `} fg={theme.textMuted} />
        </Show>
      </box>
    </box>
  );
}
