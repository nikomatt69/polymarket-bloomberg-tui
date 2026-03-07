/**
 * Reactive order state and actions
 */

import { createStore } from "solid-js/store";
import { createEffect, onCleanup } from "solid-js";
import { PlacedOrder } from "../types/orders";
import {
  placeOrder,
  cancelOrder,
  fetchOpenOrders,
  fetchTradeHistory,
  cancelAllOrders,
  cancelOrdersBulk,
  cancelOrdersForAssetIds,
  getOrderScoringStatus,
} from "../api/orders";
import { startHeartbeat, stopHeartbeat } from "../api/clob/trading";
import { Order } from "../types/orders";
import { OrderStatus } from "../types/orders";
import { appState, getSelectedMarket, getTradingBalance, walletState } from "../state";
import { positionsState, fetchUserPositions } from "./usePositions";
import { getOrderBookSummary, type OrderBookSummary } from "../api/polymarket";
import { homedir } from "os";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";

// ─── Order History Persistence ─────────────────────────────────────────────────

const ORDERS_CONFIG_DIR = join(homedir(), ".polymarket-tui");
const ORDERS_FILE = join(ORDERS_CONFIG_DIR, "orders.json");

function ensureOrdersDir(): void {
  if (!existsSync(ORDERS_CONFIG_DIR)) {
    mkdirSync(ORDERS_CONFIG_DIR, { recursive: true });
  }
}

function loadPersistedOrders(): { openOrders: PlacedOrder[]; tradeHistory: PlacedOrder[] } {
  try {
    ensureOrdersDir();
    if (existsSync(ORDERS_FILE)) {
      const data = readFileSync(ORDERS_FILE, "utf-8");
      const parsed = JSON.parse(data);
      return {
        openOrders: parsed.openOrders || [],
        tradeHistory: parsed.tradeHistory || [],
      };
    }
  } catch (e) {
    console.error("Failed to load persisted orders:", e);
  }
  return { openOrders: [], tradeHistory: [] };
}

function savePersistedOrders(openOrders: PlacedOrder[], tradeHistory: PlacedOrder[]): void {
  try {
    ensureOrdersDir();
    writeFileSync(ORDERS_FILE, JSON.stringify({ openOrders, tradeHistory }, null, 2));
  } catch (e) {
    console.error("Failed to save orders:", e);
  }
}

// Load persisted orders on startup
const persistedOrders = loadPersistedOrders();

export type OrderHistoryStatusFilter = "ALL" | OrderStatus;
export type OrderHistoryWindowFilter = "ALL" | "24H" | "7D" | "30D";
export type OrderHistorySideFilter = "ALL" | "BUY" | "SELL";
export type OrderHistoryScoringFilter = "ALL" | "ON" | "OFF" | "N/A";
export type OrderHistorySection = "open" | "trades";

interface OrdersState {
  openOrders: PlacedOrder[];
  tradeHistory: PlacedOrder[];
  placing: boolean;
  cancelling: string | null; // orderId being cancelled
  error: string | null;
  lastFetch: Date | null;
  cancelReasonsByOrderId: Record<string, string>;
  lastBulkAction: string | null;
  historyStatusFilter: OrderHistoryStatusFilter;
  historyWindowFilter: OrderHistoryWindowFilter;
  historySideFilter: OrderHistorySideFilter;
  historyScoringFilter: OrderHistoryScoringFilter;
  historySelectedMarketOnly: boolean;
  historySearchQuery: string;
  historySearchEditing: boolean;
  lastExportPath: string | null;
  scoringByOrderId: Record<string, boolean | null>;
  scoringLastUpdatedAtByOrderId: Record<string, number>;
  scoringRefreshInFlight: number;
  scoringLastAttemptAt: number | null;
  scoringLastError: string | null;
}

// Initialize state with persisted data
export const [ordersState, setOrdersState] = createStore<OrdersState>({
  openOrders: persistedOrders.openOrders,
  tradeHistory: persistedOrders.tradeHistory,
  placing: false,
  cancelling: null,
  error: null,
  lastFetch: null,
  cancelReasonsByOrderId: {},
  lastBulkAction: null,
  historyStatusFilter: "ALL",
  historyWindowFilter: "ALL",
  historySideFilter: "ALL",
  historyScoringFilter: "ALL",
  historySelectedMarketOnly: false,
  historySearchQuery: "",
  historySearchEditing: false,
  lastExportPath: null,
  scoringByOrderId: {},
  scoringLastUpdatedAtByOrderId: {},
  scoringRefreshInFlight: 0,
  scoringLastAttemptAt: null,
  scoringLastError: null,
});

function matchesStatus(order: PlacedOrder, statusFilter: OrderHistoryStatusFilter): boolean {
  if (statusFilter === "ALL") return true;
  return order.status === statusFilter;
}

function matchesWindow(order: PlacedOrder, windowFilter: OrderHistoryWindowFilter): boolean {
  if (windowFilter === "ALL") return true;
  const now = Date.now();

  switch (windowFilter) {
    case "24H":
      return now - order.createdAt <= 24 * 60 * 60 * 1000;
    case "7D":
      return now - order.createdAt <= 7 * 24 * 60 * 60 * 1000;
    case "30D":
      return now - order.createdAt <= 30 * 24 * 60 * 60 * 1000;
    default:
      return true;
  }
}

function matchesSide(order: PlacedOrder, sideFilter: OrderHistorySideFilter): boolean {
  if (sideFilter === "ALL") return true;
  return order.side === sideFilter;
}

function matchesScoring(order: PlacedOrder, scoringFilter: OrderHistoryScoringFilter): boolean {
  if (scoringFilter === "ALL") return true;

  const scoring = ordersState.scoringByOrderId[order.orderId] ?? null;
  if (scoringFilter === "ON") return scoring === true;
  if (scoringFilter === "OFF") return scoring === false;
  return scoring === null;
}

function matchesMarket(order: PlacedOrder, tokenIds: string[]): boolean {
  if (!ordersState.historySelectedMarketOnly) return true;
  if (tokenIds.length === 0) return false;
  return tokenIds.includes(order.tokenId);
}

function matchesSearch(order: PlacedOrder, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  return (
    order.orderId.toLowerCase().includes(normalized)
    || order.tokenId.toLowerCase().includes(normalized)
    || (order.marketTitle ?? "").toLowerCase().includes(normalized)
    || (order.outcomeTitle ?? "").toLowerCase().includes(normalized)
  );
}

function applyFilters(orders: PlacedOrder[], selectedMarketTokenIds: string[] = []): PlacedOrder[] {
  const query = ordersState.historySearchQuery;

  return orders.filter((order) => (
    matchesStatus(order, ordersState.historyStatusFilter)
    && matchesWindow(order, ordersState.historyWindowFilter)
    && matchesSide(order, ordersState.historySideFilter)
    && matchesScoring(order, ordersState.historyScoringFilter)
    && matchesMarket(order, selectedMarketTokenIds)
    && matchesSearch(order, query)
  ));
}

function csvEscape(value: unknown): string {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
    return `"${text.replace(/\"/g, "\"\"")}"`;
  }
  return text;
}

function getExportDir(): string {
  const dir = join(homedir(), ".polymarket-tui", "exports");
  mkdirSync(dir, { recursive: true });
  return dir;
}

function formatTimestampForFile(ts: number): string {
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}_${hh}${mi}${ss}`;
}

export function getFilteredOpenOrders(selectedMarketTokenIds: string[] = []): PlacedOrder[] {
  return applyFilters(ordersState.openOrders, selectedMarketTokenIds);
}

export function getFilteredTradeHistory(selectedMarketTokenIds: string[] = []): PlacedOrder[] {
  return applyFilters(ordersState.tradeHistory, selectedMarketTokenIds);
}

export function getOrderCancelReason(orderId: string): string | null {
  return ordersState.cancelReasonsByOrderId[orderId] ?? null;
}

export function getOrderScoring(orderId: string): boolean | null {
  return ordersState.scoringByOrderId[orderId] ?? null;
}

export function getOrderScoringUpdatedAt(orderId: string): number | null {
  return ordersState.scoringLastUpdatedAtByOrderId[orderId] ?? null;
}

function setCancelReason(orderId: string, reason: string | null): void {
  if (!orderId) return;

  if (reason === null) {
    setOrdersState("cancelReasonsByOrderId", (prev) => {
      if (!(orderId in prev)) return prev;
      const next = { ...prev };
      delete next[orderId];
      return next;
    });
    return;
  }

  setOrdersState("cancelReasonsByOrderId", (prev) => ({
    ...prev,
    [orderId]: reason,
  }));
}

function setCancelReasonsMap(reasons: Record<string, string>): void {
  const entries = Object.entries(reasons);
  if (entries.length === 0) return;

  setOrdersState("cancelReasonsByOrderId", (prev) => {
    const next = { ...prev };
    for (const [orderId, reason] of entries) {
      if (orderId) {
        next[orderId] = reason;
      }
    }
    return next;
  });
}

export function getReplayCandidateOrder(selectedMarketTokenIds: string[] = [], selectedIndex: number = 0): PlacedOrder | null {
  const openOrders = getFilteredOpenOrders(selectedMarketTokenIds);
  if (openOrders.length > 0) {
    return openOrders[Math.max(0, Math.min(openOrders.length - 1, selectedIndex))] ?? null;
  }

  const trades = getFilteredTradeHistory(selectedMarketTokenIds);
  if (trades.length > 0) {
    return trades[Math.max(0, Math.min(trades.length - 1, selectedIndex))] ?? null;
  }

  return null;
}

export function getReplayCandidateOrderBySection(
  section: OrderHistorySection,
  selectedMarketTokenIds: string[] = [],
  selectedOpenIndex: number = 0,
  selectedTradeIndex: number = 0,
): PlacedOrder | null {
  if (section === "open") {
    const openOrders = getFilteredOpenOrders(selectedMarketTokenIds);
    return openOrders[Math.max(0, Math.min(openOrders.length - 1, selectedOpenIndex))] ?? null;
  }

  const trades = getFilteredTradeHistory(selectedMarketTokenIds);
  return trades[Math.max(0, Math.min(trades.length - 1, selectedTradeIndex))] ?? null;
}

export function cycleOrderHistoryStatusFilter(): void {
  const values: OrderHistoryStatusFilter[] = ["ALL", "LIVE", "MATCHED", "FILLED", "CANCELLED", "DELAYED", "UNMATCHED"];
  const idx = values.indexOf(ordersState.historyStatusFilter);
  const next = values[(idx + 1) % values.length];
  setOrdersState("historyStatusFilter", next);
}

export function cycleOrderHistoryWindowFilter(): void {
  const values: OrderHistoryWindowFilter[] = ["ALL", "24H", "7D", "30D"];
  const idx = values.indexOf(ordersState.historyWindowFilter);
  const next = values[(idx + 1) % values.length];
  setOrdersState("historyWindowFilter", next);
}

export function cycleOrderHistorySideFilter(): void {
  const values: OrderHistorySideFilter[] = ["ALL", "BUY", "SELL"];
  const idx = values.indexOf(ordersState.historySideFilter);
  const next = values[(idx + 1) % values.length];
  setOrdersState("historySideFilter", next);
}

export function cycleOrderHistoryScoringFilter(): void {
  const values: OrderHistoryScoringFilter[] = ["ALL", "ON", "OFF", "N/A"];
  const idx = values.indexOf(ordersState.historyScoringFilter);
  const next = values[(idx + 1) % values.length];
  setOrdersState("historyScoringFilter", next);
}

export function setOrderHistoryStatusFilter(filter: OrderHistoryStatusFilter): void {
  setOrdersState("historyStatusFilter", filter);
}

export function toggleOrderHistorySelectedMarketOnly(): void {
  setOrdersState("historySelectedMarketOnly", !ordersState.historySelectedMarketOnly);
}

export function startOrderHistorySearch(): void {
  setOrdersState("historySearchEditing", true);
}

export function stopOrderHistorySearch(): void {
  setOrdersState("historySearchEditing", false);
}

export function clearOrderHistorySearch(): void {
  setOrdersState("historySearchQuery", "");
}

export function appendOrderHistorySearch(input: string): void {
  setOrdersState("historySearchQuery", (prev) => prev + input);
}

export function backspaceOrderHistorySearch(): void {
  setOrdersState("historySearchQuery", (prev) => prev.slice(0, -1));
}

export function exportOrderHistoryCsv(selectedMarketTokenIds: string[] = []): string {
  const openOrders = getFilteredOpenOrders(selectedMarketTokenIds);
  const trades = getFilteredTradeHistory(selectedMarketTokenIds);
  const allRows = [
    ...openOrders.map((order) => ({ kind: "open", order })),
    ...trades.map((order) => ({ kind: "trade", order })),
  ].sort((a, b) => b.order.createdAt - a.order.createdAt);

  const lines = [
    "kind,createdAtIso,orderId,status,side,tokenId,marketTitle,outcomeTitle,price,originalSize,sizeMatched,sizeRemaining,notionalUsd,scoring,scoringUpdatedAtIso",
    ...allRows.map(({ kind, order }) => {
      const scoring = getOrderScoring(order.orderId);
      const scoringUpdatedAt = getOrderScoringUpdatedAt(order.orderId);

      return [
        kind,
        new Date(order.createdAt).toISOString(),
        order.orderId,
        order.status,
        order.side,
        order.tokenId,
        order.marketTitle ?? "",
        order.outcomeTitle ?? "",
        order.price.toString(),
        order.originalSize.toString(),
        order.sizeMatched.toString(),
        order.sizeRemaining.toString(),
        (order.price * order.sizeMatched).toString(),
        String(scoring),
        scoringUpdatedAt ? new Date(scoringUpdatedAt).toISOString() : "",
      ].map(csvEscape).join(",");
    }),
  ];

  const fileName = `orders_${formatTimestampForFile(Date.now())}.csv`;
  const outputPath = join(getExportDir(), fileName);
  writeFileSync(outputPath, `${lines.join("\n")}\n`);
  setOrdersState("lastExportPath", outputPath);
  return outputPath;
}

export interface OrderDraftPreview {
  valid: boolean;
  side: Order["side"];
  tokenId: string;
  price: number;
  shares: number;
  notional: number;
  marketTitle?: string;
  outcomeTitle?: string;
  availableBalance: number;
  availableShares: number;
  errors: string[];
  warnings: string[];
  quote: Pick<OrderBookSummary, "tokenId" | "bestBid" | "bestAsk" | "midpoint" | "spread" | "spreadBps" | "minOrderSize" | "tickSize" | "updatedAt" | "negRisk" | "lastTradePrice">;
}

function isTickAligned(price: number, tickSize: number): boolean {
  if (!Number.isFinite(price) || !Number.isFinite(tickSize) || tickSize <= 0) return true;
  const ratio = price / tickSize;
  return Math.abs(ratio - Math.round(ratio)) < 1e-6;
}

function countDecimals(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const normalized = value.toString().toLowerCase();
  if (!normalized.includes(".")) return 0;
  const [, decimals = ""] = normalized.split(".");
  return decimals.length;
}

function resolveOrderMetadata(order: Order): { marketTitle?: string; outcomeTitle?: string } {
  const selectedMarket = getSelectedMarket();
  if (selectedMarket) {
    const selectedOutcome = selectedMarket.outcomes.find((outcome) => outcome.id === order.tokenId);
    if (selectedOutcome) {
      return {
        marketTitle: order.marketTitle ?? selectedMarket.title,
        outcomeTitle: order.outcomeTitle ?? selectedOutcome.title,
      };
    }
  }

  for (const market of appState.markets) {
    const outcome = market.outcomes.find((candidate) => candidate.id === order.tokenId);
    if (outcome) {
      return {
        marketTitle: order.marketTitle ?? market.title,
        outcomeTitle: order.outcomeTitle ?? outcome.title,
      };
    }
  }

  return {
    marketTitle: order.marketTitle,
    outcomeTitle: order.outcomeTitle,
  };
}

export async function previewOrderDraft(order: Order): Promise<OrderDraftPreview> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const price = Number(order.price);
  const shares = Number(order.shares);
  const notional = Number.isFinite(price) && Number.isFinite(shares) ? price * shares : 0;
  const quote = await getOrderBookSummary(order.tokenId);
  const metadata = resolveOrderMetadata(order);
  const availableBalance = getTradingBalance();
  const availableShares = positionsState.positions
    .filter((position) => position.asset === order.tokenId)
    .reduce((sum, position) => sum + position.size, 0);
  const reservedBuyCollateral = ordersState.openOrders
    .filter((existing) => existing.side === "BUY" && existing.status !== "CANCELLED" && existing.status !== "FILLED")
    .reduce((sum, existing) => sum + (existing.price * Math.max(0, existing.sizeRemaining)), 0);
  const reservedSellShares = ordersState.openOrders
    .filter((existing) => existing.side === "SELL" && existing.tokenId === order.tokenId && existing.status !== "CANCELLED" && existing.status !== "FILLED")
    .reduce((sum, existing) => sum + Math.max(0, existing.sizeRemaining), 0);

  if (!order.tokenId.trim()) errors.push("Missing tokenId.");
  if (order.side !== "BUY" && order.side !== "SELL") errors.push("Order side must be BUY or SELL.");
  if (!Number.isFinite(price) || price < 0.01 || price > 0.99) errors.push("Price must be between 0.01 and 0.99.");
  if (!Number.isFinite(shares) || shares <= 0) errors.push("Shares must be greater than zero.");
  if (countDecimals(shares) > 2) errors.push("Shares support at most 2 decimal places.");

  if (quote?.tickSize && !isTickAligned(price, quote.tickSize)) {
    errors.push(`Price must align to tick size ${quote.tickSize.toFixed(4)}.`);
  }

  if (quote?.minOrderSize && notional < quote.minOrderSize) {
    errors.push(`Order notional must be at least ${quote.minOrderSize.toFixed(2)} USDC.`);
  }

  if (order.side === "BUY") {
    const deployableBalance = Math.max(0, availableBalance - reservedBuyCollateral);
    if (notional > deployableBalance + 1e-6) {
      errors.push(`Insufficient buying power. Available ${deployableBalance.toFixed(2)} USDC.`);
    }

    if (quote?.bestAsk !== null && quote?.bestAsk !== undefined && price >= quote.bestAsk) {
      warnings.push("Buy price is at or through best ask; the order may execute immediately.");
      if (order.postOnly) {
        errors.push("Post-only buy order crosses the current best ask.");
      }
    }
  }

  if (order.side === "SELL") {
    const deployableShares = Math.max(0, availableShares - reservedSellShares);
    if (shares > deployableShares + 1e-6) {
      errors.push(`Insufficient inventory. Available ${deployableShares.toFixed(2)} shares.`);
    }

    if (quote?.bestBid !== null && quote?.bestBid !== undefined && price <= quote.bestBid) {
      warnings.push("Sell price is at or through best bid; the order may execute immediately.");
      if (order.postOnly) {
        errors.push("Post-only sell order crosses the current best bid.");
      }
    }
  }

  if (quote?.spreadBps !== null && quote?.spreadBps !== undefined && quote.spreadBps >= 150) {
    warnings.push(`Wide spread detected (${quote.spreadBps.toFixed(0)}bp). Prefer passive pricing.`);
  }

  if (quote?.updatedAt && Date.now() - quote.updatedAt > 60_000) {
    warnings.push("Order book snapshot is stale.");
  }

  return {
    valid: errors.length === 0,
    side: order.side,
    tokenId: order.tokenId,
    price,
    shares,
    notional,
    marketTitle: metadata.marketTitle,
    outcomeTitle: metadata.outcomeTitle,
    availableBalance,
    availableShares: Math.max(0, availableShares - reservedSellShares),
    errors,
    warnings,
    quote: {
      tokenId: quote?.tokenId ?? order.tokenId,
      bestBid: quote?.bestBid ?? null,
      bestAsk: quote?.bestAsk ?? null,
      midpoint: quote?.midpoint ?? null,
      spread: quote?.spread ?? null,
      spreadBps: quote?.spreadBps ?? null,
      minOrderSize: quote?.minOrderSize ?? null,
      tickSize: quote?.tickSize ?? null,
      updatedAt: quote?.updatedAt ?? null,
      negRisk: order.negRisk ?? quote?.negRisk ?? false,
      lastTradePrice: quote?.lastTradePrice ?? null,
    },
  };
}

export async function submitOrder(order: Order): Promise<PlacedOrder | null> {
  const preview = await previewOrderDraft(order);
  if (!preview.valid) {
    setOrdersState("error", preview.errors.join(" "));
    return null;
  }

  setOrdersState("placing", true);
  setOrdersState("error", null);

  try {
    const result = await placeOrder(order);
    // Optimistically prepend to open orders immediately
    setOrdersState("openOrders", (prev) => [result, ...prev]);
    // Persist locally
    savePersistedOrders(ordersState.openOrders, ordersState.tradeHistory);
    // Then fetch authoritative state from exchange (async, non-blocking)
    void refreshOrders();
    return result;
  } catch (err) {
    setOrdersState("error", err instanceof Error ? err.message : "Order failed");
    return null;
  } finally {
    setOrdersState("placing", false);
  }
}

export async function cancelOrderById(orderId: string): Promise<boolean> {
  setOrdersState("cancelling", orderId);
  setOrdersState("error", null);
  setOrdersState("lastBulkAction", null);

  try {
    const ok = await cancelOrder(orderId);
    if (ok) {
      setOrdersState("openOrders", (prev) =>
        prev.map((o) =>
          o.orderId === orderId ? { ...o, status: "CANCELLED" } : o
        )
      );
      setCancelReason(orderId, null);
    }
    return ok;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Cancel failed";
    setOrdersState("error", message);
    setCancelReason(orderId, message);
    return false;
  } finally {
    setOrdersState("cancelling", null);
  }
}

function markOrdersCancelled(orderIds: string[]): void {
  if (orderIds.length === 0) return;
  const idSet = new Set(orderIds);

  setOrdersState("openOrders", (prev) =>
    prev.map((order) =>
      idSet.has(order.orderId)
        ? { ...order, status: "CANCELLED", sizeRemaining: 0 }
        : order
    )
  );

  for (const orderId of orderIds) {
    setCancelReason(orderId, null);
  }
}

export async function cancelAllOpenOrders(): Promise<number> {
  setOrdersState("error", null);
  setOrdersState("lastBulkAction", null);

  const localOpenIds = ordersState.openOrders
    .filter((order) => order.status === "LIVE" || order.status === "DELAYED" || order.status === "UNMATCHED")
    .map((order) => order.orderId)
    .filter(Boolean);

  if (localOpenIds.length === 0) {
    setOrdersState("lastBulkAction", "No cancelable open orders");
    return 0;
  }

  try {
    let { canceled, notCanceled } = await cancelAllOrders();
    if (canceled.length === 0) {
      const fallback = await cancelOrdersBulk(localOpenIds);
      canceled = fallback.canceled;
      notCanceled = fallback.notCanceled;
    }

    markOrdersCancelled(canceled);

    if (Object.keys(notCanceled).length > 0) {
      setCancelReasonsMap(notCanceled);
      const reasons = Object.values(notCanceled).slice(0, 2).join("; ");
      setOrdersState("error", `Some orders not canceled: ${reasons}`);
    }

    setOrdersState(
      "lastBulkAction",
      canceled.length > 0
        ? `Canceled ${canceled.length} open order${canceled.length === 1 ? "" : "s"}`
        : "No orders were canceled"
    );

    return canceled.length;
  } catch (err) {
    setOrdersState("error", err instanceof Error ? err.message : "Cancel all failed");
    return 0;
  }
}

export async function cancelSelectedMarketOpenOrders(tokenIds: string[]): Promise<number> {
  setOrdersState("error", null);
  setOrdersState("lastBulkAction", null);

  const uniqueTokenIds = Array.from(new Set(tokenIds.filter(Boolean)));
  if (uniqueTokenIds.length === 0) {
    setOrdersState("lastBulkAction", "No selected-market tokens to cancel");
    return 0;
  }

  try {
    const result = await cancelOrdersForAssetIds(uniqueTokenIds);
    markOrdersCancelled(result.canceled);

    if (Object.keys(result.notCanceled).length > 0) {
      setCancelReasonsMap(result.notCanceled);
      const reasons = Object.values(result.notCanceled).slice(0, 2).join("; ");
      setOrdersState("error", `Some market orders not canceled: ${reasons}`);
    }

    setOrdersState(
      "lastBulkAction",
      result.canceled.length > 0
        ? `Canceled ${result.canceled.length} market order${result.canceled.length === 1 ? "" : "s"}`
        : "No selected-market orders were canceled"
    );

    return result.canceled.length;
  } catch (err) {
    setOrdersState("error", err instanceof Error ? err.message : "Cancel market orders failed");
    return 0;
  }
}

export async function refreshOrders(): Promise<void> {
  try {
    const [open, history] = await Promise.all([
      fetchOpenOrders(),
      fetchTradeHistory(),
    ]);
    setOrdersState("openOrders", open);
    setOrdersState("tradeHistory", history);
    setOrdersState("lastFetch", new Date());

    // Persist to local storage
    savePersistedOrders(open, history);

    const liveOrderIds = new Set(open.map((order) => order.orderId));
    setOrdersState("cancelReasonsByOrderId", (prev) => {
      const next: Record<string, string> = {};
      for (const [orderId, reason] of Object.entries(prev)) {
        if (liveOrderIds.has(orderId)) {
          next[orderId] = reason;
        }
      }
      return next;
    });

    const scoringCandidates = [
      ...open.map((order) => order.orderId),
      ...history.slice(0, 25).map((order) => order.orderId),
    ];
    void refreshOrderScoring(scoringCandidates);
  } catch {
    // silent
  }
}

export async function refreshOrderScoring(orderIds?: string[]): Promise<void> {
  if (ordersState.scoringRefreshInFlight > 0) {
    return;
  }

  const ids = Array.from(new Set((orderIds ?? [
    ...ordersState.openOrders.map((order) => order.orderId),
    ...ordersState.tradeHistory.slice(0, 25).map((order) => order.orderId),
  ]).filter(Boolean)));

  if (ids.length === 0) {
    return;
  }

  setOrdersState("scoringRefreshInFlight", (value) => value + 1);
  setOrdersState("scoringLastAttemptAt", Date.now());
  setOrdersState("scoringLastError", null);

  try {
    const queue = [...ids];
    const concurrency = 6;

    const worker = async (): Promise<void> => {
      while (queue.length > 0) {
        const orderId = queue.shift();
        if (!orderId) continue;

        const scoring = await getOrderScoringStatus(orderId);
        const updatedAt = Date.now();
        setOrdersState("scoringByOrderId", orderId, scoring);
        setOrdersState("scoringLastUpdatedAtByOrderId", orderId, updatedAt);
      }
    };

    await Promise.all(Array.from({ length: Math.min(concurrency, ids.length) }, () => worker()));

    const liveIds = new Set([
      ...ordersState.openOrders.map((order) => order.orderId),
      ...ordersState.tradeHistory.slice(0, 25).map((order) => order.orderId),
    ]);

    setOrdersState("scoringByOrderId", (prev) => {
      const next: Record<string, boolean | null> = {};
      for (const [orderId, value] of Object.entries(prev)) {
        if (liveIds.has(orderId)) {
          next[orderId] = value;
        }
      }
      return next;
    });

    setOrdersState("scoringLastUpdatedAtByOrderId", (prev) => {
      const next: Record<string, number> = {};
      for (const [orderId, value] of Object.entries(prev)) {
        if (liveIds.has(orderId)) {
          next[orderId] = value;
        }
      }
      return next;
    });
  } catch (error) {
    setOrdersState("scoringLastError", error instanceof Error ? error.message : "Scoring refresh failed");
  } finally {
    setOrdersState("scoringRefreshInFlight", (value) => Math.max(0, value - 1));
  }
}

export function initializeOrderHeartbeat(): void {
  createEffect(() => {
    const hasOpenOrders = ordersState.openOrders.length > 0;

    if (hasOpenOrders) {
      startHeartbeat();
    } else {
      stopHeartbeat();
    }
  });

  onCleanup(() => {
    stopHeartbeat();
  });
}
