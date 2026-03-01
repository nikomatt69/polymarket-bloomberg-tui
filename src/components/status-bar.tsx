import { createMemo } from "solid-js";
import { appState, highlightedIndex, getFilteredMarkets, wsConnectionStatus, unreadMessagesCount, unreadGlobalCount } from "../state";
import { useTheme } from "../context/theme";
import { walletState } from "../state";
import { watchlistState } from "../hooks/useWatchlist";
import { alertsState } from "../hooks/useAlerts";

export function StatusBar() {
  const { theme } = useTheme();

  const statusText = createMemo(() => {
    const filtered = getFilteredMarkets();
    const idx = highlightedIndex();
    const total = filtered.length;
    const sortLabel = appState.sortBy === "volume" ? "Vol" : appState.sortBy === "change" ? "24h%" : "A-Z";
    const tf = appState.timeframe.toUpperCase();
    const status = appState.loading ? "⟳ Refreshing..." : "Ready";
    const lastRefresh = appState.lastRefresh ? new Date(appState.lastRefresh).toLocaleTimeString() : "never";
    const wallet = walletState.connected ? "Wallet: ON" : "Wallet: OFF";
    const watchFilter = watchlistState.filterActive ? "Watch: FILTER" : "Watch: ALL";
    const activeAlerts = alertsState.alerts.filter((alert) => alert.status === "active").length;
    const triggeredAlerts = alertsState.alerts.filter((alert) => alert.status === "triggered").length;
    
    const wsStatus = wsConnectionStatus();
    const wsLabel = wsStatus === "connected" ? "WS: ✓" : wsStatus === "connecting" ? "WS: ⟳" : wsStatus === "reconnecting" ? "WS: ~" : "WS: ✗";

    const unreadDms = unreadMessagesCount();
    const unreadGlobal = unreadGlobalCount();
    const totalUnread = unreadDms + unreadGlobal;
    const messagesLabel = totalUnread > 0 ? `Msgs: ${totalUnread}` : "Msgs: 0";

    return `${status}  |  Sort: ${sortLabel}  |  TF: ${tf}  |  ${idx + 1}/${total}  |  ${wsLabel}  |  ${wallet}  |  ${watchFilter}  |  Alerts A:${activeAlerts} T:${triggeredAlerts}  |  ${messagesLabel}  |  Last: ${lastRefresh}`;
  });

  return (
    <box flexDirection="row" width="100%" paddingLeft={1} paddingRight={1}>
      <text content={statusText()} fg={theme.textMuted} />
    </box>
  );
}
