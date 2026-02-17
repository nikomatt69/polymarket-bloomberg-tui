/**
 * Order entry modal — opened with O key (buy) or S key (sell) on selected market
 * TAB switches between price/shares fields
 * ENTER submits, ESC cancels
 */

import { Show, createMemo } from "solid-js";
import { useTheme } from "../context/theme";
import {
  walletState,
  orderFormSide,
  orderFormMarketTitle,
  orderFormOutcomeTitle,
  orderFormCurrentPrice,
  orderFormPriceInput,
  orderFormSharesInput,
  orderFormFocusField,
} from "../state";
import { ordersState } from "../hooks/useOrders";

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}

export function OrderForm() {
  const { theme } = useTheme();
  const side = orderFormSide;
  const sideColor = () => (side() === "BUY" ? theme.success : theme.error);

  const estimatedCost = createMemo(() => {
    const price = parseFloat(orderFormPriceInput());
    const shares = parseFloat(orderFormSharesInput());
    if (isNaN(price) || isNaN(shares) || price <= 0 || shares <= 0) return null;
    return price * shares;
  });

  const priceValid = createMemo(() => {
    const v = parseFloat(orderFormPriceInput());
    return !isNaN(v) && v > 0 && v < 1;
  });

  const sharesValid = createMemo(() => {
    const v = parseFloat(orderFormSharesInput());
    return !isNaN(v) && v > 0;
  });

  const canSubmit = createMemo(() => priceValid() && sharesValid() && !ordersState.placing);

  return (
    <box
      position="absolute"
      top={3}
      left="20%"
      width="60%"
      height={18}
      backgroundColor={theme.backgroundPanel}
      flexDirection="column"
      zIndex={200}
    >
      {/* Header */}
      <box height={1} width="100%" backgroundColor={sideColor()} flexDirection="row">
        <text
          content={` ${side()} ORDER `}
          fg={theme.highlightText}
          width={14}
        />
        <box flexGrow={1} />
        <text content=" [ESC] Cancel " fg={theme.highlightText} width={15} />
      </box>

      {/* Market info */}
      <box flexDirection="column" paddingLeft={1} paddingTop={1}>
        <box flexDirection="row" gap={1}>
          <text content="Market :" fg={theme.textMuted} width={10} />
          <text content={truncate(orderFormMarketTitle(), 48)} fg={theme.textBright} />
        </box>
        <box flexDirection="row" gap={1}>
          <text content="Outcome:" fg={theme.textMuted} width={10} />
          <text content={orderFormOutcomeTitle()} fg={sideColor()} />
          <text content="  curr:" fg={theme.textMuted} />
          <text content={`${(orderFormCurrentPrice() * 100).toFixed(1)}¢`} fg={theme.text} />
        </box>
      </box>

      <text content="" />

      {/* Price field */}
      <box flexDirection="row" paddingLeft={1} alignItems="center">
        <text
          content={orderFormFocusField() === "price" ? "▶ Price  (0-1): " : "  Price  (0-1): "}
          fg={orderFormFocusField() === "price" ? sideColor() : theme.textMuted}
          width={18}
        />
        <input
          width={12}
          placeholder="0.00"
          value={orderFormPriceInput()}
          focused={orderFormFocusField() === "price"}
        />
        <Show when={orderFormPriceInput() !== "" && !priceValid()}>
          <text content="  ✗ must be 0-1" fg={theme.error} />
        </Show>
      </box>

      <text content="" />

      {/* Shares field */}
      <box flexDirection="row" paddingLeft={1} alignItems="center">
        <text
          content={orderFormFocusField() === "shares" ? "▶ Shares       : " : "  Shares       : "}
          fg={orderFormFocusField() === "shares" ? sideColor() : theme.textMuted}
          width={18}
        />
        <input
          width={12}
          placeholder="0.00"
          value={orderFormSharesInput()}
          focused={orderFormFocusField() === "shares"}
        />
      </box>

      <text content="" />

      {/* Estimated cost */}
      <box paddingLeft={1}>
        <Show when={estimatedCost() !== null}>
          <box flexDirection="row">
            <text content="  Est. Cost    : " fg={theme.textMuted} width={18} />
            <text content={`$${estimatedCost()!.toFixed(4)} USDC`} fg={theme.warning} />
            <text content={`  (Balance: $${walletState.balance.toFixed(2)})`} fg={theme.textMuted} />
          </box>
        </Show>
      </box>

      <text content="" />

      {/* Status / error */}
      <box paddingLeft={1}>
        <Show when={ordersState.placing}>
          <text content="  Placing order..." fg={theme.warning} />
        </Show>
        <Show when={!ordersState.placing && ordersState.error !== null}>
          <text content={`  ✗ ${ordersState.error}`} fg={theme.error} />
        </Show>
        <Show when={!ordersState.placing && ordersState.error === null}>
          <box flexDirection="row" gap={2}>
            <text
              content={canSubmit() ? "  [ENTER] Confirm" : "  [ENTER] Confirm"}
              fg={canSubmit() ? sideColor() : theme.textMuted}
            />
            <text content="  [TAB] Switch field" fg={theme.textMuted} />
            <text content="  [ESC] Cancel" fg={theme.textMuted} />
          </box>
        </Show>
      </box>
    </box>
  );
}
