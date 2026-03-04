import { For, Show, createMemo } from "solid-js";
import { positionsState } from "../hooks/usePositions";
import { ordersState } from "../hooks/useOrders";
import { calculatePortfolioSummary } from "../api/positions";
import {
  walletState,
  appState,
  portfolioTab,
  setPortfolioTab,
  highlightedIndex,
  setHighlightedIndex,
  setPortfolioOpen,
  setOrderFormOpen,
  setOrderFormTokenId,
  setOrderFormSide,
  setOrderFormMarketTitle,
  setOrderFormOutcomeTitle,
  setOrderFormCurrentPrice,
  setOrderFormPriceInput,
  setOrderFormSharesInput,
} from "../state";
import { calculateMonthlyStats, calculateTradeStats, calculateMarketConcentration, calculateSharpeRatio, calculateMaxDrawdown, calculatePnLTimeSeries, calculatePositionRisk } from "../utils/analytics";
import { sparkline } from "../utils/charts";
import { useTheme } from "../context/theme";
import { PanelHeader, SectionTitle, DataRow, Separator, StatusBadge, TabBar } from "./ui/panel-components";

const PORTFOLIO_TABS = ["OVERVIEW", "POSITIONS", "ANALYTICS", "HISTORY"] as const;
type PortfolioTabLabel = typeof PORTFOLIO_TABS[number];

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
  if (exp >= 1000) return `$${(exp / 1000).toFixed(1)}K`;
  return `$${exp.toFixed(0)}`;
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

  const activeTab = createMemo(() => {
    const t = portfolioTab();
    if (t === "overview") return "OVERVIEW";
    if (t === "positions") return "POSITIONS";
    if (t === "analytics") return "ANALYTICS";
    return "HISTORY";
  });

  const handleTabChange = (tab: string) => {
    const t = tab.toLowerCase() as "overview" | "positions" | "analytics" | "history";
    setPortfolioTab(t);
  };

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
    return ordersState.tradeHistory
      .filter((o) => (o.status === "FILLED" || o.status === "MATCHED") && o.createdAt >= weekAgo)
      .reduce((sum, o) => sum + o.price * o.sizeMatched, 0);
  });

  const dailyPnl = createMemo(() => {
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    return ordersState.tradeHistory
      .filter((o) => (o.status === "FILLED" || o.status === "MATCHED") && o.createdAt >= dayAgo)
      .reduce((sum, o) => sum + o.price * o.sizeMatched, 0);
  });

  const realizedPnl = createMemo(() =>
    positionsState.positions.reduce((sum, p) => p.initialValue > 0 ? sum + p.cashPnl : sum, 0)
  );

  const unrealizedPnl = createMemo(() => summary().totalCashPnl - realizedPnl());

  const lastFetchStr = () => {
    const d = positionsState.lastFetch;
    return d ? new Date(d).toLocaleTimeString() : "never";
  };

  const analytics = () => positionsState.positionsAnalytics;

  const concentrationRisk = createMemo(() =>
    calculateMarketConcentration(positionsState.positions)
  );

  const tradeStats = createMemo(() => {
    const filledOrders = ordersState.tradeHistory.filter(
      (o) => o.status === "FILLED" || o.status === "MATCHED"
    );
    return calculateTradeStats(filledOrders, positionsState.positions);
  });

  const pnlTimeSeries = createMemo(() =>
    calculatePnLTimeSeries(ordersState.tradeHistory, positionsState.positions)
  );

  const sharpeRatio = createMemo(() =>
    calculateSharpeRatio(pnlTimeSeries().map(e => e.pnl))
  );

  const maxDrawdown = createMemo(() =>
    calculateMaxDrawdown(pnlTimeSeries().map(e => e.value))
  );

  const equitySparkline = createMemo(() =>
    sparkline(pnlTimeSeries().map(e => e.value), 16)
  );

  const positionRisks = createMemo(() =>
    calculatePositionRisk(
      positionsState.positions,
      appState.markets.map(m => ({ id: m.id, volume: m.volume, prices: m.outcomes.map(o => o.price) }))
    )
  );

  return (
    <box flexDirection="column" width="100%" flexGrow={1} padding={1}>
      {/* Header */}
      <PanelHeader
        title="PORTFOLIO"
        icon="◈"
        subtitle={`Updated: ${lastFetchStr()}`}
      />

      <Separator type="light" />

      <Show
        when={!walletState.connected}
        fallback={
          <Show
            when={!positionsState.loading}
            fallback={
              <box padding={1}>
                <text content="◌ Fetching positions…" fg={theme.textMuted} />
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
              {/* ── Tab bar ───────────────────────────────────────────────── */}
              <TabBar
                tabs={["OVERVIEW", "POSITIONS", "ANALYTICS", "HISTORY"]}
                activeTab={activeTab()}
                onTabChange={handleTabChange}
              />
              <Separator type="light" />

              {/* ══════════════════════════════════════════════════════════ */}
              {/* OVERVIEW tab                                               */}
              {/* ══════════════════════════════════════════════════════════ */}
              <Show when={portfolioTab() === "overview"}>
                <box flexDirection="column" width="100%">
                  {/* Key metrics row */}
                  <box flexDirection="row" width="100%" gap={2} paddingTop={1}>
                    <text content={`Value: $${summary().totalValue.toFixed(2)}`} fg={theme.textBright} />
                    <text
                      content={`P&L: ${fmtUsd(summary().totalCashPnl)}`}
                      fg={summary().totalCashPnl >= 0 ? theme.success : theme.error}
                    />
                    <text
                      content={fmtPct(summary().totalPercentPnl)}
                      fg={summary().totalPercentPnl >= 0 ? theme.success : theme.error}
                    />
                    <text content={`${summary().positionCount} positions`} fg={theme.textMuted} />
                  </box>

                  {/* Equity sparkline */}
                  <Show when={equitySparkline().length > 0}>
                    <box flexDirection="row" gap={2} paddingTop={1}>
                      <text content="Equity: " fg={theme.textMuted} />
                      <text content={equitySparkline()} fg={summary().totalCashPnl >= 0 ? theme.success : theme.error} />
                    </box>
                  </Show>

                  {/* Metrics grid */}
                  <box flexDirection="column" paddingTop={1}>
                    <text content="─── PERFORMANCE ───" fg={theme.borderSubtle} />
                    <box flexDirection="row" width="100%" gap={4}>
                      <box width={22}>
                        <DataRow
                          label="Sharpe Ratio"
                          value={Number.isFinite(sharpeRatio()) ? sharpeRatio().toFixed(2) : "N/A"}
                          valueColor={sharpeRatio() >= 1 ? "success" : sharpeRatio() >= 0 ? "warning" : "error"}
                        />
                      </box>
                      <box width={22}>
                        <DataRow
                          label="Max Drawdown"
                          value={`${maxDrawdown().toFixed(1)}%`}
                          valueColor={maxDrawdown() > 20 ? "error" : maxDrawdown() > 10 ? "warning" : "success"}
                        />
                      </box>
                    </box>
                    <box flexDirection="row" width="100%" gap={4} paddingLeft={1}>
                      <text content="Win Rate" fg={theme.textMuted} />
                      <text
                        content={"█".repeat(Math.round(parseFloat(accountStats().winRate) / 100 * 20)) + "░".repeat(20 - Math.round(parseFloat(accountStats().winRate) / 100 * 20))}
                        fg={parseFloat(accountStats().winRate) >= 50 ? theme.success : theme.error}
                      />
                      <text
                        content={accountStats().winRate}
                        fg={parseFloat(accountStats().winRate) >= 50 ? theme.success : theme.error}
                      />
                    </box>
                    <box flexDirection="row" width="100%" gap={4}>
                      <box width={22}>
                        <DataRow
                          label="Profit Factor"
                          value={tradeStats().profitFactor === Infinity ? "∞" : tradeStats().profitFactor.toFixed(2)}
                          valueColor="muted"
                        />
                      </box>
                    </box>
                    <text content="─── EXPOSURE ───" fg={theme.borderSubtle} />
                    <box flexDirection="row" width="100%" gap={4}>
                      <box width={22}>
                        <DataRow
                          label="Exposure"
                          value={fmtExposure(positionsState.positions.reduce((s, p) => s + p.size, 0), 1)}
                          valueColor="muted"
                        />
                      </box>
                      <box width={22}>
                        <DataRow
                          label="Risk Level"
                          value={concentrationRisk().riskLevel.toUpperCase()}
                          valueColor={concentrationRisk().riskLevel === "high" ? "error" : concentrationRisk().riskLevel === "medium" ? "warning" : "success"}
                        />
                      </box>
                    </box>
                    <box flexDirection="row" width="100%" gap={4}>
                      <box width={22}>
                        <DataRow
                          label="Realized P&L"
                          value={fmtUsd(realizedPnl())}
                          valueColor={realizedPnl() >= 0 ? "success" : "error"}
                        />
                      </box>
                      <box width={22}>
                        <DataRow
                          label="Unrealized P&L"
                          value={fmtUsd(unrealizedPnl())}
                          valueColor={unrealizedPnl() >= 0 ? "success" : "error"}
                        />
                      </box>
                    </box>
                  </box>

                  {/* Streak + best/worst quick view */}
                  <box flexDirection="row" width="100%" gap={3} paddingTop={1}>
                    <text
                      content={`Streak: ${accountStats().streakType === "none" ? "N/A" : `${accountStats().currentStreak} ${accountStats().streakType.toUpperCase()}(S)`}`}
                      fg={accountStats().streakType === "win" ? theme.success : accountStats().streakType === "loss" ? theme.error : theme.textMuted}
                    />
                    <text content={`Best: ${accountStats().bestTrade}`} fg={theme.success} />
                    <text content={`Worst: ${accountStats().worstTrade}`} fg={theme.error} />
                  </box>

                  <box flexDirection="row" width="100%" gap={3}>
                    <text content={`Avg Entry: ${fmtPrice(analytics().weightedAvgEntry)}`} fg={theme.textMuted} />
                    <text content={`Avg P&L: ${accountStats().avgPnl}`} fg={theme.textMuted} />
                    <text content={`Avg Size: ${accountStats().avgSize} shr`} fg={theme.textMuted} />
                  </box>

                  <text content="" />
                  <text content="[Tab] switch tabs  [click] sell position" fg={theme.borderSubtle} />
                </box>
              </Show>

              {/* ══════════════════════════════════════════════════════════ */}
              {/* POSITIONS tab                                              */}
              {/* ══════════════════════════════════════════════════════════ */}
              <Show when={portfolioTab() === "positions"}>
                <box flexDirection="column" width="100%">
                  {/* Column headers */}
                  <box flexDirection="row" width="100%" backgroundColor={theme.backgroundPanel} paddingTop={1}>
                    <text content="MARKET" fg={theme.textMuted} width={19} />
                    <text content="OUT" fg={theme.textMuted} width={5} />
                    <text content="SHR" fg={theme.textMuted} width={7} />
                    <text content="ENTRY" fg={theme.textMuted} width={7} />
                    <text content="CUR" fg={theme.textMuted} width={7} />
                    <text content="P&L $" fg={theme.textMuted} width={9} />
                    <text content="ROI" fg={theme.textMuted} width={7} />
                    <text content="RSK" fg={theme.textMuted} width={5} />
                    <text content="ACTION" fg={theme.textMuted} width={6} />
                  </box>
                  <Separator type="light" />

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
                        {(position, idx) => {
                          const riskScore = () => positionRisks().find(r => r.positionId === position.asset)?.score ?? 0;
                          const riskColor = () => riskScore() > 70 ? theme.error : riskScore() > 40 ? theme.warning : theme.success;
                          const market = () => appState.markets.find(m => m.id === position.asset || (m as any).conditionId === position.conditionId);
                          const trendSpark = () => {
                            const m = market();
                            const arrow = position.cashPnl > 0 ? "▲" : position.cashPnl < 0 ? "▼" : "─";
                            if (!m) return `${arrow}─────`;
                            return `${arrow}${sparkline(m.outcomes.map(o => o.price), 5)}`;
                          };
                          const rowBg = () => position.cashPnl > 0 ? theme.successMuted : position.cashPnl < 0 ? theme.errorMuted : undefined;
                          const handleClick = () => {
                            // Open sell order form pre-filled with position data
                            setOrderFormTokenId(position.asset);
                            setOrderFormSide("SELL");
                            setOrderFormMarketTitle(position.title);
                            setOrderFormOutcomeTitle(position.outcome);
                            setOrderFormCurrentPrice(position.curPrice);
                            // Default to market price
                            setOrderFormPriceInput(position.curPrice.toFixed(2));
                            // Pre-fill with entire position size for quick cashout
                            setOrderFormSharesInput(position.size.toFixed(4));
                            setOrderFormOpen(true);
                          };
                          const handleNavigate = (e: { name: string }) => {
                            // Navigate to market on Enter key
                            if (e.name === "enter") {
                              const m = market();
                              if (m) {
                                const marketIdx = appState.markets.findIndex(mk => mk.id === m.id);
                                if (marketIdx >= 0) {
                                  setHighlightedIndex(marketIdx);
                                  setPortfolioOpen(false);
                                }
                              }
                            }
                          };
                          return (
                            <box
                              flexDirection="row"
                              width="100%"
                              backgroundColor={rowBg()}
                              onMouseDown={handleClick}
                            >
                              <text content={truncate(position.title, 18)} fg={theme.text} width={19} />
                              <text content={position.outcome.slice(0, 4).padEnd(4, " ")} fg={theme.accent} width={5} />
                              <text content={position.size.toFixed(1).padStart(6, " ")} fg={theme.text} width={7} />
                              <text content={fmtPrice(position.avgPrice).padStart(6, " ")} fg={theme.textMuted} width={7} />
                              <text content={fmtPrice(position.curPrice).padStart(6, " ")} fg={theme.text} width={7} />
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
                                content={riskScore().toString().padStart(4, " ")}
                                fg={riskColor()}
                                width={5}
                              />
                              <text content="SELL" fg={theme.error} width={5} />
                            </box>
                          );
                        }}
                      </For>
                    </scrollbox>
                  </Show>
                </box>
              </Show>

              {/* ══════════════════════════════════════════════════════════ */}
              {/* ANALYTICS tab                                              */}
              {/* ══════════════════════════════════════════════════════════ */}
              <Show when={portfolioTab() === "analytics"}>
                <box flexDirection="column" width="100%">
                  {/* Sector Allocation */}
                  <Show when={analytics().sectorAllocations.length > 0}>
                    <SectionTitle title="Sector Allocation" icon="◉" />
                    <box flexDirection="row" width="100%" backgroundColor={theme.backgroundPanel}>
                      <text content="SECTOR" fg={theme.textMuted} width={14} />
                      <text content="VALUE" fg={theme.textMuted} width={10} />
                      <text content="ALLOC BAR       " fg={theme.textMuted} width={22} />
                      <text content="POS" fg={theme.textMuted} width={5} />
                      <text content="P&L" fg={theme.textMuted} width={10} />
                    </box>
                    <For each={analytics().sectorAllocations.slice(0, 8)}>
                      {(sector) => {
                        const allocFilled = Math.round(Math.max(0, Math.min(100, sector.percentage)) / 100 * 15);
                        const allocBar = "█".repeat(allocFilled) + "░".repeat(15 - allocFilled);
                        return (
                          <box flexDirection="row" width="100%">
                            <text content={sector.sector.padEnd(13, " ")} fg={theme.text} width={14} />
                            <text content={fmtValue(sector.value).padStart(9, " ")} fg={theme.textMuted} width={10} />
                            <text content={allocBar} fg={theme.accent} width={16} />
                            <text content={`${sector.percentage.toFixed(1)}%`.padStart(6, " ")} fg={theme.accent} width={7} />
                            <text content={sector.positionCount.toString().padStart(4, " ")} fg={theme.textMuted} width={5} />
                            <text
                              content={fmtUsd(sector.pnl).padStart(9, " ")}
                              fg={sector.pnl >= 0 ? theme.success : theme.error}
                              width={10}
                            />
                          </box>
                        );
                      }}
                    </For>
                  </Show>

                  {/* Concentration Risk */}
                  <SectionTitle title="Risk Profile" icon="⚡" />
                  <DataRow label="Concentration Risk" value={concentrationRisk().riskLevel.toUpperCase()} valueColor={concentrationRisk().riskLevel === "high" ? "error" : concentrationRisk().riskLevel === "medium" ? "warning" : "success"} />
                  <DataRow label="Weighted Avg Entry" value={fmtPrice(analytics().weightedAvgEntry)} valueColor="muted" />
                  <DataRow label="Profit Factor" value={tradeStats().profitFactor === Infinity ? "∞" : tradeStats().profitFactor.toFixed(2)} valueColor="muted" />

                  {/* Performance Leaders */}
                  <Show when={analytics().topPerformers.length > 0 || analytics().bottomPerformers.length > 0}>
                    <SectionTitle title="Performance Leaders" icon="★" />
                    <box flexDirection="row" width="100%">
                      <text content="TOP WINNERS" fg={theme.success} width={22} />
                      <text content="TOP LOSERS" fg={theme.error} width={22} />
                    </box>
                    <For each={[0, 1, 2]}>
                      {(idx) => (
                        <box flexDirection="row" width="100%">
                          <Show when={analytics().topPerformers[idx]}>
                            <text
                              content={`${truncate(analytics().topPerformers[idx]!.title, 16)} ${fmtUsd(analytics().topPerformers[idx]!.pnl)}`}
                              fg={theme.success}
                              width={22}
                            />
                          </Show>
                          <Show when={!analytics().topPerformers[idx]}>
                            <text content="─" fg={theme.textMuted} width={22} />
                          </Show>
                          <Show when={analytics().bottomPerformers[idx]}>
                            <text
                              content={`${truncate(analytics().bottomPerformers[idx]!.title, 16)} ${fmtUsd(analytics().bottomPerformers[idx]!.pnl)}`}
                              fg={theme.error}
                              width={22}
                            />
                          </Show>
                          <Show when={!analytics().bottomPerformers[idx]}>
                            <text content="─" fg={theme.textMuted} width={22} />
                          </Show>
                        </box>
                      )}
                    </For>
                  </Show>
                </box>
              </Show>

              {/* ══════════════════════════════════════════════════════════ */}
              {/* HISTORY tab                                                */}
              {/* ══════════════════════════════════════════════════════════ */}
              <Show when={portfolioTab() === "history"}>
                <box flexDirection="column" width="100%">
                  {/* Realized / Unrealized summary */}
                  <SectionTitle title="P&L Summary" icon="◈" />
                  <box flexDirection="row" width="100%" gap={3}>
                    <text content={`Realized: ${fmtUsd(realizedPnl())}`} fg={realizedPnl() >= 0 ? theme.success : theme.error} />
                    <text content={`Unrealized: ${fmtUsd(unrealizedPnl())}`} fg={unrealizedPnl() >= 0 ? theme.success : theme.error} />
                  </box>
                  <box flexDirection="row" width="100%" gap={3}>
                    <text content={`Daily Vol: ${fmtUsd(dailyPnl())}`} fg={theme.textMuted} />
                    <text content={`Weekly Vol: ${fmtUsd(weeklyPnl())}`} fg={theme.textMuted} />
                  </box>

                  {/* Monthly P&L */}
                  <Show when={monthlyStats().length > 0}>
                    <SectionTitle title="Monthly P&L" icon="📅" />
                    <box flexDirection="row" width="100%" backgroundColor={theme.backgroundPanel}>
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

                  {/* Recent fills */}
                  <Show when={ordersState.tradeHistory.length > 0}>
                    <SectionTitle title="Recent Fills" icon="⬛" />
                    <box flexDirection="row" width="100%" backgroundColor={theme.backgroundPanel}>
                      <text content="MARKET" fg={theme.textMuted} width={28} />
                      <text content="SIDE" fg={theme.textMuted} width={5} />
                      <text content="PRICE" fg={theme.textMuted} width={7} />
                      <text content="FILLED" fg={theme.textMuted} width={9} />
                      <text content="STATUS" fg={theme.textMuted} width={10} />
                    </box>
                    <scrollbox width="100%">
                      <For each={ordersState.tradeHistory.slice(0, 20)}>
                        {(order) => (
                          <box flexDirection="row" width="100%">
                            <text content={truncate(order.marketTitle ?? "—", 27)} fg={theme.text} width={28} />
                            <text
                              content={order.side.padEnd(4, " ")}
                              fg={order.side === "BUY" ? theme.success : theme.error}
                              width={5}
                            />
                            <text content={`${(order.price * 100).toFixed(1)}¢`.padStart(6, " ")} fg={theme.text} width={7} />
                            <text content={order.sizeMatched.toFixed(1).padStart(8, " ")} fg={theme.textMuted} width={9} />
                            <text content={order.status} fg={theme.textMuted} width={10} />
                          </box>
                        )}
                      </For>
                    </scrollbox>
                  </Show>
                </box>
              </Show>

            </Show>
          </Show>
        }
      >
        <box padding={1}>
          <text content="Connect wallet (W) to view portfolio" fg={theme.textMuted} />
        </box>
      </Show>
    </box>
  );
}
