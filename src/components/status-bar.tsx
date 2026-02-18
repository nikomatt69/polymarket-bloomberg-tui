import { createMemo } from "solid-js";
import { appState, highlightedIndex, getFilteredMarkets } from "../state";
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

    return `${status}  |  Sort: ${sortLabel}  |  TF: ${tf}  |  ${idx + 1}/${total}  |  ${wallet}  |  ${watchFilter}  |  Alerts A:${activeAlerts} T:${triggeredAlerts}  |  Last: ${lastRefresh}`;
  });

  return (
    <box flexDirection="row" width="100%" paddingLeft={1} paddingRight={1}>
      <text content={statusText()} fg={theme.textMuted} />
    </box>
  );
}
