import { Show, For } from "solid-js";
import { useTheme } from "../context/theme";
import { appState, selectMarket } from "../state";
import { currentView, comparisonMarketId, setComparisonMarket } from "./view-manager";

function fmtPct(val: number): string {
  const sign = val >= 0 ? "+" : "";
  return `${sign}${val.toFixed(1)}%`;
}

function fmtUsd(val: number): string {
  const sign = val >= 0 ? "+" : "";
  return `${sign}$${Math.abs(val).toFixed(2)}`;
}

export function ComparisonPanel() {
  const { theme } = useTheme();

  const primaryMarket = () => 
    appState.markets.find(m => m.id === appState.selectedMarketId);

  const secondaryMarket = () => 
    appState.markets.find(m => m.id === comparisonMarketId());

  const comparisonStats = () => {
    const primary = primaryMarket();
    const secondary = secondaryMarket();
    if (!primary || !secondary) return null;

    return {
      volumeDiff: secondary.volume24h - primary.volume24h,
      volumeDiffPct: primary.volume24h > 0 
        ? ((secondary.volume24h - primary.volume24h) / primary.volume24h) * 100 
        : 0,
      priceChangeDiff: secondary.change24h - primary.change24h,
      liquidityDiff: (secondary.liquidity || 0) - (primary.liquidity || 0),
    };
  };

  return (
    <Show when={currentView() === "comparison"}>
      <box flexDirection="row" width="100%" flexGrow={1} gap={1}>
        <box flexDirection="column" width="50%" flexGrow={1}>
          <box height={1} width="100%" backgroundColor={theme.primary}>
            <text content=" PRIMARY MARKET " fg={theme.highlightText} />
          </box>
          
          <Show when={primaryMarket()} fallback={
            <box flexGrow={1} justifyContent="center" alignItems="center">
              <text content="Select primary market (Enter)" fg={theme.textMuted} />
            </box>
          }>
            <box flexDirection="column" padding={1}>
              <text content={primaryMarket()!.title.slice(0, 50)} fg={theme.textBright} />
              <text content="" />
              
              <box flexDirection="row" gap={4}>
                <text content={`Vol: $${(primaryMarket()!.volume24h / 1000).toFixed(1)}K`} fg={theme.text} />
                <text 
                  content={fmtPct(primaryMarket()!.change24h)} 
                  fg={primaryMarket()!.change24h >= 0 ? theme.success : theme.error} 
                />
              </box>
              
              <text content="" />
              <text content="OUTCOMES" fg={theme.primary} />
              <For each={primaryMarket()!.outcomes}>
                {(outcome) => (
                  <box flexDirection="row" gap={2}>
                    <text content={outcome.title.slice(0, 20)} fg={theme.textMuted} width={22} />
                    <text content={`${(outcome.price * 100).toFixed(1)}¢`} fg={theme.text} />
                  </box>
                )}
              </For>
            </box>
          </Show>
        </box>

        <box flexDirection="column" width="50%" flexGrow={1}>
          <box height={1} width="100%" backgroundColor={theme.accent}>
            <text content=" COMPARISON MARKET " fg={theme.highlightText} />
          </box>
          
          <Show when={secondaryMarket()} fallback={
            <box flexGrow={1} justifyContent="center" alignItems="center">
              <text content="Press C to select comparison" fg={theme.textMuted} />
            </box>
          }>
            <box flexDirection="column" padding={1}>
              <text content={secondaryMarket()!.title.slice(0, 50)} fg={theme.textBright} />
              <text content="" />
              
              <box flexDirection="row" gap={4}>
                <text content={`Vol: $${(secondaryMarket()!.volume24h / 1000).toFixed(1)}K`} fg={theme.text} />
                <text 
                  content={fmtPct(secondaryMarket()!.change24h)} 
                  fg={secondaryMarket()!.change24h >= 0 ? theme.success : theme.error} 
                />
              </box>
              
              <text content="" />
              <text content="OUTCOMES" fg={theme.primary} />
              <For each={secondaryMarket()!.outcomes}>
                {(outcome) => (
                  <box flexDirection="row" gap={2}>
                    <text content={outcome.title.slice(0, 20)} fg={theme.textMuted} width={22} />
                    <text content={`${(outcome.price * 100).toFixed(1)}¢`} fg={theme.text} />
                  </box>
                )}
              </For>
            </box>
          </Show>
        </box>
      </box>

      <Show when={comparisonStats()}>
        <box height={3} width="100%" backgroundColor={theme.backgroundPanel}>
          <box flexDirection="column" paddingLeft={1}>
            <text content="COMPARISON" fg={theme.primary} />
            <text 
              content={`Volume: ${comparisonStats()!.volumeDiff >= 0 ? "+" : ""}$${(comparisonStats()!.volumeDiff / 1000).toFixed(1)}K (${fmtPct(comparisonStats()!.volumeDiffPct)})`} 
              fg={comparisonStats()!.volumeDiff >= 0 ? theme.success : theme.error} 
            />
            <text 
              content={`24h Change: ${comparisonStats()!.priceChangeDiff >= 0 ? "+" : ""}${comparisonStats()!.priceChangeDiff.toFixed(1)}%`} 
              fg={comparisonStats()!.priceChangeDiff >= 0 ? theme.success : theme.error} 
            />
          </box>
        </box>
      </Show>
    </Show>
  );
}

export { comparisonMarketId, setComparisonMarket };
