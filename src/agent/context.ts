/**
 * TUI Context Provider - Snapshot of what the user is viewing in the terminal
 */

import {
  appState,
  walletState,
  highlightedIndex,
  portfolioOpen,
  orderFormOpen,
  settingsPanelOpen,
  orderHistoryOpen,
  watchlistPanelOpen,
  sentimentPanelOpen,
  indicatorsPanelOpen,
  comparisonPanelOpen,
  accountStatsOpen,
  getSelectedMarket,
} from "../state";
import { positionsState } from "../hooks/usePositions";
import { watchlistState } from "../hooks/useWatchlist";
import { alertsState } from "../hooks/useAlerts";
import type { TUIContext, AgentContext } from "./tool";

/**
 * Get current snapshot of TUI state for agent context
 */
export function getTUIContext(): TUIContext {
  const selectedMarket = getSelectedMarket() ?? null;
  const selectedOutcome = selectedMarket?.outcomes[0] ?? null;

  // Determine current panel
  let currentPanel: string | null = null;
  const panels = {
    portfolio: portfolioOpen(),
    orderForm: orderFormOpen(),
    alerts: alertsState.panelOpen,
    settings: settingsPanelOpen(),
    orderHistory: orderHistoryOpen(),
    watchlist: watchlistPanelOpen(),
    sentiment: sentimentPanelOpen(),
    indicators: indicatorsPanelOpen(),
    comparison: comparisonPanelOpen(),
    accountStats: accountStatsOpen(),
  };

  for (const [panel, isOpen] of Object.entries(panels)) {
    if (isOpen) {
      currentPanel = panel;
      break;
    }
  }

  return {
    // Market context
    selectedMarket,
    selectedMarketId: appState.selectedMarketId,
    selectedOutcome,

    // UI State
    currentView: portfolioOpen() ? "portfolio" : "market",
    currentPanel,
    highlightedIndex: highlightedIndex(),

    // Wallet
    walletConnected: walletState.connected,
    walletAddress: walletState.address,
    balance: walletState.balance,

    // Data counts
    marketsCount: appState.markets.length,
    positionsCount: positionsState.positions.length,
    openOrdersCount: 0, // Will be populated if needed
    watchlistCount: watchlistState.marketIds.length,
    alertsCount: alertsState.alerts.length,

    // Filters & Settings
    sortBy: appState.sortBy,
    timeframe: appState.timeframe,
    watchlistFilterActive: watchlistState.filterActive,

    // Panels
    panels,
  };
}

/**
 * Format TUI context for system prompt
 */
export function formatTUIContextForPrompt(ctx: TUIContext): string {
  const lines: string[] = [];

  lines.push("## Current TUI State");

  // Wallet
  lines.push(`- Wallet: ${ctx.walletConnected ? `Connected (${ctx.walletAddress?.slice(0, 6)}...${ctx.walletAddress?.slice(-4)})` : "Not connected"}`);
  if (ctx.walletConnected) {
    lines.push(`- Balance: $${ctx.balance.toFixed(2)}`);
  }

  // Market context
  if (ctx.selectedMarket) {
    lines.push(`- Selected Market: ${ctx.selectedMarket.title}`);
    if (ctx.selectedOutcome) {
      lines.push(`  - Outcome: ${ctx.selectedOutcome.title} @ ${ctx.selectedOutcome.price.toFixed(2)}`);
    }
    lines.push(`  - Volume 24h: $${ctx.selectedMarket.volume24h.toLocaleString()}`);
    lines.push(`  - Liquidity: $${ctx.selectedMarket.liquidity.toLocaleString()}`);
  } else {
    lines.push("- Selected Market: None");
  }

  // Data counts
  lines.push(`- Markets: ${ctx.marketsCount}`);
  lines.push(`- Positions: ${ctx.positionsCount}`);
  lines.push(`- Watchlist: ${ctx.watchlistCount}`);
  lines.push(`- Alerts: ${ctx.alertsCount}`);

  // View settings
  lines.push(`- Sort: ${ctx.sortBy}`);
  lines.push(`- Timeframe: ${ctx.timeframe}`);
  if (ctx.watchlistFilterActive) {
    lines.push("- Watchlist Filter: ACTIVE");
  }

  // Current panel
  if (ctx.currentPanel) {
    lines.push(`- Open Panel: ${ctx.currentPanel}`);
  }

  return lines.join("\n");
}

/**
 * Create agent context for tool execution
 */
export function createAgentContext(
  sessionID: string,
  messageID: string,
  abortSignal?: AbortSignal
): AgentContext {
  return {
    sessionID,
    messageID,
    abort: abortSignal ?? new AbortController().signal,
    tuiContext: getTUIContext(),
    timestamp: Date.now(),
  };
}

/**
 * Update TUI context (for reactive updates)
 */
let contextUpdateCallbacks: Array<(ctx: TUIContext) => void> = [];

export function onTUIContextUpdate(callback: (ctx: TUIContext) => void): () => void {
  contextUpdateCallbacks.push(callback);
  return () => {
    contextUpdateCallbacks = contextUpdateCallbacks.filter((cb) => cb !== callback);
  };
}

export function notifyContextUpdate(): void {
  const ctx = getTUIContext();
  contextUpdateCallbacks.forEach((cb) => cb(ctx));
}
