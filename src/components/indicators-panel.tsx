import { Show, createSignal, createEffect, createMemo, For } from "solid-js";
import { RGBA } from "@opentui/core";
import { useTheme } from "../context/theme";
import { appState, setIndicatorsPanelOpen } from "../state";
import { PanelHeader, Separator, DataRow, LoadingState } from "./ui/panel-components";
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
      left="8%"
      width="84%"
      height={24}
      backgroundColor={theme.panelModal}
      flexDirection="column"
      zIndex={150}
    >
      {/* Header */}
      <PanelHeader
        title="TECHNICAL INDICATORS"
        icon="◈"
        subtitle={selectedMarket() ? selectedMarket()!.title.slice(0, 16) : undefined}
        onClose={() => setIndicatorsPanelOpen(false)}
      />

      {/* Indicator type tab bar */}
      <box height={1} width="100%" flexDirection="row" backgroundColor={theme.backgroundPanel}>
        <For each={indicatorOptions}>
          {(opt) => (
            <box
              paddingLeft={1}
              paddingRight={1}
              backgroundColor={selectedIndicator() === opt.id ? opt.color : undefined}
              onMouseDown={() => setSelectedIndicator(opt.id)}
            >
              <text
                content={` ${opt.label} `}
                fg={selectedIndicator() === opt.id ? theme.background : theme.textMuted}
              />
            </box>
          )}
        </For>
      </box>

      <Separator type="heavy" />

      <box flexDirection="column" flexGrow={1} paddingTop={1}>
        <Show when={selectedMarket()}>
          <box paddingLeft={2}>
            <text content={selectedMarket()!.title.slice(0, 48)} fg={theme.text} />
          </box>
          <text content="" />

          <Show when={loading()}>
            <LoadingState message="Loading price history…" />
          </Show>

          <Show when={!loading() && errorMessage()}>
            <box paddingLeft={2}>
              <text content={`✗ ${errorMessage()!}`} fg={theme.error} />
            </box>
          </Show>

          <Show when={!loading() && !errorMessage() && validIndicator()}>
            <box paddingLeft={2}>
              <text
                content={`─── ${validIndicator()!.name} ────────────────────────`}
                fg={theme.borderSubtle}
              />
            </box>
            <DataRow
              label="Indicator"
              value={validIndicator()!.name}
              valueColor="accent"
              highlight
            />
            <DataRow
              label="Current"
              value={validIndicator()!.current.toFixed(4)}
              valueColor="text"
            />
            <DataRow
              label="Direction"
              value={validIndicator()!.current >= validIndicator()!.prev ? "▲ Rising" : "▼ Falling"}
              valueColor={validIndicator()!.current >= validIndicator()!.prev ? "success" : "error"}
            />
            <DataRow
              label="Prev"
              value={validIndicator()!.prev.toFixed(4)}
              valueColor="muted"
            />
            <box paddingLeft={2} paddingTop={0} flexDirection="row">
              <text content="Level  " fg={theme.textMuted} />
              <text
                content={(() => {
                  const v = validIndicator()!;
                  const norm = selectedIndicator() === "rsi"
                    ? Math.max(0, Math.min(100, v.current)) / 100
                    : Math.max(0, Math.min(1, Math.abs(v.current)));
                  const filled = Math.round(norm * 20);
                  return "█".repeat(filled) + "░".repeat(20 - filled);
                })()}
                fg={validIndicator()!.current >= validIndicator()!.prev ? theme.success : theme.error}
              />
              <text
                content={selectedIndicator() === "rsi" ? `  ${validIndicator()!.current.toFixed(1)}` : ""}
                fg={theme.textMuted}
              />
            </box>

            <box paddingLeft={2} paddingTop={1}>
              <text content="─── LAST VALUES ─────────────────────────" fg={theme.borderSubtle} />
            </box>
            <box paddingLeft={2}>
              <text content={validIndicator()!.values.map((v) => v.toFixed(3)).join("  ")} fg={theme.text} width="95%" />
            </box>
          </Show>

          <Show when={!loading() && !errorMessage() && !validIndicator()}>
            <box paddingLeft={2}>
              <text content="Insufficient price history for this indicator" fg={theme.textMuted} />
              <text content="Try a different timeframe or indicator period" fg={theme.textMuted} />
            </box>
          </Show>

          <Separator type="light" />
          <box flexDirection="row" paddingLeft={2}>
            <text content="[SMA/EMA/RSI/MACD/BB] Indicator   [+/-] Period   [ESC] Close" fg={theme.textMuted} />
          </box>
        </Show>

        <Show when={!selectedMarket()}>
          <box paddingLeft={2}>
            <text content="Select a market to view technical indicators" fg={theme.textMuted} />
          </box>
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
