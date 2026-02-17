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
