/**
 * Order entry modal — opened with O key (buy) or S key (sell) on selected market
 * TAB switches between price/shares fields
 * ENTER submits, ESC cancels
 */

import { Show, createMemo, createSignal, createEffect } from "solid-js";
import { useTheme } from "../context/theme";
import {
  walletState,
  orderFormSide,
  orderFormTokenId,
  orderFormMarketTitle,
  orderFormOutcomeTitle,
  orderFormCurrentPrice,
  orderFormPriceInput,
  orderFormSharesInput,
  orderFormFocusField,
  orderFormType,
  orderFormPostOnly,
  setOrderFormType,
  setOrderFormPostOnly,
  setOrderFormOpen,
  setOrderFormPriceInput,
  setOrderFormSharesInput,
} from "../state";
import { ordersState } from "../hooks/useOrders";
import { getOrderBookSummary, OrderBookSummary } from "../api/polymarket";

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}

function formatCents(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "--";
  return `${(value * 100).toFixed(2)}¢`;
}

function formatBps(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "--";
  return `${value.toFixed(0)}bp`;
}

function isTickAligned(price: number, tickSize: number): boolean {
  if (!Number.isFinite(price) || !Number.isFinite(tickSize) || tickSize <= 0) return true;
  const ratio = price / tickSize;
  return Math.abs(ratio - Math.round(ratio)) < 1e-6;
}

export function OrderForm() {
  const { theme } = useTheme();
  const side = orderFormSide;
  const sideColor = () => (side() === "BUY" ? theme.success : theme.error);

  const [orderBook, setOrderBook] = createSignal<OrderBookSummary | null>(null);
  const [bookLoading, setBookLoading] = createSignal(false);

  createEffect(() => {
    const tokenId = orderFormTokenId();
    if (!tokenId) {
      setOrderBook(null);
      setBookLoading(false);
      return;
    }

    let cancelled = false;
    setBookLoading(true);

    void (async () => {
      try {
        const snapshot = await getOrderBookSummary(tokenId);
        if (!cancelled) {
          setOrderBook(snapshot);
        }
      } finally {
        if (!cancelled) {
          setBookLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  });

  const parsedPrice = createMemo(() => Number.parseFloat(orderFormPriceInput()));
  const parsedShares = createMemo(() => Number.parseFloat(orderFormSharesInput()));

  const estimatedCost = createMemo(() => {
    const price = parsedPrice();
    const shares = parsedShares();
    if (isNaN(price) || isNaN(shares) || price <= 0 || shares <= 0) return null;
    return price * shares;
  });

  const priceValid = createMemo(() => {
    const v = parsedPrice();
    return !isNaN(v) && v > 0 && v < 1;
  });

  const sharesValid = createMemo(() => {
    const v = parsedShares();
    return !isNaN(v) && v > 0;
  });

  const buyBalanceExceeded = createMemo(() =>
    side() === "BUY"
    && estimatedCost() !== null
    && estimatedCost()! > walletState.balance + 1e-6
  );

  const buyBalanceTight = createMemo(() =>
    side() === "BUY"
    && estimatedCost() !== null
    && !buyBalanceExceeded()
    && estimatedCost()! > walletState.balance * 0.9
  );

  const tickSizeInvalid = createMemo(() => {
    const tick = orderBook()?.tickSize;
    if (tick === null || tick === undefined) return false;
    if (!priceValid()) return false;
    return !isTickAligned(parsedPrice(), tick);
  });

  const minSizeInvalid = createMemo(() => {
    const minSize = orderBook()?.minOrderSize;
    if (minSize === null || minSize === undefined) return false;
    if (!sharesValid()) return false;
    return parsedShares() < minSize;
  });

  const quoteReferencePrice = createMemo(() => {
    const snapshot = orderBook();
    if (!snapshot) return orderFormCurrentPrice();

    if (side() === "BUY") {
      return snapshot.bestAsk ?? snapshot.midpoint ?? orderFormCurrentPrice();
    }
    return snapshot.bestBid ?? snapshot.midpoint ?? orderFormCurrentPrice();
  });

  const adverseDistanceBps = createMemo(() => {
    if (!priceValid()) return 0;
    const ref = quoteReferencePrice();
    if (!Number.isFinite(ref) || ref <= 0) return 0;

    const px = parsedPrice();
    if (side() === "BUY") {
      return px > ref ? ((px - ref) / ref) * 10_000 : 0;
    }

    return px < ref ? ((ref - px) / ref) * 10_000 : 0;
  });

  const slippageWarning = createMemo(() => {
    if (!orderBook() || !priceValid()) return null;
    const adverseBps = adverseDistanceBps();
    if (adverseBps >= 250) {
      return `High slippage risk: ${adverseBps.toFixed(0)}bp away from top-of-book.`;
    }
    if (adverseBps >= 100) {
      return `Execution is ${adverseBps.toFixed(0)}bp away from top-of-book.`;
    }
    return null;
  });

  const spreadWarning = createMemo(() => {
    const spreadBps = orderBook()?.spreadBps;
    if (spreadBps === null || spreadBps === undefined) return null;
    if (spreadBps >= 150) {
      return `Wide spread: ${spreadBps.toFixed(0)}bp. Prefer passive pricing.`;
    }
    return null;
  });

  const invalidPostOnlyConfig = createMemo(() =>
    orderFormPostOnly() && orderFormType() === "FOK"
  );

  const canSubmit = createMemo(() =>
    priceValid()
    && sharesValid()
    && !invalidPostOnlyConfig()
    && !buyBalanceExceeded()
    && !tickSizeInvalid()
    && !minSizeInvalid()
    && !ordersState.placing
  );

  return (
    <box
      position="absolute"
      top={3}
      left="20%"
      width="60%"
      height={19}
      backgroundColor={theme.panelModal}
      flexDirection="column"
      zIndex={200}
    >
      {/* Header */}
      <box height={1} width="100%" backgroundColor={sideColor()} flexDirection="row">
        <text content={` ◈ ${side()} ORDER `} fg={theme.highlightText} />
        <box flexGrow={1} />
        <box onMouseDown={() => {
          setOrderFormOpen(false);
          setOrderFormPriceInput("");
          setOrderFormSharesInput("");
          setOrderFormPostOnly(false);
        }}>
          <text content=" [ESC] ✕ " fg={theme.highlightText} />
        </box>
      </box>

      {/* Separator */}
      <box height={1} width="100%" backgroundColor={sideColor()} />

      {/* Market info */}
      <box flexDirection="column" paddingLeft={2} paddingTop={1}>
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
        <Show when={orderBook()} fallback={<Show when={bookLoading()}><text content="Book: loading..." fg={theme.textMuted} /></Show>}>
          <text
            content={`Book  Bid:${formatCents(orderBook()?.bestBid)}  Ask:${formatCents(orderBook()?.bestAsk)}  Mid:${formatCents(orderBook()?.midpoint)}  Spread:${formatBps(orderBook()?.spreadBps)}`}
            fg={theme.textMuted}
          />
        </Show>
      </box>

      <text content="" />

      {/* Fields */}
      <box flexDirection="column" paddingLeft={2} paddingTop={1} gap={0}>
        <box flexDirection="row" alignItems="center">
          <text content="Order Type   : " fg={theme.textMuted} width={16} />
          <box onMouseDown={() => {
            const types: Array<"GTC"|"FOK"|"GTD"> = ["GTC","FOK","GTD"];
            setOrderFormType(types[(types.indexOf(orderFormType()) + 1) % types.length]);
          }}>
            <text content={`[${orderFormType()}]`} fg={theme.warning} />
          </box>
          <text content="  [T] Toggle" fg={theme.textMuted} />
        </box>

        <box flexDirection="row" alignItems="center">
          <text content="Post Only    : " fg={theme.textMuted} width={16} />
          <box onMouseDown={() => setOrderFormPostOnly(!orderFormPostOnly())}>
            <text
              content={orderFormPostOnly() ? "[ON]" : "[OFF]"}
              fg={orderFormPostOnly() ? theme.success : theme.textMuted}
            />
          </box>
          <text content="  [P] Toggle" fg={theme.textMuted} />
        </box>

        <Show when={invalidPostOnlyConfig()}>
          <text content="Post-only is not valid with FOK; use GTC/GTD." fg={theme.error} />
        </Show>

        <text content="" />

        <box flexDirection="row" alignItems="center">
          <text
            content={orderFormFocusField() === "price" ? "▶ Price  (0-1): " : "  Price  (0-1): "}
            fg={orderFormFocusField() === "price" ? sideColor() : theme.textMuted}
            width={17}
          />
          <input
            width={12}
            value={orderFormPriceInput()}
            focused={orderFormFocusField() === "price"}
          />
          <Show when={orderFormPriceInput() !== "" && !priceValid()}>
            <text content="  ✗ 0-1" fg={theme.error} />
          </Show>
          <Show when={tickSizeInvalid()}>
            <text content={`  ✗ Tick ${formatCents(orderBook()?.tickSize)}`} fg={theme.error} />
          </Show>
        </box>

        <box flexDirection="row" alignItems="center">
          <text
            content={orderFormFocusField() === "shares" ? "▶ Shares       : " : "  Shares       : "}
            fg={orderFormFocusField() === "shares" ? sideColor() : theme.textMuted}
            width={17}
          />
          <input
            width={12}
            value={orderFormSharesInput()}
            focused={orderFormFocusField() === "shares"}
          />
          <Show when={minSizeInvalid()}>
            <text content={`  ✗ Min ${orderBook()?.minOrderSize?.toFixed(2) ?? "--"}`} fg={theme.error} />
          </Show>
        </box>

        <Show when={estimatedCost() !== null}>
          <box flexDirection="row">
            <text content="  Est. Cost    : " fg={theme.textMuted} width={17} />
            <text content={`$${estimatedCost()!.toFixed(4)} USDC`} fg={theme.warning} />
            <text content={`  (Bal: $${walletState.balance.toFixed(2)})`} fg={theme.textMuted} />
          </box>
        </Show>

        <Show when={buyBalanceExceeded()}>
          <text content="Insufficient USDC balance for this BUY order." fg={theme.error} />
        </Show>
        <Show when={!buyBalanceExceeded() && buyBalanceTight()}>
          <text content="High balance usage: this order consumes over 90% of available USDC." fg={theme.warning} />
        </Show>
        <Show when={slippageWarning()}>
          <text content={slippageWarning()!} fg={theme.warning} />
        </Show>
        <Show when={spreadWarning()}>
          <text content={spreadWarning()!} fg={theme.warning} />
        </Show>
      </box>

      <text content="" />

      {/* Status / hints */}
      <box paddingLeft={2}>
        <Show when={ordersState.placing}>
          <text content="Placing order..." fg={theme.warning} />
        </Show>
        <Show when={!ordersState.placing && ordersState.error !== null}>
          <text content={`✗ ${ordersState.error}`} fg={theme.error} />
        </Show>
        <Show when={!ordersState.placing && ordersState.error === null}>
          <box flexDirection="row" gap={2}>
            <text content="[ENTER] Confirm" fg={canSubmit() ? sideColor() : theme.textMuted} />
            <text content="[TAB] Switch" fg={theme.textMuted} />
            <text content="[T] Type" fg={theme.textMuted} />
            <text content="[P] PostOnly" fg={theme.textMuted} />
          </box>
        </Show>
      </box>
    </box>
  );
}
