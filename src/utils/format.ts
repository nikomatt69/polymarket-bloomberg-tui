/**
 * Formatting utilities for market data display
 */

export function formatPrice(price: number): string {
  if (price < 0.01) return "0.00%";
  if (price > 1) return "100.00%";
  return `${(price * 100).toFixed(2)}%`;
}

export function formatVolume(volume: number): string {
  if (volume >= 1_000_000) {
    return `$${(volume / 1_000_000).toFixed(1)}M`;
  }
  if (volume >= 1_000) {
    return `$${(volume / 1_000).toFixed(1)}K`;
  }
  return `$${volume.toFixed(0)}`;
}

export function formatChange(change: number): string {
  const sign = change >= 0 ? "+" : "";
  return `${sign}${change.toFixed(2)}%`;
}

export function formatDate(date: Date | number): string {
  const d = typeof date === "number" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function truncateString(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.substring(0, length - 3) + "...";
}

export function formatNumber(num: number, decimals: number = 2): string {
  return num.toFixed(decimals);
}

export function padRight(str: string, length: number): string {
  if (str.length >= length) return str;
  return str + " ".repeat(length - str.length);
}

export function padLeft(str: string, length: number): string {
  if (str.length >= length) return str;
  return " ".repeat(length - str.length) + str;
}

export function centerString(str: string, length: number): string {
  if (str.length >= length) return str;
  const padding = Math.floor((length - str.length) / 2);
  const right = length - str.length - padding;
  return " ".repeat(padding) + str + " ".repeat(right);
}
