import { Show, createMemo } from "solid-js";
import { Market, PriceHistory } from "../types/market";
import { generateSimpleChart, generateSparkline, formatChartLabel } from "../utils/chart-utils";
import { useTheme } from "../context/theme";

interface ChartProps {
  market: Market | undefined;
  priceHistory: PriceHistory | undefined;
}

interface ChartData {
  sparkline: string;
  chart: string;
  stats: string;
}

export function Chart(props: ChartProps) {
  const { theme } = useTheme();

  const chartOutput = createMemo((): ChartData | null => {
    if (!props.priceHistory?.data || props.priceHistory.data.length === 0) return null;
    const prices = props.priceHistory.data.map((p) => p.price);
    const sparkline = generateSparkline(prices, 45);
    const chart = generateSimpleChart(props.priceHistory.data, {
      width: 45,
      height: 6,
      showAxis: true,
      precision: 2,
    });
    const minP = formatChartLabel(Math.min(...prices));
    const maxP = formatChartLabel(Math.max(...prices));
    const avgP = formatChartLabel(prices.reduce((a, b) => a + b, 0) / prices.length);
    return { sparkline, chart, stats: `Min: ${minP}  |  Max: ${maxP}  |  Avg: ${avgP}` };
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
          </>
        )}
      </Show>
    </box>
  );
}
