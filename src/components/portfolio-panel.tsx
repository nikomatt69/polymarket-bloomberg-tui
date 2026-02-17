import { For, Show, createMemo } from "solid-js";
import { positionsState } from "../hooks/usePositions";
import { calculatePortfolioSummary } from "../api/positions";
import { walletState } from "../state";
import { ordersState } from "../hooks/useOrders";
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

interface AccountStats {
  tradeCount: number;
  winCount: number;
  winRate: string;
  avgSize: string;
  avgPnl: string;
  bestTrade: string;
  worstTrade: string;
  totalVolume: string;
}

function calcAccountStats(positions: Array<{ cashPnl: number; currentValue: number; size: number }>): AccountStats {
  const all = positions;
  if (all.length === 0) {
    return { tradeCount: 0, winCount: 0, winRate: "N/A", avgSize: "N/A", avgPnl: "N/A", bestTrade: "N/A", worstTrade: "N/A", totalVolume: "N/A" };
  }
  const wins = all.filter((p) => p.cashPnl > 0).length;
  const totalPnl = all.reduce((s, p) => s + p.cashPnl, 0);
  const totalVol = all.reduce((s, p) => s + p.currentValue, 0);
  const avgSizeVal = all.reduce((s, p) => s + p.size, 0) / all.length;
  const pnls = all.map((p) => p.cashPnl);
  const best = Math.max(...pnls);
  const worst = Math.min(...pnls);
  return {
    tradeCount: all.length,
    winCount: wins,
    winRate: `${((wins / all.length) * 100).toFixed(1)}%`,
    avgSize: avgSizeVal.toFixed(1),
    avgPnl: fmtUsd(totalPnl / all.length),
    bestTrade: fmtUsd(best),
    worstTrade: fmtUsd(worst),
    totalVolume: `$${totalVol.toFixed(2)}`,
  };
}

export function PortfolioPanel() {
  const { theme } = useTheme();

  const summary = () => calculatePortfolioSummary(positionsState.positions);

  const accountStats = createMemo(() =>
    calcAccountStats(positionsState.positions)
  );

  const lastFetchStr = () => {
    const d = positionsState.lastFetch;
    return d ? new Date(d).toLocaleTimeString() : "never";
  };

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

              <text content="" />

              {/* Column headers */}
              <box flexDirection="row" width="100%">
                <text content="MARKET" fg={theme.textMuted} width={32} />
                <text content="OUT" fg={theme.textMuted} width={5} />
                <text content="SHARES" fg={theme.textMuted} width={9} />
                <text content="AVG" fg={theme.textMuted} width={7} />
                <text content="CUR" fg={theme.textMuted} width={7} />
                <text content="VALUE" fg={theme.textMuted} width={9} />
                <text content="P&L $" fg={theme.textMuted} width={10} />
                <text content="P&L %" fg={theme.textMuted} width={8} />
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
                        <text content={truncate(position.title, 31)} fg={theme.text} width={32} />
                        <text content={position.outcome.slice(0, 4).padEnd(4, " ")} fg={theme.accent} width={5} />
                        <text content={position.size.toFixed(1).padStart(8, " ")} fg={theme.text} width={9} />
                        <text content={fmtPrice(position.avgPrice).padStart(6, " ")} fg={theme.textMuted} width={7} />
                        <text content={fmtPrice(position.curPrice).padStart(6, " ")} fg={theme.text} width={7} />
                        <text content={`$${position.currentValue.toFixed(2)}`.padStart(8, " ")} fg={theme.text} width={9} />
                        <text
                          content={fmtUsd(position.cashPnl).padStart(9, " ")}
                          fg={position.cashPnl >= 0 ? theme.success : theme.error}
                          width={10}
                        />
                        <text
                          content={fmtPct(position.percentPnl).padStart(7, " ")}
                          fg={position.percentPnl >= 0 ? theme.success : theme.error}
                          width={8}
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
