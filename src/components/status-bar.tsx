/**
 * StatusBar — Bloomberg-style status with latency, positions, daily P&L
 */

import { createMemo, Show } from "solid-js";
import { appState, highlightedIndex, getFilteredMarkets, wsConnectionStatus, unreadMessagesCount, unreadGlobalCount, realtimeConnected } from "../state";
import { useTheme } from "../context/theme";
import { walletState } from "../state";
import { watchlistState } from "../hooks/useWatchlist";
import { alertsState } from "../hooks/useAlerts";
import { positionsState } from "../hooks/usePositions";
import { ordersState } from "../hooks/useOrders";
import { calculateMarketConcentration } from "../utils/analytics";

function fmtPnl(n: number): string {
  const sign = n >= 0 ? "+" : "";
  if (Math.abs(n) >= 1000) return `${sign}$${(n / 1000).toFixed(1)}K`;
  return `${sign}$${n.toFixed(2)}`;
}

export function StatusBar() {
  const { theme } = useTheme();

  const filtered = createMemo(() => getFilteredMarkets());
  const idx = createMemo(() => highlightedIndex());
  const sortLabel = createMemo(() => appState.sortBy === "volume" ? "VOL" : appState.sortBy === "change" ? "24H%" : "A-Z");
  const tf = createMemo(() => appState.timeframe.toUpperCase());
  const lastRefresh = createMemo(() => appState.lastRefresh ? appState.lastRefresh.toLocaleTimeString() : "never");

  const wsStatus = createMemo(() => wsConnectionStatus());
  const wsLabel = createMemo(() => {
    const s = wsStatus();
    return s === "connected" ? "◉" : s === "connecting" ? "⟳" : s === "reconnecting" ? "∼" : "○";
  });
  const wsColor = createMemo(() => {
    const s = wsStatus();
    return s === "connected" ? theme.success : s === "connecting" ? theme.warning : theme.error;
  });

  const activeAlerts = createMemo(() => alertsState.alerts.filter((a) => a.status === "active").length);
  const triggeredAlerts = createMemo(() => alertsState.alerts.filter((a) => a.status === "triggered").length);
  const totalUnread = createMemo(() => unreadMessagesCount() + unreadGlobalCount());
  const openOrders = createMemo(() => ordersState.openOrders.length);

  const dailyPnl = createMemo(() => {
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const dayOrders = ordersState.tradeHistory.filter(
      (o) => (o.status === "FILLED" || o.status === "MATCHED") && o.createdAt >= dayAgo
    );
    return dayOrders.reduce((sum, o) => sum + (o.side === "BUY" ? -o.price * o.sizeMatched : o.price * o.sizeMatched), 0);
  });

  const heatRisk = createMemo(() => calculateMarketConcentration(positionsState.positions).riskLevel);
  const heatColor = createMemo(() => {
    const r = heatRisk();
    return r === "high" ? theme.error : r === "medium" ? theme.warning : theme.success;
  });

  const sep = () => <text content=" │ " fg={theme.borderSubtle} />;

  return (
    <box flexDirection="row" width="100%" paddingLeft={1} paddingRight={1}>
      {/* Refresh state */}
      <text
        content={appState.loading ? "⟳ REFRESH" : "● READY"}
        fg={appState.loading ? theme.warning : theme.success}
      />
      {sep()}
      {/* Sort + Timeframe */}
      <text content="Sort:" fg={theme.textMuted} />
      <text content={sortLabel()} fg={theme.text} />
      <text content=" TF:" fg={theme.textMuted} />
      <text content={tf()} fg={theme.text} />
      {sep()}
      {/* Position in list */}
      <text content={`${idx() + 1}`} fg={theme.text} />
      <text content={`/${filtered().length}`} fg={theme.textMuted} />
      {sep()}
      {/* WebSocket */}
      <text content="WS:" fg={theme.textMuted} />
      <text content={wsLabel()} fg={wsColor()} />
      {sep()}
      {/* Wallet */}
      <text content="Wallet:" fg={theme.textMuted} />
      <text
        content={walletState.connected ? "◉ ON" : "○ OFF"}
        fg={walletState.connected ? theme.success : theme.error}
      />
      <Show when={walletState.connected}>
        <text
          content={realtimeConnected() ? " RT●" : " RT○"}
          fg={realtimeConnected() ? theme.success : theme.textMuted}
        />
      </Show>
      {sep()}
      {/* Portfolio heat */}
      <Show when={positionsState.positions.length > 0}>
        <text content="Heat:" fg={theme.textMuted} />
        <text content={heatRisk().toUpperCase()} fg={heatColor()} />
        {sep()}
      </Show>
      {/* Watchlist filter */}
      <text
        content={watchlistState.filterActive ? "★ FILT" : "☆ ALL"}
        fg={watchlistState.filterActive ? theme.accent : theme.textMuted}
      />
      {sep()}
      {/* Positions + Orders */}
      <text content="Pos:" fg={theme.textMuted} />
      <text content={`${positionsState.positions.length}`} fg={theme.text} />
      <Show when={openOrders() > 0}>
        <text content=" Ord:" fg={theme.textMuted} />
        <text content={`${openOrders()}`} fg={theme.warning} />
      </Show>
      {/* Daily P&L */}
      <Show when={dailyPnl() !== 0}>
        {sep()}
        <text content="Day:" fg={theme.textMuted} />
        <text content={dailyPnl() >= 0 ? "▲" : "▼"} fg={dailyPnl() >= 0 ? theme.success : theme.error} />
        <text content={fmtPnl(dailyPnl())} fg={dailyPnl() >= 0 ? theme.success : theme.error} />
      </Show>
      {sep()}
      {/* Alerts */}
      <text content="Alerts:" fg={theme.textMuted} />
      <text
        content={`${activeAlerts()}`}
        fg={activeAlerts() > 0 ? theme.warning : theme.textMuted}
      />
      <text content="/" fg={theme.textMuted} />
      <text
        content={`${triggeredAlerts()}`}
        fg={triggeredAlerts() > 0 ? theme.success : theme.textMuted}
      />
      {/* Unread messages */}
      <Show when={totalUnread() > 0}>
        {sep()}
        <text content="✉ " fg={theme.accent} />
        <text content={`${totalUnread()}`} fg={theme.accent} />
      </Show>
      {sep()}
      {/* Last refresh */}
      <text content="Upd:" fg={theme.textMuted} />
      <text content={lastRefresh()} fg={theme.textMuted} />
    </box>
  );
}
