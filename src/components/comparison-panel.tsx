import { Show, For } from "solid-js";
import { useTheme } from "../context/theme";
import {
  appState,
  getFilteredMarkets,
  highlightedIndex,
  comparisonSelectMode,
  setComparisonPanelOpen,
  setComparisonSelectMode,
  setComparisonSelectedMarketId,
  navigateToIndex,
} from "../state";

function fmtPct(val: number): string {
  const sign = val >= 0 ? "+" : "";
  return `${sign}${val.toFixed(1)}%`;
}

interface ComparisonPanelProps {
  secondaryMarketId: string | null;
}

export function ComparisonPanel(props: ComparisonPanelProps) {
  const { theme } = useTheme();

  const primaryMarket = () =>
    appState.markets.find(m => m.id === appState.selectedMarketId);

  const secondaryMarket = () =>
    props.secondaryMarketId
      ? appState.markets.find(m => m.id === props.secondaryMarketId)
      : undefined;

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

  const handleClose = () => { setComparisonPanelOpen(false); setComparisonSelectedMarketId(null); };

  return (
    <box
      position="absolute"
      top={2}
      left="4%"
      width="92%"
      height={28}
      backgroundColor={theme.panelModal}
      flexDirection="column"
      zIndex={160}
    >
      {/* Header */}
      <box height={1} width="100%" backgroundColor={theme.accent} flexDirection="row">
        <text content=" ◈ MARKET COMPARISON " fg={theme.highlightText} />
        <box flexGrow={1} />
        <Show when={comparisonSelectMode()}>
          <text content=" SELECT ↑↓ ENTER " fg={theme.highlightText} />
        </Show>
        <Show when={!comparisonSelectMode()}>
          <box onMouseDown={() => setComparisonSelectMode(true)}>
            <text content=" [C] Change " fg={theme.highlightText} />
          </box>
        </Show>
        <box onMouseDown={handleClose}>
          <text content=" [ESC] ✕ " fg={theme.highlightText} />
        </box>
      </box>

      {/* Separator */}
      <box height={1} width="100%" backgroundColor={theme.accentMuted} />

      <Show when={comparisonSelectMode()}>
        <box flexDirection="column" flexGrow={1} paddingLeft={2} paddingTop={1}>
          <text content="Select comparison market — click or ↑↓ + ENTER" fg={theme.textMuted} />
          <text content="" />
          <scrollbox flexGrow={1} width="100%">
            <For each={getFilteredMarkets()}>
              {(market, i) => {
                const isHl = () => i() === highlightedIndex();
                return (
                  <box
                    flexDirection="row"
                    width="100%"
                    backgroundColor={isHl() ? theme.highlight : undefined}
                    onMouseDown={() => {
                      navigateToIndex(i());
                      setComparisonSelectedMarketId(market.id);
                      setComparisonSelectMode(false);
                    }}
                  >
                    <text content={isHl() ? " ▶ " : "   "} fg={theme.accent} width={3} />
                    <text content={(i() + 1).toString().padStart(2, " ")} fg={isHl() ? theme.highlightText : theme.textMuted} width={4} />
                    <text content={market.title.slice(0, 55)} fg={isHl() ? theme.highlightText : theme.text} width={57} />
                    <text content={`${(market.outcomes[0]?.price * 100 || 0).toFixed(1)}¢`} fg={isHl() ? theme.highlightText : theme.textMuted} />
                  </box>
                );
              }}
            </For>
          </scrollbox>
        </box>
      </Show>

      <Show when={!comparisonSelectMode()}>
        <box flexDirection="column" flexGrow={1} width="100%" paddingLeft={1}>
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
                  <text content="Press [C] to select comparison" fg={theme.textMuted} />
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
        </box>
      </Show>
    </box>
  );
}
