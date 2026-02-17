import { Show, createSignal, createEffect, createMemo } from "solid-js";
import { appState, getSelectedMarket } from "../state";
import { usePriceHistory } from "../hooks/useMarketData";
import { PriceHistory, Market } from "../types/market";
import { Chart } from "./chart";
import { OutcomeTable } from "./outcome-table";
import { formatDate, formatVolume } from "../utils/format";
import { useTheme } from "../context/theme";

export function MarketDetails() {
  const { theme } = useTheme();
  const [priceHistory, setPriceHistory] = createSignal<PriceHistory | undefined>();
  const selectedMarket = createMemo(() => getSelectedMarket());

  createEffect(async () => {
    if (!appState.selectedMarketId) {
      setPriceHistory(undefined);
      return;
    }
    const history = await usePriceHistory(appState.selectedMarketId, appState.timeframe);
    setPriceHistory(history ?? undefined);
  });

  return (
    <scrollbox flexGrow={1} width="100%" padding={1}>
      <Show
        when={selectedMarket()}
        fallback={
          <box flexGrow={1} justifyContent="center" alignItems="center">
            <text content="No market selected" fg={theme.textMuted} />
          </box>
        }
      >
        {(market: () => Market) => (
          <box flexDirection="column" width="100%" gap={1}>
            <text content={market().title} fg={theme.textBright} />
            <text content={`Vol: ${formatVolume(market().volume24h)}  |  Liq: ${formatVolume(market().liquidity)}  |  ${market().outcomes.length} Outcomes`} fg={theme.textMuted} />
            {market().resolutionDate && (
              <text content={`Resolves: ${formatDate(market().resolutionDate!)}`} fg={theme.textMuted} />
            )}
            <text content="" />
            <Chart market={market()} priceHistory={priceHistory()} />
            <text content="" />
            <OutcomeTable market={market()} />
          </box>
        )}
      </Show>
    </scrollbox>
  );
}
