import { For, Show } from "solid-js";
import { positionsState } from "../hooks/usePositions";
import { calculatePortfolioSummary } from "../api/positions";
import { walletState } from "../state";
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

export function PortfolioPanel() {
  const { theme } = useTheme();

  const summary = () => calculatePortfolioSummary(positionsState.positions);

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
