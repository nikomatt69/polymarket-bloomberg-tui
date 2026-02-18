import { Show, For } from "solid-js";
import { useTheme } from "../context/theme";
import { walletState } from "../state";
import { positionsState } from "../hooks/usePositions";
import { ordersState } from "../hooks/useOrders";
import { 
  calculateTradeStats, 
  calculatePortfolioSummary, 
  calculateAssetAllocation,
  calculateMonthlyStats,
  calculateMarketConcentration,
} from "../utils/analytics";

function fmtUsd(val: number): string {
  const sign = val >= 0 ? "+" : "";
  return `${sign}$${Math.abs(val).toFixed(2)}`;
}

function fmtPct(val: number): string {
  const sign = val >= 0 ? "+" : "";
  return `${sign}${val.toFixed(1)}%`;
}

function fmtCompactUsd(val: number): string {
  const abs = Math.abs(val);
  if (abs >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
  return `$${val.toFixed(2)}`;
}

export function AccountStatsPanel() {
  const { theme } = useTheme();

  const portfolioSummary = () => calculatePortfolioSummary(positionsState.positions);
  
  const tradeStats = () => calculateTradeStats(
    ordersState.tradeHistory, 
    positionsState.positions
  );

  const assetAllocation = () => calculateAssetAllocation(positionsState.positions);
  const monthlyStats = () => calculateMonthlyStats(ordersState.tradeHistory).slice(0, 4);
  const concentration = () => calculateMarketConcentration(positionsState.positions);

  const totalBalance = () => walletState.balance + portfolioSummary().totalValue;

  const healthScore = () => {
    const bal = totalBalance();
    if (bal === 0) return 0;
    const liquidity = (walletState.balance / bal) * 100;
    const pnlScore = portfolioSummary().totalCashPnl > 0 
      ? Math.min(100, 50 + portfolioSummary().totalCashPnl / 10)
      : Math.max(0, 50 + portfolioSummary().totalCashPnl / 10);
    return Math.round((liquidity + pnlScore) / 2);
  };

  const riskLevel = (): "low" | "medium" | "high" => {
    const bal = totalBalance();
    if (bal === 0) return "low";
    const exposure = portfolioSummary().totalValue / bal;
    if (exposure < 0.3) return "low";
    if (exposure < 0.7) return "medium";
    return "high";
  };

  const concentrationColor = () =>
    concentration().riskLevel === "low"
      ? theme.success
      : concentration().riskLevel === "medium"
        ? theme.warning
        : theme.error;

  return (
    <box
      position="absolute"
      top={2}
      left="15%"
      width="70%"
      height={22}
      backgroundColor={theme.backgroundPanel}
      flexDirection="column"
      zIndex={160}
    >
      <box height={1} width="100%" backgroundColor={theme.primary} flexDirection="row">
        <text content=" ACCOUNT STATS " fg={theme.highlightText} width={16} />
        <box flexGrow={1} />
        <text 
          content={` Health: ${healthScore()}% `} 
          fg={healthScore() >= 70 ? theme.success : healthScore() >= 40 ? theme.warning : theme.error} 
        />
        <text 
          content={` Risk: ${riskLevel().toUpperCase()} `} 
          fg={riskLevel() === "low" ? theme.success : riskLevel() === "medium" ? theme.warning : theme.error} 
        />
        <text content=" [ESC] Close " fg={theme.highlightText} width={14} />
      </box>

      <Show
        when={walletState.connected}
        fallback={
          <box flexGrow={1} justifyContent="center" alignItems="center">
            <text content="Connect wallet to view account stats" fg={theme.textMuted} />
          </box>
        }
      >
        <scrollbox flexGrow={1} width="100%">
        <box flexDirection="column" flexGrow={1} paddingLeft={1} paddingTop={1}>
          <box flexDirection="row" width="100%" gap={4}>
            <box flexDirection="column" width="25%">
              <text content="BALANCE" fg={theme.textMuted} />
              <text content={`$${walletState.balance.toFixed(2)}`} fg={theme.textBright} />
              <text content="Available" fg={theme.textMuted} />
            </box>
            <box flexDirection="column" width="25%">
              <text content="POSITIONS VALUE" fg={theme.textMuted} />
              <text content={`$${portfolioSummary().totalValue.toFixed(2)}`} fg={theme.textBright} />
              <text content={`${portfolioSummary().positionCount} positions`} fg={theme.textMuted} />
            </box>
            <box flexDirection="column" width="25%">
              <text content="TOTAL P&L" fg={theme.textMuted} />
              <text 
                content={fmtUsd(portfolioSummary().totalCashPnl)} 
                fg={portfolioSummary().totalCashPnl >= 0 ? theme.success : theme.error}
              />
              <text 
                content={fmtPct(portfolioSummary().totalPercentPnl)} 
                fg={portfolioSummary().totalPercentPnl >= 0 ? theme.success : theme.error} 
              />
            </box>
            <box flexDirection="column" width="25%">
              <text content="TOTAL BALANCE" fg={theme.textMuted} />
              <text content={`$${totalBalance().toFixed(2)}`} fg={theme.textBright} />
              <text content="Value + Available" fg={theme.textMuted} />
            </box>
          </box>

          <text content="" />
          <text content="────────────────────────────────────────────────────────" fg={theme.textMuted} />

          <text content="TRADING STATS" fg={theme.primary} />

          <box flexDirection="row" width="100%" gap={4}>
            <box flexDirection="column">
              <text content="Trades" fg={theme.textMuted} />
              <text content={`${tradeStats().totalTrades}`} fg={theme.text} />
            </box>
            <box flexDirection="column">
              <text content="Win Rate" fg={theme.textMuted} />
              <text 
                content={`${tradeStats().winRate.toFixed(1)}%`} 
                fg={tradeStats().winRate >= 50 ? theme.success : theme.error} 
              />
            </box>
            <box flexDirection="column">
              <text content="Avg Size" fg={theme.textMuted} />
              <text content={`$${tradeStats().avgTradeSize.toFixed(2)}`} fg={theme.text} />
            </box>
            <box flexDirection="column">
              <text content="Profit Factor" fg={theme.textMuted} />
              <text 
                content={tradeStats().profitFactor === Infinity ? "∞" : tradeStats().profitFactor.toFixed(2)} 
                fg={tradeStats().profitFactor >= 1.5 ? theme.success : theme.error} 
              />
            </box>
          </box>

          <box flexDirection="row" width="100%" gap={4}>
            <box flexDirection="column">
              <text content="Total Profit" fg={theme.textMuted} />
              <text content={fmtUsd(tradeStats().totalProfit)} fg={theme.success} />
            </box>
            <box flexDirection="column">
              <text content="Total Loss" fg={theme.textMuted} />
              <text content={fmtUsd(-tradeStats().totalLoss)} fg={theme.error} />
            </box>
            <box flexDirection="column">
              <text content="Net P&L" fg={theme.textMuted} />
              <text 
                content={fmtUsd(tradeStats().netPnl)} 
                fg={tradeStats().netPnl >= 0 ? theme.success : theme.error} 
              />
            </box>
            <box flexDirection="column">
              <text content="Avg Win/Loss" fg={theme.textMuted} />
              <text 
                content={tradeStats().avgLoss !== 0 
                  ? `${(tradeStats().avgWin / Math.abs(tradeStats().avgLoss)).toFixed(2)}R` 
                  : "N/A"} 
                fg={theme.text} 
              />
            </box>
          </box>

          <text content="" />
          <text content="MONTHLY EXECUTION" fg={theme.primary} />
          <Show
            when={monthlyStats().length > 0}
            fallback={<text content="No filled trades yet" fg={theme.textMuted} />}
          >
            <box flexDirection="row" width="100%">
              <text content="MONTH    " fg={theme.textMuted} width={9} />
              <text content="TRADES " fg={theme.textMuted} width={7} />
              <text content="VOLUME      " fg={theme.textMuted} width={12} />
              <text content="REALIZED P&L" fg={theme.textMuted} />
            </box>
            <For each={monthlyStats()}>
              {(row) => (
                <box flexDirection="row" width="100%">
                  <text content={row.month.padEnd(8, " ")} fg={theme.text} width={9} />
                  <text content={String(row.tradeCount).padStart(6, " ")} fg={theme.text} width={7} />
                  <text content={fmtCompactUsd(row.volume).padStart(11, " ")} fg={theme.textMuted} width={12} />
                  <text content={fmtUsd(row.pnl)} fg={row.pnl >= 0 ? theme.success : theme.error} />
                </box>
              )}
            </For>
          </Show>

          <text content="" />
          <text content="MARKET CONCENTRATION" fg={theme.primary} />
          <box flexDirection="row" width="100%" gap={4}>
            <box flexDirection="column">
              <text content="Top Exposure" fg={theme.textMuted} />
              <text content={`${concentration().topExposurePct.toFixed(1)}%`} fg={concentrationColor()} />
            </box>
            <box flexDirection="column">
              <text content="HHI" fg={theme.textMuted} />
              <text content={concentration().hhi.toFixed(0)} fg={concentrationColor()} />
            </box>
            <box flexDirection="column">
              <text content="Effective Mkts" fg={theme.textMuted} />
              <text content={concentration().effectiveMarketCount.toFixed(1)} fg={theme.text} />
            </box>
            <box flexDirection="column">
              <text content="Risk" fg={theme.textMuted} />
              <text content={concentration().riskLevel.toUpperCase()} fg={concentrationColor()} />
            </box>
          </box>
          <Show when={concentration().entries.length > 0}>
            <box flexDirection="row" width="100%">
              <text content="MARKET" fg={theme.textMuted} width={28} />
              <text content="EXPO" fg={theme.textMuted} width={8} />
              <text content="VALUE      " fg={theme.textMuted} width={11} />
              <text content="P&L" fg={theme.textMuted} />
            </box>
            <For each={concentration().entries.slice(0, 3)}>
              {(entry) => (
                <box flexDirection="row" width="100%">
                  <text content={entry.marketTitle.slice(0, 27).padEnd(27, " ")} fg={theme.text} width={28} />
                  <text content={`${entry.percentage.toFixed(1)}%`.padStart(7, " ")} fg={theme.textMuted} width={8} />
                  <text content={fmtCompactUsd(entry.value).padStart(10, " ")} fg={theme.textMuted} width={11} />
                  <text content={fmtUsd(entry.pnl)} fg={entry.pnl >= 0 ? theme.success : theme.error} />
                </box>
              )}
            </For>
          </Show>

          <Show when={assetAllocation().length > 0}>
            <text content="" />
            <text content="────────────────────────────────────────────────────────" fg={theme.textMuted} />
            <text content="ASSET ALLOCATION" fg={theme.primary} />

            <box flexDirection="row" width="100%" gap={3}>
              <For each={assetAllocation().slice(0, 5)}>
                {(asset) => (
                  <box flexDirection="column" width="18%">
                    <text content={asset.outcome.slice(0, 10)} fg={theme.textMuted} />
                    <text content={`${asset.percentage.toFixed(1)}%`} fg={theme.text} />
                    <text content={`$${asset.value.toFixed(2)}`} fg={theme.textMuted} />
                  </box>
                )}
              </For>
            </box>
          </Show>

        </box>
        </scrollbox>
      </Show>
    </box>
  );
}
