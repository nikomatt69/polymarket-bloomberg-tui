/**
 * Reactive order state and actions
 */

import { createStore } from "solid-js/store";
import { PlacedOrder } from "../types/orders";
import { placeOrder, cancelOrder, fetchOpenOrders, fetchTradeHistory } from "../api/orders";
import { Order } from "../types/orders";

interface OrdersState {
  openOrders: PlacedOrder[];
  tradeHistory: PlacedOrder[];
  placing: boolean;
  cancelling: string | null; // orderId being cancelled
  error: string | null;
  lastFetch: Date | null;
}

export const [ordersState, setOrdersState] = createStore<OrdersState>({
  openOrders: [],
  tradeHistory: [],
  placing: false,
  cancelling: null,
  error: null,
  lastFetch: null,
});

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

  try {
    const ok = await cancelOrder(orderId);
    if (ok) {
      setOrdersState("openOrders", (prev) =>
        prev.map((o) =>
          o.orderId === orderId ? { ...o, status: "CANCELLED" } : o
        )
      );
    }
    return ok;
  } catch (err) {
    setOrdersState("error", err instanceof Error ? err.message : "Cancel failed");
    return false;
  } finally {
    setOrdersState("cancelling", null);
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
  } catch {
    // silent
  }
}
