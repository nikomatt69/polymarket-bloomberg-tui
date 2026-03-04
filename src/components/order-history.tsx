/**
 * Order history panel
 * Shows open orders (cancellable) + trade history (filled orders)
 */

import { For, Show, createMemo, createEffect } from "solid-js";
import { useTheme } from "../context/theme";
import { PanelHeader, SectionTitle, DataRow, Separator, StatusBadge } from "./ui/panel-components";
import {
  ordersState,
  cancelOrderById,
  cancelAllOpenOrders,
  cancelSelectedMarketOpenOrders,
  getFilteredOpenOrders,
  getFilteredTradeHistory,
  getOrderCancelReason,
} from "../hooks/useOrders";
import {
  orderHistorySelectedIdx,
  setOrderHistorySelectedIdx,
  orderHistoryTradeSelectedIdx,
  setOrderHistoryTradeSelectedIdx,
  orderHistorySection,
  setOrderHistorySection,
  setOrderHistoryOpen,
  getSelectedMarket,
} from "../state";
import { PlacedOrder } from "../types/orders";

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleString("en-US", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function fmtPrice(p: number): string {
  return `${(p * 100).toFixed(1)}¢`;
}

function truncate(str: string, len: number): string {
  if (!str) return " ".repeat(len);
  return str.length > len ? str.slice(0, len - 1) + "…" : str.padEnd(len, " ");
}

function statusColor(status: PlacedOrder["status"], theme: ReturnType<typeof useTheme>["theme"]) {
  switch (status) {
    case "LIVE":      return theme.warning;
    case "MATCHED":
    case "FILLED":    return theme.success;
    case "CANCELLED": return theme.error;
    case "UNMATCHED": return theme.textMuted;
    default:          return theme.text;
  }
}

function statusBadge(status: PlacedOrder["status"]): string {
  switch (status) {
    case "DELAYED":
      return "DELAYED !";
    case "UNMATCHED":
      return "UNMATCH !";
    case "LIVE":
      return "LIVE     ";
    case "MATCHED":
      return "MATCHED  ";
    case "FILLED":
      return "FILLED   ";
    case "CANCELLED":
      return "CANCELLED";
    default:
      return String(status).padEnd(9, " ");
  }
}

function miniBar(pct: number, width: number): string {
  const filled = Math.round(Math.max(0, Math.min(100, pct)) / 100 * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

function statusGuidance(order: PlacedOrder | null): string {
  if (!order) return "Select an order row for execution guidance.";

  switch (order.status) {
    case "LIVE":
      return "LIVE: resting on the book; monitor fills or cancel if edge changed.";
    case "DELAYED":
      return "DELAYED: exchange is delaying match; refresh and retry after short interval.";
    case "UNMATCHED":
      return "UNMATCHED: order accepted but matching delayed failed; consider cancel/repost.";
    case "MATCHED":
      return "MATCHED: execution started; watch fills and position updates.";
    case "FILLED":
      return "FILLED: execution complete; review realized P&L and inventory.";
    case "CANCELLED":
      return "CANCELLED: order removed from book.";
    default:
      return "Order status unavailable.";
  }
}

export function OrderHistory() {
  const { theme } = useTheme();

  const selectedMarketTokenIds = createMemo(() => {
    const market = getSelectedMarket();
    return market ? market.outcomes.map((outcome) => outcome.id) : [];
  });

  const openOrders = createMemo(() => getFilteredOpenOrders(selectedMarketTokenIds()));
  const tradeHistory = createMemo(() => getFilteredTradeHistory(selectedMarketTokenIds()));

  const selectedOpenOrder = createMemo(() =>
    openOrders()[Math.max(0, Math.min(openOrders().length - 1, orderHistorySelectedIdx()))] ?? null
  );

  const selectedTradeOrder = createMemo(() =>
    tradeHistory()[Math.max(0, Math.min(tradeHistory().length - 1, orderHistoryTradeSelectedIdx()))] ?? null
  );

  const activeOrder = createMemo(() =>
    orderHistorySection() === "open" ? selectedOpenOrder() : selectedTradeOrder()
  );

  const activeCancelReason = createMemo(() => {
    if (orderHistorySection() !== "open") return null;
    const order = selectedOpenOrder();
    return order ? getOrderCancelReason(order.orderId) : null;
  });

  createEffect(() => {
    const openCount = openOrders().length;
    const tradeCount = tradeHistory().length;

    if (openCount === 0 && orderHistorySelectedIdx() !== 0) {
      setOrderHistorySelectedIdx(0);
    }
    if (tradeCount === 0 && orderHistoryTradeSelectedIdx() !== 0) {
      setOrderHistoryTradeSelectedIdx(0);
    }

    if (openCount > 0 && orderHistorySelectedIdx() > openCount - 1) {
      setOrderHistorySelectedIdx(openCount - 1);
    }
    if (tradeCount > 0 && orderHistoryTradeSelectedIdx() > tradeCount - 1) {
      setOrderHistoryTradeSelectedIdx(tradeCount - 1);
    }

    if (orderHistorySection() === "open" && openCount === 0 && tradeCount > 0) {
      setOrderHistorySection("trades");
    }
    if (orderHistorySection() === "trades" && tradeCount === 0 && openCount > 0) {
      setOrderHistorySection("open");
    }
  });

  const totalFilled = createMemo(() => tradeHistory().reduce((s, o) => s + o.sizeMatched, 0));
  const totalOrdered = createMemo(() => tradeHistory().reduce((s, o) => s + o.originalSize, 0));
  const fillRate = createMemo(() => totalOrdered() > 0 ? (totalFilled() / totalOrdered()) * 100 : 0);
  const totalUSDC = createMemo(() => tradeHistory().reduce((s, o) => s + o.price * o.sizeMatched, 0));

  const lastExportFile = () => {
    if (!ordersState.lastExportPath) return "none";
    const parts = ordersState.lastExportPath.split("/");
    return parts[parts.length - 1] || ordersState.lastExportPath;
  };

  const lastFetchStr = () => {
    const d = ordersState.lastFetch;
    return d ? new Date(d).toLocaleTimeString() : "never";
  };

  const handleClose = () => {
    setOrderHistoryOpen(false);
    setOrderHistorySelectedIdx(0);
    setOrderHistoryTradeSelectedIdx(0);
    setOrderHistorySection("open");
  };

  return (
    <box
      position="absolute"
      top={2}
      left="8%"
      width="84%"
      height={24}
      backgroundColor={theme.panelModal}
      flexDirection="column"
      zIndex={150}
    >
      {/* Header */}
      <PanelHeader
        title="ORDER HISTORY"
        icon="◈"
        subtitle={`Updated: ${lastFetchStr()}`}
        onClose={handleClose}
      />

      {/* Separator */}
      <box height={1} width="100%" backgroundColor={theme.primaryMuted} />

      <box flexDirection="column" flexGrow={1} paddingLeft={2} paddingTop={1}>
        <text
          content={`Filters  [V] Status:${ordersState.historyStatusFilter}  [B] Side:${ordersState.historySideFilter}  [G] Range:${ordersState.historyWindowFilter}  [M] Market:${ordersState.historySelectedMarketOnly ? "SELECTED" : "ALL"}`}
          fg={theme.textMuted}
        />
        <text content="Quick Status  [1]ALL [2]LIVE [3]MATCHED [4]FILLED [5]CANCEL [6]DELAY [7]UNMATCH" fg={theme.textMuted} />
        <text
          content={`Search  [/] Edit  [X] Clear  Query: ${ordersState.historySearchQuery || "(none)"}`}
          fg={ordersState.historySearchEditing ? theme.warning : theme.textMuted}
        />
        <text content={`Export [E] CSV  Last: ${lastExportFile()}`} fg={theme.textMuted} />

        <Show when={ordersState.historySearchEditing}>
          <text content={`Search Input: ${ordersState.historySearchQuery}▌`} fg={theme.warning} />
          <text content="ENTER to apply, ESC to stop editing" fg={theme.textMuted} />
        </Show>

        <text content="" />

        {/* Open Orders section */}
        <box flexDirection="row" height={1} paddingBottom={1}>
          <text content={`─── OPEN ORDERS (${openOrders().length}) `} fg={theme.borderSubtle} />
          <Show when={orderHistorySection() === "open"}>
            <text content="▶ " fg={theme.primary} />
          </Show>
          <text content="[TAB] switch" fg={theme.borderSubtle} />
        </box>

        <Show
          when={openOrders().length > 0}
          fallback={<text content="No open orders" fg={theme.textMuted} />}
        >
          {/* Column headers */}
          <box flexDirection="row" width="100%">
            <text content="   " fg={theme.textMuted} width={3} />
            <text content="TIME         " fg={theme.textMuted} width={14} />
            <text content="SIDE " fg={theme.textMuted} width={5} />
            <text content="PRICE  " fg={theme.textMuted} width={7} />
            <text content="SIZE    " fg={theme.textMuted} width={8} />
            <text content="FILLED  " fg={theme.textMuted} width={8} />
            <text content="STATUS    " fg={theme.textMuted} width={10} />
            <text content="FILL BAR+%      " fg={theme.textMuted} width={16} />
            <text content="MARKET" fg={theme.textMuted} />
          </box>

          <scrollbox height={8} width="100%">
            <For each={openOrders()}>
              {(order, idx) => {
                const isSelected = () => idx() === orderHistorySelectedIdx();
                const isCancelling = () => ordersState.cancelling === order.orderId;
                const orderFillPct = () => order.originalSize > 0 ? (order.sizeMatched / order.originalSize) * 100 : 0;
                const fillColor = () => orderFillPct() >= 100 ? theme.success : orderFillPct() >= 50 ? theme.warning : theme.error;
                return (
                  <box
                    flexDirection="row"
                    width="100%"
                    backgroundColor={isSelected() && orderHistorySection() === "open" ? theme.highlight : undefined}
                    onMouseDown={() => {
                      setOrderHistorySection("open");
                      setOrderHistorySelectedIdx(idx());
                    }}
                  >
                    <text content={isSelected() && orderHistorySection() === "open" ? " ▶ " : "   "} fg={theme.primary} width={3} />
                    <text content={fmtTime(order.createdAt).padEnd(13, " ")} fg={isSelected() && orderHistorySection() === "open" ? theme.highlightText : theme.textMuted} width={14} />
                    <text
                      content={(order.side + " ").padEnd(4, " ")}
                      fg={order.side === "BUY" ? theme.success : theme.error}
                      width={5}
                    />
                    <text content={fmtPrice(order.price).padStart(6, " ")} fg={isSelected() && orderHistorySection() === "open" ? theme.highlightText : theme.text} width={7} />
                    <text content={order.originalSize.toFixed(1).padStart(7, " ")} fg={isSelected() && orderHistorySection() === "open" ? theme.highlightText : theme.text} width={8} />
                    <text content={order.sizeMatched.toFixed(1).padStart(7, " ")} fg={theme.textMuted} width={8} />
                    <text
                      content={isCancelling() ? "CANCL…   " : statusBadge(order.status)}
                      fg={isCancelling() ? theme.warning : statusColor(order.status, theme)}
                      width={10}
                    />
                    <text content={`${miniBar(orderFillPct(), 8)} ${orderFillPct().toFixed(0)}%`} fg={fillColor()} width={16} />
                    <text content={truncate((order as any).marketTitle ?? order.tokenId, 20)} fg={theme.textMuted} />
                  </box>
                );
              }}
            </For>
          </scrollbox>
        </Show>

        <text content="" />

        {/* Trade History section */}
        <box flexDirection="row" height={1} paddingBottom={1}>
          <text content={`─── TRADE HISTORY (${tradeHistory().length}) `} fg={theme.borderSubtle} />
          <Show when={orderHistorySection() === "trades"}>
            <text content="▶ " fg={theme.primary} />
          </Show>
          <text content={`Fill rate: ${fillRate().toFixed(1)}%`} fg={fillRate() >= 80 ? theme.success : fillRate() >= 50 ? theme.warning : theme.error} />
        </box>

        <Show
          when={tradeHistory().length > 0}
          fallback={<text content="No trades yet" fg={theme.textMuted} />}
        >
          <box flexDirection="row" width="100%">
            <text content="TIME         " fg={theme.textMuted} width={14} />
            <text content="SIDE " fg={theme.textMuted} width={5} />
            <text content="PRICE  " fg={theme.textMuted} width={7} />
            <text content="FILLED  " fg={theme.textMuted} width={8} />
            <text content="TOTAL USDC " fg={theme.textMuted} width={11} />
            <text content="FILL% " fg={theme.textMuted} width={7} />
            <text content="MARKET" fg={theme.textMuted} />
          </box>

          <scrollbox flexGrow={1} width="100%">
            <For each={tradeHistory()}>
              {(order, idx) => {
                const totalUsdc = order.price * order.sizeMatched;
                const isSelected = () => idx() === orderHistoryTradeSelectedIdx();
                const orderFillPct = order.originalSize > 0 ? (order.sizeMatched / order.originalSize) * 100 : 0;
                const fillColor = orderFillPct >= 100 ? theme.success : orderFillPct >= 50 ? theme.warning : theme.error;
                return (
                  <box
                    flexDirection="row"
                    width="100%"
                    backgroundColor={isSelected() && orderHistorySection() === "trades" ? theme.highlight : undefined}
                    onMouseDown={() => {
                      setOrderHistorySection("trades");
                      setOrderHistoryTradeSelectedIdx(idx());
                    }}
                  >
                    <text content={fmtTime(order.createdAt).padEnd(13, " ")} fg={isSelected() && orderHistorySection() === "trades" ? theme.highlightText : theme.textMuted} width={14} />
                    <text
                      content={(order.side + " ").padEnd(4, " ")}
                      fg={order.side === "BUY" ? theme.success : theme.error}
                      width={5}
                    />
                    <text content={fmtPrice(order.price).padStart(6, " ")} fg={isSelected() && orderHistorySection() === "trades" ? theme.highlightText : theme.text} width={7} />
                    <text content={order.sizeMatched.toFixed(1).padStart(7, " ")} fg={isSelected() && orderHistorySection() === "trades" ? theme.highlightText : theme.success} width={8} />
                    <text content={`$${totalUsdc.toFixed(2)}`.padStart(10, " ")} fg={isSelected() && orderHistorySection() === "trades" ? theme.highlightText : theme.text} width={11} />
                    <text content={`${orderFillPct.toFixed(0)}%`.padStart(6, " ")} fg={fillColor} width={7} />
                    <text content={truncate((order as any).marketTitle ?? order.tokenId, 18)} fg={theme.textMuted} />
                  </box>
                );
              }}
            </For>
          </scrollbox>

          {/* Stats summary */}
          <box flexDirection="row" width="100%" paddingTop={1} gap={1}>
            <text content={`Trades: ${tradeHistory().length}`} fg={theme.textMuted} />
            <text content=" │ " fg={theme.borderSubtle} />
            <text content={`Filled: $${totalUSDC().toFixed(2)}`} fg={theme.text} />
            <text content=" │ " fg={theme.borderSubtle} />
            <text content={`FillRate: ${fillRate().toFixed(1)}%`} fg={fillRate() >= 80 ? theme.success : fillRate() >= 50 ? theme.warning : theme.error} />
          </box>
        </Show>

        <text content="" />
        <box flexDirection="column" width="100%" backgroundColor={theme.backgroundPanel} paddingLeft={1} paddingTop={0}>
          <text content="─── ORDER DETAILS ───" fg={theme.borderSubtle} />
          <text content={statusGuidance(activeOrder())} fg={theme.textMuted} />
        </box>
        <Show when={activeCancelReason()}>
          <text content={`Last cancel reason: ${activeCancelReason()}`} fg={theme.error} />
        </Show>
        <Show when={ordersState.lastBulkAction}>
          <text content={`Bulk action: ${ordersState.lastBulkAction}`} fg={theme.warning} />
        </Show>
        <text content="" />

        {/* Action hint */}
        <box flexDirection="row" gap={3}>
          <Show when={openOrders().length > 0}>
            <box
              onMouseDown={() => {
                const order = openOrders()[orderHistorySelectedIdx()];
                if (order && (order.status === "LIVE" || order.status === "DELAYED" || order.status === "UNMATCHED")) {
                  cancelOrderById(order.orderId);
                }
              }}
            >
              <text content="[C] Cancel selected" fg={theme.error} />
            </box>
          </Show>
          <box onMouseDown={() => { void cancelAllOpenOrders(); }}>
            <text content="[A] Cancel all" fg={theme.error} />
          </box>
          <box onMouseDown={() => { void cancelSelectedMarketOpenOrders(selectedMarketTokenIds()); }}>
            <text content="[Y] Cancel market" fg={theme.error} />
          </box>
          <text content="[TAB] Switch section" fg={theme.textMuted} />
          <text content="[D] Duplicate to order form" fg={theme.textMuted} />
          <text content="[E] Export CSV" fg={theme.textMuted} />
          <text content="[B/V/G] Side/Status/Range" fg={theme.textMuted} />
          <text content="[↑↓/JK] Navigate" fg={theme.textMuted} />
          <box onMouseDown={handleClose}>
            <text content="[ESC] Close" fg={theme.textMuted} />
          </box>
        </box>
      </box>
    </box>
  );
}
