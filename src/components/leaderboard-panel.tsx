/**
 * Leaderboard Panel — trader and builder rankings
 */

import { createSignal, onMount, Show, For, createEffect } from "solid-js";
import { useTheme } from "../context/theme";
import {
  fetchTraderLeaderboard,
  fetchBuilderLeaderboard,
  TraderLeaderboardEntry,
  BuilderEntry,
  TraderLeaderboardResponse,
  BuilderLeaderboardResponse,
} from "../api/data";

type LeaderboardTab = "traders" | "builders";

export function LeaderboardPanel() {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = createSignal<LeaderboardTab>("traders");
  const [timeframe, setTimeframe] = createSignal<"daily" | "weekly" | "monthly" | "allTime">("weekly");
  const [traders, setTraders] = createSignal<TraderLeaderboardEntry[]>([]);
  const [builders, setBuilders] = createSignal<BuilderEntry[]>([]);
  const [loading, setLoading] = createSignal(true);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab() === "traders") {
        const data = await fetchTraderLeaderboard(20, timeframe());
        if (data) setTraders(data.entries);
      } else {
        const data = await fetchBuilderLeaderboard(20, timeframe());
        if (data) setBuilders(data.entries);
      }
    } finally {
      setLoading(false);
    }
  };

  onMount(loadData);

  createEffect(() => {
    // Reload when tab or timeframe changes
    activeTab();
    timeframe();
    loadData();
  });

  const fmtVol = (n: number): string => {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
    return `$${n.toFixed(0)}`;
  };

  const fmtPnl = (n: number): string => {
    const prefix = n >= 0 ? "+" : "";
    return `${prefix}$${n.toFixed(2)}`;
  };

  return (
    <box
      position="absolute"
      left="20%"
      top="15%"
      width="60%"
      height="70%"
      flexDirection="column"
      backgroundColor={theme.background}
      borderColor={theme.border}
      zIndex={100}
    >
      {/* Header */}
      <box flexDirection="row" padding={1} backgroundColor={theme.primary}>
        <text content="LEADERBOARD" fg={theme.highlightText} />
        <box flexGrow={1} />
        <text content="[T]raders" fg={activeTab() === "traders" ? theme.accent : theme.textMuted} />
        <text content=" [B]uilders" fg={activeTab() === "builders" ? theme.accent : theme.textMuted} />
      </box>

      {/* Timeframe selector */}
      <box flexDirection="row" paddingX={1} paddingY={0} gap={1}>
        <text content="Timeframe:" fg={theme.textMuted} />
        <For each={["daily", "weekly", "monthly", "allTime"] as const}>
          {(tf) => (
            <text
              content={tf === "allTime" ? "All" : tf.charAt(0).toUpperCase() + tf.slice(1)}
              fg={timeframe() === tf ? theme.accent : theme.textMuted}
            />
          )}
        </For>
      </box>

      {/* Column headers */}
      <box flexDirection="row" paddingX={1} paddingY={0} gap={1} backgroundColor={theme.primary}>
        <text content="#" fg={theme.textMuted} width={3} />
        <text content="Address" fg={theme.textMuted} width={14} />
        <text content="Volume" fg={theme.textMuted} width={10} />
        <text content="P&L" fg={theme.textMuted} width={10} />
        <text content="Trades" fg={theme.textMuted} width={8} />
        <text content="Win%" fg={theme.textMuted} width={6} />
      </box>

      {/* Data rows */}
      <scrollbox flexGrow={1}>
        <Show when={!loading()} fallback={<box padding={1}><text content="Loading..." fg={theme.textMuted} /></box>}>
          <Show when={activeTab() === "traders"}>
            <For each={traders()}>
              {(trader) => (
                <box flexDirection="row" paddingX={1} gap={1}>
                  <text content={`#${trader.rank}`} fg={theme.textMuted} width={3} />
                  <text content={`${trader.address.slice(0, 10)}…`} fg={theme.text} width={14} />
                  <text content={fmtVol(trader.volume)} fg={theme.text} width={10} />
                  <text
                    content={fmtPnl(trader.realizedPnl)}
                    fg={trader.realizedPnl >= 0 ? theme.success : theme.error}
                    width={10}
                  />
                  <text content={String(trader.tradeCount)} fg={theme.text} width={8} />
                  <text
                    content={`${trader.winRate.toFixed(0)}%`}
                    fg={trader.winRate >= 50 ? theme.success : theme.error}
                    width={6}
                  />
                </box>
              )}
            </For>
          </Show>

          <Show when={activeTab() === "builders"}>
            <For each={builders()}>
              {(builder) => (
                <box flexDirection="row" paddingX={1} gap={1}>
                  <text content={`#${builder.rank}`} fg={theme.textMuted} width={3} />
                  <text content={builder.name || `${builder.address.slice(0, 8)}…`} fg={theme.text} width={14} />
                  <text content={fmtVol(builder.volume)} fg={theme.text} width={10} />
                  <text content={fmtVol(builder.revenue)} fg={theme.success} width={10} />
                  <text content={String(builder.tradeCount)} fg={theme.text} width={8} />
                  <text content={`${builder.uniqueTraders}`} fg={theme.text} width={6} />
                </box>
              )}
            </For>
          </Show>
        </Show>
      </scrollbox>

      {/* Footer */}
      <box padding={1} backgroundColor={theme.primary}>
        <text content="↑↓ Navigate  [T]ab  [D/W/M/A] Timeframe  [Esc] Close" fg={theme.textMuted} />
      </box>
    </box>
  );
}
