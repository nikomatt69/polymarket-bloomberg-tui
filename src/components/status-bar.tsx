import { createMemo } from "solid-js";
import { appState, highlightedIndex, getFilteredMarkets } from "../state";
import { useTheme } from "../context/theme";

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
    return `${status}  |  Sort: ${sortLabel}  |  TF: ${tf}  |  ${idx + 1}/${total}  |  Last: ${lastRefresh}`;
  });

  return (
    <box flexDirection="row" width="100%" justifyContent="space-between" paddingLeft={1} paddingRight={1}>
      <text content={statusText()} fg={theme.textMuted} />
      <text content="↑↓:Nav  |  R:Refresh  |  ⌘K:Menu  |  Q:Quit" fg={theme.textMuted} />
    </box>
  );
}
