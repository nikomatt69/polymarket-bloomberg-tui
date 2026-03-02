/**
 * ASCII Chart Utilities — Sparklines, bar charts, candlesticks for terminal display
 */

// Generate sparkline from price history
export function sparkline(prices: number[], width: number = 10): string {
  if (prices.length === 0) return "-".repeat(width);
  if (prices.length === 1) return "●".repeat(width);
  
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min;
  
  if (range === 0) return "─".repeat(width);
  
  const chars = " ▁▂▃▄▅▆▇█";
  let result = "";
  
  for (let i = 0; i < width; i++) {
    const idx = Math.floor((i / width) * prices.length);
    const price = prices[idx];
    const normalized = (price - min) / range;
    const charIdx = Math.min(8, Math.floor(normalized * 8));
    result += chars[charIdx];
  }
  
  return result;
}

// Generate trend arrow
export function trendArrow(current: number, previous: number): string {
  if (current > previous) return "▲";
  if (current < previous) return "▼";
  return "─";
}

// Generate volume bar
export function volumeBar(volume: number, maxVolume: number, width: number = 10): string {
  const pct = Math.min(100, (volume / maxVolume) * 100);
  const filled = Math.floor((pct / 100) * width);
  const empty = width - filled;
  return "█".repeat(filled) + "░".repeat(empty);
}

// Simple ASCII bar chart
export function barChart(data: { label: string; value: number }[], maxWidth: number = 20, colors?: { positive: string; negative: string }): string {
  if (data.length === 0) return "";
  
  const maxValue = Math.max(...data.map(d => Math.abs(d.value)));
  if (maxValue === 0) return "";
  
  const lines: string[] = [];
  for (const item of data) {
    const barWidth = Math.floor((Math.abs(item.value) / maxValue) * maxWidth);
    const bar = "█".repeat(barWidth);
    const sign = item.value >= 0 ? "+" : "-";
    lines.push(`${item.label.padEnd(12)} ${bar} ${sign}${Math.abs(item.value).toFixed(2)}`);
  }
  
  return lines.join("\n");
}

// Mini candlestick chart (last N periods)
export function candlestick(prices: { open: number; high: number; low: number; close: number }[], width: number = 20): string {
  if (prices.length === 0) return "No data";
  
  const chars = " _,.╱╲▔▔";
  let result = "";
  
  for (let i = 0; i < width; i++) {
    const idx = Math.floor((i / width) * prices.length);
    const p = prices[idx];
    const range = p.high - p.low;
    const bodyTop = Math.min(p.open, p.close);
    const bodyBottom = Math.max(p.open, p.close);
    
    const isGreen = p.close >= p.open;
    const color = isGreen ? "▲" : "▼";
    
    result += color;
  }
  
  return result;
}

// Distribution histogram
export function histogram(values: number[], bins: number = 10, width: number = 15): string {
  if (values.length === 0) return "No data";
  
  const min = Math.min(...values);
  const max = Math.max(...values);
  const binWidth = (max - min) / bins;
  
  const counts = new Array(bins).fill(0);
  for (const v of values) {
    const binIdx = Math.min(bins - 1, Math.floor((v - min) / binWidth));
    counts[binIdx]++;
  }
  
  const maxCount = Math.max(...counts);
  if (maxCount === 0) return "No data";
  
  const lines: string[] = [];
  for (let i = 0; i < bins; i++) {
    const barWidth = Math.floor((counts[i] / maxCount) * width);
    const bar = "█".repeat(barWidth);
    const range = `${(min + i * binWidth).toFixed(1)}-${(min + (i + 1) * binWidth).toFixed(1)}`;
    lines.push(`${range.padEnd(10)} ${bar} ${counts[i]}`);
  }
  
  return lines.join("\n");
}

// Format large numbers
export function fmtNumber(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(2);
}

// Format percentage with sign
export function fmtPct(n: number, showSign: boolean = true): string {
  const sign = showSign && n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

// Progress bar with label
export function progressBar(current: number, total: number, width: number = 20, label?: string): string {
  const pct = total > 0 ? (current / total) * 100 : 0;
  const filled = Math.floor((pct / 100) * width);
  const empty = width - filled;
  const bar = "█".repeat(filled) + "░".repeat(empty);
  const pctStr = `${pct.toFixed(0)}%`;
  
  if (label) {
    return `${label}: ${bar} ${pctStr}`;
  }
  return `${bar} ${pctStr}`;
}

// Heat map cell
export function heatmapCell(value: number, min: number, max: number): string {
  const range = max - min;
  if (range === 0) return "●";
  
  const normalized = (value - min) / range;
  
  if (normalized >= 0.8) return "██";
  if (normalized >= 0.6) return "▓▓";
  if (normalized >= 0.4) return "▒▒";
  if (normalized >= 0.2) return "░░";
  return "··";
}
