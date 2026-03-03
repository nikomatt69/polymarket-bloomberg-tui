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
} from "../api/data";
import { PanelHeader, Separator, LoadingState } from "./ui/panel-components";

type LeaderboardTab = "traders" | "builders";
type Timeframe = "daily" | "weekly" | "monthly" | "allTime";

const TIMEFRAMES: { key: Timeframe; label: string }[] = [
  { key: "daily",    label: "Day"  },
  { key: "weekly",   label: "Week" },
  { key: "monthly",  label: "Mon"  },
  { key: "allTime",  label: "All"  },
];

export function LeaderboardPanel() {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = createSignal<LeaderboardTab>("traders");
  const [timeframe, setTimeframe] = createSignal<Timeframe>("weekly");
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
    if (Math.abs(n) >= 1_000_000) return `${prefix}$${(n / 1_000_000).toFixed(1)}M`;
    if (Math.abs(n) >= 1_000) return `${prefix}$${(n / 1_000).toFixed(0)}K`;
    return `${prefix}$${n.toFixed(2)}`;
  };

  const rankMedal = (rank: number): string => {
    if (rank === 1) return "◆";
    if (rank === 2) return "◇";
    if (rank === 3) return "○";
    return " ";
  };

  const rankMedalColor = (rank: number) => {
    const { theme } = useTheme();
    if (rank === 1) return theme.warning;
    if (rank === 2) return theme.textMuted;
    if (rank === 3) return theme.accent;
    return theme.textMuted;
  };

  return (
    <box
      position="absolute"
      top={2}
      left="8%"
      width="84%"
      height={24}
      flexDirection="column"
      backgroundColor={theme.panelModal}
      zIndex={100}
    >
      {/* Header */}
      <PanelHeader
        title="LEADERBOARD"
        icon="◈"
        subtitle={`${activeTab() === "traders" ? "Top Traders" : "Top Builders"} · ${
          TIMEFRAMES.find(t => t.key === timeframe())?.label ?? ""}`}
      />

      {/* Tab + Timeframe row */}
      <box height={1} width="100%" backgroundColor={theme.backgroundPanel} flexDirection="row">
        <box
          paddingLeft={2}
          paddingRight={2}
          backgroundColor={activeTab() === "traders" ? theme.primary : undefined}
          onMouseDown={() => setActiveTab("traders")}
        >
          <text content="Traders" fg={activeTab() === "traders" ? theme.highlightText : theme.textMuted} />
        </box>
        <box
          paddingLeft={2}
          paddingRight={2}
          backgroundColor={activeTab() === "builders" ? theme.primary : undefined}
          onMouseDown={() => setActiveTab("builders")}
        >
          <text content="Builders" fg={activeTab() === "builders" ? theme.highlightText : theme.textMuted} />
        </box>

        <text content="  │  " fg={theme.borderSubtle} />

        <For each={TIMEFRAMES}>
          {(tf) => (
            <box
              paddingLeft={1}
              paddingRight={1}
              backgroundColor={timeframe() === tf.key ? theme.accent : undefined}
              onMouseDown={() => setTimeframe(tf.key)}
            >
              <text
                content={tf.label}
                fg={timeframe() === tf.key ? theme.background : theme.textMuted}
              />
            </box>
          )}
        </For>
      </box>

      {/* Column headers */}
      <box height={1} width="100%" flexDirection="row" backgroundColor={theme.backgroundPanel} paddingLeft={1}>
        <text content={" #".padEnd(5)}  fg={theme.textMuted} width={5} />
        <text content={"ADDRESS / NAME".padEnd(16)} fg={theme.textMuted} width={17} />
        <text content={"VOLUME".padStart(10)} fg={theme.textMuted} width={11} />
        <Show when={activeTab() === "traders"}>
          <text content={"P&L".padStart(10)}    fg={theme.textMuted} width={11} />
          <text content={"TRADES".padStart(8)}  fg={theme.textMuted} width={9} />
          <text content={"WIN%".padStart(6)}    fg={theme.textMuted} width={7} />
        </Show>
        <Show when={activeTab() === "builders"}>
          <text content={"REVENUE".padStart(10)} fg={theme.textMuted} width={11} />
          <text content={"TRADES".padStart(8)}  fg={theme.textMuted} width={9} />
          <text content={"UNIQ.".padStart(6)}   fg={theme.textMuted} width={7} />
        </Show>
      </box>

      <Separator />

      {/* Data rows */}
      <Show when={loading()}>
        <LoadingState message="Fetching leaderboard data..." />
      </Show>

      <Show when={!loading()}>
        <scrollbox flexGrow={1} width="100%">
          <Show when={activeTab() === "traders"}>
            <For each={traders()}>
              {(trader) => (
                <box flexDirection="row" width="100%" paddingLeft={1}>
                  <text
                    content={rankMedal(trader.rank)}
                    fg={rankMedalColor(trader.rank)}
                    width={2}
                  />
                  <text
                    content={`${trader.rank}`.padStart(2)}
                    fg={trader.rank <= 3 ? theme.warning : theme.textMuted}
                    width={3}
                  />
                  <text
                    content={`${trader.address.slice(0, 8)}…${trader.address.slice(-4)}`.padEnd(16)}
                    fg={theme.text}
                    width={17}
                  />
                  <text
                    content={fmtVol(trader.volume).padStart(10)}
                    fg={theme.textMuted}
                    width={11}
                  />
                  <text
                    content={fmtPnl(trader.realizedPnl).padStart(10)}
                    fg={trader.realizedPnl >= 0 ? theme.success : theme.error}
                    width={11}
                  />
                  <text
                    content={String(trader.tradeCount).padStart(8)}
                    fg={theme.text}
                    width={9}
                  />
                  <text
                    content={`${trader.winRate.toFixed(0)}%`.padStart(6)}
                    fg={trader.winRate >= 55 ? theme.success : trader.winRate >= 45 ? theme.warning : theme.error}
                    width={7}
                  />
                </box>
              )}
            </For>
          </Show>

          <Show when={activeTab() === "builders"}>
            <For each={builders()}>
              {(builder) => (
                <box flexDirection="row" width="100%" paddingLeft={1}>
                  <text
                    content={rankMedal(builder.rank)}
                    fg={rankMedalColor(builder.rank)}
                    width={2}
                  />
                  <text
                    content={`${builder.rank}`.padStart(2)}
                    fg={builder.rank <= 3 ? theme.warning : theme.textMuted}
                    width={3}
                  />
                  <text
                    content={(builder.name || `${builder.address.slice(0, 8)}…`).padEnd(16)}
                    fg={theme.text}
                    width={17}
                  />
                  <text
                    content={fmtVol(builder.volume).padStart(10)}
                    fg={theme.textMuted}
                    width={11}
                  />
                  <text
                    content={fmtVol(builder.revenue).padStart(10)}
                    fg={theme.success}
                    width={11}
                  />
                  <text
                    content={String(builder.tradeCount).padStart(8)}
                    fg={theme.text}
                    width={9}
                  />
                  <text
                    content={`${builder.uniqueTraders}`.padStart(6)}
                    fg={theme.accent}
                    width={7}
                  />
                </box>
              )}
            </For>
          </Show>
        </scrollbox>
      </Show>

      {/* Footer */}
      <Separator type="light" />
      <box height={1} paddingLeft={2} flexDirection="row">
        <text content="[↑↓] Navigate  " fg={theme.textMuted} />
        <text content="[T] Traders  " fg={theme.textMuted} />
        <text content="[B] Builders  " fg={theme.textMuted} />
        <text content="[D/W/M/A] Timeframe  " fg={theme.textMuted} />
        <text content="[ESC] Close" fg={theme.textMuted} />
      </box>
    </box>
  );
}
