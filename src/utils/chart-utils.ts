/**
 * ASCII chart rendering utilities for terminal display
 */

import { PricePoint } from "../types/market";

export interface ChartOptions {
  width: number;
  height: number;
  showAxis?: boolean;
  precision?: number;
}

export function generateSimpleChart(
  data: PricePoint[],
  options: ChartOptions
): string {
  const { width, height, showAxis = true, precision = 2 } = options;

  if (data.length === 0) {
    return "No data available";
  }

  // Extract prices from data points
  const prices = data.map((p) => p.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const range = maxPrice - minPrice || 0.01; // Avoid division by zero

  // Create a simple ASCII chart
  const chartData: number[][] = [];
  for (let y = 0; y < height; y++) {
    chartData[y] = [];
  }

  // Sample data points to fit width
  const step = Math.max(1, Math.floor(data.length / width));
  const sampledPrices: number[] = [];
  for (let i = 0; i < data.length; i += step) {
    sampledPrices.push(prices[i]);
  }

  // Normalize prices to chart height
  const chartWidth = Math.min(sampledPrices.length, width);
  for (let x = 0; x < chartWidth; x++) {
    const price = sampledPrices[x] || sampledPrices[sampledPrices.length - 1];
    const normalizedPrice = (price - minPrice) / range;
    const chartY = Math.floor((1 - normalizedPrice) * (height - 1));
    chartData[chartY][x] = (chartData[chartY][x] || 0) + 1;
  }

  // Render chart
  let output = "";
  const yAxisLabel = showAxis ? "│ " : "";
  const yAxisWidth = showAxis ? 2 : 0;
  const maxPrice100 = (maxPrice * 100).toFixed(precision);
  const minPrice100 = (minPrice * 100).toFixed(precision);

  for (let y = 0; y < height; y++) {
    let line = "";

    if (showAxis) {
      if (y === 0) {
        line += maxPrice100.padStart(4) + " │ ";
      } else if (y === height - 1) {
        line += minPrice100.padStart(4) + " │ ";
      } else {
        line += "     │ ";
      }
    }

    for (let x = 0; x < chartWidth; x++) {
      line += chartData[y]?.[x] ? "█" : " ";
    }
    output += line + "\n";
  }

  // Add x-axis
  if (showAxis) {
    output += "     └" + "─".repeat(chartWidth) + "\n";
  }

  return output;
}

export function generateSparkline(data: number[], width: number = 10): string {
  if (data.length === 0) return "";

  const minVal = Math.min(...data);
  const maxVal = Math.max(...data);
  const range = maxVal - minVal || 0.01;

  // Sample data to fit width
  const step = Math.max(1, Math.floor(data.length / width));
  let sparkline = "";

  const sparkChars = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];

  for (let i = 0; i < data.length; i += step) {
    const val = data[i];
    const normalized = (val - minVal) / range;
    const charIdx = Math.floor(normalized * (sparkChars.length - 1));
    sparkline += sparkChars[charIdx];
  }

  return sparkline;
}

export function formatChartLabel(value: number, decimals: number = 2): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Compute Simple Moving Average over a price series.
 * Returns an array of the same length with NaN for positions < period.
 */
export function computeSMA(prices: number[], period: number): number[] {
  return prices.map((_, i) => {
    if (i < period - 1) return NaN;
    const slice = prices.slice(i - period + 1, i + 1);
    return slice.reduce((a, b) => a + b, 0) / period;
  });
}

/**
 * Compute Relative Strength Index (RSI) over a price series.
 * Returns an array of the same length; first `period` elements are NaN.
 */
export function computeRSI(prices: number[], period: number = 14): number[] {
  const result: number[] = new Array(prices.length).fill(NaN);
  if (prices.length < period + 1) return result;

  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    const g = diff > 0 ? diff : 0;
    const l = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return result;
}

/**
 * Overlay SMA lines onto a chart grid (mutates the grid rows).
 * Returns the modified grid string lines.
 */
export function overlaySMAOnChart(
  chartLines: string[],
  prices: number[],
  smaShort: number[],
  smaLong: number[],
  chartWidth: number,
  height: number,
  minPrice: number,
  maxPrice: number
): string[] {
  const range = maxPrice - minPrice || 0.01;
  const axisWidth = 7; // "XX.XX │ "
  const lines = chartLines.map((l) => l.split(""));

  const plotSMA = (sma: number[], char: string) => {
    const step = Math.max(1, Math.floor(prices.length / chartWidth));
    let col = 0;
    for (let i = 0; i < prices.length; i += step) {
      const v = sma[i];
      if (!Number.isNaN(v) && col < chartWidth) {
        const row = Math.round(((maxPrice - v) / range) * (height - 1));
        const safeRow = Math.max(0, Math.min(height - 1, row));
        const safeCol = axisWidth + col;
        if (lines[safeRow] && safeCol < (lines[safeRow].length)) {
          lines[safeRow][safeCol] = char;
        }
      }
      col++;
    }
  };

  plotSMA(smaShort, "·");
  plotSMA(smaLong, "╌");
  return lines.map((l) => l.join(""));
}

export function createTreeMap(
  items: Array<{ name: string; value: number }>,
  maxWidth: number
): string {
  if (items.length === 0) return "";

  const totalValue = items.reduce((sum, item) => sum + item.value, 0);
  let output = "";
  let currentX = 0;

  for (const item of items) {
    const width = Math.max(1, Math.floor((item.value / totalValue) * maxWidth));
    const truncatedName = item.name.slice(0, Math.max(3, width - 2));
    const padding = Math.max(0, width - truncatedName.length - 1);
    output += truncatedName + " ".repeat(padding) + "│";
    currentX += width + 1;

    if (currentX >= maxWidth) break;
  }

  return output.slice(0, maxWidth);
}
