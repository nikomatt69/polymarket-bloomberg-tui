import { Show, createMemo } from "solid-js";
import { Market, PriceHistory } from "../types/market";
import {
  generateSimpleChart,
  generateSparkline,
  formatChartLabel,
  computeSMA,
  computeRSI,
  overlaySMAOnChart,
} from "../utils/chart-utils";
import { useTheme } from "../context/theme";

interface ChartProps {
  market: Market | undefined;
  priceHistory: PriceHistory | undefined;
}

interface ChartData {
  sparkline: string;
  chart: string;
  stats: string;
  trendLine: string;
  indicators: string;
  rsiLine: string;
}

const CHART_WIDTH = 52;
const CHART_HEIGHT = 6;

function formatSignedPercent(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function calculateVolatility(prices: number[]): number {
  if (prices.length < 3) return 0;

  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const prev = prices[i - 1];
    const curr = prices[i];
    if (prev > 0) {
      returns.push((curr - prev) / prev);
    }
  }

  if (returns.length < 2) return 0;
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / returns.length;
  return Math.sqrt(variance) * 100;
}

export function Chart(props: ChartProps) {
  const { theme } = useTheme();

  const chartOutput = createMemo((): ChartData | null => {
    if (!props.priceHistory?.data || props.priceHistory.data.length === 0) return null;
    const prices = props.priceHistory.data.map((p) => p.price);
    if (prices.length < 2) return null;

    const sparkline = generateSparkline(prices, CHART_WIDTH);

    const rawChart = generateSimpleChart(props.priceHistory.data, {
      width: CHART_WIDTH,
      height: CHART_HEIGHT,
      showAxis: true,
      precision: 2,
    });

    // Overlay SMA indicators
    const sma7 = computeSMA(prices, 7);
    const sma30 = computeSMA(prices, 30);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const chartLines = rawChart.split("\n").filter((_, i) => i < CHART_HEIGHT);
    const axisLine = rawChart.split("\n")[CHART_HEIGHT] ?? "";
    const overlaid = overlaySMAOnChart(
      chartLines, prices, sma7, sma30,
      CHART_WIDTH, CHART_HEIGHT, minPrice, maxPrice
    );
    const chart = [...overlaid, axisLine].join("\n");

    // RSI
    const rsi = computeRSI(prices, 14);
    let lastRsi: number | undefined;
    for (let i = rsi.length - 1; i >= 0; i--) {
      if (!Number.isNaN(rsi[i])) {
        lastRsi = rsi[i];
        break;
      }
    }
    const rsiStr = lastRsi !== undefined ? lastRsi.toFixed(1) : "N/A";
    const rsiLevel = lastRsi !== undefined
      ? lastRsi >= 70 ? " (OVERBOUGHT)" : lastRsi <= 30 ? " (OVERSOLD)" : ""
      : "";

    const first = prices[0];
    const last = prices[prices.length - 1];
    const movePct = first > 0 ? ((last - first) / first) * 100 : 0;
    const direction = movePct > 0.2 ? "UPTREND" : movePct < -0.2 ? "DOWNTREND" : "RANGE";
    const volatility = calculateVolatility(prices);

    const minP = formatChartLabel(minPrice);
    const maxP = formatChartLabel(maxPrice);
    const avgP = formatChartLabel(prices.reduce((a, b) => a + b, 0) / prices.length);

    const sma7Last = sma7[sma7.length - 1];
    const sma30Last = sma30[sma30.length - 1];
    const indicators = [
      `· SMA7: ${Number.isNaN(sma7Last) ? "N/A" : formatChartLabel(sma7Last)}`,
      `╌ SMA30: ${Number.isNaN(sma30Last) ? "N/A" : formatChartLabel(sma30Last)}`,
    ].join("  ");

    return {
      sparkline,
      chart,
      stats: `Min: ${minP}  |  Max: ${maxP}  |  Avg: ${avgP}`,
      trendLine: `Last: ${formatChartLabel(last)}  |  Move: ${formatSignedPercent(movePct)}  |  Regime: ${direction}  |  Vol: ${volatility.toFixed(2)}%`,
      indicators,
      rsiLine: `RSI(14): ${rsiStr}${rsiLevel}`,
    };
  });

  return (
    <box flexDirection="column" width="100%">
      <text content={`PRICE HISTORY (${props.priceHistory?.timeframe?.toUpperCase() || "7D"})`} fg={theme.primary} />
      <Show
        when={chartOutput()}
        fallback={<text content="No price history available" fg={theme.textMuted} />}
      >
        {(data: () => ChartData) => (
          <>
            <text content={data().sparkline} fg={theme.success} />
            <text content={data().chart} fg={theme.text} />
            <text content={data().stats} fg={theme.textMuted} />
            <text content={data().trendLine} fg={theme.textMuted} />
            <text content={data().indicators} fg={theme.accent} />
            <text content={data().rsiLine} fg={
              (() => {
                const rsi = parseFloat(data().rsiLine.split(":")[1]);
                if (rsi >= 70) return theme.error;
                if (rsi <= 30) return theme.success;
                return theme.textMuted;
              })()
            } />
          </>
        )}
      </Show>
    </box>
  );
}
