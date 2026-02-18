/**
 * Reactive order state and actions
 */

import { createStore } from "solid-js/store";
import { PlacedOrder } from "../types/orders";
import {
  placeOrder,
  cancelOrder,
  fetchOpenOrders,
  fetchTradeHistory,
  cancelAllOrders,
  cancelOrdersBulk,
  cancelOrdersForAssetIds,
} from "../api/orders";
import { Order } from "../types/orders";
import { OrderStatus } from "../types/orders";
import { homedir } from "os";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

export type OrderHistoryStatusFilter = "ALL" | OrderStatus;
export type OrderHistoryWindowFilter = "ALL" | "24H" | "7D" | "30D";
export type OrderHistorySideFilter = "ALL" | "BUY" | "SELL";
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
  historySelectedMarketOnly: boolean;
  historySearchQuery: string;
  historySearchEditing: boolean;
  lastExportPath: string | null;
}

export const [ordersState, setOrdersState] = createStore<OrdersState>({
  openOrders: [],
  tradeHistory: [],
  placing: false,
  cancelling: null,
  error: null,
  lastFetch: null,
  cancelReasonsByOrderId: {},
  lastBulkAction: null,
  historyStatusFilter: "ALL",
  historyWindowFilter: "ALL",
  historySideFilter: "ALL",
  historySelectedMarketOnly: false,
  historySearchQuery: "",
  historySearchEditing: false,
  lastExportPath: null,
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
    "kind,createdAtIso,orderId,status,side,tokenId,marketTitle,outcomeTitle,price,originalSize,sizeMatched,sizeRemaining,notionalUsd",
    ...allRows.map(({ kind, order }) => [
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
    ].map(csvEscape).join(",")),
  ];

  const fileName = `orders_${formatTimestampForFile(Date.now())}.csv`;
  const outputPath = join(getExportDir(), fileName);
  writeFileSync(outputPath, `${lines.join("\n")}\n`);
  setOrdersState("lastExportPath", outputPath);
  return outputPath;
}

export async function submitOrder(order: Order): Promise<PlacedOrder | null> {
  setOrdersState("placing", true);
  setOrdersState("error", null);

  try {
    const result = await placeOrder(order);
    setOrdersState("openOrders", (prev) => [result, ...prev]);
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
  } catch {
    // silent
  }
}
