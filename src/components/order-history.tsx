/**
 * Order history panel
 * Shows open orders (cancellable) + trade history (filled orders)
 */

import { For, Show } from "solid-js";
import { useTheme } from "../context/theme";
import { ordersState } from "../hooks/useOrders";
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

export function OrderHistory() {
  const { theme } = useTheme();

  const lastFetchStr = () => {
    const d = ordersState.lastFetch;
    return d ? new Date(d).toLocaleTimeString() : "never";
  };

  return (
    <box
      position="absolute"
      top={2}
      left="5%"
      width="90%"
      height={30}
      backgroundColor={theme.backgroundPanel}
      flexDirection="column"
      zIndex={150}
    >
      {/* Header */}
      <box height={1} width="100%" backgroundColor={theme.primary} flexDirection="row">
        <text content=" ORDER HISTORY " fg={theme.highlightText} width={16} />
        <box flexGrow={1} />
        <text content={` Updated: ${lastFetchStr()} `} fg={theme.highlightText} />
        <text content=" [ESC] Close " fg={theme.highlightText} width={14} />
      </box>

      <box flexDirection="column" flexGrow={1} paddingLeft={1} paddingTop={1}>

        {/* Open Orders section */}
        <text content="OPEN ORDERS" fg={theme.primary} />
        <text content="" />

        <Show
          when={ordersState.openOrders.length > 0}
          fallback={<text content="  No open orders" fg={theme.textMuted} />}
        >
          {/* Column headers */}
          <box flexDirection="row" width="100%">
            <text content="TIME          " fg={theme.textMuted} width={14} />
            <text content="SIDE " fg={theme.textMuted} width={5} />
            <text content="PRICE  " fg={theme.textMuted} width={7} />
            <text content="SIZE    " fg={theme.textMuted} width={8} />
            <text content="FILLED  " fg={theme.textMuted} width={8} />
            <text content="STATUS    " fg={theme.textMuted} width={10} />
            <text content="TOKEN ID" fg={theme.textMuted} />
          </box>

          <scrollbox height={8} width="100%">
            <For each={ordersState.openOrders}>
              {(order) => (
                <box flexDirection="row" width="100%">
                  <text content={fmtTime(order.createdAt).padEnd(13, " ")} fg={theme.textMuted} width={14} />
                  <text
                    content={(order.side + " ").padEnd(4, " ")}
                    fg={order.side === "BUY" ? theme.success : theme.error}
                    width={5}
                  />
                  <text content={fmtPrice(order.price).padStart(6, " ")} fg={theme.text} width={7} />
                  <text content={order.originalSize.toFixed(1).padStart(7, " ")} fg={theme.text} width={8} />
                  <text content={order.sizeMatched.toFixed(1).padStart(7, " ")} fg={theme.textMuted} width={8} />
                  <text
                    content={order.status.padEnd(9, " ")}
                    fg={statusColor(order.status, theme)}
                    width={10}
                  />
                  <text
                    content={truncate(order.tokenId, 20)}
                    fg={theme.textMuted}
                  />
                </box>
              )}
            </For>
          </scrollbox>
        </Show>

        <text content="" />

        {/* Trade History section */}
        <text content="TRADE HISTORY (last 50)" fg={theme.primary} />
        <text content="" />

        <Show
          when={ordersState.tradeHistory.length > 0}
          fallback={<text content="  No trades yet" fg={theme.textMuted} />}
        >
          <box flexDirection="row" width="100%">
            <text content="TIME          " fg={theme.textMuted} width={14} />
            <text content="SIDE " fg={theme.textMuted} width={5} />
            <text content="PRICE  " fg={theme.textMuted} width={7} />
            <text content="FILLED  " fg={theme.textMuted} width={8} />
            <text content="TOTAL USDC " fg={theme.textMuted} width={11} />
            <text content="TOKEN ID" fg={theme.textMuted} />
          </box>

          <scrollbox flexGrow={1} width="100%">
            <For each={ordersState.tradeHistory}>
              {(order) => {
                const totalUsdc = order.price * order.sizeMatched;
                return (
                  <box flexDirection="row" width="100%">
                    <text content={fmtTime(order.createdAt).padEnd(13, " ")} fg={theme.textMuted} width={14} />
                    <text
                      content={(order.side + " ").padEnd(4, " ")}
                      fg={order.side === "BUY" ? theme.success : theme.error}
                      width={5}
                    />
                    <text content={fmtPrice(order.price).padStart(6, " ")} fg={theme.text} width={7} />
                    <text content={order.sizeMatched.toFixed(1).padStart(7, " ")} fg={theme.success} width={8} />
                    <text content={`$${totalUsdc.toFixed(2)}`.padStart(10, " ")} fg={theme.text} width={11} />
                    <text content={truncate(order.tokenId, 20)} fg={theme.textMuted} />
                  </box>
                );
              }}
            </For>
          </scrollbox>
        </Show>

        <text content="" />
        <text content="  [C] Cancel selected order   [ESC] Close" fg={theme.textMuted} />
      </box>
    </box>
  );
}
