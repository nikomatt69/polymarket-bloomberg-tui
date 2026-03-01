import { Show, createSignal, createEffect, createMemo, For } from "solid-js";
import { RGBA } from "@opentui/core";
import { useTheme } from "../context/theme";
import { appState, setIndicatorsPanelOpen } from "../state";
import {
  calculateSMA,
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
  calculateEMA,
} from "../utils/indicators";
import { usePriceHistory } from "../hooks/useMarketData";
import { PriceHistory } from "../types/market";

type IndicatorType = "sma" | "ema" | "rsi" | "macd" | "bollinger";

const [selectedIndicator, setSelectedIndicator] = createSignal<IndicatorType>("sma");
const [smaPeriod, setSmaPeriod] = createSignal(20);
const [rsiPeriod, setRsiPeriod] = createSignal(14);
const [emaPeriod, setEmaPeriod] = createSignal(20);
const [bbPeriod, setBbPeriod] = createSignal(20);
const [bbStdDev, setBbStdDev] = createSignal(2);
const [macdFast, setMacdFast] = createSignal(12);
const [macdSlow, setMacdSlow] = createSignal(26);
const [macdSignal, setMacdSignal] = createSignal(9);

const [showSMA, setShowSMA] = createSignal(true);
const [showEMA, setShowEMA] = createSignal(true);
const [showRSI, setShowRSI] = createSignal(true);
const [showMACD, setShowMACD] = createSignal(true);
const [showBB, setShowBB] = createSignal(true);

export function IndicatorsPanel() {
  const { theme } = useTheme();
  const [history, setHistory] = createSignal<PriceHistory | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null);

  const selectedMarket = () => appState.markets.find((m) => m.id === appState.selectedMarketId);

  createEffect(() => {
    const market = selectedMarket();
    if (!market) {
      setHistory(null);
      setErrorMessage(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setErrorMessage(null);

    void (async () => {
      try {
        const nextHistory = await usePriceHistory(market.id, appState.timeframe);
        if (cancelled) return;

        if (!nextHistory || nextHistory.data.length === 0) {
          setHistory(null);
          setErrorMessage("No historical ticks for this timeframe");
        } else {
          setHistory(nextHistory);
        }
      } catch (error) {
        if (!cancelled) {
          setHistory(null);
          setErrorMessage(error instanceof Error ? error.message : "Unable to load indicators");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  });

  const prices = createMemo(() => (history()?.data ?? []).map((point) => point.price));

  const indicatorValues = createMemo(() => {
    const data = prices();
    if (data.length < 3) return null;

    const takeLast = (values: number[]) => values.filter((value) => !Number.isNaN(value)).slice(-8);

    switch (selectedIndicator()) {
      case "sma": {
        const sma = calculateSMA(data, smaPeriod());
        return {
          name: `SMA(${smaPeriod()})`,
          values: takeLast(sma),
          current: sma[sma.length - 1],
          prev: sma[sma.length - 2],
        };
      }
      case "ema": {
        const ema = calculateEMA(data, emaPeriod());
        return {
          name: `EMA(${emaPeriod()})`,
          values: takeLast(ema),
          current: ema[ema.length - 1],
          prev: ema[ema.length - 2],
        };
      }
      case "rsi": {
        const rsi = calculateRSI(data, rsiPeriod());
        return {
          name: `RSI(${rsiPeriod()})`,
          values: takeLast(rsi),
          current: rsi[rsi.length - 1],
          prev: rsi[rsi.length - 2],
        };
      }
      case "macd": {
        const macd = calculateMACD(data, macdFast(), macdSlow(), macdSignal());
        return {
          name: `MACD(${macdFast()},${macdSlow()})`,
          values: takeLast(macd.histogram),
          current: macd.histogram[macd.histogram.length - 1],
          prev: macd.histogram[macd.histogram.length - 2],
        };
      }
      case "bollinger": {
        const bb = calculateBollingerBands(data, bbPeriod(), bbStdDev());
        return {
          name: `BB(${bbPeriod()})`,
          values: takeLast(bb.middle),
          current: bb.middle[bb.middle.length - 1],
          prev: bb.middle[bb.middle.length - 2],
        };
      }
      default:
        return null;
    }
  });

  const validIndicator = createMemo(() => {
    const value = indicatorValues();
    if (!value) return null;
    if (!Number.isFinite(value.current) || !Number.isFinite(value.prev)) return null;
    return value;
  });

  type IndicatorOption = { id: IndicatorType; label: string; color: RGBA };
  const indicatorOptions: IndicatorOption[] = [
    { id: "sma",      label: "SMA",  color: theme.success },
    { id: "ema",      label: "EMA",  color: theme.warning },
    { id: "rsi",      label: "RSI",  color: theme.error },
    { id: "macd",     label: "MACD", color: theme.accent  },
    { id: "bollinger",label: "BB",   color: theme.primary },
  ];

  return (
    <box
      position="absolute"
      top={2}
      left="32%"
      width="36%"
      height={18}
      backgroundColor={theme.panelModal}
      flexDirection="column"
      zIndex={150}
    >
      {/* Header */}
      <box height={1} width="100%" backgroundColor={theme.accent} flexDirection="row">
        <text content=" ◈ INDICATORS " fg={theme.highlightText} />
        <box flexGrow={1} />
        <box onMouseDown={() => setIndicatorsPanelOpen(false)}>
          <text content=" [ESC] ✕ " fg={theme.highlightText} />
        </box>
      </box>

      {/* Separator */}
      <box height={1} width="100%" backgroundColor={theme.accentMuted} />

      <box flexDirection="column" flexGrow={1} paddingLeft={2} paddingTop={1}>
        <Show when={selectedMarket()}>
          <text content={selectedMarket()!.title.slice(0, 48)} fg={theme.textBright} />
          <text content="" />

          {/* Indicator selector — mouse clickable */}
          <box flexDirection="row" gap={2}>
            <For each={indicatorOptions}>
              {(opt) => (
                <box onMouseDown={() => setSelectedIndicator(opt.id)}>
                  <text
                    content={selectedIndicator() === opt.id ? `[${opt.label}]` : ` ${opt.label} `}
                    fg={selectedIndicator() === opt.id ? opt.color : theme.textMuted}
                  />
                </box>
              )}
            </For>
          </box>

          <text content="" />

          <Show when={loading()}>
            <text content="Loading price data..." fg={theme.warning} />
          </Show>

          <Show when={!loading() && errorMessage()}>
            <text content={errorMessage()!} fg={theme.error} />
          </Show>

          <Show when={!loading() && !errorMessage() && validIndicator()}>
            <box flexDirection="row" gap={3}>
              <text content={validIndicator()!.name} fg={theme.primary} />
              <text
                content={validIndicator()!.current >= validIndicator()!.prev ? "↑ Rising" : "↓ Falling"}
                fg={validIndicator()!.current >= validIndicator()!.prev ? theme.success : theme.error}
              />
            </box>
            <text content={`Current: ${validIndicator()!.current.toFixed(4)}`} fg={theme.text} />

            <text content="" />
            <text content="Last values:" fg={theme.textMuted} />
            <text content={validIndicator()!.values.map((v) => v.toFixed(3)).join("  ")} fg={theme.text} width="95%" />
          </Show>

          <Show when={!loading() && !errorMessage() && !validIndicator()}>
            <text content="Not enough price data" fg={theme.textMuted} />
          </Show>

          <text content="" />
          <text content="[1-4] Select  [+/=] Period  Click to select" fg={theme.textMuted} />
        </Show>

        <Show when={!selectedMarket()}>
          <text content="Select a market to view indicators" fg={theme.textMuted} />
        </Show>
      </box>
    </box>
  );
}

export { 
  selectedIndicator, 
  setSelectedIndicator, 
  smaPeriod, 
  setSmaPeriod, 
  rsiPeriod, 
  setRsiPeriod,
  emaPeriod,
  setEmaPeriod,
  bbPeriod,
  setBbPeriod,
  bbStdDev,
  setBbStdDev,
  macdFast,
  setMacdFast,
  macdSlow,
  setMacdSlow,
  macdSignal,
  setMacdSignal,
  showSMA,
  setShowSMA,
  showEMA,
  setShowEMA,
  showRSI,
  setShowRSI,
  showMACD,
  setShowMACD,
  showBB,
  setShowBB,
};
