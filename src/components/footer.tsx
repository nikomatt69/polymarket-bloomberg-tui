/**
 * Footer — Bloomberg-style keyboard shortcuts reference bar
 * Shows context-aware hints based on current mode
 */

import { createMemo, createSignal, onCleanup, onMount, Show } from "solid-js";
import { useTheme } from "../context/theme";
import {
  enterpriseChatOpen,
  orderFormOpen,
  orderHistoryOpen,
  settingsPanelOpen,
  walletState,
  appState,
} from "../state";
import { alertsState } from "../hooks/useAlerts";
import { positionsState } from "../hooks/usePositions";
import { watchlistState } from "../hooks/useWatchlist";

interface KeyHint {
  key: string;
  fullLabel: string;
}

function getContextHints(): KeyHint[] {
  const hints: KeyHint[] = [];
  
  // Always available
  hints.push({ key: "↑↓/jk", fullLabel: "Navigate" });
  hints.push({ key: "Enter", fullLabel: "AI Chat" });
  hints.push({ key: "/", fullLabel: "Search" });
  
  // Context-specific
  if (enterpriseChatOpen()) {
    hints.push({ key: "Esc", fullLabel: "Close Chat" });
    hints.push({ key: "Ctrl+L", fullLabel: "Clear" });
  } else if (orderFormOpen()) {
    hints.push({ key: "Tab", fullLabel: "Field" });
    hints.push({ key: "T", fullLabel: "Type" });
    hints.push({ key: "P", fullLabel: "PostOnly" });
    hints.push({ key: "Enter", fullLabel: "Submit" });
  } else if (orderHistoryOpen()) {
    hints.push({ key: "Tab", fullLabel: "Open/Trade" });
    hints.push({ key: "C", fullLabel: "Cancel" });
    hints.push({ key: "A", fullLabel: "Cancel All" });
  } else if (alertsState.panelOpen) {
    hints.push({ key: "A", fullLabel: "Add Alert" });
    hints.push({ key: "D", fullLabel: "Delete" });
    hints.push({ key: "S", fullLabel: "Sound" });
  } else if (settingsPanelOpen()) {
    hints.push({ key: "Tab", fullLabel: "Next Tab" });
    hints.push({ key: "←→", fullLabel: "Tab" });
    hints.push({ key: "T", fullLabel: "Theme" });
    hints.push({ key: "Enter", fullLabel: "Select" });
  } else {
    // Default panel shortcuts
    hints.push({ key: "O/S", fullLabel: "Buy/Sell" });
    hints.push({ key: "H", fullLabel: "Orders" });
    hints.push({ key: "P", fullLabel: "Portfolio" });
    hints.push({ key: "Z", fullLabel: "Alerts" });
    hints.push({ key: "E", fullLabel: "Settings" });
  }
  
  return hints;
}

export function Footer() {
  const { theme } = useTheme();
  const [columns, setColumns] = createSignal(
    Number.isFinite(process.stdout.columns) ? process.stdout.columns : 120,
  );

  onMount(() => {
    const handleResize = () => {
      if (Number.isFinite(process.stdout.columns)) {
        setColumns(process.stdout.columns);
      }
    };

    process.stdout.on("resize", handleResize);
    onCleanup(() => {
      process.stdout.off("resize", handleResize);
    });
  });

  const hints = createMemo(() => getContextHints());

  const dataAge = createMemo(() => {
    if (!appState.lastRefresh) return null;
    return Date.now() - appState.lastRefresh.getTime();
  });

  const activeFilterCount = createMemo(() => {
    let count = 0;
    if (watchlistState.filterActive) count++;
    if (appState.sortBy !== "volume") count++;
    return count;
  });

  const positionSummary = createMemo(() => {
    const pos = positionsState.positions;
    if (pos.length === 0) return "";
    const totalValue = pos.reduce((sum, p) => sum + p.currentValue, 0);
    const totalPnl = pos.reduce((sum, p) => sum + p.cashPnl, 0);
    const sign = totalPnl >= 0 ? "+" : "";
    return ` | Pos: ${pos.length} | P&L: ${sign}$${totalPnl.toFixed(0)}`;
  });

  const content = createMemo(() => {
    const cols = Math.max(24, columns());
    const maxLen = Math.max(20, cols - 3);
    
    const hintParts: string[] = [];
    let usedLen = 0;
    
    for (const hint of hints()) {
      const chunk = `[${hint.key}] ${hint.fullLabel}`;
      if (usedLen + chunk.length + 2 > maxLen) break;
      hintParts.push(chunk);
      usedLen += chunk.length + 2;
    }
    
    return hintParts.join("  ");
  });

  return (
    <box
      height={1}
      width="100%"
      flexDirection="row"
      backgroundColor={theme.backgroundPanel}
      paddingLeft={1}
      paddingRight={1}
    >
      <text content={content()} fg={theme.textMuted} />
      <box flexGrow={1} />
      <Show when={dataAge() !== null && dataAge()! > 60_000}>
        <text content={`⚠ ${Math.floor(dataAge()! / 60_000)}m+ OLD  `} fg={theme.warning} />
      </Show>
      <Show when={activeFilterCount() > 0}>
        <text content={`[${activeFilterCount()} filters]  `} fg={theme.accent} />
      </Show>
      <text content={positionSummary()} fg={theme.success} />
    </box>
  );
}
