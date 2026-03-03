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
import { PanelHeader, Separator, DataRow } from "./ui/panel-components";

function fmtPct(val: number): string {
  const sign = val >= 0 ? "+" : "";
  return `${sign}${val.toFixed(1)}%`;
}

function fmtVol(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
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
      <PanelHeader
        title="MARKET COMPARISON"
        icon="◈"
        subtitle={comparisonSelectMode() ? "SELECT MODE — ↑↓ ENTER" : undefined}
        onClose={handleClose}
      >
        <Show when={!comparisonSelectMode()}>
          <box onMouseDown={() => setComparisonSelectMode(true)}>
            <text content=" [C] Change Market " fg={theme.primaryMuted} />
          </box>
        </Show>
      </PanelHeader>

      <Separator type="heavy" />

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
        <box flexDirection="column" flexGrow={1} width="100%" paddingLeft={1} paddingTop={1}>
          <box flexDirection="row" width="100%" flexGrow={1} gap={1}>
            {/* Primary Market column */}
            <box flexDirection="column" width="50%" flexGrow={1}>
              <box height={1} width="100%" backgroundColor={theme.primary}>
                <text content=" ◈ PRIMARY MARKET " fg={theme.highlightText} />
              </box>

              <Show when={primaryMarket()} fallback={
                <box flexGrow={1} paddingLeft={2} paddingTop={1}>
                  <text content="Select primary market (↑↓ to navigate)" fg={theme.textMuted} />
                </box>
              }>
                <box flexDirection="column" paddingLeft={1} paddingTop={1}>
                  <text content={primaryMarket()!.title.slice(0, 50)} fg={theme.accent} />
                  <text content="" />

                  <DataRow label="24h Volume" value={fmtVol(primaryMarket()!.volume24h)} />
                  <DataRow
                    label="24h Change"
                    value={fmtPct(primaryMarket()!.change24h)}
                    valueColor={primaryMarket()!.change24h >= 0 ? "success" : "error"}
                  />
                  <DataRow label="Liquidity" value={fmtVol(primaryMarket()!.liquidity || 0)} valueColor="muted" />

                  <text content="" />
                  <text content="OUTCOMES" fg={theme.primary} />
                  <For each={primaryMarket()!.outcomes}>
                    {(outcome) => (
                      <box flexDirection="row" gap={2}>
                        <text content={outcome.title.slice(0, 20)} fg={theme.textMuted} width={22} />
                        <text
                          content={`${(outcome.price * 100).toFixed(1)}¢`}
                          fg={outcome.price > 0.6 ? theme.success : outcome.price > 0.4 ? theme.warning : theme.error}
                        />
                      </box>
                    )}
                  </For>
                </box>
              </Show>
            </box>

            {/* Secondary Market column */}
            <box flexDirection="column" width="50%" flexGrow={1}>
              <box height={1} width="100%" backgroundColor={theme.accent}>
                <text content=" ◈ COMPARISON MARKET " fg={theme.highlightText} />
              </box>

              <Show when={secondaryMarket()} fallback={
                <box flexGrow={1} paddingLeft={2} paddingTop={1}>
                  <text content="Press [C] to select comparison market" fg={theme.textMuted} />
                </box>
              }>
                <box flexDirection="column" paddingLeft={1} paddingTop={1}>
                  <text content={secondaryMarket()!.title.slice(0, 50)} fg={theme.accent} />
                  <text content="" />

                  <DataRow label="24h Volume" value={fmtVol(secondaryMarket()!.volume24h)} />
                  <DataRow
                    label="24h Change"
                    value={fmtPct(secondaryMarket()!.change24h)}
                    valueColor={secondaryMarket()!.change24h >= 0 ? "success" : "error"}
                  />
                  <DataRow label="Liquidity" value={fmtVol(secondaryMarket()!.liquidity || 0)} valueColor="muted" />

                  <text content="" />
                  <text content="OUTCOMES" fg={theme.accent} />
                  <For each={secondaryMarket()!.outcomes}>
                    {(outcome) => (
                      <box flexDirection="row" gap={2}>
                        <text content={outcome.title.slice(0, 20)} fg={theme.textMuted} width={22} />
                        <text
                          content={`${(outcome.price * 100).toFixed(1)}¢`}
                          fg={outcome.price > 0.6 ? theme.success : outcome.price > 0.4 ? theme.warning : theme.error}
                        />
                      </box>
                    )}
                  </For>
                </box>
              </Show>
            </box>
          </box>

          {/* Comparison stats bar */}
          <Show when={comparisonStats()}>
            <Separator type="heavy" />
            <box flexDirection="row" paddingLeft={2} paddingRight={2} width="100%">
              <text content="─── DIFFERENTIAL " fg={theme.borderSubtle} />
              <box flexGrow={1} />
              <text
                content={`Vol: ${comparisonStats()!.volumeDiff >= 0 ? "+" : ""}${fmtVol(comparisonStats()!.volumeDiff)} (${fmtPct(comparisonStats()!.volumeDiffPct)})`}
                fg={comparisonStats()!.volumeDiff >= 0 ? theme.success : theme.error}
              />
              <text content="  " />
              <text
                content={`Chg: ${fmtPct(comparisonStats()!.priceChangeDiff)}`}
                fg={comparisonStats()!.priceChangeDiff >= 0 ? theme.success : theme.error}
              />
              <text content="  " />
              <text
                content={`Liq: ${comparisonStats()!.liquidityDiff >= 0 ? "+" : ""}${fmtVol(comparisonStats()!.liquidityDiff)}`}
                fg={comparisonStats()!.liquidityDiff >= 0 ? theme.success : theme.error}
              />
            </box>
          </Show>

          {/* Footer hints */}
          <box height={1} flexDirection="row" paddingLeft={2} backgroundColor={theme.backgroundPanel}>
            <text content="[C] Select Market   [↑↓] Navigate   [ESC] Close" fg={theme.textMuted} />
          </box>
        </box>
      </Show>
    </box>
  );
}
