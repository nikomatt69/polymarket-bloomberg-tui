/**
 * Order entry modal — opened with O key (buy) or S key (sell) on selected market
 * TAB switches between price/shares fields
 * ENTER submits, ESC cancels
 */

import { Show, createMemo, createSignal, createEffect } from "solid-js";
import { useTheme } from "../context/theme";
import { PanelHeader, SectionTitle, DataRow, Separator, StatusBadge } from "./ui/panel-components";
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
  setOrderFormNegRisk,
} from "../state";
import { ordersState } from "../hooks/useOrders";
import { positionsState } from "../hooks/usePositions";
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
      setOrderFormNegRisk(false);
      return;
    }

    let cancelled = false;
    setBookLoading(true);

    void (async () => {
      try {
        const snapshot = await getOrderBookSummary(tokenId);
        if (!cancelled) {
          setOrderBook(snapshot);
          setOrderFormNegRisk(snapshot?.negRisk === true);
        }
      } catch {
        if (!cancelled) {
          setOrderBook(null);
          setOrderFormNegRisk(false);
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
    return !isNaN(v) && v >= 0.01 && v <= 0.99;
  });

  const sharesValid = createMemo(() => {
    const v = parsedShares();
    if (isNaN(v) || v <= 0) return false;
    // Check max 2 decimal places
    const sharesTimes100 = v * 100;
    return Number.isInteger(sharesTimes100) || sharesTimes100 % 1 < 0.01;
  });

  // Use funder/proxy balance for trading (funds are in the proxy wallet)
  const tradingBalance = createMemo(() =>
    walletState.funderAddress ? walletState.funderBalance : walletState.balance
  );

  const buyBalanceExceeded = createMemo(() =>
    side() === "BUY"
    && estimatedCost() !== null
    && estimatedCost()! > tradingBalance() + 1e-6
  );

  const buyBalanceTight = createMemo(() =>
    side() === "BUY"
    && estimatedCost() !== null
    && !buyBalanceExceeded()
    && estimatedCost()! > tradingBalance() * 0.9
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

  const postOnlyCrossingInvalid = createMemo(() => {
    if (!orderFormPostOnly() || !priceValid()) return false;
    const snapshot = orderBook();
    if (!snapshot) return false;

    if (side() === "BUY") {
      return snapshot.bestAsk !== null && parsedPrice() >= snapshot.bestAsk;
    }

    return snapshot.bestBid !== null && parsedPrice() <= snapshot.bestBid;
  });

  const topOfBookDepth = createMemo(() => {
    const snapshot = orderBook();
    if (!snapshot) return null;
    return side() === "BUY" ? snapshot.askDepth : snapshot.bidDepth;
  });

  const bookParticipation = createMemo(() => {
    if (!sharesValid()) return null;
    const depth = topOfBookDepth();
    if (!Number.isFinite(depth) || depth === null || depth <= 0) return null;
    return parsedShares() / depth;
  });

  const marketImpactWarning = createMemo(() => {
    const participation = bookParticipation();
    if (participation === null) return null;
    if (participation >= 0.5) {
      return "Order size is over 50% of visible top-book depth; execution quality may degrade.";
    }
    if (participation >= 0.25) {
      return "Order size is over 25% of visible top-book depth; consider slicing the order.";
    }
    return null;
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

  const breakevenPrice = createMemo(() => {
    const p = parsedPrice();
    return Number.isFinite(p) ? p : null;
  });

  const kellySizing = createMemo(() => {
    const p = parsedPrice();
    if (!Number.isFinite(p) || p <= 0 || p >= 1) return null;
    const b = (1 - p) / p;
    const k = (p * (b + 1) - 1) / b;
    if (k <= 0) return 0;
    const bal = tradingBalance();
    return Math.min(k * bal, bal * 0.25);
  });

  const positionImpact = createMemo(() => {
    const existingTotal = positionsState.positions.reduce((s, pos) => s + pos.currentValue, 0);
    const newCost = estimatedCost() ?? 0;
    return side() === "BUY"
      ? existingTotal + newCost
      : Math.max(0, existingTotal - newCost);
  });

  const canSubmit = createMemo(() =>
    priceValid()
    && sharesValid()
    && !invalidPostOnlyConfig()
    && !buyBalanceExceeded()
    && !tickSizeInvalid()
    && !minSizeInvalid()
    && !postOnlyCrossingInvalid()
    && !ordersState.placing
  );

  return (
    <box
      position="absolute"
      top={3}
      left="20%"
      width="60%"
      height={27}
      backgroundColor={theme.panelModal}
      flexDirection="column"
      zIndex={200}
    >
      {/* Header */}
      <PanelHeader
        title={`${side()} ORDER`}
        icon="◈"
        onClose={() => {
          setOrderFormOpen(false);
          setOrderFormPriceInput("");
          setOrderFormSharesInput("");
          setOrderFormPostOnly(false);
        }}
      />

      {/* Separator */}
      <box height={1} width="100%" backgroundColor={sideColor()} />

      {/* Market info */}
      <box flexDirection="column" paddingLeft={2} paddingTop={1}>
        <text content="─── MARKET ──────────────────────────────────────────" fg={theme.borderSubtle} />
        <box flexDirection="row" paddingTop={1}>
          <text content="Market : " fg={theme.textMuted} width={10} />
          <text content={truncate(orderFormMarketTitle(), 46)} fg={theme.textBright} />
        </box>
        <box flexDirection="row">
          <text content="Outcome: " fg={theme.textMuted} width={10} />
          <text content={orderFormOutcomeTitle()} fg={sideColor()} />
          <text content="  curr:" fg={theme.textMuted} />
          <text content={`${(orderFormCurrentPrice() * 100).toFixed(1)}¢`} fg={theme.text} />
        </box>
        <Show when={bookLoading()}>
          <text content="Book   : loading..." fg={theme.textMuted} />
        </Show>
        <Show when={orderBook()}>
          <box flexDirection="row">
            <text content="Book   : " fg={theme.textMuted} width={10} />
            <text content="Bid " fg={theme.textMuted} />
            <text content={formatCents(orderBook()?.bestBid)} fg={theme.success} />
            <text content="  Ask " fg={theme.textMuted} />
            <text content={formatCents(orderBook()?.bestAsk)} fg={theme.error} />
            <text content="  Mid " fg={theme.textMuted} />
            <text content={formatCents(orderBook()?.midpoint)} fg={theme.text} />
            <text content="  Spread " fg={theme.textMuted} />
            <text content={formatBps(orderBook()?.spreadBps)} fg={theme.warning} />
          </box>
          <box flexDirection="row">
            <text content="       " width={10} />
            <text content="Last " fg={theme.textMuted} />
            <text content={formatCents(orderBook()?.lastTradePrice)} fg={theme.accent} />
            <text content="  Depth B/A " fg={theme.textMuted} />
            <text
              content={`${(orderBook()?.bidDepth ?? 0).toFixed(2)} / ${(orderBook()?.askDepth ?? 0).toFixed(2)}`}
              fg={theme.textMuted}
            />
          </box>
        </Show>
      </box>

      {/* Fields */}
      <box flexDirection="column" paddingLeft={2} paddingTop={1} gap={0}>
        <text content="─── ORDER PARAMETERS ────────────────────────────────" fg={theme.borderSubtle} />
        <box flexDirection="row" alignItems="center">
          <text content="Order Type   : " fg={theme.textMuted} width={16} />
          <box onMouseDown={() => {
            const types: Array<"GTC"|"FOK"|"GTD"|"FAK"> = ["GTC","FOK","GTD","FAK"];
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
        <Show when={postOnlyCrossingInvalid()}>
          <text content="Post-only order crosses the current book; adjust price away from top-of-book." fg={theme.error} />
        </Show>

        <text content="" />

        <box flexDirection="row" alignItems="center">
          <text
            content={orderFormFocusField() === "price" ? "▶ Price (0.01-0.99): " : "  Price (0.01-0.99): "}
            fg={orderFormFocusField() === "price" ? sideColor() : theme.textMuted}
            width={17}
          />
          <input
            width={12}
            value={orderFormPriceInput()}
            focused={orderFormFocusField() === "price"}
            onInput={(v: string) => setOrderFormPriceInput(v)}
          />
          <Show when={orderFormPriceInput() !== "" && !priceValid()}>
            <text content="  ✗ 0.01-0.99" fg={theme.error} />
          </Show>
          <Show when={tickSizeInvalid()}>
            <text content={`  ✗ Tick ${formatCents(orderBook()?.tickSize)}`} fg={theme.error} />
          </Show>
        </box>

        <box flexDirection="row" alignItems="center">
          <text
            content={orderFormFocusField() === "shares" ? "▶ Shares (max 2 decimals): " : "  Shares (max 2 decimals): "}
            fg={orderFormFocusField() === "shares" ? sideColor() : theme.textMuted}
            width={28}
          />
          <input
            width={12}
            value={orderFormSharesInput()}
            focused={orderFormFocusField() === "shares"}
            onInput={(v: string) => setOrderFormSharesInput(v)}
          />
          <Show when={minSizeInvalid()}>
            <text content={`  ✗ Min ${orderBook()?.minOrderSize?.toFixed(2) ?? "--"}`} fg={theme.error} />
          </Show>
        </box>

        <Show when={estimatedCost() !== null}>
          <box flexDirection="row">
            <text content="  Est. Cost    : " fg={theme.textMuted} width={17} />
            <text content={`$${estimatedCost()!.toFixed(4)} USDC`} fg={theme.warning} />
            <text content={`  (Bal: $${tradingBalance().toFixed(2)}${walletState.funderAddress ? " proxy" : ""})`} fg={theme.textMuted} />
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
        <Show when={marketImpactWarning()}>
          <text content={marketImpactWarning()!} fg={theme.warning} />
        </Show>
      </box>

      {/* Balance usage bar */}
      <Show when={walletState.connected && estimatedCost() !== null}>
        <box flexDirection="column" paddingLeft={2} paddingRight={2}>
          <text content="─── RISK ANALYSIS ───────────────────────────────────" fg={theme.borderSubtle} />
          {(() => {
            const pct = Math.min(1, (estimatedCost() ?? 0) / Math.max(1, tradingBalance()));
            const barWidth = 30;
            const filled = Math.round(pct * barWidth);
            const empty = barWidth - filled;
            const barColor = pct > 0.9 ? theme.error : pct > 0.6 ? theme.warning : theme.success;
            return (
              <box flexDirection="row">
                <text content="Bal usage: [" fg={theme.textMuted} />
                <text content={"█".repeat(filled)} fg={barColor} />
                <text content={"░".repeat(empty)} fg={theme.borderSubtle} />
                <text content={`] ${(pct * 100).toFixed(0)}%`} fg={barColor} />
              </box>
            );
          })()}
          <Show when={bookParticipation() !== null}>
            <text
              content={`Book usage: ${(bookParticipation()! * 100).toFixed(1)}% of visible ${side() === "BUY" ? "ask" : "bid"} depth`}
              fg={bookParticipation()! > 0.25 ? theme.warning : theme.textMuted}
            />
          </Show>
        </box>
      </Show>

      {/* Breakeven / Kelly / Post-trade */}
      <Show when={walletState.connected}>
        <box flexDirection="row" paddingLeft={2} gap={4}>
          <Show when={breakevenPrice() !== null}>
            <text content={`Breakeven: ${((breakevenPrice()!) * 100).toFixed(1)}¢`} fg={theme.textMuted} />
          </Show>
          <Show when={kellySizing() !== null && kellySizing()! > 0}>
            <text content={`Kelly: $${kellySizing()!.toFixed(2)}`} fg={theme.accent} />
          </Show>
          <text content={`Post-trade: $${positionImpact().toFixed(2)}`} fg={theme.warning} />
        </box>
      </Show>

      <text content="" />

      {/* Status / hints */}
      <box flexDirection="column" paddingLeft={2}>
        <text content="─────────────────────────────────────────────────────" fg={theme.borderSubtle} />
      </box>
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
