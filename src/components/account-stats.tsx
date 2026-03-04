import { Show, For } from "solid-js";
import { useTheme } from "../context/theme";
import { walletState, setAccountStatsOpen, authState, currentUserProfile } from "../state";
import { PanelHeader, Separator, DataRow } from "./ui/panel-components";
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

function shortAddress(value: string | null | undefined): string {
  if (!value) return "—";
  if (value.length < 14) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
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

  const healthBar = () => {
    const score = healthScore();
    const width = 20;
    const filled = Math.round((score / 100) * width);
    return "█".repeat(filled) + "░".repeat(width - filled);
  };

  const winRateBar = () => {
    const wr = tradeStats().winRate;
    const width = 16;
    const filled = Math.round((Math.min(100, wr) / 100) * width);
    return "█".repeat(filled) + "░".repeat(width - filled);
  };

  const concBar = (pct: number) => {
    const width = 12;
    const filled = Math.round((Math.min(100, pct) / 100) * width);
    return "█".repeat(filled) + "░".repeat(width - filled);
  };

  const riskLevel = (): "low" | "medium" | "high" => {
    const bal = totalBalance();
    if (bal === 0) return "low";
    const exposure = portfolioSummary().totalValue / bal;
    if (exposure < 0.3) return "low";
    if (exposure < 0.7) return "medium";
    return "high";
  };

  return (
    <box
      position="absolute"
      top={2}
      left="8%"
      width="84%"
      height={24}
      backgroundColor={theme.panelModal}
      flexDirection="column"
      zIndex={160}
    >
      <PanelHeader
        title="ACCOUNT STATISTICS"
        icon="◈"
        subtitle={`Health: ${healthScore()}%  Risk: ${riskLevel().toUpperCase()}`}
        onClose={() => setAccountStatsOpen(false)}
      />

      <Separator type="heavy" />

      <Show
        when={walletState.connected}
        fallback={
          <box flexGrow={1} paddingLeft={2} paddingTop={2}>
            <text content="○ Connect wallet to view account statistics" fg={theme.textMuted} />
            <text content="" />
            <text content="Press [W] to open wallet panel and connect." fg={theme.textMuted} />
          </box>
        }
      >
        <scrollbox flexGrow={1} width="100%">
          <box flexDirection="column" flexGrow={1} paddingLeft={1} paddingTop={1}>

            {/* Summary row */}
            <box paddingLeft={1}>
              <text content="─── ACCOUNT OWNER ───────────────────────────────────────" fg={theme.borderSubtle} />
            </box>
            <box flexDirection="row" width="100%" gap={2}>
              <box flexDirection="column" width="32%">
                <DataRow
                  label="Profile"
                  value={currentUserProfile()?.username || authState.user?.username || "Guest"}
                  valueColor="accent"
                  compact
                />
                <DataRow
                  label="Email"
                  value={currentUserProfile()?.email || authState.user?.email || "—"}
                  valueColor="muted"
                  compact
                />
              </box>
              <box flexDirection="column" width="32%">
                <DataRow label="Wallet" value={shortAddress(walletState.address)} compact />
                <DataRow
                  label="Funder"
                  value={walletState.funderAddress ? shortAddress(walletState.funderAddress) : "not set"}
                  valueColor={walletState.funderAddress ? "text" : "warning"}
                  compact
                />
              </box>
              <box flexDirection="column" width="32%">
                <DataRow label="Open Orders" value={`${ordersState.openOrders.length}`} compact />
                <DataRow label="Trade History" value={`${ordersState.tradeHistory.length}`} compact />
              </box>
            </box>

            <box paddingLeft={1}>
              <text content="─── PORTFOLIO SUMMARY ──────────────────────────────────" fg={theme.borderSubtle} />
            </box>
            <box flexDirection="row" width="100%" gap={2}>
              <box flexDirection="column" width="24%">
                <DataRow label="Cash" value={`$${walletState.balance.toFixed(2)}`} valueColor="text" compact />
                <DataRow label="Positions" value={`$${portfolioSummary().totalValue.toFixed(2)}`} valueColor="text" compact />
                <DataRow label="Total" value={`$${totalBalance().toFixed(2)}`} valueColor="accent" compact />
              </box>
              <box flexDirection="column" width="24%">
                <DataRow label="Open Pos" value={`${portfolioSummary().positionCount}`} compact />
                <DataRow
                  label="Total P&L"
                  value={fmtUsd(portfolioSummary().totalCashPnl)}
                  valueColor={portfolioSummary().totalCashPnl >= 0 ? "success" : "error"}
                  compact
                />
                <DataRow
                  label="P&L %"
                  value={fmtPct(portfolioSummary().totalPercentPnl)}
                  valueColor={portfolioSummary().totalPercentPnl >= 0 ? "success" : "error"}
                  compact
                />
              </box>
              <box flexDirection="column" width="24%">
                <box flexDirection="row">
                  <text content="Health  " fg={theme.textMuted} />
                  <text content={healthBar()} fg={healthScore() >= 70 ? theme.success : healthScore() >= 40 ? theme.warning : theme.error} />
                  <text content={` ${healthScore()}%`} fg={healthScore() >= 70 ? theme.success : healthScore() >= 40 ? theme.warning : theme.error} />
                </box>
                <DataRow
                  label="Risk Level"
                  value={riskLevel().toUpperCase()}
                  valueColor={riskLevel() === "low" ? "success" : riskLevel() === "medium" ? "warning" : "error"}
                  compact
                />
                <DataRow label="Exposure" value={`${((portfolioSummary().totalValue / Math.max(1, totalBalance())) * 100).toFixed(1)}%`} compact />
              </box>
            </box>

            {/* Trading Stats */}
            <box paddingLeft={1} paddingTop={1}>
              <text content="─── TRADING STATISTICS ─────────────────────────────────" fg={theme.borderSubtle} />
            </box>
            <box flexDirection="row" width="100%">
              <box flexDirection="column" width="33%">
                <DataRow label="Total Trades" value={`${tradeStats().totalTrades}`} compact />
                <box flexDirection="row">
                  <text content="Win Rate" fg={theme.textMuted} />
                  <text content={" " + winRateBar()} fg={tradeStats().winRate >= 50 ? theme.success : theme.error} />
                  <text content={` ${tradeStats().winRate.toFixed(1)}%`} fg={tradeStats().winRate >= 50 ? theme.success : theme.error} />
                </box>
                <DataRow label="Avg Size" value={`$${tradeStats().avgTradeSize.toFixed(2)}`} compact />
              </box>
              <box flexDirection="column" width="33%">
                <DataRow label="Total Profit" value={fmtUsd(tradeStats().totalProfit)} valueColor="success" compact />
                <DataRow label="Total Loss" value={fmtUsd(-tradeStats().totalLoss)} valueColor="error" compact />
                <DataRow
                  label="Net P&L"
                  value={fmtUsd(tradeStats().netPnl)}
                  valueColor={tradeStats().netPnl >= 0 ? "success" : "error"}
                  compact
                />
              </box>
              <box flexDirection="column" width="33%">
                <DataRow
                  label="Profit Factor"
                  value={tradeStats().profitFactor === Infinity ? "∞" : tradeStats().profitFactor.toFixed(2)}
                  valueColor={tradeStats().profitFactor >= 1.5 ? "success" : "error"}
                  compact
                />
                <DataRow
                  label="Avg Win/Loss"
                  value={tradeStats().avgLoss !== 0
                    ? `${(tradeStats().avgWin / Math.abs(tradeStats().avgLoss)).toFixed(2)}R`
                    : "N/A"}
                  compact
                />
              </box>
            </box>

            {/* Monthly Stats */}
            <box paddingLeft={1} paddingTop={1}>
              <text content="─── MONTHLY EXECUTION ──────────────────────────────────" fg={theme.borderSubtle} />
            </box>
            <Show
              when={monthlyStats().length > 0}
              fallback={
                <box paddingLeft={1}>
                  <text content="No filled trades recorded yet" fg={theme.textMuted} />
                </box>
              }
            >
              <box flexDirection="row" paddingLeft={1}>
                <text content={"MONTH".padEnd(9)} fg={theme.textMuted} width={9} />
                <text content={"TRADES".padEnd(7)} fg={theme.textMuted} width={7} />
                <text content={"VOLUME".padEnd(12)} fg={theme.textMuted} width={12} />
                <text content="REALIZED P&L" fg={theme.textMuted} />
              </box>
              <For each={monthlyStats()}>
                {(row) => (
                  <box flexDirection="row" paddingLeft={1}>
                    <text content={row.month.padEnd(8, " ")} fg={theme.text} width={9} />
                    <text content={String(row.tradeCount).padStart(6, " ")} fg={theme.text} width={7} />
                    <text content={fmtCompactUsd(row.volume).padStart(11, " ")} fg={theme.textMuted} width={12} />
                    <text content={row.pnl >= 0 ? "▲ " : "▼ "} fg={row.pnl >= 0 ? theme.success : theme.error} />
                    <text content={fmtUsd(row.pnl)} fg={row.pnl >= 0 ? theme.success : theme.error} />
                  </box>
                )}
              </For>
            </Show>

            {/* Concentration */}
            <box paddingLeft={1} paddingTop={1}>
              <text content="─── MARKET CONCENTRATION ───────────────────────────────" fg={theme.borderSubtle} />
            </box>
            <box flexDirection="row" paddingLeft={1}>
              <DataRow label="Top Exposure" value={`${concentration().topExposurePct.toFixed(1)}%`} valueColor={concentration().riskLevel === "low" ? "success" : concentration().riskLevel === "medium" ? "warning" : "error"} compact />
              <DataRow label="HHI Index" value={concentration().hhi.toFixed(0)} compact />
              <DataRow label="Eff. Markets" value={concentration().effectiveMarketCount.toFixed(1)} compact />
              <DataRow label="Conc. Risk" value={concentration().riskLevel.toUpperCase()} valueColor={concentration().riskLevel === "low" ? "success" : concentration().riskLevel === "medium" ? "warning" : "error"} compact />
            </box>
            <Show when={concentration().entries.length > 0}>
              <box flexDirection="row" paddingLeft={1}>
                <text content={"MARKET".padEnd(28)} fg={theme.textMuted} width={28} />
                <text content={"EXPO".padEnd(8)} fg={theme.textMuted} width={8} />
                <text content={"VALUE".padEnd(11)} fg={theme.textMuted} width={11} />
                <text content="P&L" fg={theme.textMuted} />
              </box>
              <For each={concentration().entries.slice(0, 3)}>
                {(entry) => (
                  <box flexDirection="row" paddingLeft={1}>
                    <text content={entry.marketTitle.slice(0, 20).padEnd(20, " ")} fg={theme.text} width={21} />
                    <text content={concBar(entry.percentage)} fg={entry.percentage > 50 ? theme.error : entry.percentage > 30 ? theme.warning : theme.textMuted} />
                    <text content={` ${entry.percentage.toFixed(1)}%`} fg={theme.textMuted} width={7} />
                    <text content={fmtCompactUsd(entry.value).padStart(9, " ")} fg={theme.textMuted} width={10} />
                    <text content={entry.pnl >= 0 ? "▲" : "▼"} fg={entry.pnl >= 0 ? theme.success : theme.error} />
                    <text content={fmtUsd(entry.pnl)} fg={entry.pnl >= 0 ? theme.success : theme.error} />
                  </box>
                )}
              </For>
            </Show>

            {/* Asset Allocation */}
            <Show when={assetAllocation().length > 0}>
              <box paddingLeft={1} paddingTop={1}>
                <text content="─── ASSET ALLOCATION ───────────────────────────────────" fg={theme.borderSubtle} />
              </box>
              <box flexDirection="column" paddingLeft={1}>
                <For each={assetAllocation().slice(0, 5)}>
                  {(asset) => {
                    const bar = (() => {
                      const w = 12; const f = Math.round((Math.min(100, asset.percentage) / 100) * w);
                      return "█".repeat(f) + "░".repeat(w - f);
                    })();
                    return (
                      <box flexDirection="row" gap={1}>
                        <text content={asset.outcome.slice(0, 10).padEnd(10)} fg={theme.textMuted} width={11} />
                        <text content={bar} fg={theme.accent} />
                        <text content={` ${asset.percentage.toFixed(1)}%`} fg={theme.text} width={7} />
                        <text content={`$${asset.value.toFixed(2)}`} fg={theme.textMuted} />
                      </box>
                    );
                  }}
                </For>
              </box>
            </Show>

            {/* Footer */}
            <text content="" />
            <box flexDirection="row" paddingLeft={1}>
              <text content="[↑↓] Scroll   [ESC] Close" fg={theme.textMuted} />
            </box>
          </box>
        </scrollbox>
      </Show>
    </box>
  );
}
