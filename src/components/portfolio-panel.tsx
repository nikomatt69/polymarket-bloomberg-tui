import { For, Show, createMemo } from "solid-js";
import { positionsState } from "../hooks/usePositions";
import { ordersState } from "../hooks/useOrders";
import { calculatePortfolioSummary } from "../api/positions";
import { walletState } from "../state";
import { calculateMonthlyStats, calculateTradeStats, calculateMarketConcentration } from "../utils/analytics";
import { useTheme } from "../context/theme";

function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len - 1) + "…" : str.padEnd(len, " ");
}

function fmtUsd(val: number): string {
  const sign = val >= 0 ? "+" : "";
  return `${sign}$${Math.abs(val).toFixed(2)}`;
}

function fmtPct(val: number): string {
  const sign = val >= 0 ? "+" : "";
  return `${sign}${val.toFixed(1)}%`;
}

function fmtPrice(val: number): string {
  return `${(val * 100).toFixed(1)}¢`;
}

function fmtValue(val: number): string {
  if (val >= 1000) {
    return `$${(val / 1000).toFixed(1)}K`;
  }
  return `$${val.toFixed(2)}`;
}

function fmtExposure(shares: number, price: number): string {
  const exp = shares * price;
  if (exp >= 1000) {
    return `$${(exp / 1000).toFixed(1)}K`;
  }
  return `$${exp.toFixed(0)}`;
}

function getLeverageIndicator(pnlPct: number): string {
  if (pnlPct > 50) return "HIGH";
  if (pnlPct > 20) return "MED";
  return "LOW";
}

interface AccountStats {
  tradeCount: number;
  winCount: number;
  winRate: string;
  avgSize: string;
  avgPnl: string;
  bestTrade: string;
  worstTrade: string;
  totalVolume: string;
  currentStreak: number;
  streakType: "win" | "loss" | "none";
}

function calcAccountStats(positions: Array<{ cashPnl: number; currentValue: number; size: number }>): AccountStats {
  const all = positions;
  if (all.length === 0) {
    return { tradeCount: 0, winCount: 0, winRate: "N/A", avgSize: "N/A", avgPnl: "N/A", bestTrade: "N/A", worstTrade: "N/A", totalVolume: "N/A", currentStreak: 0, streakType: "none" };
  }
  const wins = all.filter((p) => p.cashPnl > 0).length;
  const totalPnl = all.reduce((s, p) => s + p.cashPnl, 0);
  const totalVol = all.reduce((s, p) => s + p.currentValue, 0);
  const avgSizeVal = all.reduce((s, p) => s + p.size, 0) / all.length;
  const pnls = all.map((p) => p.cashPnl).sort((a, b) => b - a);
  const best = pnls[0] ?? 0;
  const worst = pnls[pnls.length - 1] ?? 0;

  // Calculate streak
  const sortedByRecent = [...positions].sort((a, b) => b.cashPnl - a.cashPnl);
  let currentStreak = 0;
  let streakType: "win" | "loss" | "none" = "none";
  
  if (sortedByRecent.length > 0) {
    const firstPnl = sortedByRecent[0]!.cashPnl;
    if (firstPnl > 0) {
      streakType = "win";
      for (const p of sortedByRecent) {
        if (p.cashPnl > 0) currentStreak++;
        else break;
      }
    } else if (firstPnl < 0) {
      streakType = "loss";
      for (const p of sortedByRecent) {
        if (p.cashPnl < 0) currentStreak++;
        else break;
      }
    }
  }

  return {
    tradeCount: all.length,
    winCount: wins,
    winRate: `${((wins / all.length) * 100).toFixed(1)}%`,
    avgSize: avgSizeVal.toFixed(1),
    avgPnl: fmtUsd(totalPnl / all.length),
    bestTrade: fmtUsd(best),
    worstTrade: fmtUsd(worst),
    totalVolume: `$${totalVol.toFixed(2)}`,
    currentStreak,
    streakType,
  };
}

export function PortfolioPanel() {
  const { theme } = useTheme();

  const summary = () => calculatePortfolioSummary(positionsState.positions);

  const accountStats = createMemo(() =>
    calcAccountStats(positionsState.positions)
  );

  const monthlyStats = createMemo(() => {
    const filledOrders = ordersState.tradeHistory.filter(
      (o) => o.status === "FILLED" || o.status === "MATCHED"
    );
    return calculateMonthlyStats(filledOrders).slice(0, 6);
  });

  const weeklyPnl = createMemo(() => {
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const filledOrders = ordersState.tradeHistory.filter(
      (o) => (o.status === "FILLED" || o.status === "MATCHED") && o.createdAt >= weekAgo
    );
    return filledOrders.reduce((sum, o) => sum + o.price * o.sizeMatched, 0);
  });

  const dailyPnl = createMemo(() => {
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const filledOrders = ordersState.tradeHistory.filter(
      (o) => (o.status === "FILLED" || o.status === "MATCHED") && o.createdAt >= dayAgo
    );
    return filledOrders.reduce((sum, o) => sum + o.price * o.sizeMatched, 0);
  });

  const realizedPnl = createMemo(() => {
    return positionsState.positions.reduce((sum, p) => {
      return p.initialValue > 0 ? sum + p.cashPnl : sum;
    }, 0);
  });

  const unrealizedPnl = createMemo(() => {
    return summary().totalCashPnl - realizedPnl();
  });

  const lastFetchStr = () => {
    const d = positionsState.lastFetch;
    return d ? new Date(d).toLocaleTimeString() : "never";
  };

  // Analytics from positionsState
  const analytics = () => positionsState.positionsAnalytics;

  // Market concentration risk
  const concentrationRisk = createMemo(() => 
    calculateMarketConcentration(positionsState.positions)
  );

  // Total exposure calculation
  const totalExposure = createMemo(() => {
    return positionsState.positions.reduce((sum, p) => sum + (p.size * p.curPrice), 0);
  });

  // Trade stats
  const tradeStats = createMemo(() => {
    const filledOrders = ordersState.tradeHistory.filter(
      (o) => o.status === "FILLED" || o.status === "MATCHED"
    );
    return calculateTradeStats(filledOrders, positionsState.positions);
  });

  return (
    <box flexDirection="column" width="100%" flexGrow={1} padding={1}>
      {/* Header */}
      <box flexDirection="row" width="100%" justifyContent="space-between">
        <text content="PORTFOLIO" fg={theme.primary} />
        <text content={`Updated: ${lastFetchStr()}`} fg={theme.textMuted} />
      </box>

      <text content="" />

      <Show
        when={!walletState.connected}
        fallback={
          <Show
            when={!positionsState.loading}
            fallback={
              <box padding={1}>
                <text content="Fetching positions..." fg={theme.textMuted} />
              </box>
            }
          >
            <Show
              when={positionsState.error === null}
              fallback={
                <box padding={1}>
                  <text content={`Error: ${positionsState.error}`} fg={theme.error} />
                </box>
              }
            >
              {/* Summary row */}
              <box flexDirection="row" width="100%" gap={2}>
                <text content={`Value: $${summary().totalValue.toFixed(2)}`} fg={theme.textBright} />
                <text
                  content={`P&L: ${fmtUsd(summary().totalCashPnl)}`}
                  fg={summary().totalCashPnl >= 0 ? theme.success : theme.error}
                />
                <text
                  content={fmtPct(summary().totalPercentPnl)}
                  fg={summary().totalPercentPnl >= 0 ? theme.success : theme.error}
                />
                <text content={`Positions: ${summary().positionCount}`} fg={theme.textMuted} />
              </box>

              {/* Risk Metrics Summary */}
              <box flexDirection="row" width="100%" gap={2}>
                <text content={`Exposure: ${fmtExposure(positionsState.positions.reduce((s, p) => s + p.size, 0), 1)}`} fg={theme.textMuted} />
                <text content={`Weighted Avg Entry: ${fmtPrice(analytics().weightedAvgEntry)}`} fg={theme.textMuted} />
                <text 
                  content={`Risk: ${concentrationRisk().riskLevel.toUpperCase()}`} 
                  fg={concentrationRisk().riskLevel === "high" ? theme.error : concentrationRisk().riskLevel === "medium" ? theme.warning : theme.success}
                />
              </box>

              <text content="" />

              {/* Column headers */}
              <box flexDirection="row" width="100%">
                <text content="MARKET" fg={theme.textMuted} width={28} />
                <text content="OUT" fg={theme.textMuted} width={5} />
                <text content="SHARES" fg={theme.textMuted} width={8} />
                <text content="ENTRY" fg={theme.textMuted} width={7} />
                <text content="CUR" fg={theme.textMuted} width={7} />
                <text content="EXP" fg={theme.textMuted} width={7} />
                <text content="P&L $" fg={theme.textMuted} width={9} />
                <text content="ROI" fg={theme.textMuted} width={7} />
                <text content="LEV" fg={theme.textMuted} width={5} />
              </box>

              <Show
                when={positionsState.positions.length > 0}
                fallback={
                  <box padding={1}>
                    <text content="No positions found" fg={theme.textMuted} />
                  </box>
                }
              >
                <scrollbox flexGrow={1} width="100%">
                  <For each={positionsState.positions}>
                    {(position) => (
                      <box flexDirection="row" width="100%">
                        <text content={truncate(position.title, 27)} fg={theme.text} width={28} />
                        <text content={position.outcome.slice(0, 4).padEnd(4, " ")} fg={theme.accent} width={5} />
                        <text content={position.size.toFixed(1).padStart(7, " ")} fg={theme.text} width={8} />
                        <text content={fmtPrice(position.avgPrice).padStart(6, " ")} fg={theme.textMuted} width={7} />
                        <text content={fmtPrice(position.curPrice).padStart(6, " ")} fg={theme.text} width={7} />
                        <text content={fmtExposure(position.size, position.curPrice).padStart(6, " ")} fg={theme.textMuted} width={7} />
                        <text
                          content={fmtUsd(position.cashPnl).padStart(8, " ")}
                          fg={position.cashPnl >= 0 ? theme.success : theme.error}
                          width={9}
                        />
                        <text
                          content={fmtPct(position.percentPnl).padStart(6, " ")}
                          fg={position.percentPnl >= 0 ? theme.success : theme.error}
                          width={7}
                        />
                        <text
                          content={getLeverageIndicator(position.percentPnl).padStart(4, " ")}
                          fg={position.percentPnl > 50 ? theme.error : position.percentPnl > 20 ? theme.warning : theme.textMuted}
                          width={5}
                        />
                      </box>
                    )}
                  </For>
                </scrollbox>
              </Show>

              {/* Account Analytics section */}
              <text content="" />
              <text content="ACCOUNT ANALYTICS" fg={theme.primary} />
              <text content="" />
              <box flexDirection="row" width="100%" gap={3}>
                <text content={`Positions: ${accountStats().tradeCount}`} fg={theme.text} />
                <text content={`Wins: ${accountStats().winCount}`} fg={theme.success} />
                <text content={`Win Rate: ${accountStats().winRate}`} fg={
                  (() => {
                    const r = parseFloat(accountStats().winRate);
                    return r >= 50 ? theme.success : theme.error;
                  })()
                } />
              </box>
              <box flexDirection="row" width="100%" gap={3}>
                <text content={`Avg Size: ${accountStats().avgSize} shares`} fg={theme.textMuted} />
                <text content={`Avg P&L: ${accountStats().avgPnl}`} fg={theme.textMuted} />
              </box>
              <box flexDirection="row" width="100%" gap={3}>
                <text content={`Best: ${accountStats().bestTrade}`} fg={theme.success} />
                <text content={`Worst: ${accountStats().worstTrade}`} fg={theme.error} />
                <text content={`Total Value: ${accountStats().totalVolume}`} fg={theme.textMuted} />
              </box>
              <box flexDirection="row" width="100%" gap={3}>
                <text content={`Streak: ${accountStats().streakType === "none" ? "N/A" : `${accountStats().currentStreak} ${accountStats().streakType.toUpperCase()}(S)`}`} 
                  fg={accountStats().streakType === "win" ? theme.success : accountStats().streakType === "loss" ? theme.error : theme.textMuted} />
                <text content={`PF: ${tradeStats().profitFactor === Infinity ? "∞" : tradeStats().profitFactor.toFixed(2)}`} fg={theme.textMuted} />
                <text content={`Largest Pos: ${analytics().largestPosition ? fmtValue(analytics().largestPosition!.currentValue) : "N/A"}`} fg={theme.textMuted} />
              </box>

              {/* Sector Allocation section */}
              <Show when={analytics().sectorAllocations.length > 0}>
                <text content="" />
                <text content="SECTOR ALLOCATION" fg={theme.primary} />
                <text content="" />
                <box flexDirection="row" width="100%">
                  <text content="SECTOR" fg={theme.textMuted} width={14} />
                  <text content="VALUE" fg={theme.textMuted} width={10} />
                  <text content="ALLOC" fg={theme.textMuted} width={8} />
                  <text content="POS" fg={theme.textMuted} width={5} />
                  <text content="P&L" fg={theme.textMuted} width={10} />
                </box>
                <For each={analytics().sectorAllocations.slice(0, 6)}>
                  {(sector) => (
                    <box flexDirection="row" width="100%">
                      <text content={sector.sector.padEnd(13, " ")} fg={theme.text} width={14} />
                      <text content={fmtValue(sector.value).padStart(9, " ")} fg={theme.textMuted} width={10} />
                      <text content={`${sector.percentage.toFixed(1)}%`.padStart(7, " ")} fg={theme.accent} width={8} />
                      <text content={sector.positionCount.toString().padStart(4, " ")} fg={theme.textMuted} width={5} />
                      <text 
                        content={fmtUsd(sector.pnl).padStart(9, " ")} 
                        fg={sector.pnl >= 0 ? theme.success : theme.error}
                        width={10}
                      />
                    </box>
                  )}
                </For>
              </Show>

              {/* Best/Worst Performers section */}
              <Show when={analytics().topPerformers.length > 0 || analytics().bottomPerformers.length > 0}>
                <text content="" />
                <text content="PERFORMANCE LEADERS" fg={theme.primary} />
                <text content="" />
                <box flexDirection="row" width="100%">
                  <text content="TOP WINNERS" fg={theme.success} width={20} />
                  <text content="TOP LOSERS" fg={theme.error} width={20} />
                </box>
                <For each={[0, 1, 2]}>
                  {(idx) => (
                    <box flexDirection="row" width="100%">
                      <Show when={analytics().topPerformers[idx]}>
                        <text 
                          content={`${truncate(analytics().topPerformers[idx]!.title, 17)} ${fmtUsd(analytics().topPerformers[idx]!.pnl)}`} 
                          fg={theme.success} 
                          width={20} 
                        />
                      </Show>
                      <Show when={!analytics().topPerformers[idx]}>
                        <text content="-" fg={theme.textMuted} width={20} />
                      </Show>
                      <Show when={analytics().bottomPerformers[idx]}>
                        <text 
                          content={`${truncate(analytics().bottomPerformers[idx]!.title, 17)} ${fmtUsd(analytics().bottomPerformers[idx]!.pnl)}`} 
                          fg={theme.error} 
                          width={20} 
                        />
                      </Show>
                      <Show when={!analytics().bottomPerformers[idx]}>
                        <text content="-" fg={theme.textMuted} width={20} />
                      </Show>
                    </box>
                  )}
                </For>
              </Show>

              {/* Historical Performance section */}
              <text content="" />
              <text content="HISTORICAL PERFORMANCE" fg={theme.primary} />
              <text content="" />
              <box flexDirection="row" width="100%" gap={3}>
                <text content={`Realized: ${fmtUsd(realizedPnl())}`} fg={realizedPnl() >= 0 ? theme.success : theme.error} />
                <text content={`Unrealized: ${fmtUsd(unrealizedPnl())}`} fg={unrealizedPnl() >= 0 ? theme.success : theme.error} />
              </box>
              <box flexDirection="row" width="100%" gap={3}>
                <text content={`Daily Vol: ${fmtUsd(dailyPnl())}`} fg={theme.textMuted} />
                <text content={`Weekly Vol: ${fmtUsd(weeklyPnl())}`} fg={theme.textMuted} />
              </box>
              <Show when={monthlyStats().length > 0}>
                <text content="" />
                <text content="MONTHLY P&L" fg={theme.textMuted} />
                <box flexDirection="row" width="100%">
                  <text content="MONTH" fg={theme.textMuted} width={10} />
                  <text content="TRADES" fg={theme.textMuted} width={9} />
                  <text content="VOLUME" fg={theme.textMuted} width={12} />
                  <text content="P&L" fg={theme.textMuted} width={12} />
                </box>
                <For each={monthlyStats()}>
                  {(stat) => (
                    <box flexDirection="row" width="100%">
                      <text content={stat.month.padEnd(9, " ")} fg={theme.text} width={10} />
                      <text content={stat.tradeCount.toString().padStart(8, " ")} fg={theme.textMuted} width={9} />
                      <text content={`$${stat.volume.toFixed(0)}`.padStart(11, " ")} fg={theme.textMuted} width={12} />
                      <text
                        content={fmtUsd(stat.pnl).padStart(11, " ")}
                        fg={stat.pnl >= 0 ? theme.success : theme.error}
                        width={12}
                      />
                    </box>
                  )}
                </For>
              </Show>

              {/* Recent filled orders */}
              <Show when={ordersState.tradeHistory.length > 0}>
                <text content="" />
                <text content="RECENT FILLS" fg={theme.primary} />
                <text content="" />
                <box flexDirection="row" width="100%">
                  <text content="MARKET" fg={theme.textMuted} width={32} />
                  <text content="SIDE" fg={theme.textMuted} width={5} />
                  <text content="PRICE" fg={theme.textMuted} width={7} />
                  <text content="FILLED" fg={theme.textMuted} width={9} />
                  <text content="STATUS" fg={theme.textMuted} width={10} />
                </box>
                <scrollbox width="100%">
                  <For each={ordersState.tradeHistory.slice(0, 10)}>
                    {(order) => (
                      <box flexDirection="row" width="100%">
                        <text content={truncate(order.marketTitle ?? "—", 31)} fg={theme.text} width={32} />
                        <text
                          content={order.side.padEnd(4, " ")}
                          fg={order.side === "BUY" ? theme.success : theme.error}
                          width={5}
                        />
                        <text content={fmtPrice(order.price).padStart(6, " ")} fg={theme.text} width={7} />
                        <text content={order.sizeMatched.toFixed(1).padStart(8, " ")} fg={theme.textMuted} width={9} />
                        <text content={order.status} fg={theme.textMuted} width={10} />
                      </box>
                    )}
                  </For>
                </scrollbox>
              </Show>
            </Show>
          </Show>
        }
      >
        <box padding={1}>
          <text content="Connect wallet (W) to view positions" fg={theme.textMuted} />
        </box>
      </Show>
    </box>
  );
}
