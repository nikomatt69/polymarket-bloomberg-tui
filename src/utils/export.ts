/**
 * CSV Export Utilities
 * Export positions, watchlist, and alerts to CSV format
 */

import { positionsState } from "../hooks/usePositions";
import { watchlistState } from "../hooks/useWatchlist";
import { alertsState } from "../hooks/useAlerts";
import { appState } from "../state";
import { writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

/**
 * Get the export directory path
 */
function getExportDir(): string {
  const dir = join(homedir(), ".polymarket-tui", "exports");
  return dir;
}

/**
 * Format a value for CSV (handle quotes and commas)
 */
function formatCsvValue(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  // Escape quotes and wrap in quotes if contains comma, quote, or newline
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Export positions to CSV
 * Columns: MARKET, OUTCOME, SIZE, AVG_PRICE, CUR_PRICE, PNL, ROI
 */
export function exportPositionsCsv(): string {
  const positions = positionsState.positions;

  if (positions.length === 0) {
    return "No positions to export";
  }

  const headers = ["MARKET", "OUTCOME", "SIZE", "AVG_PRICE", "CUR_PRICE", "PNL", "ROI", "CURRENT_VALUE", "SECTOR"];
  const rows: string[] = [];

  for (const pos of positions) {
    const market = appState.markets.find(m => m.id === pos.asset || (m as any).conditionId === pos.conditionId);
    const sector = market?.category ?? "Other";

    rows.push([
      formatCsvValue(pos.title),
      formatCsvValue(pos.outcome),
      formatCsvValue(pos.size.toFixed(4)),
      formatCsvValue((pos.avgPrice * 100).toFixed(2) + "¢"),
      formatCsvValue((pos.curPrice * 100).toFixed(2) + "¢"),
      formatCsvValue(pos.cashPnl.toFixed(2)),
      formatCsvValue(pos.percentPnl.toFixed(2) + "%"),
      formatCsvValue(pos.currentValue.toFixed(2)),
      formatCsvValue(sector),
    ].join(","));
  }

  const csv = [headers.join(","), ...rows].join("\n");

  // Save to file
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `positions-${timestamp}.csv`;
  const filepath = join(getExportDir(), filename);

  try {
    writeFileSync(filepath, csv);
  } catch {
    // Directory might not exist, but we still return the CSV
  }

  return csv;
}

/**
 * Export watchlist to CSV
 * Columns: MARKET, VOLUME, LIQUIDITY, CUR_PRICE, URL
 */
export function exportWatchlistCsv(): string {
  const watchlistIds = watchlistState.marketIds;

  if (watchlistIds.length === 0) {
    return "No watchlist items to export";
  }

  const headers = ["MARKET", "VOLUME", "LIQUIDITY", "CUR_PRICE", "CHANGE_24H", "URL"];
  const rows: string[] = [];

  for (const marketId of watchlistIds) {
    const market = appState.markets.find(m => m.id === marketId);
    if (!market) continue;

    const leadOutcome = market.outcomes.length > 0
      ? market.outcomes.reduce((a, b) => a.price > b.price ? a : b)
      : null;

    rows.push([
      formatCsvValue(market.title),
      formatCsvValue(market.volume24h.toFixed(2)),
      formatCsvValue(market.liquidity.toFixed(2)),
      formatCsvValue(leadOutcome ? (leadOutcome.price * 100).toFixed(2) + "¢" : ""),
      formatCsvValue(market.change24h != null ? market.change24h.toFixed(2) + "%" : ""),
      formatCsvValue(`https://polymarket.com/market/${market.slug ?? market.id}`),
    ].join(","));
  }

  const csv = [headers.join(","), ...rows].join("\n");

  // Save to file
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `watchlist-${timestamp}.csv`;
  const filepath = join(getExportDir(), filename);

  try {
    writeFileSync(filepath, csv);
  } catch {
    // Directory might not exist
  }

  return csv;
}

/**
 * Export alerts to CSV
 * Columns: MARKET, OUTCOME, METRIC, THRESHOLD, CONDITION, STATUS, CREATED_AT
 */
export function exportAlertsCsv(): string {
  const alerts = alertsState.alerts;

  if (alerts.length === 0) {
    return "No alerts to export";
  }

  const headers = ["MARKET", "OUTCOME", "METRIC", "THRESHOLD", "CONDITION", "STATUS", "CREATED_AT"];
  const rows: string[] = [];

  for (const alert of alerts) {
    rows.push([
      formatCsvValue(alert.marketTitle ?? alert.marketId),
      formatCsvValue(alert.outcomeTitle ?? ""),
      formatCsvValue(alert.metric),
      formatCsvValue(alert.threshold.toFixed(4)),
      formatCsvValue(alert.condition),
      formatCsvValue(alert.status),
      formatCsvValue(new Date(alert.createdAt).toISOString()),
    ].join(","));
  }

  const csv = [headers.join(","), ...rows].join("\n");

  // Save to file
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `alerts-${timestamp}.csv`;
  const filepath = join(getExportDir(), filename);

  try {
    writeFileSync(filepath, csv);
  } catch {
    // Directory might not exist
  }

  return csv;
}

/**
 * Export orders to CSV
 * Columns: MARKET, SIDE, PRICE, SIZE, FILLED, STATUS, CREATED_AT
 */
export function exportOrdersCsv(): string {
  // Import ordersState here to avoid circular deps
  const { ordersState } = require("../hooks/useOrders");
  const orders = ordersState.tradeHistory;

  if (orders.length === 0) {
    return "No orders to export";
  }

  const headers = ["MARKET", "SIDE", "PRICE", "SIZE", "FILLED", "STATUS", "CREATED_AT"];
  const rows: string[] = [];

  for (const order of orders) {
    rows.push([
      formatCsvValue(order.marketTitle ?? "Unknown"),
      formatCsvValue(order.side),
      formatCsvValue((order.price * 100).toFixed(2) + "¢"),
      formatCsvValue(order.size.toFixed(4)),
      formatCsvValue(order.sizeMatched.toFixed(4)),
      formatCsvValue(order.status),
      formatCsvValue(new Date(order.createdAt).toISOString()),
    ].join(","));
  }

  const csv = [headers.join(","), ...rows].join("\n");

  // Save to file
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `orders-${timestamp}.csv`;
  const filepath = join(getExportDir(), filename);

  try {
    writeFileSync(filepath, csv);
  } catch {
    // Directory might not exist
  }

  return csv;
}
